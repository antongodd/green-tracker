import { DEFAULT_APPEARANCE, type Appearance, type Preset } from '../../shared/domain/gems';

// Appearance (D48): one row per account that changed anything; none = the defaults.

/** Your settings, or the defaults when you've never changed them. */
export async function loadAppearance(db: D1Database, userId: string): Promise<Appearance> {
  const r = await db.prepare('SELECT preset, mark_first FROM appearance_settings WHERE user_id = ?1').bind(userId).first<{ preset: Preset; mark_first: number }>();
  return r ? { preset: r.preset, markFirst: r.mark_first === 1 } : { ...DEFAULT_APPEARANCE };
}

/** The statement that stores `a` for `userId` (insert or replace), for a batch. */
export function saveAppearanceStatement(db: D1Database, userId: string, a: Appearance): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO appearance_settings (user_id, preset, mark_first, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (user_id) DO UPDATE SET preset = excluded.preset, mark_first = excluded.mark_first, updated_at = excluded.updated_at`,
    )
    .bind(userId, a.preset, a.markFirst ? 1 : 0, Date.now());
}
