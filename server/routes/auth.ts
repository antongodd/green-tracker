import { Hono } from 'hono';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { USERNAME_PROBLEM_TEXT, normaliseRecoveryCode, usernameKey, usernameProblem } from '../../shared/domain/account';
import { randomId, utf8 } from '../lib/crypto';
import { fail, jsonBody, str } from '../lib/http';
import { LIMITS, clientKey, hit } from '../lib/rateLimit';
import { hashRecoveryCode, newRecoveryCodes } from '../lib/recovery';
import { clearSessionCookie, startSession } from '../lib/session';
import { RP_NAME, parseTransports, passkeyName, saveChallenge, takeChallenge } from '../lib/webauthn';

export const auth = new Hono<AppEnv>();

async function usernameTaken(db: D1Database, username: string): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM users WHERE username_lower = ?1').bind(usernameKey(username)).first()) !== null;
}

function checkUsername(username: string): void {
  const problem = usernameProblem(username);
  if (problem) fail(400, `username_${problem}`, USERNAME_PROBLEM_TEXT[problem]);
}

const TAKEN = 'That username is taken.';

/** Who is signed in. Always 200 so the client can branch on `user`. */
auth.get('/me', async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ user: null });
  const counts = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM passkeys WHERE user_id = ?1) AS passkeys,
            (SELECT COUNT(*) FROM recovery_codes WHERE user_id = ?1 AND used_at IS NULL) AS codes,
            (SELECT COUNT(*) FROM follows WHERE followed_id = ?1 AND status = 'pending') AS requests`,
  )
    .bind(user.id)
    .first<{ passkeys: number; codes: number; requests: number }>();
  return c.json({
    user: { username: user.username },
    needsPasskey: c.var.session!.needsPasskey,
    passkeys: counts?.passkeys ?? 0,
    recoveryCodesLeft: counts?.codes ?? 0,
    pendingRequests: counts?.requests ?? 0,
  });
});

/** Live availability for the sign-up form. */
auth.get('/username', async (c) => {
  await hit(c, LIMITS.usernameCheck, await clientKey(c));
  const username = c.req.query('u') ?? '';
  const problem = usernameProblem(username);
  if (problem) return c.json({ available: false, message: USERNAME_PROBLEM_TEXT[problem] });
  const taken = await usernameTaken(c.env.DB, username);
  return c.json({ available: !taken, message: taken ? TAKEN : null });
});

// Sign up: username → passkey → recovery codes. No user row exists until the passkey verifies.

auth.post('/signup/options', async (c) => {
  await hit(c, LIMITS.signup, await clientKey(c));
  const username = str(await jsonBody(c), 'username');
  checkUsername(username);
  if (await usernameTaken(c.env.DB, username)) fail(409, 'username_taken', TAKEN);
  const userId = randomId();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: c.env.RP_ID,
    userName: username,
    userID: utf8(userId),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257],
  });
  const challengeId = await saveChallenge(c, 'register', options.challenge, { userId, username });
  return c.json({ challengeId, options });
});

auth.post('/signup/verify', async (c) => {
  const body = await jsonBody(c);
  const challenge = await takeChallenge(c, str(body, 'challengeId'), 'register');
  if (!challenge.username || !challenge.user_id) fail(400, 'challenge_expired', 'That took too long. Please try again.');
  const username = challenge.username;
  const userId = challenge.user_id;

  const verification = await verifyRegistrationResponse({
    response: body.response as RegistrationResponseJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: c.env.ORIGIN,
    expectedRPID: c.env.RP_ID,
  }).catch(() => ({ verified: false as const }));
  if (!verification.verified) fail(400, 'passkey_failed', 'The passkey could not be checked. Please try again.');
  const { credential } = verification.registrationInfo;

  const now = Date.now();
  const db = c.env.DB;
  const { statements, codes } = await newRecoveryCodes(db, userId);
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id, username, username_lower, created_at) VALUES (?1, ?2, ?3, ?4)').bind(userId, username, usernameKey(username), now),
      db
        .prepare('INSERT INTO passkeys (id, user_id, public_key, counter, transports, name, created_at, last_used_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)')
        .bind(credential.id, userId, credential.publicKey, credential.counter, JSON.stringify(credential.transports ?? []), passkeyName(c.req.header('user-agent')), now),
      ...statements,
    ]);
  } catch (e) {
    // Someone took the name between the options call and now.
    if (String(e).includes('UNIQUE') && (await usernameTaken(db, username))) fail(409, 'username_taken', TAKEN);
    throw e;
  }
  await startSession(c, userId);
  return c.json({ user: { username }, recoveryCodes: codes });
});

// Sign in with a passkey (discoverable: no username needed).

auth.post('/signin/options', async (c) => {
  await hit(c, LIMITS.signin, await clientKey(c));
  const options = await generateAuthenticationOptions({ rpID: c.env.RP_ID, userVerification: 'required', allowCredentials: [] });
  const challengeId = await saveChallenge(c, 'authenticate', options.challenge);
  return c.json({ challengeId, options });
});

auth.post('/signin/verify', async (c) => {
  await hit(c, LIMITS.signin, await clientKey(c));
  const body = await jsonBody(c);
  const challenge = await takeChallenge(c, str(body, 'challengeId'), 'authenticate');
  const response = body.response as AuthenticationResponseJSON;
  if (typeof response?.id !== 'string') fail(400, 'bad_request', 'The request could not be read.');

  const passkey = await c.env.DB.prepare('SELECT p.id, p.user_id, p.public_key, p.counter, p.transports, u.username FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.id = ?1')
    .bind(response.id)
    .first<{ id: string; user_id: string; public_key: ArrayBuffer | number[]; counter: number; transports: string | null; username: string }>();
  if (!passkey) fail(400, 'unknown_passkey', 'This passkey isn’t linked to a Green Tracker account. It may have been removed.');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: c.env.ORIGIN,
    expectedRPID: c.env.RP_ID,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.public_key),
      counter: passkey.counter,
      transports: parseTransports(passkey.transports),
    },
  }).catch(() => ({ verified: false as const, authenticationInfo: null }));
  if (!verification.verified || !verification.authenticationInfo) fail(400, 'passkey_failed', 'The passkey could not be checked. Please try again.');

  await c.env.DB.prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3')
    .bind(verification.authenticationInfo.newCounter, Date.now(), passkey.id)
    .run();
  await startSession(c, passkey.user_id);
  return c.json({ user: { username: passkey.username } });
});

// Sign in with a recovery code: single use, and the session must add a new passkey first (D4).

auth.post('/recover', async (c) => {
  await hit(c, LIMITS.recoverIp, await clientKey(c));
  const body = await jsonBody(c);
  const username = str(body, 'username');
  await hit(c, LIMITS.recoverUser, usernameKey(username));
  const wrong: () => never = () => fail(400, 'recovery_failed', 'That username and code don’t match. Check both and try again.');

  const code = normaliseRecoveryCode(str(body, 'code'));
  const user = await c.env.DB.prepare('SELECT id, username FROM users WHERE username_lower = ?1').bind(usernameKey(username)).first<{ id: string; username: string }>();
  if (!code || !user) wrong();
  const used = await c.env.DB.prepare('UPDATE recovery_codes SET used_at = ?1 WHERE user_id = ?2 AND code_hash = ?3 AND used_at IS NULL')
    .bind(Date.now(), user.id, await hashRecoveryCode(user.id, code))
    .run();
  if (used.meta.changes !== 1) wrong();

  await startSession(c, user.id, { needsPasskey: true });
  return c.json({ user: { username: user.username }, needsPasskey: true });
});

auth.post('/signout', async (c) => {
  if (c.var.session) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(c.var.session.tokenHash).run();
  clearSessionCookie(c);
  return c.json({ ok: true });
});
