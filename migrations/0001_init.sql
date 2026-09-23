-- Green Tracker initial schema.
-- Only what the user typed is stored. Overall, per-unit price, value for money
-- and every tile are derived on read and have no columns.
-- IDs are random text (generated in the Worker). Timestamps are ms since epoch.
-- Every user-owned table carries user_id so ownership is checked in one place
-- and account deletion cascades.

PRAGMA foreign_keys = ON;

-- Accounts ------------------------------------------------------------------

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL,             -- as typed, shown to others
  username_lower TEXT NOT NULL UNIQUE,      -- uniqueness is case-insensitive
  created_at     INTEGER NOT NULL
);

CREATE TABLE passkeys (
  id           TEXT PRIMARY KEY,            -- WebAuthn credential ID, base64url
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key   BLOB NOT NULL,
  counter      INTEGER NOT NULL DEFAULT 0,
  transports   TEXT,                        -- JSON array
  name         TEXT,                        -- e.g. "iPhone", for the passkey list
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkeys_user ON passkeys(user_id);

CREATE TABLE recovery_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,                 -- SHA-256; codes are high-entropy and single-use
  used_at    INTEGER
);
CREATE INDEX recovery_codes_user ON recovery_codes(user_id);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,            -- SHA-256 of the cookie token; the token itself is never stored
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,            -- sliding, renewed on use
  -- Set when signed in with a recovery code: the app asks for a new passkey first.
  needs_passkey INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE webauthn_challenges (
  id         TEXT PRIMARY KEY,
  challenge  TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  user_id    TEXT,                          -- set for adding a passkey to an existing account
  expires_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  bucket       TEXT NOT NULL,               -- e.g. "signin:<hashed ip>"
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);

-- Social --------------------------------------------------------------------

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX follows_followed ON follows(followed_id, status);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked ON blocks(blocked_id);

-- Products ------------------------------------------------------------------
-- Product type / concentrate type / country use the one "Other" pattern:
-- a key, plus free text used only when the key is 'other' / 'OTHER'.
-- concentrate_type is kept when switching away from Concentrate (never cleared).
-- There is deliberately no "amount" column: weight lives on each purchase.

CREATE TABLE products (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  strain_type            TEXT CHECK (strain_type IN ('indica', 'sativa', 'hybrid')),
  product_type           TEXT NOT NULL DEFAULT 'flower',
  product_type_other     TEXT,
  concentrate_type       TEXT NOT NULL DEFAULT 'hash',
  concentrate_type_other TEXT,
  country                TEXT,
  country_other          TEXT,
  source                 TEXT,
  date_tried             TEXT,             -- YYYY-MM-DD
  leafly_link            TEXT,             -- stored exactly as typed, never validated
  notes                  TEXT,
  hit_time_minutes       INTEGER CHECK (hit_time_minutes BETWEEN 0 AND 180 AND hit_time_minutes % 15 = 0),
  archived               INTEGER NOT NULL DEFAULT 0,
  private                INTEGER NOT NULL DEFAULT 0,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX products_user ON products(user_id, archived);

-- One row per rated category. Rows for categories outside the product's
-- current type are kept (hidden, excluded from Overall), never deleted.
CREATE TABLE ratings (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  value      REAL NOT NULL CHECK (value >= 1 AND value <= 10),
  PRIMARY KEY (product_id, category)
);

CREATE TABLE purchases (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,              -- entry order; tie-break for same-date purchases
  date       TEXT,                          -- YYYY-MM-DD
  amount     REAL CHECK (amount > 0),       -- grams, or mg of THC for edibles
  total_paid REAL NOT NULL CHECK (total_paid >= 0),
  supplier   TEXT                           -- never shown to followers
);
CREATE INDEX purchases_product ON purchases(product_id);

-- Log -----------------------------------------------------------------------

CREATE TABLE log_entries (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  product_type           TEXT NOT NULL DEFAULT 'flower',
  product_type_other     TEXT,
  concentrate_type       TEXT NOT NULL DEFAULT 'hash',
  concentrate_type_other TEXT,
  country                TEXT,
  country_other          TEXT,
  amount                 REAL CHECK (amount > 0),
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX log_entries_user ON log_entries(user_id);

-- Photos --------------------------------------------------------------------
-- R2 keys depend only on user and photo id (u/<user>/<photo>/{original,cropped,thumb}.jpg),
-- so re-assigning a photo during promotion is a single row update inside the
-- same D1 batch — no R2 operation needed.
-- Crop is stored as fractions of the original (0–1); NULL = uncropped.

CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
  log_entry_id TEXT REFERENCES log_entries(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  crop_x       REAL,
  crop_y       REAL,
  crop_w       REAL,
  crop_h       REAL,
  crop_square  INTEGER NOT NULL DEFAULT 0,
  version      INTEGER NOT NULL DEFAULT 1,  -- bumped on each crop; feeds the ETag
  created_at   INTEGER NOT NULL,
  CHECK ((product_id IS NULL) <> (log_entry_id IS NULL))
);
CREATE INDEX photos_product ON photos(product_id);
CREATE UNIQUE INDEX photos_log_entry ON photos(log_entry_id);  -- one photo per log entry
