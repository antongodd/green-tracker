---
name: undo-live
description: Something on Green Tracker's live site is broken after a release. Puts the previous version back first (a revert straight through to live), then fixes it properly. Use as soon as Anton reports live is broken, or a deploy to main fails its live check.
---

# Live is broken: put it back, then fix it

Anton's data and his friends come first: **undo before investigating at length.** A few minutes to confirm which
release caused it is fine; a long debugging session is not.

## 1. Find the release

1. Ask Anton for a screenshot and exact steps if he hasn't given them (he can reach live; you can't).
2. `git log --first-parent --oneline origin/main` shows the releases. The newest one is almost always the cause;
   check its list of changes against what broke.
3. **A migration in that release?** A revert does not undo a migration that has run. Stop and tell Anton plainly
   what's broken and what you propose, before doing anything to the database (CLAUDE.md: the database changes only by
   new migration files).

## 2. Put it back

1. Branch from the latest `origin/dev`; revert the change's squash commit on `dev` (`git revert <sha>`). Version:
   bump a patch (the revert is a new version). Changelog: `<version> — <what> taken back off live (a fault)`.
2. Pull request into `dev`; merge once **test** is green.
3. Straight on with **go-live** (a release with only the revert, and anything else already agreed). Check
   **"Live site serves this build"**.
4. Tell Anton it's back as it was, and how to check (close and reopen the app).

## 3. Fix it properly

Now find the real cause, with a test that fails on the broken code. The fix goes in as its original kind: a small
change straight to live, or a big one back to GT Dev for him to try again. Add a testing note to CLAUDE.md if the
lesson is worth keeping.
