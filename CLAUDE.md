# Working on Green Tracker

Read this whole file before doing anything else, then follow the `start` recipe (see "The recipes"). **Keep it up
to date:** when the way we work changes (a new rule from Anton, a new lesson, a new site or setting), update this
file (and the recipes it touches) in the same pull request.

## Who and what

- **Anton** owns the app and isn't a developer: explain things plainly, without jargon.
- **Green Tracker**: Cloudflare Workers + D1 + R2, Hono server, Preact client, TypeScript.
- **SPEC.md is the source of truth**: §4 implementation notes, the decisions table (D1–D80 so far), the changelog.
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
- **SPEC.md:** a changelog entry for every app change. A big change also gets a decision (next is D81) and its §4
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
- Reopen any decision D1–D80.
- Loosen how passwords are kept or checked (D80, `server/lib/password.ts`): only a salted PBKDF2 hash, the same answer
  for a wrong password and an unknown email, the per-email and per-account limits; the email is never shown to anyone
  else.
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
- Late loads (D55): a new way to change a product on the client calls `changing(id)` (`client/src/products.ts`) as it
  starts, so an older `fetchProduct` can't put the old version back. Test it like `staleload.spec.ts`: hold the GET
  with `route.fetch()`, make the change, then release it.

## Where things stand

Keep this short and current. **Read the to-do list to Anton at the start of each conversation** and keep it updated:
when an item is merged into `dev`, mark it **on dev** (with the version and date); when it goes live, move it to
**Done** with both dates. A new item Anton asks for goes on the list in the same pull request as other notes, or in a
small notes-only one. The "Green Tracker to-do list" conversation answers Anton's questions about the list from this
section, so it must always be current.

- **Live:** 0.69.2 (2026-11-03): everything up to don't lose my work (to-do item 2).
- **Dev:** 0.69.2, the same as live.

### To-do list (suggested order; Anton decides)

From the review panel of 2026-11-03 (`reviews/2026-11-03/summary.md`; Anton wants all ten, order left to Claude).
Each is a job for its own conversation; the summary lists what each covers.

1. ~~Forgot-password safety net~~: live in 0.69.1 (see Done). Numbers stay as they are, so "Job 2" and the rest
   keep naming the same job.
2. ~~Don't lose my work~~: live in 0.69.2 (see Done).
3. **Privacy and data words that are out of date** (small, words only). Privacy page (posts), Source ("the brand or
   grower"), "Followers can see this" under Source; Export, Restore and Delete lists and the Export warning; the Look
   pages' footnote (D74); lines under the comment box and in the composer; the sign-up email line.
4. **Small fixes on the Leaderboard, Log and Feed** (small). Value for money ("per 20mg", "Value" not "VFM"); room
   under the +; no zeros on an empty Log; the first comment hidden under the comment box; 44-point post buttons;
   Feed photos load as you scroll, tapping the tab again refreshes, reload on coming back.
5. **Wording fixes across the app** (small). The proof-reader's table ("More" → "Settings", plurals, capitals,
   colour names in the badge, type names, archive messages, Current password).
6. **Website catch-up** (small; the hero picture is some work). Say what sign-up asks for (never "no email"); the
   Feed in the friends card; one time throughout; the video's last caption; the real address; the price chip and
   share picture; WhatsApp line, laptop layout, button sizes, slider name, 404. Anton decides "Know your plug",
   "Roll one up", "Made by Anton".
7. **Trust basics for strangers** (big). 18+ tick, a privacy page and terms with a contact address, a Report button
   on posts, comments and profiles, a per-account photo limit, a Cloudflare billing alert. Anton decides first
   (contact address; 18+ on the website reopens D63; Ofcom and ICO checkers).
8. **Friends: you against them, and inviting someone** (big). "You rated this 9.1" on a friend's product and on post
   cards; an "Invite a friend / share my @name" button.
9. **Sign-in hardening** (big). Count only wrong passwords per email (needs Anton's OK: D80 limits); ask for the
   password before adding Face ID; show passkeys after a password change; tests. Anton decides whether Face ID may
   set a new password without the old one (changes D80).
10. **A quicker add-a-product form** (big, mockups first). Photos first, extra details folded away, − / + by scores.
11. **Forgot password by email, and checking the email is real** (later; Anton, 2026-11-02). Both need the app to send
   email: a web address of Anton's linked to Cloudflare, or an email service. Until then, a forgotten password with no
   Face ID can't be recovered. Would also stop sign-up showing whether an email has an account (panel, 2026-11-03).

### Done (newest first)

| Item | Version | Decision | On dev | Live |
|---|---|---|---|---|
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
