# Working on Green Tracker

Read this whole file before doing anything else. **Keep it up to date:** when the way we work changes (a new
rule from Anton, a new lesson, a new site or setting), update this file in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D48 so far), the changelog.
  Read it (and the README) before your first change.

## The two sites (D47)

| | Live | Dev |
|---|---|---|
| Address | https://green-tracker.green-tracker.workers.dev | https://green-tracker-dev.green-tracker.workers.dev |
| Built from | `main` | `dev` |
| Who can open it | everyone | only Anton (Cloudflare Access, policy "Cloudflare account": he signs in with his Cloudflare login) |
| Data | the real data | its own D1 `green-tracker-dev` and R2 `green-tracker-dev-photos`; never live data |
| Looks | normal | orange **DEV** label after the title; "GT Dev" on the Home Screen |
| Smokes (D43/D44) | **off** (D46) | **on** |

- One codebase. `wrangler.jsonc` has the live settings at the top and the dev site under `env.dev`; the dev build uses
  `CLOUDFLARE_ENV=dev` (`npm run deploy:dev`). CI deploys `dev` → dev site, `main` → live site. **Never deploy by hand.**
- Features can differ per site with a Worker variable (Smokes: `SMOKES`, see D46). Re-releasing Smokes to live means
  turning `SMOKES` on for live (and updating `test/domain/siteConfig.test.ts` and D46).
- Anton copies his own data into dev himself (Export on live → Restore on dev). Nobody else's data is on dev.
- The dev site can't be reached from the cloud environment (neither can the live site): check deploys through GitHub
  Actions, and ask Anton for screenshots when you need to see a screen.

## How we work

- **For each change:** ask questions if anything is unclear, give a plan, and wait for "go ahead" before building.
- **Visual changes:** interactive iPhone mockups with your recommendation marked → a plan for the option he picks →
  wait for "go ahead".
- **Ask before adding scope.** Explain knock-on effects: other screens, data, export/restore, followers, privacy,
  and live vs dev.
- **After each item** is on dev or live: post the updated to-do list and suggest what's next.
- **Whenever you need Anton to do something** (GitHub, Cloudflare, iPhone), give exact, full, numbered steps. He's
  happy to click through and send screenshots.

### Branches, "merge" and "go live"

- Work on the branch the session gives you, started from the latest `dev`. **Open pull requests into `dev`**, never
  straight into `main`.
- `main` and `dev` are both protected (GitHub ruleset "Protect main and dev"): the GitHub Actions **test** check must pass.
- **"merge"** → squash-merge the pull request into `dev`: directly if the tests have passed; if they're still running,
  enable auto-merge and tell him (and if it hasn't merged itself once they pass, merge directly). Then check the run on
  `dev` finished green (job **deploy-dev**) and give exact iPhone steps to test it on **GT Dev**.
- **"go live"** → open a release pull request from `dev` to `main` listing what's going live. When he says "merge",
  merge it with a **merge commit (not squash)** so `dev` and `main` stay in step. Then check the run on `main`
  finished green, including the **"Live site serves this build"** step, and say it's live with exact iPhone steps.
- Only merge when Anton says so.
- After a merge, restart your working branch from the latest `dev` (same branch name; force-with-lease is fine).
- Commit messages and pull requests: end them with the attribution lines your setup gives you; never name a model.

## Every change

- **SPEC.md:** the §4 section, a new decision number (next is D49), a changelog entry.
- **Version:** bump `package.json`, then `npm install --package-lock-only`.
- **Tests** added or updated. Grep **all** test files for anything you moved or renamed.
- Before pushing, run `npm run typecheck`, `npm test`, and `npm run test:e2e`
  (`PW_CHROMIUM=/opt/pw-browsers/chromium`):
  - the browser tests **twice**: with 4 workers and with 2 (CI uses 2; never more than 4);
  - new tests repeated with `--workers=3 --repeat-each=6`.
- **Bug fixes:** check each new test fails on the old code.
- **Flaky test:** find the real cause. Never re-run until green. **Save the full output to a file before re-running
  anything** (a one-off failure was once lost by re-running first).
- **Readability and accessibility tests are never loosened.** Fix the design instead.
- **Tell Anton what couldn't be checked on a real iPhone.**
- **Screen recordings:** examine them frame by frame (opencv-python-headless).

## Don't, without asking Anton first

- Change the database except with **new** migration files.
- Put `SIGNUP_LIMIT_PER_HOUR` in `wrangler.jsonc`.
- Loosen the profile photo privacy rule (D23, `photoVisibleSql`).
- Change Remove background (768px model, onnxruntime-web 1.17.3, the `gt-ai-<model>` cache).
- Reopen any decision D1–D48.

## Testing notes

- The tests run **two servers**: one set up like dev (Smokes on, `SITE` dev) and one like live (Smokes off):
  `test/api/globalSetup.ts` (`liveApiBase`) and `playwright.config.ts` (`LIVE_PORT` 8789).
- Playwright serves the **built** app: run `npm run build` after changing client code before running Playwright
  directly (`npm run test:e2e` builds for you).
- Call `settled(page)` after waiting for something on screen, before axe, layout or contrast checks, and before you
  start counting animations.
- `contrastFailures` only photographs the top 390×844. For long screens use `wholeScreenContrastFailures` (top and
  bottom, only text between the header and the tab bar). Prove a readability test bites by dimming the text.
- Wait for elements before reading lists: `allTextContents` / `evaluateAll` don't wait.
- Downloads: `saveAs`. Long sweeps: `test.slow()`. Slow loads: `page.route` + `route.fallback`.
- No `pgrep -f` in loops. Run long test runs in the background.
- `npm ci` may fail with ECONNRESET (retry). GitHub artifact downloads are blocked from the cloud environment.
- API tests: each `new Browser()` gets a made-up address, random per file (`test/api/client.ts`); sign-up is limited to
  10 an hour per address, so keep sign-ups per file modest.
- Leaderboard colours (D48): rows carry `tier band1`…`band4 pal-<preset>` and `first`; product pages `data-band` (1–4 or
  `none`). Set an account's preset in a test with `PUT /api/appearance`.

## Where things stand

Keep this short and current.

- **Live:** 0.40.x. Smokes is hidden there (D46); Privacy (D45) is on.
- **Dev:** set up on Anton's phone, with his live data copied in. 0.41.0 (Leaderboard colours by score, D48) is going there.
- **Next:** Smokes is on hold until Anton decides what he wants; Leaderboard design rework in progress.
