-- Five more Leaderboard colour sets (D68, 0.58.0): Sunset, Deep Sea, Ember, Cosmos, Synthwave.
-- SQLite can't change a CHECK, so the table is rebuilt with the wider list (as 0011 did). Every
-- row is copied as it is: nobody's look, top, colours or #1 mark changes. The previous build
-- keeps working while this is applied (it only ever saves the five names it knows).

CREATE TABLE appearance_settings_new (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  look       TEXT NOT NULL DEFAULT 'aurora' CHECK (look IN ('aurora', 'neon', 'pearl', 'forest')),
  board_top  TEXT NOT NULL DEFAULT 'hero' CHECK (board_top IN ('hero', 'tiles', 'strip')),
  preset     TEXT NOT NULL DEFAULT 'aurora' CHECK (preset IN ('aurora', 'neon', 'gems', 'prism', 'metals', 'sunset', 'deepsea', 'ember', 'cosmos', 'synthwave')),
  mark_first INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
INSERT INTO appearance_settings_new (user_id, look, board_top, preset, mark_first, updated_at)
  SELECT user_id, look, board_top, preset, mark_first, updated_at FROM appearance_settings;
DROP TABLE appearance_settings;
ALTER TABLE appearance_settings_new RENAME TO appearance_settings;
