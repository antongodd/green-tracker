-- Smokes (D43, 0.36.0): one row per time you had something.
--
-- Each smoke belongs to exactly one product or one loose Log entry. Deleting a Log
-- entry deletes its smokes (cascade); promotion moves them to the new product in the
-- same batch before the entry goes. date and time are the phone's own calendar day and
-- clock, as typed, so they never shift with time zones. Never visible to followers.
--
-- A new table only: the previous build keeps working while this is applied.

CREATE TABLE smokes (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
  log_entry_id TEXT REFERENCES log_entries(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,                 -- YYYY-MM-DD
  time         TEXT NOT NULL,                 -- HH:MM
  amount       REAL CHECK (amount > 0),       -- grams, or mg of THC for edibles
  effect       TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  CHECK ((product_id IS NULL) <> (log_entry_id IS NULL))
);
CREATE INDEX smokes_user ON smokes(user_id, date);
CREATE INDEX smokes_product ON smokes(product_id);
CREATE INDEX smokes_log_entry ON smokes(log_entry_id);
