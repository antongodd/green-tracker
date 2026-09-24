-- Sign-up challenges carry the chosen username until the passkey is verified,
-- so no user row exists for an abandoned sign-up. NULL for every other challenge.
ALTER TABLE webauthn_challenges ADD COLUMN username TEXT;
CREATE INDEX webauthn_challenges_expiry ON webauthn_challenges(expires_at);
CREATE INDEX rate_limits_window ON rate_limits(window_start);
CREATE INDEX sessions_expiry ON sessions(expires_at);
