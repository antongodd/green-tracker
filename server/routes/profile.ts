import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { parseCrop, PHOTO_VARIANTS, type PhotoVariant } from '../../shared/domain/photo';
import { fail, jsonBody, str } from '../lib/http';
import { deleteLater, imageKeys, serveImage, setKeys } from '../lib/photos';
import { requireUser } from '../lib/session';

// Your profile photo (D23): one square crop per account, optional. Stored like
// product photos — an immutable image set with the original kept for re-framing.
// Who else may see it is decided in lib/social.ts (canSeePhoto / photoVisibleSql);
// others get it from /api/people/u/:username/photo, never from here.

export const profile = new Hono<AppEnv>();
profile.use('*', requireUser());

interface Row {
  original_set: string;
  image_set: string;
}

/** Your own photo, any variant (the original is used to re-frame and to export). */
profile.get('/photo/:variant', async (c) => {
  const variant = c.req.param('variant') as PhotoVariant;
  if (!PHOTO_VARIANTS.includes(variant)) fail(404, 'not_found', 'Not found.');
  const userId = c.var.user!.id;
  const row = await c.env.DB.prepare('SELECT original_set, image_set FROM profile_photos WHERE user_id = ?1').bind(userId).first<Row>();
  if (!row) fail(404, 'not_found', 'You have no profile photo.');
  return serveImage(c.env.PHOTOS, c.req.header('if-none-match'), userId, variant === 'original' ? row.original_set : row.image_set, variant);
});

/**
 * Sets the photo from an upload:
 * - a set with an original → a new photo (the previous one's files are deleted);
 * - a set without one → a new framing of the current photo, which keeps its original.
 */
profile.put('/photo', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const body = await jsonBody(c);
  const upload = str(body, 'upload');
  const crop = parseCrop(body.crop);
  if (!crop) fail(400, 'invalid_photos', 'The photo’s framing could not be read.');
  // A cut-out set (D26) is never a profile photo: profile photos stay JPEG.
  const up = await db.prepare('SELECT has_original FROM uploads WHERE id = ?1 AND user_id = ?2 AND cutout = 0').bind(upload, userId).first<{ has_original: number }>();
  if (!up) fail(400, 'photo_upload_missing', 'The photo upload has expired. Please try again.');
  const old = await db.prepare('SELECT original_set, image_set FROM profile_photos WHERE user_id = ?1').bind(userId).first<Row>();
  if (up.has_original !== 1 && !old) fail(400, 'invalid_photos', 'Choose a photo first.');
  const originalSet = up.has_original === 1 ? upload : old!.original_set;
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO profile_photos (user_id, original_set, image_set, crop_x, crop_y, crop_w, crop_h, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT (user_id) DO UPDATE SET original_set = excluded.original_set, image_set = excluded.image_set, crop_x = excluded.crop_x,
           crop_y = excluded.crop_y, crop_w = excluded.crop_w, crop_h = excluded.crop_h, updated_at = excluded.updated_at`,
      )
      .bind(userId, originalSet, upload, crop.x, crop.y, crop.w, crop.h, now),
    db.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(upload, userId),
  ]);
  if (old) deleteLater(c.executionCtx, c.env.PHOTOS, unusedKeys(userId, old, up.has_original === 1));
  return c.json({ photo: { version: upload, crop } });
});

profile.delete('/photo', async (c) => {
  const userId = c.var.user!.id;
  const old = await c.env.DB.prepare('DELETE FROM profile_photos WHERE user_id = ?1 RETURNING original_set, image_set').bind(userId).first<Row>();
  if (old) deleteLater(c.executionCtx, c.env.PHOTOS, unusedKeys(userId, old, true));
  return c.json({ ok: true });
});

/** The files an old photo no longer needs: its crop, and its original too when the photo itself is replaced. */
export function unusedKeys(userId: string, old: Row, replacedOriginal: boolean): string[] {
  if (!replacedOriginal) return imageKeys(userId, old.image_set);
  return [...setKeys(userId, old.original_set), ...(old.image_set !== old.original_set ? imageKeys(userId, old.image_set) : [])];
}
