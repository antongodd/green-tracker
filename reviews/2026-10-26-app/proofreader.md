# Proof-reader's report: the Green Tracker app (2026-10-26)

**Overall verdict.** The writing is better than most apps I edit. It's plain, friendly and short, and nearly every apostrophe is curly. The privacy, export and delete screens explain clearly what happens to your data, which is uncommon. The slips that are left fall into three groups. First, a few leftovers from renames: the app still says "More" in places where the tab is now "Settings", and "Sources" is called three different things. Second, the capital letters on "Leaderboard" and "Log" wander. Third, a handful of insider words ("VFM", "tiles", "type mark", "hit time", "Glass hero", colour names like "Violet") mean nothing to a stranger. One sentence that appears on every product page has a straight apostrophe and, in one case, a grammar error. All of these are quick to fix. I could only read Chromium screenshots, so anything about the iPhone's own pickers and date boxes needs checking on a real phone.

## Findings

### 1. Two messages still send people to "More", but the tab is now "Settings"
- **What:** The tab was renamed to Settings (D61), but two messages still name the old tab.
  - "You can undo this in **More** → Blocked people." (confirmation when you block someone, `client/src/screens/People.tsx` line 263)
  - "you can un-archive it from **More** → Archive." (confirmation when you archive a product, `client/src/screens/Profile.tsx` line 449)
- **Why it matters:** Both appear at the moment someone takes a serious action, and they point to a tab that doesn't exist.
- **Suggestion:**
  - "You can undo this in Settings → Blocked people."
  - "You can bring it back from Settings → Archive." (This also gets rid of "un-archive"; see finding 9.)
- **Size:** Medium, Quick.

