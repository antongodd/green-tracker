# Green Tracker — Rebuild Brief

> **Who this is for:** a Claude conversation that will build Green Tracker from
> scratch. It describes **what the app is, what it must do, and why** — the
> product, its rules and its settled decisions. It deliberately contains **no
> front-end design**: no colours, fonts, layout, icon artwork or animation. Those
> are for the builder to propose and the owner to approve.
>
> **Owner:** Anton, UK-based. This brief replaces an earlier single-user,
> offline, on-device version of the app (v1.26.0). Where this brief and anything
> you know about that version disagree, **this brief wins**.

---

## 0. Read this first — how to work on this project

These are how the owner works. Follow them.

1. **Ask before adding scope.** §14 and §15 list what is in and out. Anything
   not described here is a proposal, not a task — raise it, don't quietly build it.
2. **Flag consequences before building.** If a decision has a knock-on effect
   (a number that will change, data that will be hidden, a trade-off), say so
   first so the owner can choose. The owner often picks the trade-off knowingly;
   he wants to be told, not protected.
3. **Settled decisions stay settled.** Items marked **Do not reopen** were each
   put to the owner and decided. Don't "fix" them, "tidy" them or restore them
   for consistency. If you think one is genuinely wrong, raise it — don't change it.
4. **Keep a living spec.** Maintain a spec document in the repo that records
   what was built, every decision and a changelog. Update it with every change.
   It is the project's single source of truth.
5. **Test behaviour, not just code.** §17 lists acceptance checks. Automate them.
   Several past bugs were only caught by looking at the real screen — check
   visually too.
6. **Show the running version.** A version string on the About screen, so the
   owner can tell which build his phone is running before reporting a bug.

---

## 1. What the app is

A web app for tracking and rating the cannabis products a person has tried.

- Each product gets a **profile**: ratings, purchase history, photos, notes.
- Products are ranked against each other on a **Leaderboard**.
- The **Log** is the complete record of everything tried; the Leaderboard is the
  scored subset of it.
- People have **accounts**. Everyone's tracker is private, but people can
  **follow** each other (Instagram-style, approval required) to view a limited,
  read-only version of each other's Leaderboard.

**Conventions:** UK. Currency **GBP (£)**. Weights in **grams (g)**, except
edibles (see §9).

**Terminology:** the central record is a **product** — it may be flower, a
concentrate, an edible or a pre roll. Use "product" in both the interface and
the code. The one place the word *strain* remains is the **Strain type** field
(indica / sativa / hybrid), which genuinely is about strain.

---

## 2. Guiding principles

These sit behind nearly every rule in this brief.

1. **Derived figures are calculated on read, never stored.** Overall, the
   per-unit price, value for money and every stats tile are computed whenever
   they're shown, so they can never drift out of sync with the data they come
   from. Only what the user typed is stored.
2. **Never destroy the user's data by accident.** Products are archived, not
   deleted. Ratings hidden by a type change are kept. A hidden sub-type is kept.
   A mistap must never wipe work with no way back.
3. **Never guess at data the user didn't enter.** No automatic unit conversion,
   no generated URLs, no invented purchases, no backfilled values.
4. **Deliberate scope.** Features are explicitly bounded. The owner declines
   scope creep and makes conscious trade-offs.
5. **One definition per concept.** Things like the product type list and the
   rating sets are defined once and everything else derives from them — never
   parallel hand-maintained lists that can drift apart.
6. **Privacy is enforced on the server.** Anything a follower may not see is
   never sent to their device — hiding it in the interface is not enough.

---

## 3. Platform and hosting

| Decision | Choice |
|---|---|
| App type | **Web app**, installable to the iPhone Home Screen from Safari (PWA). Must also work in a normal desktop/mobile browser |
| Primary device | iPhone (Safari, standalone mode) |
| Hosting | **Cloudflare** — Workers (serving the app plus the server code), **D1** for the database, **R2** for photos |
| Cost | Must run within Cloudflare's free tier at small scale |
| Connectivity | **Online is required.** Offline editing and sync are **not** needed. Show a clear, friendly state when there's no connection rather than failing silently |
| Code approach | **The builder's choice** — framework or not, language, structure — provided every rule in this brief holds. Keep dependencies modest and the deploy simple; explain the choice to the owner |

**Why a web app rather than an App Store app:** no Apple Developer fee, no
app-store review, no re-install cycles. Accepted trade-off: it lives as a Home
Screen icon.

**Outbound links only.** The app talks to its own server and nothing else. The
one external site involved (Leafly, §12) is only ever opened as a link in the
browser — never fetched.

**If using a service worker** for installability, make sure a deploy can never
leave phones stuck on a stale cached build (version the cache, and show the
version on the About screen).

---

## 4. Accounts and sign-in

