# Working on Green Tracker

Read this whole file before doing anything else. **Keep it up to date:** when the way we work changes (a new
rule from Anton, a new lesson, a new site or setting), update this file in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D72 so far), the changelog.
  Read it (and the README) before your first change.

## The two sites (D47)

| | Live | Dev |
|---|---|---|
| Address | https://green-tracker.green-tracker.workers.dev | https://green-tracker-dev.green-tracker.workers.dev |
| Built from | `main` | `dev` |
| Who can open it | everyone | only Anton (Cloudflare Access, policy "Cloudflare account": he signs in with his Cloudflare login) |
| Data | the real data | its own D1 `green-tracker-dev` and R2 `green-tracker-dev-photos`; never live data |
| Looks | normal | orange **DEV** label after the title; "GT Dev" on the Home Screen |

**The website (D63)** is separate from the app: plain files in `site/`, its own Worker. Public at
https://green-tracker-site.green-tracker.workers.dev (from `main`); a preview at
https://green-tracker-site-dev.green-tracker.workers.dev (from `dev`, locked like the dev site: on the Worker's **Access**
tab the lock must cover **Production**, not "Previews only", which leaves the address open). It loads nothing from
anywhere else (no tracking) and shows only made-up products. Its links to the app are absolute addresses.

- One codebase. `wrangler.jsonc` has the live settings at the top and the dev site under `env.dev`; the dev build uses
  `CLOUDFLARE_ENV=dev` (`npm run deploy:dev`). CI deploys `dev` → dev site, `main` → live site. **Never deploy by hand.**
- The two sites run the same features; only `SITE` (the DEV label) differs. Smokes, the one feature that once differed,
  was removed in 0.50.0 (D60). A feature that should differ again would get its own Worker variable, guarded in
  `test/domain/siteConfig.test.ts`.
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

- **SPEC.md:** the §4 section, a new decision number (next is D73), a changelog entry.
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
- Reopen any decision D1–D72.

## Testing notes

- The tests run **one server** each: the API tests' is set up like dev (`SITE` dev, `test/api/wrangler.test.jsonc`), the
  browser tests' like live (no `SITE`; `playwright.config.ts`, port 8788).
- Playwright serves the **built** app: run `npm run build` after changing client code before running Playwright
  directly (`npm run test:e2e` builds for you).
- Call `settled(page)` after waiting for something on screen, before axe, layout or contrast checks, and before you
  start counting animations. It waits for the page-load fade (`enter`) and a menu sliding up (`rise`); a new entrance
  animation must be added to it. `textBoxes` calls it itself (0.56.0: boxes measured mid-fade sat 6px off by the
  last steps). To prove a timing fix, slow animations with CDP `Animation.setPlaybackRate`.
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
  `none`). Set an account's preset in a test with `PUT /api/appearance`. A new account starts on **Gems** and the **Slim
  strip** since D71 (Aurora and the glass hero before): a test that names another set's colours or reads the hero
  sets it first. Ten sets since D69; a set's effect (sun, plankton,
  sparks, stars, grid; Metals' glints) comes from `bandEffect` and is drawn by `Effects` (`span.tfx`, never `.fx`: that's
  the currency tag), always clear of text: `appearance.spec.ts` checks no dot overlaps a row's text.
