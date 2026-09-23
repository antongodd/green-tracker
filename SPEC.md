# Green Tracker — Living Spec

The project's single source of truth: what has been built, every decision, and
a changelog. Updated with every change. Behaviour is defined by
`green-tracker-rebuild-brief.md` and look/feel by `green-tracker-design-brief.md`;
this document records how they were implemented and every decision made on top.

**Current version:** 0.1.0 (Phase 0 — foundations)

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
| Tests | Vitest (domain), @cloudflare/vitest-pool-workers (API, from Phase 2), Playwright (e2e/visual) |
| Version | `package.json` version + short commit, injected at build (`__APP_VERSION__`), served at `/api/version` and shown on About |

### Commands

| | |
|---|---|
| `npm test` | Domain unit tests |
| `npm run typecheck` | TypeScript |
| `npm run dev` | Local dev (Vite + Worker in workerd) |
| `npm run db:migrate:local` | Apply migrations to the local D1 |
| `npm run deploy` | Build, apply remote migrations, deploy (needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) |

## 2. Build phases

| # | Phase | Status |
|---|---|---|
| 0 | Foundations: scaffold, schema, domain module + tests, spec | **Done** |
| 1 | Design checkpoint: mockups at 390px for owner approval | Next |
| 2 | Accounts: passkeys, recovery codes, sessions, rate limits | |
| 3 | Products: editor, profile, archive, private | |
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
| D9 | Country list drafted in `shared/domain/countries.ts` (90 countries + Other) — **awaiting owner review of the list itself.** | |
| D10 | The owner tests on a real iPhone (installed to the Home Screen). This environment only has Chromium. | |
| D11 | Web address — **pending.** Passkeys are bound to it; settle it before real accounts exist. | |

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
- **Export/restore run in the browser.** The Workers free plan allows ~10ms CPU
  per request, too little to build a JSON with embedded photos on the server.
  Restore uploads photos first, then replaces data in one D1 batch; photos
  orphaned by a failed restore are cleaned up.

## 5. Open questions for the owner

1. Web address (D11).
2. Country list review (D9).
3. With Source now visible to followers (D1): should a followed person's
   Leaderboard rows show **Source** on the metadata line? The design brief
   (§9, written before D1) says follower rows have no metadata line.
4. Edible per-mg prices are shown to 2dp (brief §9), so a very cheap edible
   (e.g. £0.004/mg) would display as `£0.00/mg`. Keep, or allow more decimals
   for sub-penny values?

## 6. Changelog

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
