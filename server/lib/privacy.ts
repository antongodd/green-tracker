import { DEFAULT_PRIVACY, effectivePrivacy, type Privacy } from '../../shared/domain/privacy';

// Privacy settings (D45): one row per account that changed anything; none = the defaults.

interface PrivacyRow {
  share_board: number;
  share_source: number;
  share_country: number;
  share_photos: number;
  share_smoke_counts: number;
  share_most_used: number;
  share_smokes: number;
  share_profile_photo: number;
}

const COLUMNS = 'share_board, share_source, share_country, share_photos, share_smoke_counts, share_most_used, share_smokes, share_profile_photo';

/** Your settings as you set them (switches that need another one keep their own state). */
export async function loadPrivacy(db: D1Database, userId: string): Promise<Privacy> {
  const r = await db.prepare(`SELECT ${COLUMNS} FROM privacy_settings WHERE user_id = ?1`).bind(userId).first<PrivacyRow>();
  if (!r) return { ...DEFAULT_PRIVACY };
  return {
    shareBoard: r.share_board === 1,
    shareSource: r.share_source === 1,
    shareCountry: r.share_country === 1,
    sharePhotos: r.share_photos === 1,
    shareSmokeCounts: r.share_smoke_counts === 1,
    shareMostUsed: r.share_most_used === 1,
    shareSmokes: r.share_smokes === 1,
    shareProfilePhoto: r.share_profile_photo === 1,
  };
}

/** What applies to followers: a switch whose prerequisite is off counts as off. */
export const loadEffectivePrivacy = async (db: D1Database, userId: string): Promise<Privacy> => effectivePrivacy(await loadPrivacy(db, userId));

/** The statement that stores `p` for `userId` (insert or replace), for a batch. */
export function savePrivacyStatement(db: D1Database, userId: string, p: Privacy): D1PreparedStatement {
  const b = (v: boolean) => (v ? 1 : 0);
  return db
    .prepare(
      `INSERT INTO privacy_settings (user_id, ${COLUMNS}, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT (user_id) DO UPDATE SET share_board = excluded.share_board, share_source = excluded.share_source, share_country = excluded.share_country,
         share_photos = excluded.share_photos, share_smoke_counts = excluded.share_smoke_counts, share_most_used = excluded.share_most_used,
         share_smokes = excluded.share_smokes, share_profile_photo = excluded.share_profile_photo, updated_at = excluded.updated_at`,
    )
    .bind(userId, b(p.shareBoard), b(p.shareSource), b(p.shareCountry), b(p.sharePhotos), b(p.shareSmokeCounts), b(p.shareMostUsed), b(p.shareSmokes), b(p.shareProfilePhoto), Date.now());
}
