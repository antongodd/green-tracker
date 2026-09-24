import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validateProductInput, type Product, type ProductInput, type PurchaseRecord } from '../../shared/domain/product';
import type { ProductTypeKey, RatingKey, StrainTypeKey } from '../../shared/domain/productTypes';
import type { Ratings } from '../../shared/domain/ratings';
import { randomId } from '../lib/crypto';
import { deleteLater, PHOTO_COLUMNS, planPhotoWrites, toPhotoRecord, type PhotoRow } from '../lib/photos';
import { fail, jsonBody } from '../lib/http';
import { requireUser } from '../lib/session';

// Your own products. Every query is scoped by user_id, so another user's ID
// behaves exactly like a missing one (404). Followers get their own, narrower
// routes in Phase 7 — nothing here is ever sent to anyone but the owner.

export const products = new Hono<AppEnv>();
products.use('*', requireUser());

interface ProductRow {
  id: string;
  name: string;
  strain_type: string | null;
  product_type: string;
  product_type_other: string | null;
  concentrate_type: string;
  concentrate_type_other: string | null;
  country: string | null;
  country_other: string | null;
  source: string | null;
  date_tried: string | null;
  leafly_link: string | null;
  notes: string | null;
  hit_time_minutes: number | null;
  archived: number;
  private: number;
  created_at: number;
  updated_at: number;
}

interface RatingRow {
  product_id: string;
  category: string;
  value: number;
}

interface PurchaseRow {
  id: string;
  product_id: string;
  seq: number;
  date: string | null;
  amount: number | null;
  total_paid: number;
  supplier: string | null;
}

