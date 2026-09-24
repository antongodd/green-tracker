# Green Tracker — Living Spec

The project's single source of truth: what has been built, every decision, and
a changelog. Updated with every change. Behaviour is defined by
`green-tracker-rebuild-brief.md` and look/feel by `green-tracker-design-brief.md`;
this document records how they were implemented and every decision made on top.

**Current version:** 0.9.1 (all phases done; automatic deploys)

---

## 1. Tech stack

| Area | Choice |
|---|---|
| Hosting | Cloudflare Workers (app + API via static assets), D1, R2 |
| Language | TypeScript throughout |
| Server | Hono (`server/`) |
| Database | Plain SQL, wrangler D1 migrations (`migrations/`) |
| Front end | Preact + Vite (`client/`), plain CSS with the design-brief tokens |
| Passkeys | @simplewebauthn (Phase 2) |
| Shared rules | `shared/domain/` — pure functions used by server and client |
| Tests | Vitest: `domain` project (pure rules) and `api` project (the real Worker in workerd via `wrangler dev`, fresh local D1, a software passkey). Playwright e2e against the built app with Chromium's virtual authenticator |
| Version | `package.json` version + short commit, injected at build (`__APP_VERSION__`), served at `/api/version` and shown on About |

### Commands

| | |
|---|---|
| `npm test` | Domain and API tests |
| `npm run test:e2e` | Build, then Playwright end-to-end tests at 390×844 (set `PW_CHROMIUM` to use a preinstalled Chromium). Screens are saved to `.playwright/screens/` |
| `npm run typecheck` | TypeScript |
| `npm run dev` | Local dev (Vite + Worker in workerd). Copy `.dev.vars.example` to `.dev.vars` first so passkeys bind to localhost |
| `npm run db:migrate:local` | Apply migrations to the local D1 |
| `npm run deploy` | Build, apply remote migrations, deploy — normally run by GitHub Actions on every push to `main` (needs `CLOUDFLARE_API_TOKEN` in the environment; the account ID is in `wrangler.jsonc`) |
| `npm run deploy:embedded` | Same, but embeds the client files in the Worker instead of using Workers static assets. For the cloud build environment, whose proxy breaks the assets upload (see §4, Deployment) |

### Cloudflare resources

| Resource | Name | ID |
|---|---|---|
| Worker | `green-tracker` | https://green-tracker.green-tracker.workers.dev |
| D1 (WEUR) | `green-tracker` | `0cb063fc-ce0e-4f8f-a7b1-0354e47b325f` |
| R2 | `green-tracker-photos` | |

## 2. Build phases

| # | Phase | Status |
|---|---|---|
| 0 | Foundations: scaffold, schema, domain module + tests, spec | **Done** |
| 1 | Design checkpoint: mockups at 390px for owner approval | **Done** |
| 2 | Accounts: passkeys, recovery codes, sessions, rate limits | **Done** |
| 3 | Products: editor, profile, archive, private | **Done** |
| 4 | Leaderboard: ranking, filter, Rank by, tiles, empty states, scroll return | **Done** |
| 5 | Photos: upload, thumbnails, authorised serving, viewer, cropper | **Done** |
| 6 | Log: loose entries, projections, grouping, promotion | **Done** |
| 7 | Social: follows, requests, blocks, search, follower view, privacy suite | **Done** |
| 8 | Data & account: export, restore, delete account, More/About | **Done** |
| 9 | PWA & hardening: manifest, service worker, offline, a11y, production deploy | **Done** |

## 3. Owner decisions (on top of the briefs)

Recorded 2026-09-23 in answer to the Phase-0 questions.