### 2. The sentence explaining Overall has a straight apostrophe and can be ungrammatical
- **What:** "High is rated but doesn't count." uses a straight `'`. Everywhere else the app uses curly ’, including the line just above it in the editor: "Doesn’t count towards Overall".
- **Grammar:** The same code (`shared/domain/ratings.ts` line 60) writes "X and Y **are** rated but **doesn't** count" when more than one category doesn't count. That should be "don't".
- **Where:** 06, 12, 12c, 13, 17b and every look's product page.
- **Suggestion:** "High is rated but doesn’t count." and, for more than one, "… are rated but don’t count."
- **Size:** Medium (it's on every product page), Quick.

### 3. "Sources", "Brands & suppliers", "Source/Brand" and "Source": one idea, four names
- **What:** The same idea goes by several names:
  - The tab says **Sources**, but that screen's title says **Brands & suppliers**.
  - The title is cut off in the header: "Brands & supplie…" (15-sources).
  - The editor field is labelled "Source" with the placeholder "Source/Brand" (no spaces).
  - The cards are tagged "Brand" or "Bought here".
  - The empty screen says "Add a **Source** to a product, or a **Supplier** to a purchase", with capitals mid-sentence (05c).
  - Privacy explains Source as "Where you got it, e.g. Cookies." (24-privacy). But Cookies is a brand, and where you *got* it is the supplier, which is never shared. A new user could easily think their shop's name will be shown to followers.
- **Why it matters:** A stranger won't know whether "Source" means who made it or where they bought it. The privacy wording makes that confusion worse.
- **Suggestion:** Pick "Brand" for the product field: label "Brand", placeholder "e.g. Cookies". Keep "Supplier" for purchases. Change the screen title to "Brands and suppliers", which fits the header. Empty screen: "Add a brand to a product, or a supplier to a purchase, and it shows here." Privacy: "Brand — Who made it, e.g. Cookies." If renaming the field is too big a change (D59/D61), at least fix the privacy line and the mid-sentence capitals.
- **Size:** Medium, Some work.

### 4. "Leaderboard" and "Log" switch between capital and small letters
- **What:** Most of the app writes "Leaderboard" and "Log" with capitals, but these places don't:
  - "Add to **leaderboard**" (button on 14c-log-entry, `promotion.ts`, `Editor.tsx` line 334)
  - "Hidden for now. Add to **leaderboard** brings it all back." (`LogEntry.tsx` line 181)
  - "Follow to see their **leaderboard**." (`Person.tsx` line 126 and the server, `people` route)
  - "see your **leaderboard**" (30-blocked and the block confirmations)
  - "They stop seeing your **leaderboard** straight away." / "You’ll need to request again to see their **leaderboard**." / "View **leaderboard**" / "People who follow you see your **leaderboard**, never your Log…" (`People.tsx`)
  - "Add a **log** entry", "New **log** entry", "Save to **log**" (05b, 14b), and "Your **log** entry stays as it was." (`Editor.tsx` line 531)
- **Suggestion:** Use capitals everywhere, since they're the tab names: "Add to Leaderboard", "Add a Log entry", "Save to Log", "see your Leaderboard". The one exception is "friends’ boards", which is fine.
- **Size:** Small, Quick.

### 5. "VFM" is jargon
- **What:** When you rank by Value for money, every row's caption is "VFM" (11-rank-by-vfm).
- **Why it matters:** New users won't know what it stands for. The Rank by button says "Value for money", but the eye goes to the rows.
- **Suggestion:** Use "VALUE" as the caption, or "PER £" if space allows.
- **Size:** Small, Quick.

### 6. Price ranking: "Price" under All, "Price per gram" under Flower
- **What:** The Rank by list says "Price" on 10-leaderboard but "Price per gram" on 11b-type-flower (`productTypes.ts` line 83 against `leaderboard.ts` line 53).
- **Suggestion:** Use "Price" in both. The unit is already shown on every row.
- **Size:** Small, Quick.

### 7. The edible value-for-money line makes an effect claim
- **What:** "Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better" (12b-product-edible).
- **Why it matters:** "The same effect" reads like a dosing claim, which is risky for a public app and isn't true for everyone. The "÷" and "£/g" shorthand also reads like a formula. The flower version, "Overall ÷ latest £/g · higher is better", has the same problem.
- **Suggestion:**
  - Edible: "Overall score for each £ spent, counting 20mg as 1g of flower. Higher is better."
  - Flower: "Overall score for each £ spent per gram. Higher is better."
- **Size:** Medium, Quick.

### 8. Product type names: "Pre roll", "Edibles", "Live Rosin"
- **What:** Three inconsistencies in the type names:
  - "Pre roll" should have a hyphen: "Pre-roll" (filters, editor, `productTypes.ts` line 162).
  - "Edibles" is plural while the others are singular ("Flower", "Concentrate"). One gummy pack ends up reading "SATIVA · Edibles" and "Product type: Edibles" (12b).
  - Concentrate types mix capital styles: "Live Rosin", "Live Resin" against "THC distillate".
- **Suggestion:** "Pre-roll", "Edible" (keep "Edibles" only for the filter if you like), "Live rosin", "Live resin".
- **Size:** Small, Quick (check that tests don't match the old labels).

### 9. Insider words a stranger won't understand
- **Archive** (29-archive, plus the confirmation in `Profile.tsx`): "hidden from your Leaderboard, Log, **tiles** and followers". "Tiles" is a design term. Use "hidden from your Leaderboard, Log, totals and followers". The same screen says "archive from their **profile**", but elsewhere it's a product page, so use "from its product page". "un-archive" should be "unarchive", or better, "bring it back".
- **Log** (14-log): "Rows with a **type mark** have a full profile on your Leaderboard." Better: "Rows with a leaf or other icon are also on your Leaderboard."
- **Settings** (20-settings): "Leaderboard top — **Glass hero**". This only makes sense after you've seen the Appearance screen. Consider "Leaderboard top — One big card", which reuses the description already on 21-appearance.
- **Product page badge** (12, 12b, 40-*): "**Violet** · #1 on your Leaderboard", "**Jade** · #4…", "**Hot pink** · #1…". A colour name means nothing until you've found the colours key. Consider "#1 on your Leaderboard" alone, or "#4 on your Leaderboard · 8.0+ band".
- **HIT TIME — Not set** (12b): needs a few words, e.g. "Time to kick in".
- **Size:** Medium together, Quick.

### 10. "Rated 0 of 5" against "Rated 5 of 5 categories"
- **What:** The editor says "Rated 0 of 5" (06, 13), but the product page says "Rated 5 of 5 categories" (12).
- **Suggestion:** Use "Rated 5 of 5 categories" in both.
- **Size:** Small, Quick.

### 11. The Leafly placeholder is cut off
- **What:** "Paste a link, or leave empty to search by" stops before "name" (06-add-product-empty-full, 13).
- **Suggestion:** "Paste a link, or leave blank" (it fits), and explain the search below it if needed.
- **Size:** Small, Quick.

### 12. The date box shows "mm/dd/yyyy"
- **What:** "Date tried" shows the American order on 06-add-product-empty-full.
- **Caveat:** This is probably Chromium in a US locale. A UK iPhone should show its own date picker, but check on a real phone.
- **Suggestion:** Check on the iPhone. If the US order appears, the field should follow the phone's settings or show "dd/mm/yyyy".
- **Size:** Small (if Chromium only), Quick to check.

### 13. Small capitalisation and wording slips on Sources and the brand page
- "best: Amnesia Haze" (15-sources) has a small "b", but the brand page says "Best · Wedding Cake" (15b). Use "Best: Amnesia Haze".
- The privacy preview line "This is what your followers see now. Change it in Privacy" has no full stop after the link (24b, `Person.tsx` line 77). Use "Change this in Privacy."
- The People empty state says the same thing twice: heading "Not following anyone" and text "You’re not following anyone yet." (05d). Better: "Search for a username above to follow a friend."
- **Size:** Small, Quick.

### 14. Two ways of describing passkey confirmation
- **What:** Sign-up and Passkeys say "Face ID, Touch ID or your screen lock", but Delete account says "You’ll be asked for Face ID or your passkey to confirm." (31-delete). "Face ID or your passkey" suggests these are two different things.
- **Suggestion:** "You’ll be asked to confirm with your passkey (Face ID, Touch ID or your screen lock)."
- **Size:** Small, Quick.

### 15. Error messages mix "could not" and "couldn’t", and some are too technical
- **What:** The server mixes formal and contracted forms:
  - "The passkey **could not** be checked", "A purchase **could not** be read", "The ratings could not be read"
  - against "A product in the file **couldn’t** be read"
- **Too technical:** "Unknown rating category.", "Not found.", "The request is missing something." and "Keep supplier to N characters." (clunky). None of these tell the user what to do next.
- **Suggestion:** Use "couldn’t" throughout. Reword the rest, for example "Keep the supplier name to N characters." and "Something’s missing. Please try again."
- **Size:** Small (most users never see these), Some work (many strings in `server/`).

### 16. Dashes: "–" and "—" both stand for "no score"
- **What:** An unrated row on the Leaderboard shows an en dash "–" (10, 12c). Unrated categories in the editor and ratings card show an em dash "—" (06, 12c).
- **Suggestion:** Use the same dash in both places.
- **Size:** Small, Quick.

### 17. Wording on Money and Settings
- 23-currency: the heading "USUAL" reads oddly. Use "COMMON".
- 23-currency: "Prices shown together are in this currency, so everything can be compared." is vague. Better: "Totals and comparisons use this currency. Each purchase keeps the currency you paid in."
- 20-settings: "What followers see — Followers see: Leaderboard, Source, Country, Photos" repeats itself. Just list the items: "Leaderboard, Source, Country, Photos".
- **Size:** Small, Quick.

## What's already great
- Curly apostrophes and quotes are used almost everywhere, including server messages. Only finding 2 slips.
- The privacy footnote on 24-privacy is a model of plain English: "Prices, purchases, suppliers, notes, date tried, Leafly links and your Log are never shared."
- The Export, Restore and Delete screens say exactly what's included and what goes, in short lists, and "Keep a copy? Export first." is a perfect nudge.
- The sign-up copy is warm and honest: "There’s no password." and "This is the only time you’ll see them."
- Errors mostly say what to do next: "Couldn’t get the exchange rate just now. Type it in instead." and "The passkey step was cancelled or timed out. Try again when you’re ready."
- British spelling is consistent: colours, favourite-free, "draw round", "straight away".

**Couldn't check:** the iPhone's own pickers (Rank by, Type, date), how Safari shows the date box, real passkey prompts, and the full text of the Remove background download sheet in place. These all need a look on a real iPhone.
