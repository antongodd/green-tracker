-- Photos, reworked before any photo existed (the table has always been empty).
--
-- Each image version is an immutable "set" of R2 objects under
--   u/<user>/s/<set>/{original,cropped,thumb}.jpg
-- A new photo's first set holds all three. A re-crop uploads a new set with only
-- cropped + thumb; the original stays in `original_set`. Saving just points the
-- photo at the new set, so the editor can upload straight away yet commit only on
-- Save (brief §11), and the ETag is simply the current set id.

DROP TABLE photos;

CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
  log_entry_id TEXT REFERENCES log_entries(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  original_set TEXT NOT NULL,                -- holds original.jpg (never re-uploaded)
  image_set    TEXT NOT NULL,                -- holds the current cropped.jpg + thumb.jpg
  -- Crop as fractions (0–1) of the original; NULL = uncropped. Crops are always
  -- taken from the original, never from a previous crop.
  crop_x       REAL,
  crop_y       REAL,
  crop_w       REAL,
  crop_h       REAL,
  crop_square  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  CHECK ((product_id IS NULL) <> (log_entry_id IS NULL))
);
CREATE INDEX photos_product ON photos(product_id, position);
CREATE UNIQUE INDEX photos_log_entry ON photos(log_entry_id);  -- one photo per log entry
CREATE INDEX photos_user ON photos(user_id);

-- Sets uploaded but not yet attached by a Save. Cancel deletes them; any left
-- after a day are swept (R2 objects and row).
CREATE TABLE uploads (
  id           TEXT PRIMARY KEY,             -- the set id
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  has_original INTEGER NOT NULL,             -- 1: a new photo; 0: a re-crop (cropped + thumb only)
  created_at   INTEGER NOT NULL
);
CREATE INDEX uploads_user ON uploads(user_id, created_at);
