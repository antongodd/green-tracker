import { DEFAULT_APPEARANCE, type Appearance, type BoardTop, type Look, type Preset } from '../../shared/domain/gems';

// Appearance (D48): one row per account that changed anything; none = the defaults.

/** Your settings, or the defaults when you've never changed them. */
export async function loadAppearance(db: D1Database, userId: string): Promise<Appearance> {
  const r = await db
    .prepare('SELECT look, board_top, preset, mark_first FROM appearance_settings WHERE user_id = ?1')
    .bind(userId)
    .first<{ look: Look; board_top: BoardTop; preset: Preset; mark_first: number }>();
  return r ? { look: r.look, top: r.board_top, preset: r.preset, markFirst: r.mark_first === 1 } : { ...DEFAULT_APPEARANCE };
}

/** The statement that stores `a` for `userId` (insert or replace), for a batch. */
export function saveAppearanceStatement(db: D1Database, userId: string, a: Appearance): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO appearance_settings (user_id, look, board_top, preset, mark_first, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (user_id) DO UPDATE SET look = excluded.look, board_top = excluded.board_top, preset = excluded.preset,
         mark_first = excluded.mark_first, updated_at = excluded.updated_at`,
    )
    .bind(userId, a.look, a.top, a.preset, a.markFirst ? 1 : 0, Date.now());
}
