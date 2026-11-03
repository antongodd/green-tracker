import { describe, expect, it } from 'vitest';
import { SoftPasskey } from './authenticator';
import { Browser, PASSWORD, addPasskey, ageSessions, signIn, signInWithPassword, signUp, uniqueName } from './client';
import { d1 } from './store';

// D83: sign-in hardening. Strangers can't lock you out; adding Face ID asks for your password; a new
// password with Face ID instead of the old one; the passkeys that can still sign in after a change.

/** Ten wrong passwords for `email`, each from a new device: the email now waits for strangers. */
async function strangersGuess(email: string) {
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await signInWithPassword(new Browser(), email, `guess ${i}`)).status);
  expect(statuses).toEqual([...Array(10).fill(400), 429]);
}

describe('the per-email limit counts only wrong passwords (D83)', () => {
  it('right passwords never count', async () => {
    const { email } = await signUp(new Browser(), uniqueName(), { passkey: false });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await signInWithPassword(new Browser(), email)).status);
    expect(statuses).toEqual(Array(12).fill(200));
  });

  it('strangers’ wrong tries can’t keep the owner out on a device they’ve signed in on, even after signing out', async () => {
    const owner = new Browser();
    const { email } = await signUp(owner, uniqueName(), { passkey: false });
    await owner.post('/api/auth/signout');
    await strangersGuess(email);
    // A stranger with the right password still waits: the device is new.
    expect((await signInWithPassword(new Browser(), email)).status).toBe(429);
    expect((await signInWithPassword(owner, email)).status).toBe(200);
  });

  it('a remembered device’s own wrong tries are limited too (10 every 15 minutes)', async () => {
    const owner = new Browser();
    const { email } = await signUp(owner, uniqueName(), { passkey: false });
    await owner.post('/api/auth/signout');
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await signInWithPassword(owner, email, `typo ${i}`)).status);
    expect(statuses).toEqual([...Array(10).fill(400), 429]);
    expect((await signInWithPassword(owner, email)).status).toBe(429);
    // They didn't use up the email's tries for everyone else.
    expect((await signInWithPassword(new Browser(), email)).status).toBe(200);
  });

  it('a device is remembered only for the accounts signed in on it', async () => {
    const shared = new Browser();
    await signUp(shared, uniqueName(), { passkey: false });
    const { email: theirs } = await signUp(new Browser(), uniqueName(), { passkey: false });
    await strangersGuess(theirs);
    expect((await signInWithPassword(shared, theirs)).status).toBe(429);
  });

  it('a device signed in before D83 is remembered when the app opens', async () => {
    const owner = new Browser();
    const { email } = await signUp(owner, uniqueName(), { passkey: false });
    owner.cookies.delete('gt_device'); // as every phone was before D83
    await owner.get('/api/auth/me');
    expect(owner.cookies.has('gt_device')).toBe(true);
    await owner.post('/api/auth/signout');
    await strangersGuess(email);
    expect((await signInWithPassword(owner, email)).status).toBe(200);
  });

  it('the device cookie is HttpOnly and SameSite=Lax, and only its hash is stored', async () => {
    const b = new Browser();
    const { username } = await signUp(b, uniqueName(), { passkey: false });
    const cookie = b.lastSetCookie.find((c) => c.startsWith('gt_device='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=34560000/i);
    const token = b.cookies.get('gt_device')!;
    const rows = d1<{ token_hash: string }>('SELECT token_hash FROM known_devices WHERE user_id = (SELECT id FROM users WHERE username = ?)', username);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toContain(token);
  });
});

