import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { sha256Hex } from './crypto';
import { fail } from './http';

export interface Limit {
  /** Bucket prefix, e.g. "signup". */
  name: string;
  max: number;
  windowMs: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Discourages abuse of open sign-up (brief §4). Counted per client IP, which is stored hashed. */
export const LIMITS = {
  signup: { name: 'signup', max: 10, windowMs: HOUR },
  signin: { name: 'signin', max: 60, windowMs: 10 * MIN },
  /** D80, D83: wrong passwords for one email from devices it hasn't signed in on: 10 every 15 minutes. */
  signinEmail: { name: 'signin-email', max: 10, windowMs: 15 * MIN },
  /** D83: wrong passwords for one account from one device it has signed in on before: its own 10 every 15 minutes. */
  signinDevice: { name: 'signin-device', max: 10, windowMs: 15 * MIN },
  /** D80: checks of your own password (changing your email or password, deleting the account), per account. */
  passwordCheck: { name: 'password', max: 10, windowMs: 15 * MIN },
  usernameCheck: { name: 'username', max: 120, windowMs: 10 * MIN },
  /** D66: rate look-ups from the purchase form, per account. */
  fx: { name: 'fx', max: 300, windowMs: 10 * MIN },
} satisfies Record<string, Limit>;

export async function clientKey(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  return sha256Hex(`ip:${ip}`);
}

function windowOf(limit: Limit, now: number) {
  return now - (now % limit.windowMs);
}

function tooMany(limit: Limit, now: number): never {
  const retryAfter = Math.ceil((windowOf(limit, now) + limit.windowMs - now) / 1000);
  fail(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.', { 'retry-after': String(retryAfter) });
}

/** Adds one to `limit`'s count for `key` (fixed window) and returns the new count. */
async function count(c: Context<AppEnv>, limit: Limit, key: string, now: number): Promise<number> {
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(`${limit.name}:${key}`, windowOf(limit, now))
    .first<{ count: number }>();
  if (Math.random() < 0.02) {
    c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 2 * HOUR).run());
  }
  return row?.count ?? 0;
}

/**
 * Counts one attempt against `limit` for `key` and rejects with 429 once the window's count passes
 * `max`.
 */
export async function hit(c: Context<AppEnv>, limit: Limit, key: string): Promise<void> {
  const now = Date.now();
  if ((await count(c, limit, key, now)) > limit.max) tooMany(limit, now);
}

/**
 * D83: for limits that count only failures. `check` rejects with 429 once `max` failures are counted
 * in this window, without counting anything; `miss` counts one failure.
 */
export async function check(c: Context<AppEnv>, limit: Limit, key: string): Promise<void> {
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT count FROM rate_limits WHERE bucket = ?1 AND window_start = ?2')
    .bind(`${limit.name}:${key}`, windowOf(limit, now))
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= limit.max) tooMany(limit, now);
}

export async function miss(c: Context<AppEnv>, limit: Limit, key: string): Promise<void> {
  await count(c, limit, key, Date.now());
}
