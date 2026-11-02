---
name: small-change
description: Green Tracker small change (a bug fix, wording, a tweak to something that exists; no migration, privacy or follower change) from building it all the way to live, without waiting for Anton. Also for notes-only and tests-only changes.
---

# A small change, all the way to live

Rules are in CLAUDE.md ("How we work", "Every change", "Testing notes"); this is the order to do them in. If at any
point the change turns out to need a migration, or to change privacy or what followers see, stop: it's a big change
(use **big-change**) and tell Anton why.

## 1. Build

1. Branch from the latest `origin/dev` (the session branch). Ask Anton only if what he wants is unclear.
2. Make the change. Add or update tests (mostly API and unit). **A bug fix:** check the new test fails on the old code.
3. Grep **all** test files for anything you moved or renamed.
4. Notes in the same pull request:
   - `package.json` version bump (patch for a fix or tweak) and `npm install --package-lock-only`. Notes-only and
     tests-only changes keep the version.
   - `SPEC.md` changelog entry at the top of §6 (an app change always gets one; a decision only if it really decides
     something new).
   - CLAUDE.md: new rules or lessons; the to-do list if the item is on it.
5. Run `npm run typecheck`, `npm test`, the browser specs you touched and `npm run test:e2e:core`, with
   `PW_CHROMIUM=/opt/pw-browsers/chromium` and 2 workers, in the background, output saved to a file.

## 2. Into dev

1. **Before the pull request**, fetch `dev` again. If another conversation has merged since you started: rebase; if
   it took your version number, bump to the next one; merge both sets of notes (to-do list, changelog: theirs stays,
   yours goes on top). Re-run what the rebase could have broken.
2. Commit, push, open a pull request into `dev` (squash), with plain-English notes on what changed and why.
3. Merge it as soon as **test** is green; if it's still running, turn on auto-merge (squash). If it fails, read the
   log, fix the real cause, push again.

## 3. Live

**Notes-only** (only `*.md` and `design/`): stop at dev; nothing on live changes, and the notes reach `main` with the
next release. Otherwise follow **go-live**, for this change. Its step 1 checks that nothing on dev is waiting for Anton's "go live" before
it takes everything on dev to live: if something is, stop there and tell Anton his change is on dev and waiting with it.

## 4. Tell Anton

That it's live, what changed in one or two sentences, exact iPhone steps to see it on the live app (and that GT Dev
has it too), what couldn't be checked on a real iPhone, and what's next on the to-do list.
