---
name: start
description: Start of every Green Tracker conversation, before any other work, whatever Anton asks first. Reads the to-do list to Anton, checks for work another conversation has in progress, and says what's next.
---

# Start a conversation

CLAUDE.md is the rule book; this is the routine for the first few minutes. Do it before touching any file.

1. **Read** `CLAUDE.md` whole, then `README.md`. Read `SPEC.md` (decisions table, §4, the newest changelog
   entries) before your first change, not before you answer.
2. **Branch:** fetch `dev` and `main`; restart your session branch from the latest `origin/dev` if it holds nothing
   unmerged (`git checkout -B <branch> origin/dev`).
3. **Other conversations** (see CLAUDE.md, "Two conversations at once"). With the GitHub tools:
   - open pull requests into `dev` or `main`;
   - `claude/*` branches pushed in the last day that have no pull request yet;
   - CI runs still in progress on `dev` or `main`.
   Anything there is probably another conversation's work. Note what it touches (which screens, the version, a
   decision number, CLAUDE.md's to-do list). An open pull request more than a few days old (#88, #93, #96 and the like) is
   not yours to handle (Anton, 2026-11-02): leave it alone, don't ask about it, never close or merge it.
4. **Where things stand:** compare CLAUDE.md's Live / Dev lines with what's really on `main` and `dev`
   (`package.json` version on each, `git log origin/main..origin/dev`). If they disagree, say so and fix the notes in
   your next pull request.
5. **Tell Anton**, in plain words, short:
   - the to-do list (each item and its "Next:");
   - anything another conversation seems to be doing, and whether it could overlap with what he's asked for;
   - anything on dev waiting for his "go live".
6. Then do what he asked, choosing the recipe: **small-change**, **big-change**, **go-live**, **undo-live**,
   **new-look**. Say whether it's small or big (CLAUDE.md, "Small or big?").

If Anton's first message is only a question, answer it after step 5; you don't need to start a change.
