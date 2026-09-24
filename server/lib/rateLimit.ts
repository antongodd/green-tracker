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
  recoverIp: { name: 'recover-ip', max: 10, windowMs: HOUR },
  recoverUser: { name: 'recover-user', max: 5, windowMs: HOUR },
  usernameCheck: { name: 'username', max: 120, windowMs: 10 * MIN },
} satisfies Record<string, Limit>;

export async function clientKey(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  return sha256Hex(`ip:${ip}`);
}

/**
 * Counts one attempt against `limit` for `key` (fixed window) and rejects with
 * 429 once the window's count passes `max`.
 */
export async function hit(c: Context<AppEnv>, limit: Limit, key: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - (now % limit.windowMs);
  const bucket = `${limit.name}:${key}`;
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(bucket, windowStart)
    .first<{ count: number }>();
  if (Math.random() < 0.02) {
    c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 2 * HOUR).run());
  }
  if ((row?.count ?? 0) > limit.max) {
    const retryAfter = Math.ceil((windowStart + limit.windowMs - now) / 1000);
    fail(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.', { 'retry-after': String(retryAfter) });
  }
}
