-- Getting started (D97, 0.86.0): the welcome screen, the five steps and the first-visit hints for a new account.
-- One new table: the previous build keeps working while this is applied (it never reads it).

-- A row means the account has been offered Getting started: every account created from now on gets one at sign-up,
-- and anyone gets one (or a fresh one) with Settings > Show me round again. No row: an account from before D97,
-- which is never shown it unless it asks. state is JSON (shared/domain/tour.ts): the welcome seen, the steps done,
-- the hints seen, and whether the list is open, made smaller or hidden. Private: only the account itself ever reads
-- its row; never sent to followers, never in Export or Restore. Deleted with the account.
CREATE TABLE tours (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
