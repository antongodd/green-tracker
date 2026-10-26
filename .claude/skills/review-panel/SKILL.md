---
name: review-panel
description: Runs Green Tracker's review panel. Five reviewers (proof-reader, Sam the daily user, sceptical investor, marketing pro, app developer) review the app or the website, then a judge combines their reports into one ranked list for Anton. Use when Anton asks for a review, feedback, "run the panel" or one of the reviewers by name.
---

# The review panel

The agents live in `.claude/agents/`: `proofreader`, `stoner`, `sceptical-investor`, `marketing-pro`,
`app-developer` and `review-judge`. Their shared brief is `.claude/review-panel/BRIEF.md`. They only give
feedback; nothing in the app changes.

Anton can ask for the whole panel, one target ("just the website") or one reviewer ("ask the investor about the
new Log screen"). For a single reviewer, skip the judge unless he asks for it.

## 1. Fresh screenshots

The reviewers look at screenshots of the current code (the real sites can't be reached from the cloud
environment). From the repo root:

```sh
npm run build
PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test -c .claude/review-panel/capture.config.ts --reporter=line
```

(Leave out `PW_CHROMIUM` on a machine without `/opt/pw-browsers`. Run it in the background: it takes a few
minutes. Only the website? Add `capture-site`.)

This writes `.playwright/review/app/` (every screen, signed out and in, with made-up products, a friend, all four
looks) and `.playwright/review/site/` (the website on a phone and a laptop). Read `.playwright/review/app/INDEX.txt`:
any `FAILED` line means a screen was missed, usually because a screen changed. Fix
`.claude/review-panel/capture.spec.ts` (and add new screens there when the app gets them) before going on.

## 2. The five reviewers, at the same time

Start all five in one message (Agent tool, `subagent_type` = the agent's name). If the agent types aren't listed
(they load when a session starts), use `general-purpose` and begin the prompt with "Act as the reviewer described
in `.claude/agents/<name>.md`: read that file and follow it."

Each prompt says: the target (**the app** or **the website**), the date, the screenshot folder, anything Anton
asked to focus on, and "Reply with your full report in Markdown; don't write any files."

## 3. Save the reports

Save each reply word for word to `reviews/<YYYY-MM-DD>-<app|website>/<agent-name>.md` with a first line
`# <Reviewer>: <the app | the website> (<date>)`.

## 4. The judge

Start `review-judge` with the folder from step 3 and the target. Save its reply as `summary.md` in the same folder.
Check it yourself before passing it on: anything that's plainly wrong about the app gets corrected (say so in
"Checked and set aside").

## 5. Give it to Anton

- Turn `summary.md` into a page he can read on his phone and publish it (Artifact tool; one page per round, reuse
  the same file path to update it), then send him the link:
  `node .claude/review-panel/make-page.mjs reviews/<folder>/summary.md <scratchpad>/<name>.html "App Review Panel"`
  (it puts the sceptic's view in its own panel; title "Website Review Panel" for the website).
- In chat: the "In a nutshell" and the suggested to-do list, in a few lines. The sceptic's view stays separate.
- Ask which items go on the to-do list; add the ones he picks to CLAUDE.md's to-do list.
- Commit the `reviews/` folder in the same pull request as any notes (into `dev`, as usual).
