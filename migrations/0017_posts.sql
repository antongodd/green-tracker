-- Posts, comments and fires (D77, 0.66.0). New tables only, and one new empty column on users: the
-- previous build keeps working while this is applied.
--
-- A post has its own copy of its photo (cropped + thumb under u/<user>/s/<image_set>/), so later crops,
-- deletes or a product going Private never change it. What it's about is one of your products, or one
-- of your Log entries, or nothing; about_* keep the name and type as posted, for when that thing has gone.
-- Who may see a post, its comments and its fires is worked out on every request (canView), never stored.

CREATE TABLE posts (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id         TEXT REFERENCES products(id) ON DELETE SET NULL,
  log_entry_id       TEXT REFERENCES log_entries(id) ON DELETE SET NULL,
  about_name         TEXT,
  about_type         TEXT,
  about_type_other   TEXT,
  about_strain       TEXT,
  caption            TEXT NOT NULL DEFAULT '',
  image_set          TEXT NOT NULL,
  cutout             INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL,
  edited_at          INTEGER,
  CHECK (product_id IS NULL OR log_entry_id IS NULL)
);
CREATE INDEX posts_user_time ON posts(user_id, created_at DESC, id DESC);
CREATE INDEX posts_time ON posts(created_at DESC, id DESC);
CREATE INDEX posts_product ON posts(product_id);
CREATE INDEX posts_log_entry ON posts(log_entry_id);

CREATE TABLE post_comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX post_comments_post ON post_comments(post_id, created_at);
CREATE INDEX post_comments_user ON post_comments(user_id);

CREATE TABLE post_fires (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_fires_user ON post_fires(user_id);

-- The Feed's "something new" dot: when you last opened the Feed.
ALTER TABLE users ADD COLUMN feed_seen_at INTEGER;
