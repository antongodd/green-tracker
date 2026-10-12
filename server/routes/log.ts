import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { returnedAmount, validateLogEntryInput, type LogEntry, type LogEntryInput } from '../../shared/domain/logEntry';
import type { Product } from '../../shared/domain/product';
import type { ProductTypeKey } from '../../shared/domain/productTypes';
import { randomId } from '../lib/crypto';
import { fail, jsonBody } from '../lib/http';
import { deleteLater, imageKeys, PHOTO_COLUMNS, planPhotoWrites, setKeys, toPhotoRecord, type PhotoRow } from '../lib/photos';
import { requireUser } from '../lib/session';
import { createProductWrites, load, loadOne, parseProduct, updateProductWrites } from './products';

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
  kept_product_id: string | null;
}

const ENTRY_COLUMNS = 'id, name, product_type, product_type_other, concentrate_type, concentrate_type_other, country, country_other, amount, created_at, updated_at, kept_product_id';

const toEntry = (r: EntryRow, photo: PhotoRow | undefined, kept: Product | undefined): LogEntry => ({
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
  kept: kept ?? null,
});

async function loadEntries(db: D1Database, userId: string, id?: string): Promise<LogEntry[]> {
  const cond = id ? 'AND id = ?2' : '';
  const bind = (sql: string) => (id ? db.prepare(sql).bind(userId, id) : db.prepare(sql).bind(userId));
  const [rows, photos] = await db.batch<unknown>([
    bind(`SELECT ${ENTRY_COLUMNS} FROM log_entries WHERE user_id = ?1 ${cond} ORDER BY created_at`),
    bind(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE user_id = ?1 AND log_entry_id IS NOT NULL ${id ? 'AND log_entry_id = ?2' : ''}`),
  ]);
  const byEntry = new Map((photos!.results as PhotoRow[]).map((p) => [p.log_entry_id!, p]));
  const entries = rows!.results as EntryRow[];
  // D50: the products returned entries keep, whole.
  const keptIds = entries.map((r) => r.kept_product_id).filter((k): k is string => !!k);
  const kept = keptIds.length ? await load(db, userId, keptIds.length === 1 ? { id: keptIds[0], kept: true } : { kept: true }) : [];
  const byId = new Map(kept.map((p) => [p.id, p]));
  return entries.map((r) => toEntry(r, byEntry.get(r.id), r.kept_product_id ? byId.get(r.kept_product_id) : undefined));
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

/**
 * Loose entries are hard-deleted (behind a confirmation in the app), photo files and smokes (D43)
 * included, and (D50) the product a returned entry keeps, with its ratings, purchases and photos.
 */
log.delete('/:id', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const db = c.env.DB;
  const entry = await loadEntry(db, userId, id);
  const { results: photos } = await db
    .prepare(`SELECT ${PHOTO_COLUMNS} FROM photos WHERE user_id = ?1 AND (log_entry_id = ?2 OR product_id = ?3)`)
    .bind(userId, id, entry.kept?.id ?? null)
    .all<PhotoRow>();
  await db.batch([
    // The kept product first (its ratings, purchases and photo rows cascade), then the entry (its photo row and smokes cascade).
    ...(entry.kept ? [db.prepare('DELETE FROM products WHERE id = ?1 AND user_id = ?2').bind(entry.kept.id, userId)] : []),
    db.prepare('DELETE FROM log_entries WHERE id = ?1 AND user_id = ?2').bind(id, userId),
  ]);
  deleteLater(c.executionCtx, c.env.PHOTOS, photos.flatMap((p) => [...setKeys(userId, p.original_set), ...(p.image_set !== p.original_set ? imageKeys(userId, p.image_set) : [])]));
  return c.json({ ok: true });
});

/**
 * Promotion (brief §10.2): on Save, atomically — one D1 batch, all or nothing —
 * create the product, re-assign the photo to it (moved, not copied; its original
 * travels too), move its smokes to it (D43), and delete the loose entry. Nothing is written before this call.
 * D50: an entry that keeps a product saves over that product instead, so it comes back as it was.
 */
log.post('/:id/promote', async (c) => {
  const userId = c.var.user!.id;
  const entryId = c.req.param('id');
  const input = parseProduct(await jsonBody(c));
  const db = c.env.DB;
  const entry = await loadEntry(db, userId, entryId);
  const saved = entry.kept
    ? { id: entry.kept.id, ...(await updateProductWrites(db, userId, entry.kept.id, input, { adoptFromLogEntry: entryId })) }
    : await createProductWrites(db, userId, input, { adoptFromLogEntry: entryId });
  await db.batch([
    ...saved.statements,
    // Its smokes (D43) move to the product, before the entry goes (they'd cascade with it).
    db.prepare('UPDATE smokes SET product_id = ?1, log_entry_id = NULL, updated_at = ?4 WHERE log_entry_id = ?2 AND user_id = ?3').bind(saved.id, entryId, userId, Date.now()),
    db.prepare('DELETE FROM log_entries WHERE id = ?1 AND user_id = ?2').bind(entryId, userId),
  ]);
  deleteLater(c.executionCtx, c.env.PHOTOS, saved.unusedKeys);
  return c.json({ product: await loadOne(db, userId, saved.id) }, 201);
});

/**
 * Return to Log (D50): a Leaderboard product becomes a Log entry again, atomically. The entry
 * takes its name, type and country, the product's first photo (moved, not copied), its smokes
 * (D43), and as its amount all its purchases' amounts added up; its Logged date is when the
 * product was first added. Everything else stays on the product, which the entry keeps hidden
 * until Add to leaderboard (above) brings it back. Archived products are un-archived first.
 */
log.post('/return/:productId', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const product = await loadOne(db, userId, c.req.param('productId')); // yours, and not already returned
  if (product.archived) fail(409, 'archived', 'Un-archive it first.');
  const id = randomId();
  const now = Date.now();
  const first = product.photos[0];
  await db.batch([
    db
      .prepare(
        `INSERT INTO log_entries (id, user_id, name, product_type, product_type_other, concentrate_type, concentrate_type_other, country, country_other, amount, created_at, updated_at, kept_product_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        id,
        userId,
        product.name,
        product.productType,
        product.productTypeOther,
        product.concentrateType,
        product.concentrateTypeOther,
        product.country,
        product.countryOther,
        returnedAmount(product.purchases),
        product.createdAt,
        now,
        product.id,
      ),
    ...(first ? [db.prepare('UPDATE photos SET product_id = NULL, log_entry_id = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4').bind(id, now, first.id, userId)] : []),
    db.prepare('UPDATE smokes SET log_entry_id = ?1, product_id = NULL, updated_at = ?2 WHERE product_id = ?3 AND user_id = ?4').bind(id, now, product.id, userId),
  ]);
  return c.json({ entry: await loadEntry(db, userId, id) }, 201);
});
