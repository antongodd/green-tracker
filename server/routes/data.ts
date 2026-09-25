import { Hono } from 'hono';
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { AppEnv } from '../env';
import { usernameKey } from '../../shared/domain/account';
import { validateRestore } from '../../shared/domain/backup';
import { randomId } from '../lib/crypto';
import { fail, jsonBody, str } from '../lib/http';
import { deleteLater, imageKeys, setKeys } from '../lib/photos';
import { clearSessionCookie, requireUser } from '../lib/session';
import { parseTransports, saveChallenge, takeChallenge } from '../lib/webauthn';

// Your data as a whole: restore from an export, and delete the account.
// (Export itself runs in the browser from the ordinary read APIs: building a JSON
// with embedded photos would exceed the free plan's CPU budget on the server.)

export const data = new Hono<AppEnv>();
data.use('*', requireUser());

/** Splits rows into JSON arrays small enough for one bound parameter each (D1 caps values at ~2MB). */
function chunks(rows: unknown[], maxBytes = 800_000): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let size = 2;
  for (const row of rows) {
    const s = JSON.stringify(row);
    if (current.length && size + s.length + 1 > maxBytes) {
      out.push(`[${current.join(',')}]`);
      current = [];
      size = 2;
    }
    current.push(s);
    size += s.length + 1;
  }
  if (current.length) out.push(`[${current.join(',')}]`);
  return out;
}

const j = (field: string) => `json_extract(value, '$.${field}')`;

/**
 * Restore: replaces all of your data with the export's, in one D1 batch — all or
 * nothing. Photos were uploaded first as pending sets (the browser can do that
 * work; the server can't). Rows are written set-based (json_each over chunks), so
 * the number of queries stays small however much data there is. Social data and
 * account security are untouched.
 */
