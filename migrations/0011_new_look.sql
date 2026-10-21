-- The new look (D64, 0.54.0): Appearance gains the whole app's look and the top of the
-- Leaderboard, and two colour presets made for it (Aurora, Neon). SQLite can't change a CHECK,
-- so the table is rebuilt with the wider lists. Everyone moves once to the new defaults
-- (the owner's choice): Aurora Glass, the glass hero, Aurora colours; Mark my #1 is kept.
-- Accounts with no row already get the new defaults from the code.
--
-- The looks still to be built (Neon Night, Holo Pearl, Deep Forest) are allowed here already,
-- so adding them later needs no database change; until then the app refuses them.

CREATE TABLE appearance_settings_new (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  look       TEXT NOT NULL DEFAULT 'aurora' CHECK (look IN ('aurora', 'neon', 'pearl', 'forest')),
  board_top  TEXT NOT NULL DEFAULT 'hero' CHECK (board_top IN ('hero', 'tiles', 'strip')),
  preset     TEXT NOT NULL DEFAULT 'aurora' CHECK (preset IN ('aurora', 'neon', 'gems', 'prism', 'metals')),
  mark_first INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
INSERT INTO appearance_settings_new (user_id, look, board_top, preset, mark_first, updated_at)
  SELECT user_id, 'aurora', 'hero', 'aurora', mark_first, updated_at FROM appearance_settings;
DROP TABLE appearance_settings;
ALTER TABLE appearance_settings_new RENAME TO appearance_settings;
