import { DEFAULT_CURRENCY } from '../../shared/domain/currency';

// Your main currency (D66): one row per account that changed it; none = £.

export async function loadMainCurrency(db: D1Database, userId: string): Promise<string> {
  const r = await db.prepare('SELECT currency FROM money_settings WHERE user_id = ?1').bind(userId).first<{ currency: string }>();
  return r?.currency ?? DEFAULT_CURRENCY;
}

/** The statement that stores `currency` as `userId`'s main currency, for a batch. */
export function saveMainCurrencyStatement(db: D1Database, userId: string, currency: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO money_settings (user_id, currency, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (user_id) DO UPDATE SET currency = excluded.currency, updated_at = excluded.updated_at`,
    )
    .bind(userId, currency, Date.now());
}
