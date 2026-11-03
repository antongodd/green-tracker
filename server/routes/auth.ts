import { Hono } from 'hono';
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import {
  EMAIL_PROBLEM_TEXT,
  PASSWORD_PROBLEM_TEXT,
  USERNAME_PROBLEM_TEXT,
  emailKey,
  emailProblem,
  passwordProblem,
  usernameKey,
  usernameProblem,
} from '../../shared/domain/account';
import { randomId, sha256Hex } from '../lib/crypto';
import { fail, jsonBody, str } from '../lib/http';
import { LIMITS, clientKey, hit } from '../lib/rateLimit';
import { checkPassword as checkPasswordHash, hashPassword } from '../lib/password';
import { clearSessionCookie, startSession } from '../lib/session';
import { loadAppearance } from '../lib/appearance';
import { loadMainCurrency } from '../lib/money';
import { FEED_NEW_SQL } from './posts';
import { parseTransports, saveChallenge, takeChallenge } from '../lib/webauthn';

export const auth = new Hono<AppEnv>();

async function usernameTaken(db: D1Database, username: string): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM users WHERE username_lower = ?1').bind(usernameKey(username)).first()) !== null;
}

function checkUsername(username: string): void {
  const problem = usernameProblem(username);
  if (problem) fail(400, `username_${problem}`, USERNAME_PROBLEM_TEXT[problem]);
}

const TAKEN = 'That username is taken.';
export const EMAIL_TAKEN = 'There’s already an account with that email. Sign in instead.';

export async function emailTaken(db: D1Database, email: string, exceptUserId = ''): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM users WHERE email_lower = ?1 AND id != ?2').bind(emailKey(email), exceptUserId).first()) !== null;
}

export function checkEmail(email: string): void {
  const problem = emailProblem(email);
  if (problem) fail(400, `email_${problem}`, EMAIL_PROBLEM_TEXT[problem]);
}

export function checkPassword(password: string): void {
  const problem = passwordProblem(password);
  if (problem) fail(400, `password_${problem}`, PASSWORD_PROBLEM_TEXT[problem]);
}

/** Who is signed in. Always 200 so the client can branch on `user`. */
auth.get('/me', async (c) => {
  const user = c.var.user;
  const site = c.env.SITE === 'dev' ? 'dev' : 'live'; // D47
  if (!user) return c.json({ user: null, site });
  const counts = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM passkeys WHERE user_id = ?1) AS passkeys,
            (SELECT email FROM users WHERE id = ?1) AS email,
            (SELECT COUNT(*) FROM follows WHERE followed_id = ?1 AND status = 'pending') AS requests,
            (SELECT feed_seen_at FROM users WHERE id = ?1) AS seen`,
  )
    .bind(user.id)
    .first<{ passkeys: number; email: string | null; requests: number; seen: number | null }>();
  // D77: the Feed's dot: something new since you last opened it.
  const feed = await c.env.DB.prepare(FEED_NEW_SQL).bind(user.id, counts?.seen ?? 0).first<{ new: number }>();
  // Your profile photo (D23): its version and framing, for the People card and export.
  const photo = await c.env.DB.prepare('SELECT image_set, crop_x, crop_y, crop_w, crop_h FROM profile_photos WHERE user_id = ?1')
    .bind(user.id)
    .first<{ image_set: string; crop_x: number; crop_y: number; crop_w: number; crop_h: number }>();
  return c.json({
    user: {
      username: user.username,
      ...(photo && { photo: { version: photo.image_set, crop: { x: photo.crop_x, y: photo.crop_y, w: photo.crop_w, h: photo.crop_h, square: true } } }),
    },
    // D80: private, only ever sent to you. An account from before D80 has none yet and must add one.
    email: counts?.email ?? null,
    needsLogin: user.needsLogin,
    passkeys: counts?.passkeys ?? 0,
    pendingRequests: counts?.requests ?? 0,
    feedNew: feed?.new === 1,
    // D48: how the app looks for you, there from the first screen.
    appearance: await loadAppearance(c.env.DB, user.id),
    // D66: your main currency, which every price shown together is in.
    currency: await loadMainCurrency(c.env.DB, user.id),
    site,
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

// Sign up (D80): email and password, then a username, sent together. Passkeys are added afterwards, if wanted.

auth.post('/signup', async (c) => {
  const override = Number(c.env.SIGNUP_LIMIT_PER_HOUR);
  await hit(c, override > 0 ? { ...LIMITS.signup, max: override } : LIMITS.signup, await clientKey(c));
  const body = await jsonBody(c);
  const email = str(body, 'email').trim();
  const password = str(body, 'password');
  const username = str(body, 'username');
  checkEmail(email);
  checkPassword(password);
  checkUsername(username);
  const db = c.env.DB;
  if (await emailTaken(db, email)) fail(409, 'email_taken', EMAIL_TAKEN);
  if (await usernameTaken(db, username)) fail(409, 'username_taken', TAKEN);
  const userId = randomId();
  try {
    await db
      .prepare('INSERT INTO users (id, username, username_lower, created_at, email, email_lower, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(userId, username, usernameKey(username), Date.now(), email, emailKey(email), await hashPassword(password))
      .run();
  } catch (e) {
    // Someone took the email or the name between the checks and now.
    if (String(e).includes('UNIQUE')) {
      if (await emailTaken(db, email)) fail(409, 'email_taken', EMAIL_TAKEN);
      if (await usernameTaken(db, username)) fail(409, 'username_taken', TAKEN);
    }
    throw e;
  }
  await startSession(c, userId);
  return c.json({ user: { username } });
});

/** Sign in with email and password (D80). The same answer for an unknown email and a wrong password. */
auth.post('/signin', async (c) => {
  await hit(c, LIMITS.signin, await clientKey(c));
  const body = await jsonBody(c);
  const email = str(body, 'email');
  const password = str(body, 'password');
  await hit(c, LIMITS.signinEmail, await sha256Hex(`email:${emailKey(email)}`));
  const user = await c.env.DB.prepare('SELECT id, username, password_hash FROM users WHERE email_lower = ?1')
    .bind(emailKey(email))
    .first<{ id: string; username: string; password_hash: string | null }>();
  if (!(await checkPasswordHash(password, user?.password_hash)) || !user) fail(400, 'signin_failed', 'That email and password don’t match.');
  await startSession(c, user.id);
  return c.json({ user: { username: user.username } });
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
  if (typeof response?.id !== 'string') fail(400, 'bad_request', 'The request couldn’t be read.');

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
  if (!verification.verified || !verification.authenticationInfo) fail(400, 'passkey_failed', 'The passkey couldn’t be checked. Please try again.');

  await c.env.DB.prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3')
    .bind(verification.authenticationInfo.newCounter, Date.now(), passkey.id)
    .run();
  await startSession(c, passkey.user_id);
  return c.json({ user: { username: passkey.username } });
});

auth.post('/signout', async (c) => {
  if (c.var.session) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(c.var.session.tokenHash).run();
  clearSessionCookie(c);
  return c.json({ ok: true });
});
