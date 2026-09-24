import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validateLogEntryInput, type LogEntry, type LogEntryInput } from '../../shared/domain/logEntry';
import type { ProductTypeKey } from '../../shared/domain/productTypes';
import { randomId } from '../lib/crypto';
import { fail, jsonBody } from '../lib/http';
import { deleteLater, imageKeys, PHOTO_COLUMNS, planPhotoWrites, setKeys, toPhotoRecord, type PhotoRow } from '../lib/photos';
import { requireUser } from '../lib/session';
import { createProductWrites, loadOne, parseProduct } from './products';

// Loose Log entries: yours only (every query is scoped by user_id; another user's
// ID behaves like a missing one). The Log is never visible to followers.

export const log = new Hono<AppEnv>();
log.use('*', requireUser());

interface EntryRow {
  id: string;
  name: string;
  product_type: string;
  product_type_other: string | null;
  concentrate_type: string;
  concentrate_type_other: string | null;
  country: string | null;
  country_other: string | null;
  amount: number | null;
  created_at: number;
  updated_at: number;
}

const ENTRY_COLUMNS = 'id, name, product_type, product_type_other, concentrate_type, concentrate_type_other, country, country_other, amount, created_at, updated_at';

const toEntry = (r: EntryRow, photo: PhotoRow | undefined): LogEntry => ({
  id: r.id,
  name: r.name,
  productType: r.product_type as ProductTypeKey,
  productTypeOther: r.product_type_other,
  concentrateType: r.concentrate_type,
  concentrateTypeOther: r.concentrate_type_other,
  country: r.country,
  countryOther: r.country_other,
  amount: r.amount,
  photo: photo ? toPhotoRecord(photo) : null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function loadEntries(db: D1Database, userId: string, id?: string): Promise<LogEntry[]> {
  const cond = id ? 'AND id = ?2' : '';
  const bind = (sql: string) => (id ? db.prepare(sql).bind(userId, id) : db.prepare(sql).bind(userId));
  const [rows, photos] = await db.batch<unknown>([
    bind(`SELECT ${ENTRY_COLUMNS} FROM log_entries WHERE user_id = ?1 ${cond} ORDER BY created_at`),
    bind(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE user_id = ?1 AND log_entry_id IS NOT NULL ${id ? 'AND log_entry_id = ?2' : ''}`),
  ]);
  const byEntry = new Map((photos!.results as PhotoRow[]).map((p) => [p.log_entry_id!, p]));
  return (rows!.results as EntryRow[]).map((r) => toEntry(r, byEntry.get(r.id)));
}

async function loadEntry(db: D1Database, userId: string, id: string): Promise<LogEntry> {
  const [e] = await loadEntries(db, userId, id);
  if (!e) fail(404, 'not_found', 'That log entry doesn’t exist.');
  return e;
}

function parse(body: unknown): LogEntryInput {
  const r = validateLogEntryInput(body);
  if (!r.ok) fail(400, 'invalid_entry', r.message);
  return r.value;
}

const FIELDS = (i: LogEntryInput) => [i.name, i.productType, i.productTypeOther, i.concentrateType, i.concentrateTypeOther, i.country, i.countryOther, i.amount] as const;

log.get('/', async (c) => c.json({ entries: await loadEntries(c.env.DB, c.var.user!.id) }));

log.get('/:id', async (c) => c.json({ entry: await loadEntry(c.env.DB, c.var.user!.id, c.req.param('id')) }));

log.post('/', async (c) => {
  const userId = c.var.user!.id;
  const input = parse(await jsonBody(c));
  const db = c.env.DB;
  const id = randomId();
  const now = Date.now();
  const photos = await planPhotoWrites(db, userId, { logEntryId: id }, input.photos);
  await db.batch([
    db
      .prepare(
        `INSERT INTO log_entries (id, user_id, name, product_type, product_type_other, concentrate_type, concentrate_type_other, country, country_other, amount, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`,
      )
      .bind(id, userId, ...FIELDS(input), now),
    ...photos.statements,
  ]);
  deleteLater(c.executionCtx, c.env.PHOTOS, photos.unusedKeys);
  return c.json({ entry: await loadEntry(db, userId, id) }, 201);
});

log.put('/:id', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const input = parse(await jsonBody(c));
  const db = c.env.DB;
  await loadEntry(db, userId, id); // 404 unless it's yours
  const photos = await planPhotoWrites(db, userId, { logEntryId: id }, input.photos);
  await db.batch([
    db
      .prepare(
        `UPDATE log_entries SET name = ?3, product_type = ?4, product_type_other = ?5, concentrate_type = ?6, concentrate_type_other = ?7,
           country = ?8, country_other = ?9, amount = ?10, updated_at = ?11 WHERE id = ?1 AND user_id = ?2`,
      )
      .bind(id, userId, ...FIELDS(input), Date.now()),
    ...photos.statements,
  ]);
  deleteLater(c.executionCtx, c.env.PHOTOS, photos.unusedKeys);
  return c.json({ entry: await loadEntry(db, userId, id) });
});

/** Loose entries are hard-deleted (behind a confirmation in the app), photo files included. */
log.delete('/:id', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const db = c.env.DB;
  const entry = await loadEntry(db, userId, id);
  const photo = entry.photo
    ? await db.prepare(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?1 AND user_id = ?2`).bind(entry.photo.id, userId).first<PhotoRow>()
    : null;
  await db.prepare('DELETE FROM log_entries WHERE id = ?1 AND user_id = ?2').bind(id, userId).run(); // the photo row cascades
  if (photo) deleteLater(c.executionCtx, c.env.PHOTOS, [...setKeys(userId, photo.original_set), ...(photo.image_set !== photo.original_set ? imageKeys(userId, photo.image_set) : [])]);
  return c.json({ ok: true });
});

/**
 * Promotion (brief §10.2): on Save, atomically — one D1 batch, all or nothing —
 * create the product, re-assign the photo to it (moved, not copied; its original
 * travels too), and delete the loose entry. Nothing is written before this call.
 */
log.post('/:id/promote', async (c) => {
  const userId = c.var.user!.id;
  const entryId = c.req.param('id');
  const input = parseProduct(await jsonBody(c));
  const db = c.env.DB;
  await loadEntry(db, userId, entryId);
  const created = await createProductWrites(db, userId, input, { adoptFromLogEntry: entryId });
  await db.batch([...created.statements, db.prepare('DELETE FROM log_entries WHERE id = ?1 AND user_id = ?2').bind(entryId, userId)]);
  deleteLater(c.executionCtx, c.env.PHOTOS, created.unusedKeys);
  return c.json({ product: await loadOne(db, userId, created.id) }, 201);
});
