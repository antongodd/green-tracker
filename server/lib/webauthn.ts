import type { Context } from 'hono';
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON, type AuthenticatorTransport } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { randomId } from './crypto';
import { fail, str } from './http';

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

/**
 * A fresh passkey check, limited to this account's passkeys (deleting the account; D83: a new password
 * without the old one). Step 1: the options for the device.
 */
export async function ownPasskeyOptions(c: Context<AppEnv>, userId: string) {
  const { results } = await c.env.DB.prepare('SELECT id, transports FROM passkeys WHERE user_id = ?1').bind(userId).all<{ id: string; transports: string | null }>();
  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID,
    userVerification: 'required',
    allowCredentials: results.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
  });
  const challengeId = await saveChallenge(c, 'authenticate', options.challenge, { userId });
  return { challengeId, options };
}

/** Step 2: checks the device's answer (`challengeId`, `response` in `body`) was made just now by one of this account's passkeys. */
export async function checkOwnPasskey(c: Context<AppEnv>, body: Record<string, unknown>, userId: string): Promise<void> {
  const challenge = await takeChallenge(c, str(body, 'challengeId'), 'authenticate');
  if (challenge.user_id !== userId) fail(400, 'challenge_expired', 'That took too long. Please try again.');
  const response = body.response as AuthenticationResponseJSON;
  const passkey = await c.env.DB
    .prepare('SELECT id, public_key, counter, transports FROM passkeys WHERE id = ?1 AND user_id = ?2')
    .bind(typeof response?.id === 'string' ? response.id : '', userId)
    .first<{ id: string; public_key: ArrayBuffer | number[]; counter: number; transports: string | null }>();
  if (!passkey) fail(400, 'passkey_failed', 'Use a passkey for this account to confirm.');
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: c.env.ORIGIN,
    expectedRPID: c.env.RP_ID,
    credential: { id: passkey.id, publicKey: new Uint8Array(passkey.public_key), counter: passkey.counter, transports: parseTransports(passkey.transports) },
  }).catch(() => ({ verified: false as const, authenticationInfo: null }));
  if (!verification.verified || !verification.authenticationInfo) fail(400, 'passkey_failed', 'The passkey couldn’t be checked. Please try again.');
  await c.env.DB.prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3')
    .bind(verification.authenticationInfo.newCounter, Date.now(), passkey.id)
    .run();
}
