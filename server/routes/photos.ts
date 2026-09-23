import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { MAX_IMAGE_BYTES, MAX_THUMB_BYTES, parseCrop, PHOTO_VARIANTS, type PhotoVariant } from '../../shared/domain/photo';
import { fail, jsonBody, str } from '../lib/http';
import { deleteLater, imageKeys, isJpeg, newSetId, PHOTO_COLUMNS, photoKey, setKeys, toPhotoRecord, type PhotoRow } from '../lib/photos';
import { requireUser } from '../lib/session';

const DAY = 24 * 60 * 60 * 1000;

// Uploads: image sets waiting for a Save --------------------------------------

export const uploads = new Hono<AppEnv>();
uploads.use('*', requireUser());

/**
 * Stores a set: `cropped` and `thumb` always; `original` for a new photo (a re-crop
 * reuses the photo's original). The browser has already resized and cropped them.
 */
uploads.post('/', async (c) => {
  const userId = c.var.user!.id;
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    fail(400, 'bad_upload', 'The photo could not be read.');
  }
  const part = (name: string) => {
    const v = form.get(name);
    return v instanceof File ? v : null;
  };
  const original = part('original');
  const cropped = part('cropped');
  const thumb = part('thumb');
  if (!cropped || !thumb) fail(400, 'bad_upload', 'The photo could not be read.');
  for (const [file, max] of [
    [original, MAX_IMAGE_BYTES],
    [cropped, MAX_IMAGE_BYTES],
    [thumb, MAX_THUMB_BYTES],
  ] as const) {
    if (!file) continue;
    if (file.size === 0 || file.size > max) fail(400, 'bad_upload', 'That photo is too large.');
    if (!(await isJpeg(file))) fail(400, 'bad_upload', 'Photos must be JPEG images.');
  }

  const set = newSetId();
  const meta = { httpMetadata: { contentType: 'image/jpeg' } };
  await Promise.all([
    original && c.env.PHOTOS.put(photoKey(userId, set, 'original'), original.stream(), meta),
    c.env.PHOTOS.put(photoKey(userId, set, 'cropped'), cropped.stream(), meta),
    c.env.PHOTOS.put(photoKey(userId, set, 'thumb'), thumb.stream(), meta),
  ]);
  await c.env.DB.prepare('INSERT INTO uploads (id, user_id, has_original, created_at) VALUES (?1, ?2, ?3, ?4)').bind(set, userId, original ? 1 : 0, Date.now()).run();

  // Sweep this user's abandoned uploads (older than a day).
  const { results: stale } = await c.env.DB.prepare('DELETE FROM uploads WHERE user_id = ?1 AND created_at < ?2 RETURNING id').bind(userId, Date.now() - DAY).all<{ id: string }>();
  deleteLater(c.executionCtx, c.env.PHOTOS, stale.flatMap((s) => setKeys(userId, s.id)));

  return c.json({ upload: set }, 201);
});

/** Cancel: discards a set that was never saved. */
uploads.delete('/:id', async (c) => {
  const userId = c.var.user!.id;
  const res = await c.env.DB.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), userId).run();
  if (res.meta.changes === 1) deleteLater(c.executionCtx, c.env.PHOTOS, setKeys(userId, c.req.param('id')));
  return c.json({ ok: true });
});

// Photos -----------------------------------------------------------------------

export const photos = new Hono<AppEnv>();
photos.use('*', requireUser());

/**
 * Serves a photo file through an authorised request — never a public bucket URL.
 * Phase 5: the owner only (followers get cropped images of visible products in Phase 7).
 * `private, no-cache` + ETag: the device revalidates every time, so revoked access
 * can't keep showing a cached photo, while unchanged images cost only a 304.
 */
photos.get('/:id/:variant', async (c) => {
  const variant = c.req.param('variant') as PhotoVariant;
  if (!PHOTO_VARIANTS.includes(variant)) fail(404, 'not_found', 'Not found.');
  const userId = c.var.user!.id;
  const row = await c.env.DB.prepare('SELECT original_set, image_set FROM photos WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), userId).first<{ original_set: string; image_set: string }>();
  if (!row) fail(404, 'not_found', 'Not found.');
  const set = variant === 'original' ? row.original_set : row.image_set;
  const etag = `"${set}-${variant}"`;
  const headers = { 'cache-control': 'private, no-cache', etag, 'content-type': 'image/jpeg' };
  if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers });
  const obj = await c.env.PHOTOS.get(photoKey(userId, set, variant));
  if (!obj) fail(404, 'not_found', 'Not found.');
  return new Response(obj.body, { headers: { ...headers, 'content-length': String(obj.size) } });
});

/** A crop made on the profile is saved straight away (brief §11), with a re-crop set. */
photos.post('/:id/crop', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const body = await jsonBody(c);
  const upload = str(body, 'upload');
  const crop = parseCrop(body.crop);
  if (crop === undefined) fail(400, 'invalid_photos', 'A photo crop could not be read.');
  const db = c.env.DB;
  const row = await db.prepare(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?1 AND user_id = ?2`).bind(id, userId).first<PhotoRow>();
  if (!row) fail(404, 'not_found', 'That photo no longer exists.');
  const up = await db.prepare('SELECT has_original FROM uploads WHERE id = ?1 AND user_id = ?2').bind(upload, userId).first<{ has_original: number }>();
  if (!up) fail(400, 'photo_upload_missing', 'The crop upload has expired. Please try again.');
  if (up.has_original !== 0) fail(400, 'invalid_photos', 'A crop reuses the photo’s original.');
  const c0 = crop;
  await db.batch([
    db
      .prepare('UPDATE photos SET image_set = ?1, crop_x = ?2, crop_y = ?3, crop_w = ?4, crop_h = ?5, crop_square = ?6, updated_at = ?7 WHERE id = ?8 AND user_id = ?9')
      .bind(upload, c0?.x ?? null, c0?.y ?? null, c0?.w ?? null, c0?.h ?? null, c0?.square ? 1 : 0, Date.now(), id, userId),
    db.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(upload, userId),
  ]);
  deleteLater(c.executionCtx, c.env.PHOTOS, imageKeys(userId, row.image_set));
  return c.json({ photo: toPhotoRecord({ ...row, image_set: upload, crop_x: c0?.x ?? null, crop_y: c0?.y ?? null, crop_w: c0?.w ?? null, crop_h: c0?.h ?? null, crop_square: c0?.square ? 1 : 0 }) });
});
