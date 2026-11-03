-- D83: devices an account has signed in on. A correct password from one of them gets through even while
-- strangers' wrong tries have that email waiting. The device keeps a random token in a long-lived cookie
-- (gt_device); only its SHA-256 is stored, as with sessions. Signing out keeps it; deleting the account
-- removes it (cascade). Nothing in Export or Restore: it describes a phone, not your data.
CREATE TABLE known_devices (
  token_hash TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (token_hash, user_id)
);
CREATE INDEX known_devices_user ON known_devices(user_id);
