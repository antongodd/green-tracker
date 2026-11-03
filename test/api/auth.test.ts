import { describe, expect, it } from 'vitest';
import { SoftPasskey } from './authenticator';
import { Browser, PASSWORD, addPasskey, emailFor, makeOldAccount, signIn, signInWithPassword, signUp, uniqueName } from './client';
import { d1 } from './store';

describe('sign-up (D80): email, password and a username', () => {
  const signup = (b: Browser, body: Record<string, string>) => b.post('/api/auth/signup', { email: emailFor(uniqueName()), password: PASSWORD, username: uniqueName(), ...body });

  it('creates an account and a session; no passkey needed, and no recovery codes', async () => {
    const b = new Browser();
    const username = uniqueName();
    const res = await signup(b, { username, email: ` ${emailFor(username)} ` });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ user: { username } });
    const me = await b.get('/api/auth/me');
    expect(me.json).toMatchObject({ user: { username }, email: emailFor(username), needsLogin: false, passkeys: 0 });
    expect(me.json).not.toHaveProperty('recoveryCodesLeft');
  });

  it('stores only a salted hash of the password, never the password', async () => {
    const b = new Browser();
    const username = uniqueName();
    await signup(b, { username });
    const [row] = d1<{ password_hash: string; email: string; email_lower: string }>('SELECT password_hash, email, email_lower FROM users WHERE username_lower = ?', username.toLowerCase());
    expect(row!.password_hash).toMatch(/^pbkdf2-sha256\$100000\$[\w-]{22}\$[\w-]{43}$/);
    expect(row!.password_hash).not.toContain(PASSWORD);
    // Two accounts with the same password get different hashes (each has its own salt).
    const other = uniqueName();
    await signup(new Browser(), { username: other });
    expect(d1<{ password_hash: string }>('SELECT password_hash FROM users WHERE username_lower = ?', other.toLowerCase())[0]!.password_hash).not.toBe(row!.password_hash);
  });

  it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
    const b = new Browser();
    await signup(b, {});
    const cookie = b.lastSetCookie.find((c) => c.startsWith('gt_session='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=5184000/); // 60 days
  });

  it('one account per email, whatever the case', async () => {
    const username = uniqueName();
    await signup(new Browser(), { username, email: emailFor(username) });
    const again = await signup(new Browser(), { email: emailFor(username).toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe('email_taken');
  });

  it('keeps usernames as typed but unique case-insensitively', async () => {
    const name = uniqueName('Mixed');
    const { username } = await signUp(new Browser(), name, { passkey: false });
    const me = await new Browser().get(`/api/auth/username?u=${name.toLowerCase()}`);
    expect(me.json).toEqual({ available: false, message: 'That username is taken.' });
    const again = await signup(new Browser(), { username: name.toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe('username_taken');
    expect(username).toBe(name);
  });

  it('rejects usernames, emails and passwords outside the rules, and creates nothing', async () => {
    const b = new Browser();
    for (const [body, error] of [
      [{ username: 'ab' }, 'username_too_short'],
      [{ username: 'a'.repeat(21) }, 'username_too_long'],
      [{ username: 'has space' }, 'username_invalid_chars'],
      [{ username: 'émile' }, 'username_invalid_chars'],
      [{ email: '' }, 'email_empty'],
      [{ email: 'not-an-email' }, 'email_invalid'],
      [{ password: '1234567' }, 'password_too_short'],
      [{ password: 'a'.repeat(201) }, 'password_too_long'],
    ] as const) {
      const res = await signup(b, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.error, JSON.stringify(body)).toBe(error);
    }
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
    const ok = await b.get('/api/auth/username?u=Good_name_1');
    expect(ok.json.available).toBe(true);
  });

  it('the old passkey sign-up is gone', async () => {
    expect((await new Browser().post('/api/auth/signup/options', { username: uniqueName() })).status).toBe(404);
  });
});

describe('sign-in with email and password (D80)', () => {
  it('signs in on a new device, the email in any case', async () => {
    const { username, email } = await signUp(new Browser(), uniqueName(), { passkey: false });
    const phone = new Browser();
    const res = await signInWithPassword(phone, ` ${email.toUpperCase()} `);
    expect(res.status).toBe(200);
    expect(res.json.user.username).toBe(username);
    expect((await phone.get('/api/auth/me')).json.user.username).toBe(username);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await signUp(new Browser(), uniqueName(), { passkey: false });
    const wrong = await signInWithPassword(new Browser(), email, 'not the password');
    const unknown = await signInWithPassword(new Browser(), 'nobody-here@example.test');
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(400);
      expect(res.json).toEqual({ error: 'signin_failed', message: 'That email and password don’t match.' });
    }
  });

  it('slows down guessing: 10 tries per email every 15 minutes, from anywhere', async () => {
    const { email } = await signUp(new Browser(), uniqueName(), { passkey: false });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await signInWithPassword(new Browser(), email, `guess ${i}`)).status);
    expect(statuses).toEqual([...Array(10).fill(400), 429]);
    // Even the right password waits now, from a device the account hasn't signed in on (D83).
    expect((await signInWithPassword(new Browser(), email)).status).toBe(429);
  });
});

