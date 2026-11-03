import { Hono, type Context } from 'hono';
import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { utf8 } from '../lib/crypto';
import { fail, jsonBody, str } from '../lib/http';
import { checkPassword as checkPasswordHash, hashPassword } from '../lib/password';
import { LIMITS, hit } from '../lib/rateLimit';
import { emailKey } from '../../shared/domain/account';
import { EMAIL_TAKEN, checkEmail, checkPassword, emailTaken } from './auth';
import { FRESH_SIGNIN_MS, clearSessionCookie, requireUser } from '../lib/session';
import { RP_NAME, checkOwnPasskey, ownPasskeyOptions, parseTransports, passkeyName, saveChallenge, takeChallenge } from '../lib/webauthn';

export const account = new Hono<AppEnv>();

interface PasskeyRow {
  id: string;
  name: string | null;
  created_at: number;
  last_used_at: number | null;
}

async function listPasskeys(db: D1Database, userId: string) {
  const { results } = await db
    .prepare('SELECT id, name, created_at, last_used_at FROM passkeys WHERE user_id = ?1 ORDER BY created_at')
    .bind(userId)
    .all<PasskeyRow>();
  return results.map((p) => ({ id: p.id, name: p.name ?? 'Passkey', createdAt: p.created_at, lastUsedAt: p.last_used_at }));
}

/** D83: true unless this device signed in in the last few minutes (then you've just typed your password, or used Face ID). */
const passwordNeeded = (c: Context<AppEnv>) => Date.now() - c.var.session!.createdAt > FRESH_SIGNIN_MS;

/**
 * Adding a passkey. D83: it asks for your password first, unless you signed in on this device a few
 * minutes ago (the Face ID offer straight after sign-up), so someone holding your unlocked phone can't
 * quietly add a way into your account.
 */
account.post('/passkeys/options', requireUser(), async (c) => {
  const user = c.var.user!;
  if (passwordNeeded(c)) {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) fail(400, 'password_needed', 'Enter your password to add Face ID.');
    await confirmPassword(c, password);
  }
  const { results } = await c.env.DB.prepare('SELECT id, transports FROM passkeys WHERE user_id = ?1').bind(user.id).all<{ id: string; transports: string | null }>();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: c.env.RP_ID,
    userName: user.username,
    userID: utf8(user.id),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257],
    excludeCredentials: results.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
  });
  const challengeId = await saveChallenge(c, 'register', options.challenge, { userId: user.id });
  return c.json({ challengeId, options });
});

account.post('/passkeys/verify', requireUser(), async (c) => {
  const user = c.var.user!;
  const body = await jsonBody(c);
  const challenge = await takeChallenge(c, str(body, 'challengeId'), 'register');
  // A sign-up challenge (username set) or another user's challenge can't add a passkey here.
  if (challenge.user_id !== user.id || challenge.username !== null) fail(400, 'challenge_expired', 'That took too long. Please try again.');

  const verification = await verifyRegistrationResponse({
    response: body.response as RegistrationResponseJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: c.env.ORIGIN,
    expectedRPID: c.env.RP_ID,
  }).catch(() => ({ verified: false as const }));
  if (!verification.verified) fail(400, 'passkey_failed', 'The passkey couldn’t be checked. Please try again.');
  const { credential } = verification.registrationInfo;

  const now = Date.now();
  const db = c.env.DB;
  const inserted = await db
    .prepare('INSERT INTO passkeys (id, user_id, public_key, counter, transports, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (id) DO NOTHING')
    .bind(credential.id, user.id, credential.publicKey, credential.counter, JSON.stringify(credential.transports ?? []), passkeyName(c.req.header('user-agent')), now)
    .run();
  if (inserted.meta.changes !== 1) fail(409, 'passkey_exists', 'That passkey is already registered.');
  return c.json({ passkeys: await listPasskeys(db, user.id) });
});

account.get('/passkeys', requireUser(), async (c) => c.json({ passkeys: await listPasskeys(c.env.DB, c.var.user!.id), passwordNeeded: passwordNeeded(c) }));

