-- Appearance (D48, 0.41.0): how the app looks for you. For now, the Leaderboard colours
-- preset and whether your #1 wears the crown and halo.
--
-- One row per account that has changed anything; no row means the defaults (Gems, #1
-- marked). Only ever sent to you: a follower sees your board in their own preset. A new
-- table only: the previous build keeps working while this is applied.

CREATE TABLE appearance_settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preset     TEXT NOT NULL DEFAULT 'gems' CHECK (preset IN ('gems', 'prism', 'metals')),
  mark_first INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