function toProduct(row: ProductRow, ratings: RatingRow[], purchases: PurchaseRow[], photos: PhotoRow[]): Product {
  const r: Ratings = {};
  for (const x of ratings) r[x.category as RatingKey] = x.value;
  return {
    id: row.id,
    name: row.name,
    strainType: row.strain_type as StrainTypeKey | null,
    productType: row.product_type as ProductTypeKey,
    productTypeOther: row.product_type_other,
    concentrateType: row.concentrate_type,
    concentrateTypeOther: row.concentrate_type_other,
    country: row.country,
    countryOther: row.country_other,
    source: row.source,
    dateTried: row.date_tried,
    leaflyLink: row.leafly_link,
    notes: row.notes,
    hitTimeMinutes: row.hit_time_minutes,
    ratings: r,
    purchases: purchases.map(
      (p): PurchaseRecord => ({ id: p.id, seq: p.seq, date: p.date, amount: p.amount, totalPaid: p.total_paid, supplier: p.supplier }),
    ),
    photos: photos.map(toPhotoRecord),
    archived: row.archived === 1,
    private: row.private === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PRODUCT_COLUMNS = `id, name, strain_type, product_type, product_type_other, concentrate_type, concentrate_type_other,
  country, country_other, source, date_tried, leafly_link, notes, hit_time_minutes, archived, private, created_at, updated_at`;

/** Loads the user's products (optionally one) with ratings and purchases, in three queries. */
export async function load(db: D1Database, userId: string, where: { id?: string; archived?: boolean }): Promise<Product[]> {
  const cond = where.id !== undefined ? 'AND id = ?2' : where.archived !== undefined ? 'AND archived = ?2' : '';
  const arg = where.id ?? (where.archived === undefined ? undefined : where.archived ? 1 : 0);
  const bind = (sql: string) => (arg === undefined ? db.prepare(sql).bind(userId) : db.prepare(sql).bind(userId, arg));
  const productCond = cond.replace('id =', 'p.id =').replace('archived =', 'p.archived =');
  const [rows, ratings, purchases, photoRows] = await db.batch<unknown>([
    bind(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE user_id = ?1 ${cond} ORDER BY created_at`),
    bind(`SELECT r.product_id, r.category, r.value FROM ratings r JOIN products p ON p.id = r.product_id WHERE r.user_id = ?1 ${productCond}`),
    bind(`SELECT pu.id, pu.product_id, pu.seq, pu.date, pu.amount, pu.total_paid, pu.supplier FROM purchases pu JOIN products p ON p.id = pu.product_id
          WHERE pu.user_id = ?1 ${productCond} ORDER BY pu.seq`),
    bind(`SELECT ${PHOTO_COLUMNS.split(', ').map((c) => `ph.${c}`).join(', ')} FROM photos ph JOIN products p ON p.id = ph.product_id
          WHERE ph.user_id = ?1 ${productCond} ORDER BY ph.position`),
  ]);
  const byProduct = <T extends { product_id: string | null }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.product_id!, [...(m.get(x.product_id!) ?? []), x]);
    return m;
  };
  const r = byProduct(ratings!.results as RatingRow[]);
  const pu = byProduct(purchases!.results as PurchaseRow[]);
  const ph = byProduct(photoRows!.results as PhotoRow[]);
  return (rows!.results as ProductRow[]).map((row) => toProduct(row, r.get(row.id) ?? [], pu.get(row.id) ?? [], ph.get(row.id) ?? []));
}

export async function loadOne(db: D1Database, userId: string, id: string): Promise<Product> {
  const [p] = await load(db, userId, { id });
  if (!p) fail(404, 'not_found', 'That product doesn’t exist.');
  return p;
}

export function parseProduct(body: unknown): ProductInput {
  const result = validateProductInput(body);
  if (!result.ok) fail(400, 'invalid_product', result.message);
  return result.value;
}

/** Statements that write the product's ratings and purchases for `input`. */
async function childWrites(db: D1Database, userId: string, productId: string, input: ProductInput): Promise<D1PreparedStatement[]> {
  // Set-based (json_each), so a product costs the same few queries however many
  // ratings or purchases it has.
  const out: D1PreparedStatement[] = [];
  // Ratings: set or clear only what the editor mentioned; everything else is kept.
  const entries = Object.entries(input.ratings);
  const cleared = entries.filter(([, v]) => v === null).map(([k]) => k);
  const set = entries.filter(([, v]) => v !== null).map(([c, v]) => ({ c, v }));
  if (cleared.length) {
    out.push(db.prepare('DELETE FROM ratings WHERE product_id = ?1 AND user_id = ?2 AND category IN (SELECT value FROM json_each(?3))').bind(productId, userId, JSON.stringify(cleared)));
  }
  if (set.length) {
    out.push(
      db
        .prepare(
          `INSERT INTO ratings (product_id, user_id, category, value)
           SELECT ?1, ?2, json_extract(value, '$.c'), json_extract(value, '$.v') FROM json_each(?3) WHERE true
           ON CONFLICT (product_id, category) DO UPDATE SET value = excluded.value`,
        )
        .bind(productId, userId, JSON.stringify(set)),
    );
  }
  // Purchases: the list is replaced. Existing ones keep their entry order (seq); new ones go after.
  const { results: existing } = await db.prepare('SELECT id, seq FROM purchases WHERE product_id = ?1 AND user_id = ?2').bind(productId, userId).all<{ id: string; seq: number }>();
  const seqById = new Map(existing.map((e) => [e.id, e.seq]));
  let next = existing.reduce((n, e) => Math.max(n, e.seq), 0);
  const rows = input.purchases.map((p) => {
    const known = p.id !== undefined && seqById.has(p.id);
    return { id: known ? p.id! : randomId(), seq: known ? seqById.get(p.id!)! : ++next, date: p.date, amount: p.amount, paid: p.totalPaid, supplier: p.supplier };
  });
  out.push(db.prepare('DELETE FROM purchases WHERE product_id = ?1 AND user_id = ?2').bind(productId, userId));
  if (rows.length) {
    out.push(
      db
        .prepare(
          `INSERT INTO purchases (id, product_id, user_id, seq, date, amount, total_paid, supplier)
           SELECT json_extract(value, '$.id'), ?1, ?2, json_extract(value, '$.seq'), json_extract(value, '$.date'), json_extract(value, '$.amount'),
                  json_extract(value, '$.paid'), json_extract(value, '$.supplier') FROM json_each(?3)`,
        )
        .bind(productId, userId, JSON.stringify(rows)),
    );
  }
  return out;
}

const FIELDS = (i: ProductInput) =>
  [i.name, i.strainType, i.productType, i.productTypeOther, i.concentrateType, i.concentrateTypeOther, i.country, i.countryOther, i.source, i.dateTried, i.leaflyLink, i.notes, i.hitTimeMinutes, i.private ? 1 : 0] as const;

products.get('/', async (c) => {
  const archived = c.req.query('archived');
  return c.json({ products: await load(c.env.DB, c.var.user!.id, { archived: archived === '1' }) });
});

products.get('/:id', async (c) => c.json({ product: await loadOne(c.env.DB, c.var.user!.id, c.req.param('id')) }));

/**
 * The writes that create a product from `input`, for the caller's D1 batch. Also
 * used by promotion, which adopts the log entry's photo (`adoptFromLogEntry`).
 */
export async function createProductWrites(db: D1Database, userId: string, input: ProductInput, opts: { adoptFromLogEntry?: string } = {}) {
  const id = randomId();
  const photoPlan = await planPhotoWrites(db, userId, { productId: id }, input.photos, opts);
  const statements = [
    db
      .prepare(
        `INSERT INTO products (id, user_id, name, strain_type, product_type, product_type_other, concentrate_type, concentrate_type_other,
           country, country_other, source, date_tried, leafly_link, notes, hit_time_minutes, private, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17)`,
      )
      .bind(id, userId, ...FIELDS(input), Date.now()),
    ...(await childWrites(db, userId, id, input)),
    ...photoPlan.statements,
  ];
  return { id, statements, unusedKeys: photoPlan.unusedKeys };
}

products.post('/', async (c) => {
  const userId = c.var.user!.id;
  const input = parseProduct(await jsonBody(c));
  const db = c.env.DB;
  const { id, statements, unusedKeys } = await createProductWrites(db, userId, input);
  await db.batch(statements);
  deleteLater(c.executionCtx, c.env.PHOTOS, unusedKeys);
  return c.json({ product: await loadOne(db, userId, id) }, 201);
});

products.put('/:id', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const input = parseProduct(await jsonBody(c));
  const db = c.env.DB;
  await loadOne(db, userId, id); // 404 unless it's yours
  const photoPlan = await planPhotoWrites(db, userId, { productId: id }, input.photos);
  await db.batch([
    db
      .prepare(
        `UPDATE products SET name = ?3, strain_type = ?4, product_type = ?5, product_type_other = ?6, concentrate_type = ?7, concentrate_type_other = ?8,
           country = ?9, country_other = ?10, source = ?11, date_tried = ?12, leafly_link = ?13, notes = ?14, hit_time_minutes = ?15, private = ?16, updated_at = ?17
         WHERE id = ?1 AND user_id = ?2`,
      )
      .bind(id, userId, ...FIELDS(input), Date.now()),
    ...(await childWrites(db, userId, id, input)),
    ...photoPlan.statements,
  ]);
  // Only after the batch has committed: files no longer used by any photo.
  deleteLater(c.executionCtx, c.env.PHOTOS, photoPlan.unusedKeys);
  return c.json({ product: await loadOne(db, userId, id) });
});

/** The profile's Private switch and the Archive / Un-archive actions save immediately. */
for (const flag of ['private', 'archived'] as const) {
  products.post(`/:id/${flag}`, async (c) => {
    const body = await jsonBody(c);
    if (typeof body.value !== 'boolean') fail(400, 'bad_request', 'The request could not be read.');
    const userId = c.var.user!.id;
    const id = c.req.param('id');
    const res = await c.env.DB.prepare(`UPDATE products SET ${flag} = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4`)
      .bind(body.value ? 1 : 0, Date.now(), id, userId)
      .run();
    if (res.meta.changes !== 1) fail(404, 'not_found', 'That product doesn’t exist.');
    return c.json({ product: await loadOne(c.env.DB, userId, id) });
  });
}
