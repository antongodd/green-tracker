# Green Tracker — Living Spec

The project's single source of truth: what has been built, every decision, and
a changelog. Updated with every change. Behaviour is defined by
`green-tracker-rebuild-brief.md` and look/feel by `green-tracker-design-brief.md`;
this document records how they were implemented and every decision made on top.

**Current version:** 0.43.3 (all phases done; Smokes, Most used and Privacy; Smokes switched off on the live site, D46; a private dev site, D47; Leaderboard colours by score, D48, balanced as four cards, D49; Return to Log, D50)

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
| `npm run deploy:dev` | The same for the dev site (D47): builds with `CLOUDFLARE_ENV=dev`, migrates `green-tracker-dev`, deploys `green-tracker-dev`. Normally run by GitHub Actions on every push to `dev` |
| `npm run deploy:site` / `deploy:site:dev` | The website (D63): deploys `site/` to `green-tracker-site` (from `main`) or its preview `green-tracker-site-dev` (from `dev`). Normally run by GitHub Actions |
| `npm run deploy:embedded` | Same, but embeds the client files in the Worker instead of using Workers static assets. For the cloud build environment, whose proxy breaks the assets upload (see §4, Deployment) |

### Cloudflare resources

| Resource | Name | ID |
|---|---|---|
| Worker | `green-tracker` | https://green-tracker.green-tracker.workers.dev |
| D1 (WEUR) | `green-tracker` | `0cb063fc-ce0e-4f8f-a7b1-0354e47b325f` |
| R2 | `green-tracker-photos` | |
| Worker (dev site, D47) | `green-tracker-dev` | https://green-tracker-dev.green-tracker.workers.dev (Cloudflare Access: members of the owner's Cloudflare account only) |
| D1 (dev site, WEUR) | `green-tracker-dev` | `d4126bea-f68d-4c76-a44e-d5f802f4be3a` |
| R2 (dev site) | `green-tracker-dev-photos` | |
| Worker (website, D63) | `green-tracker-site` | https://green-tracker-site.green-tracker.workers.dev (files only) |
| Worker (website preview, D63) | `green-tracker-site-dev` | https://green-tracker-site-dev.green-tracker.workers.dev (Cloudflare Access, like the dev site; the lock covers Production, not "Previews only") |

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
| D1 | **Followers see Source.** This overrides rebuild brief §5, which listed Source as never visible. | Source is included in follower responses. *(Since 0.38.0 it can be switched off in Privacy, D45.)* |
| D2 | **Followers never see Supplier** (per purchase), nor anything else from purchases. | Supplier stays out of follower responses; enforced by a field allow-list and tested on the raw response. |
| D3 | **Date tried is hidden from followers** (brief §16.1 assumption confirmed). | Followers' tie-break still uses it on the server, but the value is never sent. *(Implementation note for Phase 7: the follower's client can't tie-break on a field it doesn't have, so the server sends follower lists pre-ordered or with an opaque tie-break rank.)* |
| D4 | Username-only accounts, no email. Recovery = **10 single-use codes** shown once at sign-up. Using one signs in and asks for a new passkey straight away. Regenerating codes cancels the old set. More than one passkey per account. | |
| D5 | Filter and Rank by stored **per device** (localStorage), not synced. | |
| D6 | Navigation: **4 tabs** — Leaderboard, Log, People (with pending-requests badge), More. *(Five since 0.36.0: Smokes second, D43; four again since 0.50.0, D60; five since 0.51.0: Leaderboard, Log, Sources, People, Settings, D61.)* | |
| D7 | Usernames: 3–20 characters, `a–z 0–9 _`, shown as typed, unique case-insensitively. | |
| D8 | **Thumbnails (scope addition, approved):** a ~320px thumbnail is generated in the browser on upload and on every crop, stored alongside the cropped image and original. Lists use thumbnails. | One more R2 object per photo. See §4 *Photos*. |
| D9 | Country list in `shared/domain/countries.ts` (90 countries + Other) — **approved as drafted** (2026-09-23). | |
| D10 | The owner tests on a real iPhone (installed to the Home Screen). This environment only has Chromium. | |
| D11 | Web address: **`green-tracker.green-tracker.workers.dev`** (2026-09-23). | This is the passkey relying-party ID. Changing it later invalidates every passkey (accounts would need recovery codes). |
| D12 | **A followed person's Leaderboard rows show Source** on the metadata line (2026-09-23). Overrides design brief §9 ("no metadata line"). | Follower rows: Source only — never price. No date-tried fallback (D3 hides it), so no Source → no metadata line. |
| D14 | **Date tried starts empty** on a new product (2026-09-23). | Undated products sort after dated ones in ties. |
| D15 | **A new purchase's date defaults to today**, editable (2026-09-23). | |
| D13 | **Edible per-mg prices stay at 2dp** (2026-09-23), so a very cheap edible can read `£0.00/mg`. Accepted. | Ranking and VFM still use full precision. |
| D16 | **Country uses a searchable picker with flags** (2026-09-24), in both editors. An approved exception to design brief §1.4 ("dropdowns stay native `<select>`"): iOS's native picker can't be searched. Every other picklist stays native. | Full-screen list: search (word starts, nicknames), Used section, flags, "Use '…' as Other". Stored values unchanged. See §4 *Country picker*. |
| D17 | **Stats tiles are centred with a faint green wash** (2026-09-24; option D of the tile mockups, https://claude.ai/artifact/P3hJPK4HzSXvZVUCNKxu2U). A deliberate step away from design brief §1.2 ("quiet surfaces, one accent") and §6.3 (plain `--surface-1` tiles). Applies to every tile row: your Leaderboard, the Log and a followed person's Leaderboard. | Number and label centred; each tile gets a diagonal `--accent-bright` wash (16% → 0 by 70%, the podium rows' idea in green) and a green border at 28%. Look only: no data, export or privacy change. |
| D18 | **The green look on every screen** *(glass cards since 0.54.0: D64)* (2026-09-24; option 2 "Family" of https://claude.ai/artifact/TFjtWuPaQtJpynELn6JnFK). Makes the D17 tiles part of a set instead of the odd one out. Further step away from design brief §1.2 and §3 (grey hairlines). | Every card gets a quieter version of the tile wash and a green edge; tiles stay a little stronger; section titles green; header, tab bar and Save bar lines green; the active tab sits on a green bubble (0.28.0: a glow and line instead, D35); rating bars fade green → bright green; photos get a thin green outline. Inputs, action sheets, the photo viewer and the podium metals are unchanged. See §4 *The green look*. |
| D19 | **Four podium tiers, and only rated products get one** *(three since 0.32.0: D39; replaced in 0.41.0 by colours by score, D48)* (2026-09-24; mockups https://claude.ai/artifact/6Mq7ZyrLQVQc47bDWGX1Q3 and https://claude.ai/artifact/9cSrBysZbhVgGKx8QrmjBU). Overrides rebuild brief §10.1 ("the top three are gold, silver and bronze") and design brief §3 *Podium* ("no glow"). | 1st **rainbow** (holo style, pastel, medium speed), 2nd gold, 3rd silver, 4th bronze (classic metal wash with a flowing metal edge). A shimmer sweeps down the four rows in a cascade, 1st on the same beat. Unrated products never get a tier (before, a tier went purely by position). Same on a followed person's Leaderboard. Reduce Motion keeps the colours and stops the motion. Anything for #1 beyond the row (e.g. its product page) is to be discussed later (done in D22). See §4 *Podium tiers*. |
| D20 | **Tap feel: "Lift" and "Photo grows"** (2026-09-24; interactive mockup https://claude.ai/artifact/MbxQoAaWhAjdrifnM8kdy3). Everything you can tap lifts under your finger; opening a product from a list (your Leaderboard, the Log, a friend's Leaderboard) flies the row's photo into the product's big photo, and Back flies it home. Other screen changes are unchanged, for now. | Stand-alone things grow slightly (rows 3%, buttons 3%, pills 5%, tab icons and header buttons 12%) with a soft shadow on rows; rows packed inside a card (Log, More, People, country list, action sheets) light up green instead. Reduce Motion: colour only, and products open without the flight. Needs iOS 18+ for the flight (owner on iOS 26.6.2); elsewhere it simply opens as before. See §4 *Tap feel*. |
| D21 | **Cool metals under the rainbow** *(replaced by D39 in 0.32.0: Diamond is a holo card, Gold 3rd, no Platinum or Pewter)* (2026-09-25; option C "Descending shine" with the Ice blue Diamond, https://claude.ai/artifact/H7DwUgMSVzYrmYWnKysBXc). Replaces D19's gold, silver and bronze, which looked out of place next to the green: **2nd Diamond, 3rd Platinum, 4th Pewter**, all cool tones, no gold. 1st stays the rainbow holo; the tier rules (rated only, follows filter and Rank by, friends' boards) are unchanged. | Each metal shines less than the one above: Diamond has the strongest wash and shimmer and twinkles (three glints in the row's corners, clear of all text); Platinum is medium; Pewter is calm and matte with its edge flowing at half speed. Same cascade timing. Reduce Motion: colours only, no glints. See §4 *Podium tiers*. |
| D22 | **Podium product pages** *(the top three since 0.32.0, each badge a holo card: D39; since 0.41.0 any product with a colour, D48)* (2026-09-25; "Everything" from https://claude.ai/artifact/7HHY6WSp9xCciStfcxtZqk and option B "Descending" from https://claude.ai/artifact/UcTvzvgN1rpSmdevDe5bPo). The "rainbow for #1 beyond its row" parked at D19, extended to all four places. A product in the top four carries its tier onto its own page, following **the same Type and Rank by as the Leaderboard** (so the page always matches the row you tapped, also when opened from the Log), and on a friend's product page too (their places come only from what you can see). Nothing new anywhere else (the Log stays as it is). | Descending shine, like the rows: **1st** a badge with a crown ("#1 on your Leaderboard", or "#2 in Flower", "#1 by Taste", "#3 in Flower by Taste"), a flowing rainbow photo frame, rainbow score, the name and score on the row's holo card, and one rainbow sweep across the photo as the page opens; **Diamond** all of that in ice blue plus glints; **Platinum** frame, silver score, badge; **Pewter** a calm frame (half speed) and badge. Unrated and archived products never get it. Reduce Motion: colours only. Nothing stored: no data, export or privacy change. See §4 *Podium product pages*. |
| D23 | **Profile photos** *(since 0.38.0 an owner can switch theirs off for everyone else, D45: the rule only narrows)* (2026-09-25; option A "a card for you at the top of People" and "People connected to you" from https://claude.ai/artifact/AAdP8jbTiuB4HV8jRwX9Cq). Each account can add one photo, framed by moving and zooming it inside a circle. A deliberate addition to design brief §9 (monogram avatars, "there are no profile photos"). | **Who sees it:** you; people you follow or have asked to follow (you reached out to them); your approved followers. **Never:** someone whose request you haven't approved (a request alone reveals nothing), strangers (search shows your letter, so brief §5's "username and a Follow button, nothing else" still holds for them), anyone blocked either way. Others only ever get the square crop, never the original. **Where:** your card on People; the Following, Followers and Requests lists, search results, the page of someone you don't follow yet, and next to @username at the top of a friend's Leaderboard. Everywhere else the letter stays. **Export/restore:** included (original and crop); restoring a file from before 0.17.0 leaves your photo alone. See §4 *Profile photos*. |
| D24 | **People opens on Following** (2026-09-25). The order is now Following · Followers · Requests, and People opens on Following every time the app starts, even with requests waiting (the Requests badge and the tab-bar badge show them). Within a visit it remembers the list you last chose, as before. | Look and order only; no data change. |
| D25 | **Your photo in the header** (2026-09-25; all the recommended options of https://claude.ai/artifact/KmRLwSVfdv5fmD5eJ7dMRt). A step away from design brief §6.4 / §8 ("the header holds only the title" on the main screens). | Top right on the **four main tabs only** (Leaderboard, Log, People, More; *Smokes too since 0.36.0, D43*): your profile photo in a 30px circle with a faint green edge, or your letter until you add one. Tapping it opens People with your card; on People it goes back to the top and clears the search. The title stays centred (equal side slots). Screens further in keep Back, Edit and ⋯ in their corners, and a friend's pages keep their photo beside @username. Only you see it; nothing new is stored or sent. See §4 *Your photo in the header*. |
| D26 | **Remove background** (2026-09-25; tested on the owner's iPhone with https://claude.ai/artifact/AEGTDuvTmwcJfQyVwa6Pfm, screens approved in https://claude.ai/artifact/WX3RJFQaZkFirJ1S6cjyX2). A button on a photo cuts the bud out of its background, so every photo can look consistent: only the bud, on nothing. An AI runs **on the phone** (never a web service: photos never leave it), about 4 seconds a photo on the owner's iPhone. | **Where:** a button bottom-left of every photo in the grid (Crop stays bottom-right) and **Remove background** in the viewer, above Crop this photo; product and Log entry photos, new and existing; never on a friend's photos; profile photos stay as they are. **Flow:** the first time on a phone it asks before a one-off 47 MB download; cutting out shows a green line sweeping the photo; several separate things (a bag, a lighter) → **Tap the bud** (tap more for several buds; Next); a bud lying on a tray or bag → **Not right? Tap the bud in your photo** zooms in round the tap and cuts again; **Preview** (framed and centred, as a 1st-place row) → **Apply**, saved at once from a product page, on Save from an editor. **Result:** a see-through cut-out that sits straight on rows with no box, shown whole on the product page, grid and viewer, and on the podium pages. **Undo:** the original is never changed; the viewer's **Restore background** puts the photo back exactly as it was (same crop). Crop this photo on a cut-out crops the original again (the background comes back). **Followers** see the cut-out (they only ever get the framed version; never originals). **Export/restore** keep cut-outs. See §4 *Remove background*. |
| D27 | **The Poster: a new top for product pages** (2026-09-28; option A "Poster" of https://claude.ai/artifact/AjrLHCpYjZeRS7zjxhhf8j). The first of the owner's front-end polish series. Replaces the photo box with the name and score in a card beneath it (and, on podium pages, D22's photo frame and 1st/Diamond card). | **The photo fills the top of the page** edge to edge, running up behind the glass header (about 470 points tall on the owner's iPhone; a photo is filled edge to edge, so a square one loses a little at the sides, and tapping anywhere on it, details included, opens the viewer as before). **The details sit on its bottom** over a dark fade: podium badge, the name with the big score to its right, strain tag · type · country, price, Private / Archived. A long name wraps and the poster grows. **A cut-out** floats in the upper part on a soft glow, never under the text; **no photo**: the type mark on that glow. **Podium pages:** badge and flowing score as before; instead of the frame, a **tier-coloured haze** flows through the bottom behind the details (1st and Diamond strongest, Platinum faint, Pewter calm at half speed); the tier's shimmer and one sweep cross the photo; Diamond's three glints sit in the photo. **A friend's product page** gets the same, without the price. **Photo grows** flies into the full-width photo; the details fade in once it lands. Reduce Motion: colours only. Nothing stored: no data, export or privacy change. See §4 *The Poster*. |
| D28 | **Rounded numbers** *(Unbounded since 0.54.0: D64)* (2026-09-28; option B "Rounded", decimals the same size, from https://claude.ai/artifact/VikcX3VdJjJ7X8aSqd58Uh). Second of the front-end polish series. A small, approved step away from design brief §4 (one system font for everything): the numbers get the iPhone's own rounded version of it. Still no web fonts: nothing is downloaded. | Every **score** (Leaderboard rows, yours, a friend's and the Archive; the Poster's big score), **rank number**, **stats tile** (Leaderboard, Log, a friend's), the **podium badge's #N**, the **rating values** beside the bars, **value for money** and the editor's **rating value** use SF Pro Rounded (`ui-rounded`), same size, weight and colours (podium gradients flow through them as before). Prices, amounts, dates and all words keep the usual font. On a non-Apple device the numbers look as before. No data, export or privacy change. |
| D29 | **The Aurora: depth behind every screen** *(drifting lights on the fixed background since 0.54.0: D64)* (2026-09-28; option B "Aurora", scrolling with the page, Medium, from https://claude.ai/artifact/4JBXGsJsKmN8zzGpGZ7oCB). Third of the front-end polish series. A step away from design brief §1.2 ("quiet surfaces") and §10 ("no ambient backgrounds"; the old orbs moved, these don't), and a small extension of §1 ("glass on the header and nav only"). | **Two still lights at the top of every screen** (green top-left, teal top-right) drawn on the screen itself, so they **scroll away** with the page; a **faint green haze** at the bottom that stays behind the tab bar. Every main and inner screen and the sign-in screens; full-screen overlays (viewer, cropper, Move and zoom, country picker, cut-out flow) stay black. Found while building: the sticky **Rank / Type row** and the **Log's country headers** had a solid black background that cut a band through the lights, so they're now **frosted glass** like the header (the row lighter, so the lights show through; the headers darker, for their small green titles). Nothing moves; no data, export or privacy change. |
| D30 | **Leaderboard heat: rows below the podium glow by score** *(rows 4 and down since 0.32.0: D39; rows below 8 since 0.41.0: D48)* (2026-09-29; option D "Row glow" with the "Amber → green" scale, normal size, from https://claude.ai/artifact/XChuRbt4encp1Eh5iSZ5By). Fourth of the front-end polish series. A step further from design brief §1.2 (colour reserved for meaning): here colour carries the score. The compact size shown was declined. | Rows **5 and down** glow from the right in their score's colour, with a matching edge, and the score takes the colour: **amber at 4 and below → yellow-green around 6.8 → mint at 9 and above**, blended smoothly. It follows the **ranked value** (Overall or a rating category, out of 10); **price and value for money rankings stay plain** (higher isn't better), and so do **unrated** rows. The **podium rows** are unchanged. On your Leaderboard, a friend's and the Archive; the Log has no scores. No data, export or privacy change. |
| D31 | **Podium metals glow from the right; top-four scores in colour** *(the metal glow replaced by D39 in 0.32.0; the scores still flow)* (2026-09-29; option A "Mirror" of https://claude.ai/artifact/QeQthDfqhQQtn8moTsnbVY, after the owner's screenshot showed 2nd–4th looking emptier than the heat rows below). Changes D21's metal wash (from the left) on the rows. | **Diamond, Platinum and Pewter glow from the right** in their metal colour, the same shape as the heat rows (D30), still a descending shine (glow 0.26 / 0.2 / 0.15; softer than the mockup's so the scores stay readable as the shimmer passes, measured). Flowing edges, rank numbers, glints and shimmer unchanged. **The scores on rows 1–4 flow through their tier's colours** (the owner liked this in the mockup): 1st the rainbow, the metals their lighter shades only (the darkest are too dim for text). The metals' "Overall" caption is full white on the glow. Rows only (your board and a friend's); podium product pages unchanged. No data, export or privacy change. |
| D32 | **Rating bars in the heat colours** (2026-09-29; option A "Heat" of https://claude.ai/artifact/CMnFCgkKn9pbWuLYAsGcvi). Fifth of the front-end polish series; ties the product page to the Leaderboard's colours (D30). Replaces D18's single green fill on the bars. | On a product page (yours and a friend's) each **counting** rating's bar fades from a darker shade to its **score's colour** (amber at 4 and below → yellow-green → mint at 9 and above, the same scale as the rows), and its number takes the colour. **High where it doesn't count** (flower, concentrates, pre rolls) stays grey; on **edibles** High counts, so it's coloured. **Unrated** categories keep their dash and empty track. The editor's sliders are unchanged. No data, export or privacy change. |
| D33 | **Drawings on the empty screens** (2026-09-29; option B "Drawings" of https://claude.ai/artifact/51HkyFqhtqTPX5aHCFQucK). Sixth of the front-end polish series. Replaces the faint outlined leaf of brief §6.10. | Every empty screen keeps its card and words, with a **small green line drawing** for its kind in place of the leaf: a podium (new Leaderboard), a funnel (a type filter with nothing in it: Leaderboard, Log, a friend's board), rating bars with the top one empty (ranking by a rating nothing has), a notebook (empty Log), a box (Archive), a dashed podium with an @ (a friend who's shared nothing), an inbox (no requests), people (no followers; not following anyone) and a crossed-out circle (no one blocked). **Add a product** and **Add a log entry** become the green button with a +; other buttons stay grey. The People lists and Blocked, a plain line before, get a smaller card with a short title above their sentence. Error cards stay plain. No data, export or privacy change. |
| D34 | **Editor tidy-up** (2026-09-29; option A "Slim" with Overall "Live, in the heading" of https://claude.ai/artifact/8rSPSLwqN7gEdkDT7EZnMJ). Seventh of the front-end polish series. Replaces the editor's plain captions, D18's single-green sliders and the "· Overall" count line. | Every section heading in the product and Log editors has a small outline **icon** in a soft green square (Basics pencil, Classification leaf, Origin pin, Ratings star, Purchases receipt, Photos camera, Notes note, Leafly link, Private lock, Amount scales). Ratings are **slim**: name and number on one line, a thinner full-width slider under it (about a third shorter). A counting, rated slider's fill, knob and number take the **score's colour** (D30's amber → mint); unrated stays grey with a dash; a rating that doesn't count (High on flower, concentrates, pre rolls) is grey with the note "Doesn't count towards Overall". **Overall** shows live, in its colour, at the right of the Ratings heading (a dash until something counts); the line under the sliders says only "Rated N of M". The **date boxes** draw a calendar icon on the left, inside the box; the phone's own picker still opens on a tap. The ✕ is smaller but keeps a 44px target. Hit time unchanged. No data, export or privacy change. |
| D35 | **Tab bar: outlines and a glow** (2026-09-30; option B "Glow" of https://claude.ai/artifact/YFtaLm4qrwn4thUUhWP6hb). Eighth of the front-end polish series. Keeps P1's four symbols; replaces D18's green bubble behind the active tab. | The tab bar's podium, notebook, people and dots are **slim outlines** on the tabs you're not on; the tab you're on shows its **solid** icon in green with a **soft green glow** and a **short glowing green line** under its name (no bubble). Bar, names, + button, press animation and the People badge unchanged. No data, export or privacy change. |
| D36 | **Welcome screen: "Your stash, ranked."** (2026-10-01; option A "Showcase" of https://claude.ai/artifact/WDRNbeJWAGHw7X3f8YQXCZ). Ninth of the front-end polish series. | The sign-in screen shows the leaf and **Green Tracker** small at the top, the headline **"Your stash, ranked."** ("ranked." in the green gradient), today's line, and an **example Leaderboard**: three rows fanned like cards, drawn with the real row styles (Wedding Cake 9.4 in the rainbow 1st, Gelato 41 9.1 in Diamond, Zkittlez 8.6 in its score's colour; Gold since 0.32.0, D39), captioned "Example Leaderboard", hidden from screen readers and not tappable. The three buttons are unchanged and always fit without scrolling (slimmer rows on short iPhones). Create account (all three steps), Use a recovery code and Add a new passkey get a **glowing leaf tile** above the heading; the current step glows; the username sits in a green card. How signing in works is unchanged. |
| D37 | **Loading placeholders: shimmer** (2026-10-01; option A "Shimmer" of https://claude.ai/artifact/G8GjVckCLnNnfkL2EYC1G7). Tenth and last item of the front-end polish series. | While a screen waits for its data, faint shapes laid out like it show with a soft green-white light sweeping across: the Leaderboard and a friend's board (Rank / Type, tiles, 6 rows), the Log (Type, tiles, country headings, rows), a product page (the big photo area, a card of 4 rating bars) and the People lists (3 person rows). Only after 250ms, so quick loads never flicker; still under Reduce Motion; "Loading" for screen readers; the real screen fades in where they were; an error replaces them if loading fails. No data or speed change. |
| D38 | **More screen: profile card and icon rows** (2026-10-01; option A "Profile + icons" of https://claude.ai/artifact/TFPCqT2v7ufgM37siV6Ugc). | More opens with **you**: your photo (or letter) with a green ring, **@username**, and "N products · N followers · N following"; tapping it opens People (the Username row goes). Every row has a small **tinted icon tile** like the iPhone's Settings: **Account** (Passkeys key, Recovery codes amber life ring, Blocked people), **Data** (Export and Restore teal arrows, Archive box, moved here from Products), **Sign out** and **Sign out everywhere** on their own, **Danger zone** (Delete account, red bin). The **version** moves from About → Version to a footer under the leaf ("Green Tracker 0.31.0"). Every row does what it did; the counts are your own and only you see them. |
| D39 | **A three-place podium: rainbow, Diamond, Gold** *(replaced in 0.41.0 by colours by score, D48: the rainbow and Diamond live on as colours)* (2026-10-01; option A "Holo" of https://claude.ai/artifact/48Jq2mexVCGqdiA68NFKuq, after the owner found 2nd–4th looking out of place next to the rest of the Leaderboard). Reopens D19 (four tiers), D21 (cool metals), D22 and D31 at the owner's request. | **Only 1st–3rd get special colours.** 1st stays the rainbow. **2nd Diamond** and **3rd Gold** become **holo cards like 1st**: filled edge to edge with their colours flowing under a dark layer, their edge, rank number and score flowing through them too; Diamond in ice blue and lilac and still twinkling, Gold in warm gold. The shimmer still sweeps down the three rows in a cascade. **Platinum and Pewter are gone**: **4th is an ordinary row** and glows in its score's colour like 5th and below (D30). **Product pages** of the top three take the same colours (a holo badge like the row, the haze, the flowing score; 1st and Diamond keep their sweep, Diamond its glints); a 4th-place page is ordinary. Same on a friend's board and their pages. The **welcome screen's** third example (Zkittlez 8.6) is **Gold**, so it shows the full podium. Only rated products get a place, following Type and Rank by, as before. Reduce Motion: colours only. No data, export or privacy change. See §4 *Podium tiers*. |
| D40 | **The Data screens: Export, Restore, Delete account** (2026-10-07; option A "Hero" of https://claude.ai/artifact/ALaLdz1wcErcFTDmYdnoYu, with both additions approved: a progress bar, and new headings). The last plain screens in the app. | Each screen opens with a **glowing icon tile** (teal upload, teal download, red bin), a **heading** and one sentence: **"Your data, in one file"**, **"Restore from a file"**, **"Delete @username"**. **Export:** an "In the file" card ticks off every product (archived too), the whole Log and every photo, with a grey line for what isn't included; then the button and the Save to Files advice. **Restore:** once a file is chosen, a card with its name, when and by whom, and three **tiles** (Products · Log · Photos), the archived count and what happens to your profile photo beneath; then a red-outlined Replace button and **Choose a different file**. **Delete account:** red throughout; a "What goes" card with a cross per item; a **Keep a copy? Export first ›** shortcut; the username box edges red once it matches; a Face ID symbol on the button. **Export and Restore show a progress bar** while photos are added or uploaded. What each screen does is unchanged: the same file, the same "Replace all your data?" question, the same username and passkey. No data, export or privacy change. |
| D41 | **A Log entry's own page** (2026-10-07; option C "View first" of https://claude.ai/artifact/UMyhbLBPxgj1Mj2Yi9EyRs, with the owner's changes: Edit both top right and in an Actions card like a product page, no line under Add to leaderboard, the logged date shown, Photo grows for entries; Delete entry kept, not Archive). A step away from rebuild brief §10.2 (a loose row opens the entry editor). | Tapping a loose entry in the Log opens **its page**: the Poster's top (D27) with its photo (a cut-out floats; no photo: the type's mark glows), an **In your Log** tag and the name; a **Details** card (Type, Concentrate type, Country with flag, Amount, **Logged** with the date, empty rows left out); an **Actions** card: green **Add to leaderboard** (opens the product editor filled in from the saved entry, as before), **Edit** and red **Delete entry** (asks first, as before). **Edit** is also top right. Tapping the photo opens it full screen. The form moves to /log/:id/edit; its Cancel and Save to log come back to the page, and it no longer holds Add to leaderboard or Delete entry. A **new** entry still opens straight into the form and saves back to the Log. **Photo grows** (D20): an entry with a photo flies it from its Log row into the page and home on Back, like products; without a photo it opens plainly. Offline, Add to leaderboard and Delete wait for the connection. Followers never see loose entries; no data, export or privacy change. |
| D42 | **Purchases fold into rows** (2026-10-07; option B "Rows" of https://claude.ai/artifact/1VSsTZ3mjhhq6cwCvAkezq, one open at a time, the missing-total note in amber). The product editor's Purchases card; replaces the always-open boxes. | Each purchase is a **one-line row**: its date ("No date" when empty) with a green **Latest** tag on the latest purchase (the app's own rule: newest date, then entry order, among purchases with a total paid), the amount · total paid · supplier under it, and the **price per unit** on the right in the rounded numbers (£/g, £/mg for edibles; "—" without an amount). **Tapping a row opens its four fields**, with Remove (red, bin icon) at the bottom; **one opens at a time**. The row follows what you type. **Add purchase** (a dashed green button) adds one at the bottom, open, dated today, with the cursor in Amount. A purchase with **no total paid** says "Needs a total paid to be kept" **in amber**, on its row and in its fields. A purchase that **stops the save** (a number that can't be read, a refused value) opens by itself. Nothing is saved until Save, as before. Price history, Leaderboard prices, value for money, export, restore and followers (who never see purchases) are unchanged. |
| D43 | **Smokes: a new tab for what you had, and when** *(Removed in 0.50.0, D60.)* (2026-10-08; option B "Week strip" and product-page option 1 "Smokes card" of https://claude.ai/artifact/JLzNCm46hnUNS5MCWf9MH7, with the owner's answers: named **Smokes**, second in the tab bar; each smoke holds what, when (now, changeable), how much and an Effect box to write in, for now; twice in one evening counts twice; "taken" for edibles; New Log entry from the picker; deleting a Log entry deletes its smokes). Reopens D6 (four tabs), P1 and D25 at the owner's request. Part 1 of 2: **Most used** in Rank by is Part 2; who sees what goes to a later Privacy item. | **The tab** (flame icon; your photo top right like the other main tabs): a card with the **last 7 days** as a strip (a bar per smoke, up to five, and the number; tap a day to jump to it), "N in the last 7 days" and "N this month"; then every smoke, newest first, under a frosted heading per day (Today, Yesterday, Tue 6 Oct…). A row: the photo (or type mark), the name with a **Log** chip for a Log entry, "0.3 g · effect", and the time; tap it to change or delete it. **The +** opens a picker: search, **Recent** (your last four), **Leaderboard**, **Log** (archived products are left out), and **New Log entry** (name and type, added to your Log, then on to the smoke). **The form**: When (date and time, the phone's own pickers; never a future day), How much (optional, g or mg THC; it starts with what you had last time; quick 0.2 / 0.3 / 0.5 / 1 g or 5 / 10 / 20 mg), Effect (up to 500 characters), **Add smoke**; Change goes back to the picker. **Product and Log entry pages** get a **Smokes** card (under Ratings on a product): the count in a big tile ("times smoked", "times taken" for edibles), when you last had it, your last three (tap to change), and **Add a smoke** set to this one (not on an archived product, which keeps its smokes and count). **Add to leaderboard** moves an entry's smokes to the new product in the same save; **deleting a Log entry** deletes its smokes and says how many. **Export / Restore** carry them inside each product and entry (a file from before 0.36.0 restores with none); Export's list and Delete account's "What goes" name them. **Followers never see any of it.** Times are the phone's own date and clock. A new table only (`migrations/0006_smokes.sql`). See §4 *Smokes*. |
| D44 | **Most used in Rank by** *(Removed in 0.50.0, D60.)* (2026-10-08; option C "Flame" with never-smoked "Left out" of https://claude.ai/artifact/1w5ocZnqLeudXUHW3qh7Mk). Part 2 of Smokes (D43). Only on your own Leaderboard: a friend's board doesn't offer it, at least until the Privacy settings exist (owner's answer). | **Rank by → Most used**, second after Overall under All and under each Type, ranks your products by how many times you've had them, all time (a Log entry's smokes count once it's on the Leaderboard; archived products stay off it, as before). A row shows the **Smokes flame in amber** before the count (rounded numbers) and **TIMES** under it. **Never smoked is left out**, as Price leaves out products with no purchase, and a line under the rows says how many ("2 never smoked, not shown"). **A tie goes to the higher Overall** (unrated last), then the usual order. The **top three** get the rainbow, Diamond and Gold, the number flowing through the tier's colours (the flame stays amber); rows below are plain (**no heat**: a count isn't a score out of 10). **Product pages** of the top three wear their place: "#1 by Most used", "#2 in Flower by Most used". Nothing smoked yet: "Nothing smoked yet" with **Add a smoke** and Rank by Overall. Tiles, data, export and privacy unchanged; the setting stays per device (D5). See §4 *Most used*. |
| D45 | **Privacy: choose what your followers see** *(Its three Smokes switches went with Smokes in 0.50.0, D60.)* (2026-10-08; layout B "Preview on top" of https://claude.ai/artifact/U5db1F9da2tEMW89qDvAfc, every switch the owner listed kept, "My Smokes" included and marked Not recommended; one setting for all followers; nobody is told). Narrows D1 and D23 only when switched off; D43/D44 data reaches followers only when switched on. | **More → Privacy → What followers see** (a violet eye, between Account and Data, with a summary line, e.g. "Followers see: Leaderboard, Source, Country, Photos"). The screen: a **What followers see** card on top, built by the server's own follower code, showing your top product as followers get it and what else they see, with **Open their view ›** (your board and product pages exactly as followers get them, under More); then switches that **save at once**: **Your Leaderboard** (Share my Leaderboard), **On your products** (Source, Country, Product photos), **Smokes** (How many times I've had each; Most used on my Leaderboard; My Smokes: what and when, "Not recommended"), **You** (My profile photo). **Starting point = before 0.38.0**: the first four and the profile photo on, the three Smokes switches off. A switch whose prerequisite is off is greyed and says so ("Needs … on"): everything but the profile photo needs Share my Leaderboard; Most used needs the counts. **What followers get:** Leaderboard off → no products, no pages, no photo files ("hasn't shared any products"); Source / Country off → blank; photos off → the type's mark, and the photo files refused; counts on → a Smokes card with the flame and "Smoked N times" on your product pages; Most used on → their Rank by offers it on your board (flame rows, podium badge); My Smokes on → that card lists each smoke's day, time and amount, **never the effect**, never Log entries; profile photo off → your letter for everyone else everywhere (search, lists, requests, your page). Never shared, whatever the switches: prices, purchases, suppliers, notes, date tried, Leafly, the Log, private and archived products. Strangers still get nothing. **Export / Restore** carry the settings (an older file leaves yours alone); Delete account removes them. A new table (`migrations/0007_privacy.sql`). See §4 *Privacy*. |
| D46 | **Smokes off on the live site until it's re-released** *(Removed in 0.50.0, D60.)* (2026-10-11; the owner wants live "back to how it was before" Smokes while it's rebuilt and tested, with Privacy kept). A per-site switch, not a removal: the code stays, the live site runs with it off, a test site with it on (the dev site, next). | **Where Smokes is off:** four tabs again (Leaderboard, Log, People, More); `/smokes` addresses open the Leaderboard; no Smokes card on product or Log entry pages; no Most used in Rank by (a stored Most used shows Overall but is kept for when it's back); Privacy keeps Leaderboard, Source, Country, Product photos and My profile photo but offers no Smokes switches, and More's summary leaves them out; Export, Restore and Delete account don't mention smokes. Nothing can be added, changed or deleted (the server refuses with 404). **Nothing is deleted:** smokes already saved stay, and still go into an export and come back with a restore; the three Smokes privacy switches keep what you set but count as off, so no smoke count, Most used or smoke ever reaches a follower. Deleting a Log entry still takes its (hidden) smokes with it, as before. Accounts, passkeys, followers and all other data are untouched. See §4 *Smokes switch*. |
| D47 | **A private dev site** (2026-10-11; the owner wants to test new work on their phone before anyone else sees it, then push it live when ready; a Cloudflare Access lock, live data copied in once, an orange DEV label and "GT Dev"). | **Two sites from one codebase.** *Dev*: https://green-tracker-dev.green-tracker.workers.dev — only the owner gets in (Cloudflare Access: signing in with the owner's Cloudflare account), its own database and photos (never live data), Smokes on, an orange **DEV** label after the title on every screen and the sign-in screen, called **GT Dev** on the Home Screen. *Live*: unchanged. **Flow:** work goes in by pull request to the `dev` branch ("merge" → the dev site); "go live" → a release pull request from `dev` to `main`, the same tests, then live. A release is merged with a merge commit (not squashed) so `dev` and `main` stay in step. **Data:** the owner signs up on dev (passkeys belong to one address, so a separate account) and copies their own data in with Export on live and Restore on dev; nobody else's data is on dev. See §4 *Dev site*. |
| D48 | **Leaderboard colours by score, a preset of your choice, and a crown and halo for #1** (2026-10-12; preset B "Gems" of https://claude.ai/artifact/KKHAxTqBACJsEGj2pJsBvH as where everyone starts, Prism and Metals as choices; "Crown" and "Halo" together for #1; badge "Amethyst · #3"; the owner's answers: saved to the account, the same bands everywhere, no colours for Price, Value for money and Most used, #1 still marked there in gold). Reopens D19, D21, D22, D30, D31 and D39 at the owner's request: the owner wanted more than a top three, earned by the score. | **Four bands** from the score as shown (one decimal place): **8.0–8.4** a dark row with a still coloured edge and glow; **8.5–8.9** the edge flows; **9.0–9.4** a holo card; **9.5–10** the full holo card with the shine (the old 1st place). Below 8 the heat glow (D30) as before; unrated never. Only scores out of 10 (Overall, any rating); Price, Value for money and Most used get none. **Presets** (More → **Appearance**, new, between Privacy and Data): **Gems** Emerald · Sapphire · Amethyst · Rainbow (where everyone starts), **Prism** one rainbow growing stronger, **Metals** Emerald · Rose gold · Diamond (twinkles) · Rainbow; no gold. **#1** (the top row with a value, in any ranking) wears a **gold crown** above its rank number and a **halo** round the row in its colour (gold without one), gently breathing; a switch **Mark my #1** turns both off. A **Colours** button beside Rank by (when ranking by a score) opens the key. **Product pages** of a coloured product carry it (glow, haze stronger band by band, holo badge **"Amethyst · #3 on your Leaderboard"**, the sweep from 9.0); an uncoloured #1 gets a gold badge ("#1 by Price"). The welcome screen's examples become Rainbow (crown and halo), Amethyst, Sapphire. **Saved to your account** (a new table, `migrations/0008_appearance.sql`), sent with who you are; **Export / Restore** carry it (an older file leaves yours alone); Delete account removes it. **Friends' boards** show in *your* preset; nothing about your appearance is ever sent to anyone else. Reduce Motion keeps the colours and stills them. See §4 *Leaderboard colours*. |
| D49 | **The four colours as one set of cards; Gems' Sapphire and Amethyst rebalanced** (2026-10-12; option "A + Emerald" of https://claude.ai/artifact/Wh6t4N99LszTqEc55nDM9D, after the owner's iPhone screenshot showed Amethyst as a strong purple slab next to an edge-only Sapphire). Amends D48 at the owner's request. | **Every band is a holo card** under one dark layer that thins as the score rises: **8.0–8.4** the faintest (90% → 95%), still; **8.5–8.9** faint (86% → 93%), flowing; **9.0–9.4** (80% → 90%), flowing; **9.5–10** unchanged (70% → 86%, the shine). In every preset (the steps stay the same in all three; only colours differ). **Gems:** Sapphire a brighter blue, Amethyst a softer lilac, both under near-neutral layers instead of blue and violet ones; Emerald and Rainbow unchanged. Prism and Metals keep their colours. No data, export, privacy or follower change. See §4 *Leaderboard colours*. |
| D50 | **Return to Log: a Leaderboard product can go back to being a Log entry, keeping everything else hidden** (2026-10-12; the owner put something on the Leaderboard by mistake and couldn't take it off without deleting it; option A "Kept card" of https://claude.ai/artifact/SdQCsaP7EoHJksH4PPyeDy, the button named **Return to Log**; the owner's answers: any product, not just ones that came from the Log; Add to leaderboard opens the editor filled in; the Kept card only on entries that were on the Leaderboard; Delete entry deletes the kept data too, with a warning; the amount is all its purchases added up). A step back from rebuild brief §10.2, where promotion only goes one way. | **Product page → Actions → Return to Log** (between Private and Archive; not on an archived product, which is un-archived first; waits for the connection offline) asks first ("It leaves your Leaderboard and followers' view. Its ratings, purchases, notes and photos are kept, hidden, for when you add it back."), then the product is a Log entry and its page opens (Back goes to the Log). **The entry:** its name, type, concentrate type and country; its **first photo**; as its **amount**, all its purchases' amounts added up (none with an amount → no amount); **Logged** = when the product was first added; its **smokes** (D43) go with it. **Kept, hidden:** everything else (ratings, hidden ones too; purchases; notes; source, strain, date tried, Leafly, hit time, Private; the other photos), on the entry's page as a **Kept from your Leaderboard** card (Ratings "4 · Overall 8.8", Purchases "2 · £60.00", Notes, Other photos; rows with nothing are left out). An ordinary entry has no such card. **Add to leaderboard** opens the product editor with everything kept filled back in, under the entry's own name, type, country and photo (changes made in the Log win; the entry's photo first); Save puts back **the same product** (same place in time, same purchases), smokes included. **Delete entry** says what goes too ("…What's kept from your Leaderboard goes too: 2 ratings, 1 purchase, notes and 1 other photo.") and deletes it all. While it's in the Log the product is off the Leaderboard, its tiles, the Archive and Most used; **followers** lose it and its photo files at once; nothing about it can be changed except through the entry. **Export / Restore** carry it inside the entry (an older file has none). One new column, `log_entries.kept_product_id` (`migrations/0009_return_to_log.sql`). See §4 *Return to Log*. |
| D51 | **Swapping a Log entry's photo in one edit works** (2026-10-13; a bug the owner hit, found while testing 0.43.0, on the live site too). A bug fix; no behaviour is chosen. | Replacing a Log entry's photo with a new one and saving used to fail with "Something went wrong": the save added the new photo before removing the old one, and an entry may hold only one (`photos_log_entry` is unique). **Removed photos now go first**, in the same all-or-nothing save, so a failed save still changes nothing. Product photos (no such limit) and Add to leaderboard / Return to Log (which move a photo, never doubling an entry's) weren't affected; they use the same order now. No data, export, privacy or follower change. See §4 *Photos*. |
| D52 | **Choosing the cover photo, and a tidier photo section** (2026-10-13; layout C "Even grid" of https://claude.ai/artifact/7Eo1e8aHBrWXaYm2b28GCZ, step 1 of the owner's photo rework; the owner's answers: both Set as cover and drag, saved at once from the product page, a star (not a "Cover" label), new photos at the end, removing the cover makes the next one the cover, Log entries keep one photo). Replaces §4's "no reordering" and D26's grid buttons. | **The cover is a product's first photo**, shown everywhere a product has one photo (Leaderboard rows, the Poster, the Log, tiles, followers' view, Return to Log). The Photos grid stays three even squares to a row; the cover is first, with a **gold ring and a ★**. **Product page:** tap a photo → a bar along the bottom of the viewer: **Set as cover** (saved at once: the viewer closes, the big photo fades over to the new cover, "Cover updated"; "The cover" on the first), **Crop**, **Cut out** (Restore background on a cut-out). **Editor:** **⋯** on each photo (Set as cover, Crop, Remove background, Remove photo), or **press and hold a photo and drag it**; the first is the cover; Save keeps the order, Cancel doesn't; the viewer's bar adds **Remove**. Removing the cover makes the next photo the cover; new photos go at the end. The grid's round Crop and Remove background buttons are gone. **Log entries** keep one photo: ⋯ without Set as cover, no star. **A friend's photos:** the ring and star, no ⋯, no bar. **No database change**; Export/Restore keep the order; followers see the new cover (only if photos are shared, D45). See §4 *Photos*. |
| D53 | **Zooming into a photo** (2026-10-15; option A "Clear view" of https://claude.ai/artifact/2n1jb4sYgqXX92iguZSNrc, step 2 of the owner's photo rework; the owner's earlier answers: up to 4×, double-tap for 2×, the viewer only). | In the **full-screen viewer** (your products, Log entries, friends' products, editors): **pinch** 1×–4× (the spot between the fingers stays put), **double-tap** for 2× where you tap and again to go back, **drag** to look around (the photo stops at its edges). Zoomed in, the top and the bottom bar **slide away**; a small "2.4×" shows while pinching; **one tap** brings the buttons back. **Swiping** to another photo only when zoomed right out; every photo starts at 1×. Not on the product page's big photo (a tap still opens the viewer). Zooming shows the saved photo (up to 1600px across, about its full detail at 4× on an iPhone; cut-outs are smaller, a little softer). Nothing is saved; no data, export, privacy or follower change (friends zoom only the version they already get). Reduce Motion: no glides. See §4 *Photos*. |
| D54 | **Draw round a nug in Remove background** (2026-10-16; option A "Loop" of https://claude.ai/artifact/1XApeYBHvJXjhiUEKyc5Ak, step 3 of the owner's photo rework; the owner's earlier answers: the AI cuts a clean edge inside the drawing, offered at the start and after the AI's try, several loops, Undo / Clear / Draw again, two fingers zoom, no brushes). Adds to D26; the model is unchanged. | **Remove background opens on a choice:** **Find the bud for me** (as before) or **Draw round it**. Draw a rough **loop** round each bud to keep; letting go joins it up and darkens the rest; **Undo**, **Clear**; **pinch** to zoom while drawing. **Cut out** shows the same AI only the part round the loops and drops anything outside them, so touching buds can be separated (loop through the gap); then the usual Preview → **Apply**, or **Not right? Draw again**. After the AI's own try: **Not right? Draw round it** (and "Or tap the bud in your photo"). Same results as any cut-out: the original is kept, Restore background undoes it, rows, pages, followers and Export/Restore as D26. Drawing needs a finger or mouse; Find the bud for me and Tap the bud remain for VoiceOver and keyboard. No data change. See §4 *Remove background*. |
| D55 | **A slow page load can't undo your change** (2026-10-18; found while testing 0.44.0, on the live site too; the owner asked for the fix). A bug fix; no behaviour is chosen. | Opening a product page shows the app's copy at once and asks the server for a fresh one. If you flicked **Private** or **Archive**, tapped **Set as cover**, or saved a crop or cut-out before that answer arrived, the older copy landed afterwards and put the page (and the app's memory, so Back and the Leaderboard) back as it was until the next visit; the change itself was always saved. Now an answer that started before your change is ignored. No data change. See §4 *Late loads*. |
| D56 | **Sounds and ticks** (2026-10-18; the owner's idea of 2026-10-13, tried on his iPhone with the test page https://claude.ai/artifact/UcgKz5k1uAPAhgj7zN3PR9: he chose Soft, kind of liked Woody, disliked Glassy; 60% volume about right; sounds stayed quiet on silent; the real switch and a hidden switch under his finger ticked, a switch flipped from code didn't; then the app's way (Tick D: a label in the button for a switch elsewhere, the button pressed a moment later) ticked too. His answers: subtle, only big moments, on to start, a separate Ticks switch, saved on each phone, photo deletes too, a choice of Soft or Woody). | Quiet **sounds made in code** (nothing downloaded) when you **flick a switch**, **save a product** (a short fanfare instead when that save makes it **#1** on your Leaderboard by Overall), **save a Log entry** or **Return to Log**, and **delete** a Log entry or a photo (in an editor, or your profile photo). Every other tap is silent. Quiet when the iPhone is on silent, and it doesn't pause your music. **Ticks** on iPhones with iOS 18+: a light tick as you tap a switch, Save, Save to log, Delete entry, Remove photo or Return to Log (the tick comes with the tap, so a new #1 has no tick of its own). **More → Appearance → Sounds and ticks:** **Sounds** and **Ticks** switches, both on to start, and **Soft** or **Woody** (tap to hear). Ticks is hidden where the phone can't tick. Saved **on this phone only**: no data change, nothing in Export/Restore, nothing for followers; a new phone starts with both on. Smokes (on hold) has no sounds. See §4 *Sounds and ticks*. |
| D57 | **Sounds and ticks get their own screen; a Silent test on dev** (2026-10-19; the owner tried 0.47.0 on GT Dev in the Home Screen app: sounds play and ticks work, but sounds still play on silent; and he didn't like the switches under Leaderboard colours. He picked option A of https://claude.ai/artifact/G8S2GHgowxq88SsZ95iEtF). Changes D56's place. | **More → Appearance** gains a second row, **Sounds and ticks** (On / Off), opening its own screen with the Sounds and Ticks switches and Soft or Woody; Leaderboard colours is colours only again. The Sounds note no longer promises silence on silent. On the **dev site only**, a **Silent test** card plays the save sound in each of three iPhone sound modes (Test 1 is what the app uses now) so the owner can say which stays quiet on silent; the app then uses that one and the card goes. Same settings, still saved on this phone; no data, export or follower change. See §4 *Sounds and ticks*. |
| D58 | **Sounds stay quiet on silent; the Silent test goes** (2026-10-19; the owner ran D57's Silent test on GT Dev in the Home Screen app: all three tests stayed quiet on silent, and so did the app's own sounds on 0.48.0). Completes D57. | 0.48.0 sets the iPhone's quiet-on-silent sound mode ("ambient") before every sound instead of once when the sound maker starts; that is what fixed it, so the mode stays "ambient". The dev-only Silent test card is removed, and the Sounds note says again: "Silent when your iPhone is on silent." No data, export or follower change. See §4 *Sounds and ticks screen*. |
| D59 | **Brands and suppliers** *(Its More list became the Sources tab, as cards, and a tap on a suggestion now closes the keyboard: D61. Spent here became Spent, for every name: D62.)* (2026-10-19; option A "Suggestions under the box" of https://claude.ai/artifact/NWcqS5v8Dnxu4S8Trus2yc; the owner's answers: with no brand he types the coffeeshop's name in Source; a name's page shows brand and bought-there together, tagged; both a product-page link and a More list; renaming or merging names only if needed later; archived products left out; followers can tap Source). Source (the brand) and each purchase's Supplier (where it was bought) are one list of names. | **Suggestions:** while you type in Source or a purchase's Supplier, up to 4 names you've used (in either field, on products that aren't archived) show under the box as buttons, most used first, narrowing to names whose words (or the whole name) start with what's typed; a tap fills the box and keeps the keyboard; in Supplier the product's Source comes first. **No duplicates:** capitals, accents, spaces and punctuation don't count ("barneys" = "Barney's", "Greenhouse" = "Green House"), so typing a name you use in another spelling says "Saved as “…”, the name you already use" and leaving the box saves that spelling; a new name is saved as typed, capitalised (as before). 4+ letters that match nothing but are a letter or two from a name: "Did you mean". **A name's page** (`/brands/<name>`): tap a product page's Source (Details) or a purchase's Supplier (Price history): everything with that name, as its Source and/or bought there, ranked by Overall, each tagged **Brand** / **Bought here**; tiles Products, Average and (when you bought there) **Spent here**; private products included, archived left out; older spellings of the same name are counted together. **More → Brands & suppliers** (Data, above Archive, with how many names): every name with its products, "Brand", "Shop" or "Brand and shop", and its average; Search; sort Most products, Best average, A–Z. **Followers:** your Source on your product page opens your shared products with that Source (Products, Average); never suppliers, prices or Bought here; nothing to tap when Source isn't shared (D45). Nothing new is stored: no database, export, restore or server change; what followers receive is unchanged. See §4 *Brands and suppliers*. |
| D60 | **Smokes removed** (2026-10-20; the owner: "I think there is no use for it", everything about Smokes gone, saved smokes deleted for good). Replaces D43, D44 and D46, and D45's Smokes switches. | **Gone:** the Smokes tab (four tabs again: Leaderboard, Log, People, More; `/smokes` addresses open the Leaderboard), the Smokes cards on product and Log entry pages, Most used in Rank by (a stored Most used shows Overall), the three Smokes switches in Privacy (and their lines in the preview and More's summary), smokes in Export, Restore, Delete account and the Data screens, the per-site `SMOKES` setting (dev and live are the same again apart from the DEV label) and the follower's Smokes card. **Data:** `migrations/0010_remove_smokes.sql` drops the `smokes` table and the three `privacy_settings` columns, on dev when merged and on live when released; this can't be undone. An export made before 0.50.0 still holds smokes; restoring it skips them (and the old Smokes switches). Products, Log entries, photos, ratings, purchases and followers are untouched; followers never saw smokes on live. See §4 *Smokes removed*. |
| D61 | **Sources and Settings tabs** (2026-10-20; the owner wanted Brands & suppliers easier to reach and More split out as Settings once Smokes went; option B "Cards" of https://claude.ai/artifact/Jewo7GPGQ8cFAaQdZFfofn for Sources, Settings as drawn; the sort buttons kept; the tab named Sources, the owner's choice). Changes D59's More row and list; D6's tabs. | **Tabs:** Leaderboard · Log · **Sources** (a shop front) · People · **Settings** (a gear; More renamed, its screens keep their addresses). **Sources** (`/sources`; `/more/brands` still opens it): "Brands & suppliers" with Search and the three sort buttons, then two cards a row: the photo of the name's best product (by Overall; a cut-out without its box; the type's mark without a photo), the name and its average, "N products · best: …", and Brand / Bought here; a card opens the name's page, which keeps Sources lit (from a product page, the Leaderboard). **Settings** (titled so) is More without the Brands & suppliers row. **Suggestions (D59):** a tap fills the box and closes the keyboard; Enter on a focused suggestion returns to the box. Nothing stored; no export, follower or privacy change. See §4 *Sources and Settings tabs*. |
| D62 | **What you spent on each brand and supplier; whole card photos; swiping back lands where you were** (2026-10-20; the owner's screenshot and screen recording of GT Dev 0.51.0: Sources' photos were cut off, swiping back from a brand opened from a scrolled Sources showed black and came back at the top, and he'd seen it on other screens; he asked to see what he spent at a brand or supplier; his answers: a **Most spent** sort, yes; the card wording "N products · £X spent", sure). Changes D59's Spent here tile and D61's cards. | **Spent** is everything you paid for a name's products: every purchase of a product with it as its Source, and every purchase bought there, each purchase counted once (archived products left out). **Sources cards:** "N products · £X spent", then "best: …" on its own line; a fourth sort, **Most spent** (ties A–Z). **A name's page:** a **Spent** tile for every name (it was Spent here, only for where you bought). Followers still see no prices or suppliers. **Card photos** fill their box, nothing cut off. **Back, everywhere:** every screen you leave keeps its scroll for the iPhone, so swiping back shows that screen instead of black, and coming back (swipe or the Back button) lands where you were; new screens and tab switches still start at the top. Nothing stored; no data, export, restore, follower or privacy change. See §4 *Spent, card photos and Back*. |

| D63 | **A website for the app** (2026-10-20; to-do item 5; look A "Aurora Glass" of https://claude.ai/artifact/AkwHtCE8iVw8d9yyqEK2qR; the owner's answers: for friends and anyone who finds the link, sign-up open ("Sign up free"), the free `workers.dev` address, punchy and friendly ("like a stoner wrote it"), no age or legal note, no link to it from the app; he asked for it to look really good: the app's style but glassy, futuristic, with cool animations and dark colours not only green). | **A one-page site at its own address**, https://green-tracker-site.green-tracker.workers.dev, for people who haven't got the app: the headline "Rate your stash. Remember the fire.", a floating glass iPhone with a made-up Leaderboard, four things it does (ranked top shelf, Log, Sources, mates' picks), a **Go on, rate it** slider that gives a made-up product the colours its score earns in the app (D48, D30), three steps to add it to the iPhone Home Screen in Safari, a note that Android and computers work in the browser, and **Sign up free** (the live app's sign-up). **Products shown are all made up**; nobody's data is used. **Nothing from anywhere else:** fonts (Unbounded, Manrope; SIL OFL) are stored with the site; no tracking, analytics or cookies; strict security headers. Reduce Motion: still. A link-preview picture for WhatsApp and iMessage. **Separate from the app:** its own folder (`site/`), its own Worker of files only (no code, data or accounts); the app is unchanged. **Preview:** `green-tracker-site-dev`, deployed from `dev` and locked with Cloudflare Access like the dev site; the public site is deployed from `main`, so it goes public with the next "go live". See §4 *Website*. |
| D64 | **The new look: Aurora Glass, a choice of looks and tops, two new colour sets** (2026-10-21; to-do item 4 "Leaderboard design rework, with a font and colour rework for the whole app"; mockups https://claude.ai/artifact/LJah55esqr7qtmDBxP3uzG (look A "Aurora Glass", top "Glass hero", numbers "Unbounded", colours "Aurora", all marked as the pick) and https://claude.ai/artifact/3w4fuY9qMDoCSgnc62pcvr (the rest of the app and the Appearance screen). The owner's answers: the numbers felt "too round and soft, almost like kiddy numbers"; the dark green above the Leaderboard looked out of place; rework "sort of everything"; the website's look should lead ("I want them to feel like one linking product"); every look, top and colour set as a choice in Appearance, defaulting to Aurora Glass, the glass hero and the new Aurora colours; Unbounded for the numbers; everyone switches to the defaults once; the Log's banner follows the top; built in two stages, Aurora Glass first). Amends D18, D28 and D29. | **Stage 1 (0.54.0).** **Aurora Glass** across the whole app: the website's blue-black background with **drifting green, teal and violet lights** behind every screen (still with Reduce Motion), **frosted-glass cards** with a light edge, a green-to-teal primary button, add button and switch, **Unbounded** for titles, product names and every number (scores, ranks, stats, badges, rating values, value for money), **Manrope** for words; both fonts stored with the app (no outside requests; offline too). The stats' numbers flow through lighter tints. **Settings → Appearance** gains a live **preview**, the **Look** (Aurora Glass; Neon Night, Holo Pearl and Deep Forest shown as "Coming next") and the **Top of the Leaderboard**: the **glass hero** (the average big, products and total beside it, "Your #1 · name" underneath), **three tiles**, or a **slim strip**; the Log (its hero line "Most from · country"), a friend's board ("Their #1") and a brand or supplier's page ("Best") follow it. Two new colour sets made for the look, **Aurora** (Jade, Lagoon, Violet, Aurora) and **Neon** (Lime, Electric, Hot pink, Neon), listed first and marked New; Gems, Prism and Metals stay. Settings shows Look, Leaderboard top and Leaderboard colours. **Data:** the look and top are saved to your account with the colours (a new migration rebuilds `appearance_settings`); **everyone moves once** to Aurora Glass, the glass hero and Aurora colours (Mark my #1 kept); Export and Restore carry them, and a file from before keeps working (the look and top take the defaults). A follower's board shows in the viewer's own look, top and colours, as before. **Stage 2 (to come):** Neon Night, Holo Pearl and Deep Forest. The website needs no change (it is Aurora Glass). See §4 *The new look*. |
| D65 | **The new look, stage 2: Neon Night, Holo Pearl and Deep Forest** (2026-10-21; looks B, C and D of https://claude.ai/artifact/LJah55esqr7qtmDBxP3uzG, chosen in D64 as choices in Appearance; the owner checked stage 1 on his iPhone ("looks good and works well") and said go ahead, with both extras: the phone remembers the look so the app never opens in the wrong one, and the look and the colour set stay separate). Completes D64. | The three other looks can be chosen in **Settings → Appearance** (no more "Coming next"): **Neon Night** (deep indigo, violet, pink and cyan lights, violet-tinted glass, extra-bold titles), **Holo Pearl** (near-black, calmer pastel lights, a pearly rainbow rim on the stand-out cards (the glass hero, tiles, the strip, pills, Sources cards, you in Settings, Appearance's cards), titles in **Sora**, stored with the app), **Deep Forest** (the green look from before D64, tidied, Manrope titles). Numbers stay Unbounded in every look; the colour set is chosen separately. The Home Screen app's top bar takes the look's background. **This phone remembers your look** and puts it on before anything is drawn, so a Neon Night app never shows Aurora Glass for a moment; a phone that has never signed in opens in Aurora Glass. No data change (D64's migration already allowed the looks); Export and Restore carry the look; followers see everything in their own look. The website stays Aurora Glass. See §4 *The new look*. |
| D66 | **Currencies: each purchase in the currency you paid in, compared in your main currency** (2026-10-22; to-do item 1, the owner's idea of 2026-10-20; mockups https://claude.ai/artifact/WvAYgXrygrFnMSXg6n6fPC; the owner's answers: rates **looked up for you, on the day you bought it** (option A), the Leaderboard shows the converted price with what you paid, smaller; no "type the £ from your bank statement" choice (one card payment often covers several products); the conversion line slim, without the explaining words). | **A purchase** has a currency (a picker in front of Total paid; a new purchase starts in the currency of the last one you added on this phone) and a **rate** into your main currency: the European Central Bank's rate for the purchase's day (the working day before for a weekend or holiday; today when undated), filled in and **saved with the purchase**, so it never changes by itself. Under a purchase in another currency, one slim line: **≈ £34.80 · €1 = £0.87 · Change**; Change (or a rate that couldn't be had) opens a box to type the rate; a typed rate stays when the date changes. **Your main currency** (Settings → **Money** → **Main currency**, 30 currencies, the usual five first) starts as **£**: every price shown together or compared is in it, converted with each purchase's saved rate: the Leaderboard's price (with what you paid, smaller, after it) and Price and Value for money ranking, a product page's price and value for money, Sources' and a name's page's Spent, a returned Log entry's purchases total. Where one purchase is shown on its own (Price history, the editor's rows) it shows as paid (€40.00), with what it came to and a small **€** tag. Changing the main currency works every purchase out again at its day's rate (typed rates are replaced), all at once or not at all. **Shown as:** the sign first, the currency's decimals (`£34.40`, `€40.00`, `US$12.00`, `¥5000`; per unit always 2, D13). **Rates** come from Frankfurter (free, open source, no key): the app's **first outside connection**, made by the **server only**, never your phone, sending only currencies and days; each past day's rates are kept, so a day is asked for once; if it can't answer, the app asks you to type the rate (a main-currency change or a restore that needs one changes nothing). **Data:** every existing purchase becomes £ at rate 1 (nothing on screen changes); a new migration (columns on `purchases`, `money_settings`, `fx_rates`). **Export and Restore** carry each purchase's currency and rate and your main currency; a file from before is all £ (into another main currency, its purchases get their day's rate). **Followers** never see prices, so nothing changes for them. Both sites alike. See §4 *Currencies*. |
| D67 | **Value for money and price compare across every type: 20mg of an edible counts as 1g** (2026-10-23; to-do item 2 "Edible value for money rework", the owner's idea of 2026-10-20; mockups https://claude.ai/artifact/RmLey97BMB9wCsBHXm5xsp, option A "per 20mg" note; the owner's answers: "I really don't like the fact that you can only sort by value for money when a single product type is selected… I need the vfm numbers between flower and edibles to be comparable"; the owner's figure: 1mg of THC eaten has the effect of 10mg smoked; one fixed strength for flower, not a THC % per product ("it's very hard for customers to actually know the real THC percentage"), taken as about 20%, so 20mg eaten ≈ 1g; concentrates and pre-rolls are grams like flower; price per mg made comparable with price per gram by the same rule). Replaces value for money per 100mg for edibles ("knowingly non-comparable") and the rule that Price and Value for money need one type; D13's 2dp per mg stands. | **Value for money** is Overall ÷ the latest price for **the same effect as 1g of flower**: the price per gram (flower, pre-rolls, concentrates, other) or, for edibles, the price of **20mg** (`UnitDef.perGram`: 1 or 20). Grams are unchanged; an edible's number is 5× what it was (£15 for 100mg, Taste 7, High 9: 0.56 → 2.78). **Rank by** under **All** gains **Price** and **Value for money** (after Overall, as under a type), never on a followed person's board. **Price under All** ranks an edible by the price of 20mg, shown as its score (`£3.00 PRICE`) with **"per 20mg"** before its real price per mg on the row; under one type, price stays that type's own unit (£/g, £/mg) with no note. No colours for either (D48); #1 still gets its crown and halo, and its page's badge ("#1 by Value for money"). An edible's page: "Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better". Price history, Spent and every price as paid are unchanged. **No data change:** nothing new is saved, so no migration and nothing for Export / Restore; **followers** never see prices or value for money. Both sites alike. See §4 *Value for money across types*. |
| D68 | **A how-to video on the website** (2026-10-26; the owner asked for an animated explainer of adding the app to an iPhone Home Screen, "cannabis focused", in a frosted-glass style, to put on the website for people to follow; storyboard https://claude.ai/artifact/QcG9dBXBKwakyDFMPLomfm, placement option A of https://claude.ai/artifact/9kFM9FHB46Ru2TDudPVVrj, thumbnail 1 of https://claude.ai/artifact/GTEn99Fn34GBSoFfefK3yn; the owner's screenshots of Safari on iOS 26 showed Add to Home Screen under **View More** in the share sheet, and the Add sheet's "Open as Web App" switch; yes to the ⋯ tip in the written steps). | **A 24-second video above the three steps** in the website's "Get it" section: the app's welcome page in Safari, ⋯ → Share → View More → Add to Home Screen → Add, the leaf landing on the Home Screen, the app opening full screen, then the three steps. Green and teal frosted glass, Inter, synthesized sound; made-up products only, plain figures for people. **Thumbnail:** the phone with the leaf beside "Put it on your Home Screen". **Plays only when tapped**, with sound and the iPhone's own controls; **nothing downloads until then** (`preload="none"`); captions say what's on screen. **Written step 2** becomes "Tap Share, then View More, then Add to Home Screen" with the ⋯ tip. The site still loads nothing from anywhere else: the video is its own file (2.6 MB), and the security rules allow only the site's own media. The video's source lives in `site/video/` (not published). Website only: the app, data, Export / Restore and followers are unchanged; the preview first, public with the next "go live". See §4 *Website video*. |
| D69 | **Five more Leaderboard colour sets, each with an effect of its own** (2026-10-26; the owner's request for "even more designs… versatile, beautiful… not just restricted by the brand colours… some things out of the box… around 10 in total"; mockup https://claude.ai/artifact/3YgcF8YMhNMmX9oU3ozvas, the five marked as the pick; the owner's answers: those five, so ten in total, effects as shown, added at the bottom of the list, each marked New, Aurora and Neon's New tag taken off). Amends D48 (presets) and D64 (Aurora and Neon marked New). | **Sunset** (Peach, Coral, Magenta, Golden hour): at 9.5 a low sun glows behind the photo, gently pulsing. **Deep Sea** (Seafoam, Reef, Abyss, Glow): glowing plankton drift by from 9.0, more at 9.5. **Ember** (Ember, Flame, Blue flame, Inferno): at 9.5 sparks flick up off the card's bottom edge and its heat flickers. **Cosmos** (Moonlight, Stardust, Nebula, Supernova): stars twinkle from 8.5, more band by band, and at 9.5 a pink and blue nebula drifts behind the photo. **Synthwave** (Arcade, Laser, Chrome, Synthwave): a neon grid floor along the bottom edge from 9.0, and at 9.5 a striped retro sun setting into it. The bands, their score ranges and the dark layers' steps are as in every set (D49); only the colours and the effect differ. **Effects keep clear of every word**: on a row, in the thin strips along its edges and round the photo; on a product page, in the photo's upper part above the name. Product pages carry the effect like the row; the Colours key, the badge ("Golden hour · #1 on your Leaderboard") and Appearance name the new bands. **Appearance** lists them after Metals, each marked **New**; Aurora and Neon are no longer marked. Reduce Motion keeps the colours and the effects, still. **Data:** the database's list of allowed sets grows (`migrations/0013_more_colours.sql` rebuilds `appearance_settings`, every row copied as it is: nobody's choice changes); Export / Restore carry the set as before. A friend's board shows in your own set, as before; nothing about yours is sent to anyone. Both sites alike. See §4 *More colour sets*. |
| D70 | **Eight more looks, changing only colours and the background** (2026-10-27; the owner asked for "more visual customisation" in Settings → Appearance → Look, as for the colour sets: "versatile, beautiful designs… some things out of the box… around 10"; mockup https://claude.ai/artifact/2hYjS1mSTB9iEgUHVPASKH. The first round (Haze, Lava Lamp, Phosphor, Velvet, Outrun, Ink, Daylight, Sakura, each with its own title font and shapes) was turned down for the rest: "they literally changed the way the app looked… the font, the size / shape of things. we can't do this. we need to keep those consistent". The second round kept the app as it is and changed only colours and the background; the owner liked Sakura ("the best"), Daylight, Outrun, Lava Lamp and Haze from the first round redone that way, and Fireflies, Deep Sea, Frost and Nebula of the new ones (not Midnight Rain); "go ahead" with the suggested split: the eight dark looks first, Daylight, the one light look, on its own after). Amends D64 and D65 (the looks). | **Sakura** (a dusky plum sky, a blossom branch in the corner, petals drifting down; pink), **Fireflies** (a blue-green summer night, fireflies wandering and blinking; firefly yellow-green), **Deep Sea** (sun rays swaying down through dark water, plankton rising; sea-glass teal), **Frost** (cold slate blue, snow falling, near and far; ice blue), **Nebula** (a field of stars, some twinkling, over drifting pink, violet and blue clouds; starlight violet), **Outrun** (a purple sky with stars, a striped sun setting into a neon grid floor that rolls towards you under the tab bar; cyan), **Lava Lamp** (warm orange, pink and amber blobs rising and sinking; amber), **Haze** (lilac and sage smoke drifting up and across soft charcoal; sage). **The rule (the owner's):** a look changes only colours (background, glass, edges, words' greys, highlights and buttons, the tints big numbers flow through, the glow of the chosen tab and the add button) and the background behind everything; every font, size, shape and position is as in Aurora Glass (Holo Pearl's Sora and Deep Forest's Manrope titles are from before the rule and stay). Each background moves in small steps, a few a second, like the lights; still with Reduce Motion; hidden under the viewer and the editors. Nothing in it is brighter than the words allow (the readability tests over every screen), and these looks' glass is a darker pane, so it dims behind every card. Listed after the four in Appearance, in the order above, each marked **New**; the colour sets keep theirs. Twelve looks in all; **Daylight** comes next as its own change. The phone remembers each; the Home Screen bar takes its background. A new migration widens the looks the database allows; nobody's look changes; Export and Restore carry it; followers see your board in their own look. The website stays Aurora Glass. See §4 *The new look*. |
| D71 | **The top glows with your look; Slim strip and Gems by default; Appearance in three pages; the lists A to Z** (2026-10-28; the owner, with a screenshot: the glass hero "looks weird, and it's just black. It doesn't match… whatever setting you had"; the default top should be the slim strip; Aurora Glass stays the default look; the looks and the colour sets "sorted in alphabetical order", the default colours Gems; "there should still be four buttons, but each brings you to a different settings page"; mockup https://claude.ai/artifact/QrYP3LbkxnQXTzNxdbyqET, option **B** "the Look's glow" chosen over A (the colour set's card) and C (your #1's colour); the defaults for accounts that have saved nothing, the suggested pick; the Rank, colours and Type buttons stay above the top, as they are ("keep them above"); the eight looks of D70 go live together with this). Amends D48 and D64 (defaults, order, one Appearance page). | **The top glows with your look:** the glass hero, the slim strip and the three tiles show the look's own lights inside them, about twice as strong as behind the screen, over a darker pane, with an edge from the look's accent to its violet and a soft glow around (Holo Pearl keeps its rainbow rim). It was black because it shared the product page's name block's dark fade; that is gone, with the space it left under "Your #1". **Defaults:** an account that has saved no appearance starts on **Aurora Glass, the Slim strip and Gems** (#1 marked). Saved choices stay as they are (the appearance is saved whole, the first time any part of it changes; D64 gave every account of the time saved settings). **Order:** Looks: Aurora Glass, then A to Z; Leaderboard colours: Gems, then A to Z; tops: Slim strip, Glass hero, Three tiles; New tags unchanged. **Pages:** Settings → Appearance keeps its four buttons; **Look**, **Leaderboard top** (with the preview) and **Leaderboard colours** (the preview, the sets, Mark my #1) each open their own page; Sounds and ticks as before; the Colours key's link opens the colours page; the old Appearance address opens Settings. No data change; Export, Restore and followers as before. See §4 *The new look*. |
| D72 | **Three light looks: Daylight Mint, Daylight Pearl, Daylight Sky** (2026-10-29; D70's second step, the one light look of its mockups; mockup https://claude.ai/artifact/Ci4gw3JR9VwzVM4DqweJLa; the owner: "mint, pearl, and sky i want all three. There should only be light cards", and no automatic switch with the iPhone's Light and Dark mode: "only have it ever start in dark mode. only if the user manually switches it themselves should i go to light"; the names as suggested). Amends D70 (looks). | Three more looks, listed straight after Aurora Glass (A to Z), marked New: **Daylight Mint** (cool mint-white, soft green, sky and sunny lights; dark green words, leaf-green buttons), **Daylight Pearl** (near-white with a faint pastel rainbow; graphite words, violet-blue buttons), **Daylight Sky** (blue-white, a warm sunny glow; navy words, ocean-blue buttons). Colours only, as every look (D70), with the background's lights drifting as in Aurora Glass and no extras. **Light cards:** in these looks a coloured row (8.0 and up) is a white card with its colour set shimmering through at the edges, stronger band by band, its score and rank in a deep shade of the colours; the swatches and a product page's badge too; the sets' effects in deeper shades so they show on white; rows below 8 keep the heat glow, their score in a deeper shade. The dark looks keep their dark cards. **The light tone:** the iPhone's own controls (keyboard, pickers) and the Home Screen app's status bar in their light style. Everything that had a dark colour of its own takes a light one; the photo viewer, cropping and cut-out tools stay black. **Everyone starts dark** (Aurora Glass); a light look is only ever chosen; no automatic switching. A new migration widens the looks the database allows; nobody's look changes; Export, Restore and followers as before; the website stays Aurora Glass. See §4 *The new look*. |
| D73 | **The Look page in two sections: Dark mode and Light mode** (2026-10-29; the owner, on GT Dev: "they need to be at the bottom of all the different looks, with their own sort of section titled 'light mode' with the three looks under that subheading. this means the dark modes should have their own 'dark mode' subheading"; of mockup https://claude.ai/artifact/92BkZMvoLxBVbdogSpGDDX he chose the moon and sun, "with no line"). Amends D71 (the order) and D72 (where the Daylights are listed). | The Look page has two headings in Settings' own small capitals: **Dark mode**, with a moon, over Aurora Glass then the other dark looks A to Z; and **Light mode**, with a sun, at the bottom, over Daylight Mint, Pearl and Sky. Still one choice: picking a light look unticks the dark one. No other change: nobody's look, the start in Aurora Glass, data, Export, Restore and followers as before. See §4 *The new look*. |
### Design approvals (Phase 1, 2026-09-23)

Mockups: `design/mockups.html` (https://claude.ai/artifact/33Y3cGCk8u6Kos1u1ht6Hx).

| # | Decision |
|---|---|
| P1 | Tab bar icons: podium (Leaderboard), notebook (Log), two people (People), three dots (More). Pending-request count on People. *(A flame for Smokes from 0.36.0 to 0.49.0, D43; gone since D60.)* |
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
  *(Since 0.57.0 Price and Value for money come first, after Overall: D67.)*
- **Tie-break after date tried:** undated after dated, then name
  (case-insensitive), then id — so the order is always stable.
- **Latest purchase:** newest by date; undated purchases count as oldest; same
  date → the later-entered one (`seq`).
- **Headline price** comes from the latest purchase only. If that purchase has no
  amount there is no headline price (and no VFM) — no fallback to an older one.
  *(Since 0.56.0 in your main currency: the purchase's total at its saved rate, D66.)*
- **VFM display:** 2 decimal places (`7.00`, `1.60`).
  *(Since 0.57.0 per gram, or per 20mg for edibles, so every type compares: D67.)*
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
    → `product_id` on the row. `planPhotoWrites` (`server/lib/photos.ts`) puts the deletes of
    removed photos **first** in the batch (D51, 0.43.4): a Log entry holds one photo
    (`photos_log_entry` is unique), so swapping it must free the place before the new row goes
    in; before 0.43.4 the insert came first and the whole save failed. Tested (`log.test.ts`,
    `returnToLog.test.ts`, `logentry.spec.ts`; all three fail without the fix).
  - *Where a crop is saved* (brief §11): from the profile or its viewer → at once
    (`POST /api/photos/:id/crop`); from the editor or its viewer → on Save, with the
    viewer showing the unsaved crop; Cancel discards it.
  - *Serving*: `GET /api/photos/:id/{thumb|cropped|original}` for signed-in owners
    only (followers: cropped/thumb of visible products, Phase 7), with
    `Cache-Control: private, no-cache` and an ETag, so phones revalidate (cheap 304s)
    and revoked access can't keep showing cached photos. Uploads must be JPEG
    (checked by signature), ≤ 8MB per image and ≤ 1MB per thumbnail. *(Since 0.19.0 a
    cut-out's image and thumbnail are PNG instead, D26.)*
  - *Removing photos* happens in the editor (viewer → Remove, or ⋯ → Remove photo), applied
    on Save *(builder: the brief doesn't mention deletion)*.
  - *The cover* (D52, 0.44.0): a product's first photo is its cover, the hero and list
    thumbnail everywhere (rows, the Poster, the Log, tiles, followers, Return to Log). The
    grid marks it with a gold ring (`--star`) and a ★ (`.pslot.cover`). **Set as cover**:
    from your product page, the viewer's bar → `POST /api/photos/:id/cover` (saved at once;
    moves the photo to position 0 and renumbers the others in order; 404 for anyone else's
    photo, a Log entry's, or one a returned entry keeps, D50); the old cover fades out over
    the new one (`.hero-old`) and a "Cover updated" toast shows. In the editor: ⋯ → Set as
    cover, or **press and hold** a photo (300ms) and drag it (`PhotoGrid` `onMove`; the
    others slide out of the way; the page doesn't scroll while dragging; a drag isn't a tap);
    Save sends the new order through `planPhotoWrites` like any edit. No database change:
    `photos.position` already held the order; Export lists photos in order and Restore keeps
    the file's order. Log entries keep one photo and have no cover.
  - *Photo actions* (D52): the grid's round Crop and Remove background buttons are gone. In an
    editor each photo has ⋯ (Set as cover, Crop, Remove/Restore background, Remove photo; a Log
    entry's has no Set as cover). The viewer has a bar along the bottom: Set as cover ("The
    cover" on the first), Crop, Cut out (Restore background on a cut-out) and, in an editor,
    Remove. A friend's photos have no ⋯ and no bar. The viewer's strip is focusable (arrow
    keys) for keyboard users.
  - *Viewer*: full-bleed black over header and tabs, close top-left, swipe between
    photos (P8), `n / N` counter, Crop this photo. *Zoom* (D53, 0.45.0): the viewer
    handles every gesture itself (`PhotoViewer`; native scroll-snap can't be combined with
    pinching): pinch 1×–4× (`MAX_ZOOM`; the point between the fingers stays put; a little
    past the limits while pinching, settling back on release), double-tap for 2× at the tap
    (the spot stays under the finger, as in iOS Photos) and back, one-finger drag while zoomed
    (clamped so the photo covers the screen where it's bigger than it), swipe to another photo
    only at 1× (rubber-band at the ends; arrow keys too); every photo starts at 1×. Zoomed,
    the top and the bar slide away and are `inert` ("clear view"); one tap toggles them; a
    "2.4×" note shows for 0.9s. The stage fills the screen and the slides are padded clear
    of the top and the bar, so a photo at 1× sits where it did. `gesturestart` is cancelled
    so a pinch never zooms the page. Reduce Motion: no glides. *Cropper*:
    Cancel · Free | Square · Apply, corner handles with 44px touch areas, drag to
    move, dimmed surround, Reset to original (→ no crop).
    Apply waits for the photo to load; Square tapped before then is squared again in the
    photo's load handler, once its proportions are known (0.27.1: it used to stay full-frame,
    marked square). Tested (`photos.spec.ts`): the original held back until Square is tapped
    still gives a square box and a 960×960 crop (fails without the fix).
- **The Log (Phase 6).**
  - *Two kinds of row*: product rows are drawn from your non-archived products when
    the Log renders (never stored copies), next to loose entries. Grouping, order
    and tiles come from `shared/domain/log.ts` (tested since Phase 0).
  - *Loose entries* (`shared/domain/logEntry.ts`): name, type (+ concentrate type,
    Other pattern), country, amount, one photo. Validation reuses the product
    validator for the shared fields, so the rules can't drift. Hard delete behind a
    confirmation removes the photo files too.
  - *Rows*: product rows show the type mark (= has a full profile) and open the
    profile; loose rows have no mark and open the entry's page (since 0.34.0, D41; the
    editor before), its form at /log/:id/edit; the whole row is the
    tap target. The thumbnail shows the photo, else the type mark (both kinds).
  - *The Type filter is the one stored setting shared with the Leaderboard*;
    changing it on the Log may drop the Leaderboard's Rank by back to Overall if the
    new type lacks it (same fallback rule). Tiles `0 / 0 / 0g` show even when empty.
    Country headers are sticky (P4). Empty Log and filtered-empty cards *(builder
    copy)*. Returning from a row lands on it (same mechanism as the Leaderboard).
  - *A profile opened from the Log returns to the Log*, with the Log tab active.
  - *Promotion*: "Add to leaderboard" (saved entries only) commits nothing. It hands
    the entry's **live** form — unsaved edits and any pending photo upload included —
    to the product editor *(since 0.34.0, D41, it starts from the entry's page, so it
    hands over the saved entry and its photo)*, pre-filling name, country, photo, product type and
    concentrate type; the amount is dropped. Cancel asks **Keep editing / Discard**;
    Discard returns to the entry, untouched. Save calls `POST /api/log/:id/promote`,
    which in one D1 batch creates the product, re-points the entry's photo to it
    (same row and files — moved, not copied, original included) and deletes the
    entry. *(Since 0.43.0, an entry returned from the Leaderboard saves over the product it keeps instead, D50.)* Afterwards Back goes to the Log, not the deleted entry. Reloading the
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

- **Country picker (D16, 0.10.0).**
  - *The field* shows the flag and name (`🇬🇧 United Kingdom`), `Not set`, or `Other`
    (with the usual "Which country?" box beneath). Tapping opens a full-screen panel
    (`client/src/components/CountryPicker.tsx`) over the header and Save bar: Cancel ·
    "Country", a search box that has focus straight away, then the list.
  - *The list*, with nothing typed: **Used** (listed countries on your non-archived
    products and loose Log entries — the Log's scope — most used first, then A–Z, at
    most 5; Other and archived products don't count; omitted if none or if that data
    can't load), then **Not set**, A–Z with flags, and **Other…**. The current choice is
    ticked. Worked out when the panel opens from data already on the device (fetched if
    not yet loaded); nothing new is stored.
  - *Search* (`searchCountries` in `shared/domain/countries.ts`): the query must start a
    word of the name or of a search-only nickname; capitals, accents and punctuation are
    ignored. Nicknames (`COUNTRY_ALIASES`): UK, Britain, Great Britain, GB, England,
    Scotland, Wales, Northern Ireland → United Kingdom; USA, US, America → United States;
    Holland → Netherlands; plus Czech Republic, Swaziland, Macedonia, Korea, Türkiye
    *(builder)*. Order: a nickname typed in full, then names starting with the query,
    then nicknames starting with it, then other word starts; A–Z within each. Used
    hides while searching; Other… stays at the bottom.
  - *No match* shows "No matching countries" and **Use "…" as Other**, which sets Other
    and fills "Which country?" with the typed text (editable, as before). Enter picks
    the first match (or that Other). Cancel and Escape change nothing.
  - *iPhone keyboard*: iOS only opens the keyboard for a focus made during the tap, so
    the tap focuses a throwaway input and the panel moves focus on to its search box.
    The panel always covers the whole screen, because the keyboard is see-through (a
    panel shortened to sit above it let the editor show through, 0.10.2). The list gets
    bottom padding the height of the keyboard instead (from `visualViewport`), so its
    end can be reached. Body scrolling is untouched (brief §11).
  - *Modal*: the panel is drawn at the end of `<body>` (a portal) and `#app` is `inert`
    while it's open, so the keyboard's ⌃ ⌄ arrows can't move to the editor's fields and
    nothing behind can be tapped. Focus returns to the Country field on close.
  - *Search box wording*: placeholder and label are just "Search" (no "country"), to
    stop Safari guessing it's an address form and offering AutoFill Contact. Safari
    decides that itself, so this is best effort — and it didn't work (see below).
  - *Safari's "AutoFill Contact" button — known, left as is (owner decision,
    2026-09-24).* On iPhone, Safari offers AutoFill Contact in the bar above the keyboard
    on text boxes across the app (seen on the picker's search and the editor's Name), to
    fill in the owner's own contact card. It's Safari's feature, not the app's: Safari
    ignores `autocomplete="off"`, and there is no supported way for a page to turn it
    off. The only app-side workaround (replacing text inputs with `contenteditable`
    areas) would mean rebuilding every text box for a harmless button that Safari could
    change again, so it was declined. The bar itself (⌃ ⌄ ✓) is shown by iOS for every
    web text box and can't be removed. To hide the button on a device: Settings → Apps →
    Safari → AutoFill → Use Contact Info off (affects every site). Don't spend time on
    this without asking the owner.

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

- **Stats tiles (D17, 0.11.0).** One `Tiles` component and one `.tile` style serve all
  three screens, so they stay alike. The wash is the podium rows' technique (§6.1 of the
  design brief) in green, a little stronger and wider (135°, 16% → 0 at 70%) so it
  reads on a small box. Numbers and labels keep `--text` / `--text-2`, so contrast is
  unchanged. Tested: centred to within 1px, inside the tile edges and not cut off (also
  at 375px, with COUNTRIES, the longest label), wash present, on all three screens.

- **The green look (D18, 0.12.0).** Tokens in `client/src/styles.css`: `--card-bg`
  (115°, `--accent-bright` 7% → 0 by 55%, over `--surface-1`), `--card-edge` (16%),
  `--divider` (10%, lines inside cards), `--bar-line` (22%, header / tab bar / Save bar),
  `--photo-edge` (1px outline at 14%) and `--bar-fill` (rating bars and the editor's
  slider). Cards: Leaderboard rows (not the podium), Log groups, profile sections,
  editor sections, More / People / Passkeys / Archive lists, the People segmented
  control, empty-state cards and the country picker's lists. Pills get a lighter
  version of the tile wash (10%, edge 26%); an active pill keeps its stronger state.
  Section titles (`.lh.cap`, a card's own caption, Log country headers, the picker's
  headings) are `--accent-bright`; captions under numbers stay `--text-2`; More's "Danger zone" title is `--danger`. Kept as
  they were: text boxes and dropdowns (so they still read as things you type into),
  buttons, action sheets, the purchase cards nested inside the editor, the photo
  viewer and cropper, and the podium rows (their own styles, D19). Tested: every card, title
  and bar on nine screens (your Leaderboard, Log, People, More, a product, its editor,
  a Log entry, Passkeys, Archive), and axe finds no contrast problems.

- **Podium tiers (D19, 0.13.0; cool metals D21, 0.15.0; three holo cards D39, 0.32.0).** *Replaced in 0.41.0 by colours by score (D48, see Leaderboard colours); kept as history. Since 0.32.0 (D39)
  `PODIUM_TIERS` is 3 (`Podium` is 1 | 2 | 3): rows carry `tier p1`…`p3`, and the 4th row gets the heat glow (D30).
  Every tier is the holo card 1st always was (`.row.tier`): a 115° dark layer (`--dark`, `--dark-a` → `--dark-b`) over the
  tier's six colours drifting (`tier-flow-holo`, 5s) across the whole row (`padding-box`) and its 1.5px edge (`border-box`).
  All three share the layer's strength (70% → 86%) and the shimmer (18%); only its tint (`--dark`) differs: green-black on
  the rainbow, blue-black on **Diamond** (`#dff4ff #a9dcff #e9e0ff #8fd0ff #c6f3ff #b8c8ff`, ice blue and lilac; it keeps its
  three glints), warm-black on **Gold** (`#ffe79a #f5c451 #fff3c4 #e0a83a #ffd977 #c9922e`). The mockup's lighter layers
  (60% → 80%, shimmer 24% / 20%) failed the row readability test as the shimmer passed (Diamond's price line 3.4 : 1, Gold's
  name 4.4 : 1), hence the rainbow's strength for all three. Rank numbers and scores flow through
  `--tier-text`: the whole gradient on the rainbow and Diamond, Gold's three lightest shades only (its darker ones are too dim
  for text). The cascade is 0 / 0.35 / 0.7s. Platinum, Pewter, the metal glow (D31) and `tier-flow-edge` are gone; a test
  checks no Platinum or Pewter colour remains in the styles. Tested (`leaderboard.spec.ts`): three tiers then a glowing 4th,
  each tier a holo card with its colours, scores flowing, glints only on Diamond and clear of text, the cascade, Reduce
  Motion, and text contrast from real pixels at 12 moments of the motion on all three; `podium.spec.ts`, `heat.spec.ts`,
  `welcome.spec.ts` and the domain tests follow. What follows describes 0.13.0–0.31.0.* *Since 0.15.0 the metals are
  Diamond (ice blue: #e6f7ff–#7cc8f2, wash 30%, shimmer 26%), Platinum (cool silver,
  wash 17%, shimmer 16%) and Pewter (blue-grey, wash 12%, shimmer 7%, edge and number
  flowing every 10s instead of 5s) — the "descending shine". Diamond's three `.glint`
  stars (top-left, top-right, under the photo) each twinkle on their own rhythm (2.9s,
  3.7s, 4.3s); a test checks they never overlap any text and that no gold or bronze
  colour remains anywhere in the styles. What follows describes 0.13.0; its gold,
  silver and bronze are replaced as above.* `rankProducts` gives `podium` 1–4 to the first four
  rows **with a value**, so an unrated product (Overall only; other Rank bys hide them)
  never gets one. Rows carry `tier p1`…`tier p4`. Styles in `client/src/styles.css`:
  each tier has six colours (pastel rainbow; light-to-dark shades of gold, silver,
  bronze) that flow along the 1.5px edge and through the rank number every 5s. 1st is a
  holo card: the rainbow drifts behind a dark layer (70% → 86%) that keeps text
  readable; 2nd–4th keep the metal wash (13%) on a plain card. A band of light (18%
  white) sweeps across each row every 4.5s, starting 0 / 0.35 / 0.7 / 1.05s apart (the
  cascade). The small grey lines (price · Source, the score caption) are brighter on
  tier rows (84% instead of 64%) because the light passes behind them. All of it is
  CSS animation of background positions, run by the phone's compositor; with Reduce
  Motion on, no animation is created at all. Tested: tiers on the right rows for every
  filter × Rank by (never an unrated one), on a followed person's board, the cascade
  timing, Reduce Motion, and text contrast measured from real pixels at 12 moments of
  the motion (≥ 4.5:1, 3:1 for the large score), since axe can't judge text over a
  gradient.

- **Podium product pages (D22, 0.16.0).** *Since 0.41.0 (D48) a product carries its row's colour instead (`data-band`, `.gem-badge`; see Leaderboard colours). Since 0.32.0 (D39) only the top three get a podium page (`data-podium` 1–3).
  Every badge is its row's holo card (`.tiered .podium-badge`: the tier's colours under a 84% → 92% layer in its `--dark`
  tint, drifting with `tier-flow-holo`); the score and the badge's "#N" flow through `--tier-text`; the haze is 0.14 / 0.14 /
  0.12, all at 5s. 1st and Diamond keep the sweep, Diamond its glints; Gold has neither. `podium.spec.ts` checks each place's
  pieces (holo badge included), that a 4th-place page is ordinary (also on a friend's board), Gold under a Type filter
  ("#3 in Flower"), and readability across the motion on all three pages.* *Since 0.20.0 (D27) the page is the Poster: the photo
  frame and the 1st/Diamond card below are replaced by a tier-coloured haze behind the details, and
  the glints sit in the photo; see §4 The Poster. The rest below still applies.*
  - *The place*: `podiumPlace` (`shared/domain/leaderboard.ts`) ranks the same list with the
    same view as the row (`rankProducts`), so a page and its row can never disagree. Your
    page uses your list (the cached one, else fetched once) and your stored view (`gt.view`);
    a friend's uses their list (fetched with the product, as the follower allow-list sends
    it, so private and archived products never count) and your view of friends
    (`gt.view.others`). Archived products never get a place. Worked out on the phone each
    time the page opens; nothing is stored. `<main>` carries `data-podium` 1–4, or `none`
    once the list has arrived.
  - *The badge* (`podiumBadge`): "#N on your/their Leaderboard" under All and Overall;
    otherwise the list it tops, "#N in <Type>", "#N by <Rank by>", or both. Only 1st has the
    crown.
  - *Styles* (`client/src/styles.css`, `.tiered.p1`…`p4` on `<main>`): the rows' own tier
    colours, speeds and shimmer (shared custom properties). Frame: a 2px flowing tier edge on
    the big photo, with the tier's shimmer across the photo. Score (1st–3rd): the tier colours
    flowing through the number. Card (1st, Diamond): the hero sits on the row's holo card /
    metal wash. Sweep (1st, Diamond): one band of the tier's colours across the photo 0.25s
    after the page appears; it is held while Photo grows is flying, so it always runs just after
    the photo lands. Glints (Diamond): the photo's top corners and the card's top-right corner.
    Pewter's frame flows at half speed, and its badge number flows only through its lighter
    shades (the darkest ones measured too dim for small text). 1st's badge sits on a darker holo
    than its card, and the small grey text on the cards is brighter (84%), for the same reason.
  - *Reduce Motion*: colours stay; no flow, shimmer, sweep or glints.
  - Tested (`test/e2e/podium.spec.ts`): each place shows exactly its pieces (and 5th,
    unrated and archived show none); the page follows Type and Rank by, also from the Log;
    a friend's page counts only what they share; glints clear of text; axe; text contrast
    measured from real pixels at 12 moments of the motion on all four pages (a shared
    `contrastFailures` helper); Reduce Motion. `motion.spec.ts` checks the sweep waits for
    Photo grows to land.

- **Tap feel (D20, 0.14.0).**
  - *Press* (`client/src/press.ts`): iPhone Safari barely shows `:active`, so the app
    marks the element under the finger with `.is-pressed` itself (links, buttons,
    filter pills, the country field). It shows after 60ms, so a scroll never lights
    anything up; moving the finger more than 8px, a scroll or a cancel removes it; a
    quick tap shows it for 120ms. Disabled buttons never press. The old `:active`
    rules were removed.
  - *Photo grows* (`client/src/transitions.ts`): uses the browser's view transitions.
    The tapped row's thumbnail and the product's big photo (`.hero-photo`, the type
    mark when there's no photo) are both named `gt-photo` for the moment of the
    switch; the rest of the page fades (out 0.15s, in 0.26s after 0.16s; 0.44s flight).
    The new screen gets at most 400ms to render and decode its photo before the
    animation starts anyway. **Frames are paused while it waits, so it polls on timers,
    never `requestAnimationFrame`** (found in testing: waiting on frames froze every
    open for 4s until the browser gave up). Back from a product flies the photo to the
    row it was opened from, once the list has restored its scroll, and only if that row
    is on screen; otherwise it's a plain fade. Loose Log entries, the browser's own
    back and every other screen change work as before. The screen entrance fade is
    switched off during the flight, and stays off on the screen that arrived (0.14.1:
    switching it back on restarted it, so the page dipped dark and faded in again just
    after the photo landed).
  - *Safari fixes (0.19.1–0.19.2, owner's recordings)*.
    **Swipe-back picture:** swiping back on iPhone shows the phone's picture of the list only
    when the list's history entry restores its own scroll, or the page happens to be scrolled
    exactly as the list was; otherwise it shows the page colour (black), then ~0.5s of black.
    That's why it went black only when the list had been scrolled. So the entry a product is
    opened from, from a list row (`openRow`), has `history.scrollRestoration = 'auto'`, and
    since 0.19.4 so does the Log when a loose entry is opened from it (`openPlainRow`; since
    0.34.0 an entry with a photo uses `openRow` and flies it, D41); every
    other entry stays `manual` (the app decides where screens start). Known, left for now
    (owner's choice, 0.19.4): the same black swipe can happen leaving any other screen while
    scrolled down (People lists → a person, a product → its editor, More's sub-screens). On Back the browser puts
    the list's page back where it was, which is where the app's return to the tapped row
    lands anyway. (0.19.1 guessed it was the picture being taken mid-flight and added the
    entry before the flight; that stays, but wasn't the cause.) *Since 0.19.3* the return to
    the tapped row agrees with that restore: it lands **exactly where you were** when you
    tapped, as long as the row is still fully on screen there; if it moved (re-rated) it goes
    to roughly its previous screen position, and if it's gone, to the top. The browser's
    restore can land after the app (GitHub's machines caught it), so when the app chose
    somewhere else it undoes that restore for a moment afterwards (never a finger's scroll,
    never mid-flight).
    **Nothing scrolls during a flight** (`client/src/scrollHold.ts`): Safari draws the frozen
    old screen in the wrong place when the page scrolls mid-transition. Opening from a scrolled
    list dropped the whole screen by the scroll distance, and Back threw the product page up by
    it. During a flight the page stays where it is and the screen is drawn lower or higher
    instead (`html.vt-hold`, a margin on `.screen`); the router's and the list's scrolls go
    through `scrollPage`, which moves that margin; the real scroll happens when the flight
    ends, invisibly. Back first moves the page to where the browser will put the list,
    invisibly, so the browser's own restore doesn't scroll mid-flight either.
    **After a swipe back** (or the browser's own Back) the screen appears without its entrance
    fade (`html.arrived-still`), since the phone has already animated it. The app's own Back
    button and every other change keep the fade.
    Chromium shows none of these, so the tests check the causes (entry before the flight and
    marked to restore its scroll, no scroll during either flight, the product unmoved as Back
    starts, landing on the row after Back and after the browser's Back, no fade after Back).
  - *Big photo loading*: the product page shows the row's thumbnail (already on the
    device) under the full photo until it arrives, so the flight never lands in an
    empty frame (and the page never shows a blank photo box while loading).
  - Tested (`test/e2e/motion.spec.ts`): the press waits, lifts to 1.03 and cancels on
    movement; scroll-like movement never presses; a quick tap still flashes; in-card
    rows light up and stay within their card; the flight runs on open and Back (own
    Leaderboard, Log, a product without a photo; since 0.34.0 a loose entry with a photo,
    D41), never for a loose entry without one, cleans up
    after itself, and never freezes the screen more than 0.6s; Reduce Motion gives
    colour only and no flight.

- **More screen (D38, 0.31.0).** `More` (screens/More.tsx) starts with `a.more-me` (→ /people): `Avatar` size xl at 60px
  with a green ring (your photo via `ownProfilePhotoUrl`), `@username`, and `summary()` of your product count (cached, then
  `fetchProducts`) and follower / following counts (`people.followers()` / `following()`), each part once it has arrived.
  `Row` takes an `icon` and a `tint` (green, amber, teal, red) drawn as a 30px `.li-ic` tile; icons are KeyIcon,
  LifeRingIcon, BlockIcon, UploadIcon, DownloadIcon, BoxIcon, SignOutIcon, DevicesIcon and TrashIcon in icons.tsx.
  Groups: Account, Data (with Archive), an unheaded Sign out card, Danger zone; `footer.more-foot` shows LeafGlass and
  `Green Tracker {__APP_VERSION__}`. Tested (`test/e2e/more.spec.ts`): the card's letter, @username and counts, tap → People;
  every row's icon, tint and destination in order, the headings, the red Delete account, Sign out everywhere still asks;
  the footer version and no Version row; readability.

- **Leaderboard colours (D48, 0.41.0).** Rules in `shared/domain/gems.ts`: `scoreBand(rankBy, value)` → 1–4 or null
  (from `round(value, 1)`, floors `BAND_FLOORS` 8 / 8.5 / 9 / 9.5; null for `price`, `vfm`, `used` and unrated), `PRESETS`
  (gems, prism, metals: label, description, four band names), `bandName`, `bandRange`, `Appearance` `{ preset, markFirst }`,
  `DEFAULT_APPEARANCE` (gems, true), `validateAppearance`, `appearanceSummary`. `rankProducts` (leaderboard.ts) now gives each
  row `band` and `first` (index 0 with a value) instead of `podium`; `boardPlace(products, id, view)` returns a product's row
  (or null), `placeText(rank, view, whose)` the old badge words, `placeBadge(place, view, whose, appearance)` the badge
  ("Amethyst · #3 on your Leaderboard"; an uncoloured #1 → its place when marked; else null). `Podium`, `PODIUM_TIERS`,
  `podiumPlace` and `podiumBadge` are gone. *Client:* `components/Gems.tsx` (was Podium.tsx): `useAppearance()` (from
  `me.appearance`, `/api/auth/me`, else the defaults), `rowClass` (`tier band{n} pal-{preset}` and `first`), `Glints` (only
  Metals' band 3, Diamond), `RankCrown` (`svg.rank-crown` inside `.rk`), `pageClass` (`tiered band{n} pal-{preset}` and
  `first` on `<main>`, which also carries `data-band` 1–4 or `none` once the list has arrived), `PlaceBadge`
  (`.gem-badge`, `.plain` without a band; `.gem` and `.n` flow), `ColoursButton` (`.pill.key`, four `.kdot`s, in
  `ControlRow` between Rank by and Type when given `onKey` and ranking by a score: it wouldn't fit at 375px beside "Most used" and "Edibles", and has nothing to explain there) and `ColoursSheet` (`.sheet.keysheet`: a `.swatch` per band top
  first with its name and range, the green glow, "Crown and halo · your #1" when marked, a note that Price, Value for money
  and Most used have no colours, **Change in Appearance** and **Done**). `heatStyle(band, …)` skips banded rows. *Styles:*
  palette classes set `--t1`…`--t6` (and `--dark` for Sapphire, Amethyst, Rose gold, Diamond); `--tier-grad` all six,
  `--tier-light` (t1, t3, t5) for small text. *Since 0.42.0 (D49)* every band is a holo card (`.row.tier`,
  `.swatch[class*="band"]`: the `--dark` layer from `--d1` to `--d2` over `--tier-grad`): `band1` 0.9 → 0.95, still;
  `band2` 0.86 → 0.93 and `band3` 0.8 → 0.9, flowing (`tier-flow-holo`); `band4` 0.7 → 0.86 with the shine
  (`tier-sheen`). Gems' Sapphire `#7fb0ff` family under `10, 16, 26` and Amethyst `#b598f0` family under `12, 14, 22`.
  *(0.41.0 had band 1 and 2 as a dark row with a coloured edge, still or flowing, and Gems' Amethyst under a violet
  `18, 8, 30` layer.)* Scores flow from band 2 up; the rank number takes `--t3` (the lightest shade: the
  flowing rank failed the readability test where a holo card is lightest); badge text flows through `--tier-light` (the
  deep purples and blues failed it). `.row.first`: `--halo` (the row's `--t2`, gold `#ffd36b` without one) as a
  box-shadow, breathing (`first-halo`, 3.2s; combined with the card's own motion on bands 2–4); `.rank-crown` 15px gold
  above the number. Product pages: `.tiered.band{n}` haze 0.06 / 0.09 / 0.12 / 0.14, the photo shimmer and one sweep
  (`tier-arrive`) from band 3. Reduce Motion: colours stay, no motion, no glints. *Appearance:* `appearance_settings`
  (`user_id` PK → users ON DELETE CASCADE, `preset` CHECK gems/prism/metals, `mark_first`, `updated_at`), no row = the
  defaults; `server/lib/appearance.ts` (`loadAppearance`, `saveAppearanceStatement`), `GET/PUT /api/appearance` (yours only;
  a full, valid set or 400), `/api/auth/me` includes `appearance` when signed in; never in anything sent to someone else.
  Export puts `appearance` in the file (`ExportFile.appearance?`), Restore applies it in the same batch
  (`RestorePayload.appearance?`; absent → yours untouched; a bad one refuses the restore). `AppearanceScreen`
  (screens/Appearance.tsx, `/more/appearance`): **Leaderboard colours** (three `label.li.preset` rows, a `.radio` each, with
  four swatches and 8.0+ … 9.5+), **Your #1** (**Mark my #1** switch and a sample row, Wedding Cake 9.7), a footnote; each
  change saves at once (`PUT`, then the session refresh) and goes back if the save fails; disabled offline. More: an
  **Appearance** group with **Leaderboard colours** (value: the preset). The welcome screen's examples: 9.7, 9.2, 8.7.
- **Return to Log (D50, 0.43.0).** One new column, `log_entries.kept_product_id` → products ON DELETE SET NULL, unique
  where set (`migrations/0009_return_to_log.sql`): the entry is an ordinary Log entry, and the product it points at is
  *kept*: stored as it was, hidden everywhere products show. `NOT_KEPT(alias)` (`server/routes/products.ts`) is the one
  rule: `load()` leaves kept products out (so `GET /api/products`, `?archived=1`, `/:id`, `PUT`, followers' boards and
  pages, and the Privacy preview never see them) and `load(…, { kept: true })` loads only them; the Private and Archive
  switches and a new smoke (`smokes.ts`) refuse one (404); a follower's photo request refuses its files (`photos.ts`).
  `POST /api/log/return/:productId` (log.ts) in one batch inserts the entry (name, type, concentrate type, country,
  `returnedAmount(purchases)` from `shared/domain/logEntry.ts`: the sum of the amounts, to 3 places, capped at
  `PRODUCT_LIMITS.money`, null when none; `created_at` = the product's), re-points the product's first photo to it (the
  same row and files) and moves its smokes to it; an archived product → 409 "Un-archive it first."; already kept or
  not yours → 404. `LogEntry.kept` is the kept `Product` (null for an ordinary entry), sent with the entry and the Log.
  Promotion of an entry with `kept` saves over that product (`updateProductWrites`, shared with `PUT /api/products/:id`,
  adopting the entry's photo) instead of creating one, then moves the smokes back and deletes the entry; the client
  pre-fills it with `keptPromotionInput(entry, kept)` (the kept product's input under the entry's name, type, country,
  and photo first) and the kept ratings (hidden categories too, `Promotion.ratings`). Deleting the entry deletes the
  kept product first (ratings, purchases and photo rows cascade) and every photo file of both. Export: each entry may
  carry `kept` (`ExportKept`: an `ExportProduct` without `archived` and `smokes`; its photos are the other photos);
  Restore validates it like a product and inserts it with the entry (`RestoreLogEntry.kept`, photos at positions 1 and
  up); restore counts and progress include its photos. *Client:* `returnToLog(productId)` (logEntries.ts) forgets the
  product (`forgetProduct`), moves its smokes in the cache (`moveProductSmokes`) and remembers the entry; Profile's Actions
  (`Return to Log`, `ReturnIcon`, a `Sheet`) then `replaceHistory('/log')` and open `/log/:id`. LogEntry: a
  `section.sect.kept` "Kept from your Leaderboard" (`.kept-head` with a `.kept-ic` tile; a `dl.kv` of Ratings under the
  entry's current type with Overall, Purchases with the total paid, Notes, Other photos; empty rows left out) between
  Details and Actions; `deleteMessage` adds the kept list. Tested: `test/api/returnToLog.test.ts` (10: the entry and what's
  kept, hidden everywhere and refusing changes, followers and their photo files, archived and someone else's, no amounts or
  photos, back as it was (same id, hidden rating, purchases, photo order, smokes, and again), changes made in the Log,
  delete with every file, restore and a bad kept product); `test/domain/logEntry.test.ts` (the amount; the pre-fill);
  `test/e2e/returntolog.spec.ts` (8: placing and the sheet with axe, the entry page and Kept card, Back to the Log, off
  the Leaderboard, an old link; no card on an ordinary entry; axe and readability of the card (proved by dimming it);
  Delete's message; Add to leaderboard back to the same product with its purchases, notes, photos and ratings; not on an
  archived product, offline; Actions readable); `people.spec.ts` (no Return to Log on a friend's product).
- **Spent, card photos and Back (D62, 0.52.0).** `names.ts`: `spentOn(products, key)` replaces `spentAt`: the
  `totalPaid` of every purchase whose product's Source has the key or whose Supplier has it, once each, archived
  products left out, to the penny. `Brands.tsx`: each name carries `spent`; `Sort` gains `'spent'` ("Most spent", third,
  ties A–Z); a card's `.sub` is "N products · £X spent" and `.sub.best` "best: …"; `BrandPage`'s third tile is always
  **Spent** (`spentOn`). `TheirBrandPage` unchanged. CSS: `.scard-ph` is `position: relative` and its `img`
  `position: absolute; inset: 0` (in the grid, the img's 100% height didn't resolve, so a photo taller than the 92px box
  spilled out and was clipped). Router: `record()` sets `history.scrollRestoration = 'auto'` for **every** entry it leaves
  (before, only `openRow` / `openPlainRow`; iPhone shows its picture of the screen underneath a swipe-back only when that
  entry restores its scroll), then `'manual'` for the new one; `openRow` without the flight and `openPlainRow` are
  `navigate`. On `popstate` the page goes to the scroll saved for that path (`scrollByPath`, 0 if none) instead of the
  top, then `land(y)` (`scrollReturn.ts`) keeps putting it there for up to 1s (content still loading; Chromium's scroll
  anchoring) unless a touch, wheel or key takes over or `restoreRow` (a list returning to its row) takes over. Tests:
  `test/domain/names.test.ts` (`spentOn`: brand and shop at once counted once, brand only, never bought, archived,
  pennies); `brands.spec.ts` (tiles and card lines with Spent, Most spent and a big buy that reorders it, a tall photo
  filling its box exactly, shown to fail on 0.51.1's CSS); `motion.spec.ts` (Sources → a brand and Settings → Export,
  scrolled, back by swipe and by the Back button: the entry is `'auto'` and it lands to the pixel; tab switches start at
  the top; fails on 0.51.1's router). Test fixes: `wholeScreenContrastFailures` waits for `networkidle` before
  measuring (Settings' privacy summary arriving ~0.3s late moved the headings between measuring and photographing them;
  reproduced by delaying `/api/privacy`); `cutout.spec.ts`'s Restore background step, which failed once on CI (PR #74) and
  never locally (repeats, 2 CPUs beside the real AI, delayed answers), now reports what was on screen if it fails.
- **Sources and Settings tabs (D61, 0.51.0).** `chrome.tsx`: `Tab` gains `'sources'`; `TABS` Leaderboard, Log, Sources
  (`/sources`, `SourcesIcon` / `SourcesLineIcon`), People, Settings (key `'more'`, path `/more`, `SettingsIcon` /
  `SettingsLineIcon`; `MoreLineIcon` and D59's `StoreIcon` gone). `main.tsx`: `/sources` and `/more/brands` → `BrandsList`.
  `screens/Brands.tsx`: `BrandsList` is the tab (header title "Brands & suppliers", `MeButton` right, no Back, `TabBar`
  `sources`); cards `.scards` / `.scard` (two columns; `CardPhoto`: the top product by `rankProducts` Overall, its first
  photo's thumb, `.cut` for a cut-out, else `TypeMark`; `.scard-top` name and `.avg`; `.sub` count and "best: …" when
  rated; `RoleTags`); `.scard` lifts like a row (press, D20). `BrandPage`'s tab is `sources` when `cameFrom()` starts
  with `/sources` (Back to `/sources`), else `leaderboard`. `names.ts` loses `nameRoleText`. `More.tsx`: header "Settings",
  no Brands row. `NameSuggestions`: a click with `detail` > 0 blurs the box, `detail` 0 (keyboard) focuses it; the
  Editor's `leaveSource` / `leaveSupplier` and the Supplier pick update the form functionally, so a pick and the blur
  after it can't undo each other. Tests: `brands.spec.ts` (the tab, cards and photo, two a row, sort, search, axe,
  whole-screen contrast shown to fail with `.sub` dimmed, Sources kept lit, Back, `/more/brands`; suggestions close the
  keyboard, Enter returns to the box), `tabbar.spec.ts` (five tabs, a fifth each, labels fit), `more.spec.ts` (12 rows,
  "Settings"), `header.spec.ts`; "More" → "Settings" in the other specs.
- **Smokes removed (D60, 0.50.0).** Deleted: `shared/domain/smoke.ts`, `server/routes/smokes.ts` (`/api/smokes` is a 404),
  `client/src/smokes.ts`, `client/src/screens/Smokes.tsx`, the Smokes CSS, `FlameIcon` / `FlameLineIcon` / `SparkIcon` /
  `ClockIcon` (the time box went with them), and the tests `smoke.test.ts`, `smokes.test.ts`, `smokesOff.test.ts`,
  `smokes.spec.ts`, `smokes-off.spec.ts`, `mostused.spec.ts`. `RankBy` loses `'used'` (`rankByOptions` / `resolveViewState`
  take only `money`; a stored `used` resolves to Overall and is overwritten). `Privacy` keeps five switches;
  `validatePrivacy` drops unknown keys, so an old app or file sending the Smokes switches is taken without them;
  `effectivePrivacy` / `privacySummary` take no site features. `SharedProduct` has no `smokeCount` / `smokes`, and the
  board and preview responses no `options`. `/api/auth/me` no longer sends `features`. Export files carry no `smokes`;
  `checkExportFile` / `validateRestore` ignore them in older files, and the client strips them before restoring. Return to
  Log and promotion no longer move smokes. `wrangler.jsonc` and the test configs have no `SMOKES`; the tests run one
  server each again (no `liveApiBase`, no `LIVE_PORT`; the Playwright server says it's live, no `SITE`).
  `migrations/0010_remove_smokes.sql`: `DROP TABLE smokes` and `ALTER TABLE privacy_settings DROP COLUMN` ×3 (applied by
  CI before the deploy, so the old build can fail on Privacy for the few seconds in between). Tests: `privacy.test.ts`
  (domain: five switches, old settings read; API: no smoke keys or options on the board, old switches dropped, `/api/smokes`
  404), `data.test.ts` (an old restore payload with smokes and Smokes switches restores without them; the table and columns
  are gone), `data.spec.ts` (an export has no smokes; a 0.49.0 file with smokes restores), `tabbar.spec.ts` (four tabs, the
  old addresses open the Leaderboard), `privacy.spec.ts`, `datascreens.spec.ts`, `header.spec.ts`, `leaderboard.spec.ts`.
  The §4 notes on Smokes (D43), Most used (D44) and the Smokes switch (D46) below are history.
  *Found while testing:* coming back from a re-rated product, `scrollReturn.ts` `keep()` undid the list's own late scroll
  restore for only 800ms after `restoreRow`; a Back flight slowed by a busy machine outlasted that, and the restore landed
  after it (the row off screen; once on a 4-worker run). Its checks now start when the flight's hold ends
  (`whenReleased` in `scrollHold.ts`). `leaderboard.spec.ts` "§17, slowly" replays it with animations at a fifth of their
  speed (CDP `Animation.setPlaybackRate`): it fails without the fix.
- **Brands and suppliers (D59, 0.49.0).** `shared/domain/names.ts`: `nameKey` (`normaliseSearch` without spaces),
  `usedNames(products)` (non-archived; per name: the spelling used most, ties to a capitalised one then A–Z; `products`,
  `brand`, `shop` counts, each product once), `suggestNames(used, typed, { first })` (`SUGGESTION_LIMIT` 4; nothing typed
  → the most used; `matchesName`: the key or a word starts with it; an exact key → no names, `savedAs` when spelt
  differently; no match and 4+ letters → near misses, 1 letter apart under 6 letters else 2, also against the name's
  start: `typo`), `canonicalName` (the used spelling, else `autoCapitalise`), `productsNamed`, `nameRoles`, `spentAt`,
  `nameRoleText`. Editor (`screens/Editor.tsx`): `used` from `cachedProducts()` (fetched if not loaded); Source's and
  each Supplier's `TextField` (new `onFocus`; `onBlur` gets the event) set `suggesting`; `components/NameSuggestions.tsx`
  draws inside the field's `.two-col` (`.two-col > .suggest`: full width, below both boxes, next in Tab order); its
  buttons `preventDefault` on `pointerdown` so a tap never takes focus from the box (the keyboard stays), then focus the
  box. Leaving the box (`leaveSource` / `leaveSupplier`, not when focus moves into `.suggest[data-for]`) closes it and
  saves `canonicalName`. Product pages: `components/NameLink.tsx` (`brandPath(name, board?)`, `.namelink`, green with a
  chevron) on Details' Source and Price history's supplier (`Profile.tsx`) and a friend's Source (`SharedProfile`, to
  `<board>/brands/<name>`). `screens/Brands.tsx`: `BrandPage` (`/brands/:name`; `rankProducts` Overall over
  `productsNamed`; `ProductRow`'s new `meta` replaced by `RoleTags`, `.role.brand` / `.role.shop`; Back to
  `/more/brands` or `/`, tab More when opened from under /more, else Leaderboard), `BrandsList` (`/more/brands`; search
  `#brand-search` with `matchesName`; `.brand-sort` pills with `aria-pressed`); `screens/Person.tsx`: `TheirBrandPage`
  (`/u/:username/brands/:name`, `/more/privacy/preview/brands/:name`: their board's products by Source key, `SharedRow`,
  Products and Average tiles). More: `Row label="Brands & suppliers"` (`StoreIcon`, value = how many names). Tests:
  `test/domain/names.test.ts`; `test/e2e/brands.spec.ts` (suggestions, keyboard, typo, spelling saved, Supplier's
  Source first, both links, the page's tags and tiles, More's list, a follower's page, Source not shared, the
  preview; axe; whole-screen contrast of the tags, shown to fail with them dimmed); `more.spec.ts` (13 rows).
- **Sounds and ticks (D56, 0.47.0).** `client/src/sounds.ts`: `play(moment, set?)` (`switch`, `save`, `log`, `delete`,
  `first`; sets `soft`, `woody`, the owner's picks from the test page) builds each sound from sine voices (Woody adds a
  4× partial and a band-passed noise knock) on one lazily made `AudioContext` (master gain 0.54, the test page's 60%),
  after setting `navigator.audioSession.type = 'ambient'` where it exists (silent switch, mixes with music); it sleeps
  (`suspend`) 10s after the last sound or touch. `installSounds()` (main.tsx): every `pointerdown` wakes it (a sound
  after a save comes after the server answers, outside the tap), and a `change` on any `input.switch` plays `switch`.
  Each play dispatches a `gt-sound` event (`{ moment, set }`) for the tests. Settings in localStorage: `gt-sounds`,
  `gt-ticks` (`'off'` turns off; anything else is on) and `gt-sound-set`. Moments: `Editor.save` (`first` when the
  saved product is #1 by Overall over `cachedProducts()` (`rankProducts`, filter All) and wasn't before, `topProduct()`;
  not when the list isn't loaded), `LogEditor.save` and Profile's `moveToLog` (`log`), LogEntry's `remove`,
  `EditorPhotos.remove` and People's profile photo `remove` (`delete`). *Ticks:* `ticksSupported()` is
  `'switch' in HTMLInputElement.prototype` (iOS 18+ Safari). Only a real tap on the switch or its label ticks, so
  `components/Tick.tsx` renders an empty `label.tick[for=gt-tick][aria-hidden]` filling its button (`.has-tick` is
  `position: relative`); it labels one hidden `input#gt-tick.tick-switch[type=checkbox][switch][tabindex=-1]`
  (`TickSwitch`, rendered once in main.tsx, fixed, 1px, transparent) outside every button, because a control inside a
  button fails axe's nested-interactive (a label isn't a control). The label's click stops propagating and presses its
  button with `setTimeout(() => button.click())`: a label flips its control only after its click has been dispatched,
  and the button's handler would already have redrawn (Saving…, a sheet closing) and taken the label away (found in
  testing: no flip). Keyboard and VoiceOver press the button itself, with no tick. On the Save buttons (while enabled),
  the viewer's Remove, and `Sheet` options with `tick: true` (Delete entry, Remove photo ×2, Return to Log). The app's switches spread `switchAttr()` (`switch` while Ticks is on).
  `AppearanceScreen` gains `SoundsSection` (`section[aria-labelledby=ap-sounds]`: Sounds and, where supported, Ticks
  switches; then `ap-sound-set` radios while Sounds is on, a click plays `save` in that set; footnote "Saved on this
  phone only"); a change redraws the whole screen. Tests: `sounds.spec.ts` (each moment's sound; Appearance; ticks with
  the switch control pretended into Chromium: the label fills Save, the tap flips `#gt-tick`, one PUT, one DELETE, axe).
- **Sounds and ticks screen (D57, 0.48.0; D58, 0.48.1).** `screens/Sounds.tsx`: `SoundsScreen` at `/more/sounds`
  (main.tsx) holds what D56 put in Appearance (`section[aria-label="Sounds and ticks"]` with the Sounds and Ticks
  switches, then `#ap-sound-set` radios while Sounds is on, footnote); More's Appearance group adds
  `Row label="Sounds and ticks"` (value On / Off from `sounds().on`, `SoundIcon`, tint green). `sounds.ts` sets
  `navigator.audioSession.type = 'ambient'` (`setSession(SESSION)`) at the start of every `audio()` call, not only
  when the context is made: set once (0.47.0), the Home Screen app played on silent; set every time, it is quiet
  (D58). Each context has its own volume node (`volume(c)`). 0.48.0's dev-only Silent test (`silentTest`, three
  buttons trying `ambient`, `auto`, `transient`) was removed in 0.48.1: all three were quiet. Tests: `sounds.spec.ts`
  (the screen and the More row; with `navigator.audioSession` pretended in, a sound sets `ambient` again after it
  was changed; fails when it is set once), `more.spec.ts` (12 rows).
- **Late loads (D55, 0.46.1).** `client/src/products.ts` keeps a per-product change mark: `changing(id)` (called as a
  change starts: `setFlag`, `saveProduct`, and Profile's `toggle`, `saveCrop`, `saveCutout`, `saveCover` before their
  optimistic `setProduct`) and `changeMark(id)`. `fetchProduct` reads the mark before the GET and doesn't `remember`
  the answer if it moved; Profile's opening fetch also drops it rather than `setProduct`. A change's own response is the
  fresh copy. Tests: `staleload.spec.ts` (Private and Set as cover with the opening GET held back until after the
  change; both fail without the fix).
- **Privacy (D45, 0.38.0).** Rules in `shared/domain/privacy.ts`: `Privacy` (eight booleans), `DEFAULT_PRIVACY` (as before
  0.38.0), `PRIVACY_NEEDS` / `privacyEnabled` / `effectivePrivacy` (a switch whose prerequisite is off counts as off),
  `validatePrivacy` (a full set of booleans, unknown keys dropped), `privacySummary` (More's line). Table `privacy_settings`
  (`migrations/0007_privacy.sql`; no row = defaults; cascades with the user). Server: `server/lib/privacy.ts` (`loadPrivacy`,
  `loadEffectivePrivacy`, `savePrivacyStatement`), `server/routes/privacy.ts` (`GET` / `PUT /api/privacy`, `GET /api/privacy/preview`:
  your own board through the same `shareProducts` followers get). `server/lib/social.ts`: `shareProduct(p, tieRank, privacy, smokes)`
  blanks Source / Country / photos when off and adds `smokeCount` / `smokes` (`SharedSmoke`: date, time, amount; never effect) only
  when on (`SHARED_PRODUCT_OPTIONAL_KEYS`); `shareProducts` returns nothing when the board isn't shared; `sharedSmokes` reads product
  smokes only when needed; `photoVisibleSql` (D23) gains "and the owner hasn't switched it off" inside the not-yourself branch, so it
  can only narrow. `people.ts` `sharedFor` loads the owner's effective settings on every request and returns `options.mostUsed`;
  `photos.ts` refuses a follower a product photo file while the owner doesn't share photos. Restore saves the file's `privacy`
  (`RestorePayload.privacy`, optional); the export includes it. Client: `client/src/privacy.ts`; `screens/Privacy.tsx`
  (`PrivacyScreen` at `/more/privacy`: `section.pv[aria-label="What followers see"]` with `.pv-row`, `.pv-line`s and Open their
  view; groups of `label.li.priv-row` with `input.switch[role=switch]`, saved one flip at a time and put back on failure,
  disabled offline or when their prerequisite is off (`.off`, the note becomes "Needs “…” on."; the text stays full strength));
  More's Privacy group (`Row` gains `sub`, tint `violet`); `Person` / `SharedProfile` take `preview` (routes
  `/more/privacy/preview` and `/more/privacy/preview/p/:id`, `.pv-note`, the More tab), Rank by offers Most used on a friend's
  board when `options.mostUsed` (`rankByOptions(…, { money: false, used })`, `loadOthersView(used)` / `saveOthersView(next, used)`:
  a stored Most used comes back on a board that offers it), `SharedRow` shows the flame, `SharedSmokes` draws the follower's card.
  Export's "In the file" list adds "Your privacy settings". Tested: `test/domain/privacy.test.ts` (defaults, prerequisites,
  summary, validation, a friend's Rank by); `test/api/privacy.test.ts` (on raw responses: defaults, Source / Country / photos off
  including the photo files, counts / Most used / smokes on in turn and never an effect or the Log, the board off whatever else,
  the profile photo off in the card, lists, requests, search and its file, a stranger still refused, the preview equal to the
  follower's response, restore with and without settings; the photo-file and profile-photo checks each fail when removed);
  `test/e2e/privacy.spec.ts` (More's row and summary, defaults, greyed Most used with its reason, preview above the switches,
  Source off in the preview and the follower's board and page, counts → Most used → smokes on a follower's page and board, the
  board off, Open their view, axe, pixel contrast); `more.spec.ts` (the new row and group), `datascreens.spec.ts` (the Export line).

- **Dev site (D47, 0.40.0).** `wrangler.jsonc` gains `env.dev` (Worker `green-tracker-dev`; D1 `green-tracker-dev`, R2
  `green-tracker-dev-photos`; vars `RP_ID` / `ORIGIN` for its address, `SMOKES: "on"`, `SITE: "dev"`; bindings and vars
  aren't inherited, so all are listed). The Vite Cloudflare plugin builds it when `CLOUDFLARE_ENV=dev`; `vite.config.ts`'s
  `siteName()` then renames the page title, `apple-mobile-web-app-title` and the manifest's names to "GT Dev" (the live build is
  untouched). `server/env.ts` `SITE`; `/api/auth/me` returns `site: 'dev' | 'live'`; `Header` and `SignIn` show
  `b.dev-badge` ("DEV", dark on `--warning`) when it's `dev`. CI (`.github/workflows/ci.yml`): pushes to `dev` run the tests
  then `deploy-dev` (`npm run deploy:dev`; no check from outside, as the lock keeps it out); pushes to `main` deploy live as
  before. The lock is Cloudflare Access (Zero Trust, free plan) on the Worker (its Access tab, scope "All traffic"), policy
  "Cloudflare account": only members of the owner's Cloudflare account, who sign in with their Cloudflare login (set up
  2026-10-12; inviting anyone into the Cloudflare account would let them in too). Tested: `test/domain/siteConfig.test.ts` (live has no Smokes, DEV label or test-only vars; dev
  has Smokes, the label, its own address, database and bucket); `test/api/smokesOff.test.ts` (`site` on both servers; the
  main API test server is set up like dev); `test/e2e/dev-site.spec.ts` (no label on live; on dev the label on every screen,
  inside the header bar, readable, axe; on the sign-in screen).

- **Smokes switch (D46, 0.39.0).** *(Removed in 0.50.0, D60.)* One Worker variable, `SMOKES` (`"on"` enables; unset on the live site in `wrangler.jsonc`),
  read by `siteFeatures(env)` in `server/env.ts` → `SiteFeatures { smokes }` (`shared/domain/privacy.ts`). Server:
  `/api/auth/me` returns `features` (signed in or out); `server/routes/smokes.ts` refuses anything but `GET` with 404 when off
  (reading stays, for the export); `effectivePrivacy(p, features)` turns `SMOKE_PRIVACY_KEYS` off when Smokes is off, used by
  `loadEffectivePrivacy(db, id, features)` (people, photos) and the Privacy preview, so nothing about smokes reaches a follower
  while the stored settings are kept. Restore and promotion still carry smokes. Client: `useSmokesOn()` (`session.ts`, from
  `me.features`); `TabBar` drops the Smokes tab (`.nav .tabs` is a column grid, so four or five tabs share the bar);
  `main.tsx` routes `/smokes…` to the Leaderboard; `Leaderboard` / `Profile` pass `used` to `ControlRow`, `loadView(used)` /
  `saveView(next, used)` (a stored Most used is shown as Overall but not overwritten) and `useSmokes(load)` skips the fetch;
  `Profile` / `LogEntry` hide `SmokesCard`; `PrivacyScreen` drops the Smokes group; `More` passes the features to
  `privacySummary`; `Data.tsx` drops the smoke lines. Tests run two servers: the API tests (`test/api/globalSetup.ts`,
  `liveApiBase`, `Browser(ip, base)`) and Playwright (`playwright.config.ts` `webServer` array, `LIVE_PORT` 8789,
  `test/e2e/server.mjs` with `E2E_SMOKES`, a store per port) each have one with Smokes on (as on the dev site; the rest of the
  suite) and one with it off (as on live). `test/api/smokesOff.test.ts` (features, writes refused, saved smokes kept and
  exportable, followers get nothing about smokes whatever the stored switches, everything else as before; four of five fail
  with the switch ignored), `test/domain/privacy.test.ts` (effective settings and summary), `test/e2e/smokes-off.spec.ts` (four
  equal tabs, Smokes addresses, Rank by and the kept Most used, product and Log entry pages, Privacy and More, Data screens, a
  follower's view, axe, tab-label contrast; all but the follower test fail with the client switch ignored).

- **Most used (D44, 0.37.0).** *(Removed in 0.50.0, D60.)* `RankBy` gains `'used'` (shared/domain/leaderboard.ts): `rankByOptions` offers it second when
  `money` is true (your own board; a follower's view, `money: false`, never has it, and `resolveViewState` drops a stored one there,
  in the separate `gt.view.others` setting, so your own choice stays); `rankByCaption` → `TIMES`; `rankValue` is
  `RankableProduct.smokeCount` (0 or absent → null, so it's left out like an unpriced product); `rankProducts` breaks a tie under
  Most used on `overall()` (unrated last) before `tieBreak`. `scoreHeat` returns null for it (plain, like price and VFM). Client:
  `withSmokeCounts` (client/src/smokes.ts) adds each product's count from `useSmokes`; `Leaderboard` waits for the counts only
  under Most used (otherwise it draws at once), shows `p.footnote` "N never smoked, not shown. Ties go to the higher Overall." for the
  visible type, and `BoardEmpty` has a Most used case (`EmptyCard art="smokes"`, Add a smoke → `/smokes/new`, Rank by Overall).
  `Profile` ranks with the same counts for its podium place (`data-podium` set once they're known). `ProductRow` → `Score` with
  `flame`: `.score.used` puts `FlameIcon.flame` (`--warning` amber, 15px) beside the `b` (`formatRankValue` → a whole number) with
  the caption spanning both; on a tier row only the `b` takes the flowing text. Tested: `test/domain/leaderboard.test.ts` (options
  with and without money, order, left out, ties on Overall then the usual order, the filter, page place, badge, rank-empty);
  `heat.test.ts` (no heat); `test/e2e/mostused.spec.ts` (the empty case, order and counts, the flame amber and beside the number,
  TIMES, the footnote, tiers on three and plain below, three digits fit, axe, pixel contrast of the podium counts and captions
  through the motion (fails with the caption dimmed), the Type filter, the product pages' place and badge, a new smoke reordering,
  a friend's board not offering it and your own choice kept). The 375px label test (`leaderboard.spec.ts`) covers "Most used".

- **Smokes (D43, 0.36.0).** *(Removed in 0.50.0, D60.)* Rules in `shared/domain/smoke.ts`: `validateSmokeFields` / `validateSmokeInput` (a real `YYYY-MM-DD`
  date not after `latest`, `HH:MM` 24-hour time, amount > 0 or null, effect trimmed to null when blank and ≤ 500 characters,
  exactly one of `productId` / `logEntryId`), the wording (`smokeVerb`: "taken" for edibles, "smoked" otherwise; `timesText`,
  `timesCaption`, `smokeAmountText`), and the days (`sortSmokes`: date, time, then later-added first; `groupByDay`, `weekStrip`
  the 7 days ending today, `smokeTotals` those days and this calendar month, `dayLabel` Today / Yesterday / "Tue 6 Oct" (a year
  only when it differs), `whenText`, `recentTargets`, `smokesOf`). Dates and times are the phone's own, stored as typed, so they
  never move with time zones; counts are derived, never stored. Table `smokes` (`migrations/0006_smokes.sql`): `product_id`
  or `log_entry_id` (a CHECK keeps exactly one; both cascade), `date`, `time`, `amount`, `effect`, timestamps.
  Server (`server/routes/smokes.ts`, `/api/smokes`): GET your list newest first; POST and PUT check the fields with `latest`
  = the server's today + 1 day (it can't know your time zone; the phone checks against its own today) and that the product or
  entry is yours (else 404); DELETE. Every query is scoped by `user_id`; the follower routes (`people.ts`) never touch the
  table. Promotion (`log.ts`) moves the entry's smokes (`UPDATE smokes SET product_id …, log_entry_id = NULL`) in the same batch
  as creating the product, before deleting the entry; deleting an entry cascades. Restore (`data.ts`) deletes and re-inserts
  them set-based like the other rows (`RestoreProduct.smokes` / `RestoreLogEntry.smokes`, optional) and returns their count.
  The file (`backup.ts`): `ExportSmoke` (`date`, `time`, `amount`, `effect`, `createdAt`) in `smokes` on each product and Log entry,
  oldest first; absent in older files (format version unchanged, still 1); checked like any write (`validateSmokeFields`, no
  `latest`) and limited to 100,000. Client: `client/src/smokes.ts` caches the list (`useSmokes` hook, listeners), lights the last
  saved row once (`takeFresh`), and follows promotion (`moveEntrySmokes`), entry deletes (`dropEntrySmokes`), sign-out and
  restore (`clearSmokeCache`). `screens/Smokes.tsx`: `Smokes` at `/smokes` (`section.week[aria-label="Last 7 days"]` with seven
  `button.day`, disabled when empty, `jump` scrolls the day's `h2.group-h.sday-h` under the header; `section.sday` per day with
  `a.srow` rows → `/smokes/:id`; `Skeleton kind="smokes"`; `EmptyCard art="smokes"` (a flame over a week of ticks); the + →
  `/smokes/new`); `SmokePicker` at `/smokes/new` (Recent, Leaderboard, Log as `button.lrow.pick` with the count, a "Nothing called
  …" line, New Log entry → `form.newlog-form` → `saveEntry` → the form); `SmokeForm` at `/smokes/new/p|e/:id` (opened from the
  picker with `replace`, so Cancel and Add smoke go back to where + or Add a smoke was tapped; Change only when it came from the
  picker) and `/smokes/:id` (Save, Delete smoke behind a Sheet; a smoke that's gone → the tab); `SmokesCard`
  (`section.sect.smokes-card`, `.tile.smk-count`, `.smk-last`, three `a.smk-row`, Add a smoke) used by `Profile` (after Ratings,
  `canAdd` unless archived) and `LogEntryPage` (after the poster; its Delete message counts the smokes). `TextField type="time"`
  shares the date box with a clock icon. The tab bar is five columns (`TabBar`, `FlameIcon` / `FlameLineIcon`). The Data screens
  add "Every smoke" to Export's list and Delete account's, and the count to Restore's line and question. Tested:
  `test/domain/smoke.test.ts` (checks, wording, day labels across month and year ends, grouping, strip, totals, Recent);
  `test/api/smokes.test.ts` (add / list / change / delete, the checks, someone else's product or smoke is a 404, nothing in a
  follower's responses, promotion moves them and a failed one doesn't, deleting an entry and archiving a product, restore and an
  older file, a bad smoke stops the restore); `data.test.ts` (the restore count, Delete account empties the table);
  `test/e2e/smokes.spec.ts` (empty tab and strip, + → picker → form → row, Recent and search, edible mg and "taken", the
  product card and Add a smoke from it with the last amount, a future date refused, change and delete, New Log entry, the strip
  jumping and grouping with five bars for six, promotion, deleting an entry, archived, a follower sees nothing; axe on each
  screen); `tabbar.spec.ts` (five tabs, Smokes second, each a fifth, the names fit, solid and outline on Smokes too);
  `header.spec.ts` (your photo on the five tabs, not on the picker or form); `data.spec.ts` (smokes in the file, restored to the
  right rows); `datascreens.spec.ts` (the new lines).

- **Purchases in the editor (D42, 0.35.0).** In `Editor` (screens/Editor.tsx) each purchase is `div.pcard[role=group]` ("Purchase N")
  holding `button.psum` (`aria-expanded`, `aria-controls`): `.l b` the date (`formatIsoDate`, else "No date") and `.tag-latest`, `.l > span`
  the amount (`formatAmount`) · total (`formatGBP`) · supplier, or the amber `.warn` line when there's no total; `.r` the unit price
  (`formatUnitPrice`, else "—", rounded font); a chevron that turns down when open. `openPurchase` holds the one open key; the open card
  shows `.pbody` with the four `TextField`s and `.pcard-foot` (the price or the amber note, and Remove with TrashIcon). Latest is
  `latestPurchase` (shared/domain/money.ts) over the drafts with a readable total, entry order as `seq`. Add purchase (`.addrow.dashed`)
  opens the new one and focuses its Amount (`focusAmount`). On a failed Save, `blockingPurchase` finds the first purchase that can't be
  read or that the shared rules refuse (validating it alone) and opens it. The summary rows light up when pressed (D20, like rows in a
  card). Tested (`test/e2e/purchases.spec.ts`): folded rows with their titles, lines and prices (Latest on the newest by date, not the
  last entered; "No date"; "—"; £/mg), rounded price, a long supplier cut short; opening one folds the other, the row follows edits;
  Add purchase at the bottom, open, dated today, Amount focused, amber note, Latest moving to it, saved; Remove and Cancel; a bad number
  opening its purchase on Save; axe and pixel contrast. `products.spec.ts` and `editor.spec.ts` open a saved purchase before using its fields.

- **A Log entry's page (D41, 0.34.0).** `LogEntryPage` (screens/LogEntry.tsx) at `/log/:id`; `LogEditor` moves to
  `/log/:id/edit` (main.tsx routes `/log/:id`, `/edit`, `/promote`). The page draws the Poster's markup (`.poster` /
  `.hero-photo` / `.hero`, D27) without a score: `span.log-tag` ("In your Log", green on a dark pill, measured on the photo)
  and the `h1`. `section[aria-label="Details"]` lists Type, Concentrate type, Country, Amount (`formatAmount`) and Logged
  (`formatDate(createdAt)`), skipping empty values. `section[aria-label="Actions"]`: Add to leaderboard (`startPromotion` with
  `promotionInput(logEntryToInput(entry))` and `draftsFromRecords`, then `/log/:id/promote`), Edit (a link, like the header's)
  and Delete entry (the same Sheet, then `back('/log')`); the first and last are disabled offline (`useOnline`). The photo opens
  `PhotoViewer` with no crop or cut-out tools (they stay in the form). Loading shows `Skeleton kind="product"` (D37); a 404 (a
  promoted or deleted entry reached through Back) replaces it with the Log. `LogEditor`: Cancel and Save go `back()` to the
  page for a saved entry, to the Log for a new one; its Add to leaderboard, Delete and their sheet are gone. Log rows
  (screens/Log.tsx) open an entry with a photo through `openRow` (the flight, transitions.ts, finds `.hero-photo` as on a
  product page) and one without through `openPlainRow`. Tested (`test/e2e/logentry.spec.ts`): the page with a photo, without
  one and with a cut-out; the Details rows and the date; the three actions and the header's Edit; Edit → Cancel / Save back to
  the page; the viewer; Delete asking first and an old link to a deleted entry; offline; axe and pixel contrast of the tag and
  name on each (fails with the tag dimmed). `motion.spec.ts`: an entry with a photo flies in and home, one without doesn't;
  `log.spec.ts` (page → Edit → Save; Delete; promotion from the page, Discard returning to it), `country.spec.ts` and
  `editor.spec.ts` open the form at `/edit`.

- **Data screens (D40, 0.33.0).** `ExportScreen`, `RestoreScreen` and `DeleteAccount` (screens/Data.tsx) share `DataHero`
  (`div.data-hero`: a 64px `.data-mark.teal|red` tile with a glowing icon, an `h1`, one sentence) and `.data-card` (green, `.teal`
  or `.red` wash). Export: `section[aria-label="In the file"]` with `ul.checks` (`li.yes` CheckIcon, `li.not` DashIcon); the
  Save to Files note shows only while nothing else is. Restore: one file picker (a `label.btn` round the input, its words and
  `aria-label` "Choose an export file", then "Choose a different file" below the Replace button; dimmed via
  `label.btn:has(input:disabled)` while restoring); `section[aria-label="File contents"]` holds `.file-head` (FileIcon tile, the
  chosen file's whole name, wrapping, and "Exported … by @…"), `.data-tiles` (Products without archived · Log · Photos, rounded
  numbers) and a hint with the archived count and the profile photo line (`PROFILE_PHOTO`: included / yours will be removed /
  yours stays). The Replace button is `.btn.danger-out`. Delete: `section[aria-label="What goes"]` (`li.gone` CrossIcon),
  `a.data-link` to /more/export (lifts and lights green, D20), `.input.armed` (red edge) once the username matches, FaceIdIcon
  on the button. `ProgressCard`: `role="progressbar"` with the "Adding photos: N of M" / "Uploading photos: N of M" words as its
  name and `aria-valuenow` / `-max`, a teal bar (width eased 0.3s, still under Reduce Motion), replacing the Replace button on
  Restore. New icons: FileIcon, FaceIdIcon, DashIcon. Tested (`test/e2e/datascreens.spec.ts`): each screen's tile, heading and
  card; Export's bar at 1 of 2 and 50% with a photo held back, then the green "Exported …" line; Restore's file name, tiles and
  hint, the picker's new words and place, the bar at 0 of 2 with the uploads held back and the picker dimmed; Delete's five
  crosses, the armed box and button, Export first opening Export; axe and pixel contrast on all three (two halves each; it fails
  with the sentence dimmed). `data.spec.ts` still runs export → restore → delete end to end; it, `cutout.spec.ts` and
  `profile.spec.ts` find the Replace button below the card and read the new profile photo lines.

- **Loading placeholders (D37, 0.30.0).** `Skeleton` (components/Skeleton.tsx) renders nothing for 250ms, then
  `div.skel.skel-{board|log|product|people}` (`role="status"`, `aria-label="Loading"`, shapes `aria-hidden`); each `.sk`
  carries a `::after` sweep (`sk-sweep`, 1.4s, only under `prefers-reduced-motion: no-preference`). On unmount after being
  seen it puts `.sk-reveal` on `.screen` for 300ms, fading the real content in. Used while `products`/`entries`/`person`/
  `product`/the People lists are still null and there's no error: Leaderboard, Log, Person (both before the card and before
  the products), Profile and SharedProfile, People's three lists. Tested (`test/e2e/loading.spec.ts`, holding the request
  back with `page.route`): the board's 6 rows and 3 tiles with the sweep, then the real rows; nothing in the first moment;
  still under Reduce Motion; an error replaces the shapes; the Log, product page, People and a friend's board shapes.

- **Welcome screen (D36, 0.29.0).** `SignIn` (screens/SignIn.tsx) is `main.fullscreen.welcome`: `.brand` (LeafGlass and the
  `h1`), `.headline` (its `em` in a green gradient), the lead, the deleted-account notice, then `Showcase`: a `figure` whose
  `.fan` (`aria-hidden`, `pointer-events: none` on the figure) holds three `div.row`s built from the real `Thumb`, `Cluster`,
  `Score`, `Glints` and `heatStyle` with fixed example products (`EXAMPLES`; since 0.32.0 the three are `tier p1`…`p3`, the third
  Gold, D39, so `heatStyle` is no longer used there), rotated −2°, 1.5°, −1°, and a `figcaption`. Under
  760px tall the headline shrinks, the rows slim to 60px and lose their tag line. `AuthMark` (components/chrome.tsx) is the 56px
  glowing leaf tile above each heading of CreateAccount's three steps, Recover and NewPasskey; `.steps i.on` glows; the
  username field sits in a `.fgroup`. Tested (`test/e2e/welcome.spec.ts`): the headline and the three rows in order with
  their tier looks, the caption; hidden from screen readers and a tap on a row does nothing; everything fits without
  scrolling at 390×844 and 375×667 with the rows clear of the buttons; the buttons' destinations; the leaf tile, glowing
  step and green card; readability through the shimmer. `accounts.spec.ts` checks the tile on Create your passkey and Add a
  new passkey; `data.spec.ts` the deleted-account notice on the new screen.

- **Tab bar outlines and glow (D35, 0.28.0).** `TabBar` (components/chrome.tsx) draws the current tab's solid icon (P1's
  `BoardIcon` etc., class `tab-on`) and the others' outlines (`BoardLineIcon`, `LogLineIcon`, `PeopleLineIcon`,
  `MoreLineIcon` in icons.tsx: the same shapes in 1.7px lines, the podium's star still solid; class `tab-off`); each name
  sits in `.tab-l`. `.tab[aria-current="page"] svg` has `drop-shadow(0 0 8px rgba(88,224,140,0.65))` and `::after` is an
  18×3px `--accent-bright` line with its own glow; D18's `::before` bubble is gone. Tested (`test/e2e/tabbar.spec.ts`): on
  each of the four tabs only that tab is solid, glowing, underlined and green, the others outlines in grey, no bubble
  anywhere; the People badge; readability of the names. `quality.spec.ts`'s green-look check now looks for the glow and
  line instead of the bubble.

- **Editor tidy-up (D34, 0.27.0).** `GroupHead` (components/inputs.tsx) draws each editor heading: `.gh` with `.gh-ic` (a
  24px soft-green square holding a 15px outline icon from icons.tsx) and the caption; the Ratings one carries `.gh-ov`
  (Overall, `--num-font`, coloured by `scoreHeat('overall', o)`, `.none` for the dash). `RatingInput` takes the rating's key
  and an optional `note`: a noted (weight 0) rating is `.muted` (grey fill and knob); otherwise a rated one gets `data-heat`
  and `--heat`, which colour `.slider-fill` (a gradient from a darker shade), `.slider-thumb` and `.val`. The slim rows:
  `.rate-top` 32px, slider 28px with a 4px track and a 22px knob (the 13px inset the drag maths uses is unchanged), `.clr`
  26px with a `::before` that keeps a 44px target. `TextField type="date"` wraps the input in `.datebox`: `CalendarIcon` at
  the left (above the input), 36px left padding, and the browser's `::-webkit-calendar-picker-indicator` stretched invisibly
  over the box. Tested (`test/e2e/editor.spec.ts`): every heading's icon in both editors, row heights (at most 64px, High
  with its note at most 72px, from 82px), the ✕'s 44px target, each rating's colour in number, knob and fill, the grey noted
  High and a coloured edible High, a cleared rating going plain, the live Overall and its colour (and dash), the date icon
  inside both date boxes, and readability; `products.spec.ts` reads Overall from the heading.

- **Drawings on the empty screens (D33, 0.26.0).** `EmptyCard` (components/EmptyCard.tsx) renders every empty state:
  `<div class="empty" data-art>` with an inline `svg.empty-art` (168×104, `aria-hidden`), the title and the caller's text and
  button. Ten drawings (`podium`, `filter`, `unrated`, `log`, `archive`, `shared`, `requests`, `followers`, `following`,
  `blocked`), drawn in `--accent-bright` lines 1.6 wide with a faint green fill (`.soft`), dimmer or dashed where something
  is missing (`.dim`, `.dash`); the leaf is the header's `FLOWER` path. The People lists and Blocked use `compact` (smaller
  card, no side margin; not `.small`, which is grey caption text). Add buttons are `.btn.primary` with `PlusIcon`. Error
  cards don't use `EmptyCard`, so they keep no drawing. `LeafOutline` and `.empty-line` are gone. Tested
  (`test/e2e/empty.spec.ts`): each empty screen shows its own visible green drawing, a white title (fails with the grey
  `.small` class), green + buttons only for adding, grey buttons elsewhere, a friend's board without Add, readability, and
  error cards without a drawing.

- **Rating bars in the heat colours (D32, 0.25.0).** `Ratings` (Profile.tsx, also used by a friend's page) gives a
  counting, rated bar `data-heat` and `--heat` from `scoreHeat(slot.key, value)` (the one colour rule, D30);
  `.rbar[data-heat] .fill` is `linear-gradient(90deg, color-mix(--heat 55% with --surface-1), --heat)` and `.v` takes
  `--heat`. Tested (`test/e2e/bars.spec.ts`): each bar's colour and number on a mixed flower, the grey High, an edible's
  coloured High, a partly rated product's plain bars, a friend's page, and readability of the coloured numbers from
  amber to mint (the first test fails without the change).

- **Podium metals mirror the heat (D31, 0.24.0).** *Replaced in 0.32.0 by D39's holo cards (see Podium tiers); the scores still flow through their tier's colours. As it was:* `.row.p2`–`.p4` draw `linear-gradient(270deg, rgba(var(--metal),
  var(--glow)), transparent 60%)` with `--glow` 0.26 / 0.2 / 0.15 (the product pages keep `--wash`). `.row.tier .score b`
  flows like the rank number (`tier-flow-text`); the metals' through `--t1`/`--t3`/`--t5` only. The metals' score
  caption is `--text`. The first mockup strength (0.42 / 0.32 / 0.25) and the full tier gradient in the score failed the
  row readability test when the shimmer passed (Diamond's score 2.1 : 1, caption 2.9 : 1), hence the softer glow, the
  lighter shades and the white caption. Tested (`leaderboard.spec.ts`): the metals' background starts with the 270°
  glow, the glow descends tier by tier, all four scores flow, and readability at 12 moments of the motion now judges
  gradient text by its darkest colour.

- **Leaderboard heat (D30, 0.23.0).** `scoreHeat(rankBy, value)` (`shared/domain/heat.ts`) returns the colour
  from five stops (4 `#e0a35c`, 5.5 `#f0c46a`, 6.8 `#c8e46a`, 8 `#6fe39a`, 9 `#8df3b6`), blended linearly, or null for
  price, VFM and unrated. `heatStyle` (`client/src/heat.ts`) puts it on a non-podium row as `data-heat` and `--heat`;
  `.row[data-heat]` draws a 270° wash (22% of the colour, fading out by 60% of the row) over `--surface-1`, a 32%
  edge, and the score in the colour. Used by `ProductRow` (your board, the Archive) and a friend's `SharedRow`.
  Tested: `test/domain/heat.test.ts` (ends, stops, blending, hue never moving back towards amber, no colour for
  price / VFM / unrated) and `test/e2e/heat.spec.ts` (which rows glow and in which colour, the podium and unrated
  rows plain, price ranking plain, a rating ranking coloured, a friend's board and the Archive, and readability of
  the coloured score and the text on the glow from amber to mint, measured from pixels; it fails with a harsh glow).

- **The Aurora (D29, 0.22.0).** Tokens in `client/src/styles.css`: `--aurora-top` (two radial gradients:
  green `rgba(88,224,140,0.2)` at 8% / -4%, teal `rgba(64,196,196,0.15)` at 100% / 6%) is the background of
  `.screen` and `.fullscreen`, in a 900px band at their top, so it scrolls with the page; `--aurora-bottom`
  (green at 6%) sits on the fixed `.bg-layer` (brief §11: the fixed background layer, never
  `background-attachment: fixed`), under the glass tab bar. The sticky `.controls` row is `rgba(5,8,7,0.3)` with
  the header's blur, the Log's `.group-h` headers `rgba(5,8,7,0.6)` with the same blur (were solid `--bg`).
  Overlays are unchanged (they paint their own black or `--bg`). Tested (`test/e2e/aurora.spec.ts`, from real
  pixels): green at the top-left and teal at the top-right, gone after scrolling while the bottom haze stays
  put; both lights on six screens and the sign-in screen; the country picker still plain; the controls row
  frosted with the light showing through; section titles, country headers and pill text readable on the
  lights. Each fails without the change.

- **Rounded numbers (D28, 0.21.0).** One token, `--num-font` (`ui-rounded, "SF Pro Rounded", var(--font)`), and
  one rule listing every number that uses it (`.row .rk, .score b, .tile b, .hero-score b, .podium-badge .n,
  .rbar .v, .vfm b, .rate-top .val`). `ui-rounded` is built into iOS and macOS Safari; other browsers skip it
  and fall through to the usual stack. Tested (`test/e2e/numbers.spec.ts`): each of those numbers asks for the
  rounded font, and names, prices, captions and purchase amounts don't (fails without the rule). Chromium on
  Linux has no rounded font, so how it looks is checked on the owner's iPhone.

- **The Poster (D27, 0.20.0).**
  - *One component* (`client/src/components/ProductHero.tsx`) draws the top of your product page and
    a friend's (which passes no price or flags). `.poster` pulls itself up by the header's height
    (`margin-top: calc(-1 * var(--header-h))`), so the photo runs behind the glass header; it's at
    least the header plus 380px tall and grows with its text. `.hero-photo` (still the Photo grows
    target and the button that opens the viewer) fills it, `object-fit: cover`, with the thumbnail
    underneath until the full photo arrives. `.hero` (the details) sits at the bottom with
    `pointer-events: none`, so a tap anywhere reaches the photo.
  - *The dark fade belongs to the text block* (`.hero::before`, from 130px above it to the bottom:
    0 → 55% → 86% → 94% → the page colour), so it's always behind the words however long the name,
    and the page continues seamlessly below. The small grey text (type, country, "Overall") is 84%
    white there.
  - *Cut-out / no photo* (`.poster.cut` / `.plain`): a green radial glow (the tier's colour on podium
    pages); the cut-out is drawn in a 200px band just below the header (image and loading thumbnail
    in one box, `width: calc(100% - 64px)`: an `<img>` keeps its own width rather than stretching
    between `left` and `right`, 0.20.1), the type mark centred in it;
    the details start below that band, so they can never cover it.
  - *Podium* (styles.css *podium product pages*): `.tiered .hero::after` is the haze, the tier's six
    colours flowing (`tier-flow-text`) at `--haze` 0.14 / 0.14 / 0.12 (0.32.0, D39; was 0.14 / 0.14 / 0.08 / 0.06), masked to fade at both
    ends; the shimmer and sweep stay on the photo (under the fade); glints below the header.
  - *Photo grows*: the photo flies alone; `html.vt-open` hides the details for the flight and they
    fade in (0.22s) once it lands. Back flies the whole poster photo home as before.
  - Tested (`test/e2e/hero.spec.ts`): edge to edge from the very top (behind the header), details on
    the photo's bottom, name and score side by side, a tap on the name opening the viewer, a cut-out and
    the type mark above the details (the cut-out centred, in the same box as its thumbnail, since 0.20.1), a long name wrapping without overflowing, and readability measured
    from real pixels across the podium motion over **an all-white photo and a busy bright one** (checked
    by deliberately weakening the fade: caught). `podium.spec.ts` checks each place's haze strength and
    speed and a friend's poster without a price; the motion tests pass unchanged.

- **Profile photos (D23, 0.17.0).**
  - *Storage*: `profile_photos` (migration 0004), one row per account: `original_set`, `image_set`
    and the square crop as fractions. The files are ordinary image sets (§4 *Photos*): the
    original, resized to 1600px, is kept so the photo can be re-framed without losing quality;
    the crop and a ~320px thumbnail are rendered in the browser. A new photo deletes all of the
    old one's files; re-framing uploads a crop-only set and deletes only the old crop. Removing
    the photo deletes its row and files. Account deletion cascades the row and the R2 prefix
    purge takes the files.
  - *The rule* (`server/lib/social.ts` `photoVisibleSql`, one SQL definition used by every list
    and by the photo route): the viewer is the owner; or, with no block either way, the owner
    has a follow row towards the viewer (approved or pending: they reached out) or the viewer is
    the owner's approved follower. Checked on every request.
  - *API*: your own photo at `/api/profile/photo/{original|cropped|thumb}`, set with `PUT
    /api/profile/photo` (`{ upload, crop }`; a set with an original is a new photo, one without
    re-frames) and removed with `DELETE`. `/api/auth/me` carries your photo's version and crop.
    Others' photos at `/api/people/u/<username>/photo/{thumb|cropped}`: anything not allowed
    (unknown person, blocked, not connected, no photo, the original) gets one identical 403.
    `PersonCard` gains `photo` (its version) only when the rule allows, so a stranger's card is
    still exactly `{ username, relation }`. `/api/people/requests` adds a `photos` map beside
    the usernames (the list's shape is unchanged for the previous build). Photos are
    `private, no-cache` with an ETag, like product photos.
  - *Move and zoom* (`client/src/components/AvatarCropper.tsx`, geometry in
    `shared/domain/profilePhoto.ts`): full-bleed black like the cropper; Cancel · "Move and
    zoom" · Apply; the photo slides under a fixed circle (at most 360px); drag to move, pinch or
    the slider to zoom (1× = the short edge fills the circle, up to 5×, less on a small photo so
    the crop keeps 80px). The circle can never be left partly empty. Keyboard: arrows move, + / −
    zoom. Re-opening starts where you left it.
  - *Your card* (top of People, hidden while searching): photo or letter (72px) with a camera
    badge, @username, follower and following counts (the same numbers as the tabs), and "Add a
    photo" / "Change photo". Without a photo a tap opens the picker straight away; with one it
    offers Choose a new photo, Move and zoom, Remove photo (confirmed).
  - *Avatars* (`client/src/components/Avatar.tsx`): the photo covers the letter, which stays
    beneath, so a photo that can no longer load (access just ended) shows the letter.
  - *Export/restore*: the file gains `profilePhoto` (original + crop, or null). Restore replaces
    it only when the file has the field (null removes yours); a file from before 0.17.0 has no
    field and leaves your photo alone. The Restore screen says which. The format version stays 1
    (the field is optional, and the previous build ignores it).
  - Tested: `test/api/profile.test.ts` (set / re-frame / remove and the files each leaves;
    every relation in the rule, both block directions, approval revealing and unfollow ending
    it; lists; originals never served to others; identical 403s; restore kept / restored /
    removed; bad uploads refused), `test/domain/profilePhoto.test.ts` (framing is always a
    square inside the photo; zoom limits; a crop reopens where it was; export-file checks),
    account deletion in `data.test.ts`, and `test/e2e/profile.spec.ts` (the real flow with a
    file chooser, drag and pinch, the pixels of the saved thumbnail, a follower and a
    stranger in their own browsers, removal, export → restore both ways, axe on the framing
    screen). The rule tests were checked by deliberately breaking the rule (both caught).

- **People opens on Following (D24, 0.17.0).** `lastSegment` starts as `following`; it lives
  in memory, so a relaunch (or reload) opens on Following and a visit keeps your last choice.

- **Your photo in the header (D25, 0.18.0).** `client/src/components/MeButton.tsx`, passed as
  the header's right slot by the four main screens (a `.hbtn`, so it gets the header buttons'
  Lift). It uses the session's photo version (`/api/auth/me`, D23). The header is rebuilt on
  every tab switch, and photos are served `no-cache` (revalidated each time), so the thumbnail
  is fetched once per version and kept on the device as a blob URL with a decoded copy held in
  memory: each new header shows it on its first frame instead of flashing the letter while it
  revalidates. (Chromium already reuses the image between tabs, so a flicker couldn't be
  reproduced here; the blob is for Safari, which can't be tested here.) If the fetch fails
  (offline, refused) it falls back to the ordinary URL, and from there to the letter.
  Accessible name "Your profile (@username)". Tested (`test/e2e/header.spec.ts`): letter then
  photo on all four tabs and absent on seven other screens, title centred to 1px, 44px tap
  target, the photo kept on the device, every header built during six tab switches already
  showing the decoded photo, a new photo replacing it and removal bringing the letter back, and
  the tap opening People at your card (and on People: top, search cleared).

- **Remove background (D26, 0.19.0).**
  - *Draw round it* (D54, 0.46.0): the flow opens on a choice, **Find the bud for me** (the
    AI on the whole photo, as before) or **Draw round it** (`DrawLoops`): one finger draws a
    loop (joined up on release; the outside darkens), two fingers zoom up to 4×; Undo, Clear;
    Cut out once a real loop exists (`realLoops`: 3+ points and 100+ px², so a tap or a line
    doesn't count). The AI is shown `loopRegion` (round all loops plus `LOOP_MARGIN` 8%,
    inside the photo, stretched to 768 like the whole photo), then `insideLoops` (scanline
    fill, even-odd per loop) and `keepInside` drop the mask outside the loops; every piece left
    is kept and framed as usual. Nothing inside → "No bud found inside your loop". The model,
    its size and cache are unchanged. After the AI's own try, Tap the bud and its preview
    offer "Not right? Draw round it" (and "Or tap the bud in your photo"); a loops preview
    offers "Not right? Draw again" (the loops are kept). The download question comes after
    the choice. `.viewer.cutflow` keeps the flow's own layout clear of the notch and home bar
    (D53's viewer rule had removed it on dev).
  - *The AI*: ISNet "general use" (IS-Net, Apache-2.0; ONNX export from the rembg project,
    MIT), made phone-sized by `scripts/make-cutout-model.py` (output committed in
    `client/public/ai/`, four 12 MB parts named by hash; the script records every step).
    Found while testing on the owner's phone: at its full 1024 size one cut-out needed about
    1 GB of memory and iOS closed the page, so it runs at 768 (same accuracy on the test
    scenes, ~40% of the memory; 640 started cutting out the hand instead of the bud), with
    8-bit weights except the first 3 and last 12 layers (quantising those too left speckles
    and bits of background). Run by onnxruntime-web 1.17.3 (MIT; its engine file is copied
    from `node_modules` at build by `scripts/copy-ai-engine.mjs`) in a **worker**
    (`client/src/cutout/worker.ts`), so the screen keeps moving (tested: longest pause
    ~0.25s) and all its memory is handed back when the flow closes. Measured: 4.0–4.1s a
    cut-out on the owner's iPhone (iOS 18.7 in the Claude app), 7–10s on their PC.
  - *On the phone*: downloaded once, after asking, into its own cache
    (`gt-ai-<model>`), which the service worker never deletes and serves `/ai/` files
    from. A new model has a new name, so a new cache; the old one is deleted once the new
    one works. Security headers gain `'wasm-unsafe-eval'` (lets WebAssembly compile; never
    evaluates text as script). The fallback embedded deploy can't carry the 57 MB of AI
    files, so Remove background can't download there.
  - *The maths* (`shared/domain/cutout.ts`, unit-tested): the AI's mask is stretched to
    0–1 with the faintest 10% dropped; split into separate things (specks under 0.2% of
    the photo dropped, soft edges joined to the thing they touch); framed as a square
    centred on the kept things with 16% room, ignoring the outermost 1% of their pixels
    (stray hairs); the cut-out is at most 1024px, its thumbnail ~320px. Zoom: a square of
    45% of the photo's short side round the tap, widened ×1.5 (up to 3 tries) while the
    tapped thing still runs off its edge. The cut-out is made from the photo's **current
    crop**, so cropping first also helps a crowded photo.
  - *Storage*: a cut-out is a version of the photo like a crop (migration 0005: `cutout`
    on `photos` and `uploads`). Its image set holds PNGs (keys keep their `.jpg` names;
    the stored content type says PNG and is what's served); the crop columns keep the crop
    it was made from and the original is untouched, so Restore background is an ordinary
    re-crop. The upload says `cutout=1`: its image and thumbnail must be PNG (checked by
    signature), an original with it still JPEG; PNGs are refused otherwise. A cut-out is
    never a profile photo (refused on save and in a restore).
  - *Shown*: `.thumb.cut` / `.pcell.cut` / `.hero-photo.cut` — no box, the whole bud
    (contain); photos not cut out keep their square. Followers' photos carry `cutout`.
    Export marks `cutout: true` with the PNG as `cropped` (format version unchanged: the
    field is optional); restore uploads it as a cut-out again with a fresh PNG thumbnail.
  - *Tests*: `test/domain/cutout.test.ts`; `test/api/cutout.test.ts` (PNG checks both
    ways, profile save and restore background, editor saves, Log entries and promotion,
    followers get the PNG and never the original — checked by deliberately breaking that
    rule, which the test caught — restore, profile photo refused);
    `test/e2e/cutout.spec.ts` with a quick stand-in AI (tap the bud, preview, apply,
    restore, zoom on a tray, editor Cancel/Save, Log entry and promotion, export → restore,
    the sweep and Reduce Motion, axe) and one test with the **real AI** (asks, downloads,
    keeps its files on the phone, cuts out a bud-like clump, no security-policy errors, and
    no second question).
  - *Couldn't check here*: the Home Screen app's memory limit and download storage on the
    owner's iPhone (the test page ran inside the Claude app), and how it feels by hand.
- **Website (D63, 0.53.0).** `site/public/` is the whole site: `index.html`, `site.css`, `site.js` (the rise of each block
  as it scrolls in, visible before then; the rate-it slider, the row taking the app's band and heat colours), `404.html`
  ("Lost the lighter?"), `og.png` (the link-preview picture, 1200 × 630, drawn from `site/og.html` with the site's own
  styles; to redraw it, serve `og.html` beside `public/` and photograph it at that size), the app's `favicon.svg` and
  `apple-touch-icon.png` (copies), `fonts/` (Unbounded and Manrope, latin, with `OFL.txt`) and `_headers` (CSP `'self'`
  only, `connect-src 'none'`, no inline script or style). `site/wrangler.jsonc`: a Worker of static assets only,
  `green-tracker-site`, with `env.dev` → `green-tracker-site-dev`; `preview_urls` off. **CI:** `deploy-dev` deploys the
  preview after the dev site; `deploy` (main) deploys the website after the live site, writing `version.txt` (version +
  commit; git-ignored) and checking the public address serves it (**"Website serves this build"**). The preview is
  locked by the owner once in Cloudflare (the Worker's workers.dev address → Cloudflare Access), so it gets no outside
  check. All links to the app are absolute (`https://green-tracker.green-tracker.workers.dev/`, `/signup` for Sign up
  free). Look: the app's dark green and Aurora, with drifting green, teal and violet lights (`.l1`–`.l5`; not `.b1`…,
  which are the Leaderboard's band classes), frosted glass cards, a gradient headline in lighter tints (readable over
  the lights). Wider than 900px: the phone beside the words, cards two across.
  - *Tests* (`test/e2e/website.spec.ts`; the site is served from the folder under a made-up address with its own
    `_headers`, every other address noted and refused): nothing loads from anywhere else and nothing breaks its security
    rules; the stored fonts are used; both Sign up free buttons and Open app go to the live app; the link-preview
    picture is 1200 × 630; axe at the top and the bottom; **every word readable over the moving lights**, judged at six
    moments every 600px down the page (proved to catch dimmed text); nothing spills sideways at 320, 390 and 430px; the
    slider's colours and words; "Put it on my iPhone" reaches the steps; Reduce Motion stops every animation; the lost
    page.
  - *Couldn't check here*: how it looks and moves on a real iPhone (the glass blur and the drifting lights), and the
    link preview in WhatsApp and iMessage (it needs the public address).
- **Website video (D68, 0.58.0).** A `<figure class="video">` under the "Get it" heading: `<video controls playsinline
  preload="none">` with `poster="/media/home-screen.jpg"` (1280 × 720), `/media/home-screen.mp4` (H.264 + AAC,
  1280 × 720, 24 s, about 2.6 MB, `faststart`) and a captions track `/media/home-screen.vtt` (what's on screen, nine
  cues; off unless chosen). No autoplay, muted or loop. `_headers` adds `media-src 'self'` (the video and its captions
  need it; everything else stays `'none'`). Written step 2: "Tap Share, then View More, then Add to Home Screen" ("On
  newer iPhones, tap ⋯ at the bottom first to find Share. View More is the last round button."). **Source:**
  `site/video/` (not deployed): `src/` (canvas drawing, every frame a pure function of time; the sound kit and score),
  `player.tpl.html`, `render.cjs` (renders the master with headless Chromium and ffmpeg, then the website's copies and
  the thumbnail; output in git-ignored `site/video/out/`), `README.md`. The iPhone screens follow the owner's iOS 26
  screenshots; the ⋯ menu (Share first) is drawn from memory.
  - *Tests* (`website.spec.ts`): the video's settings (controls, inline, `preload="none"`, not autoplaying, muted or
    looping, still paused a second after scrolling to it); the thumbnail loads at 1280 × 720; no `.mp4` is asked for
    before play, and playing asks this site for it; the captions load under the security rules (nine cues, to 24 s;
    proved to fail without `media-src 'self'`); the file is an H.264 MP4 under 3 MB; its caption is judged for
    readability over the lights; axe, nothing from elsewhere, and Reduce Motion as before.
  - *Couldn't check here*: playback and sound on a real iPhone (the test browser can't decode H.264), and whether the
    ⋯ menu matches iOS 26.

- **The new look (D64, 0.54.0).** *Tokens:* the top of `client/src/styles.css` is Aurora Glass (the website's
  `site.css` colours): `--bg` #03070a, `--glass` (white 5%) and `--glass-edge` (white 13%) for cards (`--card-bg` is
  `--glass`), `--surface-1`/`--surface-3` stay solid for what must hide what's behind (sheets, toasts, the country
  picker), `--accent` #45d483 / `--accent-bright` #6fe9a4, `--teal`, `--violet`, `--grad` (the lighter tints big numbers
  flow through), `--primary` (green → teal: primary buttons, the add button, switches), `--hero-wash`, `--display` and
  `--num-font` (Unbounded), `--font` (Manrope). *Fonts:* `client/public/fonts/` (`unbounded.woff2`, `manrope.woff2`,
  `OFL.txt`; copies of the website's), `@font-face` at the top of the styles, preloaded in `index.html`, precached by
  `sw.js` and served from its cache first (`/fonts/`). CSP unchanged (`font-src 'self'`). *Lights:* three radial gradients
  painted on the fixed background `.bg-layer` (green top left, teal top right, violet low down), moved by
  `background-position` (`lights` 24s, alternate, `steps(48)`: about two small moves a second; none with Reduce
  Motion); the screens' own D29 lights are gone
  (`--aurora-top: none`). *Looks:* `html[data-look]` is set from your appearance (`main.tsx`); Aurora Glass lives on
  `:root`, so Stage 2 adds each look as `[data-look=…]` token overrides. *Tops:* `Tiles` (`components/Controls.tsx`)
  reads your `top` (or a `top` prop: Appearance's preview) and draws `.banner.hero` (a `.stats` grid: the `lead` tile
  big on the left, the others on the right, in their reading order; `foot` underneath), `.tiles` or `.banner.strip`;
  every stat is a `.tile` with `b` and `.cap` in all three. Leaderboard and a friend's board lead with Average (foot
  "Your #1 · …" / "Their #1 · …", the first row under the current Rank by and Type), a name's page with Average ("Best ·
  …"), the Log with Products ("Most from · flag country", the country with the most rows, and its count). *Settings:*
  `appearance_settings` gains `look` and `board_top` (migration `0011_new_look.sql` rebuilds the table to widen the
  CHECKs, moving every row to the defaults; `look` already allows the Stage 2 looks), `shared/domain/gems.ts` has
  `LOOKS`, `READY_LOOKS` (only `aurora`), `BOARD_TOPS` and the two presets; `validateAppearance` refuses a look not
  ready yet and fills a missing look or top with the default (backups and open apps from before). *Presets:* `.pal-aurora`
  and `.pal-neon` band colours at the end of the styles, dark layers tinted near-neutral like Gems'. *Found while
  building:* a long value (`£10800.00`) spilled out of a tile at 375px in Unbounded, so a stat of 7–9 characters carries
  `data-len` and a smaller size in tiles and the strip; the grey and red buttons sit on `--btn-bg` (glass over a darker
  pane), as the red Archive measured 4.38 : 1 where the lights are brightest; the lights are hidden and paused under
  anything covering the whole screen (`html:has(.viewer, .cropper, .cpicker)`), as nobody sees them there and the
  background remover's work had less room on a busy test machine. Timing tests also froze a little longer with four
  test browsers at once: measured, the drifting lights and the frosted blurs (redone each frame as the lights move
  behind them) were the cost. Measured over a fixed tour of the app (the machine's processor time): the first build
  used about 9% more than before the new look; two separate light layers were most of it (laid over the whole screen
  every frame while anything else moved), so the lights are painted on the background, which was its own layer
  already, and moved in steps about twice a second: now about the same as before. The glass hero has no blur (the
  lights behind it are soft already). The "Latest" tag sits on a darker pane (it measured 4.50 : 1 over the lights).
  Back on Settings, its two-line "What followers see" summary was fetched again and could arrive after the screen
  had landed where you were, pushing it 33px off (the swipe-back test caught it on a busy machine; Settings is two
  rows longer now): the last privacy settings are kept (`cachedPrivacy` in `client/src/privacy.ts`, cleared with the
  other caches when the account changes), so the line is there at once (`more.spec.ts`, proved on the old code).
  - *Tests:* `look.spec.ts` (new: the defaults, Settings' three rows, Appearance's looks with the three coming next,
    choosing a top and a colour set saves at once and the Leaderboard follows, the Log's and a name's page's hero lines,
    every top fits at 375 and 390 wide on the Leaderboard, the Log and a name's page with the widest numbers, the stats
    readable over the drifting lights in every top, axe on Appearance, an unbuilt look refused);
    `aurora.spec.ts` rewritten for the drifting lights (two layers behind every screen, moving, staying put as you
    scroll, violet low down, none with Reduce Motion, overlays covering them); `appearance.spec.ts` covers all five
    presets (the readability test included) and the new Appearance screen top to bottom; `numbers.spec.ts` checks
    Unbounded and Manrope are asked for and really drawn; the API and domain tests cover saving, refusing and
    defaulting the look and top, and restoring a file from before. Colour assertions elsewhere follow the new tokens.
    `wholeScreenContrastFailures` now photographs a screen at a time from top to bottom (the new Appearance is more
    than two screens tall; every match must still be judged at least once) and, like the header and tab bar, leaves
    out text under the add button (it covers what's behind; at the top of the Log the taller hero put the first
    country's count under it). The Appearance check measures a colour set's name (`.preset .pl`) and its New tag
    separately. `expectStatsFit` replaces `expectTilesCentredAndWashed`.
  - *Couldn't check here*: how the glass and the drifting lights feel on a real iPhone (smoothness, battery), how the
    glass looks over real photos, and the fonts on iOS Safari.
  - **Stage 2 (D65, 0.55.0).** `html[data-look="neon" | "pearl" | "forest"]` blocks just under `:root` override the
    tokens (background, surfaces, glass, edges, text greys, accent, `--primary`, `--grad`, `--hero-wash`, the three
    lights, the bars, `--display` and `--display-w`, the titles' weight). Holo Pearl's rim: the stand-out cards draw
    `--pearl-edge` under the whole card with a solid pane (`--bg`) and the glass over it on the padding box; without the
    solid pane the rainbow tinted the words' background (the readability test measured "Rank: Overall" at 4.2 : 1).
    Sora (`client/public/fonts/sora.woff2`, latin, SIL OFL, added to `OFL.txt`) is loaded only when used, and precached
    by `sw.js`. `READY_LOOKS` is all four; `LOOK_BG` gives each look's background. *No flash:* `client/public/look.js`, a
    plain script in `<head>` (the CSP allows no inline script; precached too), reads `localStorage['gt.look']` and sets
    `html[data-look]` and the theme-color before the first paint; `main.tsx` keeps both and the stored look current once
    you're signed in (signed out, the last look stays).
    - *Tests* (`look.spec.ts`): choosing each look in Appearance changes the page, its title font (Unbounded, Sora,
      Manrope) and the Home Screen bar at once and saves it, numbers staying Unbounded; the remembered look is on the
      page before the account has loaded (held back), a fresh phone opens in Aurora Glass; every look readable over the
      moving lights and colours on the Leaderboard (the glass hero and the strip; only text you can see: below the
      header, above the tab bar, clear of the add button) and top to bottom on the Log, Settings and Appearance, with
      axe on each. The domain and API tests accept all four looks and refuse an unknown one.
    - *Found while testing:* tapping two Appearance choices quickly, the first save's answer put the screen back on
      the old choice for a moment (and two saves could cross). Saves now go one at a time, in order, and only the latest
      choice clears what's shown (`Appearance.tsx`); `look.spec.ts` holds the first save back and checks both choices
      stay shown and the last is saved (fails on the old code).
    - *Couldn't check here*: the three looks on a real iPhone, and Sora in iOS Safari.
  - **Stage 3 (D70, 0.60.0): eight more looks.** `LOOK_KEYS` gains `sakura`, `fireflies`, `deepsea`, `frost`, `nebula`,
    `outrun`, `lava`, `haze` (Appearance's order), all in `READY_LOOKS`; `NEW_LOOKS` marks them New (`.ap-title` holds the
    name and the tag side by side, the tag outside `.ap-name` so the readability test measures only the name's words).
    `LOOK_BG` and `client/public/look.js` list each look's background (`gems.test.ts` checks they match, and that the
    migration `0014_more_looks.sql` allows exactly `LOOK_KEYS`). *Tokens:* one `html[data-look=…]` block each, colours
    only: never `--display`, `--display-w`, a size or a radius (the owner's rule). New tokens with the old values on
    `:root`: `--glow` (the chosen tab's icon), `--tab-glow` and `--fab-glow` (the tab's underline, the add button's
    shadow; fallbacks keep the four older looks exactly as they were). These looks' `--glass` is a darker pane (half
    opaque), so the background dims behind every card, and `--danger` is a touch lighter (#ff8a8a): "Danger zone" read
    3.1 : 1 over Frost's snow. *Backgrounds:* the three lights take each look's colours (`--light-1…3`; Lava Lamp draws
    them as firmer blobs moving further, `bg-lava`; Nebula's are bigger clouds); the rest are painted on
    `.bg-layer::before` and `::after` (repeating tiles of radial gradients: petals, fireflies, plankton, snow, stars;
    Deep Sea's rays, masked to fade with depth; Outrun's sky, sun and stripes, and a grid floor tilted in perspective;
    Lava Lamp's two more blobs; Haze's wisps; Sakura's branch, an SVG data address, the CSP allowing `data:` images).
    Each moves by `background-position` (or blinks by `opacity`) in `steps()`, never smoothly, under
    `prefers-reduced-motion: no-preference` only; every keyframe is named `bg-…`. Under the viewer, cropper and country
    picker both layers are `display: none` and the layer itself has no image and is paused (repeated after the looks'
    own rules, which would otherwise win). Brightness: whatever drifts behind words stays at about Aurora's lights (a
    star or flake about a fifth white): the readability tests judge every pixel behind every word at 12 moments of
    every animation.
    - *Tests* (`looks.spec.ts`, its own file so it runs beside `look.spec.ts`; parallel, one account per worker): each
      look chosen in Appearance (its name, New; the four older looks not New), saved, on the page with its background
      and Home Screen bar, remembered by the phone (on the page before the account loads); **every font, size, shape and
      position on the Leaderboard, Settings and Appearance the same as in Aurora Glass** (the owner's rule); each
      background moving only in steps, none with Reduce Motion, gone and still under the country picker; each look
      readable and accessible on the Leaderboard (the glass hero and the strip, through the background's motion), the
      Log, Settings and Appearance. The domain and API tests accept the twelve looks.
    - *Found while testing:* Deep Sea's plankton keyframes were first called `rise`, the name of the menus' slide-up
      (`settled` waits for it): the later one replaced the menus' animation everywhere and the tests waited for ever
      on an endless "rise". Every background keyframe is now `bg-…`.
    - *Couldn't check here*: how smooth the stepped movement looks and how it feels for the battery on a real iPhone,
      and how bright the petals, fireflies, snow and stars look on its screen.
  - **The top glows; defaults, order and pages (D71, 0.61.0).** *The black hero:* `.banner.hero` shares the class `hero`
    with a product page's name block (D22), whose `::before` is a dark fade nearly solid at its foot, plus `gap: 8px`,
    `z-index: 1` and `pointer-events: none`; the Leaderboard's hero now drops all four (`.banner.hero::before { content:
    none }`). *The glow:* `--hero-glow` (each look's `--light-1…3`)
    and `--hero-edge` (`--accent-bright` → `--teal-bright` → `--violet-bright`) are set on `:root` from the look's own
    tokens, so every look has its own; `.banner.hero`, `.banner.strip` and `.tiles .tile` draw the glow and the look's
    glass over a solid pane of `--bg` (padding-box) and the edge (border-box), with a `--glow` shadow outside; Holo
    Pearl keeps its rim. *Found while testing:* lights twice as strong, a glow inside the rim, and a see-through pane
    (the edge, painted under the whole card, showed through) each put the numbers and labels below the readability
    tests (2.4–4.4 : 1); `expectStatsFit` accepts the glow as the top's glass. *Defaults:* `DEFAULT_APPEARANCE` is `{ look: 'aurora', top: 'strip', preset: 'gems' }`
    (used for an account with no `appearance_settings` row and for a backup with no look or top); the table's column
    defaults are never used (every save writes all four). *Order:* `LOOK_KEYS`, `PRESET_KEYS` and `BOARD_TOP_KEYS` are
    in Appearance's order, the default first (`gems.test.ts` checks the rest are A to Z by name). *Pages:*
    `AppearanceScreen` takes `part` (`look`, `top`, `colours`), routed from `/more/look`, `/more/top` and
    `/more/colours`; `main.tsx` replaces `/more/appearance` with `/more`.
    - *Tests:* the defaults and A to Z order (domain); a backup with no look or top takes the strip (API); a new
      account's Leaderboard in the strip and Gems, Settings' three buttons each opening its own page with only its
      own choices, the old address opening Settings, the Rank / colours / Type row above the top in all three tops on
      the Leaderboard and the Log (`look.spec.ts`); each page readable (`appearance.spec.ts`); every look's glowing top
      readable on the Leaderboard and the colours page, and every position unchanged between looks on the three pages
      and the Log (`looks.spec.ts`).
    - *Found in the 2-worker run:* `aurora.spec.ts` compares the gutter at one spot before and after scrolling; with
      the slim strip the #1's breathing halo sits beside that spot (it failed 12 times in 12 under load). The cards'
      glows are now switched off for those photos, so only the background is compared (30 of 30).
    - *Couldn't check here:* how the glow looks on the owner's iPhone in each look.
  - **The light looks (D72, 0.62.0).** `daymint`, `daypearl`, `daysky` in `LOOK_KEYS` (after `aurora`, A to Z by name),
    `NEW_LOOKS`, `LOOK_BG`, `look.js` and `0015_daylight.sql`; `LIGHT_LOOKS` lists them. *The light tone:* `main.tsx` and
    `look.js` set `html[data-tone="light"]` with the look, the `color-scheme` meta to `light` and
    `apple-mobile-web-app-status-bar-style` to `default` (dark words on a light bar; `black-translucent` for the dark
    looks). *Tokens:* one block each, as the dark looks (white glass, `--surface-1`/`--surface-3` white, dark greys,
    deeper accents with white `--on-accent`, darker `--primary` so white words on it pass, a deeper `--danger`). *Overrides*
    (end of `styles.css`, `html[data-tone="light"] …`): `color-scheme: light`; light cards (`.row.tier` and the swatches: a
    white layer, `--d1`/`--d2` less 0.1/0.06, over `--tier-grad`; words in `--text`; score, rank and the badge's colour
    words in `--tier-ink`, each colour mixed 38% with `--text`); the effects in `--t4`; heat scores mixed 45% with `--text`;
    the product page's fade in `--bg`; greys, tracks, panes, strain tags and icon colours that were light-on-dark; no
    `.bg-layer` extras. The viewer, cropper and cut-out tools are untouched (black).
    - *Tests:* `looks.spec.ts` runs the three through every look check (chosen, saved, remembered, every font, size and
      position as Aurora Glass, readable on every screen); `daylight.spec.ts`: a new account dark; each Daylight sets the
      light tone, the iPhone's controls and status bar, remembered before the account loads, undone by a dark look; light
      cards in all ten sets readable; product pages (in colour and plain) readable; axe on fourteen screens and the Colours
      key in each. `textBoxes` now judges gradient text at both its darkest and lightest colour (dark words on light are
      hardest to read at the lightest), and reads mixed colours (`color(srgb …)`). The domain and API tests take the three.
    - *Couldn't check here:* the status bar's words on the Home Screen app (iOS chooses from the meta; set before the
      first paint), the iPhone's keyboard and pickers in light, and how the light cards look on its screen.
  - **Dark mode and Light mode (D73, 0.63.0).** `LOOK_KEYS` lists the dark looks (Aurora Glass, then A to Z), then
    `LIGHT_LOOKS` (A to Z) at the end. `Appearance.tsx` `MODES` draws the Look page as two sections, *Dark mode* with a
    moon and *Light mode* with a sun (`h2.lh.cap.ap-mode`, the icon hidden from screen readers), each its own
    `radiogroup` named by its heading. The radios share one name, so it stays one choice. The old *Look* heading is gone
    (the page title says it). *Tests:* `gems.test.ts` (dark looks then light, each A to Z), `look.spec.ts` (the headings,
    the looks under each), `daylight.spec.ts` (one look ticked across both); the readability and axe sweeps cover the
    page in every look.

- **Currencies (D66, 0.56.0).** `shared/domain/currency.ts`: `CURRENCIES` (the ECB's 30 reference currencies, the
  usual five first; code, name, sign, decimals: 0 for HUF, ISK, IDR, JPY, KRW), `DEFAULT_CURRENCY` £, `isValidRate`
  (1e-7…1e7), `formatRate` (4 figures, at least 2 decimals). `format.ts`: `formatMoney(value, code)` replaces
  `formatGBP`; `formatUnitPrice(type, price, code)` and `formatPerUnit` keep 2 decimals per unit (D13).
  `money.ts`: a `Purchase` may carry `currency` and `rate` (absent: the main currency, 1); `paidInMain` is the total at
  its rate, and `unitPrice` (so the headline price, VFM and ranking) uses it; `unitPricePaid` is the price as paid.
  `names.ts` `spentOn` adds `paidInMain`. `product.ts`: `PurchaseRecord` always has `currency` and `rate`;
  `PurchaseInput`'s are optional and checked (a known code, a valid rate); `settleCurrencies(purchases, main)`: none
  given → the main currency; the main currency's rate is always 1; another needs a rate ("A purchase in € needs an
  exchange rate.").
  - *Server:* migration `0012_currency.sql` (`purchases.currency` default 'GBP', `purchases.rate` default 1,
    `money_settings`, `fx_rates`). `server/lib/fx.ts` `ratesFor(env, needs)`: one rate per need (from, to, day; `fxDay`
    makes an undated or future day today and nothing before 1999-01-04); past days' per-euro rates from `fx_rates`,
    the rest in **one** request to `${FX_URL || https://api.frankfurter.dev}/v2/rates?base=EUR&quotes=…&from=…&to=…&providers=ecb`
    (ten days before the first day asked, for weekends and holidays; 8s timeout; refused with a 4xx, asked once more without `providers=ecb`), the latest rate on or before each
    day (`parseRates` reads v2's rows and v1's table); today's isn't kept (the ECB publishes in the afternoon);
    `FxUnavailable` when it can't. `GET /api/money/rate?from&to&date` → `{ rate, day }` (503 "Couldn't get the
    exchange rate just now. Type it in instead."; 300 per 10 minutes per account). `PUT /api/money { currency }`
    re-rates every purchase of yours at its day's rate and saves the setting in one batch (503 and nothing changed when
    a rate can't be had). `/api/auth/me` sends `currency`. `childWrites` settles purchases against your main currency.
    Restore: a purchase without a currency is £; the file's `money` sets your main currency (else yours stays); the
    main currency's rate is 1, the file's rate is kept, a missing one is looked up (503 and nothing replaced if it
    can't be). Followers' routes never send purchases (D2), so nothing new crosses accounts.
  - *Client:* `client/src/money.ts` (`useCurrency`, `saveCurrency`, `fetchRate`, the last currency used in
    `localStorage['gt.currency.last']`). Editor (`PurchaseDraft` gains `currency`, `rate`, `rateText`, `typed`, `look`):
    the currency is a native `<select>` (names in the list) laid invisibly over its sign (`.cur`, `.cur-face`);
    picking another currency or a new date (unless you typed the rate) looks the rate up; `RateLine` draws the slim
    `.fxline` (≈ total, the rate, Change) or the rate box (`£ for €1`, Done; "Couldn't get the rate. Type it in." when
    the look-up failed); a kept purchase without a readable rate stops the save, opens, and says what to do. Row:
    price per unit in the main currency with the paid one in `small`; `.fx` tag with the sign. `MetaLine` adds `.paid`;
    `formatRankValue` takes the currency (a friend's board never ranks by price). `PriceHistory`: as paid, "(≈ £34.80)",
    the `.fx` tag; the VFM caption names the main currency's sign. `Brands`, `LogEntry` (a returned entry's total) and
    the hero use the main currency. `Currency.tsx` (`/more/currency`): Usual and More lists of radios, a sheet to
    confirm, then the product and Log caches are dropped and `/auth/me` read again. Settings: a **Money** group with
    Main currency (`CoinsIcon`, amber). Export: purchases carry `currency` and `rate`, the file `money`.
  - *Tests:* `test/fxStub.mjs`, a stand-in for the rate service started by both test servers (`FX_URL`; never in
    `wrangler.jsonc`, `config.test.ts`): made-up per-euro rates by day of the month, working days only, any day in 2001
    fails, the ECB choice is refused for rand (ZAR), `/calls` counts requests. `test/domain/currency.test.ts` (codes, formats, rates, conversion, settling, backup
    money, `parseRates`, `fxDay`), `names.test.ts` (Spent at rates); `test/api/currency.test.ts` (storing, refusing, the
    rate route with weekends and crossing currencies and kept rates, the service down, changing the main currency
    both ways and refusing when a rate can't be had, restores old and new, followers); `test/e2e/currency.spec.ts`
    (adding a € purchase, Change and a typed rate kept over a date change, the last currency remembered, the look-up
    failing and the save explaining, the Leaderboard's two prices, Settings → Main currency both ways, readability and
    axe). `more.spec.ts` gains the Money row; purchases tests use the "Total paid" label.
  - *Found while testing:* a rate typed into the open box (before Done) was thrown away by a new date; typing now
    counts as typed. A main-currency change that failed showed its reason at the top of a long, scrolled list; it now
    scrolls up to it.
    A browser test failed once in a full run (`brands.spec.ts`: the new product not found): after Save it waited for an
    address like `/products/…`, which `/products/new` already is, so it read the list before the save finished (a save
    now also reads your main currency, a little longer). Five specs now wait for `/products/(?!new$)…`, as
    `country.spec.ts` already did; proved by holding the save back 1.5s (fails with the old pattern, passes with the new).
    CI then failed `gems.spec.ts`'s readability test on the Sapphire page (the badge at 1.1 : 1 at steps 10 and 11).
    The text was measured while the page-load fade (`enter`) was still running, and that fade also slides the screen
    up 6px; `contrastFailures` winds it to each step, so by the last steps the badge sat a few pixels off its measured
    boxes. `textBoxes` (so every readability check) now waits for `settled` first. Proved with the animations slowed
    to 5% (CDP `Animation.setPlaybackRate`): the same failure at steps 10 and 11 before, passing after.
  - *Couldn't check here:* the real rate service (it can't be reached from the build environment; built to its
    published format and tested against the stand-in), and the currency picker under a thumb on a real iPhone.

- **Value for money across types (D67, 0.57.0).** `productTypes.ts`: `UnitDef.perGram` (replaces `vfmPriceMultiplier`)
  is how many units give the same effect as a gram of flower: 1 for `GRAMS`, 20 for `MG_THC` (the owner's figures: 1mg
  eaten ≈ 10mg smoked, flower taken as about 20% THC). `money.ts`: `pricePerGramEquivalent(type, purchases)` is
  `headlinePrice` × `perGram`; `valueForMoney` divides Overall by it. `leaderboard.ts`: `rankByOptions('all', { money:
  true })` adds `price` ("Price") and `vfm` after Overall; `rankValue(p, rankBy, filter)` ranks price under All by
  `pricePerGramEquivalent`, under a type by `headlinePrice` (so the edibles' order and their £/mg scores are unchanged);
  `rankProducts` passes the view's filter. `placeText` gives "#1 by Price" / "#1 by Value for money" under All.
  Client: `ProductRow` takes `filter` (the Leaderboard passes it) and its `MetaLine` puts `.per` ("per 20mg", from the
  unit) and a separator before an edible's price when ranked by Price under All. `Profile`'s VFM caption for edibles
  reads "Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better". A followed person's board
  passes `money: false`, so it never offers either.
  - *Found while testing (the owner said fix it):* a wide price (£45.00, 22px Unbounded) ran past the row's right edge,
    and every £x.xx price sat 2px into the row's padding: the score column was a fixed 64px. It is now
    `minmax(64px, max-content)` on `.row`, so the name gives way instead. Before as well (Concentrate × Price); more likely
    now that the dearest product tops All × Price. `leaderboard.spec.ts` checks each score stays inside its row's
    padding, clear of the name (failed with the old column: every row 2px over, the rosin 17px).
  - *Tests:* `money.test.ts` (an edible at £0.05/mg is 8.0; the owner's example 2.78 beside a flower's 0.86; grams per
    gram for every other type), `leaderboard.test.ts` (All's options, price and VFM across types, one type's own unit,
    place text, a stored All × VFM kept or dropped by `money`); `leaderboard.spec.ts` (All × Value for money and All ×
    Price in order with their numbers, the "per 20mg" note only on edibles and only under All, an edible's page and its
    caption; the 375px sweep covers the new pairs at full labels); `people.spec.ts` (a friend's All never offers them).
  - *Couldn't check here:* the rows on a real iPhone.

- **More colour sets (D69, 0.59.0).** `shared/domain/gems.ts`: `Preset` and `PRESET_KEYS` gain `sunset`, `deepsea`,
  `ember`, `cosmos`, `synthwave` (listed last); `NEW_PRESETS` (those five) drives Appearance's New tag (Aurora and Neon's
  is gone). `bandEffect(preset, band)` → `Effect` (`glints` | `sun` | `plankton` | `sparks` | `stars` | `grid`) or null:
  Metals' glints only on band 3 (Diamond), Sunset and Ember on band 4, Deep Sea and Synthwave from band 3, Cosmos from
  band 2. Client: `components/Gems.tsx` `Effects` (was `Glints`; `PhotoEffects` was `PhotoGlints`, same callers: the
  row, the product hero, a friend's row, the welcome rows and Appearance's sample rows): the glints as before, else
  `span.tfx.tfx-<effect>` (aria-hidden) holding `<i>`s. Dots (plankton, stars, sparks) take fixed positions from
  `DOTS`: on a row, % across and px from the top or bottom edge (inside the row's 10px padding, clear of the text);
  on a page, % of `.hero-photo .tfx` (the 170px under the header, above the hero text). Counts: plankton 6 / 10,
  stars 5 / 8 / 12 (+ `.nebula` at band 4), sparks 10 + `.heat`, grid `.floor` (+ `.sun` at band 4), sun one glow
  centred on the row's photo (on a page, from the top right corner). `styles.css`: `.pal-<set>.band{n}` colours (t3
  the lightest, for the rank number; near-neutral `--dark` layers), `.tfx*` and `tfx-*` animations, only under
  `prefers-reduced-motion: no-preference` (Reduce Motion: drawn, still). The class is `tfx`, not `fx`, which the
  currency tag (D66) uses. `migrations/0013_more_colours.sql` rebuilds `appearance_settings` with the wider `preset`
  CHECK, copying every row.
  - *Found while testing:* Synthwave's 9.5 score read at 2.77 : 1 where its violet (`#c85fff`) passed behind it; the
    violet and pink are lighter (`#d68cff`, `#ff74b4`). Ember's sparks rose 8px and touched the meta line's box on a
    row; they rise 5px. Synthwave's sun (28px) reached 1px into the meta line's box; it is 24px, lower.
    One test for all five sets' pages ran past its 3 minutes with 4 workers (53s alone): one test per set now, and the
    rows' readability test, ten sets long, one per set too.
  - *Tests:* `gems.test.ts` (the new names, the list's order and New, `bandEffect` for every set),
    `appearance.test.ts` (each new set saves); `appearance.spec.ts` (every band of all ten sets: colours, layers,
    motion, effects and their counts; readability through the motion in all ten (one test per set); no dot, grid or sun overlaps any text
    on a row; Reduce Motion: effects drawn, nothing moving; Appearance lists ten, New on the last five);
    `gems.spec.ts` (one test per set: its effect on a 9.7 page without a photo, a 9.5 page with one, a 9.3 edible: the right
    effect or none, above every word, moving; readability of the hero text at 4 moments; Reduce Motion stills it).
  - *Couldn't check here:* the effects on a real iPhone (their speed and brightness on its screen).

## 5. Open questions for the owner

None.

## 6. Changelog

### 0.63.0 — the Look page in two sections: Dark mode and Light mode (owner request)
- Decision D73. Dark mode (a moon) over Aurora Glass and the other dark looks, A to Z; Light mode (a sun) at the bottom
  over the three Daylights. Still one choice. No change to data.
- `CLAUDE.md`: next decision D74; the to-do list; a testing note.

### 0.62.1 — CLAUDE.md: the Daylight looks are on dev
- D72 is on dev (2026-10-29); Anton tries them on GT Dev before they go live.
- CI: the test job may run for 30 minutes, not 20. The browser tests now take 15 to 20 minutes on a GitHub runner, and
  this pull request's first run was cut off at 20 minutes with no test failed.

### 0.62.0 — three light looks: the Daylights (owner request)
- Decision D72. Daylight Mint, Daylight Pearl and Daylight Sky, fifteen looks in all: light colours, the iPhone's
  own controls and status bar in their light style, and light cards for the colour sets. Everyone starts dark; a light
  look is only ever chosen. One migration widens the looks the database allows.
- `CLAUDE.md`: next decision D73; the to-do list; testing notes.

### 0.61.2 — CLAUDE.md: the eight Looks and the glowing top are live
- D70 (on dev 2026-10-27) and D71 (on dev 2026-10-28) went live on 2026-10-28 and move to Done; Daylight is next.
  Notes only.

### 0.61.1 — CLAUDE.md: the glowing top, new defaults and Appearance pages are on dev
- D71 is on dev (2026-10-28), with D70's eight Looks; both go live together. Notes only.

### 0.61.0 — the top glows with your look; new defaults; Appearance in three pages (owner request)
- Decision D71. The glass hero (and the strip and tiles) glow with the look's own lights; the hero was black because
  it took a product page's dark fade, now gone (and the space it left under "Your #1"). New accounts start on the
  Slim strip and Gems; the Looks and colour sets are listed default first, then A to Z; Look, Leaderboard top and
  Leaderboard colours each have their own page in Settings.
- `CLAUDE.md`: next decision D72; the to-do list; testing notes (the defaults, the pages).

### 0.60.1 — CLAUDE.md: more Looks are on dev; the website video and the colour sets are live
- The eight Looks (D70) are on dev (2026-10-27); the how-to video on the website (D68, live 2026-10-26) and the five
  colour sets (D69, live 2026-10-27) move to Done (what 0.59.1, never merged, recorded). Notes only.

### 0.60.0 — eight more looks (owner request)
- Decision D70. Sakura, Fireflies, Deep Sea, Frost, Nebula, Outrun, Lava Lamp and Haze: twelve looks in all, each
  changing only colours and the background behind everything (fonts, sizes and shapes as in Aurora Glass, the owner's
  rule), each background moving in small steps. Listed after the four in Appearance, marked New. One migration widens
  the looks the database allows; nobody's look changes. Daylight, a light look, comes next on its own.
- `CLAUDE.md`: next decision D71; the to-do list; testing notes for the looks.

### 0.59.0 — five more Leaderboard colour sets (owner request)
- Decision D69. Sunset, Deep Sea, Ember, Cosmos and Synthwave, ten sets in all, each with an effect of its own (a sun,
  plankton, sparks, stars, a neon grid) kept clear of the words, on rows and product pages. Listed last in Appearance,
  marked New (Aurora and Neon no longer are). One migration widens the sets the database allows; nobody's choice
  changes.
- `CLAUDE.md`: next decision D70; the to-do list.

### 0.58.0 — a how-to video on the website (owner request)
- Decision D68. A 24-second video above the website's three steps shows adding Green Tracker to the Home Screen in
  Safari on iOS 26 (⋯ → Share → View More → Add to Home Screen → Add). Thumbnail: the phone with the leaf. Plays only
  when tapped; nothing downloads until then; captions. Written step 2 mentions ⋯ and View More. The video's source is
  in `site/video/`. The app is unchanged.
- `CLAUDE.md`: next decision D69; the to-do list; a testing note for the video.

### 0.57.2 — CLAUDE.md: currency settings and edible value for money are live
- Both to-do items move to Done; the list is empty. Notes only.

### 0.57.1 — CLAUDE.md: edible value for money is on dev
- The to-do list marks edible value for money (D67) on dev. Notes only.

### 0.57.0 — value for money compares every type (owner request)
- Decision D67. Value for money is Overall ÷ the price for the same effect as a gram of flower: per gram, or per 20mg
  for edibles (the owner's 1mg eaten ≈ 10mg smoked, flower about 20% THC). Rank by under All gains Price and Value for
  money; an edible's price there is the price of 20mg, with "per 20mg" before its real price per mg. No data change.
- A wide price (£45.00) no longer runs past the edge of its Leaderboard row.
- `CLAUDE.md`: next decision D68; the to-do list.

### 0.56.1 — CLAUDE.md: currency settings are on dev
- The to-do list marks currency settings (D66) on dev. Notes only.

### 0.56.0 — currencies (owner request)
- Decision D66. Each purchase can be in any of 30 currencies, with the rate for its day looked up and saved with it
  (or typed). Settings → Money → Main currency (£ to start): every price shown together or compared is converted into
  it. Existing purchases are £. The server asks a free rate service (Frankfurter, the European Central Bank's rates):
  the app's first outside connection, sending only currencies and days. A new migration.
- `CLAUDE.md`: next decision D67; testing notes for currencies.

### 0.55.1 — CLAUDE.md: the new look is live
- The new look (D64, D65) went live on 2026-10-21 and moves from the to-do list to Done; the remaining items are
  renumbered 1–2. Notes only.

### 0.55.0 — the new look, stage 2: three more looks (owner request)
- Decision D65. Neon Night, Holo Pearl and Deep Forest can be chosen in Settings → Appearance. The phone remembers
  your look, so the app opens in it straight away; the Home Screen app's top bar takes its colour.
- Quick taps in Appearance no longer flip a choice back for a moment.
- `CLAUDE.md`: next decision D66; testing notes for the looks.

### 0.54.1 — CLAUDE.md: the new look's stage 1 is on dev
- The to-do list marks stage 1 of the new look (D64) on dev, with stage 2 (the other three looks) next. Notes only.

### 0.54.0 — the new look: Aurora Glass (owner request)
- Decision D64, stage 1. The app takes on the website's look: drifting green, teal and violet lights, frosted-glass
  cards, Unbounded for titles and numbers (the old rounded numbers felt too soft), Manrope for words. Settings →
  Appearance gains a preview, the look (Aurora Glass; three more coming next) and the top of the Leaderboard (glass
  hero, three tiles or slim strip; the Log, friends' boards and brand pages follow it), and two new colour sets,
  Aurora and Neon. Everyone moves once to Aurora Glass, the glass hero and Aurora colours. A new migration.
- Coming back to Settings no longer lands a little off when its "What followers see" line loads late.
- `CLAUDE.md`: next decision D65; testing notes for the new look.

### 0.53.2 — CLAUDE.md: 0.53.1 is live
- Brands and suppliers (D59), Smokes removed (D60), the Sources and Settings tabs (D61), spending (D62) and the
  website (D63) went live on 2026-10-21 and move to Done; the website is public at
  https://green-tracker-site.green-tracker.workers.dev. The website preview's Cloudflare Access lock must cover
  Production ("Previews only" left it open; found with the owner). Notes only.

### 0.53.1 — a steadier Sources card test (tests only)
- `brands.spec.ts` measured a card's photo and its box one after the other while the Sources screen was still sliding
  into place, so on CI they came out a pixel apart and stopped 0.53.0 reaching the dev site. It now waits for the
  slide (`settled`) and measures both at once. Reproduced by slowing animations tenfold and spacing the two
  measurements (2px apart); passes with the fix under the same slowdown. The app is unchanged.
- `CLAUDE.md`: dev is 0.53.1.

### 0.53.0 — a website for the app (owner request)
- Decision D63. A one-page website at its own address, look A "Aurora Glass": what Green Tracker is, a rate-it slider,
  how to put it on the iPhone Home Screen, and Sign up free. Made-up products only; nothing loads from anywhere else,
  no tracking. A preview from `dev` (locked like the dev site), the public site from `main`. The app is unchanged.
- `CLAUDE.md`: on dev; item 3 checked by Anton on GT Dev; the website in the sites table.

### 0.52.0 — what you spent on brands and suppliers; whole card photos; swiping back lands where you were (owner request)
- Decision D62. Sources cards say what you spent on each name ("N products · £X spent", best on the next line), with
  a new **Most spent** sort; a name's page has a **Spent** tile for every name, counting its products bought anywhere
  and everything bought there. Card photos are no longer cut off. Swiping back from any screen shows the screen
  underneath instead of black and lands where you were; so does the Back button.
- `CLAUDE.md`: on dev.

### 0.51.1 — CLAUDE.md: currency settings and edible value for money on the to-do list (owner request)
- The to-do list gets item 6, **Currency settings** (a currency per purchase and a main currency for the account,
  converted so prices can be compared), and item 7, **Edible value for money rework**. Notes only; no change to the
  app.

### 0.51.0 — Sources and Settings tabs (owner request)
- Decision D61. Five tabs again: Leaderboard, Log, **Sources** and People, then **Settings** (More, renamed, with a
  gear). Sources shows every brand and supplier as a card with its best product's photo, average and tags, with search
  and sorting. Tapping a suggestion now closes the keyboard.
- `CLAUDE.md`: the tabs are on dev.

### 0.50.0 — Smokes removed (owner request)
- Decision D60. Smokes is gone from the app, on dev and live: no Smokes tab (four tabs again), no Smokes cards, no Most
  used in Rank by, no Smokes switches in Privacy, nothing about smokes in Export, Restore or Delete account. Saved smokes
  are deleted for good when this reaches each site. An export made before 0.50.0 still restores; its smokes are skipped.
- Found while testing: coming back to the Leaderboard from a product you re-rated could, on a slow phone, leave the
  product off screen; the app now keeps the list in place until the photo has landed.
- `CLAUDE.md`: Smokes is gone from the two-sites table, the testing notes and the to-do list.

### 0.49.0 — brands and suppliers (owner request)
- Decision D59. While you type in Source or a purchase's Supplier, the names you've already used show under the box;
  one tap fills it. The same name in other capitals or spelling ("barneys") is saved as the one you use ("Barney's"),
  and a typo asks "Did you mean". Tap a product page's Source or Supplier to see everything from that brand or bought
  there, tagged, with what you spent there; More → Brands & suppliers lists every name. Followers can tap your Source
  to see your products from that brand, never where you bought them. Nothing new is stored.
- `CLAUDE.md`: brands and suppliers is on dev.

### 0.48.2 — CLAUDE.md: 0.48.1 is live
- `CLAUDE.md`: sounds and ticks (D56–D58) went live on 2026-10-19 (release #69) and move from the to-do list to Done.
  Notes only; no change to the app.

### 0.48.1 — sounds quiet on silent (owner report)
- Decision D58. On GT Dev the sounds now stay quiet when your iPhone is on silent (0.48.0 fixed it by setting the
  quiet-on-silent mode before every sound). The Silent test card is gone, and the Sounds note says again that it's
  silent on silent.
- Tests: `sounds.spec.ts` checks the mode is set before every sound (fails when it's set only once). `CLAUDE.md`:
  next decision D59.

### 0.48.0 — sounds and ticks on their own screen; a silent test (owner request)
- Decision D57. **More → Sounds and ticks** (under Appearance) opens its own screen with the Sounds and Ticks
  switches and Soft or Woody. Leaderboard colours is back to just colours.
- Sounds still played with the iPhone on silent in the Home Screen app. On GT Dev only, a **Silent test** card on
  the new screen tries three iPhone sound modes; the app will use the one that stays quiet.
- Tests: `sounds.spec.ts` (4 Playwright tests), `more.spec.ts`. `CLAUDE.md`: next decision D58.

### 0.47.2 — CLAUDE.md: a website for the app on the to-do list (owner request)
- The to-do list gets item 5, **A website for the app**: a page at a separate address showing what Green Tracker is,
  linking to the app with Home Screen steps.
- The list is reordered as the owner asked: Sounds and ticks, Brands and suppliers, Leaderboard design rework, A
  website for the app, Smokes rework. Notes only; no change to the app.

### 0.47.1 — CLAUDE.md: brands and suppliers on the to-do list (owner request)
- The to-do list gets item 4, **Brands and suppliers**, for both Source and Supplier: see every product from one brand
  or supplier, suggestions as you type (like Country), and a way to avoid duplicates when there's no brand and both
  fields hold the same coffeeshop. Notes only; no change to the app.

### 0.47.0 — sounds and ticks (owner request)
- New (decision D56). Quiet sounds when you flick a switch, save a product (a short fanfare when it becomes your #1),
  save to the Log or Return to Log, and delete a Log entry or a photo. Made in code; quiet on silent.
- Ticks on iPhones with iOS 18+: a light tick as you tap a switch, Save, Save to log, Delete entry, Remove photo or
  Return to Log.
- More → Appearance → Sounds and ticks: Sounds and Ticks switches (both on to start) and Soft or Woody. Saved on this
  phone only; no data, export or follower change.
- Tests: `sounds.spec.ts` (3 Playwright tests). `CLAUDE.md`: sounds and ticks on dev; next decision D57.

### 0.46.3 — CLAUDE.md: fonts and colours on the to-do list (owner request)
- The to-do list's Leaderboard design rework now includes a font and colour rework for the whole app: the font of the
  numbers in the Leaderboard's top banners (Products, Average, Total), and colours that feel mismatched. Notes only; no
  change to the app.

### 0.46.2 — CLAUDE.md: 0.46.1 is live
- `CLAUDE.md`: the Log photo swap fix (D51), the photo rework (D52–D54) and the late-load fix (D55) went live on
  2026-10-18 (release #61) and move from the to-do list to Done. Notes only; no change to the app.
- Test fix: `zoom.spec.ts`'s double-tap sent its two taps one after another; on a busy machine they landed up to
  303ms apart, past the app's 300ms double-tap window, so the photo didn't zoom (seen once at 4 workers). The four
  touch events are now sent together (measured 0–8ms apart under the same load). The app is unchanged.

### 0.46.1 — a slow page load can't undo your change (owner request)
- Bug fix (decision D55, on the live site too). Flicking **Private** (or **Set as cover**) just after a product page
  opened could flick back for a moment when the page's slower first load arrived; Back and the Leaderboard could show
  the old version too. Your change was always saved. Now that late, older copy is ignored. Crops, cut-outs and Archive
  on the product page are covered the same way.
- Tests: 2 Playwright tests in `staleload.spec.ts` that hold the page's first load back until after the change; both
  fail on 0.46.0.
- `CLAUDE.md`: draw round a nug confirmed by Anton; this fix on the list; next decision D56.

### 0.46.0 — draw round a nug (owner request)
- Step 3 of the photo rework (decision D54). **Remove background** now opens on a choice: **Find the bud for me** or
  **Draw round it**. Draw a loop round each nug you want (Undo, Clear, two fingers to zoom), tap **Cut out**: the same
  AI cuts a clean edge from inside your loops and drops the rest, so touching nugs can be separated.
- After the AI's own try: **Not right? Draw round it**. From a drawn preview: **Not right? Draw again**.
- Found while building: zoom (0.45.0) had taken away Remove background's room for the iPhone's notch and home bar, so
  its top buttons could sit under the clock on dev. Fixed, with a test that pretends to have a notch (it fails
  without the fix).
- Tests: 5 unit tests (the loops' region, inside/outside, touching buds), 4 Playwright tests in `cutout.spec.ts`
  (a loop keeps only the bud inside it; two loops, Undo, Clear, Draw again, a tap isn't a loop, nothing inside;
  after the AI's try and pinch-zoom while drawing; the notch, axe and contrast). `photoAction(…, 'Cut out')` now
  picks Find the bud for me; `'Draw'` picks Draw round it.
- `CLAUDE.md`: zoom confirmed by Anton; step 3 on dev; next decision D55.

### 0.45.0 — zooming into a photo (owner request)
- Step 2 of the photo rework (decision D53). In the full-screen photo viewer: **pinch** to zoom (up to 4×),
  **double-tap** for 2× and back, **drag** to look around. Zoomed in, the buttons slide away so the photo fills the
  screen; one tap brings them back. Swiping to the next photo only when zoomed out.
- Works for your photos, Log entry photos and friends' photos. Nothing is saved.
- The viewer now handles swipes itself (the phone's own scrolling can't be combined with pinching).
- Found while testing: repeated test runs started copies in the same millisecond, and their made-up usernames (from
  the time only) clashed. `zoom.spec.ts` and `cover.spec.ts` now add random characters.
- Tests: `zoom.spec.ts` (7 Playwright tests, two-finger pinches simulated with CDP touch events); the viewer tests in
  `photos.spec.ts`, `cover.spec.ts`, `cutout.spec.ts`, `hero.spec.ts` and `logentry.spec.ts` pass unchanged.
- `CLAUDE.md`: item 5's step 1 confirmed by Anton, step 2 on dev; next decision D54.

### 0.44.0 — choosing the cover photo (owner request)
- Step 1 of the photo rework (decision D52). A product's **cover** (its first photo) is marked in the Photos grid with
  a gold ring and a star.
- **Product page:** open a photo and tap **Set as cover** in the new bar along the bottom (with Crop and Cut out). It
  saves at once: the big photo fades over to the new cover and your Leaderboard row follows.
- **Editor:** tap **⋯** on a photo (Set as cover, Crop, Remove background, Remove photo), or **press and hold** a photo
  and drag it; the first is the cover. Removing the cover makes the next photo the cover.
- The two round buttons on every photo are gone. Log entries keep one photo (⋯, no cover). A friend's photos: the star,
  nothing to tap but the photo.
- Found while testing: with several photos, the viewer's swipe area couldn't be reached by keyboard (an accessibility
  check flagged it); it can now (arrow keys).
- Found on GitHub's first run: the menu's accessibility check ran while the menu was still sliding up (half-faded text
  read as low contrast). `settled()` now also waits for a menu's slide-up; reproduced by slowing animations tenfold,
  which fails without the fix and passes with it.
- Tests: `cover.test.ts` (5 server tests), `cover.spec.ts` (9 Playwright tests); `photos.spec.ts`, `cutout.spec.ts`,
  `logentry.spec.ts` and `quality.spec.ts` use the ⋯ menu and the viewer's bar (`photoAction` in `helpers.ts`).
- `CLAUDE.md`: item 5's step 1 on dev; next decision D53.

### 0.43.4 — swapping a Log entry's photo (owner report)
- Replacing a Log entry's photo with a new one in a single edit no longer fails with "Something went wrong" (decision
  D51). The old photo is now removed before the new one goes in (an entry holds one photo); still one all-or-nothing
  save. The workaround (remove, save, then add) is no longer needed.
- Checked: product photos, Add to leaderboard and Return to Log weren't affected.
- Tests: 1 in `log.test.ts`, 1 in `returnToLog.test.ts` (a returned entry's swapped photo leads when it goes back),
  1 in `logentry.spec.ts` (the swap on screen); each fails on 0.43.3.
- `CLAUDE.md`: item 1 marked on dev; next decision D52.

### 0.43.3 — CLAUDE.md: photo section rework on the to-do list (owner request)
- The to-do list gets item 5, **Photo section rework**, for product and Log entry photos: choose which photo is shown,
  and tidy up how the photo section looks. Notes only; no change to the app.

### 0.43.2 — CLAUDE.md: a Done list (owner request)
- `CLAUDE.md`'s "Where things stand" gets a **Done** table under the to-do list (each finished item with its version,
  decision, and when it reached dev and live), filled in back to 0.39.0, and the rule that keeps it current: an item
  merged into `dev` is marked "on dev"; when it goes live it moves to Done.
- A separate "Green Tracker to-do list" conversation answers the owner's "what's done, what's next" from this section.

### 0.43.1 — CLAUDE.md: where things stand and the to-do list
- `CLAUDE.md`'s "Where things stand" now says live and dev are the same (0.43.0, Smokes hidden on live) and holds the
  to-do list, which each new conversation reads to the owner at the start: the Log photo swap bug, the Smokes rework,
  the Leaderboard design rework, and sound effects and haptics (the owner's idea, not planned yet).
- The note about sessions started on `dev` now says a branch push *may* be refused (it worked after a restart).

### 0.43.0 — Return to Log (owner request)
- A product on your Leaderboard can go back to your Log (decision D50): **product page → Return to Log**, between
  Private and Archive. It asks first.
- It becomes a Log entry with its name, type, country and first photo; its **amount** is all its purchases added up
  (3.5g + 3.5g = 7g). Everything else (ratings, purchases, notes, other photos) is **kept, hidden**, and its page shows a
  **Kept from your Leaderboard** card listing it.
- **Add to leaderboard** opens the editor with everything filled back in; Save puts back the same product, in the same
  place. **Delete entry** warns that the kept data goes too.
- While it's in the Log, followers don't see it or its photos. Export and Restore keep it as it is.
- Found while testing, not changed (it happens on the live site too): replacing a Log entry's photo with a new one in a
  single edit fails with "Something went wrong" (the new photo is added before the old one is removed, and an entry may
  only have one). Removing the photo, saving, then adding the new one works.
- Tests: `returnToLog.test.ts` (10 server tests), 2 in `logEntry.test.ts`, `returntolog.spec.ts` (8 Playwright tests);
  `people.spec.ts` checks a friend's product has no Return to Log.

### 0.42.0 — the four colours as one set (owner request, with a screenshot)
- On the iPhone, Amethyst came out as a strong purple block next to a much plainer Sapphire (decision D49).
- All four colours are now cards of one kind, each a little stronger than the one below: **Emerald** the faintest (still),
  **Sapphire** a faint card in a brighter blue, **Amethyst** a card in a softer lilac, **Rainbow** unchanged.
- Amethyst and Sapphire now sit under a near-neutral dark layer instead of a purple and a blue one.
- The same steps apply in Prism and Metals (their colours are unchanged). The key, Appearance and product pages follow.
- Tests: `appearance.spec.ts` checks every band is a card, the layer thinning band by band, and Gems' new colours and
  layers; the readability tests pass on every band in every preset.

### 0.41.0 — Leaderboard colours by score (owner request)
- Colours on the Leaderboard are now earned by the **score**, not the place (decision D48): **Emerald** 8.0–8.4,
  **Sapphire** 8.5–8.9, **Amethyst** 9.0–9.4 and **Rainbow** 9.5–10, each a little stronger than the one below. Below 8
  the green glow, as before. Rainbow, Diamond and Gold for places 1–3 are gone.
- Your **#1** wears a gold **crown** and a soft **halo**. Price, Value for money and Most used get no colours (they aren't
  scores); their #1 still gets the crown, in gold.
- **More → Appearance** (new): choose **Gems**, **Prism** (one rainbow growing stronger) or **Metals** (Emerald, Rose
  gold, Diamond, Rainbow), and switch the #1 mark off. Saved to your account; Export and Restore include it.
- A **Colours** button beside Rank by shows what each colour means (when ranking by a score).
- Product pages carry their colour, with a badge like **"Amethyst · #3 on your Leaderboard"**.
- Friends' boards show in your own colours. Nothing about your choice is shared.
- Tests: `gems.test.ts` (6) and updated `leaderboard.test.ts`; `appearance.test.ts` (4 server tests); `appearance.spec.ts`
  (7 Playwright tests) and `gems.spec.ts` (was `podium.spec.ts`, 7); `leaderboard`, `heat`, `mostused`, `welcome`,
  `people`, `hero`, `motion`, `numbers`, `products`, `cutout`, `more`, `data`, `datascreens` and `smokes-off` follow the new colours. The
  API tests' made-up addresses are now random per file (`test/api/client.ts`): every file used to start at 10.0.0.1, so
  the sign-up limit counted across files and this release's new file pushed an unrelated one over it.

### 0.40.1 — CLAUDE.md (owner request)
- A `CLAUDE.md` at the top of the repository holds how we work (the dev and live sites, "merge" and "go live", the rules
  for every change, testing lessons). Each new conversation reads it automatically; it's kept up to date as things change.
- The dev site's lock is described as it was set up: signing in with the owner's Cloudflare account (not an email code).

### 0.40.0 — a private dev site (owner request)
- A second site, only for you, to try new work on your phone before it goes live (decision D47):
  https://green-tracker-dev.green-tracker.workers.dev, behind a Cloudflare Access lock (your Cloudflare login), with its own data, Smokes on, an
  orange **DEV** label and "GT Dev" on the Home Screen.
- From now on "merge" puts work on the dev site; "go live" sends what's on dev to the live site, through the same tests.
- Nothing changes on the live site.
- Tests: 3 config checks (`siteConfig.test.ts`), 3 Playwright tests (`dev-site.spec.ts`); the API test server now runs set up
  like the dev site.

### 0.39.0 — Smokes off on the live site (owner request)
- The live site is back to how it was before Smokes (decision D46): four tabs, no Smokes cards, no Most used, no Smokes
  switches in Privacy. Privacy itself stays.
- Nothing is deleted: everyone keeps their account, followers and data, and any smokes already saved are kept (and still
  exported) for when Smokes comes back. Followers see nothing about smokes in the meantime.
- Smokes is now a per-site switch, so it stays on for testing (the dev site, next) while it's rebuilt.
- Tests: the API and Playwright tests now run a second server with Smokes off, as on live: 5 new server tests
  (`smokesOff.test.ts`), 6 new Playwright tests (`smokes-off.spec.ts`), 2 rule tests.

### 0.38.0 — Privacy (owner request)
- **More → Privacy → What followers see**: choose what your followers see (decision D45, layout B of the mockups). A preview
  at the top shows your top product exactly as followers get it, and **Open their view** shows your whole board as they see it.
- Switches, each saved at once: **Share my Leaderboard**, **Source**, **Country**, **Product photos**, **How many times I've
  had each**, **Most used on my Leaderboard**, **My Smokes: what and when** (not recommended; never your Effect notes) and
  **My profile photo**.
- Everything starts as before: followers see what they saw until you change something. Nobody is told when you do.
- Export and Restore include your choices.
- Tests: 6 new Playwright tests (`privacy.spec.ts`), 8 server tests (`privacy.test.ts`), 4 rule tests (`privacy.test.ts`);
  `more.spec.ts` and `datascreens.spec.ts` follow the new row and Export line.

### 0.37.0 — Most used (owner request)
- **Rank by → Most used** on your Leaderboard (decision D44, option C of the mockups): your products by how many times you've
  had them. Each row shows the amber flame and the count, with TIMES under it.
- Products you've never smoked are left out (a line under the list says how many). A tie goes to the higher Overall.
- The top three get the rainbow, Diamond and Gold as usual, and their pages say "#1 by Most used".
- Only on your own Leaderboard: a friend's board doesn't offer it.
- Tests: 5 new Playwright tests (`mostused.spec.ts`), 3 new rule tests and updated option lists (`leaderboard.test.ts`), and
  `heat.test.ts`.

### 0.36.0 — Smokes (owner request)
- A new tab, **Smokes**, second in the tab bar (decision D43, option B "Week strip" of the mockups): what you had and when.
  At the top, your last 7 days as a strip, with how many in the last 7 days and this month; then every smoke by day.
- **The green +** opens a list of what you can choose: Recent, your Leaderboard, your Log, or a **New Log entry**. Then
  When (now, which you can change), How much (it starts with what you had last time) and Effect, a box to write in.
- Tap a smoke to change or delete it.
- Every **product page** and **Log entry page** has a Smokes card (option 1): how many times (taken, for edibles), when
  last, your last three and **Add a smoke**.
- **Add to leaderboard** takes an entry's smokes with it; **deleting an entry** deletes its smokes (it says how many).
  Its question now mentions the photo only when there is one (it used to say "and its photo" every time).
- **Export and Restore** include your smokes; **Delete account** removes them. **Followers never see any of it.**
- Tests: 12 new Playwright tests (`smokes.spec.ts`), 10 server tests (`smokes.test.ts`), 10 rule tests (`smoke.test.ts`);
  `tabbar.spec.ts`, `header.spec.ts`, `data.spec.ts`, `datascreens.spec.ts` and `data.test.ts` follow the fifth tab and the
  new lines.

### 0.35.0 — purchases fold into rows (owner request)
- In the product editor, each purchase is now a one-line row: its date, a green **Latest** tag on the latest one, the amount,
  total and supplier, and the price per gram on the right (decision D42, option B "Rows" of the mockups). Tap a row to open
  its fields; one opens at a time.
- **Add purchase** adds one at the bottom, already open, with the cursor in Amount.
- "Needs a total paid to be kept" is now amber. If something in a purchase stops the save, that purchase opens by itself.
- Tests: 6 new Playwright tests (`purchases.spec.ts`); `products.spec.ts` and `editor.spec.ts` open a saved purchase first.

### 0.34.0 — a Log entry's own page (owner request)
- Tapping an entry in the Log now opens a page about it, like a product page (decision D41, option C "View first" of the
  mockups, with your changes): its photo across the top, the name, a Details card with **the date you logged it**, and an
  Actions card with **Add to leaderboard**, **Edit** and **Delete entry**. Edit is also top right.
- An entry with a photo **flies it** from the Log into its page, and back again, like products.
- Edit opens the same form as before; Cancel and Save bring you back to the entry's page. New entries open straight into the form.
- Tests: 7 new Playwright tests (`logentry.spec.ts`) and one in `motion.spec.ts`; `log.spec.ts`, `country.spec.ts` and
  `editor.spec.ts` follow the new page.

### 0.33.0 — the Data screens (owner request)
- Export, Restore and Delete account have a new look (decision D40, option A "Hero" of the mockups): a glowing icon, a
  heading and one sentence at the top of each.
- **Export** ticks off what's in the file. **Restore** shows the chosen file's products, Log and photos as big numbers, and
  you can choose a different file. **Delete account** is red throughout, crosses off what goes and offers Export first.
- **A progress bar** while Export adds photos and while Restore uploads them.
- Nothing about what these screens do has changed.
- Tests: 4 new Playwright tests (`datascreens.spec.ts`); `data.spec.ts`, `cutout.spec.ts` and `profile.spec.ts` read the new
  Restore card.

### 0.32.0 — a three-place podium: rainbow, Diamond, Gold (owner request)
- Only the top three get special colours now (decision D39, option A "Holo" of the mockups). 1st stays the rainbow;
  **2nd Diamond** and **3rd Gold** are filled edge to edge with flowing colour like the rainbow, Diamond in ice blue and
  lilac (still twinkling), Gold in warm gold. Platinum and Pewter are gone.
- **4th place** is an ordinary row now and glows in its score's colour, like 5th and below.
- **Product pages** of the top three match (badge, haze, score); a 4th-place page is ordinary. Same on a friend's board.
- The **welcome screen's** third example is Gold.
- Tests: the podium tests now check three holo cards, a glowing 4th, Gold's product page (also under a Type filter and on
  a friend's board) and readability across the motion on all three; domain tests check the three-place rule.

### 0.31.0 — More screen: profile card and icon rows (owner request)
- More now opens with you: your photo or initial, @username, and your products, followers and following; tap it for
  People (decision D38, option A of the mockups).
- Every row has a small coloured icon, like the iPhone's Settings; Archive moves into Data; Sign out sits on its own.
- **The version number is now at the bottom of More** ("Green Tracker 0.31.0"), no longer under About.
- Tests: 4 new Playwright tests (`more.spec.ts`).

### 0.30.0 — loading placeholders (owner request)
- While a screen waits for its data you now see faint shapes laid out like it, with a soft light sweeping across,
  instead of a blank page (decision D37, option A of the mockups): Leaderboard, a friend's board, the Log, product pages
  and the People lists. Only if loading takes more than a moment; still with Reduce Motion on.
- Tests: 6 new Playwright tests (`loading.spec.ts`) that hold the data back on purpose.
- The accessibility sweep of 16 pages (about 35s on its own) reached its 60s limit with 4 workers busy; it's now marked
  slow, like the hero test in 0.29.0. Same checks.

### 0.29.0 — welcome screen: "Your stash, ranked." (owner request)
- The sign-in screen now shows the name small at the top, the headline "Your stash, ranked.", and an example
  Leaderboard: three podium rows fanned like cards, labelled as an example (decision D36, option A of the mockups).
- Same buttons; they always fit without scrolling, including on an iPhone SE.
- Create account, Use a recovery code and Add a new passkey get a glowing leaf tile above the heading, a glowing
  current step and the username in a green card.
- Tests: 7 new Playwright tests (`welcome.spec.ts`) plus checks in the account and delete-account tests.
- The hero readability test (5 pages × 12 photographed moments, about 37s on its own) ran past its 60s limit once
  with 4 workers busy; it's now marked slow (3 minutes). Same checks.

### 0.28.1 — steadier accessibility checks (tests only)
- 0.28.0's deploy run stopped on the podium page's accessibility check (colour contrast). It wasn't the new tab
  bar: the check had run during the screen's 0.2s fade-in, when the buttons are half-transparent (measured 2.6 : 1
  half-way). Every axe check now waits for that fade to finish first (`settled` in `test/e2e/helpers.ts`). The app
  is unchanged; this release puts 0.28.0's tab bar live.

### 0.28.0 — tab bar outlines and glow (owner request)
- The tab bar's icons are slim outlines; the tab you're on shows its solid icon in green with a soft glow and a
  short glowing line under its name, instead of the green bubble (decision D35, option B of the mockups).
- Same four icons, same bar, same + button; the People request count is unchanged.
- Tests: 6 new Playwright tests (`tabbar.spec.ts`); the green-look test checks the glow instead of the bubble.
- Found while testing: the photo-flight test (`motion.spec.ts`) that failed now and then read the podium sweep's start
  time in the frame before the sweep resumed after landing (it's paused during the flight), and got nothing. It now
  waits for that frame; the app was right all along. 128/128 in repeated runs.

### 0.27.1 — cropper Square fix (found while testing 0.27.0)
- Tapping **Square** in the cropper before the photo had finished loading (more likely on a slow
  connection) left the box full-frame, so **Apply** saved the whole photo marked as square. The box is
  now squared as soon as the photo's size is known.
- The first version of the fix squared it a moment later, which could undo a **Reset** tapped in that
  moment (caught by repeating the photo tests 48 times); it now happens as the photo loads.
- This was also the cause of the photo test that failed now and then (about 1 run in 12).
- Tests: 1 new Playwright test (`photos.spec.ts`) that holds the photo back until Square is tapped.

### 0.27.0 — editor tidy-up (owner request)
- Every section in the product and Log editors has a small icon by its heading (decision D34).
- Ratings are slimmer: the name and number on one line with a thinner slider under it, about a third shorter.
- As you drag, each slider, its knob and its number take the score's colour, amber to mint, like the product page.
  High, where it doesn't count, is grey with a short note.
- Overall now shows live, in its colour, in the Ratings heading.
- The date boxes show their calendar icon on the left, inside the box, so it can't be cut off.
- Tests: 7 new Playwright tests (`editor.spec.ts`).

### 0.26.0 — drawings on the empty screens (owner request)
- Every empty screen now has its own small green line drawing instead of the faint leaf (decision D33, option B
  of the mockups): a podium on a new Leaderboard, a notebook on an empty Log, a box in the Archive, a funnel when
  a filter shows nothing, rating bars when nothing has the rating you rank by, an empty podium on a friend's
  board, and people, an inbox and a crossed-out circle on the People lists and Blocked.
- **Add a product** and **Add a log entry** are green buttons with a +.
- The People lists and Blocked, a plain line before, get a smaller card with a short title.
- Tests: 10 new Playwright tests (`empty.spec.ts`).

### 0.25.0 — rating bars in the heat colours (owner request)
- On a product page each rating bar and its number now take the score's colour, the same amber → mint as the
  Leaderboard (decision D32, option A of the mockups), so a weak Burn stands out in amber at a glance.
- High stays grey where it doesn't count; on edibles it counts, so it's coloured. Unrated categories stay plain.
- Same on a friend's product pages.
- Tests: 4 new Playwright tests (`bars.spec.ts`), including readability from amber to mint.

### 0.24.0 — podium metals mirror the heat (owner request, with a screenshot)
- Diamond, Platinum and Pewter now glow from the right in their metal colour, like the rows below them, instead
  of a faint wash from the left (decision D31, option A of the mockups). Still strongest for Diamond.
- The scores on the top four flow through their colours: rainbow for 1st, ice blue, silver and pewter.
- The readability test caught the mockup's stronger glow washing out Diamond's score when the shimmer passed; the
  glow is a little softer and the scores use each metal's lighter shades, so it passes.
- Tests: the podium row tests check the new glow and coloured scores.

### 0.23.0 — Leaderboard heat (owner request)
- Rows 5 and down now glow in a colour that says how good the score is (decision D30, option D of the
  mockups): amber for low scores, through yellow-green, to mint for the best, with the score in the same
  colour. The top four keep their podium looks.
- Ranking by price or value for money leaves the rows plain; unrated rows stay plain too.
- Same on a friend's Leaderboard and in the Archive.
- Tests: 3 unit tests and 4 Playwright tests (`heat.spec.ts`), including readability from amber to mint.
- The D18 "green look" test now leaves glowing rows to `heat.spec.ts` (they have their own colour and edge by
  design).

### 0.22.0 — the Aurora (owner request)
- Depth behind every screen (decision D29, option B of the mockups): two soft, still lights at the top,
  green from the left and teal from the right, which scroll away with the page, and a faint green haze
  behind the tab bar. Photo viewer, cropper and other full-screen overlays stay black.
- The Rank / Type row and the Log's country headers, which stick under the header, are now frosted glass
  like the header instead of solid black, so they don't cut a band through the lights.
- Tests: 4 new Playwright tests (`aurora.spec.ts`), measured from pixels; each fails without the change.

### 0.21.0 — rounded numbers (owner request)
- Scores, rank numbers, stats tiles, the podium badge's number, the rating numbers, value for money
  and the editor's rating number now use the iPhone's own rounded font (decision D28, option B of the
  mockups), same size as before. Prices and all other text are unchanged; nothing is downloaded.
- Tests: 2 new Playwright tests (`numbers.spec.ts`), which fail without the change.

### 0.20.1 — one centred cut-out (owner report, with a screen recording)
- **Fixed:** on a product whose photo is a cut-out, the top of the page showed the bud twice: the
  cut-out itself, too small and off to the left, and a larger copy in the middle. The copy is the
  thumbnail shown under the photo while it loads; a normal photo covers it, but a cut-out is
  see-through. The cut-out was drawn at its own width from the left edge instead of filling its
  centred box. Both now share one centred box, so there's one bud in the middle. Normal photos were
  never affected.
- Tests: the Poster test now checks the cut-out and its thumbnail share one centred box (it fails on
  0.20.0 by 126px).

### 0.20.0 — the Poster (owner request)
- The top of every product page is new (decision D27, option A of the mockups): the photo fills the
  top of the page edge to edge, running up behind the header, and the name, score, tags and price
  sit on its bottom over a dark fade, so they're always readable. The ratings now start on the first
  screen.
- A cut-out floats in the upper part on a soft glow; without a photo, the type icon sits there.
- Podium pages keep their badge and flowing score; the frame round the photo becomes a tier-coloured
  haze flowing behind the details, strongest for 1st and Diamond. The sweep still crosses the photo
  as it opens, and Diamond still twinkles.
- A friend's product pages get the same, without the price.
- Photo grows flies into the new big photo, and the details fade in once it lands.
- Tests: 3 new Playwright tests (`hero.spec.ts`), including readability over an all-white photo and
  a busy one (checked by deliberately weakening the fade); the podium tests now check the haze.

### 0.19.5 — spec tidy-up
- §4: restored the *Tap feel (D20, 0.14.0)* heading, lost in 0.16.0, above *Press*, *Photo grows*
  and *Safari fixes*.
- §3: D25 now sits before D26 in the decisions table.
- No app changes.

### 0.19.4 — swipe-back from a Log entry (owner report, with a screen recording)
- **Fixed:** with the Log scrolled down, swiping back from a loose Log entry showed black behind
  it. Loose entries open their editor without the photo animation, so they had missed the 0.19.2
  setting that lets the iPhone show its picture of the list during the swipe. Products opened
  from the Log were already fine (the recording showed both).
- The same can still happen leaving other screens while scrolled down (People lists, a product's
  editor, More's sub-screens); left for now at the owner's choice.
- Tests: 1 new Playwright test (fails without the fix). GitHub's first run failed it by 2.5px:
  the test measured the row while the Log was still doing its entrance rise (6px, 0.2s),
  confirmed by measuring the screen at that moment (1.4–2.5px low). The motion tests now wait
  for the entrance to finish before measuring; this is also the likely cause of the one
  unexplained failure seen while testing 0.19.3 (same kind of measurement). Test-only.

### 0.19.3 — test fix before 0.19.2 went live
- 0.19.2 merged but didn't go live: GitHub's tests on `main` failed. Coming back from a product
  with the list scrolled, the browser now puts the list back where it was by itself (that's
  what lets the swipe show your list), and on GitHub's faster machine it sometimes did so after
  the app had chosen where to land. Where you were is usually the same place, but after
  re-rating a product (so its row moved) or when a row had been tapped at the top, the two
  disagreed.
- Coming back now lands exactly where you were when you tapped, if the row is still on screen
  there; otherwise as before (the row at roughly its old screen position, or the top if it's
  gone). If the browser's restore lands afterwards somewhere else, the app undoes it.
- Tests: the Leaderboard return test covers "exactly where you were", and the §17 re-rate test
  makes the browser's restore land late on purpose (it fails without the undo).

### 0.19.2 — swipe-back shows the list, smooth Back (owner report, with a screen recording)
- **Fixed:** swiping back from a product still showed black behind it when the list had been
  scrolled. The iPhone only uses its picture of the Leaderboard or Log for the swipe when that
  screen's history entry says it restores its own scroll position, or when the page happens to
  be scrolled exactly as the list was. It was black every time the list had been scrolled, and
  fine at the top, in both recordings. The list's entry now restores its scroll, so the swipe
  should show your list as it was.
- **Fixed:** the Back button made the product page jump up just as the photo started flying
  home (the same Safari quirk as the jump on opening, fixed in 0.19.1, the other way round).
  Nothing scrolls during the flight now in either direction.
- 0.19.1's other fixes (no jump on opening, no dark flash after a swipe) were confirmed in the
  recording.
- Tests: the scrolled-list Photo grows test now also covers Back and the browser's Back; each
  new check fails with the old code.

### 0.19.1 — smoother swipe-back (owner report, with a screen recording)
- **Fixed:** swiping back from a product sometimes showed black behind the page, then a black
  screen for about half a second. The phone keeps a picture of the Leaderboard to show while
  you swipe, and it could take that picture in the middle of the photo animation, when the
  screen is dark. The app now records the move to the product just before the animation starts.
- **Fixed:** tapping a row with the list scrolled down made the whole screen, header and tab
  bar included, drop by the distance scrolled and freeze there before the photo flew. The page
  no longer scrolls while the photo is flying (it scrolls to the top once it has landed, where
  you can't see it).
- **Fixed:** after a swipe back, the Leaderboard dipped dark and faded in again. After a swipe
  it now just appears, since the phone has already animated the change; other screens still
  fade in as before.
- Found by measuring the brightness of every frame of the recording (60 a second). Tests: 2 new
  Playwright tests (`motion.spec.ts`), each checked to fail with the old code.

### 0.19.0 — remove background (owner request)
- Photos can have their background removed (decision D26): tap the new button on a photo
  (bottom-left in the grid) or **Remove background** in the viewer. The bud is cut out and
  centred, and shows with no box on your rows, product pages, a friend's view and the podium.
- Works on your phone: the first time it asks before a one-off 47 MB download; each cut-out
  takes about 4 seconds. Found several things (a bag, a lighter)? Tap the bud. A bud lying on
  a tray? **Not right? Tap the bud in your photo** zooms in on it.
- Your original is never changed: **Restore background** puts the photo back as it was.
- Product and Log entry photos, new and existing; exports and restores keep cut-outs.
- Tests: 13 unit tests, 7 API tests, 7 Playwright tests (one with the real AI).

### 0.18.1 — test fix
- One full test run failed once: going back from a product's editor seemed to land 116px
  higher than where the product page had been. Traced by recording the page: it was the
  test tool, not the app. Playwright's click() sometimes scrolls the page by 116px just before
  tapping the Edit button, so the app correctly remembered the new spot while the test compared
  against the old one. Tapping the same spot directly (as a finger does) landed exactly right
  every time. The test now taps the button at its place on screen, and prints every scroll on
  the way back if that check ever fails again. No app changes.

### 0.18.0 — your photo in the header (owner request)
- Your profile photo (or your letter, until you add one) now sits in the top-right corner of
  Leaderboard, Log, People and More (decision D25). Tap it to open People at your card; on People
  it takes you back to the top.
- Only on the four main tabs: screens further in keep Back, Edit and ⋯ in their corners.
- Tests: 4 new Playwright tests (`header.spec.ts`), including a check that switching tabs never
  shows the letter before the photo.

### 0.17.0 — profile photos, and People opens on Following (owner request)
- You can add a profile photo (decision D23): tap your photo in the new card at the top of
  People, pick or take a photo, then move and zoom it into the circle. Change it, re-frame it
  or remove it the same way.
- Who sees it: people you follow or have asked to follow, and your approved followers. Someone
  whose request you haven't approved, strangers searching, and anyone blocked see your letter.
  Only the circle crop is ever sent to anyone else.
- Photos show in the Following, Followers and Requests lists, search, the page of someone you
  don't follow yet, and next to @username at the top of a friend's Leaderboard.
- People now opens on **Following**, in the order Following · Followers · Requests (decision
  D24). Waiting requests still show as the green number on Requests and the People tab.
- Export includes your profile photo; restoring an older file leaves your photo alone.
- Tests: 8 API tests (privacy rule on raw responses, deliberately broken twice to check they
  catch it), 7 unit tests, 6 new Playwright tests; the People test now expects Following first.
  Found while repeating the tests in parallel: People's blocking test searched with only the
  first 6 letters of a name, which can match another run's account; it now searches the full
  name (test only, no app change).

### 0.16.0 — podium product pages (owner request)
- A product in the top four now carries its tier onto its own page (decision D22). 1st: a
  crown badge ("#1 on your Leaderboard"), a flowing rainbow frame round the photo, a
  rainbow score, the holo card behind the name and score, and one rainbow sweep across
  the photo as it opens. Diamond gets the same in ice blue plus glints; Platinum a frame,
  silver score and badge; Pewter a calm frame and badge.
- It follows your Type and Rank by, so the page matches the row you tapped, and the badge
  says which list it tops ("#2 in Flower", "#1 by Taste"). Same on a friend's product pages.
- Tests: 3 rule tests and 6 new Playwright tests (`podium.spec.ts`), plus a check that
  the sweep waits for Photo grows to land. The pixel-measured readability check caught two
  things before release: Pewter's "#4" was too dim in its darkest shade, and 1st place's
  "#1" and "OVERALL" dipped just below the bar when the brightest rainbow passed behind them
  (only now and then, so it passed on some runs). Both fixed and re-run many times.

### 0.15.0 — cool podium (owner request)
- 2nd–4th place are now **Diamond** (ice blue), **Platinum** and **Pewter** instead
  of gold, silver and bronze (decision D21). 1st stays the rainbow holo.
- "Descending shine": each metal shines a little less than the one above, and only
  Diamond twinkles, with tiny star glints in the row's corners. Same on a friend's
  Leaderboard. Reduce Motion: colours only, no glints.
- Tests: the right colours on each tier and no gold or bronze left anywhere, the shine
  dropping tier by tier, the glints only on Diamond, clear of all text and hidden with
  Reduce Motion, and the pixel-measured readability check across the animation (it
  passes with the brighter Diamond).

### 0.14.1 — smoother Photo grows (owner report, with a screen recording)
- **Fixed:** just after the photo landed, opening or leaving a product, the page below
  the header dipped dark and faded back in. The screen's normal entrance fade was
  switched off during the flight and then switched back on when it ended, which
  restarted it. It now stays off on the screen that has just arrived.
- Found by measuring the brightness of every frame of the recording (a 0.2s dip right
  after each flight). Tests: the motion tests now record every start of that fade and
  fail if one happens after a flight, on open and on Back (the old check looked too
  late to see it).

### 0.14.0 — tap feel (owner request)
- **Lift** (decision D20): everything you can tap lifts under your finger: rows and
  buttons grow slightly with a soft shadow, icons pop; rows inside a card light up
  green. It waits a moment before showing, so scrolling never lights things up, and a
  quick tap still flashes. (Before, iPhone showed almost no press feedback at all.)
- **Photo grows**: opening a product from your Leaderboard, the Log or a friend's
  Leaderboard flies its photo up into the big photo at the top; Back flies it home.
- The big photo shows its thumbnail while the full photo loads.
- Reduce Motion: presses change colour only, and products open without the flight.
- Tests: 5 new Playwright tests (`motion.spec.ts`). Found while testing: the first
  version waited for screen frames that the browser pauses during the transition, so
  every product open froze for about 4 seconds (the existing tests still passed); fixed,
  and a test now fails if the screen is ever frozen for more than 0.6s.

### 0.13.0 — the holo podium (owner request)
- Four tiers instead of three (decision D19): 1st is a pastel rainbow holo card,
  2nd gold, 3rd silver, 4th bronze, each with a flowing edge and number, and a shimmer
  that cascades down the four. Same on a followed person's Leaderboard.
- Only rated products get a tier (an unrated product used to get a medal when it
  landed in the top three).
- iPhone Reduce Motion: colours stay, movement stops.
- Tests: 2 new rule tests (unrated never tiered, tiers follow another Rank by), tiers
  checked for every filter × Rank by and on a followed person's board, motion and
  cascade timing, Reduce Motion, and a pixel-measured readability check across the
  animation. That check caught first place's small grey text dipping below the
  readability bar when the shimmer passed behind it; the dark layer and that text were
  adjusted until it passed.

### 0.12.0 — the green look everywhere (owner request)
- The stats tiles' green now runs through the whole app (decision D18): cards have
  a soft green fade and edge, section titles are green, the header, tab bar and Save
  bar have green lines, the active tab sits on a green bubble, rating bars fade from
  green to bright green, and photos have a thin green outline.
- Tests: a new check of the green look on nine screens; axe still finds nothing.

### 0.11.0 — stats tiles (owner request)
- The number and label in every stats tile are centred, and each tile has a faint
  green diagonal wash and green border, like the podium rows (decision D17). Same on
  the Leaderboard, the Log and a followed person's Leaderboard.
- Tests: tiles centred, not cut off (also at 375px) and washed, on all three screens.

### 0.10.3 — spec note
- Recorded that Safari's AutoFill Contact button on iPhone is Safari's own feature, why
  the app leaves it alone, and how to turn it off on a device (§4 *Country picker*).
  No app changes.

### 0.10.2 — country picker on iPhone (owner report)
- **Fixed:** with the keyboard up, the editor showed through the see-through keyboard
  as garbled text behind its AutoFill bar. The picker now always covers the whole
  screen and pads the list above the keyboard instead of shortening itself.
- The page behind the picker is inert while it's open, so the keyboard's ⌃ ⌄ arrows no
  longer move to fields hidden behind it.
- The search box says "Search" (no "country"), to discourage Safari's AutoFill Contact.
- Tests: the picker covers the full viewport (also with a simulated keyboard, where the
  list is padded so its end scrolls above it), the page behind is inert and can't take
  focus, and stops being inert on close.

### 0.10.1 — test fix
- The new country test read the saved product before Save had finished (its wait for
  the profile's address also matched `/products/new`), so CI on `main` failed and 0.10.0
  was never deployed. It now waits for the real profile. No app changes.

### 0.10.0 — searchable country picker (owner request)
- Country, in the product and Log entry editors, opens a full-screen list with flags
  beside every name, a search box (word starts, nicknames like UK and USA, accents
  ignored), a Used section of your most-used countries, and "Use '…' as Other" when
  nothing matches. The field itself shows the flag. Decision D16; stored data unchanged.
- The search box no longer draws a second focus ring inside itself (People search too).
- Tests: 9 domain tests (search, ordering, nicknames, accents, Used), 3 Playwright tests
  (search and pick, Enter, Cancel/Escape, Not set, Other, Use as Other, saved values in
  both editors), axe on the open picker; the product and promotion journeys now pick
  their country through it. Totals: 214 Vitest, 47 Playwright.

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
