# Green Tracker — Design Brief

> **Companion to `green-tracker-rebuild-brief.md`.** That brief says what the app
> does; this one says how it should look and feel. **Where behaviour is
> concerned, the rebuild brief wins** — this document never changes a rule, only
> how it is presented.
>
> **Who this is for:** the Claude conversation building the app. Treat the
> tokens and rules here as the starting system. Where something is marked
> **designer's choice**, propose it to the owner (Anton) with a mockup or
> screenshot before committing.

---

## 1. Direction

**Evolve, don't replace.** The previous build was full glassmorphism —
translucent blurred panels over a black-to-green gradient with glowing orbs. The
owner likes the identity but wants it to feel fresher. The new direction is:

> **Clean dark minimal.** Solid dark surfaces, crisp type, generous spacing.
> Green is an *accent*, not a wash. Frosted glass survives **only on the top
> header and the bottom navigation**, where it earns its place by letting content
> scroll visibly beneath.

**Principles**

1. **Scores read at a glance.** The number is the hero of every row and profile.
2. **Quiet surfaces, one accent.** Structure comes from surface steps and
   hairlines, not shadows, gradients or glow. Colour is reserved for meaning:
   green for action/active, the strain-tag colours, the podium metals.
3. **iPhone first, one-handed.** Designed at **390px** wide, working down to
   **375px** and up to tablet/desktop without breaking. Primary actions within
   thumb reach.
4. **Native where it matters.** Dropdowns stay native `<select>` so iOS shows its
   own picker. Inputs never trigger iOS zoom.
5. **Dark only.** No light theme. Don't build theme switching.

**Must survive from the old design:** the **leaf mark**, the **gold / silver /
bronze podium**, the **colour-coded strain tags**, and the **type silhouette
icons**. Everything else is open to refresh.

---

## 2. Identity

### The leaf mark

An original **five-leaflet leaf** — the app's identity. Exact geometry is in
**Appendix A**; reuse it rather than redrawing.

