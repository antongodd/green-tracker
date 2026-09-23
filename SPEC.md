# Green Tracker — Living Spec

The project's single source of truth: what has been built, every decision, and
a changelog. Updated with every change. Behaviour is defined by
`green-tracker-rebuild-brief.md` and look/feel by `green-tracker-design-brief.md`;
this document records how they were implemented and every decision made on top.

**Current version:** 0.2.0 (Phase 2 — accounts)

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
| `npm run deploy` | Build, apply remote migrations, deploy (needs `CLOUDFLARE_API_TOKEN` in the environment; the account ID is in `wrangler.jsonc`) |
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
| 3 | Products: editor, profile, archive, private | Next |
| 4 | Leaderboard: ranking, filter, Rank by, tiles, empty states, scroll return | |
| 5 | Photos: upload, thumbnails, authorised serving, viewer, cropper | |
| 6 | Log: loose entries, projections, grouping, promotion | |
| 7 | Social: follows, requests, blocks, search, follower view, privacy suite | |
| 8 | Data & account: export, restore, delete account, More/About | |
| 9 | PWA & hardening: manifest, service worker, offline, a11y, production deploy | |

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
| D8 | **Thumbnails (scope addition, approved):** a ~320px thumbnail is generated in the browser on upload and on every crop, stored alongside the cropped image and original. Lists use thumbnails. | One more R2 object per photo. |
| D9 | Country list in `shared/domain/countries.ts` (90 countries + Other) — **approved as drafted** (2026-09-23). | |
| D10 | The owner tests on a real iPhone (installed to the Home Screen). This environment only has Chromium. | |
| D11 | Web address: **`green-tracker.green-tracker.workers.dev`** (2026-09-23). | This is the passkey relying-party ID. Changing it later invalidates every passkey (accounts would need recovery codes). |
| D12 | **A followed person's Leaderboard rows show Source** on the metadata line (2026-09-23). Overrides design brief §9 ("no metadata line"). | Follower rows: Source only — never price. No date-tried fallback (D3 hides it), so no Source → no metadata line. |
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
| — | Widest control pair at 375px to be measured in Phase 4; abbreviate only what doesn't fit. |

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
- **Photos in R2** are keyed `u/<user>/<photo>/{original,cropped,thumb}.jpg`,
  independent of the parent record. Promotion re-assigns a photo with a single
  row update inside one D1 batch — atomic, no R2 operation.
- **Photo caching:** served with `Cache-Control: private, no-cache` + ETag, so a
  revoked follower's device can't keep showing cached photos.
- **Deployment.** The Vite Cloudflare plugin writes the deployable config to
  `dist/green_tracker/wrangler.json`; deploy scripts pass it with `--config`
  (the plugin's redirect file lands under `client/` because Vite's root is
  `client`). The cloud build environment's proxy replaces the short-lived JWT
  that the Workers static-assets upload uses with the API token, so that upload
  fails with 401. There, `deploy:embedded` bundles the built client into the
  Worker with the same routing (`/api/*` → API, exact file, else `index.html`;
  hashed `/assets/*` cached immutably). Same Worker, same bindings. A normal
  machine or CI should use `npm run deploy`.
- **Accounts (Phase 2).**
  - *Sign-up* is username → passkey → recovery codes. The username rides on the
    server-side WebAuthn challenge; the user row, first passkey and codes are
    written in one D1 batch only after the passkey verifies, so an abandoned
    sign-up leaves nothing behind. A name taken in between gets `username_taken`.
  - *Passkeys* are discoverable (resident) credentials with user verification
    required; sign-in needs no username. ES256 and RS256 accepted, attestation
    `none`. RP ID and origin come from `RP_ID` / `ORIGIN` vars (D11). Challenges
    are single use and expire after 5 minutes. More than one passkey per
    account; the **last passkey can't be removed** (refused with a message).
    Passkey names are the device family from the User-Agent (iPhone, Mac…).
  - *Recovery codes*: 10 codes of 8 characters from a 31-symbol alphabet with no
    look-alikes (0/O, 1/I/L), shown as `XXXX-XXXX` (~40 bits each). Stored as
    SHA-256 of user ID + code. Input ignores case, spaces and dashes. A wrong
    code and an unknown username give the same answer. Using a code opens a
    session that can only add a passkey or sign out until it has one (D4);
    every other API returns `needs_passkey`. Regenerating replaces the set.
  - *Sessions*: 256-bit random token in an `HttpOnly; SameSite=Lax` cookie
    (`Secure` on https), only its SHA-256 stored. 60 days, sliding: using the
    app on any day pushes expiry back to 60 days. Sign out deletes the row;
    sign out everywhere deletes all of the user's rows.
  - *Request safety*: every non-GET API request must carry `Origin` equal to
    `ORIGIN` (CSRF). API responses are `Cache-Control: no-store`. Errors are
    `{ error, message }` with the message written to show as-is; server logs
    record only method, route and error type.
  - *Rate limits* (fixed windows in D1, IP stored hashed): sign-up 10/hour per
    IP; passkey sign-in 60/10 min per IP; recovery 10/hour per IP and 5/hour per
    username; username checks 120/10 min per IP. Old windows are pruned lazily.
  - *Client*: Preact with a tiny history router. Signed-out paths are `/signin`,
    `/signup`, `/recover`. Leaderboard, Log and People show "on its way" cards
    until their phases. More has Account (username, passkeys, recovery codes,
    sign out, sign out everywhere) and About (version). Recovery codes can be
    copied or saved (share sheet → Save to Files on iPhone, download elsewhere).
- **Export/restore run in the browser.** The Workers free plan allows ~10ms CPU
  per request, too little to build a JSON with embedded photos on the server.
  Restore uploads photos first, then replaces data in one D1 batch; photos
  orphaned by a failed restore are cleaned up.

## 5. Open questions for the owner

None.

## 6. Changelog

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
