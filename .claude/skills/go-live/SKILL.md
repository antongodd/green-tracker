---
name: go-live
description: Take what's on Green Tracker's dev site to the live site. Use when Anton says "go live", and at the end of every small change. A release pull request from dev to main, merged with a merge commit, the live site checked, then the item moved to Done.
---

# Going live

Rules are in CLAUDE.md ("Branches and merging"). Going live takes **everything** on `dev` to live, not just your
change.

## 1. What's going

1. Fetch `dev` and `main`. List what's on `dev` and not on `main`: `git log --oneline origin/main..origin/dev`.
2. For each item there, check Anton has agreed to it going live: a small change always has; a big change only once
   he's said "go live" (CLAUDE.md's to-do list shows it **on dev**, waiting). **If a big change is waiting for his
   "go live"**, don't release: tell him what's waiting and ask whether it can go too.
3. If a release pull request is already open (another conversation), don't open a second: wait for it, or add to it
   only if it's yours.

## 2. The release

1. Open a pull request from `dev` into `main`, titled `Release <version>: <what>`, listing in plain words everything
   going live.
2. Merge it with a **merge commit (not squash)** once its **test** check is green (every browser test, about 5
   minutes). If a test fails, read the log: a real break gets a fix into `dev` first; then the release pull request
   picks it up.
3. Check the push run on `main` finished green, **deploy** included, with **"Live site serves this build"**.
4. Look at the browser tests' log of the release run for tests marked **flaky**; note each one for your next change
   (CLAUDE.md, "Flaky test").

## 3. The notes

A notes-only pull request into `dev` (it skips the tests, so merge it at once):
- CLAUDE.md: the **Live** and **Dev** lines; move each item that went live from the to-do list to **Done**, with its
  version, decision, on-dev date and live date.
- `SPEC.md` changelog: a `Notes — <what> is live` entry.

Then restart your working branch from the latest `dev`.

## 4. Tell Anton

It's live, with exact iPhone steps to see it in the live app (from the Home Screen; close and reopen it if the old
version shows), what couldn't be checked on a real iPhone, any flaky test you'll fix next, and what's next on the
to-do list.
