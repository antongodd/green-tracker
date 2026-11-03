import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { randomToken, sha256Hex } from './crypto';

// D83: a device an account has signed in on before. It only lets that account's correct password through
// while the email is waiting after strangers' wrong tries; it never signs anyone in by itself.

export const DEVICE_COOKIE = 'gt_device';
/** As long as browsers keep a cookie (400 days); renewed at each sign-in. */
const DEVICE_TTL_S = 400 * 24 * 60 * 60;

/** Marks this device as one `userId` has signed in on (a cookie, and its hash stored). */
export async function rememberDevice(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = getCookie(c, DEVICE_COOKIE) || randomToken();
  await c.env.DB.prepare('INSERT INTO known_devices (token_hash, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING')
    .bind(await sha256Hex(token), userId, Date.now())
    .run();
  setCookie(c, DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: c.env.ORIGIN.startsWith('https://'),
    sameSite: 'Lax',
    path: '/',
    maxAge: DEVICE_TTL_S,
  });
}

/** This device's hash if `userId` has signed in on it before, or null. */
export async function knownDevice(c: Context<AppEnv>, userId: string): Promise<string | null> {
  const token = getCookie(c, DEVICE_COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await c.env.DB.prepare('SELECT 1 AS ok FROM known_devices WHERE token_hash = ?1 AND user_id = ?2').bind(hash, userId).first();
  return row ? hash : null;
}

/** True if the request carries no device cookie yet (a device signed in before D83). */
export const noDeviceCookie = (c: Context<AppEnv>) => !getCookie(c, DEVICE_COOKIE);