| | |
|---|---|
| Who can sign up | **Anyone with the link.** Open sign-up |
| Identity | A **username** — unique, case-insensitive for uniqueness, shown to others. Choose sensible rules (length, allowed characters) |
| Sign-in method | **Passkeys** (Face ID / Touch ID / device passkey via WebAuthn). **No passwords** |
| Email | **Not required.** Don't collect more than needed (see "Sensitive data" below) |

**Requirements:**

- **Account recovery.** Passkeys normally sync via iCloud Keychain, but a lost
  device must not mean a lost account. Provide a fallback — e.g. **one-time
  recovery codes** shown once at sign-up — and allow **more than one passkey**
  per account (e.g. phone and laptop). Propose the exact approach to the owner.
- **Sessions** last a reasonable time so the owner isn't signing in constantly
  on his own phone. Secure, HTTP-only cookies.
- **Sign out**, and **sign out everywhere**.
- **Delete account**: removes everything — products, purchases, ratings, log
  entries, **every photo in R2**, follows in both directions, pending requests.
  Behind a clear confirmation. Irreversible.
- **Export my data** (§13) is available to every user.
- **Rate-limit** sign-up and sign-in to discourage abuse of an open sign-up.

**Sensitive data.** This app stores a record of cannabis use tied to an
account. Treat it accordingly: collect the minimum, never expose one user's data
to another except through §5's rules, serve photos only through authorised
requests (never public bucket URLs), and don't log personal content.

---

## 5. Following (the social layer)

Works like a **private Instagram account**: following is **one-way** and
**needs approval**. These are **follow requests, not friend requests** —
following someone does not make them follow you.

### The flow

1. A finds B by **username** (§5 "Finding people").
2. A taps **Follow** → a **follow request** is sent. A sees it as *Requested*
   and can **cancel** it.
3. B sees it in a **requests inbox** and can **Approve** or **Decline**.
   Declining is silent — A is not told, their button simply returns to Follow.
4. Once approved, **A follows B** and can view B's shared content (below).
   B does **not** automatically follow A; B can request to follow A separately.
5. A can **unfollow** at any time. B can **remove a follower** at any time.
6. **Block:** either person can block the other. Blocking removes any follow in
   **both directions**, cancels pending requests, and stops the blocked person
   finding or requesting the blocker again. The blocked person is not notified.
   Blocks can be undone from a blocked list.

Each user can see their **Followers**, **Following**, **pending requests**
(incoming and outgoing) and **Blocked** lists.

### Finding people

- Search by **username**. This is the **only** search in the app — the
  "no search" rule for a user's own lists (§10.1) still holds.
- A non-follower who finds someone sees **their username and a Follow button,
  and nothing else** — no counts, no photos, no products.

### What a follower sees

**Only a read-only view of the followed person's Leaderboard and product
profiles, limited to identity, ratings and photos.**

| Visible to followers | **Never** visible to followers |
|---|---|
| Product name | Prices, totals paid, purchase history, amounts, suppliers |
| Product type (and concentrate type) | Value for money |
| Strain type | Notes |
| Country (and flag) | The **Log** — entirely, including loose entries |
| Overall and every rating in the product's set | Source/Brand *(see §16 — assumption)* |
| Hit time (edibles) | Date tried *(see §16 — assumption)* |
| Photos (cropped versions only) | Leafly link |
| | **Archived** products |
| | Products marked **private** |
| | The TOTAL (weight) stats tile |

On a followed person's Leaderboard:

- Ranking, tie-breaks, the product-type filter and Rank by (§10.1) work as they
  do on your own, **except** Rank by never offers Price or Value for money.
- Stats tiles: **PRODUCTS** and **AVERAGE** only, computed over what the
  follower can see. No TOTAL.
- Row metadata carries no price. (What replaces it is a design decision.)
- Everything is **read-only**: no edit, archive, crop, promote or any other
  action.

### Private products

- Every product has a **Private** switch, **off by default**.
- A private product is **invisible to followers in every way** — not listed,
  not counted in their PRODUCTS or AVERAGE tiles, its photos not fetchable.
- It behaves normally for its owner.

### Enforcement — non-negotiable

- **Every rule above is enforced by the server.** Hidden fields must never be
  included in a response to a follower — not "sent but not displayed".
- Photos are served via a route that checks the requester is the owner or an
  approved follower **and** that the product is neither private nor archived.
- A follower's access ends the moment they unfollow, are removed or blocked.

### Out of scope for the social layer

Comments, reactions, likes, comparing ratings, combined or friends' leaderboards,
activity feeds, messaging, notifications beyond the in-app requests inbox,
public profiles, reporting/moderation tools. **Do not build toward these.**

---

## 6. Data model

Described conceptually. The builder designs the actual schema.

### Account
Username, passkey credentials, recovery method, created date. Per-user view
settings (§10.1) may live on the device instead.

### Follow
Follower, followed, status (**pending** / **approved**), created date. Plus a
**Block** relation.

