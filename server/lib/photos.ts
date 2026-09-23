import { fail } from './http';
import { randomId } from './crypto';
import type { Crop, PhotoInput, PhotoRecord, PhotoVariant } from '../../shared/domain/photo';

/** R2 key for one file of an image set. Keys depend only on user and set, never on the parent record. */
export const photoKey = (userId: string, set: string, variant: PhotoVariant) => `u/${userId}/s/${set}/${variant}.jpg`;

/** Every key a set can hold (a re-crop set has no original; deleting a missing key is harmless). */
export const setKeys = (userId: string, set: string) => (['original', 'cropped', 'thumb'] as const).map((v) => photoKey(userId, set, v));
/** The cropped + thumb keys of a set — what a re-crop replaces. */
export const imageKeys = (userId: string, set: string) => (['cropped', 'thumb'] as const).map((v) => photoKey(userId, set, v));

export interface PhotoRow {
  id: string;
  product_id: string | null;
  log_entry_id: string | null;
  position: number;
  original_set: string;
  image_set: string;
  crop_x: number | null;
  crop_y: number | null;
  crop_w: number | null;
  crop_h: number | null;
  crop_square: number;
}

export const PHOTO_COLUMNS = 'id, product_id, log_entry_id, position, original_set, image_set, crop_x, crop_y, crop_w, crop_h, crop_square';

export function toPhotoRecord(row: PhotoRow): PhotoRecord {
  const crop: Crop | null =
    row.crop_x === null ? null : { x: row.crop_x, y: row.crop_y!, w: row.crop_w!, h: row.crop_h!, square: row.crop_square === 1 };
  return { id: row.id, version: row.image_set, crop };
}

const cropArgs = (c: Crop | null) => (c ? [c.x, c.y, c.w, c.h, c.square ? 1 : 0] : [null, null, null, null, 0]);

/**
 * Plans the writes that make a record's photos match `inputs` (in order), inside the
 * caller's D1 batch. Returns the statements plus the R2 keys that become unused once
 * the batch has committed (delete them afterwards, never before).
 */
export async function planPhotoWrites(
  db: D1Database,
  userId: string,
  owner: { productId: string } | { logEntryId: string },
  inputs: PhotoInput[],
): Promise<{ statements: D1PreparedStatement[]; unusedKeys: string[] }> {
  const [col, ownerId] = 'productId' in owner ? (['product_id', owner.productId] as const) : (['log_entry_id', owner.logEntryId] as const);
  const { results: existing } = await db.prepare(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE user_id = ?1 AND ${col} = ?2`).bind(userId, ownerId).all<PhotoRow>();
  const byId = new Map(existing.map((r) => [r.id, r]));

  const uploadIds = inputs.map((i) => i.upload).filter((u): u is string => !!u);
  if (new Set(uploadIds).size !== uploadIds.length) fail(400, 'invalid_photos', 'A photo was listed twice.');
  const ids = inputs.map((i) => i.id).filter((u): u is string => !!u);
  if (new Set(ids).size !== ids.length) fail(400, 'invalid_photos', 'A photo was listed twice.');

  const uploads = new Map<string, { has_original: number }>();
  if (uploadIds.length) {
    const { results } = await db
      .prepare(`SELECT id, has_original FROM uploads WHERE user_id = ?1 AND id IN (${uploadIds.map((_, i) => `?${i + 2}`).join(', ')})`)
      .bind(userId, ...uploadIds)
      .all<{ id: string; has_original: number }>();
    for (const r of results) uploads.set(r.id, r);
  }
  const gone: () => never = () => fail(400, 'photo_upload_missing', 'A photo upload has expired. Please add the photo again.');

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  const unusedKeys: string[] = [];
  const kept = new Set<string>();

  inputs.forEach((input, position) => {
    if (input.id) {
      const row = byId.get(input.id);
      if (!row) fail(400, 'invalid_photos', 'That photo no longer exists. Please reopen the editor.');
      kept.add(row.id);
      if (input.upload) {
        if (!uploads.has(input.upload)) gone();
        // A new crop: point at the new set; the old cropped + thumb become unused.
        statements.push(
          db
            .prepare('UPDATE photos SET image_set = ?1, crop_x = ?2, crop_y = ?3, crop_w = ?4, crop_h = ?5, crop_square = ?6, position = ?7, updated_at = ?8 WHERE id = ?9 AND user_id = ?10')
            .bind(input.upload, ...cropArgs(input.crop), position, now, row.id, userId),
          db.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(input.upload, userId),
        );
        unusedKeys.push(...imageKeys(userId, row.image_set));
      } else if (row.position !== position) {
        statements.push(db.prepare('UPDATE photos SET position = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4').bind(position, now, row.id, userId));
      }
    } else {
      const up = uploads.get(input.upload!);
      if (!up) gone();
      if (up.has_original !== 1) fail(400, 'invalid_photos', 'A new photo needs its original image.');
      statements.push(
        db
          .prepare(
            `INSERT INTO photos (id, user_id, ${col}, position, original_set, image_set, crop_x, crop_y, crop_w, crop_h, crop_square, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`,
          )
          .bind(randomId(), userId, ownerId, position, input.upload!, ...cropArgs(input.crop), now),
        db.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(input.upload!, userId),
      );
    }
  });

  // Photos left out of the list are deleted, with every file they use.
  for (const row of existing) {
    if (kept.has(row.id)) continue;
    statements.push(db.prepare('DELETE FROM photos WHERE id = ?1 AND user_id = ?2').bind(row.id, userId));
    unusedKeys.push(...setKeys(userId, row.original_set));
    if (row.image_set !== row.original_set) unusedKeys.push(...imageKeys(userId, row.image_set));
  }
  return { statements, unusedKeys };
}

/** Deletes R2 objects after the response (never blocks it; a failure only leaves orphans). */
export function deleteLater(ctx: { waitUntil(p: Promise<unknown>): void }, bucket: R2Bucket, keys: string[]): void {
  if (!keys.length) return;
  ctx.waitUntil(
    (async () => {
      for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
    })().catch(() => {}),
  );
}

/** Is this a JPEG? (FF D8 FF) — the client always uploads JPEG. */
export async function isJpeg(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export const newSetId = randomId;
