import { BOARD_TOP_KEYS, DEFAULT_APPEARANCE, movedLook, movedPreset, type Appearance, type BoardTop } from '../../shared/domain/gems';

// Appearance (D48): one row per account that changed anything; none = the defaults.

/**
 * Your settings, or the defaults when you've never changed them. Since D76 the database no longer lists the looks and
 * colour sets, so a value this build doesn't know (one saved by a newer build, then put back) reads as the default:
 * only that one setting, the rest stay yours.
 */
export async function loadAppearance(db: D1Database, userId: string): Promise<Appearance> {
  const r = await db
    .prepare('SELECT look, board_top, preset, mark_first FROM appearance_settings WHERE user_id = ?1')
    .bind(userId)
    .first<{ look: string; board_top: string; preset: string; mark_first: number }>();
  if (!r) return { ...DEFAULT_APPEARANCE };
  const known = <T extends string>(list: readonly T[], v: string, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
  return {
    // D90: a look that went shows as its replacement (Holo Pearl and Haze: Aurora Glass; Mint and Pearl: Daylight).
    look: movedLook(r.look) ?? DEFAULT_APPEARANCE.look,
    top: known<BoardTop>(BOARD_TOP_KEYS, r.board_top, DEFAULT_APPEARANCE.top),
    // D91: a colour set that went shows as its replacement (Gems and Metals: Aurora).
    preset: movedPreset(r.preset) ?? DEFAULT_APPEARANCE.preset,
    markFirst: r.mark_first === 1,
  };
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
