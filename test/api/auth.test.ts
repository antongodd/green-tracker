import { describe, expect, it } from 'vitest';
import { SoftPasskey } from './authenticator';
import { Browser, addPasskey, signIn, signUp, uniqueName } from './client';

describe('sign-up', () => {
  it('creates an account with a passkey, 10 recovery codes and a session', async () => {
    const b = new Browser();
    const { username, codes } = await signUp(b);
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(new Set(codes).size).toBe(10);

    const me = await b.get('/api/auth/me');
    expect(me.json).toMatchObject({ user: { username }, needsPasskey: false, passkeys: 1, recoveryCodesLeft: 10 });
  });

  it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
    const b = new Browser();
    const passkey = new SoftPasskey();
    const opts = await b.post('/api/auth/signup/options', { username: uniqueName() });
    await b.post('/api/auth/signup/verify', { challengeId: opts.json.challengeId, response: await passkey.register(opts.json.options) });
    const cookie = b.lastSetCookie.find((c) => c.startsWith('gt_session='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=5184000/); // 60 days
  });

  it('keeps usernames as typed but unique case-insensitively', async () => {
    const name = uniqueName('Mixed');
    const { username } = await signUp(new Browser(), name);
    const me = await new Browser().get(`/api/auth/username?u=${name.toLowerCase()}`);
    expect(me.json).toEqual({ available: false, message: 'That username is taken.' });
    const again = await new Browser().post('/api/auth/signup/options', { username: name.toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe('username_taken');
    expect(username).toBe(name);
  });

  it('rejects usernames outside the rules (D7)', async () => {
    const b = new Browser();
    for (const [u, error] of [
      ['ab', 'username_too_short'],
      ['a'.repeat(21), 'username_too_long'],
      ['has space', 'username_invalid_chars'],
      ['émile', 'username_invalid_chars'],
      ['dash-name', 'username_invalid_chars'],
    ] as const) {
      const res = await b.post('/api/auth/signup/options', { username: u });
      expect(res.status, u).toBe(400);
      expect(res.json.error, u).toBe(error);
    }
    const ok = await b.get('/api/auth/username?u=Good_name_1');
    expect(ok.json.available).toBe(true);
  });

  it('creates no account when the passkey step is abandoned', async () => {
    const b = new Browser();
    const username = uniqueName();
    await b.post('/api/auth/signup/options', { username });
    expect((await b.get(`/api/auth/username?u=${username}`)).json.available).toBe(true);
  });

  it('rejects a passkey made for another site', async () => {
    const b = new Browser();
    const opts = await b.post('/api/auth/signup/options', { username: uniqueName() });
    const res = await b.post('/api/auth/signup/verify', {
      challengeId: opts.json.challengeId,
      response: await new SoftPasskey().register(opts.json.options, { origin: 'https://evil.example' }),
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('passkey_failed');
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
  });

  it('uses each challenge once', async () => {
    const b = new Browser();
    const opts = await b.post('/api/auth/signup/options', { username: uniqueName() });
    const passkey = new SoftPasskey();
    const response = await passkey.register(opts.json.options);
    expect((await b.post('/api/auth/signup/verify', { challengeId: opts.json.challengeId, response })).status).toBe(200);
    const replay = await new Browser().post('/api/auth/signup/verify', { challengeId: opts.json.challengeId, response });
    expect(replay.status).toBe(400);
    expect(replay.json.error).toBe('challenge_expired');
  });
});

describe('sign-in with a passkey', () => {
  it('signs in on a new device without typing a username', async () => {
    const { username, passkey } = await signUp(new Browser());
    const phone = new Browser();
    const res = await signIn(phone, passkey);
    expect(res.status).toBe(200);
    expect(res.json.user.username).toBe(username);
    expect((await phone.get('/api/auth/me')).json.user.username).toBe(username);
  });

  it('rejects a signature from the wrong key', async () => {
    const { passkey } = await signUp(new Browser());
    const impostor = new SoftPasskey();
    // Same credential ID, different private key.
    Object.defineProperty(impostor, 'credentialId', { value: passkey.credentialId });
    await impostor.register({ challenge: 'x', user: { id: 'eA' } });
    const b = new Browser();
    const res = await signIn(b, impostor);
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('passkey_failed');
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
  });

  it('rejects an unknown passkey', async () => {
    const stray = new SoftPasskey();
    await stray.register({ challenge: 'x', user: { id: 'eA' } });
    const res = await signIn(new Browser(), stray);
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('unknown_passkey');
  });
});

describe('sessions', () => {
  it('signs out this device only', async () => {
    const laptop = new Browser();
    const { passkey } = await signUp(laptop);
    const phone = new Browser();
    await signIn(phone, passkey);
    const stolen = laptop.cookies.get('gt_session')!;

    await laptop.post('/api/auth/signout');
    expect(laptop.cookies.has('gt_session')).toBe(false);
    expect((await laptop.get('/api/auth/me')).json.user).toBeNull();
    // The old token is dead on the server, not just forgotten by the browser.
    const replay = new Browser();
    replay.cookies.set('gt_session', stolen);
    expect((await replay.get('/api/auth/me')).json.user).toBeNull();
    expect((await phone.get('/api/auth/me')).json.user).not.toBeNull();
  });

  it('signs out everywhere', async () => {
    const laptop = new Browser();
    const { passkey } = await signUp(laptop);
    const phone = new Browser();
    await signIn(phone, passkey);
    expect((await laptop.post('/api/account/signout-everywhere')).status).toBe(200);
    expect((await laptop.get('/api/auth/me')).json.user).toBeNull();
    expect((await phone.get('/api/auth/me')).json.user).toBeNull();
  });

  it('treats a forged cookie as signed out', async () => {
    const b = new Browser();
    b.cookies.set('gt_session', 'not-a-real-token');
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
    expect((await b.get('/api/account/passkeys')).status).toBe(401);
  });

  it('refuses state-changing requests from other origins', async () => {
    const b = new Browser();
    await signUp(b);
    for (const origin of ['https://evil.example', '']) {
      const res = await b.req('POST', '/api/account/signout-everywhere', {}, { origin });
      expect(res.status).toBe(403);
      expect(res.json.error).toBe('bad_origin');
    }
    expect((await b.get('/api/auth/me')).json.user).not.toBeNull();
  });

  it('never lets API responses be cached', async () => {
    const res = await new Browser().get('/api/auth/me');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('recovery codes', () => {
  it('signs in with a code, then requires a new passkey before anything else (D4)', async () => {
    const { username, codes } = await signUp(new Browser());
    const lost = new Browser();
    const res = await lost.post('/api/auth/recover', { username: username.toUpperCase(), code: codes[3]!.toLowerCase().replace('-', ' ') });
    expect(res.status).toBe(200);
    expect(res.json.needsPasskey).toBe(true);
    expect((await lost.get('/api/auth/me')).json).toMatchObject({ needsPasskey: true, recoveryCodesLeft: 9 });

    const blocked = await lost.get('/api/account/passkeys');
    expect(blocked.status).toBe(403);
    expect(blocked.json.error).toBe('needs_passkey');

    const { res: added } = await addPasskey(lost);
    expect(added.status).toBe(200);
    expect(added.json.passkeys).toHaveLength(2);
    expect((await lost.get('/api/auth/me')).json.needsPasskey).toBe(false);
    expect((await lost.get('/api/account/passkeys')).status).toBe(200);
  });

  it('uses each code once', async () => {
    const { username, codes } = await signUp(new Browser());
    expect((await new Browser().post('/api/auth/recover', { username, code: codes[0] })).status).toBe(200);
    const again = await new Browser().post('/api/auth/recover', { username, code: codes[0] });
    expect(again.status).toBe(400);
    expect(again.json.error).toBe('recovery_failed');
  });

  it('gives the same answer for a wrong code and an unknown user', async () => {
    const { username, codes } = await signUp(new Browser());
    const wrongCode = await new Browser().post('/api/auth/recover', { username, code: 'ABCD-EFGH' });
    const noUser = await new Browser().post('/api/auth/recover', { username: uniqueName('nobody'), code: codes[0] });
    expect(wrongCode.status).toBe(400);
    expect(noUser.json).toEqual(wrongCode.json);
  });

  it('does not accept one account’s code for another', async () => {
    const a = await signUp(new Browser());
    const b = await signUp(new Browser());
    const res = await new Browser().post('/api/auth/recover', { username: b.username, code: a.codes[0] });
    expect(res.status).toBe(400);
  });

  it('regenerating cancels the old set', async () => {
    const b = new Browser();
    const { username, codes: old } = await signUp(b);
    const fresh = await b.post('/api/account/recovery-codes');
    expect(fresh.json.recoveryCodes).toHaveLength(10);
    expect((await b.get('/api/account/recovery-codes')).json.remaining).toBe(10);
    expect((await new Browser().post('/api/auth/recover', { username, code: old[0] })).status).toBe(400);
    expect((await new Browser().post('/api/auth/recover', { username, code: fresh.json.recoveryCodes[0] })).status).toBe(200);
  });
});

describe('passkeys', () => {
  it('allows more than one passkey and refuses to remove the last', async () => {
    const b = new Browser();
    await signUp(b);
    const { passkey: second } = await addPasskey(b);
    let list = (await b.get('/api/account/passkeys')).json.passkeys;
    expect(list).toHaveLength(2);

    expect((await b.del(`/api/account/passkeys/${list[0].id}`)).status).toBe(200);
    list = (await b.get('/api/account/passkeys')).json.passkeys;
    expect(list.map((p: { id: string }) => p.id)).toEqual([second.id]);

    const last = await b.del(`/api/account/passkeys/${second.id}`);
    expect(last.status).toBe(409);
    expect(last.json.error).toBe('last_passkey');
  });

  it('a removed passkey can no longer sign in', async () => {
    const b = new Browser();
    const { passkey: first } = await signUp(b);
    await addPasskey(b);
    await b.del(`/api/account/passkeys/${first.id}`);
    expect((await signIn(new Browser(), first)).json.error).toBe('unknown_passkey');
  });

  it('cannot touch another account’s passkey by ID', async () => {
    const victim = new Browser();
    const { passkey } = await signUp(victim);
    await addPasskey(victim);
    const attacker = new Browser();
    await signUp(attacker);
    await addPasskey(attacker);
    const res = await attacker.del(`/api/account/passkeys/${passkey.id}`);
    expect(res.status).toBe(404);
    expect((await victim.get('/api/account/passkeys')).json.passkeys).toHaveLength(2);
  });

  it('cannot finish a sign-up challenge as an existing user', async () => {
    const b = new Browser();
    await signUp(b);
    const opts = await b.post('/api/auth/signup/options', { username: uniqueName() });
    const res = await b.post('/api/account/passkeys/verify', { challengeId: opts.json.challengeId, response: await new SoftPasskey().register(opts.json.options) });
    expect(res.status).toBe(400);
  });
});

describe('rate limits', () => {
  it('limits recovery attempts per username', async () => {
    const { username } = await signUp(new Browser());
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await new Browser().post('/api/auth/recover', { username, code: 'ABCD-EFGH' })).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });

  it('limits sign-ups per client', async () => {
    const b = new Browser();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await b.post('/api/auth/signup/options', { username: uniqueName() })).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const last = await b.post('/api/auth/signup/options', { username: uniqueName() });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
