-- Currencies (D66, 0.56.0). Each purchase keeps the currency it was paid in and the rate that
-- turns it into the account's main currency, saved with the purchase so it never changes by
-- itself. Every purchase so far was in £: it becomes £ at rate 1, and every account starts on £.
-- New columns and tables only: the previous build keeps working while this is applied (its new
-- purchases get £ at rate 1, which is what it means).

ALTER TABLE purchases ADD COLUMN currency TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE purchases ADD COLUMN rate REAL NOT NULL DEFAULT 1 CHECK (rate > 0);

-- The main currency: one row per account that changed it; no row means £.
CREATE TABLE money_settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  currency   TEXT NOT NULL DEFAULT 'GBP',
  updated_at INTEGER NOT NULL
);

-- The European Central Bank's daily rates, as fetched (server/lib/fx.ts): how many of `currency`
-- one euro bought, for the day asked about (a weekend or holiday holds the working day before).
-- Shared by everyone and about no one: just public rates, fetched once per day and kept.
CREATE TABLE fx_rates (
  day        TEXT NOT NULL,  -- YYYY-MM-DD
  currency   TEXT NOT NULL,
  per_eur    REAL NOT NULL CHECK (per_eur > 0),
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (day, currency)
);
