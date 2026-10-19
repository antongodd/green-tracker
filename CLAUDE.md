# Working on Green Tracker

Read this whole file before doing anything else. **Keep it up to date:** when the way we work changes (a new
rule from Anton, a new lesson, a new site or setting), update this file in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D57 so far), the changelog.
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

- **SPEC.md:** the §4 section, a new decision number (next is D58), a changelog entry.
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
- Reopen any decision D1–D57.

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
- Photo actions (D52): grid photos have no buttons of their own. Use `photoAction(page, n, 'Crop' | 'Cut out' | 'Draw')` in
  `test/e2e/helpers.ts` (⋯ menu in an editor, the viewer's bar on a product page; 'Cut out' then picks Find the bud
  for me, 'Draw' picks Draw round it, D54). The cover is `.pslot.cover`.
- Safe areas (notch, home bar): Chromium has none; set `--safe-top` / `--safe-bottom` on `document.documentElement`
  to test them (`cutout.spec.ts`, the notch test).
- Zoom (D53): simulate a pinch with CDP `Input.dispatchTouchEvent` (two `touchPoints`) on a context with
  `hasTouch: true` (`test/e2e/zoom.spec.ts`). A double-tap must send its touch events together (`doubleTap`): sent one
  by one, a busy machine spreads them past the 300ms window. `textBoxes` hides the text it measures: screenshot before
  it, not after.
- Return to Log (D50): a returned entry's product is *kept* (`log_entries.kept_product_id`) and hidden by `NOT_KEPT` in
  `server/routes/products.ts`. Any new query that lists products or serves their photos must use it too.
- Sounds and ticks (D56): each sound played sends a `gt-sound` event (`{ moment, set }`); collect them with an init
  script (`sounds.spec.ts`). Chromium has no iOS switch control, so no ticks: pretend it in with
  `Object.defineProperty(HTMLInputElement.prototype, 'switch', …)`. A new big moment calls `play()` after it succeeds,
  and its button gets `<Tick />` (`.has-tick`) or a `Sheet` option `tick: true`. Never put a real control inside a
  button (axe nested-interactive): the tick is a label pointing at the one hidden switch `#gt-tick`. The browser-test
  servers say they're live: answer `/api/auth/me` with `site: 'dev'` (`page.route`) to see dev-only things.
- Late loads (D55): a new way to change a product on the client calls `changing(id)` (`client/src/products.ts`) as it
  starts, so an older `fetchProduct` can't put the old version back. Test it like `staleload.spec.ts`: hold the GET
  with `route.fetch()`, make the change, then release it.

## Where things stand

Keep this short and current. **Read the to-do list to Anton at the start of each conversation** and keep it updated:
when an item is merged into `dev`, mark it **on dev** (with the version and date); when it goes live, move it to
**Done** with both dates. A new item Anton asks for goes on the list in the same pull request as other notes, or in a
small notes-only one. The "Green Tracker to-do list" conversation answers Anton's questions about the list from this
section, so it must always be current.

- **Live:** 0.46.1 (2026-10-18): everything up to the late-load fix (D55). **Dev:** 0.48.0: live plus sounds and ticks
  (D56, D57) and notes-only changes (0.46.2, 0.46.3, 0.47.1, 0.47.2). Smokes: on for dev, hidden on live (D46).

### To-do list (suggested order; Anton decides)

1. **Sounds and ticks** (Anton's idea, 2026-10-13): **on dev** (0.47.0, D56, 2026-10-18; own screen and a Silent
   test, 0.48.0, D57, 2026-10-19). Tried on GT Dev in the Home Screen app: sounds play and ticks work, but sounds play
   on silent. Next: Anton runs the Silent test (More → Sounds and ticks, dev only, with the iPhone on silent) and says
   which tests stay quiet; switch `SESSION` in `client/src/sounds.ts` to that one and remove the card (if none, the
   Sounds note says it plays on silent, asking Anton first). Then "go live".
2. **Brands and suppliers** (Anton's idea, 2026-10-19; how it develops is still open), for **both** fields: the
   product's **Source** (the brand) and each purchase's **Supplier** (where he bought it, e.g. a coffeeshop; followers
   never see suppliers, D2/D45). (a) See every product he's tried from one brand or supplier. (b) Suggestions as he
   types, like Country: offer the ones he's already used (he goes to the same few coffeeshops and retyping is tedious).
   (c) Work out how to avoid duplicates: often there's no brand (especially from an Amsterdam coffeeshop), so Source
   and Supplier hold the same name, and the same place could show up twice. Plan first, then iPhone mockups.
3. **Leaderboard design rework, with a font and colour rework for the whole app** (fonts and colours added
   2026-10-18): continue when Anton brings it up. Anton doesn't like the font of the numbers in the Leaderboard's top
   banners (Products, Average, Total), and the colours now feel a bit mismatched with the rainbow and the rest; tidy
   fonts and colours across the whole app. Starts with iPhone mockups for him to pick from.
4. **A website for the app** (Anton's idea, 2026-10-19): a page people visit before they get the app, showing what
   Green Tracker is (screenshots, what it does) and linking them to the app, with steps to add it to the iPhone Home
   Screen. At a **separate address** from the app (Anton's choice). Plan first, then iPhone mockups.
5. **Smokes rework on dev.** On hold until Anton decides what he wants; then re-release it to live (turn `SMOKES` on
   for live, update `test/domain/siteConfig.test.ts` and D46).

### Done (newest first)

| Item | Version | Decision | On dev | Live |
|---|---|---|---|---|
| A slow page load can't undo your change | 0.46.1 | D55 | 2026-10-18 | 2026-10-18 |
| Photo rework 3: draw round a nug | 0.46.0 | D54 | 2026-10-16 | 2026-10-18 |
| Photo rework 2: zoom | 0.45.0 | D53 | 2026-10-15 | 2026-10-18 |
| Photo rework 1: choosing the cover photo | 0.44.0 | D52 | 2026-10-13 | 2026-10-18 |
| Fix swapping a Log entry's photo | 0.43.4 | D51 | 2026-10-13 | 2026-10-18 |
| Return to Log | 0.43.0 | D50 | 2026-10-13 | 2026-10-13 |
| The four colours as one set of cards | 0.42.0 | D49 | 2026-10-12 | 2026-10-13 |
| Leaderboard colours by score | 0.41.0 | D48 | 2026-10-12 | 2026-10-13 |
| CLAUDE.md: how we work | 0.40.1 | | 2026-10-12 | 2026-10-12 |
| A private dev site | 0.40.0 | D47 | | 2026-10-12 |
| Smokes off on the live site | 0.39.0 | D46 | | 2026-10-11 |

Older releases: SPEC.md's changelog.