### Product
| Field | Type | Notes |
|---|---|---|
| Name | Text | Required. **Auto-capitalised** (§11) |
| Strain type | indica / sativa / hybrid | Optional. Shown for **every** product type |
| Product type | Picklist + free text | §7. **Defaults to Flower** |
| Concentrate type | Picklist + free text | Only used when product type is Concentrate. **Defaults to Hash** |
| Country | Picklist + free text | ~85 countries plus **Other** (free text). An ISO code drives a flag emoji |
| Source | Text | Label **Source**, placeholder `Source/Brand`. Where the product is from, or its brand. **Auto-capitalised** |
| Date tried | Date | Optional |
| Leafly link | Text | Optional, never validated (§12) |
| Ratings | Per category, 1–10 | §8 |
| Hit time | Minutes | **Edibles only.** 0–180 in 15-minute steps. **Not a rating** — stored separately from ratings |
| Purchases | List | §9 |
| Photos | Many | §11 |
| Notes | Long text | |
| Archived | Yes/No | §10.4 |
| Private | Yes/No | §5. Off by default |

**Products have no single "amount" field and must never gain one.** Weight
lives on each purchase.

### Purchase (belongs to a product)
| Field | Notes |
|---|---|
| Date | |
| Amount | Grams — or **mg of THC** for edibles (§9). Optional |
| Total paid | Plain **£**, for every product type |
| Supplier | Optional free text, per purchase. **Auto-capitalised** |

**The per-unit price is not a field.** It is derived (§9).

### Photo
Belongs to a product **or** a log entry. Stores the **cropped image** and the
**uncropped original**, plus the crop settings. Files in R2.

### Log entry (loose entry in the Log)
| Field | Notes |
|---|---|
| Name | **Auto-capitalised** |
| Country | Same control as a product |
| Product type | Same options and defaults as a product |
| Concentrate type | Ditto |
| Amount | Optional. Grams, or mg of THC if classified Edibles. A **single hand-maintained number**, not a purchase history |
| Photo | One |

No ratings, prices, dates or notes on a log entry.

---

## 7. Product types

| Type | Sub-types | Units | Notes |
|---|---|---|---|
| **Flower** | — | grams | **Default** for any new product or log entry |
| **Concentrate** | Hash *(default)*, Rosin, Live Rosin, Wax, Live Resin, Diamonds, THC distillate, Other (free text), Not set | grams | The **only** type with sub-types |
| **Edibles** | — | **mg of THC** | |
| **Pre roll** | — | grams | One flat type. Exact label: **"Pre roll"** |
| **Other** | free text | grams | |
| **Not set** | — | grams | An explicit choice |

Order as listed. **New types are appended, never inserted**, so positions the
owner has learned don't shift.

**One definition.** Declare each type once — key, display name, whether it has
sub-types, its rating set (§8), its units (§9), its icon — and derive
everything else from that: every dropdown, the filter options, the icons, the
units, the denominators, the TOTAL tiles. Adding a type should be a single,
obvious declaration, and tests should fail if any part is missing. *(The
previous build had a type spread across six parallel lists; forgetting one
produced wrong output with no error, and shipped.)*

**"Other" pattern:** choosing Other reveals a free-text box; Other with nothing
typed means not set. Country, product type and concentrate type all use this
same pattern — **don't invent a second one**.

**Switching a product away from Concentrate keeps its concentrate type** —
ignored while hidden, restored on switching back. **Do not clear it.**

**Icons:** each of Flower, Concentrate, Edibles and Pre roll has its own
recognisable icon; **Other and Not set have none**. Where and how they appear is
a design matter — but the owner has specific views on icons, so propose them
and get approval.

---

## 8. Ratings and Overall

### Common to every type

- Scale **1–10**, **any decimal** allowed (7.3), displayed to **one decimal
  place**.
- Input must allow precise **0.1** values, be quick to use on a phone, and let a
  rating be **cleared back to unrated**. (The previous build paired a 0.1-step
  slider with an editable number box — either could drive the value.)
- **Partial ratings are allowed.** It must be visible which categories are still
  blank.
- Overall recalculates immediately whenever a contributing rating changes.

### The rating sets — per product type

| Type | Rated categories | Feeds Overall | Overall = |
|---|---|---|---|
| **Flower** (also Other, Not set) | Look, Smell, Taste, Burn, High | Look, Smell, Taste, Burn | straight mean |
| **Concentrate** | Look, **Consistency**, Smell, Taste, Burn, High | Look, Consistency, Smell, Taste, Burn | straight mean |
| **Pre roll** | Smell, Taste, Burn, High | Smell, Taste, Burn | straight mean |
| **Edibles** | Taste, High | Taste **×⅓**, High **×⅔** | weighted mean |

Category order as listed. Consistency sits directly after Look.

**Worked example:** an edible with Taste 6 and High 9 → **8.0**.

Define the sets **once** (with weights) and drive everything from that one
definition: the editor, the profile, "Rated N of N", ranking, Rank by options,
value for money and the AVERAGE tiles. A single weighted mean serves every
type — with all weights 1 it is a straight mean.

