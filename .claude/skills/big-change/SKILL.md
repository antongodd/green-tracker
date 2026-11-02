---
name: big-change
description: Green Tracker big change (a new feature, screen or Look; a migration; anything changing privacy or what followers see; anything Anton would want to try on his iPhone first). Questions, a plan, iPhone mockups, wait for "go ahead", build, onto GT Dev with iPhone steps, then wait for "go live".
---

# A big change

Rules are in CLAUDE.md ("How we work", "Every change", "Don't, without asking Anton first"). This recipe has two
stops where you **wait for Anton**; everything else you do yourself.

## 1. Understand it

1. Read the decisions it touches in `SPEC.md` (table and §4), and any brief in `design/`. Never reopen a decision
   D1–D76 (or later) without asking.
2. Ask the questions only Anton can answer, a few at a time, each with your recommendation. Explain knock-on effects
   in plain words: other screens, data, Export and Restore, followers, privacy. **Ask before adding scope.**

## 2. Plan and mockups, then wait

1. A short plan in plain words: what he'll see, what changes behind it (migration? privacy?), what's left out.
2. **A visual change:** interactive iPhone mockups, published as one Artifact (load the artifact-design skill first):
   each option a phone-sized screen (390×844) in the app's real look (tokens from the top of
   `client/src/styles.css`), the main states (empty, full, error, light and dark looks if colours are involved),
   tappable where it matters, your **recommendation marked**, options labelled A, B, C. Use made-up products only.
3. **Stop. Wait for "go ahead"** and his pick. Record what he chose and his words (they go in the decision).

## 3. Build

1. Branch from the latest `origin/dev`. **Take the next decision number** from CLAUDE.md ("next is D…"); if another
   conversation took it meanwhile, take the one after.
2. Build it. A database change only as a **new** migration file. New queries that list products or serve their photos
   use `NOT_KEPT`; follow the rest of CLAUDE.md's Testing notes for the parts you touch.
3. Tests: API and unit for the logic and privacy; browser tests for the journey, layout, readability and
   accessibility (never loosen those). A new browser spec joins the core set if a break would hurt data, privacy or the
   basics; refresh `test/e2e/timings.json` after adding a spec or a slow test.
4. Notes in the same pull request: version (minor bump), `SPEC.md` decision row + §4 section + changelog entry,
   CLAUDE.md (next decision number, new testing notes, the to-do item marked **on dev** with version and date).
5. Local checks as in **small-change** step 1.5, plus `--repeat-each=3` for a new test that waits on an animation.

## 4. Onto GT Dev, then wait

1. Fetch `dev`, rebase and fix clashes as in **small-change** step 2.1. Pull request into `dev`, squash-merge once
   **test** is green (auto-merge if still running).
2. Check the push run on `dev` finished green, **deploy-dev** included.
3. Tell Anton: it's on GT Dev, with **exact, numbered iPhone steps** to try it (open GT Dev from the Home Screen,
   pull to refresh if needed, where to tap, what he should see). Say what couldn't be checked on a real iPhone. Ask
   for screenshots if something looks off.
4. **Stop. Wait for "go live".** Fix anything he finds on the way (each fix is a small pull request into `dev`, and
   new iPhone steps).

## 5. Live

On "go live": follow **go-live**.
