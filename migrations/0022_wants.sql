-- Want to try (D92, 0.81.0): strains and sources you want to look out for. One new table: the previous build
-- keeps working while this is applied (it never reads it).

-- Private: only the account itself ever reads its rows (server/routes/wants.ts); never sent to followers.
-- name_key is the name matched like every other name (nameKey: capitals, accents, spaces and punctuation don't
-- count), so the same strain or source is on a list once. A row is deleted when you add a product with that name
-- (a strain) or from that source, when you remove it, and with the account. In Export and Restore since 0.81.0.
CREATE TABLE wants (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('strain', 'source')),
  name       TEXT NOT NULL,
  name_key   TEXT NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX wants_one ON wants(user_id, kind, name_key);
