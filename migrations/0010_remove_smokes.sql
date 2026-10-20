-- Smokes removed (D60, 0.50.0): the owner no longer wants them. Every saved smoke goes, and
-- so do the three Smokes privacy switches (D45). Products, Log entries and everything else
-- are untouched. This can't be undone: an export made before 0.50.0 still holds the smokes,
-- but restoring it skips them.

DROP TABLE smokes;
ALTER TABLE privacy_settings DROP COLUMN share_smoke_counts;
ALTER TABLE privacy_settings DROP COLUMN share_most_used;
ALTER TABLE privacy_settings DROP COLUMN share_smokes;