- The new look (D64): tokens at the top of `styles.css` (Aurora Glass on `:root`; a later look overrides them under
  `html[data-look=…]`). The stats at the top follow the account's `top` (glass hero, tiles, strip): every stat is a
  `.tile` with `b` and `.cap` in all three, so read them by label (`.tile` `hasText`), and check them with
  `expectStatsFit`. The lights are the animation `lights` on `.bg-layer` (painted on it, in steps); hold them still with
  `holdLights` (`aurora.spec.ts`) before comparing two photos. All four looks (D65) can be saved; choose one in a test
  with `PUT /api/appearance`. The phone remembers the look in `localStorage['gt.look']` (`client/public/look.js`), so a
  test that changes it should put Aurora back at the end. Readability over a busy screen: measure only text below the
  header, above the tab bar and clear of the add button (`look.spec.ts`).
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
  `navigator.audioSession` (Safari's sound mode) can be pretended in the same init script (`sounds.spec.ts`).
- Currencies (D66): exchange rates come from a stand-in, `test/fxStub.mjs`, which both test servers start and pass as
  `FX_URL` (never put it in `wrangler.jsonc`: `config.test.ts`). Per euro, GBP 0.85 + day/1000 (20 Oct → 0.87), USD
  1.10 + day/1000, working days only; **any day in 2001 fails** (the service down); rand (ZAR) refuses the ECB choice; `/calls` counts requests. A purchase
  dated 2001 in another currency also stops a later main-currency change, so give it another date before the test moves
  on. Set a purchase's currency in a test with `currency` and `rate` on the purchase (a non-main currency needs a rate),
  the main currency with `PUT /api/money`, and put £ back at the end. The phone remembers the last currency picked in
  `localStorage['gt.currency.last']`. The real service can't be reached from the cloud environment.
- Value for money (D67): an edible counts 20mg as 1g (`UnitDef.perGram`), so every type compares; Rank by under All
  offers Price and Value for money, and an edible's row there carries `.meta .per` ("per 20mg"). Under one type, price
  stays per mg. Any new value-for-money or price comparison uses `pricePerGramEquivalent` / `valueForMoney`.
- Appearance pages (D71): Look `/more/look`, Leaderboard top `/more/top`, Leaderboard colours `/more/colours` (with
  Mark my #1); `/more/appearance` opens Settings. The top of the Leaderboard (hero, strip, tiles) glows with the look
  (`--hero-glow`); the glass hero must never take the product page's `.hero` styles (its `::before` fade made it black).
- Light looks (D72): `daymint`, `daypearl`, `daysky` (`LIGHT_LOOKS`) set `html[data-tone="light"]`; anything with a colour
  of its own needs a light version under `html[data-tone="light"]` (end of `styles.css`), and the coloured rows are light
  cards there. `textBoxes` judges gradient text at both extremes. `daylight.spec.ts` sweeps screens with axe in each.
- Looks (D70): fifteen since D72, chosen with `PUT /api/appearance` (`look`); the owner's rule is that a look changes only colours and
  the background, never a font, size or shape (`looks.spec.ts` compares every position and font with Aurora Glass). A
  look's background is the lights plus `.bg-layer::before`/`::after`, moving only in `steps()`; name every keyframe
  `bg-…` (a plankton `rise` once replaced the menus' `rise`, which `settled` waits for). Whatever drifts behind words
  must pass the readability tests at every moment, so keep it about as bright as Aurora's lights. A new look goes in
  `LOOK_KEYS`, `LOOK_BG`, `look.js` and a migration (`gems.test.ts` checks they agree).
- Website video (D68): `site/public/media/` holds the rendered video, thumbnail and captions; the source is in
  `site/video/` (re-render with `node site/video/render.cjs`, see its README). The test browser can't decode H.264, so
  `website.spec.ts` checks the settings, what's downloaded when, and the captions loading, not playback.
- Late loads (D55): a new way to change a product on the client calls `changing(id)` (`client/src/products.ts`) as it
  starts, so an older `fetchProduct` can't put the old version back. Test it like `staleload.spec.ts`: hold the GET
  with `route.fetch()`, make the change, then release it.

## Where things stand

Keep this short and current. **Read the to-do list to Anton at the start of each conversation** and keep it updated:
when an item is merged into `dev`, mark it **on dev** (with the version and date); when it goes live, move it to
**Done** with both dates. A new item Anton asks for goes on the list in the same pull request as other notes, or in a
small notes-only one. The "Green Tracker to-do list" conversation answers Anton's questions about the list from this
section, so it must always be current.

- **Live:** 0.61.1 (live 2026-10-28): everything up to the glowing top, new defaults and Appearance pages (D71).
- **Dev:** 0.62.1: live plus the Daylight looks (D72).

### To-do list (suggested order; Anton decides)

1. **Daylight looks** — **on dev** (0.62.0, D72, 2026-10-29): Daylight Mint, Daylight Pearl and Daylight Sky, light
   cards for the colour sets, the iPhone's own controls light too; everyone still starts dark. Next: Anton tries them on
   GT Dev, then "go live".

### Done (newest first)

| Item | Version | Decision | On dev | Live |
|---|---|---|---|---|
| The top glows with your Look (the black hero fixed); new defaults (Slim strip, Gems); Looks and colours A to Z; Appearance in three pages | 0.61.0 | D71 | 2026-10-28 | 2026-10-28 |
| Eight more Looks: Sakura, Fireflies, Deep Sea, Frost, Nebula, Outrun, Lava Lamp, Haze | 0.60.0 | D70 | 2026-10-27 | 2026-10-28 |
| More Leaderboard colour sets: Sunset, Deep Sea, Ember, Cosmos, Synthwave, each with its own effect | 0.59.0 | D69 | 2026-10-27 | 2026-10-27 |
| A how-to video on the website (checked on Anton's iPhone on the preview) | 0.58.0 | D68 | 2026-10-26 | 2026-10-26 |
| Edible value for money: compares every type (20mg = 1g), Price and Value for money under All (checked on Anton's iPhone) | 0.57.0 | D67 | 2026-10-26 | 2026-10-26 |
| Currency settings (checked on Anton's iPhone) | 0.56.0 | D66 | 2026-10-22 | 2026-10-22 |
| The new look: Aurora Glass, Appearance, three more looks (checked on Anton's iPhone) | 0.54.0, 0.55.0 | D64, D65 | 2026-10-21 | 2026-10-21 |
| A website for the app (Aurora Glass; checked on Anton's iPhone) | 0.53.0 | D63 | 2026-10-20 | 2026-10-21 |
| Spending, whole card photos, swipe-back | 0.52.0 | D62 | 2026-10-20 | 2026-10-21 |
| Sources and Settings tabs | 0.51.0 | D61 | 2026-10-20 | 2026-10-21 |
| Remove Smokes | 0.50.0 | D60 | 2026-10-20 | 2026-10-21 |
| Brands and suppliers | 0.49.0 | D59 | 2026-10-20 | 2026-10-21 |
| Sounds and ticks (own screen, quiet on silent) | 0.48.1 | D56–D58 | 2026-10-18 | 2026-10-19 |
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
