-- Trust basics for strangers (D84, 0.73.0). One new column on users, one new table and two triggers: the previous
-- build keeps working while this is applied.

-- When the account said "I'm 18 or over". Sign-up sends it; an account from before 0.73.0 has none yet and is asked
-- once, the next time the app opens (adult_at IS NULL is that state). Never in Export or Restore, never shown.
ALTER TABLE users ADD COLUMN adult_at INTEGER;

-- Reports of a post, a comment or a person. Only what the reporter can see can be reported (D77's rule, checked in
-- server/routes/reports.ts). What's reported is hidden for the reporter (hidden = 1) until they tap Show it; the
-- report stays. Anton reads them through the reports recipe. A report goes with the account that made it, with the
-- reported account, and with the post or comment, so deleting anything still deletes it all (the privacy page).
CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('post', 'comment', 'person')),
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,         -- who made what's reported
  post_id     TEXT REFERENCES posts(id) ON DELETE CASCADE,                 -- a post, or a comment's post
  comment_id  TEXT REFERENCES post_comments(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('supply', 'personal', 'face', 'under18', 'abuse', 'other')),
  hidden      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  CHECK ((kind = 'post' AND post_id IS NOT NULL AND comment_id IS NULL)
      OR (kind = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL)
      OR (kind = 'person' AND post_id IS NULL AND comment_id IS NULL))
);
-- One report per thing per reporter (reporting again just updates the reason).
CREATE UNIQUE INDEX reports_one ON reports(reporter_id, kind, COALESCE(comment_id, post_id, owner_id));
CREATE INDEX reports_time ON reports(created_at DESC);
CREATE INDEX reports_owner ON reports(owner_id);
CREATE INDEX reports_post ON reports(post_id);
CREATE INDEX reports_comment ON reports(comment_id);

-- At most 3,000 photos an account: product and Log photos (photos) and post photos (post_photos) together
-- (PHOTO_LIMIT in shared/domain/trust.ts; test/domain/migrations.test.ts keeps the two in step). Checked here, on
-- every way a photo is saved (an editor, a post, Restore), so nothing can go round it. Restore deletes first, so it
-- counts only what it puts back. The server turns the message into a polite answer (server/index.ts).
CREATE TRIGGER photos_limit BEFORE INSERT ON photos
WHEN (SELECT COUNT(*) FROM photos WHERE user_id = NEW.user_id) + (SELECT COUNT(*) FROM post_photos WHERE user_id = NEW.user_id) >= 3000
BEGIN
  SELECT RAISE(ABORT, 'GT_PHOTO_LIMIT');
END;
CREATE TRIGGER post_photos_limit BEFORE INSERT ON post_photos
WHEN (SELECT COUNT(*) FROM photos WHERE user_id = NEW.user_id) + (SELECT COUNT(*) FROM post_photos WHERE user_id = NEW.user_id) >= 3000
BEGIN
  SELECT RAISE(ABORT, 'GT_PHOTO_LIMIT');
END;
