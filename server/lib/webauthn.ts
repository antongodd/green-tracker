import type { Context } from 'hono';
import type { AuthenticatorTransport } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { randomId } from './crypto';
import { fail } from './http';

export const RP_NAME = 'Green Tracker';
const CHALLENGE_TTL = 5 * 60 * 1000;

type Purpose = 'register' | 'authenticate';

interface ChallengeRow {
  challenge: string;
  user_id: string | null;
  username: string | null;
}

/** Stores a challenge server-side (single use, 5 minutes) and returns its ID for the client to echo. */
export async function saveChallenge(
  c: Context<AppEnv>,
  purpose: Purpose,
  challenge: string,
  fields: { userId?: string; username?: string } = {},
): Promise<string> {
  const id = randomId();
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?1').bind(now),
    c.env.DB.prepare(
      'INSERT INTO webauthn_challenges (id, challenge, purpose, user_id, username, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    ).bind(id, challenge, purpose, fields.userId ?? null, fields.username ?? null, now + CHALLENGE_TTL),
  ]);
  return id;
}

/** Deletes and returns the challenge. Missing, expired or wrong-purpose challenges are a 400. */
export async function takeChallenge(c: Context<AppEnv>, id: string, purpose: Purpose): Promise<ChallengeRow> {
  const row = await c.env.DB.prepare(
    'DELETE FROM webauthn_challenges WHERE id = ?1 AND purpose = ?2 AND expires_at > ?3 RETURNING challenge, user_id, username',
  )
    .bind(id, purpose, Date.now())
    .first<ChallengeRow>();
  if (!row) fail(400, 'challenge_expired', 'That took too long. Please try again.');
  return row;
}

/** A friendly default name for the passkey list, from the browser's platform. Not personal content. */
export function passkeyName(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Passkey';
}

export function parseTransports(json: string | null): AuthenticatorTransport[] | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as AuthenticatorTransport[];
  } catch {
    return undefined;
  }
}