| # | Decision | Effect |
|---|---|---|
| D1 | **Followers see Source.** This overrides rebuild brief §5, which listed Source as never visible. | Source is included in follower responses. |
| D2 | **Followers never see Supplier** (per purchase), nor anything else from purchases. | Supplier stays out of follower responses; enforced by a field allow-list and tested on the raw response. |
| D3 | **Date tried is hidden from followers** (brief §16.1 assumption confirmed). | Followers' tie-break still uses it on the server, but the value is never sent. *(Implementation note for Phase 7: the follower's client can't tie-break on a field it doesn't have, so the server sends follower lists pre-ordered or with an opaque tie-break rank.)* |
| D4 | Username-only accounts, no email. Recovery = **10 single-use codes** shown once at sign-up. Using one signs in and asks for a new passkey straight away. Regenerating codes cancels the old set. More than one passkey per account. | |
| D5 | Filter and Rank by stored **per device** (localStorage), not synced. | |
| D6 | Navigation: **4 tabs** — Leaderboard, Log, People (with pending-requests badge), More. | |
| D7 | Usernames: 3–20 characters, `a–z 0–9 _`, shown as typed, unique case-insensitively. | |
| D8 | **Thumbnails (scope addition, approved):** a ~320px thumbnail is generated in the browser on upload and on every crop, stored alongside the cropped image and original. Lists use thumbnails. | One more R2 object per photo. See §4 *Photos*. |
| D9 | Country list in `shared/domain/countries.ts` (90 countries + Other) — **approved as drafted** (2026-09-23). | |
| D10 | The owner tests on a real iPhone (installed to the Home Screen). This environment only has Chromium. | |
| D11 | Web address: **`green-tracker.green-tracker.workers.dev`** (2026-09-23). | This is the passkey relying-party ID. Changing it later invalidates every passkey (accounts would need recovery codes). |
| D12 | **A followed person's Leaderboard rows show Source** on the metadata line (2026-09-23). Overrides design brief §9 ("no metadata line"). | Follower rows: Source only — never price. No date-tried fallback (D3 hides it), so no Source → no metadata line. |
| D14 | **Date tried starts empty** on a new product (2026-09-23). | Undated products sort after dated ones in ties. |
| D15 | **A new purchase's date defaults to today**, editable (2026-09-23). | |
| D13 | **Edible per-mg prices stay at 2dp** (2026-09-23), so a very cheap edible can read `£0.00/mg`. Accepted. | Ranking and VFM still use full precision. |

### Design approvals (Phase 1, 2026-09-23)

