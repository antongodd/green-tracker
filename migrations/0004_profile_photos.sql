-- Profile photos (D23, 0.17.0): one per account, optional.
--
-- Stored like product photos (migration 0003): immutable R2 image sets under
--   u/<user>/s/<set>/{original,cropped,thumb}.jpg
-- `original_set` holds the resized original (kept so the photo can be re-framed
-- without losing quality); `image_set` holds the current square crop and its
-- thumbnail. Only the crop is ever served to other people, and only to people
-- connected to the owner (server/lib/social.ts canSeePhoto).
--
-- A new table only: the previous build keeps working while this is applied.

CREATE TABLE profile_photos (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  original_set TEXT NOT NULL,
  image_set    TEXT NOT NULL,
  -- The square crop as fractions (0–1) of the original.
  crop_x       REAL NOT NULL,
  crop_y       REAL NOT NULL,
  crop_w       REAL NOT NULL,
  crop_h       REAL NOT NULL,
  updated_at   INTEGER NOT NULL
);
