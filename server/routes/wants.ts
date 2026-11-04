import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { nameKey } from '../../shared/domain/names';
import { validateWantInput, WANT_LIMITS, type Want, type WantKind } from '../../shared/domain/wants';
import { randomId } from '../lib/crypto';
import { fail, jsonBody } from '../lib/http';
import { requireUser } from '../lib/session';

// Want to try (D92): your own lists of strains and sources to look out for. Private: every query is scoped by
// user_id, and nothing here is ever sent to anyone but the owner (no follower route reads the table).

export const wants = new Hono<AppEnv>();
wants.use('*', requireUser());

interface WantRow {
  id: string;
  kind: WantKind;
  name: string;
  note: string | null;
  created_at: number;
}

const toWant = (r: WantRow): Want => ({ id: r.id, kind: r.kind, name: r.name, note: r.note, createdAt: r.created_at });

/** The account's wants, newest first. */
export async function loadWants(db: D1Database, userId: string): Promise<Want[]> {
  const { results } = await db.prepare('SELECT id, kind, name, note, created_at FROM wants WHERE user_id = ?1 ORDER BY created_at DESC, name').bind(userId).all<WantRow>();
  return results.map(toWant);
}

wants.get('/', async (c) => c.json({ wants: await loadWants(c.env.DB, c.var.user!.id) }));

wants.post('/', async (c) => {
  const userId = c.var.user!.id;
  const v = validateWantInput(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_want', v.message);
  const db = c.env.DB;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM wants WHERE user_id = ?1').bind(userId).first<{ n: number }>();
  if ((count?.n ?? 0) >= WANT_LIMITS.perAccount) fail(409, 'too_many_wants', `Your lists can hold ${WANT_LIMITS.perAccount}. Remove one first.`);
  const want: Want = { id: randomId(), ...v.value, createdAt: Date.now() };
  const res = await db
    .prepare('INSERT INTO wants (id, user_id, kind, name, name_key, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (user_id, kind, name_key) DO NOTHING')
    .bind(want.id, userId, want.kind, want.name, nameKey(want.name), want.note, want.createdAt)
    .run();
  if (res.meta.changes !== 1) fail(409, 'already_wanted', `${want.name} is already on your list.`);
  return c.json({ want }, 201);
});

wants.delete('/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM wants WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), c.var.user!.id).run();
  if (res.meta.changes !== 1) fail(404, 'not_found', 'That’s not on your list.');
  return c.json({ ok: true });
});
