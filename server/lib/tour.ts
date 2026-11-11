import { readTour, type Tour } from '../../shared/domain/tour';

// Getting started (D97): one row per account that has been offered it; none = an account from before D97 that
// never asked (Settings > Show me round again).

export async function loadTour(db: D1Database, userId: string): Promise<Tour | null> {
  const r = await db.prepare('SELECT state FROM tours WHERE user_id = ?1').bind(userId).first<{ state: string }>();
  return r ? readTour(r.state) : null;
}

/** The statement that stores `t` for `userId` (insert or replace), for a batch. */
export function saveTourStatement(db: D1Database, userId: string, t: Tour): D1PreparedStatement {
  return db
    .prepare('INSERT INTO tours (user_id, state, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at')
    .bind(userId, JSON.stringify(t), Date.now());
}
