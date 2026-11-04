# Working on Green Tracker

Read this whole file before doing anything else, then follow the `start` recipe (see "The recipes"). **Keep it up
to date:** when the way we work changes (a new rule from Anton, a new lesson, a new site or setting), update this
file (and the recipes it touches) in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D88 so far), the changelog.
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
anywhere else (no tracking). Since D88 it shows Anton's own cut-out photos, strain names and scores (from his
account only, never private ones); sellers, prices and people stay made up, and nobody else's data is ever used. Its links to the app are absolute addresses. The app's
one link to it is the Invite a friend message (D82).

- One codebase. `wrangler.jsonc` has the live settings at the top and the dev site under `env.dev`; the dev build uses
  `CLOUDFLARE_ENV=dev` (`npm run deploy:dev`). CI deploys `dev` → dev site, `main` → live site. **Never deploy by hand.**
- The two sites run the same features; only `SITE` (the DEV label) differs. Smokes, the one feature that once differed,
  was removed in 0.50.0 (D60). A feature that should differ again would get its own Worker variable, guarded in
  `test/domain/siteConfig.test.ts`.
- Anton copies his own data into dev himself (Export on live → Restore on dev). Nobody else's data is on dev.
- The dev site can't be reached from the cloud environment (neither can the live site): check deploys through GitHub
  Actions, and ask Anton for screenshots when you need to see a screen.

## How we work (D75)

Anton wants changes to feel quick and automatic: he doesn't want to keep saying "merge". He is asked only for what
only he can decide. Everything else (merging, release pull requests, notes) you do yourself and tell him afterwards.

**Small or big?** Decide at the start and say which. Anton can overrule.
- **Small:** a bug fix, wording, or a tweak to something that already exists, and nothing that changes the database,
  privacy, or what followers see.
- **Big:** a new feature, screen or Look; anything with a migration, or that changes privacy or what followers see;
  anything he'd want to try on his iPhone first.

**A small change:** build it, then merge it into `dev` yourself once its check is green, then straight on to live
(release pull request, merge it once its full check is green). Then tell him it's live and how to see it. Ask first
only if what he wants is unclear.

**A big change:**
1. Questions if anything is unclear, then a plan; for a visual change, interactive iPhone mockups with your
   recommendation marked. Wait for **"go ahead"** (and his pick of the mockups).
2. Build it and merge it into `dev` yourself once its check is green. Check **deploy-dev** finished green, then give
   exact iPhone steps to try it on **GT Dev**.
3. Wait for **"go live"**, then do the rest yourself (below) and say it's live with exact iPhone steps.

- **Ask before adding scope.** Explain knock-on effects: other screens, data, export/restore, followers, privacy.
- **After each item** is on dev or live: update the to-do list and Done (see "Where things stand"), tell him, and
  suggest what's next.
- **Whenever you need Anton to do something** (GitHub, Cloudflare, iPhone), give exact, full, numbered steps. He's
  happy to click through and send screenshots.

### The recipes (skills, `.claude/skills/`)

Step-by-step routines for the jobs above, so nothing is forgotten. Anton doesn't type commands: **choose the recipe
yourself** from what he says (he can type `/go-live` and so on if he likes). This file stays the rule book; a recipe
is the order to do things in. When a rule changes, update the recipes it touches in the same pull request. Anton's
own one-page guide is `WORKFLOW.md`: keep it in step too.

| Recipe | When |
|---|---|
| `start` | The start of every conversation, before anything else |
| `small-change` | A small change (and notes-only or tests-only ones), all the way to live |
| `big-change` | A big change: questions, plan, mockups, "go ahead", GT Dev, "go live" |
| `go-live` | Anton says "go live", and the end of every small change |
| `undo-live` | Something on live is broken |
| `new-look` | A new or changed Look or Leaderboard colour set (with `big-change`) |
| `review-panel` | Anton asks for a review: five reviewers (Sam the everyday user counts most) and a judge; reports in `reviews/` |
| `green-tracker-account-audit` | Anton asks to audit all accounts: a read-only table of everyone on live, shown only in the conversation (never saved, no emails) |
| `green-tracker-reports` | Anton asks to see the reports (D84): a read-only table in the conversation; removes a post or comment only on his "yes" |