describe('accounts from before email and password (D80)', () => {
  it('sign in with Face ID, can do nothing until they add an email and password, then everything works', async () => {
    const b = new Browser();
    const { username, passkey } = await signUp(b);
    await makeOldAccount(username);
    expect((await b.get('/api/auth/me')).json).toMatchObject({ user: { username }, email: null, needsLogin: true, passkeys: 1 });
    const blocked = await b.get('/api/products');
    expect(blocked.status).toBe(403);
    expect(blocked.json.error).toBe('needs_login');

    // A new device signs in with the passkey and lands in the same place.
    const phone = new Browser();
    expect((await signIn(phone, passkey)).status).toBe(200);
    expect((await phone.get('/api/auth/me')).json.needsLogin).toBe(true);

    expect((await phone.post('/api/account/login', { email: 'nope', password: PASSWORD })).json.error).toBe('email_invalid');
    expect((await phone.post('/api/account/login', { email: emailFor(username), password: 'short' })).json.error).toBe('password_too_short');
    const added = await phone.post('/api/account/login', { email: emailFor(username), password: PASSWORD });
    expect(added.status).toBe(200);
    expect((await b.get('/api/auth/me')).json).toMatchObject({ email: emailFor(username), needsLogin: false });
    expect((await b.get('/api/products')).status).toBe(200);
    expect((await signInWithPassword(new Browser(), emailFor(username))).status).toBe(200);

    // Only once: after that, Settings changes them (with the password).
    const again = await phone.post('/api/account/login', { email: emailFor(uniqueName()), password: PASSWORD });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe('login_exists');
  });

  it("can't take an email another account has", async () => {
    const { email } = await signUp(new Browser(), uniqueName(), { passkey: false });
    const b = new Browser();
    const { username } = await signUp(b);
    await makeOldAccount(username);
    const res = await b.post('/api/account/login', { email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe('email_taken');
  });
});

describe('changing your email and password (D80)', () => {
  it('a new email, after your password', async () => {
    const b = new Browser();
    const { email } = await signUp(b, uniqueName(), { passkey: false });
    const fresh = emailFor(uniqueName());
    expect((await b.req('PUT', '/api/account/email', { email: fresh, password: 'wrong password' })).json.error).toBe('wrong_password');
    expect((await b.req('PUT', '/api/account/email', { email: fresh, password: PASSWORD })).json).toEqual({ email: fresh });
    expect((await b.get('/api/auth/me')).json.email).toBe(fresh);
    expect((await signInWithPassword(new Browser(), email)).status).toBe(400);
    expect((await signInWithPassword(new Browser(), fresh)).status).toBe(200);
    // Someone else's email is refused.
    const { email: theirs } = await signUp(new Browser(), uniqueName(), { passkey: false });
    expect((await b.req('PUT', '/api/account/email', { email: theirs, password: PASSWORD })).json.error).toBe('email_taken');
  });

  it('a new password, after the current one; other devices are signed out, this one stays', async () => {
    const b = new Browser();
    const { email } = await signUp(b, uniqueName(), { passkey: false });
    const other = new Browser();
    await signInWithPassword(other, email);
    expect((await b.req('PUT', '/api/account/password', { current: 'wrong password', password: 'a brand new one' })).json.error).toBe('wrong_password');
    expect((await b.req('PUT', '/api/account/password', { current: PASSWORD, password: 'short' })).json.error).toBe('password_too_short');
    expect((await b.req('PUT', '/api/account/password', { current: PASSWORD, password: 'a brand new one' })).status).toBe(200);
    expect((await b.get('/api/auth/me')).json.user).not.toBeNull();
    expect((await other.get('/api/auth/me')).json.user).toBeNull();
    expect((await signInWithPassword(new Browser(), email)).status).toBe(400);
    expect((await signInWithPassword(new Browser(), email, 'a brand new one')).status).toBe(200);
  });

  it('wrong passwords there are limited too', async () => {
    const b = new Browser();
    await signUp(b, uniqueName(), { passkey: false });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await b.req('PUT', '/api/account/password', { current: `guess ${i}`, password: 'a brand new one' })).status);
    expect(statuses).toEqual([...Array(10).fill(400), 429]);
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

describe('recovery codes are gone (D80)', () => {
  it('their addresses no longer exist', async () => {
    const b = new Browser();
    await signUp(b, uniqueName(), { passkey: false });
    expect((await b.post('/api/auth/recover', { username: 'x', code: 'ABCD-EFGH' })).status).toBe(404);
    expect((await b.get('/api/account/recovery-codes')).status).toBe(404);
    expect((await b.post('/api/account/recovery-codes')).status).toBe(404);
  });
});

describe('passkeys', () => {
  it('allows more than one passkey, and any can go, the last too (D80: the password always works)', async () => {
    const b = new Browser();
    await signUp(b);
    const { passkey: second } = await addPasskey(b);
    let list = (await b.get('/api/account/passkeys')).json.passkeys;
    expect(list).toHaveLength(2);

    expect((await b.del(`/api/account/passkeys/${list[0].id}`)).status).toBe(200);
    list = (await b.get('/api/account/passkeys')).json.passkeys;
    expect(list.map((p: { id: string }) => p.id)).toEqual([second.id]);

    expect((await b.del(`/api/account/passkeys/${second.id}`)).status).toBe(200);
    expect((await b.get('/api/account/passkeys')).json.passkeys).toEqual([]);
    expect((await b.get('/api/auth/me')).json.passkeys).toBe(0);
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
});

describe('rate limits', () => {
  it('limits sign-ups per client', async () => {
    const b = new Browser();
    const statuses: number[] = [];
    // A refused sign-up counts too, so ten bad tries cost nothing in accounts.
    for (let i = 0; i < 10; i++) statuses.push((await b.post('/api/auth/signup', { email: 'x', password: 'x', username: 'x' })).status);
    expect(statuses.every((s) => s === 400)).toBe(true);
    const last = await b.post('/api/auth/signup', { email: emailFor(uniqueName()), password: PASSWORD, username: uniqueName() });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