### High — Do not reopen

- For flower, concentrates and pre rolls **High is rated, stored and displayed
  but does not feed Overall.** It varies with dose, tolerance and circumstance
  far more than the other categories, and made the headline score noisy.
- For **edibles only**, High is **two thirds** of Overall — the dose is known and
  the high is the point of the product.
- This type-specific inconsistency is the reason the sets are per type. **Don't
  generalise it either way.**

### Pre roll has no Look — Do not reopen

You can't see the contents of a pre roll, so rating its appearance is
meaningless. Don't add Look back "for consistency".

### Partial ratings

- Overall uses whichever **contributing** categories are rated. A blank is
  **absent, never zero**.
- For the weighted edible mean, **renormalise across what's present**: only High
  rated → Overall = High; only Taste → Overall = Taste.
- A product with **none of its contributing categories rated has no Overall**
  and sorts as unrated — e.g. a flower rated only on High. This looks like a
  score has vanished; it is correct.

### Hit time (edibles only)

- A duration, **0 to 3 hours in 15-minute steps**. Optional.
- **Not a rating**: never feeds Overall, never counts in "Rated N of N", never
  offered in Rank by. Present it as a duration, so it can't be mistaken for a
  third score next to Taste and High.

### "Rated N of N categories"

Shown on the profile. Denominator is **per type: Flower 5, Concentrate 6,
Edibles 2, Pre roll 4** — derived from the sets, not hard-coded. **High always
counts** (it describes profile completeness, not Overall's composition). Hit
time never counts.

### Changing a product's type — Do not reopen

Ratings that don't belong to the new type are **kept in storage, hidden, and
excluded from Overall. Never cleared.** Switch a fully rated flower to Edibles
and Look, Smell and Burn disappear from view; switch back and they return
intact. *(The type picker sits next to fields the user edits often; a mistap
must not destroy several ratings.)*

### Where High appears

High shows on the product's own profile only — **not** on Leaderboard rows, the
Log or any stats tile.

### Editor guidance text

If the editor explains how Overall is worked out, the text must be **per type**
— fixed text would be wrong for most types (e.g. telling an edible that High
doesn't count). *(This shipped wrong once.)*

---

## 9. Money, units and value

### Units depend on product type

| | **Edibles** | Everything else |
|---|---|---|
| Amount means | **mg of THC** | grams of product |
| Unit price | **£ per mg** | £ per gram |

**This is a different quantity, not a unit conversion.** A 10g brownie holding
100mg THC is recorded as **100**. Nothing is ever auto-converted — including
when a product's type is switched (the old figure stays, now labelled in the new
unit, until the user corrects it). **Edibles are the only exception; a new type
must not become a second one.**

**Labels follow the type everywhere** an amount or price is shown or entered.
An edible never shows `g`; anything else never shows `mg`.

Resolve units in **one place** from the product type; no scattered type checks.

### Purchases and the derived price

- The user enters **amount** and **total paid** — nobody buys by the gram-price.
- **Price per unit = total paid ÷ amount.** Derived on read, never stored.
- Displayed to **2 decimal places**, but **full precision is kept for all
  maths** (ranking, value for money). £10 for 7g shows £1.43/g; value for money
  must divide by 1.428571…, not 1.43.
- **Total paid is plain £** for every type.
- A purchase with **no amount**: kept, but shows **no per-unit figure at all**
  — not zero, not a dash. It contributes 0 to weight totals and can't drive
  value for money.
- A purchase with **no total paid** is discarded on save.
- The **headline price** is the **most recent purchase**'s per-unit price.
- The profile shows the full history, **newest first**, with the latest flagged.

**Supplier ≠ Source — Do not reopen.** Source is one value on the product
(origin/brand). Supplier is per purchase, because the same product can be bought
from different places. Don't merge, alias or cross-fill them.

### Value for money

- **Flower, concentrate, pre roll, other:** `Overall ÷ latest price per gram`
- **Edibles:** `Overall ÷ latest price per 100mg` (i.e. per-mg price × 100)
- Higher is better. A raw ratio, not a 1–10 score. Needs both an Overall and a
  priced latest purchase with an amount, otherwise not shown.
- Shown on the **product profile only** — not on Leaderboard rows. *(Accepted:
  value can't be compared while scrolling. Don't restore it to rows.)*
- **Accepted caveat — Do not reopen:** edible and non-edible VFM figures are
  **not comparable** with each other. Per-100mg keeps edible figures in a
  readable range. The owner chose this knowingly.
- **Known mismatch:** the profile shows edible price as £/mg while VFM divides
  by £/100mg. Recorded so nobody thinks the arithmetic is wrong.

---

## 10. Screens and behaviour

Behaviour only — layout and look are the builder's to propose.

**Structure:** three main areas — **Leaderboard**, **Log**, **More** — plus
detail screens (product profile, product editor, log entry editor, Archive).
New for accounts: sign-in/sign-up, account settings, and a **People** area
(search, requests, followers, following, blocked) and the **read-only view of
someone else's Leaderboard and profiles**. Where People lives is a design
proposal.

### 10.1 Leaderboard (your own)

Lists all your **non-archived** products.

**Default ranking:** Overall, highest first. **Ties → most recent date tried
first.** **Unrated products sort to the bottom.** The **top three** are
distinguished as gold, silver and bronze.

**Each row shows:** photo thumbnail (falls back to the product-type icon when
there's no photo; Other/Not set leave it empty), name, the ranked score with its
label, strain type, country flag, product-type icon, and a **metadata line**:

- **price · Source** — separator only between two present values
- price only / Source only when one is missing
- neither → falls back to **date tried**
- none of the three → no metadata line at all
- a long Source is truncated, never the price

**Stats tiles** (hidden entirely when you have no products):

| Tile | Shows |
|---|---|
| **PRODUCTS** | Count of non-archived products (matching the current filter/ranking) |
| **AVERAGE** | Mean Overall across **rated** visible products, 1dp. Unrated excluded |
| **TOTAL** | Lifetime **weight purchased**: sum of the amount on **every purchase** of every visible non-archived product |

TOTAL rules:
- The whole purchase history, not just the latest.
- **Archived products excluded** (archiving lowers the total — accepted).
- **Edibles excluded outright** (mg of THC can't be summed with grams). An
  edibles-only list reads `0g`. PRODUCTS and AVERAGE still count edibles. No mg
  tile.
- Blank amounts count 0, **silently** — no warning or asterisk.
- It counts what was **bought**, not what remains. **Don't build a
  "remaining"/"consumed" concept.**
- Formatting: 1dp, **round the final sum, not the parts**, drop a trailing
  `.0` (`15g`), **kg from 1000g** (`1.2kg`), `0g` when nothing.
- **Known limitation:** no screen shows a true lifetime total, because archived
  products drop out. Accepted.

**AVERAGE under "All"** mixes Overalls built differently per type, so it means
less; under a type filter it's coherent. Accepted, not a bug.

**Controls — exactly two, and no others. No search box.**

**1. Product-type filter** (shared with the Log)
- Options: **All** plus each real type (Flower, Concentrate, Edibles, Pre roll),
  derived from the type definition. **Other and Not set aren't options** — those
  products appear only under All. Accepted.
- Concentrate is **not** split into sub-types.
- **One setting shared by the Leaderboard and the Log.** Persists across tab
  switches and relaunches. It's **view state** — not part of the user's data or
  export. Invalid stored value → All.
- Under a filter: **ranks renumber from 1**, the **podium follows the visible
  order**, and **all tiles recalculate** against the matching products.
- When a filter is active, the control shows it's active.

**2. Rank by** (Leaderboard only — **not** on the Log)

| Under | Options |
|---|---|
| **All** | Overall, then the de-duplicated union of every type's rating categories |
| A specific type | Overall, **Price per gram** / **Price per mg** (by unit), **Value for money**, then that type's categories |

- **Overall is the default.**
- **Price and VFM are not offered under All** — mixing mg and g prices, or
  non-comparable VFM, would give a meaningless order.
- **Hit time is never offered.**
- Options are **derived** from the rating sets and the filter, never a
  hand-kept list.
- Everything ranks **highest first** (including price — most expensive first).
- **Price ranks on the unrounded figure.**
- The row's score becomes the ranked value, **relabelled** (e.g. `7.8 TASTE`).
- Ranks renumber, podium follows, **ties → most recent date tried**.
- **Products that can't be ranked are hidden** — either the category doesn't
  exist for that type, or it's unrated. So Rank by also filters, intentionally,
  and all tiles recalculate against what's visible (PRODUCTS can drop).
- When price-ranked, the price shows in the score **and** on the metadata line.
  Chosen.
- If the filter changes to one where the selected option doesn't exist, **fall
  back to Overall and overwrite the stored setting.**
- Persists exactly like the filter. Shows when active.

**Three different empty states** — never claim the app is empty when it isn't:
1. **Genuinely empty** — no products yet; invite adding one.
2. **Filtered-empty** — the filter matches nothing; name the filter, say how
   much exists, one tap back to All.
3. **Rank-empty** — the ranking hides everything; name the ranking, one tap back
   to Overall. If both could apply, **the rank one wins.**

**Returning lands where you were.** Coming back from a product profile scrolls
to **the row that was tapped** — anchored to the **record**, not a pixel offset
or index (the product may have moved rank). Put it back at roughly its previous
screen position; leave it if already visible. If the row is gone (archived,
filtered out) → top. **Tab switches and app launches start at the top.**
Transient state only. Measure positions after any entry animation has settled.

### 10.2 The Log

The **complete record of everything tried**. Never visible to followers.

**Two kinds of row in one list:**
- **Loose log entries** — created directly in the Log (§6). Editable,
  **hard-deletable** behind a confirmation.
- **Product rows** — every **non-archived** product, projected with only its
  **name, country, photo, product type and concentrate type**. No ratings,
  prices, dates or notes come across.

**Projections are derived when drawn, never copied.** There is only one copy of
a product, so edits show through immediately. **Don't write mirror records.**

**Traffic is one-way.** Products appear in the Log; loose entries never appear
on the Leaderboard. The only route across is **promotion** (below).

**Grouping:** one continuous scroll grouped by **country**, a heading per group
with a row count. Groups ordered **most rows first**, ties alphabetical, **"No
country" always last**. Nothing collapses.

**Order inside a group** (loose entries and products interleave as equals):
1. Has at least one photo → above those without (yes/no, not a count)
2. Name, alphabetical, **case-insensitive** (default string comparison for digits)
3. Newest first — tie-break only

**Do not reopen:** the Log no longer reads chronologically. Don't add a date
display or a "recent" section to compensate. Duplicate names are allowed and
will sit next to each other — **no dedupe or merge prompts.**

**Row behaviour:**
- A product row shows a small **product-type marker** (which also signals "this
  has a full profile") and opens the **product profile**. It must **never offer
  delete**.
- A loose entry shows **no marker** and opens the **log entry editor**.
- A product classified Other/Not set has no icon, so looks like a loose entry.
  Accepted.
- A thumbnail with no photo shows the type icon — for **both** row kinds.
- A profile opened from the Log returns to the Log.
- **Returning lands where you were** — same rule as §10.1, both row kinds.
- The filter (§10.1) applies here too.

**Log stats tiles** (shown even when empty, as `0 / 0 / 0g`):

| Tile | Shows | Deduped? |
|---|---|---|
| **PRODUCTS** | Distinct names | **Yes** — case-insensitive, across country groups and row kinds |
| **COUNTRIES** | Distinct countries with a row | Yes — **"No country" excluded** |
| **TOTAL** | Grams across the whole Log | **No** |

- TOTAL = every purchase amount on every non-archived, **non-edible** product
  **plus** the amount on every **non-edible** loose entry. I.e. the Leaderboard
  TOTAL plus loose amounts. Same formatting as §10.1.
- **Do not reopen:** PRODUCTS dedupes and TOTAL doesn't — they answer different
  questions ("how many different things?" vs "how much bought?").
- Group counts can add up to more than PRODUCTS. **No explanation shown.**
- Under a filter: everything recalculates on matching rows; empty groups aren't
  drawn.

**Promotion — turning a loose entry into a product**

The log entry editor has **Add to leaderboard**, shown only for **saved** loose
entries.

- Pressing it **commits nothing**. It opens the product editor **pre-filled**
  with the entry's **name, country, photo, product type and concentrate type**,
  read from the **live form** (unsaved edits carry). Everything else starts
  empty.
- **On save, atomically** (single database transaction — all or nothing): the
  product is created, the photo is **re-assigned** to it (moved, not copied —
  its original travels too), and the loose entry is **deleted**.
- **On cancel/back:** ask first — **Keep editing** / **Discard**. The loose
  entry is untouched. (This guard is only for promotion.)
- The entry's **amount is dropped** — don't invent a purchase to hold it.
- Duplicate names allowed, no warning.
- The new product appears **unrated at the bottom** of the Leaderboard (and may
  be hidden by an active filter).

**Do not reopen:** don't "simplify" by creating the product up front when the
button is pressed — that leaves a bare unrated product for anyone who changes
their mind.

### 10.3 Product profile and editor

**Profile** (your own) shows everything: hero (name, Overall, headline price,
etc.), ratings with "Rated N of N", hit time for edibles, photos, price history,
value for money, notes, Leafly (§12), details (strain type, product type,
concentrate type, country, Source, date tried), and actions (edit, archive,
**private** switch).

**Editor**: all fields in §6. Showing/hiding type-specific inputs (concentrate
type, Consistency, hit time, Look for pre rolls) follows the type definition.
Cancelling an ordinary edit needs no prompt.

**Profile → editor → back** restores the profile's scroll position (e.g. leave
from the price history, return to the price history), per product.

### 10.4 Archive

Products are **never hard-deleted** by the user (account deletion aside).
Archiving removes a product from the Leaderboard, the Log, all tiles and
followers' view, while keeping its data. The **Archive** list (reached from
More) shows archived products, ranked by Overall regardless of Rank by, with
**un-archive**.

### 10.5 More

About (with the **running version**), Archive, Export, Restore, account
settings (passkeys, recovery, sign out, delete account).

### 10.6 A followed person's view

See §5. Read-only Leaderboard and product profiles showing only the permitted
fields; filter and Rank by (without price/VFM); PRODUCTS and AVERAGE tiles.

---

## 11. Input rules and photos

### Auto-capitalisation

Applies to **product name, log entry name, Source and purchase supplier**.

**Only ever ADD capitals, never remove them.** Uppercase the first character of
each word; leave every other character exactly as typed.

| Typed | Stored |
|---|---|
| `blue dream` | `Blue Dream` |
| `RS11` | `RS11` |
| `OG KUSH` | `OG KUSH` |
| `pineapple eXpress` | `Pineapple EXpress` |
| `o'shea` | `O'shea` |
| `blue-dream` | `Blue-dream` |

- Words split on **whitespace only**.
- Applied **when leaving the field** (blur), never while typing. Trim leading and
  trailing space at the same time.
- The stored value is rewritten. **No override or undo — Do not reopen.**
- Handle non-ASCII / emoji first characters safely.
- Anything consuming a name (sorts, dedupe, Leafly search) must be
  case-insensitive anyway.

### Photos

- **Multiple** photos per product; **one** per log entry. No count cap.
- Resized on the way in: **1600px long edge, JPEG ~0.82 quality**.
- **Cropping:** move and resize a crop box, free or 1:1 ratio. The **uncropped
  original is kept**, so **Reset to original** always works and repeated crops
  are always taken from the original (never a crop of a crop).
- **Tap a photo → full-screen viewer; a crop button → cropper**, on the profile
  and in both editors. The viewer always offers **Crop this photo**.
- **Where a crop is saved:**
  - From the **profile** (or a viewer opened from it) → saved immediately.
  - From **inside an editor** (or a viewer opened from it) → applied to the
    unsaved form, committed on **Save**, discarded on **Cancel**. The viewer
    shows the in-progress crop.
- In the **Log list**, tapping a row's thumbnail opens the row (profile or
  editor), not a viewer — the row is the tap target.
- Followers see **cropped images only**, never originals.

---

## 12. Leafly link

On the product profile. One button, two states:

| State | Label | Opens |
|---|---|---|
| A link is saved | **View on Leafly** | the saved link |
| No link | **Search Leafly** | `https://www.leafly.com/search?q=` + URL-encoded product name |

- The link field accepts **anything** — no validation. Stored exactly as typed;
  if it has no scheme, add `https://` when opening.
- **Always opens externally** (new tab / external browser), never inside the
  app — in standalone mode, navigating the app view away would force a relaunch.
- **Never guess a Leafly URL** from the name (their slugs don't match names).
- **Out of scope — Do not reopen:** importing any Leafly data (THC %, terpenes,
  effects, descriptions, photos). The app never fetches from Leafly.
- Not shown to followers; not in the Log.

---

## 13. Export and restore

Data now lives on the server, but the user keeps control of it.

- **Export:** one `.json` file containing **all of the user's data**, photos
  embedded (cropped **and** originals). On iPhone it should open the share sheet
  so it can be saved to Files/iCloud.
- **Restore:** from an export file; **replaces all of the user's data** behind a
  clear confirmation.
- The export excludes view state (filter, Rank by) and social data (follows,
  requests, blocks). Restoring doesn't change the current view.
- Because derived figures are calculated on read, a restored export always
  displays under the current rules.

There is **no need to import data from the previous version** of the app.

---

## 14. Decisions already made — Do not reopen

A compact list. Each was put to the owner and decided.

- High excluded from Overall except for edibles, where it's ⅔ (§8).
- Pre roll has no Look (§8).
- Ratings and concentrate type retained, never cleared, on a type switch (§7, §8).
- Hit time is a duration, not a rating (§8).
- Edibles are mg of THC; nothing ever auto-converts (§9).
- Edibles excluded from both TOTAL tiles; no mg tile (§10).
- Edible VFM per 100mg, knowingly non-comparable with other types (§9).
- VFM on the profile only, not rows; rows show price · Source (§9, §10.1).
- Price derived from total ÷ amount; full precision for maths (§9).
- Supplier and Source are separate fields (§9).
- Archive instead of delete for products; archived excluded from totals (§10.4).
- TOTAL counts bought, not consumed; blank amounts silently zero (§10.1).
- Exactly two Leaderboard controls; no search in your own lists (§10.1).
- Other/Not set not filter options (§10.1).
- Price/VFM not rankable under All; Rank by hides unrankable products (§10.1).
- Log sort: photo, name, recency; no recency affordance; no dedupe (§10.2).
- Log PRODUCTS dedupes, TOTAL doesn't; no explanation of count mismatch (§10.2).
- Log projections derived, never mirrored (§10.2).
- Promotion: deferred commit, atomic, photo moved, amount dropped (§10.2).
- Auto-capitalisation only adds capitals; no override (§11).
- Leafly: saved link or search, never guessed, no data import (§12).
- Follows are one-way and need approval; followers see identity, ratings and
  photos only; per-product Private switch (§5).

---

## 15. Out of scope

Don't build these or build toward them without asking:

- Offline editing / sync
- Comments, reactions, comparisons, combined leaderboards, feeds, messaging,
  public profiles, moderation/reporting tools
- Push or email notifications
- Leafly data import
- Grouping by product type
- An mg total tile; a "remaining/consumed" stock concept
- Sub-types for any type other than Concentrate
- Native iOS/Android apps
- Importing data from the previous version

---

## 16. Assumptions to confirm with the owner

Made while writing this brief; raise them early:

1. **Source/Brand and date tried are hidden from followers**, since the owner
   chose "leaderboard + ratings and photos" only. Easy to change.
2. **Username-only accounts, no email**, with recovery codes as the lost-device
   fallback.
3. Filter and Rank by settings are stored **per device**, not synced to the
   account.
4. Where the People area sits in navigation.
5. A followed person's rows show no price — what (if anything) replaces it on
   their metadata line.

---

## 17. Acceptance checks

Automate these. Examples, not an exhaustive list.

**Ratings**
- Flower Look 8, Smell 7, Taste 9, Burn 6, High 2 → Overall **7.5**; changing
  High alone changes nothing.
- Edible Taste 6, High 9 → **8.0**. Only High 9 → 9.0. Only Taste 6 → 6.0.
- Flower rated only on High → no Overall, sorts to the bottom.
- Pre roll offers no Look; a Look value on its record (from an earlier type)
  affects nothing.
- Denominators: Flower 5, Concentrate 6, Edibles 2, Pre roll 4. High counts;
  hit time never does.
- Rated flower → Edibles → Flower: every rating returns intact.

**Money**
- £10 for 3.5g → shows £2.86/g.
- £10 for 7g, Overall 10 → price shows £1.43/g, VFM is exactly **7.00** (not 6.99).
- Edible: Overall 8.0, £0.05/mg → VFM **1.6**.
- A purchase with total but no amount shows no per-unit figure and counts 0g.
- A purchase with no total is discarded on save.
- An edible never shows `g`; a flower never shows `mg`. Type switch relabels
  but does not convert (100 stays 100).

**Tiles**
- Purchases 7g, 3.5g, 3.5g on one product + 1g on another → TOTAL **15g**.
- 1234g → `1.2kg`. Floating-point sums display cleanly (no `5.200000000000001`).
- Edibles-only → `0g`; PRODUCTS/AVERAGE still count them.
- Archiving a product lowers TOTAL.
- Log TOTAL = Leaderboard TOTAL + non-edible loose amounts.
- Log PRODUCTS: "RS11" loose (UK) + "rs11" product (Thailand) → 1 product; both
  amounts in TOTAL.

**Leaderboard**
- Ties broken by most recent date tried; podium on top three visible.
- Filter to a type → ranks renumber from 1, tiles recalculate.
- Rank by Consistency under All → only rated concentrates shown.
- Rank by Look, then filter to Edibles → falls back to Overall, stored setting
  overwritten.
- Price and VFM absent under All; hit time never offered.
- Correct empty state for each of the three cases.
- Return from a profile after re-rating a product from 8th to 2nd → scrolled to
  that product at its new position.

**Log**
- Group order most-rows-first, "No country" last; within-group sort as §10.2.
- Product rows open the profile and never offer delete.
- Promotion: nothing created on button press; cancel leaves the entry intact;
  save creates the product, moves the photo (one photo in storage, original
  kept), deletes the entry; a forced failure mid-save rolls everything back.

**Input and photos**
- Auto-capitalisation table in §11 exactly, on blur only.
- Crop, crop again, reset → original restored; repeated crops don't degrade.
- Crop inside the editor, then cancel → database unchanged.

**Accounts and social — privacy is the critical area**
- A non-follower gets only username + Follow; the API returns nothing else.
- A pending request grants no access.
- An approved follower's API responses **contain no** price, purchase, amount,
  supplier, VFM, notes, Source, date tried, Leafly link, or Log data — checked
  on the raw response, not the screen.
- A private or archived product is absent from the follower's list, tiles and
  counts, and its photo URLs return **not authorised**.
- Photo originals are never served to followers.
- Unfollow / remove follower / block → access ends immediately.
- Block prevents new requests and hides the blocker from search.
- Follower view offers no edit/archive/crop/promote actions, and the API rejects
  them.
- Deleting an account removes its R2 photos and all follow relations.
- One user can never read or write another's data by changing an ID in a request.

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **Product** | The central record — a flower, concentrate, edible, pre roll or other |
| **Loose log entry** | A lightweight Log record with no ratings or prices |
| **Projection** | A product shown in the Log, drawn from the product, never copied |
| **Promotion** | Converting a loose log entry into a product |
| **Overall** | The headline 1–10 score, composed per product type |
| **Rating set** | The categories a product type is rated on, and which feed Overall |
| **Hit time** | Edibles-only onset duration; not a rating |
| **VFM** | Value for money — Overall ÷ price per gram (or per 100mg for edibles) |
| **Headline price** | Per-unit price of the most recent purchase |
| **Archive** | Hidden but kept; the alternative to deletion |
| **Private product** | Hidden from all followers |
| **Follow request** | A one-way request to view someone's shared content; needs their approval |
| **Derived on read** | Calculated whenever shown, never stored |
