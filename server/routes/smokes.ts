import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { addDays, validateSmokeInput, type Smoke, type SmokeInput } from '../../shared/domain/smoke';
import { randomId } from '../lib/crypto';
import { fail, jsonBody } from '../lib/http';
import { requireUser } from '../lib/session';

// Smokes (D43): yours only. Every query is scoped by user_id, so another user's ID
// behaves like a missing one, and a smoke can only point at your own product or Log
// entry. Followers have no route to any of this.

export const smokes = new Hono<AppEnv>();
smokes.use('*', requireUser());

interface SmokeRow {
  id: string;
  product_id: string | null;
  log_entry_id: string | null;
  date: string;
  time: string;
  amount: number | null;
  effect: string | null;
  created_at: number;
  updated_at: number;
}

const COLUMNS = 'id, product_id, log_entry_id, date, time, amount, effect, created_at, updated_at';

const toSmoke = (r: SmokeRow): Smoke => ({
  id: r.id,
  productId: r.product_id,
  logEntryId: r.log_entry_id,
  date: r.date,
  time: r.time,
  amount: r.amount,
  effect: r.effect,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function loadSmoke(db: D1Database, userId: string, id: string): Promise<Smoke> {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM smokes WHERE id = ?1 AND user_id = ?2`).bind(id, userId).first<SmokeRow>();
  if (!row) fail(404, 'not_found', 'That smoke doesn’t exist.');
  return toSmoke(row);
}

/** The server can't know your time zone, so it allows up to a day past its own today. */
const latestDate = () => addDays(new Date().toISOString().slice(0, 10), 1);

async function parse(db: D1Database, userId: string, body: unknown): Promise<SmokeInput> {
  const r = validateSmokeInput(body, latestDate());
  if (!r.ok) fail(400, 'invalid_smoke', r.message);
  const v = r.value;
  const owned = v.productId
    ? await db.prepare('SELECT 1 AS ok FROM products WHERE id = ?1 AND user_id = ?2').bind(v.productId, userId).first()
    : await db.prepare('SELECT 1 AS ok FROM log_entries WHERE id = ?1 AND user_id = ?2').bind(v.logEntryId, userId).first();
  if (!owned) fail(404, 'not_found', v.productId ? 'That product doesn’t exist.' : 'That log entry doesn’t exist.');
  return v;
}

smokes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${COLUMNS} FROM smokes WHERE user_id = ?1 ORDER BY date DESC, time DESC, created_at DESC`)
    .bind(c.var.user!.id)
    .all<SmokeRow>();
  return c.json({ smokes: results.map(toSmoke) });
});

smokes.post('/', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const v = await parse(db, userId, await jsonBody(c));
  const id = randomId();
  await db
    .prepare(`INSERT INTO smokes (${COLUMNS}, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9)`)
    .bind(id, v.productId, v.logEntryId, v.date, v.time, v.amount, v.effect, Date.now(), userId)
    .run();
  return c.json({ smoke: await loadSmoke(db, userId, id) }, 201);
});

smokes.put('/:id', async (c) => {
  const userId = c.var.user!.id;
  const id = c.req.param('id');
  const db = c.env.DB;
  await loadSmoke(db, userId, id); // 404 unless it's yours
  const v = await parse(db, userId, await jsonBody(c));
  await db
    .prepare('UPDATE smokes SET product_id = ?3, log_entry_id = ?4, date = ?5, time = ?6, amount = ?7, effect = ?8, updated_at = ?9 WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId, v.productId, v.logEntryId, v.date, v.time, v.amount, v.effect, Date.now())
    .run();
  return c.json({ smoke: await loadSmoke(db, userId, id) });
});

smokes.delete('/:id', async (c) => {
  const userId = c.var.user!.id;
  const res = await c.env.DB.prepare('DELETE FROM smokes WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), userId).run();
  if (res.meta.changes !== 1) fail(404, 'not_found', 'That smoke doesn’t exist.');
  return c.json({ ok: true });
});
