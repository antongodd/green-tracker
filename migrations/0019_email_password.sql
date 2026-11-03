-- D80: accounts sign in with an email and a password; passkeys stay (optional, "Sign in with Face ID");
-- recovery codes are gone.
--
-- Existing accounts have no email or password yet: the app asks for both, once, the next time they open it
-- (users.email IS NULL is that state). Their products, Log, photos, followers and passkeys are untouched.

ALTER TABLE users ADD COLUMN email TEXT;              -- as typed (trimmed); private, never shown to anyone else
ALTER TABLE users ADD COLUMN email_lower TEXT;        -- what emails are unique on
ALTER TABLE users ADD COLUMN password_hash TEXT;      -- PBKDF2-SHA256, salted (server/lib/password.ts); never the password
CREATE UNIQUE INDEX users_email ON users(email_lower);

-- Every recovery code stops working, and the table goes.
DROP TABLE recovery_codes;

-- A session opened with a recovery code (still waiting for a new passkey) now just asks for an email and
-- password like every account without one. The column stays, unused.
UPDATE sessions SET needs_passkey = 0;
