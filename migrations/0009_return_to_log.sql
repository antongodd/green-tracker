-- Return to Log (D50, 0.43.0): a Leaderboard product can go back to being a Log entry.
--
-- The entry is an ordinary log_entries row (name, type, country, amount, its first photo),
-- and kept_product_id points at the product it came from, which stays as it was (ratings,
-- purchases, notes, the other photos) but is hidden everywhere: off the Leaderboard, the
-- Archive, followers and photo files. Add to leaderboard brings it back; deleting the entry
-- deletes it. At most one entry keeps a given product.
--
-- One new column, empty for every existing entry: the previous build keeps working while
-- this is applied.

ALTER TABLE log_entries ADD COLUMN kept_product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX log_entries_kept ON log_entries(kept_product_id) WHERE kept_product_id IS NOT NULL;