// D80: passkeys are optional now (the email and password always sign you in), so any of them can go, the last too.
account.delete('/passkeys/:id', requireUser(), async (c) => {
  const userId = c.var.user!.id;
  const res = await c.env.DB.prepare('DELETE FROM passkeys WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), userId).run();
  if (res.meta.changes !== 1) fail(404, 'not_found', 'That passkey no longer exists.');
  return c.json({ passkeys: await listPasskeys(c.env.DB, userId) });
});

// Email and password (D80) ---------------------------------------------------------

/** Checks your current password before a change; a few wrong tries and it waits. */
export async function confirmPassword(c: Context<AppEnv>, password: string): Promise<void> {
  const user = c.var.user!;
  await hit(c, LIMITS.passwordCheck, user.id);
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1').bind(user.id).first<{ password_hash: string | null }>();
  if (!(await checkPasswordHash(password, row?.password_hash))) fail(400, 'wrong_password', 'That password isn’t right.');
}

/** An account from before D80 adds its email and password, once; then the app opens as normal. */
account.post('/login', requireUser({ allowNeedsLogin: true }), async (c) => {
  const user = c.var.user!;
  if (!user.needsLogin) fail(409, 'login_exists', 'Your account already has an email and password.');
  const body = await jsonBody(c);
  const email = str(body, 'email').trim();
  const password = str(body, 'password');
  checkEmail(email);
  checkPassword(password);
  const db = c.env.DB;
  if (await emailTaken(db, email, user.id)) fail(409, 'email_taken', EMAIL_TAKEN);
  const res = await db
    .prepare('UPDATE users SET email = ?1, email_lower = ?2, password_hash = ?3 WHERE id = ?4 AND email IS NULL')
    .bind(email, emailKey(email), await hashPassword(password), user.id)
    .run()
    .catch((e) => (String(e).includes('UNIQUE') ? fail(409, 'email_taken', EMAIL_TAKEN) : Promise.reject(e)));
  if (res.meta.changes !== 1) fail(409, 'login_exists', 'Your account already has an email and password.');
  return c.json({ email });
});

/** A new email, after your password. */
account.put('/email', requireUser(), async (c) => {
  const user = c.var.user!;
  const body = await jsonBody(c);
  const email = str(body, 'email').trim();
  checkEmail(email);
  await confirmPassword(c, str(body, 'password'));
  const db = c.env.DB;
  if (await emailTaken(db, email, user.id)) fail(409, 'email_taken', EMAIL_TAKEN);
  await db
    .prepare('UPDATE users SET email = ?1, email_lower = ?2 WHERE id = ?3')
    .bind(email, emailKey(email), user.id)
    .run()
    .catch((e) => (String(e).includes('UNIQUE') ? fail(409, 'email_taken', EMAIL_TAKEN) : Promise.reject(e)));
  return c.json({ email });
});

/** D83: step 1 of a new password without the old one: a fresh Face ID check with one of your passkeys. */
account.post('/password/options', requireUser(), async (c) => {
  const user = c.var.user!;
  const has = await c.env.DB.prepare('SELECT 1 AS ok FROM passkeys WHERE user_id = ?1').bind(user.id).first();
  if (!has) fail(400, 'no_passkey', 'You haven’t set up Face ID, so you’ll need your current password.');
  return c.json(await ownPasskeyOptions(c, user.id));
});

/**
 * A new password, after the current one, or (D83) after a fresh Face ID check: the way back in for a
 * forgotten password. Every other device is signed out; this one stays in. The reply lists the passkeys
 * that can still sign in, so you can remove any you don't recognise.
 */
account.put('/password', requireUser(), async (c) => {
  const user = c.var.user!;
  const body = await jsonBody(c);
  const password = str(body, 'password');
  checkPassword(password);
  if (typeof body.challengeId === 'string' && body.current === undefined) {
    await hit(c, LIMITS.passwordCheck, user.id);
    await checkOwnPasskey(c, body, user.id);
  } else await confirmPassword(c, str(body, 'current'));
  const db = c.env.DB;
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ?1 WHERE id = ?2').bind(await hashPassword(password), user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND token_hash != ?2').bind(user.id, c.var.session!.tokenHash),
  ]);
  return c.json({ ok: true, passkeys: await listPasskeys(db, user.id) });
});

account.post('/signout-everywhere', requireUser({ allowNeedsLogin: true }), async (c) => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(c.var.user!.id).run();
  clearSessionCookie(c);
  return c.json({ ok: true });
});