| Variant | Where | Treatment |
|---|---|---|
| **Header mark** | beside the title in the top bar | Green gradient fill with a brighter edge (the old "glass" leaf — keep it; it's the one piece of glass styling outside the bars) |
| **App icon** | Home Screen icon, manifest icons | Opaque version on a dark green field. Produce 180, 192, 512 and maskable-512 |
| **Row / flower mark** | type icon for Flower (§7) | Flat solid silhouette, `currentColor` |

In rows the leaf means **flower**; in the header and app icon it means **the
app**. Both are intended.

---

## 3. Colour tokens

Evolved from the old palette. Define as CSS custom properties and use only
these — no one-off hex values in components.

### Base and surfaces

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050807` | Page background (near-black, green-tinted) |
| `--surface-1` | `#0c1410` | Cards, list rows, tiles |
| `--surface-2` | `#111c16` | Inputs, pressed rows, nested panels |
| `--surface-3` | `#17251d` | Selected / active surfaces, sheet backgrounds |
| `--hairline` | `rgba(255,255,255,0.08)` | Dividers, card borders |
| `--hairline-strong` | `rgba(255,255,255,0.14)` | Input borders, focused outlines at rest |
| `--bar` | `rgba(5,8,7,0.78)` + `backdrop-filter: blur(20px) saturate(140%)` | Header and bottom nav (the only glass) |
| `--bar-solid` | `#060f0a` | Opaque base painted beneath the bars and into the safe areas (§11) |

### Text

| Token | Value | Use |
|---|---|---|
| `--text` | `#eef4f0` | Primary text, scores |
| `--text-2` | `rgba(238,244,240,0.64)` | Secondary text, metadata lines, tile labels |
| `--text-3` | `rgba(238,244,240,0.38)` | Placeholders, disabled, unrated dashes — **never** for information the user needs to read |

### Accent

| Token | Value | Use |
|---|---|---|
| `--accent` | `#2fb86a` | Primary buttons, active tab, slider fill, focus ring |
| `--accent-bright` | `#58e08c` | Icons on dark, links, photo-placeholder marks, Log row markers |
| `--accent-soft` | `rgba(47,184,106,0.14)` | Active pill background, selected states |
| `--on-accent` | `#04140b` | Text/icons on a solid `--accent` button |

### Strain tags (keep)

| Tag | Text & border | Background |
|---|---|---|
| Indica | `#b79bff` (border at 32% alpha) | same colour at 8% |
| Sativa | `#ffcf6b` | same colour at 8% |
| Hybrid | `#58e08c` | same colour at 8% |

Tags are small outlined pills: 11–12px semibold, uppercase or title case
(designer's choice, consistent everywhere).

### Podium (keep)

| Rank | Metal | Treatment |
|---|---|---|
| 1 | Gold `#e2b760` | |
| 2 | Silver `#ced6de` | |
| 3 | Bronze `#c68254` | |

Old treatment was a *tint through the glass*: a diagonal wash of the metal
colour fading out across the row (≈17% → 0%), a metal-tinted border and a
metal-coloured rank number. In the minimal style keep the idea but quieter:
**metal-coloured rank number + metal border at ~40% alpha + a faint diagonal wash
(≤12%) on the row surface.** No glow, no solid metal fills. The podium follows the
**visible** order (filters and Rank by renumber — see rebuild brief §10.1).

### States

| Token | Value | Use |
|---|---|---|
| `--danger` | `#ff6b6b` | Delete, block, destructive confirmations, errors |
| `--warning` | `#f0a93b` | Rare warnings (e.g. offline banner) |
| `--private` | `--text-2` | The private lock marker — deliberately *not* a loud colour |

**Pending** follow states use neutral styling (outlined button, `--text-2`), not
a colour, so they never read as a strain tag.

---

## 4. Typography

- **Font:** the system stack — `-apple-system, BlinkMacSystemFont, "SF Pro
  Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. No web fonts.
- **Numbers:** `font-variant-numeric: tabular-nums` on **every** score, price,
  amount, rank and tile value, so columns line up.
- **Never below 16px on inputs and selects** — iOS zooms the page otherwise.

| Role | Size / weight | Notes |
|---|---|---|
| Header title | 17 / 600 | Truncates with ellipsis; never shrinks |
| Screen/section heading | 20 / 700 | |
| Hero score (profile) | 44–56 / 700 | The biggest thing on the profile |
| Row score | 22 / 700 | With a caption label beneath (`OVERALL`, `TASTE`…) |
| Row title | 16 / 600 | Truncates |
| Body | 15–16 / 400 | |
| Metadata / secondary | 13 / 400, `--text-2` | |
| Caption / tile label | 11 / 600, uppercase, +0.06em tracking, `--text-2` | |
| Tile value | 20 / 700 | |

---

## 5. Spacing, shape, depth

- **Spacing scale (4pt):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40.
- **Screen gutter:** 16px each side.
- **Radius:** 8 (small controls, thumbnails in dense lists) · 12 (rows, cards,
  inputs) · 16 (sheets, large cards) · 999 (pills, tags, avatar circles).
- **Depth:** **flat.** Separation by surface step + hairline. No drop shadows on
  rows or cards. A single soft shadow is allowed on floating elements only
  (a floating add button, action sheets).
- **Tap targets:** ≥ 44×44px, always.

---

## 6. Components

### 6.1 Leaderboard row

Left to right:

1. **Rank number** — 13–15px bold, tabular, `--text-3`; metal colour for 1–3.
2. **Thumbnail** — 52–56px square, radius 10, the photo (cropped). No photo →
   `--surface-2` square with the **type mark centred in `--accent-bright`**;
   Other / Not set leave the square **empty**.
3. **Middle block** (flex, truncating):
   - line 1: **name** (16/600)
   - line 2: **strain tag · country flag emoji · type mark** (mark muted,
     `--text-2`, ~14px). **Private** products add a small lock here (own
     leaderboard only)
   - line 3: **metadata line** — `£2.86/g · Source`, 13px `--text-2`, **spans the
     full width of the middle block**, single line, **ellipsis on the Source**.
     Fallbacks per rebuild brief §10.1. Omitted entirely when empty (row gets
     shorter — fine)
4. **Score block** (right, fixed width so scores align down the list):
   - **value** 22/700 tabular
   - **label** caption beneath — `OVERALL`, or the Rank by category (`TASTE`,
     `PRICE`, `VFM`)
   - **Unrated:** an en dash in `--text-3` with label `UNRATED`

Rows keep a **consistent height** whatever the metadata length — truncate, never
wrap. Pressed state: `--surface-2` and a very slight scale (0.99).

*Lesson from the old build:* forcing the metadata line not to wrap *while it
shared width with the tag* crushed it and truncated the **price**. The metadata
line must get the **full width** and only the Source may be truncated.

### 6.2 Log row

Denser than the Leaderboard. Thumbnail 40px; **name**; on product rows a **type
mark in `--accent-bright` at 15px** (the "has a full profile" marker); loose
entries show **no marker**. Chevron optional. Thumbnail placeholder rules as §6.1,
applying to both row kinds.

**Group headers:** flag + country name + row count, 13/600 uppercase-ish,
`--text-2`. **Sticky** while scrolling their group (designer's choice, but
recommended).

### 6.3 Stats tiles

Three equal tiles in a row (two on a followed person's view), `--surface-1`,
radius 12. Value 20/700 tabular on top, label caption below. Leaderboard row is
**hidden** when empty; the Log's shows `0 / 0 / 0g` (behaviour per rebuild brief).

### 6.4 Control row — filter and Rank by

**Decided: the controls live in their own row directly under the header**, not
in the header. The header holds only the title (and back / context actions).

- Two **pills**, 36–40px tall, radius 999, `--surface-1` + hairline:
  **Rank by** on the left, **Type** filter on the right.
- Each pill is a styled wrapper over a **real, transparent native `<select>`**
  (font-size ≥ 16px on the select itself) so iOS shows its native picker.
- Closed pill reads e.g. **`Rank: Overall ▾`** and **`Type: All ▾`**. With the
  extra room, **full labels are the default** — abbreviate (`Conc.`, `Consis.`,
  `VFM`) only if a label is **measured** not to fit at 375px. Measure every
  filter × rank combination; don't assume.
- **Active state** (anything other than Overall / All): `--accent-soft`
  background, `--accent-bright` text and border. This is what explains a
  partial list — it must be obvious.
- Dropdown options: the filter list carries emoji — **🌿 Flower · 💧 Concentrate
  · 🍪 Edibles · 💨 Pre roll**, none on All. **Never 🚬.** The closed pill has no
  icon.
- **Log:** only the Type pill appears (Rank by is Leaderboard-only). Keep the
  Type pill in the same position on both screens.
- **Sticky** under the header while the list scrolls (recommended), so the active
  state is always visible.

### 6.5 Buttons

| Kind | Look | Use |
|---|---|---|
| Primary | Solid `--accent`, `--on-accent` text, radius 12, 48px tall | Save, Sign in, Approve |
| Secondary | `--surface-2` + hairline, `--text` | Cancel, Search Leafly, Export |
| Tertiary / text | No fill, `--accent-bright` text | "Use a recovery code", minor links |
| Destructive | `--danger` text on `--surface-2`; solid `--danger` only inside the final confirmation | Archive, Delete, Block, Remove follower |

One primary button per screen area.

### 6.6 Rating input

One row per category, in the type's order:

- **Label** left (16/500), **value** right (tabular, 17/600; `—` in `--text-3`
  when unrated), and a small **✕ clear** button when rated.
- A full-width **slider** beneath, 0.1 steps, track `--surface-3`, fill and thumb
  `--accent`. Unrated → empty track, thumb at the start in `--text-3`.
- Tapping the value makes it an **editable number field** (`inputmode="decimal"`,
  16px+). Slider and field drive each other.
- Under the set: **"Rated N of N"** caption and the per-type explanation of how
  Overall is worked out (text per type — see rebuild brief §8).

### 6.7 Hit time (edibles only)

Sits with Taste and High, but **must not look like a third score**: a
**segmented / stepped slider** of 13 stops (0 → 3h), ticks visible, value shown as
a **duration** (`1h 15m`, `Not set`) in `--text-2`, no ✕-style score chrome, no
1–10 anywhere near it.

### 6.8 Profile rating bars

Read-only horizontal bars, one per category in the set: label, bar (fill
proportional to value / 10, `--accent`; `--surface-2` track), value right. Bars
feeding Overall at full strength; **High (where it doesn't count) rendered in
`--text-2`/muted fill** with a small "doesn't count" hint, so it's visibly
different. For edibles, both Taste and High feed Overall — show the weighting
(⅓ / ⅔) as a caption.

### 6.9 Photos

- **Grid:** 3 columns, square cells, 4px gaps, radius 8.
- **Crop button** (⛶) overlaid bottom-right of each cell in edit contexts and on
  the profile: a 32px circle, `--bar` glass, white icon.
- **Viewer:** full-bleed black, covers header and nav (no leaf). Close top-left,
  **Crop this photo** as a secondary button at the bottom. Swipe between photos
  (designer's choice).
- **Cropper:** full-bleed black. Top bar: Cancel · **Free | Square** segmented ·
  Apply (primary). Crop box with corner handles, dimmed surround, drag to move.
  **Reset to original** as a text button.

### 6.10 Empty states

Centred block inside the list area: outlined leaf mark (48px, `--text-3`),
title (17/600), one line of `--text-2`, one button. Three distinct cards on the
Leaderboard (empty / filtered-empty / rank-empty) — copy per rebuild brief
§10.1; the filtered and rank cards **name** the filter or ranking and offer one
tap back.

### 6.11 Forms

- Grouped sections on `--surface-1` cards, each with a caption heading.
- Inputs: `--surface-2`, hairline-strong border, radius 12, 48px tall, 16px text.
  Focus: `--accent` border + 3px `--accent-soft` ring.
- Selects: native, same styling, chevron on the right.
- "Other" picklists reveal their free-text field directly beneath with a quick
  expand.
- Auto-capitalisation happens on blur — no visual flourish needed.

### 6.12 Offline / error

Needs a connection (rebuild brief §3). When offline: a slim `--warning` banner
under the header — "You're offline — changes can't be saved" — and disabled Save
buttons. Errors on save show inline near the button, never a browser alert.

---

## 7. Type icons

Flat, solid, single-colour silhouettes, `fill="currentColor"`, **24×24
viewBox**, no strokes, no gradients. Exact paths in **Appendix A** — reuse them.

| Type | Mark | Optical scale |
|---|---|---|
| Flower | five-leaflet leaf | 1.00 |
| Concentrate | rosin drip (dabber + falling bead) | 1.06 |
| Edibles | bitten cookie with a leaf cut-out + crumbs | 0.92 |
| Pre roll | joint with a paper band and rising smoke | 1.08 |
| Other / Not set | **no mark** | — |

**Placements and colour**

| Placement | Colour | Size |
|---|---|---|
| Log row marker | `--accent-bright` | 15px |
| Leaderboard row cluster (beside tag + flag) | `--text-2` (muted) | ~14–16px |
| Thumbnail placeholder (no photo) | `--accent-bright` | ~50% of the thumbnail |
| Filter dropdown | **emoji, not these marks** (native `<option>` holds text only) | — |

Every mark carries its type's name as its accessible label.

> **`fill-rule="evenodd"` (and matching `clip-rule`) is load-bearing** on the
> first path of the **cookie** and the **joint**. It cuts the leaf and bite out
> of the cookie, and the paper band out of the joint. Drop it and they render as
> a blob and a plain bar. The second path of each (crumbs, smoke) stays
> **nonzero**. **Look at every mark rendered after inlining it** — this failure
> has no error and was only ever caught by eye.

**Accepted:** a flower with no photo shows the leaf twice in one row (thumbnail
+ cluster). Not a bug — don't remove either.

---

## 8. Navigation and header

### Bottom navigation — designer's choice

Constraints:

- Must reach **Leaderboard, Log, People (new), More**. 3 or 4 tabs; propose which
  and why. If People lives inside More, the pending-requests count must still be
  visible from the tab bar.
- **Pending follow requests show as a badge** (count, `--accent` dot/pill).
- Icon + short label per tab; active tab `--accent-bright`, inactive `--text-2`.
- Glass `--bar` treatment, with `--bar-solid` painted beneath and through the
  home-indicator safe area (§11).
- The active tab is the **only** indicator of which main screen you're on — the
  header title is the same on all of them.

### Header

- **Main screens:** centred **leaf mark + "Green Tracker"**. Identical on every
  tab.
- **Detail screens** (product profile, log entry editor): **back** on the left,
  **leaf + record name** centred (truncates), optional context action on the
  right (e.g. Edit).
- **Archive:** back · leaf + "Archive".
- **Someone else's leaderboard or profile:** back · **`@username`** (their
  leaderboard) or **`@username` / product name** (their profile). **Decided —
  this is the signal that you're viewing someone else's tracker.** No banner, no
  alternative accent colour. Combined with the absence of any edit / add
  affordance, that's enough.
- Left and right header slots are **equal width** so the title stays optically
  centred; hidden contents keep their slot (`visibility: hidden`, not removal).
- **Photo viewer and cropper cover the header completely.**

### Adding

A way to **add a product** (Leaderboard) and **add a log entry** (Log) —
recommended as a **floating + button** bottom-right above the tab bar, within
thumb reach. Designer's choice; **never shown** on someone else's view.

---

## 9. Screens

Layouts are guidance; propose refinements with mockups.

### Leaderboard (yours)
Header → **control row** (Rank · Type) → **stats tiles** → **rows** → floating +.

### Log
Header → control row (Type only) → stats tiles → **country groups** with sticky
headers → rows → descriptive footnote at the very bottom (hidden when empty) →
floating +.

### Product profile (yours)
Scrolling page, in this order:
1. **Hero:** first photo large (or type-mark placeholder), name, **Overall huge**,
   strain tag · product type (· concentrate type) · flag, headline price, and a
   lock if private.
2. **Ratings** — bars (§6.8), "Rated N of N", hit time for edibles.
3. **Photos** grid.
4. **Price history** — newest first; each entry: date, amount, total paid,
   derived per-unit price (nothing shown when it can't be derived), supplier;
   latest marked **Latest**. **Value for money** shown here as a labelled figure.
5. **Notes.**
6. **Leafly** — one secondary button, **View on Leafly** or **Search Leafly**,
   with an external-link glyph.
7. **Details** — key/value list: strain type, product type, concentrate type,
   country, Source, date tried.
8. **Actions** — Edit (primary), **Private** switch, Archive (destructive).

### Product editor / log entry editor
Grouped form (§6.11): Basics · Classification · Origin · Ratings (products) ·
Purchases (products; "Add purchase" row, each purchase a compact card) · Photos ·
Notes · Leafly · Private. **Save** as a full-width primary button at the end and
reachable without scrolling back (e.g. sticky bottom bar) — designer's choice;
Cancel/back in the header. Log editor: **Save to log** primary, **Add to
leaderboard** secondary beneath (saved entries only), Delete destructive at the
bottom.

### Archive
Same row component as the Leaderboard; **Un-archive** per row (swipe or button —
designer's choice).

### More
Grouped list (iOS settings style): Account (username, passkeys, recovery codes,
sign out, sign out everywhere) · Data (Export, Restore) · Archive · About
(**version string**) · Danger zone (Delete account, `--danger`).

### New: Sign in
Full screen, centred: large leaf mark, "Green Tracker", **Sign in with passkey**
(primary), **Create account** (secondary), **Use a recovery code** (text).

### New: Create account
Step 1 — choose **username** with a live availability indicator (✓ green / ✕
danger). Step 2 — **create passkey** (explain Face ID in one line). Step 3 —
**recovery codes**: shown once, monospaced in a `--surface-2` block, **Copy**
and **Save** buttons, and a required "I've saved these" check before
continuing.

### New: People
- **Search** field at the top (the only search in the app) — username.
- Result rows: **monogram avatar** (first letter, `--surface-3` circle — there are
  no profile photos), `@username`, and a button reflecting state: **Follow**
  (primary, small) · **Requested** (outlined, tap to cancel) · **Following**
  (outlined).
- A non-follower tapping a result sees a near-empty page: avatar, `@username`,
  Follow button, and a one-line "Follow to see their leaderboard". Nothing else.
- Sections or segmented control: **Requests** (badge) · **Followers** ·
  **Following**. Blocked lives in More → Account.
- **Request row:** avatar, username, **Approve** (primary) and **Decline**
  (secondary) side by side.
- Followers: **Remove** · Following: **Unfollow** · any person: **Block** — via
  a row menu or swipe (designer's choice), each with a confirmation sheet.

### New: Someone else's leaderboard / profile
Same components as your own, **read-only**:
- Header `@username` with back (§8).
- Control row with Rank (no Price / VFM options) and Type.
- **Two** stats tiles: PRODUCTS, AVERAGE.
- Rows: **no metadata line** (no price or Source). Lines 1–2 and the score only.
- Their product profile: hero (without price), ratings, photos, details limited
  to strain type / product type / concentrate type / country. No price history,
  VFM, notes, Leafly or actions.
- **No floating +, no Edit, no crop buttons, no private locks.**

---

## 10. Motion

- Quick and quiet: **150–220ms, ease-out**. Screen entry: short fade + small
  rise (≤ 8px). Press: slight scale on rows and buttons.
- No bouncing, no parallax, no ambient animated backgrounds (the old glowing orbs
  are retired with the full glass look).
- **Respect `prefers-reduced-motion`** — remove movement, keep fades.
- **Scroll restoration** (rebuild brief §10.1) must measure positions with layout
  metrics after the entry animation, not bounding rects mid-animation — a rise
  animation once put restored rows 10px out.

---

## 11. iPhone rules — do not undo

These fixed a bug (the bottom nav floating above a black band) that appeared
**three times** in the old build. They are load-bearing.

1. **No `overflow` (including `overflow-x`) on `body`.** It makes iOS resolve
   `position: fixed` against the document instead of the viewport, so the nav
   floats on short pages.
2. **`body` and the main container carry `min-height: 100dvh`.**
3. **Backgrounds live on a fixed full-viewport layer**, never `background-
   attachment: fixed` on `body`. **Each bar carries its own opaque base**
   (`--bar-solid`) under its glass, painted through the safe areas — never rely
   on what's behind it.

Also:
- `viewport-fit=cover`, and pad bars with `env(safe-area-inset-top/bottom)`.
- Test **installed to the Home Screen (standalone mode)**, not just in Safari —
  they differ.
- Inputs and selects ≥ 16px.
- External links (Leafly) open outside the app.
- Status bar: `black-translucent` so the header's glass reaches the top edge.
- Theme colour / manifest background: `--bg`.

---

## 12. Accessibility

- Text contrast **≥ 4.5:1** for anything the user needs to read (`--text` and
  `--text-2` on every surface; check `--text-2` on `--surface-2`). `--text-3` is
  for decoration and disabled states only.
- Don't rely on colour alone: active pills also change text; podium ranks show
  the number; strain tags spell the word.
- Every icon-only button and type mark has an accessible name.
- Visible focus ring (`--accent` + `--accent-soft`) for keyboard use on desktop.
- Tap targets ≥ 44px. Dynamic Type not required, but layouts shouldn't break at
  ~120% text size.

---

## 13. Design decisions already made — do not reopen

- Dark only.
- Glass on header and nav **only**.
- Leaf mark, podium metals, strain-tag colours and the four type silhouettes are
  kept.
- Type icons are **flat solid silhouettes**, small and simple — not glassy, not
  detailed.
- **💨 for pre roll, never 🚬.**
- Other / Not set get **no icon** and an **empty** thumbnail square.
- The leaf may appear twice on a flower row without a photo.
- Filter and Rank by sit in a **row under the header**, as native selects.
- Someone else's tracker is signalled by **`@username` in the header**.
- Header title is identical on every main tab; the tab bar alone shows where you
  are.
- Long titles and Sources **truncate**; type never shrinks, rows never grow.

---

## Appendix A — Mark geometry

All paths use a **24×24 viewBox**, `fill="currentColor"`. Apply the optical
scale as `transform="translate(12 12) scale(S) translate(-12 -12)"` on a
wrapping `<g>`.

### Flower — five-leaflet leaf (scale 1)

```
M12 18.35C8.95 19.21 5.61 18.16 4.12 16.96C5.93 16.35 9.42 16.51 12 18.35Z
M12 18.35C14.58 16.51 18.07 16.35 19.88 16.96C18.39 18.16 15.05 19.21 12 18.35Z
M12 18.35C7.69 16.49 4.83 12.17 4.22 9.4C6.87 10.39 10.76 13.82 12 18.35Z
M12 18.35C13.24 13.82 17.13 10.39 19.78 9.4C19.17 12.17 16.31 16.49 12 18.35Z
M12 18.35C9.46 13.06 10.31 6.64 12 3.53C13.69 6.64 14.54 13.06 12 18.35Z
M11.45 18.35H12.55V21.46H11.45Z
```

### Concentrate — rosin drip (scale 1.06), three paths

```
M11.87 8.08L20.89 3.47A1 1 0 0 0 19.91 1.73L11.33 7.12A0.55 0.55 0 0 0 11.87 8.08Z
```
```
M8.75 9.5C8.75 7.65 9.95 6.5 11.4 6.5C12.95 6.5 14.1 7.7 14.1 9.5C14.1 11.45 12.6 12.3 12.25 14.1C12.05 15.25 11.98 15.95 11.68 16.75C11.48 17.28 10.98 17.28 10.8 16.75C10.52 15.9 10.42 15.1 10.3 14.1C10.03 12.2 8.75 11.4 8.75 9.5Z
```
```
M11.3 17.24C12.61 18.81 13.05 19.86 13.05 20.3A1.75 1.75 0 1 1 9.55 20.3C9.55 19.86 9.99 18.81 11.3 17.24Z
```

### Edibles — bitten leaf cookie (scale 0.92)

**Path 1 — `fill-rule="evenodd" clip-rule="evenodd"` (required):**
```
M21.1 12L21.08 12.4L21.04 12.79L20.97 13.18L20.88 13.57L20.78 13.95L20.66 14.32L20.51 14.68L20.36 15.04L20.18 15.39L20 15.73L19.8 16.06L19.59 16.38L19.36 16.69L19.13 16.99L18.89 17.29L18.64 17.57L18.38 17.85L18.12 18.12L17.84 18.38L17.57 18.63L17.28 18.88L16.98 19.12L16.68 19.35L16.37 19.56L16.05 19.77L15.72 19.97L15.38 20.15L15.03 20.32L14.67 20.47L14.31 20.61L13.93 20.72L13.56 20.82L13.17 20.9L12.78 20.96L12.39 20.99L12 21L11.61 20.99L11.22 20.95L10.83 20.89L10.45 20.81L10.07 20.71L9.7 20.59L9.34 20.45L8.98 20.29L8.64 20.12L8.3 19.94L7.97 19.74L7.65 19.53L7.34 19.31L7.04 19.08L6.75 18.84L6.47 18.59L6.19 18.34L5.92 18.08L5.65 17.81L5.4 17.54L5.14 17.26L4.9 16.97L4.66 16.67L4.44 16.37L4.22 16.05L4.02 15.72L3.83 15.39L3.65 15.04L3.49 14.68L3.34 14.32L3.22 13.95L3.11 13.57L3.02 13.18L2.96 12.79L2.92 12.4L2.9 12L2.91 11.6L2.94 11.21L2.99 10.81L3.06 10.42L3.16 10.04L3.27 9.66L3.4 9.29L3.55 8.92L3.72 8.57L3.9 8.22L4.1 7.89L4.31 7.56L4.53 7.24L4.77 6.93L5.01 6.64L5.27 6.35L5.54 6.08L5.81 5.81L6.1 5.56L6.39 5.32L6.7 5.09L7.01 4.88L7.34 4.68L7.67 4.5L8.01 4.33L8.35 4.17L8.7 4.03L9.05 3.9L9.41 3.79L9.77 3.69L10.14 3.61L10.51 3.54L10.88 3.48L11.25 3.44L11.63 3.41L12 3.4L12.38 3.4L12.75 3.41L13.13 3.44L13.5 3.47L13.88 3.53L14.25 3.59L14.63 3.67L14.99 3.77L15.36 3.88L15.72 4.01L15.77 4.76L15.6 5.76L15.64 6.29L15.72 6.69L15.83 7.01L15.95 7.29L16.09 7.53L16.24 7.76L16.41 7.96L16.59 8.15L16.78 8.33L17 8.5L17.25 8.66L17.53 8.8L17.88 8.94L18.3 9.06L18.32 9.38L18.36 9.68L18.44 9.97L18.55 10.24L18.7 10.51L18.89 10.79L19.14 11.06L19.5 11.34L20.1 11.65Z
M11.3 15.82C9.62 16.29 7.79 15.72 6.97 15.06C7.96 14.72 9.88 14.81 11.3 15.82Z
M11.3 15.82C12.72 14.81 14.64 14.72 15.63 15.06C14.81 15.72 12.98 16.29 11.3 15.82Z
M11.3 15.82C8.93 14.8 7.36 12.42 7.02 10.9C8.48 11.44 10.62 13.33 11.3 15.82Z
M11.3 15.82C11.98 13.33 14.12 11.44 15.58 10.9C15.24 12.42 13.67 14.8 11.3 15.82Z
M11.3 15.82C9.9 12.91 10.37 9.38 11.3 7.67C12.23 9.38 12.7 12.91 11.3 15.82Z
M11 15.82L11.6 15.82L11.6 17.53L11 17.53Z
```

**Path 2 — crumbs, nonzero:**
```
M19.5 3A0.8 0.8 0 1 1 21.1 3A0.8 0.8 0 1 1 19.5 3Z
M16.98 2.3A0.52 0.52 0 1 1 18.02 2.3A0.52 0.52 0 1 1 16.98 2.3Z
M22.1 12.9A0.5 0.5 0 1 1 23.1 12.9A0.5 0.5 0 1 1 22.1 12.9Z
```

### Pre roll — joint with smoke (scale 1.08)

**Path 1 — `fill-rule="evenodd" clip-rule="evenodd"` (required):**
```
M5.62 21.02L16.49 9.51L13.91 7.29L4.18 19.78A0.95 0.95 0 0 0 5.62 21.02Z
M5.4 17.97L7.22 19.53L7.69 18.99L5.87 17.43Z
```

**Path 2 — smoke, nonzero:**
```
M16.17 7.56L19.14 6.19L17.94 3.78L19.98 2.76L19.62 2.04L16.86 3.42L18.06 5.81L15.83 6.84Z
M13.86 6.42L15.45 4.6L13.86 2.78L13.34 3.22L14.55 4.6L13.34 5.98Z
```

### Header leaf — glass variant (34×34 viewBox)

```svg
<svg viewBox="0 0 34 34" fill="none">
  <defs>
    <linearGradient id="leafGlass" x1="17" y1="4" x2="17" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8df3b6" stop-opacity="0.88"/>
      <stop offset="0.5" stop-color="#58e08c" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#2fb86a" stop-opacity="0.34"/>
    </linearGradient>
    <linearGradient id="leafEdge" x1="17" y1="4" x2="17" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#b6ffd4" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#2fb86a" stop-opacity="0.75"/>
    </linearGradient>
    <path id="gtLeaflet" d="M0 0 C-3.6 -7.5 -2.4 -16.6 0 -21 C2.4 -16.6 3.6 -7.5 0 0 Z"/>
  </defs>
  <g transform="translate(17 26)" fill="url(#leafGlass)" stroke="url(#leafEdge)"
     stroke-width="1" stroke-linejoin="round">
    <use href="#gtLeaflet" transform="rotate(-80) scale(0.54)"/>
    <use href="#gtLeaflet" transform="rotate(80) scale(0.54)"/>
    <use href="#gtLeaflet" transform="rotate(-41) scale(0.8)"/>
    <use href="#gtLeaflet" transform="rotate(41) scale(0.8)"/>
    <use href="#gtLeaflet"/>
    <path d="M0 0 L0 4.4" stroke="url(#leafEdge)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
</svg>
```

If the header mark is repeated on a page, give gradient/leaflet ids unique
names per instance (or inline once) — duplicate SVG ids break rendering.