**Outside skills** (not recipes): `apple-design` (Emil Kowalski's, from `github.com/emilkowalski/skills`, MIT; added
2026-11-03 at Anton's request) is design advice on Apple-style motion, materials and type, for building or reviewing
screens. Where it disagrees with this file, this file wins: a Look changes only colours and the background (D70), the
looks' moving lights stay, readability and accessibility tests are never loosened, and anything it suggests that
changes how the app looks is still a big change.

### Two conversations at once

Anton may run more than one conversation at a time. Each works on its own branch; GitHub is the only place you can
see the others' work (open pull requests, recently pushed `claude/*` branches, CI runs).
- **At the start** (`start`) and **again before opening a pull request**, fetch `dev` and look for the others' work.
  Tell Anton if it overlaps with his request (the same screen or files); suggest doing one after the other if so.
- **Whoever merges second sorts out clashes:** rebase on the latest `dev`; take the next free version number and
  decision number; keep both sets of notes (to-do list, Done, changelog: theirs stays, yours goes on top).
- **Going live takes everything on `dev`.** Never open a release while a big change on `dev` is still waiting for
  Anton's "go live": tell him your change is on dev and waiting with it, and ask. One release pull request at a time.
- **Naming a conversation you open for a job** (Anton, 2026-11-03): start with "Job #" and the to-do list number,
  then a short description, with no "Green Tracker" in front: for example "Job 3: Privacy and data wording".
- Never close, merge or push to another conversation's branch or pull request. Old open pull requests (#88, #93, #96)
  aren't yours to handle either (Anton): leave them, and don't ask about them.

### Branches and merging

- Work on the branch the session gives you, started from the latest `dev`. **Open pull requests into `dev`**, never
  straight into `main`.
- `main` and `dev` are both protected (GitHub ruleset "Protect main and dev"): the GitHub Actions **test** check must
  pass. Merge as soon as it does (squash into `dev`); if it's still running, turn on auto-merge so it merges itself.
- **Going live:** open a release pull request from `dev` to `main` listing what's going live, and merge it with a
  **merge commit (not squash)** once its check is green, so `dev` and `main` stay in step. Then check the run on `main`
  finished green, including **"Live site serves this build"**.
- If something on live breaks: put the previous version back first (a pull request reverting the change, straight
  through to live), then fix it properly.
- After a merge, restart your working branch from the latest `dev` (same branch name; force-with-lease is fine).
- If the session was started with dev as its branch, a push of any other branch may get a 403 (it has also worked
  after a session restart). Never push straight to dev: if a `claude/<topic>` branch can't be pushed, tell Anton and
  ask how to proceed.
- Commit messages and pull requests: end them with the attribution lines your setup gives you; never name a model.

### What CI checks (D75, `scripts/ci-plan.mjs`)

| What | Checks | About |
|---|---|---|
| Pull request into `dev` | typecheck, unit and API tests, the **core** browser tests | a few minutes |
| Release pull request into `main` | the same, with **every** browser test | about 5 minutes |
| Notes only (`*.md`, `design/`) | nothing | under a minute |
| Push to `dev` or `main` | nothing again: its pull request tested that code | the deploy only |

The browser tests are shared between six machines at once, each with an equal share by time
(`scripts/e2e-shard.mjs`, from the measured seconds in `test/e2e/timings.json`; the repository is public, so it's
free). After adding or removing a spec file or a slow test, refresh the timings from a full local run (see
`scripts/e2e-timings.mjs`); a test not in the file counts as 15 seconds, so nothing is ever left out. The core set is
the list in `package.json` (`test:e2e:core`): signing in, data, privacy, followers, products, the Log, photos, the
editors asking before discarding (`keepediting`) and the quality checks. A spec joins it when a break there would hurt Anton's data, privacy or the basics.

## Every change

- **Notes go in the same pull request** as the change (to-do list, Done, testing notes). After going live, the move to
  Done is a notes-only pull request: it skips the tests, so merge it at once.
- **Version:** bump `package.json` (then `npm install --package-lock-only`) when the app changes. Notes-only and
  tests-only changes keep the version.
- **SPEC.md:** a changelog entry for every app change. A big change also gets a decision (next is D89) and its §4
  section; a small one only when it really decides something new.
- **Tests:** add or update tests for what changed, mostly API and unit tests (fast, steady). A browser test is for
  what only a browser can show: a whole journey, a screen's layout, readability, accessibility. Grep **all** test
  files for anything you moved or renamed.
- Before pushing, run `npm run typecheck`, `npm test`, and the browser specs you touched plus the core set
  (`npm run test:e2e:core`), with `PW_CHROMIUM=/opt/pw-browsers/chromium` and 2 workers. Leave the rest to CI. A new
  browser test that waits on an animation or timing: run it with `--repeat-each=3` too.
- **Bug fixes:** check each new test fails on the old code.
- **Flaky test:** on CI a failed browser test gets one retry (`playwright.config.ts`); one that passes on the retry is
  listed as **flaky** at the end of the browser tests' log. Look at the logs of each release's run: a flaky test is
  fixed in the next change (find the real cause), not in a release of its own. Wait on
  what the screen shows (an element, a class, `settled`), never a fixed time. If a test can't be made steady and checks
  only how something moves, delete it and say so. **Save the full output to a file before re-running anything.**
- **Readability and accessibility tests are never loosened.** Fix the design instead.
- **Tell Anton what couldn't be checked on a real iPhone.**
- **Screen recordings:** examine them frame by frame (opencv-python-headless).

## Don't, without asking Anton first

- Change the database except with **new** migration files.
- Put `SIGNUP_LIMIT_PER_HOUR` in `wrangler.jsonc`.
- Loosen the profile photo privacy rule (D23, `photoVisibleSql`).
- Change Remove background (768px model, onnxruntime-web 1.17.3, the `gt-ai-<model>` cache).
- Reopen any decision D1–D88.
- Loosen how passwords are kept or checked (D80, D83, `server/lib/password.ts`): only a salted PBKDF2 hash, the same
  answer for a wrong password and an unknown email, the per-email, per-device and per-account limits (wrong tries only
  since D83); adding Face ID asks for the password unless just signed in; the email is never shown to anyone else.
- Loosen the reports rule (D84, `server/lib/reports.ts`): only what you can see can be reported, never your own;
  nobody is told; reports never reach followers, Export or Restore. Or change the privacy page (`screens/About.tsx`)
  in a way that makes a sentence untrue: when what's kept, where, or who sees it changes, update the page with it.
- Loosen the posts rule (D77, `visiblePostSql` / `actorShownSql` in `server/routes/posts.ts`): the owner and approved
  followers only, checked in SQL on every request.

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
- On CI each browser machine may run 25 minutes (it takes about 4). A run "cancelled" at the limit with no test failed
  means the timings are stale or a file outgrew it, not a flaky test: refresh `timings.json`, or add a machine (`ci.yml`
  `shard`). Run one machine's share locally with `node scripts/e2e-shard.mjs <n> 6 [core|full]`
  (`DRY=1` only shows the split). A file in `mode: 'parallel'` is shared test by test; any other stays whole.
- `npm ci` may fail with ECONNRESET (retry). GitHub artifact downloads are blocked from the cloud environment.
- Browser-test usernames: add random characters to the time (`zoom.spec.ts` `person`); with `--repeat-each` copies
  start in the same millisecond and a time-only name is "already taken". Many older specs still use time only.
- API tests: each `new Browser()` gets a made-up address, random per file (`test/api/client.ts`); sign-up is limited to
  10 an hour per address, so keep sign-ups per file modest.
- Leaderboard colours (D48): rows carry `tier band1`…`band4 pal-<preset>` and `first`; product pages `data-band` (1–4 or
  `none`). Set an account's preset in a test with `PUT /api/appearance`. A new account starts on **Gems** and the **Slim
  strip** (Compact since D87) since D71 (Aurora and the glass hero before): a test that names another set's colours or
  reads another top sets it first. Ten sets since D69; a set's effect (sun, plankton,
  sparks, stars, grid; Metals' glints) comes from `bandEffect` and is drawn by `Effects` (`span.tfx`, never `.fx`: that's
  the currency tag), always clear of text: `appearance.spec.ts` checks no dot overlaps a row's text.
