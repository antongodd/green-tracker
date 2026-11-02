-- Looks and colour sets without a database change each time (D76). Until now the table listed every look and
-- colour set in a CHECK, so each new one rebuilt it (0011, 0013, 0014, 0015). The app already refuses anything it
-- doesn't know, whether you choose it or restore it from a file (validateAppearance), and reading falls back to the
-- default for anything unknown (loadAppearance), so the lists go; the top keeps its CHECK. Every row is copied as it
-- is: nobody's look, top, colours or #1 mark changes. The previous build keeps working while this is applied.

CREATE TABLE appearance_settings_new (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  look       TEXT NOT NULL DEFAULT 'aurora',
  board_top  TEXT NOT NULL DEFAULT 'hero' CHECK (board_top IN ('hero', 'tiles', 'strip')),
  preset     TEXT NOT NULL DEFAULT 'aurora',
  mark_first INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
INSERT INTO appearance_settings_new (user_id, look, board_top, preset, mark_first, updated_at)
  SELECT user_id, look, board_top, preset, mark_first, updated_at FROM appearance_settings;
DROP TABLE appearance_settings;
ALTER TABLE appearance_settings_new RENAME TO appearance_settings;