data.post('/restore', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const v = validateRestore(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_restore', v.message);
  const { products, logEntries, profilePhoto } = v.value;

  // Every photo must be a fresh upload of yours that includes its original.
  const uploadIds = [...products.flatMap((p) => p.photos), ...logEntries.flatMap((e) => e.photos), ...(profilePhoto ? [profilePhoto] : [])].map((ph) => ph.upload!);
  if (uploadIds.length) {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM uploads WHERE user_id = ?1 AND has_original = 1 AND id IN (SELECT value FROM json_each(?2))')
      .bind(userId, JSON.stringify(uploadIds))
      .first<{ n: number }>();
    if (row?.n !== uploadIds.length) fail(400, 'photo_upload_missing', 'Some photos didn’t finish uploading. Please try the restore again.');
  }

  const now = Date.now();
  const productRows: object[] = [];
  const ratingRows: object[] = [];
  const purchaseRows: object[] = [];
  const photoRows: object[] = [];
  const entryRows: object[] = [];
  const crop = (c: { crop: { x: number; y: number; w: number; h: number; square: boolean } | null }) =>
    c.crop ? { cx: c.crop.x, cy: c.crop.y, cw: c.crop.w, ch: c.crop.h, cs: c.crop.square ? 1 : 0 } : { cx: null, cy: null, cw: null, ch: null, cs: 0 };

  for (const p of products) {
    const id = randomId();
    productRows.push({
      id,
      name: p.name,
      strain: p.strainType,
      type: p.productType,
      typeOther: p.productTypeOther,
      conc: p.concentrateType,
      concOther: p.concentrateTypeOther,
      country: p.country,
      countryOther: p.countryOther,
      source: p.source,
      tried: p.dateTried,
      leafly: p.leaflyLink,
      notes: p.notes,
      hit: p.hitTimeMinutes,
      archived: p.archived ? 1 : 0,
      private: p.private ? 1 : 0,
      created: p.createdAt,
    });
    for (const [category, value] of Object.entries(p.ratings)) ratingRows.push({ p: id, c: category, v: value });
    p.purchases.forEach((pu, i) => purchaseRows.push({ id: randomId(), p: id, seq: i + 1, date: pu.date, amount: pu.amount, paid: pu.totalPaid, supplier: pu.supplier }));
    p.photos.forEach((ph, i) => photoRows.push({ id: randomId(), p: id, e: null, pos: i, set: ph.upload, ...crop(ph) }));
  }
  for (const e of logEntries) {
    const id = randomId();
    entryRows.push({
      id,
      name: e.name,
      type: e.productType,
      typeOther: e.productTypeOther,
      conc: e.concentrateType,
      concOther: e.concentrateTypeOther,
      country: e.country,
      countryOther: e.countryOther,
      amount: e.amount,
      created: e.createdAt,
    });
    for (const ph of e.photos) photoRows.push({ id: randomId(), p: null, e: id, pos: 0, set: ph.upload, ...crop(ph) });
  }

  // Files of the photos being replaced, deleted once the batch has committed.
  const { results: old } = await db.prepare('SELECT original_set, image_set FROM photos WHERE user_id = ?1').bind(userId).all<{ original_set: string; image_set: string }>();
  // The profile photo is replaced only by a file that has one (or says there was none);
  // a file from before 0.17.0 leaves it alone (D23).
  if (profilePhoto !== undefined) {
    const oldProfile = await db.prepare('SELECT original_set, image_set FROM profile_photos WHERE user_id = ?1').bind(userId).first<{ original_set: string; image_set: string }>();
    if (oldProfile) old.push(oldProfile);
  }

  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM photos WHERE user_id = ?1').bind(userId),
    db.prepare('DELETE FROM products WHERE user_id = ?1').bind(userId), // ratings and purchases cascade
    db.prepare('DELETE FROM log_entries WHERE user_id = ?1').bind(userId),
  ];
  for (const chunk of chunks(productRows)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO products (id, user_id, name, strain_type, product_type, product_type_other, concentrate_type, concentrate_type_other,
             country, country_other, source, date_tried, leafly_link, notes, hit_time_minutes, archived, private, created_at, updated_at)
           SELECT ${j('id')}, ?1, ${j('name')}, ${j('strain')}, ${j('type')}, ${j('typeOther')}, ${j('conc')}, ${j('concOther')},
             ${j('country')}, ${j('countryOther')}, ${j('source')}, ${j('tried')}, ${j('leafly')}, ${j('notes')}, ${j('hit')}, ${j('archived')}, ${j('private')}, ${j('created')}, ?3
           FROM json_each(?2)`,
        )
        .bind(userId, chunk, now),
    );
  }
  for (const chunk of chunks(ratingRows)) {
    statements.push(db.prepare(`INSERT INTO ratings (product_id, user_id, category, value) SELECT ${j('p')}, ?1, ${j('c')}, ${j('v')} FROM json_each(?2)`).bind(userId, chunk));
  }
  for (const chunk of chunks(purchaseRows)) {
    statements.push(
      db
        .prepare(`INSERT INTO purchases (id, product_id, user_id, seq, date, amount, total_paid, supplier) SELECT ${j('id')}, ${j('p')}, ?1, ${j('seq')}, ${j('date')}, ${j('amount')}, ${j('paid')}, ${j('supplier')} FROM json_each(?2)`)
        .bind(userId, chunk),
    );
  }
  for (const chunk of chunks(entryRows)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO log_entries (id, user_id, name, product_type, product_type_other, concentrate_type, concentrate_type_other, country, country_other, amount, created_at, updated_at)
           SELECT ${j('id')}, ?1, ${j('name')}, ${j('type')}, ${j('typeOther')}, ${j('conc')}, ${j('concOther')}, ${j('country')}, ${j('countryOther')}, ${j('amount')}, ${j('created')}, ?3 FROM json_each(?2)`,
        )
        .bind(userId, chunk, now),
    );
  }
  for (const chunk of chunks(photoRows)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO photos (id, user_id, product_id, log_entry_id, position, original_set, image_set, crop_x, crop_y, crop_w, crop_h, crop_square, created_at, updated_at)
           SELECT ${j('id')}, ?1, ${j('p')}, ${j('e')}, ${j('pos')}, ${j('set')}, ${j('set')}, ${j('cx')}, ${j('cy')}, ${j('cw')}, ${j('ch')}, ${j('cs')}, ?3, ?3 FROM json_each(?2)`,
        )
        .bind(userId, chunk, now),
    );
  }
  if (profilePhoto !== undefined) statements.push(db.prepare('DELETE FROM profile_photos WHERE user_id = ?1').bind(userId));
  if (profilePhoto) {
    const pc = profilePhoto.crop;
    statements.push(
      db
        .prepare('INSERT INTO profile_photos (user_id, original_set, image_set, crop_x, crop_y, crop_w, crop_h, updated_at) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(userId, profilePhoto.upload, pc.x, pc.y, pc.w, pc.h, now),
    );
  }
  if (uploadIds.length) statements.push(db.prepare('DELETE FROM uploads WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))').bind(userId, JSON.stringify(uploadIds)));

  await db.batch(statements);
  deleteLater(c.executionCtx, c.env.PHOTOS, old.flatMap((o) => [...setKeys(userId, o.original_set), ...(o.image_set !== o.original_set ? imageKeys(userId, o.image_set) : [])]));
  return c.json({ products: productRows.length, logEntries: entryRows.length, photos: photoRows.length, profilePhoto: profilePhoto === undefined ? 'kept' : profilePhoto ? 'restored' : 'removed' });
});

// Delete account --------------------------------------------------------------

/** Step 1: a fresh passkey check, limited to this account's passkeys. */
data.post('/delete/options', async (c) => {
  const userId = c.var.user!.id;
  const { results } = await c.env.DB.prepare('SELECT id, transports FROM passkeys WHERE user_id = ?1').bind(userId).all<{ id: string; transports: string | null }>();
  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID,
    userVerification: 'required',
    allowCredentials: results.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
  });
  const challengeId = await saveChallenge(c, 'authenticate', options.challenge, { userId });
  return c.json({ challengeId, options });
});

/**
 * Step 2: with the passkey check and the typed username, delete everything:
 * the user row cascades to products, ratings, purchases, log entries, photos, the profile photo,
 * uploads, sessions, passkeys, recovery codes, follows both ways, pending requests
 * and blocks. Then every file under the user's R2 prefix is deleted. Irreversible.
 */
data.post('/delete', async (c) => {
  const user = c.var.user!;
  const db = c.env.DB;
  const body = await jsonBody(c);
  if (usernameKey(str(body, 'username').trim()) !== usernameKey(user.username)) fail(400, 'username_mismatch', 'Type your username exactly to confirm.');
  const challenge = await takeChallenge(c, str(body, 'challengeId'), 'authenticate');
  if (challenge.user_id !== user.id) fail(400, 'challenge_expired', 'That took too long. Please try again.');
  const response = body.response as AuthenticationResponseJSON;
  const passkey = await db
    .prepare('SELECT id, public_key, counter, transports FROM passkeys WHERE id = ?1 AND user_id = ?2')
    .bind(typeof response?.id === 'string' ? response.id : '', user.id)
    .first<{ id: string; public_key: ArrayBuffer | number[]; counter: number; transports: string | null }>();
  if (!passkey) fail(400, 'passkey_failed', 'Use a passkey for this account to confirm.');
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: c.env.ORIGIN,
    expectedRPID: c.env.RP_ID,
    credential: { id: passkey.id, publicKey: new Uint8Array(passkey.public_key), counter: passkey.counter, transports: parseTransports(passkey.transports) },
  }).catch(() => ({ verified: false as const }));
  if (!verification.verified) fail(400, 'passkey_failed', 'The passkey could not be checked. Please try again.');

  await db.prepare('DELETE FROM users WHERE id = ?1').bind(user.id).run();

  // Every file of the account, including pending uploads, by prefix.
  const prefix = `u/${user.id}/`;
  let cursor: string | undefined;
  do {
    const page = await c.env.PHOTOS.list({ prefix, cursor, limit: 1000 });
    if (page.objects.length) await c.env.PHOTOS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  clearSessionCookie(c);
  return c.json({ ok: true });
});
