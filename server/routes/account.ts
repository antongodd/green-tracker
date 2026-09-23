import { Hono } from 'hono';
import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { utf8 } from '../lib/crypto';
import { fail, jsonBody, str } from '../lib/http';
import { newRecoveryCodes } from '../lib/recovery';
import { clearSessionCookie, requireUser } from '../lib/session';
import { RP_NAME, parseTransports, passkeyName, saveChallenge, takeChallenge } from '../lib/webauthn';

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

// Adding a passkey is the one thing a recovery-code session may do (D4).
account.post('/passkeys/options', requireUser({ allowNeedsPasskey: true }), async (c) => {
  const user = c.var.user!;
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

account.post('/passkeys/verify', requireUser({ allowNeedsPasskey: true }), async (c) => {
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
  if (!verification.verified) fail(400, 'passkey_failed', 'The passkey could not be checked. Please try again.');
  const { credential } = verification.registrationInfo;

  const now = Date.now();
  const db = c.env.DB;
  const inserted = await db
    .prepare('INSERT INTO passkeys (id, user_id, public_key, counter, transports, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (id) DO NOTHING')
    .bind(credential.id, user.id, credential.publicKey, credential.counter, JSON.stringify(credential.transports ?? []), passkeyName(c.req.header('user-agent')), now)
    .run();
  if (inserted.meta.changes !== 1) fail(409, 'passkey_exists', 'That passkey is already registered.');
  await db.prepare('UPDATE sessions SET needs_passkey = 0 WHERE token_hash = ?1').bind(c.var.session!.tokenHash).run();
  return c.json({ passkeys: await listPasskeys(db, user.id) });
});

account.get('/passkeys', requireUser(), async (c) => c.json({ passkeys: await listPasskeys(c.env.DB, c.var.user!.id) }));

account.delete('/passkeys/:id', requireUser(), async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  // Removing the last passkey would leave only recovery codes; refuse.
  const res = await c.env.DB.prepare(
    `DELETE FROM passkeys WHERE id = ?1 AND user_id = ?2
       AND (SELECT COUNT(*) FROM passkeys WHERE user_id = ?2) > 1`,
  )
    .bind(id, userId)
    .run();
  if (res.meta.changes !== 1) {
    const exists = await c.env.DB.prepare('SELECT 1 FROM passkeys WHERE id = ?1 AND user_id = ?2').bind(id, userId).first();
    if (!exists) fail(404, 'not_found', 'That passkey no longer exists.');
    fail(409, 'last_passkey', 'You can’t remove your only passkey. Add another one first.');
  }
  return c.json({ passkeys: await listPasskeys(c.env.DB, userId) });
});

account.get('/recovery-codes', requireUser(), async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?1 AND used_at IS NULL').bind(c.var.user!.id).first<{ n: number }>();
  return c.json({ remaining: row?.n ?? 0 });
});

/** Makes a new set; every old code stops working (D4). The codes are returned once and never again. */
account.post('/recovery-codes', requireUser(), async (c) => {
  const { statements, codes } = await newRecoveryCodes(c.env.DB, c.var.user!.id);
  await c.env.DB.batch(statements);
  return c.json({ recoveryCodes: codes });
});

account.post('/signout-everywhere', requireUser({ allowNeedsPasskey: true }), async (c) => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(c.var.user!.id).run();
  clearSessionCookie(c);
  return c.json({ ok: true });
});