- The new look (D64): tokens at the top of `styles.css` (Aurora Glass on `:root`; a later look overrides them under
  `html[data-look=…]`). The stats at the top follow the account's `top` (D87: `strip` Compact `.banner.strip`, `tiles`
  Summary `.banner.summary`, `hero` Showcase: the Compact line plus `.board-showcase`): every stat is a `.tile` with `b` and
  `.cap` in all three, so read them by label (`.tile` `hasText`), and check them with `expectStatsFit`. The lights are the animation `lights` on `.bg-layer` (painted on it, in steps); hold them still with
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
  The Look page lists them last, under *Light mode* (D73; the dark looks under *Dark mode*): two `radiogroup`s, one
  radio name. `LOOK_KEYS` keeps that order (`gems.test.ts`).
- Looks (D70): fifteen since D72, chosen with `PUT /api/appearance` (`look`); the owner's rule is that a look changes only colours and
  the background, never a font, size or shape (`looks.spec.ts` compares every position and font with Aurora Glass). A
  look's background is the lights plus `.bg-layer::before`/`::after`, moving only in `steps()`; name every keyframe
  `bg-…` (a plankton `rise` once replaced the menus' `rise`, which `settled` waits for). Whatever drifts behind words
  must pass the readability tests at every moment, so keep it about as bright as Aurora's lights. A new look goes in
  `LOOK_KEYS`, `LOOK_BG` and `look.js` (`gems.test.ts` checks they agree); a new look or colour set needs **no
  migration** since D76 (the app checks them: `validateAppearance`; reading back, `loadAppearance` shows the default
  for one it doesn't know).
- Website polish (D85): things on the website arrive once (phone, rows, chips, blocks rising); call `arrived(page)` in
  `website.spec.ts` before axe or anything judging colours, or a half-faded chip reads as faint words. Only `drift1`,
  `drift2`, `holo` and `holo-text` may loop (a test lists them). The top bar holds Open app and Sign up in one spot,
  one hidden (`visibility`) at a time: measure only the one showing (`>> visible=true`).
- Website things to play with (D86): drag in a test with the mouse in small steps (`drag` in `website.spec.ts`;
  Chromium sends pointer events); scroll the thing into view first (the hero's phone sits low). Rate the stack: wait
  for a card to fly off (one fewer `.card`) before the next button press. A Look is picked by clicking its `.lk`; wait
  for the lights' colour change (`CSSTransition`s) before judging words. Only the top card's words are in `WORDS`.
  The sheet (`hidden` until opened) and the Looks' names (off the side of the screen) are judged in their own tests.
  Anything with `hidden` needs `[hidden] { display: none !important }` (at the top of `site.css`): a `display` of its
  own otherwise shows it.
- Website photos (D88): `site/public/media/nugs/<strain>-s|l.webp`, made from Anton's cut-outs and re-encoded so they
  carry only the picture (`website.spec.ts` reads each file's chunks). A new one: the same way (PIL, WebP, no
  `exif`/`icc_profile`), never a straight copy of a photo. Never put anyone else's photos or names on the site.
- Website video (D68): `site/public/media/` holds the rendered video, thumbnail and captions; the source is in
  `site/video/` (re-render with `node site/video/render.cjs`, see its README). The test browser can't decode H.264, so
  `website.spec.ts` checks the settings, what's downloaded when, and the captions loading, not playback.
- Their look (D74): a friend's board, product and brand pages are wrapped in `InTheirLook` (`components/Gems.tsx`);
  `useAppearance` there returns theirs. A component that reads the appearance outside its own wrapper (as
  `SharedProfile` does for its hero) must use `useTheirLook`. The look on the screen goes through `screenLook.ts`
  (`setOwnLook`, `borrowLook`), never straight to `html[data-look]`. Record the looks a page shows with a
  MutationObserver (`theirlook.spec.ts` `recordLooks`); a fade shows as `+fade` (`html.vt-look`). To change screen
  without a reload, wait for `.tabs` first (`theirlook.spec.ts` `go`): the router listens only after the first render.
- Posts (D77): the rule is `visiblePostSql` (the owner, or `canView`) and, for comments and fires, `actorShownSql` (the
  author can still see the post; no block with the viewer); any new query listing posts, comments or fires uses them in
  SQL. A post in a test: upload a set (`cropped` + `thumb`, an original is optional) and `POST /api/posts` with
  `{ caption, about: { product } | { logEntry } | null, photo: { upload } | { fromPhotoId } }`; a second account follows
  with `POST /api/people/u/<them>/follow` and `POST /api/people/requests/<you>/approve` (`posts.spec.ts` `call`,
  `upload`). The Feed's first page marks it seen (`feedNew` on `/api/auth/me`). People has no tab since D77: reach it
  with the Feed tab, then the **People** button (its name carries the requests: "People, 1 follow request"); the
  requests number is on the Feed tab, and a `.badge.dot` when there are none and something's new. Posting is limited
  to 30 an hour per account, so keep a file's posts per account under that. D78: `photos: [...]` (1–10) in place of
  `photo`; a post's `n`th photo is `postPhotoUrl(post, variant, n)`; in a list each photo is its own "Open the post
  (photo i of n)" link.
- A row's photo (D79): a tap on `.thumb` (with an `img`) opens the viewer instead of the page, checked in the row's own
  click (`tappedPhoto`), never a button inside the link (axe nested-interactive). Click the `.thumb` in a test; the
  hidden `Photos of …` button can't be clicked, so `focus()` it and press Enter (`rowphotos.spec.ts`). The product
  page's photo tools are `usePhotoEdits` (`components/ProductPhotos.tsx`), shared with the lists: change them there.
- Email and password (D80): the browser tests' `signUp` fills Email and `Password` (`{ exact: true }`: the Show button
  is next to it), picks the username, then **Use Face ID**, so every test account still has a passkey; `PASSWORD` and
  `emailOf(username)` in `helpers.ts`. The API tests' `signUp(b, name, { passkey: false })` skips the passkey;
  `signInWithPassword`. An account from before D80: `POST /api/test/old-account` `{ username }`, open only on the test
  servers (`TEST_HOOKS`, set in `test/api/globalSetup.ts` and `test/e2e/server.mjs`; never in `wrangler.jsonc`:
  `config.test.ts`). Never write to the test servers' database file from a test: the Worker then fails with "database
  is locked". Wrong passwords are limited per email and per account (10 every 15 minutes): keep a file's wrong tries
  per account under that.
- Don't lose my work (0.69.2): the product, Log entry and post editors use `useKeepEditing` (`components/KeepEditing.tsx`):
  Cancel and a swipe back (`page.goBack()`) open the Keep editing / Discard sheet while anything has changed. The swipe
  is caught by `holdPlace` in `router.ts`; call `done()` once saved, before leaving, or the leaving is asked about. A
  test that changes an editor and then Cancels or goes back now meets the sheet. Save and Post have a 20-second limit
  (`SAVE_TIMEOUT_MS`): test it with `page.clock.install()` and a `page.route` that never answers (`keepediting.spec.ts`).
- The Feed (0.69.9): tapping the tab you're on, on its own page, sends `gt-tab-again` (`detail`: the tab) instead of
  navigating; the Feed answers with the top and a reload (`usePostList().reload`, merged by `mergeFirstPage`). Coming
  back to the app is `visibilitychange`: pretend it with `Object.defineProperty(document, 'visibilityState', …)` and
  dispatch the event (`feed.spec.ts` `backToFront`). Only a list's first post loads its photo at once (`eager`).
  A screen with the + has `has-fab` (room under the list for it).
- The product editor (D81): Type and Strain type are radio chips (`ChoiceChips`): pick with
  `getByRole('radio', { name: 'Edible', exact: true }).click()` (the Log editor keeps its **Product type** list). − / +
  are buttons named "Lower Look" / "Raise Look"; an unrated score starts at 5.0. Name is its own card, then Photos,
  The product, Ratings, Purchases; the Ratings card is lower down, so scroll a rating into view before measuring it.
  A new product starts with today as Date tried and no purchase. A purchase with no total paid stops Save ("Add the
  total paid for the purchase, or remove it."), so a test that adds a purchase must give it a total or remove it. The
  Name and Source examples are random: match them against `NAME_EXAMPLES` / `SOURCE_EXAMPLES`. A text measured inside
  a chip is its `span` (`.choice > span`); `.field > label` for the box labels. Country (0.70.1) is a text box
  (`getByRole('combobox', { name: 'Country' })`, its value the country's name, the flag in `.cbox > .flag`); its list is
  the group "Countries" under it (regions Used / All countries / Matching countries), not a dialog. Measure only the
  rows in sight: the list scrolls inside its own window.
- You against them (D82): the same product is `sameProductKey` (`shared/domain/compare.ts`): name, Source and type by
  `nameKey`, never the name alone. A friend's product page reply has `yours`, a post's `about.yours`, and
  `/api/people/u/<them>/compare` the `comparison`; all built from `sharedFor` (their Privacy) and your `load` (with
  `NOT_KEPT`). A new field in them must be checked in `test/api/compare.test.ts` (raw replies, nothing unshared). The
  scores show each person's photo and @name (`components/Duel.tsx`), never "you" / "them". Invite a friend calls
  `navigator.share`: pretend it with an init script (`compare.spec.ts` `person`). Opened straight from its address, a
  friend's page fades into their look: wait for `html` to lose `vt-look` before axe.
- Sign-in hardening (D83): only wrong passwords count against an email (`check` / `miss` in `rateLimit.ts`); a
  browser that signed in is remembered (`gt_device`, `known_devices`) and has its own tries. Adding a passkey asks for
  the password unless the session is under 5 minutes old: the API tests' and browser tests' `signUp` add theirs at
  once, so they don't. To make a session older, `POST /api/test/age-sessions` `{ username, minutes }` (`ageSessions`
  in `test/api/client.ts`). A new password with Face ID: `POST /api/account/password/options`, then `PUT
  /api/account/password` with `challengeId` and `response` instead of `current`. Chromium allows one virtual Face ID
  per page: to add a second passkey in a browser test, `WebAuthn.clearCredentials` first (`accounts.spec.ts`).
- Trust basics (D84): sign-up needs the tick (`signUp` checks **I'm 18 or over**; an API sign-up sends `adult: true`).
  An account from before it: `POST /api/test/not-adult` `{ username }`, then the app shows **One quick thing** and
  the API answers 403 `needs_adult` until `POST /api/account/adult`. Near the photo limit without thousands of
  uploads: `POST /api/test/fill-photos` `{ username, product, count }` (rows only, no files; use a product the test
  never saves again, as saving it drops them). Report: a friend's post now has a ⋯ (`Actions for @x’s post`), and
  a person's page has a ⋯ even when followed (`Actions for @x`), so a test that counts ⋯ buttons or reads the header
  meets them. The pages over sign-up are dialogs, not a `<main>` (axe `landmark-no-duplicate-main`).
- The Apple-style base (D87): the styles are one block in `styles.css` ("The Apple-style base", just before the light
  tone; the Feed's and editors' bits at the very end). Fonts are Apple's (`-apple-system`, `ui-rounded`): Chromium
  draws a stand-in, so a test checks the family named, never how it looks. The main screens' `h1` is `LargeTitle`
  (`.ltitle`, inside `<main>`: outside it axe finds `region`); `.hdr.top` while scrolled under 36px. Settings has no tab:
  your photo `.me-btn` ("Settings (@name)") is only on the four main tabs, so from anywhere else `goto('/more')` or
  Back. Never give a card `backdrop-filter`: anything `position: fixed` inside it (the avatar cropper, a sheet) is then
  placed in the card. Rows are 10px apart. A product page's actions are `.acts` (`Private` switch, Post, Return to
  Log, Archive); Edit is only in the header. Press feedback presses in (`.is-pressed` scale 0.97; list rows light up
  grey) in place of D20's lift. `textBoxes` reads a mixed colour (`color(srgb …)`, from `color-mix`) as rgba.
- Late loads (D55): a new way to change a product on the client calls `changing(id)` (`client/src/products.ts`) as it
  starts, so an older `fetchProduct` can't put the old version back. Test it like `staleload.spec.ts`: hold the GET
  with `route.fetch()`, make the change, then release it.

## Where things stand

Keep this short and current. **Read the to-do list to Anton at the start of each conversation** and keep it updated:
when an item is merged into `dev`, mark it **on dev** (with the version and date); when it goes live, move it to
**Done** with both dates. A new item Anton asks for goes on the list in the same pull request as other notes, or in a
small notes-only one. The "Green Tracker to-do list" conversation answers Anton's questions about the list from this
section, so it must always be current.

- **Live:** 0.73.1 (2026-11-03): everything up to trust basics for strangers (to-do item 7).
- **Dev:** 0.77.0 (2026-11-04): the website polished in Apple's style, five new things on it and Anton's own photos
  (to-do item 15, 0.74.0–0.75.0, 0.77.0), and the app's Apple-style redesign, stage A (to-do item 16, 0.76.0); both waiting for Anton's "go live".

### To-do list (suggested order; Anton decides)

From the review panel of 2026-11-03 (`reviews/2026-11-03/summary.md`; Anton wants all ten, order left to Claude).
Each is a job for its own conversation; the summary lists what each covers.

1. ~~Forgot-password safety net~~: live in 0.69.1 (see Done). Numbers stay as they are, so "Job 2" and the rest
   keep naming the same job.
2. ~~Don't lose my work~~: live in 0.69.2 (see Done).
3. ~~Privacy and data words that are out of date~~: live in 0.69.3 and 0.69.5 (see Done).
4. ~~Small fixes on the Leaderboard, Log and Feed~~: live in 0.69.9 (see Done).
5. ~~Wording fixes across the app~~: live in 0.69.8 (see Done). Anton keeps the New tags on Looks and colours
   (2026-11-03). Still open if he wants them: the names used twice (Deep Sea; Aurora, Neon), the Brand tag on a
   brand's own page.
6. ~~Website catch-up~~: live in 0.69.4 and 0.69.6 (see Done).
7. ~~Trust basics for strangers~~: live in 0.73.0–0.73.1 (see Done). Ofcom: the Online Safety Act applies (its
   paperwork is item 12); ICO: the fee applies (£52, paying is Anton's to do). Later if he wants it: move the photos
   (now in North America) to Europe.
8. ~~Friends: you against them, and inviting someone~~: live in 0.71.0 (see Done).
9. ~~Sign-in hardening~~: live in 0.72.0 (see Done).
10. ~~A quicker add-a-product form~~: live in 0.70.0–0.70.2 (see Done).
11. **Forgot password by email, and checking the email is real** (later; Anton, 2026-11-02). Both need the app to send
   email: a web address of Anton's linked to Cloudflare, or an email service. Until then, a forgotten password with no
   Face ID can't be recovered. Would also stop sign-up showing whether an email has an account (panel, 2026-11-03).
12. ~~Ofcom paperwork~~: drafted 2026-11-03 in `design/ofcom/` (see Done). Anton still signs, dates and keeps them,
   checks the 🔎 points on Ofcom's site, and looks at them again by 2027-11-03 or before a big change to what people
   can share (`big-change` step 1).
13. **Acting on reports** (from the Ofcom paperwork, 2026-11-03; Anton decides). Reports reach Anton only when he asks
   (a weekly reminder, or a message when one arrives); there's no way to close an account that keeps breaking the
   rules, though the house rules say Anton can; the house rules don't say how to complain about a decision (the
   contact address). Ofcom expects reports dealt with swiftly and a route for complaints.
14. **A real age check** (from the Ofcom paperwork; optional, Anton's choice, later). The 18+ tick isn't "highly
   effective age assurance", so in law children can use the app; for now the children's access assessment finds
   they're not likely to. Worth it before opening the app beyond friends of friends; costs money per check.
15. **The website, polished in Apple's style** (big; Anton, 2026-11-03, a test of the `apple-design` skill before
   using it on the app): **on dev** in 0.74.0 (2026-11-03), D85. Buttons press in at once, things move once, Sign up
   in the top bar, the features in one panel, an iPhone-style slider, Reduce Transparency and Increase Contrast.
   Mockups https://claude.ai/artifact/3LCt7ZjfbYwPNed7c122ga. Then Anton asked for more imagination: **on dev** in
   0.75.0 (2026-11-04), D86, all five of https://claude.ai/artifact/86BpBY9d4FbeghqL5CrSct: Rate the stack, Make it
   yours (the Looks), the phone you can pick up, the scroll story, the install sheet. Then Anton's own photos and
   strain names in place of the drawn nugs: **on dev** in 0.77.0 (2026-11-04), D88. Waiting for "go live". Next: the
   same on the app (item 16).
16. **The Apple-style redesign of the app** (big; Anton, 2026-11-03: "it just looks like a vibe coded app — i want it to look like
   a real developed apple app"; D87). Mockups https://claude.ai/artifact/WQrY1QDf397CU8vNUdVnQ8. In three stages,
   each with its own mockups:
   - **Stage A, the base design:** **on dev** in 0.76.0 (2026-11-04). Apple's fonts, large titles, the floating tab
     bar, Settings from your photo, calm cards, the three new tops (Compact for new accounts), the product page's
     actions, springy sheets. Waiting for "go live".
   - **Stage B, the Looks:** Anton's favourites (Sakura first, then Nebula, Aurora Glass, Deep Forest, Deep Sea,
     Frost, Fireflies, Lava Lamp, Neon Night, Outrun) refreshed with smooth, detailed moving backgrounds (battery is no
     concern); Holo Pearl and Haze go (their users move to the default); light mode as one or two really good looks
     instead of three (Anton doesn't use it). Next: mockups.
   - **Stage C, the Leaderboard colours:** Anton's favourites (Sunset first, then Synthwave, Prism, Neon, Ember
     without the blue in the middle, Deep Sea, Cosmos, Aurora) with more little details and animations; Gems and
     Metals go (their users move to the default, Aurora). New accounts start on Aurora Glass and Aurora.
   - The website: its own job (item 15).

### Done (newest first)

| Item | Version | Decision | On dev | Live |
|---|---|---|---|---|
| Ofcom paperwork: the illegal content risk assessment (drugs supply medium, everything else low or negligible) and the children's access assessment (children can get past the tick, but aren't likely to use it, so no children's risk assessment for now), in `design/ofcom/`, with what Anton must still do (sign, keep, review by 2027-11-03); two new to-do items (13, 14) | (notes) | | 2026-11-03 | notes only |
| Trust basics for strangers: "I'm 18 or over" at sign-up (older accounts asked once), a privacy page and house rules under Settings › About with the contact address greentracker.help@gmail.com, Report on posts, comments and profiles (hidden for you at once; Anton reads them with the reports recipe), a 3,000-photo limit, Delete account mentions the 30-day backups, 18+ on the website; Anton ran the Ofcom and ICO checkers and set a Cloudflare billing alert (the tick, report sheets and VoiceOver not yet checked on Anton's iPhone) | 0.73.0, 0.73.1 | D84 | 2026-11-03 | 2026-11-03 |
| An outside design skill: `apple-design` (Apple-style motion, materials and type), for Claude to use when building or reviewing screens | (notes) | | 2026-11-03 | notes only |
| Sign-in hardening: only wrong passwords count against an email, and a phone you've signed in on has its own tries (strangers can't lock you out); adding Face ID asks for your password (not straight after signing in); "Forgot it? Use Face ID instead" on Password; after a password change, the passkeys that can still sign in with Last used and Remove (Face ID prompts and the new screens not yet confirmed on Anton's iPhone) | 0.72.0 | D83 | 2026-11-03 | 2026-11-03 |
| You against them, and Invite a friend: "You've had this too" with both photos, @names and scores on a friend's product page and post (same name, brand and type only), Compare with my board (a card for each subject, empty ones hidden), Invite a friend on the empty Feed and People (the share sheet with your @name and the website) (the real share sheet, profile photos in the cards and VoiceOver not yet checked on Anton's iPhone) | 0.71.0 | D82 | 2026-11-03 | 2026-11-03 |
| A quicker add-a-product form: Name, Photos, The product (Type and Strain type as one tap, Source, Country, Date tried from today), Ratings with − / +, Purchases (none opened by itself; Save asks for a missing total paid), Notes, Leafly, Private; examples from Anton's lists; Country as a list under the box (also in the Log); Name with its own heading (tried by Anton on GT Dev; holding − / + and VoiceOver not yet checked on his iPhone) | 0.70.0–0.70.2 | D81 | 2026-11-03 | 2026-11-03 |
| Small fixes on the Leaderboard, Log and Feed: "Value" and "per 20mg" in value for money, room under the +, no zeros on an empty Log, a solid comment box, 44-point post buttons, Feed photos as you scroll, tap the Feed tab again for the top and new posts, catching up when the app comes back (keyboard and Feed scrolling not yet tried on Anton's iPhone) | 0.69.9 | | 2026-11-03 | 2026-11-03 |
| Wording fixes across the app: Settings for More, Bring back, 1 product / 1 country / 1 comment, capital L for Leaderboard and Log, the badge without its colour name, Time to kick in, Pre-roll / Edible / Live rosin on screen, Current password, the Sources title, couldn’t, one dash (not yet seen on Anton's iPhone) | 0.69.8 | | 2026-11-03 | 2026-11-03 |
| Privacy and data words brought up to date: Privacy (posts), Source (brand or grower, "Followers can see this" under the box), Export / Restore / Delete lists and the Export warning, the Look pages' footnote, lines under the comment box and in the post composer, the email line (not yet seen on Anton's iPhone) | 0.69.3, 0.69.5 | | 2026-11-03 | 2026-11-03 |
| Website catch-up: what sign-up asks for, posts in the friends card, one time throughout, the video's last caption, the real address and a WhatsApp line in step 1, the price chip and share picture, 44-point top buttons, the slider's name, the laptop layout, the lost page (Anton kept "Know your plug", "Roll one up", "Made by Anton"); "Lemon Gelato" so no name is cut off | 0.69.4, 0.69.6 | | 2026-11-03 | 2026-11-03 |
| Don't lose my work: Keep editing / Discard on Cancel and swipe-back in the product, Log entry and post editors; a 20-second limit on Save and Post; no double send (checked on Anton's iPhone) | 0.69.2 | | 2026-11-03 | 2026-11-03 |
| Forgot-password safety net: "Forgot password?" on Sign in, honest words at sign-up and on the Face ID offer, "too many tries" mentions Face ID, iCloud Keychain hints at sign-up (Keychain still to try on Anton's iPhone) | 0.69.1 | | 2026-11-03 | 2026-11-03 |
| Review panel run again on 0.69.0 (app and website in one round); ten jobs on the to-do list | (notes) | | 2026-11-03 | notes only |
| Email and password: create an account with an email and password, then your @name; Face ID optional; existing accounts add both once; no more recovery codes (tried by Anton on GT Dev) | 0.69.0 | D80 | 2026-11-02 | 2026-11-03 |
| Tap a row's photo to see it full screen: the viewer with the product page's bar on your Leaderboard, Log, Archive and brand pages; a friend's shared photos with no bar | 0.68.0 | D79 | 2026-11-02 | 2026-11-02 |
| Posting: Your Leaderboard and Your Log newest first when picking what a post is about | 0.67.1 | | 2026-11-02 | 2026-11-02 |
| Posts, comments and a Feed: a Feed tab in People's place, comments and a 🔥, Leaderboard \| Posts pages; several photos a post, swiped, and the product's photo in the card (checked on Anton's iPhone on GT Dev) | 0.66.0–0.67.0 | D77, D78 | 2026-11-02 | 2026-11-02 |
| Recipes for each kind of change (`.claude/skills/`), two conversations at once, and Anton's guide `WORKFLOW.md` | (notes) | | 2026-11-02 | notes only |
| Looks and colour sets without a database change (nothing on screen changes) | 0.65.0 | D76 | 2026-11-02 | 2026-11-02 |
| A faster way of working: Claude merges and releases small changes itself; a 2-minute quick check, a 5-minute full check on six machines shared by time | (0.64.3) | D75 | 2026-11-02 | 2026-11-02 |
| Their look on their pages: a friend's board, product and brand pages in their Look, top and colours, fading in | 0.64.0 | D74 | 2026-10-31 | 2026-11-01 |
| The Look page in two sections: Dark mode (moon) and Light mode (sun) | 0.63.0 | D73 | 2026-10-29 | 2026-10-30 |
| Three light looks: Daylight Mint, Daylight Pearl, Daylight Sky (light cards; everyone starts dark) | 0.62.0 | D72 | 2026-10-29 | 2026-10-30 |
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
