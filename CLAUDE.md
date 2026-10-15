# Working on Green Tracker

Read this whole file before doing anything else. **Keep it up to date:** when the way we work changes (a new
rule from Anton, a new lesson, a new site or setting), update this file in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D53 so far), the changelog.
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
- **After each item** is on dev or live: update the to-do list and Done in CLAUDE.md (see "Where things stand"), post it and suggest what's next.
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
- If the session was started with dev as its branch, a push of any other branch may get a 403 (it has also worked
  after a session restart). Never push straight to dev: if a `claude/<topic>` branch can't be pushed, tell Anton and
  ask how to proceed.
- Commit messages and pull requests: end them with the attribution lines your setup gives you; never name a model.

## Every change

- **SPEC.md:** the §4 section, a new decision number (next is D54), a changelog entry.
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
- Reopen any decision D1–D53.

## Testing notes

- The tests run **two servers**: one set up like dev (Smokes on, `SITE` dev) and one like live (Smokes off):
  `test/api/globalSetup.ts` (`liveApiBase`) and `playwright.config.ts` (`LIVE_PORT` 8789).
- Playwright serves the **built** app: run `npm run build` after changing client code before running Playwright
  directly (`npm run test:e2e` builds for you).
- Call `settled(page)` after waiting for something on screen, before axe, layout or contrast checks, and before you
  start counting animations. It waits for the page-load fade (`enter`) and a menu sliding up (`rise`); a new entrance
  animation must be added to it. To prove a timing fix, slow animations with CDP `Animation.setPlaybackRate`.
- `contrastFailures` only photographs the top 390×844. For long screens use `wholeScreenContrastFailures` (top and
  bottom, only text between the header and the tab bar). Prove a readability test bites by dimming the text.
- Wait for elements before reading lists: `allTextContents` / `evaluateAll` don't wait.
- Downloads: `saveAs`. Long sweeps: `test.slow()`. Slow loads: `page.route` + `route.fallback`.
- No `pgrep -f` in loops. Run long test runs in the background.
- `npm ci` may fail with ECONNRESET (retry). GitHub artifact downloads are blocked from the cloud environment.
- Browser-test usernames: add random characters to the time (`zoom.spec.ts` `person`); with `--repeat-each` copies
  start in the same millisecond and a time-only name is "already taken". Many older specs still use time only.
- API tests: each `new Browser()` gets a made-up address, random per file (`test/api/client.ts`); sign-up is limited to
  10 an hour per address, so keep sign-ups per file modest.
- Leaderboard colours (D48): rows carry `tier band1`…`band4 pal-<preset>` and `first`; product pages `data-band` (1–4 or
  `none`). Set an account's preset in a test with `PUT /api/appearance`.
- Photo actions (D52): grid photos have no buttons of their own. Use `photoAction(page, n, 'Crop' | 'Cut out')` in
  `test/e2e/helpers.ts` (⋯ menu in an editor, the viewer's bar on a product page). The cover is `.pslot.cover`.
- Zoom (D53): simulate a pinch with CDP `Input.dispatchTouchEvent` (two `touchPoints`) on a context with
  `hasTouch: true` (`test/e2e/zoom.spec.ts`). `textBoxes` hides the text it measures: screenshot before it, not after.
- Return to Log (D50): a returned entry's product is *kept* (`log_entries.kept_product_id`) and hidden by `NOT_KEPT` in
  `server/routes/products.ts`. Any new query that lists products or serves their photos must use it too.

## Where things stand

Keep this short and current. **Read the to-do list to Anton at the start of each conversation** and keep it updated:
when an item is merged into `dev`, mark it **on dev** (with the version and date); when it goes live, move it to
**Done** with both dates. A new item Anton asks for goes on the list in the same pull request as other notes, or in a
small notes-only one. The "Green Tracker to-do list" conversation answers Anton's questions about the list from this
section, so it must always be current.

- **Live:** 0.43.0 (2026-10-13): Leaderboard colours by score (D48), the four colours as one set (D49), Return to Log
  (D50). **Dev:** 0.45.0: live plus the Log photo swap fix (D51), choosing the cover photo (D52), zoom (D53) and
  notes-only changes (0.43.1–0.43.3). Smokes: on for dev, hidden on live (D46).

### To-do list (suggested order; Anton decides)

1. **Fix swapping a Log entry's photo** (D51): **on dev** (0.43.4, 2026-10-13), Anton confirmed it works on GT Dev.
   Replacing a Log entry's photo in a single edit used to fail with "Something went wrong" (live too, until it goes
   live).
2. **Smokes rework on dev.** On hold until Anton decides what he wants; then re-release it to live (turn `SMOKES` on
   for live, update `test/domain/siteConfig.test.ts` and D46).
3. **Leaderboard design rework**: continue when Anton brings it up.
4. **Sound effects and haptics** (Anton's idea, 2026-10-13): make the app feel more interactive. Talked through, not
   planned yet. Sounds: made in code (no downloads), obey the iPhone's silent switch, an on/off switch in More →
   Appearance. Haptics: iPhone web apps can't vibrate the usual way; the iOS 18+ trick (flicking a hidden on/off switch
   gives one light tick) may work, untested in the Home Screen app, and Apple could stop it. First step: a test page
   Anton opens on his iPhone to compare sound sets and try the tick; then a plan. Open questions: every tap or only big
   moments, what feel, on or off to start.
5. **Photo section rework** (Anton's idea, 2026-10-13), in three steps, each tried on GT Dev before the next:
   1. **Choosing the cover photo** (D52): **on dev** (0.44.0, 2026-10-13); Anton confirmed it works well on GT Dev.
      Gold ring and ★ on the cover; Set as cover in the viewer's bar (saved at once from the product page); ⋯ menu
      and press-and-hold drag in the editor.
   2. **Zoom** (D53): **on dev** (0.45.0, 2026-10-15). In the full-screen viewer: pinch up to 4×, double-tap for 2×
      and back, drag to look around; zoomed in, the buttons slide away (one tap brings them back); swiping to the
      next photo only when zoomed out.
   3. **Draw round a nug** in Remove background: offered at the start and after the AI's first try; draw rough loops
      round one or more nugs, everything outside is dropped and the AI cuts a clean edge from the rest; Undo, Clear,
      Draw again; two fingers zoom while drawing. Same AI (don't change the model). Designed for touching nugs and
      cluttered backgrounds (Anton couldn't send example photos). Not started.

### Done (newest first)

| Item | Version | Decision | On dev | Live |
|---|---|---|---|---|
| Return to Log | 0.43.0 | D50 | 2026-10-13 | 2026-10-13 |
| The four colours as one set of cards | 0.42.0 | D49 | 2026-10-12 | 2026-10-13 |
| Leaderboard colours by score | 0.41.0 | D48 | 2026-10-12 | 2026-10-13 |
| CLAUDE.md: how we work | 0.40.1 | | 2026-10-12 | 2026-10-12 |
| A private dev site | 0.40.0 | D47 | | 2026-10-12 |
| Smokes off on the live site | 0.39.0 | D46 | | 2026-10-11 |

Older releases: SPEC.md's changelog.
