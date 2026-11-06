-- Friends on Strainz (D94, 0.83.0): one new privacy switch, "Your Want to try lists". Off (0) for every account,
-- including those already on the app, until they turn it on. Followers then see the names on your Want to try lists
-- (strains and sources), never the notes. The previous build keeps working while this is applied (it never reads it).
ALTER TABLE privacy_settings ADD COLUMN share_wants INTEGER NOT NULL DEFAULT 0;