Mockups: `design/mockups.html` (https://claude.ai/artifact/33Y3cGCk8u6Kos1u1ht6Hx).

| # | Decision |
|---|---|
| P1 | Tab bar icons: podium (Leaderboard), notebook (Log), two people (People), three dots (More). Pending-request count on People. |
| P2 | Strain tags **UPPERCASE** (INDICA / SATIVA / HYBRID), 11px semibold, +0.06em tracking. |
| P3 | Floating + bottom-right above the tab bar on your Leaderboard and Log; never on someone else's. |
| P4 | Control row sticky under the header; Log country headers sticky within their group. |
| P5 | Editors: fixed Save bar replaces the tab bar; Cancel top-left. |
| P6 | People: search, then Requests · Followers · Following segmented control; row actions via ⋯ → action sheet → confirmation. No swipe. |
| P7 | Archive: Un-archive button per row. No swipe. |
| P8 | Photo viewer: swipe between a product's photos. |
| P9 | Sign-in tagline: "Rate, rank and remember everything you've tried." |
| — | Widest control pair at 375px measured in Phase 4 — see §4 *Leaderboard*. |

## 4. Implementation decisions

- **One type definition.** `shared/domain/productTypes.ts` declares each type once
  (label, rating set with weights, unit, icon, filter emoji, free-text, sub-types).
  Filter options, Rank by options, denominators, units, TOTAL rules and editor
  text are derived from it. Tests fail if a declaration is incomplete.
- **Weighted mean.** Edibles use weights Taste 1, High 2 (identical to ⅓/⅔ without
  floating thirds). Weight 0 = rated but not in Overall (High elsewhere).
- **Ratings table.** One row per rated category. Rows for categories outside the
  current type are kept and ignored, so a type switch never loses ratings.
- **Rank by "All" union order** uses the canonical category order
  (Look, Consistency, Smell, Taste, Burn, High).
- **Tie-break after date tried:** undated after dated, then name
  (case-insensitive), then id — so the order is always stable.
- **Latest purchase:** newest by date; undated purchases count as oldest; same
  date → the later-entered one (`seq`).
- **Headline price** comes from the latest purchase only. If that purchase has no
  amount there is no headline price (and no VFM) — no fallback to an older one.
- **VFM display:** 2 decimal places (`7.00`, `1.60`).
- **Amounts** display up to 2dp with trailing zeros dropped (`3.5g`, `100mg`).
- **Auto-capitalisation:** a first character whose uppercase isn't a single
  character (e.g. `ß` → `SS`) is left alone, so it can only ever add a capital.
- **Leafly link:** stored exactly as typed. When opening, anything not starting
  `http://` or `https://` gets `https://` prepended — which also means a typed
  `javascript:` link can never run.
- **Photos (Phase 5).** *(Replaces the Phase-0 note on photo keys.)*
  - *All image work is in the browser*: resize to 1600px long edge at JPEG 0.82;
    crops are rendered from the stored original (never a crop of a crop); the
    thumbnail (D8) is ~320px on the short edge. Drawing an `<img>` to a canvas
    applies EXIF orientation, so stored images are upright. The server only stores
    and serves files (the free plan's CPU budget can't process images).
  - *Image sets*: every version is an immutable set of R2 objects at
    `u/<user>/s/<set>/{original,cropped,thumb}.jpg`. A new photo's set holds all
    three; a re-crop's set holds cropped + thumb and the photo keeps its
    `original_set`. The photo row points at its current `image_set`, which is also
    the ETag and the `?v=` in image URLs, so a crop is a new URL.
  - *Upload first, commit on Save*: the editor uploads new photos and crops at once
    as pending sets (`uploads` table); Save attaches them in the same D1 batch as
    the rest of the product. Cancel, leaving the editor, removing a new photo or
    re-cropping it again discards pending sets immediately; any left over are swept
    after a day. Files a save makes unused (old crops, removed photos) are deleted
    only after the batch commits. Promotion (Phase 6) will just re-point `log_entry_id`
    → `product_id` on the row.
  - *Where a crop is saved* (brief §11): from the profile or its viewer → at once
    (`POST /api/photos/:id/crop`); from the editor or its viewer → on Save, with the
    viewer showing the unsaved crop; Cancel discards it.
  - *Serving*: `GET /api/photos/:id/{thumb|cropped|original}` for signed-in owners
    only (followers: cropped/thumb of visible products, Phase 7), with
    `Cache-Control: private, no-cache` and an ETag, so phones revalidate (cheap 304s)
    and revoked access can't keep showing cached photos. Uploads must be JPEG
    (checked by signature), ≤ 8MB per image and ≤ 1MB per thumbnail.
  - *Removing photos* happens in the editor (viewer → Remove photo), applied on Save
    *(builder: the brief doesn't mention deletion)*. There's no reordering: photos
    keep the order they were added, and the first is the hero and list thumbnail
    *(builder; can be added if wanted)*.
  - *Viewer*: full-bleed black over header and tabs, close top-left, swipe between
    photos (P8, native scroll-snap), `n / N` counter, Crop this photo. *Cropper*:
    Cancel · Free | Square · Apply, corner handles with 44px touch areas, drag to
    move, dimmed surround, Reset to original (→ no crop).
- **The Log (Phase 6).**
  - *Two kinds of row*: product rows are drawn from your non-archived products when
    the Log renders (never stored copies), next to loose entries. Grouping, order
    and tiles come from `shared/domain/log.ts` (tested since Phase 0).
  - *Loose entries* (`shared/domain/logEntry.ts`): name, type (+ concentrate type,
    Other pattern), country, amount, one photo. Validation reuses the product
    validator for the shared fields, so the rules can't drift. Hard delete behind a
    confirmation removes the photo files too.
  - *Rows*: product rows show the type mark (= has a full profile) and open the
    profile; loose rows have no mark and open the entry editor; the whole row is the
    tap target. The thumbnail shows the photo, else the type mark (both kinds).
  - *The Type filter is the one stored setting shared with the Leaderboard*;
    changing it on the Log may drop the Leaderboard's Rank by back to Overall if the
    new type lacks it (same fallback rule). Tiles `0 / 0 / 0g` show even when empty.
    Country headers are sticky (P4). Empty Log and filtered-empty cards *(builder
    copy)*. Returning from a row lands on it (same mechanism as the Leaderboard).
  - *A profile opened from the Log returns to the Log*, with the Log tab active.
  - *Promotion*: "Add to leaderboard" (saved entries only) commits nothing. It hands
    the entry's **live** form — unsaved edits and any pending photo upload included —
    to the product editor, pre-filling name, country, photo, product type and
    concentrate type; the amount is dropped. Cancel asks **Keep editing / Discard**;
    Discard returns to the entry, untouched. Save calls `POST /api/log/:id/promote`,
    which in one D1 batch creates the product, re-points the entry's photo to it
    (same row and files — moved, not copied, original included) and deletes the
    entry. Afterwards Back goes to the Log, not the deleted entry. Reloading the
    promotion screen (nothing to promote) returns to the entry *(builder)*.
- **People and following (Phase 7).**
  - *One access rule* (`server/lib/social.ts` `canView`): an **approved** follow and
    no block either way, checked on every request — so a pending request grants
    nothing, and unfollow / removal / block end access immediately.
  - *What crosses accounts* (`shared/domain/social.ts` `SharedProduct`): built
    field by field from an allow-list, never by copying the product and deleting
    fields. Identity (name, strain type, product type, concentrate type — only for
    concentrates, country), the ratings **in the product's current set** (a hidden
    Consistency from an earlier type is not sent), hit time (edibles), photo ids and
    versions, and **Source** (D1). Never: prices, purchases, amounts, suppliers, VFM,
    notes, date tried, Leafly, private/archived flags, the Log. Private and archived
    products are left out entirely (list, tiles, counts, photos).
  - *Date tried stays hidden (D3)*: the server orders the follower's list by the
    owner's tie-break (most recent date tried, undated last, name) and sends only
    that position as `tieRank`; the shared ranking code uses it for ties.
  - *Photos for followers*: cropped and thumb only, only for products that are
    neither private nor archived, only while `canView` holds. Originals, Log photos
    and everything else → **403**, identical whether or not the photo exists (so the
    reply can't be used to probe). The owner of a deleted photo also gets 403.
  - *Non-followers* get `{ username, relation }` and nothing else. Someone who has
    blocked you is indistinguishable from a username that doesn't exist (404).
  - *Search*: usernames, case-insensitive, at least 2 characters, prefix matches
    first, `_` and `%` taken literally, 20 results, blocked people hidden both ways,
    rate-limited (120 per 10 min per user).
  - *Block*: removes follows and pending requests both ways; the blocked person
    can't find, view or request the blocker and isn't told; undone from More →
    Blocked people. Decline is silent. Following is one-way.
  - *Screens* (P6): People has search, then Requests (badge, same count as the tab
    badge) · Followers · Following; ⋯ opens a sheet (View leaderboard, Follow back,
    Remove follower, Unfollow / Cancel request, Block), each destructive choice
    confirmed. `/u/<username>` is their read-only Leaderboard with `@username` in the
    header, Rank by without Price/VFM, PRODUCTS and AVERAGE tiles only, Source-only
    metadata (D12), no + button, no locks; or, if you don't follow them, just the
    username, a Follow / Requested button and "Follow to see their leaderboard."
    Their product profile shows hero, ratings, hit time, photos (viewer without
    crop) and details (strain, type, concentrate type, country, Source).
  - *Their Rank by is stored separately* (`gt.view.others`), so looking at a friend
    never resets your own price ranking; the Type filter stays shared.
  - *Routes*: individual people live under `/api/people/u/<username>`, so no
    username can collide with the list routes.
  - *Test servers* raise the sign-up rate limit with `SIGNUP_LIMIT_PER_HOUR`; a test
    fails if it ever appears in `wrangler.jsonc` (production stays at 10 an hour).
- **Your data and account (Phase 8).**
  - *Export* (`client/src/backup.ts`) runs in the browser from the ordinary read
    APIs: every product (archived too) with all stored ratings (hidden categories
    included), purchases in entry order, notes, Leafly, flags and creation time; every
    Log entry; every photo as base64 JPEG, cropped **and** original, with its crop.
    Not included: follows, followers, requests, blocks, passkeys, recovery codes, view
    settings. One `.json` file named `green-tracker-<username>-<date>.json`, handed to
    the share sheet on iPhone (Save to Files / iCloud) or downloaded elsewhere.
  - *Restore*: the file is checked and summarised first (products, archived, Log
    entries, photos, who exported it and when) and nothing changes until a second
    confirmation. Photos upload as pending sets (thumbnails regenerated), then one
    call, `POST /api/data/restore`, validates everything with the same rules as normal
    edits and replaces all data **in one D1 batch** — all or nothing. Rows are written
    set-based with SQLite `json_each` over JSON chunks (≤ 800KB each), so the number of
    queries stays small however much there is (D1's per-request query limit couldn't
    be checked from here: its docs are blocked in the build environment). Replaced
    photo files are deleted after the commit; on any failure the uploads are discarded
    and the message says nothing changed. Social data, passkeys and sessions are
    untouched. A file from a newer app version is refused. An export can be restored
    into a different account *(builder)*.
  - *Delete account* needs the username typed **and a fresh passkey check of this
    account** (a challenge issued for the delete; sign-in challenges don't count), so
    an unlocked phone or a stolen session alone can't delete. The user row cascades to
    every table (products, ratings, purchases, Log, photos, uploads, sessions, passkeys,
    recovery codes, follows both ways, requests, blocks); then every R2 object under
    `u/<user>/` is deleted by prefix (pending uploads included). The username becomes
    free. Where supported, the browser is told the passkey is gone
    (`signalUnknownCredential`) so the device can offer to remove it.
  - *More* is grouped Account · Data · Products · About · Danger zone.

- **PWA & hardening (Phase 9).**
  - *Install*: `manifest.webmanifest` (standalone, `start_url /`, theme and
    background `#050807`), 180/192/512 PNG icons plus a maskable 512 and an SVG
    favicon, all rendered from the leaf mark by `scripts/make-icons.mjs`. iPhone:
    Safari → Share → Add to Home Screen; the status bar is `black-translucent`.
  - *Service worker* (`client/public/sw.js`, registered as `/sw.js?v=<version>`):
    on install it fetches `/`, reads the `/assets/…` files out of it and caches them
    with the manifest and icon in `gt-shell-<version>`; activation deletes every
    other cache. Pages are **network-first** (so an online launch always gets the
    newest build), hashed assets cache-first, `/api/` and photos never cached. An
    offline launch opens the cached shell.
  - *Offline*: a banner says “You’re offline — changes can’t be saved”; screens that
    can’t load show the usual “Can’t reach Green Tracker” with Try again; Save, Save to
    log and Add to leaderboard are disabled while offline. “Offline” means the browser
    says so **or** a request just failed to reach the server (onLine stays true on
    Wi-Fi with no internet); while unreachable the app checks `/api/version` every 5s
    and clears the banner by itself when the server answers. No offline editing or
    queued writes (not in the brief) *(builder)*.
  - *Security headers*: pages get a strict CSP (`default-src 'none'`, self-only
    scripts, styles, images incl. `blob:`/`data:` for the cropper, `frame-ancestors
    'none'`), `nosniff`, `Referrer-Policy: no-referrer`, a restrictive
    `Permissions-Policy`, COOP and HSTS — from `client/public/_headers`, which the
    embedded deploy also applies. API responses get `no-store`, `nosniff`,
    `no-referrer` and `default-src 'none'`.
  - *Accessibility*: axe (WCAG 2.1 A/AA) finds no violations on every screen,
    signed in and out, plus the photo viewer, cropper and empty filter. Fixes: the
    crop box is a labelled, focusable group — arrow keys move it, Shift+arrows resize;
    the sign-up step dots are a labelled image.
  - *Product saves are set-based*: ratings and purchases are written with
    `json_each` (one statement each) instead of one per row, so a product with many
    purchases stays within D1's per-request query limit.
  - *§17 checks* are all automated; one note: promotion's “forced failure mid-save”
    is covered by validation-failure rollback plus D1 batch atomicity, not by
    injecting a failure inside a batch.

- **Deployment.**
  - *Automatic* (`.github/workflows/ci.yml`): every pull request runs typecheck,
    the Vitest suites and the Playwright suite. Every push to `main` runs the same
    tests and, only if they pass, `npm run deploy` (build → remote D1 migrations →
    deploy with Workers static assets), then polls `/api/health` until the live site
    reports this exact build (`<version>+<commit>`), failing the run if it doesn't.
    Deploys run one at a time. It needs one repository secret, `CLOUDFLARE_API_TOKEN`
    (Workers Scripts edit + D1 edit on the account in `wrangler.jsonc`).
  - *Migrations run before the new code goes live*, so each migration must work
    with the previous build still running (add columns/tables; don't rename or drop
    in the same release as the code that stops using them).
  - *From the cloud build environment* use `npm run deploy:embedded`: its proxy
    rewrites the static-assets upload token, so the client files are embedded in the
    Worker instead, with the same routing and the `_headers` security headers.
  - *Rollback*: revert the commit on `main` (CI redeploys it), or in an emergency
    `npx wrangler rollback` to the previous Worker version. D1 has Time Travel for
    point-in-time restore of the database.

## 5. Open questions for the owner

None.

## 6. Changelog

### 0.9.1 — automatic deploys
- GitHub Actions: tests on every pull request; on `main`, tests → deploy → check the
  live site serves the new build. Cloudflare Workers Builds (a second, broken
  auto-deploy) turned off.
- Offline detection no longer trusts `navigator.onLine` alone (found by CI's newer
  Chromium): a failed request also counts, with a test for a browser that never
  reports going offline.

### 0.9.0 — Phase 9: PWA & hardening
- Installable app (manifest, icons, Home Screen meta), service worker with an
  offline shell, offline banner and disabled saving, security headers, keyboard
  cropping, set-based product saves.
- Found while testing: the first service-worker install didn't cache the app's
  scripts, so an offline launch right after install was blank — fixed by precaching
  the assets named in the page.
- Tests: new `quality.spec.ts` (axe on 22 screens/states, CSP violations, headers,
  manifest/icons, offline and back online), §17 re-rate scroll test, 60-purchase
  API test. Totals: 205 Vitest, 43 Playwright, run twice.

### 0.8.0 — Phase 8: your data and account
- Export (all data, photos embedded, share sheet), Restore (checked, summarised,
  confirmed, atomic), Delete account (typed username + passkey), More regrouped.
- Tests: 7 API tests that read the local database and file store directly —
  restore keeps hidden ratings, purchase order, crops, flags and dates; a bad record
  or a foreign upload changes nothing; deletion leaves no rows in any table and no
  files, frees the username, and ends every relation. Safeguards checked by
  deliberately removing them (file purge, username check, challenge check: all
  caught). 2 Playwright tests: export → change → restore → delete, and a non-export
  file refused.

### 0.7.0 — Phase 7: people and following
- Search, follow requests (badge), approve / decline, followers, following,
  remove follower, unfollow, block / unblock (More → Blocked people).
- Someone else's read-only Leaderboard and product profiles.
- Server: people routes, the single access rule, the follower allow-list, follower
  photo serving, pending-request count on `/api/auth/me`.
- Photo route: non-owners get a uniform 403 ("not authorised") for anything they
  can't see.
- Tests: 18 API privacy tests on raw responses with planted secrets (every §17
  "Accounts and social" item except account deletion, which is Phase 8), each
  safeguard checked by deliberately breaking it (notes leak, pending treated as
  approved, originals served, private shown: all caught); 6 Playwright tests with
  two people in two browsers.

### 0.6.0 — Phase 6: the Log
- Log screen: country groups (sticky headers, counts), product projections and
  loose entries interleaved, PRODUCTS / COUNTRIES / TOTAL tiles, shared Type filter,
  empty states, footnote, + button, return to the tapped row.
- Loose entry editor: Save to log, Add to leaderboard, Delete (confirmed); one photo.
- Promotion: pre-filled product editor from the live form, Keep editing / Discard,
  atomic create + photo move + entry delete.
- Tests: 9 API tests (entries, one photo, hard delete, atomic promotion, failed
  promotion changes nothing, photo removed or re-cropped during promotion,
  cross-user isolation), 4 domain tests, 7 Playwright tests on a seeded Log matching
  the approved mockup (groups, order, tiles, filter sharing, editing, deleting,
  adding, the full promotion flow).

### 0.5.0 — Phase 5: photos
- Add photos in the editor (several at once), resized in the browser; ~320px
  thumbnails; first photo is the profile hero and the Leaderboard thumbnail.
- Photo grid with crop buttons, full-screen viewer with swipe, cropper (Free /
  Square, corner handles, Reset to original). Profile crops save at once; editor
  crops and new/removed photos apply on Save and are discarded on Cancel.
- Server: migration 0003 (photos rebuilt around image sets — the table was empty;
  checked on production before migrating), pending uploads, authorised serving with
  ETags, post-commit cleanup of unused files.
- API responses keep `no-store` unless a route sets its own cache policy (photos).
- **Fixed before release:** buttons in the viewer and cropper defaulted to "submit",
  so tapping Square inside the editor saved and closed it. All overlay buttons are
  now `type="button"`, with a regression test.
- Tests: 10 API tests (serving, ETag/304, re-crop, delete, reorder, profile crop,
  single-use uploads, JPEG check, crop bounds, cross-user isolation) and a
  Playwright journey with real JPEGs checking pixel sizes (1600px, 320px, square).

### 0.4.0 — Phase 4: Leaderboard
- Rank by and Type controls (sticky, native pickers, active state, remembered per
  device, fallback to Overall), tiles over the visible rows, relabelled scores,
  three empty states, return to the tapped row, labels measured to fit.
- Header Back now goes back through history; scroll restoration is app-controlled.
- Tests: 9 Playwright tests on a seeded 16-product account covering §17's Leaderboard
  checks (podium, renumbering, tiles, TOTAL 0g for edibles, price ranking and
  relabelling, persistence, fallback, both empty states and which wins, every
  control combination at 375px, scroll return / tab switch / archived row).

### 0.3.1 — slider fix (owner report)
- **Fixed:** dragging an unrated rating slider stopped after the first step (~1.2) on
  iPhone. Cause: the unrated slider carried the class `empty`, which is also the
  empty-state card's class, so it had extra margins and padding; they vanished on the
  first value and the bar jumped out from under the finger. Replaced the native range
  with a custom slider (see §4) and prefixed its classes.
- **Fixed:** the Date tried field overflowed its card (date inputs' built-in minimum width).
- Fixed bars no longer hide what's scrolled into view (scroll padding).
- Tests: finger drag from unrated in one gesture, bar doesn't move when first rated,
  tap, vertical swipe, mouse, keyboard, hit time, date field width. Slider tests share
  one account (sign-up is rate-limited to 10 an hour).

### 0.3.0 — Phase 3: products
- Products API: create, read, update, archive / un-archive, private; owner-only.
- Product editor: Basics, Classification (Other pattern, concentrate type), Origin,
  Ratings (slider + tap-to-type + clear, per-type explanation, Rated N of N, live
  Overall), stepped hit-time picker for edibles, Purchases with live £/unit, Notes,
  Leafly link, Private; fixed Save bar; inline errors.
- Product profile: hero with Overall, price and private/archived badges; rating
  bars (High muted where it doesn't count); price history with Latest; value for
  money; notes; Leafly (View / Search, opens outside the app); details; Edit,
  Private switch, Archive with confirmation. Scroll returns after editing.
- Leaderboard (default ranking) and More → Archive with Un-archive.
- Tests: 37 unit tests and 22 API tests added (type-switch keeps ratings, purchase
  order, validation, cross-user isolation); Playwright journey through the real
  editor, profile, type switch, private, archive and restore.

### 0.2.0 — Phase 2: accounts
- Passkey sign-up (username → passkey → 10 recovery codes) and sign-in; recovery-code
  sign-in that must add a new passkey first; add/remove passkeys; regenerate codes.
- Sessions, sign out, sign out everywhere; Origin check; rate limits; `no-store`.
- App shell from the approved design: glass header and tab bar with the iPhone
  safe-area rules, sign-in, create account, recovery, More, Passkeys, Recovery codes.
- Migration 0002: sign-up username on challenges; expiry indexes.
- Tests: 26 API tests against the real Worker with a software passkey (the §17
  account and privacy checks that apply so far) and 2 Playwright journeys with a
  virtual authenticator.

### 0.1.0 — Phase 1: design checkpoint (approved)
- Owner approved P1–P9 (P2 changed to uppercase tags).
- `design/mockups.html`: 11 screens at 390×844 (Leaderboard default and filtered/ranked,
  Log, profile, edible editor, a followed person's Leaderboard, People and its row menu,
  sign in, recovery codes, More) plus empty states and a marks/tags/buttons sheet.
- First deploy to https://green-tracker.green-tracker.workers.dev (placeholder page,
  `/api/health` reaches D1). D1 and R2 created; migration 0001 applied remotely.

### 0.1.0 — Phase 0: foundations
- Project scaffold: Vite + Preact client, Hono Worker, wrangler config with D1 and R2 bindings.
- D1 schema (`migrations/0001_init.sql`): accounts, passkeys, recovery codes, sessions,
  rate limits, follows, blocks, products, ratings, purchases, log entries, photos.
- Shared domain module: product types, rating sets, Overall, Rated N of N, per-type
  editor text, hit time, derived prices, VFM, weight totals and formatting,
  auto-capitalisation, countries and flags, Leaderboard ranking / Rank by / view-state
  fallback / tiles / empty states, Log grouping and tiles, Leafly target.
- 70 unit tests covering the rebuild brief's §17 ratings, money, tiles, Leaderboard
  and Log checks, plus the auto-capitalisation table.
- `/api/version` and `/api/health`; placeholder page shows the running version.
