import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { randomToken, sha256Hex } from './crypto';
import { fail } from './http';
import { rememberDevice } from './knownDevice';

export const SESSION_COOKIE = 'gt_session';
const DAY = 24 * 60 * 60 * 1000;
/** Sliding: every day of use pushes expiry back to 60 days out. */
export const SESSION_TTL = 60 * DAY;

function cookieOptions(c: Context<AppEnv>) {
  return {
    httpOnly: true,
    secure: c.env.ORIGIN.startsWith('https://'),
    sameSite: 'Lax' as const,
    path: '/',
  };
}

/** Creates a session for `userId` and sets the cookie. Only the token's hash is stored. The device is remembered (D83). */
export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256Hex(token), userId, now, now + SESSION_TTL)
    .run();
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(c), maxAge: SESSION_TTL / 1000 });
  await rememberDevice(c, userId);
}

/** D83: a sign-in this recent counts as having just typed your password (or used Face ID). */
export const FRESH_SIGNIN_MS = 5 * 60 * 1000;

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

/** Loads the signed-in user (if any) into `c.var.user` / `c.var.session`. Never rejects. */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null);
  c.set('session', null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    const row = await c.env.DB.prepare(
      `SELECT s.expires_at, s.created_at, u.id, u.username, u.email IS NULL AS needs_login
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1`,
    )
      .bind(tokenHash)
      .first<{ expires_at: number; created_at: number; id: string; username: string; needs_login: number }>();
    if (row && row.expires_at > now) {
      c.set('user', { id: row.id, username: row.username, needsLogin: row.needs_login === 1 });
      c.set('session', { tokenHash, createdAt: row.created_at });
      if (row.expires_at - now < SESSION_TTL - DAY) {
        await c.env.DB.prepare('UPDATE sessions SET expires_at = ?1 WHERE token_hash = ?2').bind(now + SESSION_TTL, tokenHash).run();
        setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(c), maxAge: SESSION_TTL / 1000 });
      }
    } else {
      if (row) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
      clearSessionCookie(c);
    }
  }
  await next();
};

/**
 * Requires a signed-in user. An account from before D80 (no email yet) may only add its email and
 * password (or sign out) until it has them.
 */
export function requireUser(opts: { allowNeedsLogin?: boolean } = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.var.user) fail(401, 'signed_out', 'Please sign in.');
    if (c.var.user.needsLogin && !opts.allowNeedsLogin) {
      fail(403, 'needs_login', 'Add an email and password to carry on.');
    }
    await next();
  };
}