describe('adding Face ID asks for your password (D83)', () => {
  it('not straight after signing in (the offer after sign-up), but a few minutes later it does', async () => {
    const b = new Browser();
    const { username } = await signUp(b, uniqueName(), { passkey: false });
    expect((await b.get('/api/account/passkeys')).json.passwordNeeded).toBe(false);
    expect((await addPasskey(b)).res.status).toBe(200);

    await ageSessions(username);
    expect((await b.get('/api/account/passkeys')).json.passwordNeeded).toBe(true);
    expect((await b.post('/api/account/passkeys/options')).json.error).toBe('password_needed');
    expect((await b.post('/api/account/passkeys/options', { password: 'not my password' })).json.error).toBe('wrong_password');
    const opts = await b.post('/api/account/passkeys/options', { password: PASSWORD });
    expect(opts.status).toBe(200);
    const key = new SoftPasskey();
    const res = await b.post('/api/account/passkeys/verify', { challengeId: opts.json.challengeId, response: await key.register(opts.json.options) });
    expect(res.status).toBe(200);
    expect(res.json.passkeys).toHaveLength(2);
  });

  it('signing in again (with the password or Face ID) counts as fresh', async () => {
    const b = new Browser();
    const { username, email, passkey } = await signUp(b);
    await ageSessions(username);
    await signInWithPassword(b, email);
    expect((await b.get('/api/account/passkeys')).json.passwordNeeded).toBe(false);
    await ageSessions(username);
    await signIn(b, passkey);
    expect((await b.get('/api/account/passkeys')).json.passwordNeeded).toBe(false);
  });
});

describe('a new password with Face ID instead of the old one (D83)', () => {
  async function withFaceId(b: Browser, key: SoftPasskey, password: string) {
    const opts = await b.post('/api/account/password/options');
    return b.req('PUT', '/api/account/password', { challengeId: opts.json.challengeId, response: await key.authenticate(opts.json.options), password });
  }

  it('a fresh Face ID check sets a new password; other devices are signed out; the passkey shows it was used', async () => {
    const b = new Browser();
    const { username, email, passkey } = await signUp(b);
    await ageSessions(username);
    const other = new Browser();
    await signInWithPassword(other, email);
    const res = await withFaceId(b, passkey, 'forgot the old one');
    expect(res.status).toBe(200);
    expect(res.json.passkeys).toHaveLength(1);
    expect(res.json.passkeys[0].lastUsedAt).toBeGreaterThan(Date.now() - 60_000);
    expect((await other.get('/api/auth/me')).json.user).toBeNull();
    expect((await signInWithPassword(new Browser(), email, 'forgot the old one')).status).toBe(200);
  });

  it('only this account’s passkey, checked just now, will do', async () => {
    const b = new Browser();
    const { email } = await signUp(b);
    const { passkey: theirs } = await signUp(new Browser());
    expect((await withFaceId(b, theirs, 'not today thanks')).json.error).toBe('passkey_failed');
    // A sign-in challenge (no account) isn't one.
    const signinOpts = await b.post('/api/auth/signin/options');
    const { passkey: mine } = await addPasskey(b);
    const res = await b.req('PUT', '/api/account/password', { challengeId: signinOpts.json.challengeId, response: await mine.authenticate(signinOpts.json.options), password: 'not today thanks' });
    expect(res.json.error).toBe('challenge_expired');
    // No proof at all is refused.
    expect((await b.req('PUT', '/api/account/password', { password: 'not today thanks' })).status).toBe(400);
    expect((await signInWithPassword(new Browser(), email)).status).toBe(200);
  });

  it('an account without Face ID needs its current password', async () => {
    const b = new Browser();
    await signUp(b, uniqueName(), { passkey: false });
    expect((await b.post('/api/account/password/options')).json.error).toBe('no_passkey');
  });
});

describe('after a password change, the passkeys that can still sign in (D83)', () => {
  it('the reply lists them, with when each was added and last used', async () => {
    const b = new Browser();
    const { passkey } = await signUp(b);
    await signIn(b, passkey);
    const res = await b.req('PUT', '/api/account/password', { current: PASSWORD, password: 'a brand new one' });
    expect(res.status).toBe(200);
    expect(res.json.passkeys).toEqual([{ id: passkey.id, name: expect.any(String), createdAt: expect.any(Number), lastUsedAt: expect.any(Number) }]);
  });
});
