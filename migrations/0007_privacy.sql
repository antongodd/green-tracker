-- Privacy settings (D45, 0.38.0): what your approved followers see.
--
-- One row per account that has changed anything; no row means the defaults, which
-- are exactly what followers saw before (Leaderboard, Source, Country, photos and
-- profile photo shared; smoke counts, Most used and smokes not). The server applies
-- them when it builds a follower's copy (server/lib/social.ts). Never sent to anyone
-- else. A new table only: the previous build keeps working while this is applied.

CREATE TABLE privacy_settings (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_board         INTEGER NOT NULL DEFAULT 1,
  share_source        INTEGER NOT NULL DEFAULT 1,
  share_country       INTEGER NOT NULL DEFAULT 1,
  share_photos        INTEGER NOT NULL DEFAULT 1,
  share_smoke_counts  INTEGER NOT NULL DEFAULT 0,
  share_most_used     INTEGER NOT NULL DEFAULT 0,
  share_smokes        INTEGER NOT NULL DEFAULT 0,
  share_profile_photo INTEGER NOT NULL DEFAULT 1,
  updated_at          INTEGER NOT NULL
);
