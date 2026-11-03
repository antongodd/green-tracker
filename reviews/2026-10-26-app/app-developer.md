# App review: senior iPhone developer (Green Tracker 0.57.x, 26 Oct 2026)

## Overall verdict

This is a well-built Home Screen app, better than most hobby web apps I've seen. The visual design is confident. Tap targets are deliberately sized to 44 points. Reduce Motion is respected. The security basics (passkeys, hashed session tokens, a strict content policy, no-referrer, photo privacy enforced on the server) are done properly. Photos are re-drawn in the browser before upload, so the hidden location data (GPS) in phone photos never reaches the server. The weak spot is the moment that matters most to Anton: **adding a product.** Today a mis-tap, an edge-swipe, a dropped signal in a shop or iOS closing the app in the background can each throw away five minutes of rating, pricing and photographing, with no warning and no way to get it back. For strangers, the next most important gaps are not following the iPhone's text-size setting and a couple of confusing Value-for-money displays. Nearly everything below is fixable without touching any past decision.

## Findings (most important first)

### 1. Cancel and swipe-back silently throw away a new or edited product
- **What:** On "New product" and when editing a product, tapping **Cancel** or swiping back from the screen edge leaves at once and discards everything typed, rated and photographed. Only the "Add to leaderboard" path from the Log asks "Keep editing / Discard".
- **Where:** `13-edit-product`, `06-add-product-*`. `client/src/screens/Editor.tsx` line 225: `cancel` only shows the confirm sheet when `p.promoteFrom` is set. `client/src/router.ts` line 86 handles `popstate` with no "unsaved changes" guard.
- **Why it matters:** Cancel sits top-left, where a thumb reaching for the back area lands. Edge-swipe is easy to trigger by accident while moving a rating slider near the left edge. Losing a full rating session is the kind of thing that makes people stop using an app. This affects Anton every time he buys something.
- **Suggestion:** Use the existing "Keep editing / Discard" sheet whenever the form has changed, for Cancel on new and edit too. For swipe-back, catch the `popstate` while the form has changes, push the screen back and show the same sheet.
- **Size:** Big / Some work.

### 2. A half-filled product isn't kept anywhere if the app is closed
- **What:** The add-a-product form lives only in memory. If iOS shuts the app in the background, everything is gone. iOS does this often for Home Screen apps: when you switch to the Camera, answer a call or open the banking app to pay.
- **Where:** `Editor.tsx` (no draft storage); the uploaded-but-unsaved photos are thrown away later, too.
- **Why it matters:** Anton fills this in at or after the shop, which is exactly when he's switching apps. Strangers will hit it on day one.
- **Suggestion:** Save the form (not the photos' image data, just their upload ids) to the phone's storage as it's typed. On reopening, offer "Carry on with the product you were adding?". Clear it on Save or Discard. This is a scope decision for Anton (it touches photos' pending uploads), but I'd rank it high.
- **Size:** Big / Some work.

### 3. On a bad signal, Save can hang forever and a second tap can make a duplicate
- **What:** No server request has a time limit. In a basement shop or on a weak 4G signal, "Saving…" can spin forever with no way out. If the save actually reached the server but the reply was lost, tapping Save again sends a second "create product".
- **Where:** `client/src/api.ts` `api()`: `fetch` has no timeout or abort. `client/src/products.ts` line 66: a new product is a plain `POST /products` with nothing identifying the attempt.
- **Why it matters:** The second try either makes a duplicate product or (if it had photos, whose uploads were already used) shows an error even though the product did save. Either way the user can't tell what happened.
- **Suggestion:** Add a time limit (around 20 seconds) with a clear "Couldn't reach Green Tracker. Your product is still here, try again" message. Give each new-product save an id made on the phone, so the server can recognise a repeat and return the product it already made instead of a second one.
- **Size:** Medium / Some work.

### 4. Opening the app on a weak signal waits for the network before showing anything
- **What:** When the app starts, the offline helper (service worker) always tries the internet first for the page. It only falls back to the copy on the phone once the network has completely failed, not when it's just slow. The Leaderboard then also has to load from the server, because nothing is kept on the phone between launches.
- **Where:** `client/public/sw.js` lines 74–84 (`navigate`: network first, no time limit). The product list is only cached in memory (`client/src/products.ts`).
- **Why it matters:** On a slow 4G signal, opening from the Home Screen can show a blank or skeleton screen for many seconds. "It's slow" is the most common complaint about web apps on iPhone.
- **Suggestion:** Give the page fetch a short time limit (about 2–3 seconds), then use the copy on the phone. Separately, consider keeping the last Leaderboard on the phone and showing it straight away while the fresh one loads. That is a privacy trade-off (the data sits on the phone), so ask Anton.
- **Size:** Medium / Quick (the time limit) to Some work (keeping the Leaderboard).

### 5. Text doesn't get bigger with the iPhone's text-size setting
- **What:** Every size in the app is fixed in pixels: tab labels are 10px, captions and tags 11px, and "OVERALL"/"VFM" 10–11px. So people who set Larger Text on their iPhone see no change.
- **Where:** `client/src/styles.css`, for example line 237 (`.tab` 10px), 266 (`.cap` 11px), 509 (`.score .cap` 10px), 513 (`.tag` 11px). Pinch-zoom is allowed (good), but that's a poor substitute in an app.
- **Why it matters:** This affects a real share of the public, especially older users. Small grey uppercase captions on dark glass are the hardest text in the app to read.
- **Suggestion:** Base the body size on Apple's system text style (`font: -apple-system-body` on the page) and turn the fixed sizes into proportional ones (`rem`), so they all grow together. Check the leaderboard rows and tab bar still fit at the larger sizes. This needs testing on a real iPhone with Larger Text on.
- **Size:** Medium / Big job (touches the whole stylesheet; existing layout tests will help).

### 6. Value for money: an edible shows "£0.25/mg" at #1, above flower at £6/g
- **What:** Under Rank: Value for money (All types), the gummies row shows **£0.25/mg** next to flower rows at **£6.00/g**. The "per 20mg" note that explains the comparison (D67) only appears under Rank: Price, not under Value for money. The score is also shown as a bare "1.67 VFM" with no explanation on this screen.
- **Where:** `11-rank-by-vfm`. `client/src/components/ProductRow.tsx` line 158: `perGram={rankBy === 'price' && p.filter === 'all'}`.
- **Why it matters:** £0.25/mg is £250/g, so a stranger will think the ranking is broken. This is the newest feature and still on dev, so now is the time to fix it, before it goes live.
- **Suggestion:** Show the "per 20mg" price on edible rows under Value for money too, and spell out "Value for money" (or add a one-line explanation under Rank by). Also, the hero still says "Average 7.9" and "9 products" (one unpriced product silently dropped). Say "9 with a price" so the count change isn't puzzling.
- **Size:** Medium / Quick.

### 7. Photos are re-checked with the server every time they're shown
- **What:** Photo files are sent with "check with the server before reusing" (`private, no-cache`). So every thumbnail on the Leaderboard makes a round trip to the server on every visit, even though a photo version never changes (a re-crop gets a new address).
- **Where:** `server/lib/photos.ts` line 166.
- **Why it matters:** On 4G, a 30-product Leaderboard means 30 extra waits before the thumbnails settle, and it uses more battery and data.
- **Suggestion:** For the owner's own photos, allow the phone to keep them (for example `private, max-age` of a week or more). For followers' views, keep a short life so an unfollow or a product made private takes effect quickly. Ask Anton first: it touches the photo privacy rule's timing (D23), not the rule itself.
- **Size:** Medium / Quick.

### 8. Export builds one giant file in memory, which will fail for heavy users
- **What:** Export downloads every photo (original and cropped), turns each into text inside one JSON file, and holds it all in memory. Restore reads the whole file back the same way. If any single photo fails to download, the whole export fails.
- **Where:** `client/src/backup.ts` lines 39–80 (`toBase64`, whole-file JSON) and line 150 (`file.text()` then `JSON.parse`).
- **Why it matters:** After a year of 3 photos per product, this is hundreds of MB. iPhone Home Screen apps have tight memory limits, so the export or restore can simply crash. That's the user's only backup. (Guess based on the code; it needs a real-phone test with a big account.)
- **Suggestion:** Retry single photos before giving up. Longer term, use a zip file with photos as separate files instead of text inside JSON, so it can be built bit by bit. Also say on the Export screen that the file isn't protected, so "keep it somewhere private". It contains every rating, price and photo.
- **Size:** Medium / Some work (retry, wording) to Big job (zip format).

### 9. The add button covers the score on leaderboard rows
- **What:** The round + button sits over the right-hand side of the 5th row, hiding its "OVERALL" caption. The same happens to Log rows (the Morocco row's mark and chevron in `14-log`). The tab bar is see-through, so text scrolling underneath shows through it ("OV Settings").
- **Where:** `10-leaderboard`, `11-rank-by-vfm`, `14-log`, `40-look-*`. `.fab` in `styles.css` line 519. `.screen` bottom padding is only `nav-h + 24px` (line 189), while the button needs about 72px.
- **Why it matters:** The score is the most important thing on the row. At the very bottom of the list, the last row's score may stay hidden under the button (needs checking on a phone, because full-page screenshots can't show it).
- **Suggestion:** Add bottom padding of about 88px on screens with the + button, so the last row can scroll clear of it. Consider making the tab bar a little more solid so scrolling text doesn't show through the labels.
- **Size:** Small / Quick.

### 10. Every coloured leaderboard row animates forever
- **What:** Rows in colour bands 2–4 run endless shimmer, sheen and glint animations on top of blurred glass, as does the #1 halo. The background lights also move all the time.
- **Where:** `styles.css` lines 170 and 474–482. There are 9 blurred-glass (`backdrop-filter`) surfaces.
- **Why it matters:** Reduce Motion turns it all off, which is good. For everyone else, a long leaderboard of moving, blurred cards is the classic cause of jerky scrolling, a warm phone and battery drain on older iPhones (an XR or SE-class phone, say). This is a guess from the code and needs a real-phone check.
- **Suggestion:** Pause the animations on rows that aren't on screen, and when the app is in the background (Low Power Mode is a good hint too). Test scrolling a 50-product leaderboard on an older iPhone.
- **Size:** Medium / Some work.

### 11. The date box showed "mm/dd/yyyy"
- **What:** "Date tried" shows US order (`06-add-product-empty`: mm/dd/yyyy; `13-edit-product`: 10/02/2026 for 2 Oct).
- **Where:** This is the browser's own date control. The page is correctly marked `lang="en-GB"`, so this is probably Chromium in the screenshot set-up, not what a UK iPhone shows.
- **Why it matters:** "10/02" read as 10 February would confuse a UK user.
- **Suggestion:** Just confirm on Anton's iPhone that it shows the date in UK order. No change expected.
- **Size:** Small / Quick (check only).

### 12. The keyboard and the fixed Save bar need a real-phone check
- **What:** The Save bar is pinned to the bottom of the screen. Only the country picker adjusts itself to the keyboard (`CountryPicker.tsx` line 113); nothing else does.
- **Where:** `.savebar` in `styles.css` line 732; `Editor.tsx`, `LogEditor.tsx`.
- **Why it matters:** On iPhone, fixed bottom bars can jump about or cover the field being typed in (Notes and the Leafly link sit at the bottom of the form). I can't see this in Chromium.
- **Suggestion:** Anton should type in Notes, Leafly link and a purchase's Amount on his iPhone and send screenshots. If it misbehaves, hide the Save bar while the keyboard is open.
- **Size:** Small to Medium / Quick (check).

### 13. Two buttons lead to the same place, and a long name gets cut short
- **What:** The "S" circle top-right on every tab duplicates the profile card on the Settings tab. Long names like "Peach Rings Gummi…" are cut short although the row has room under the score.
- **Where:** `10-leaderboard`, `20-settings` (the header has "S" and the profile card).
- **Why it matters:** These are minor polish points. A stranger may wonder what the S is for, which matters because the first impression counts for public sign-ups.
- **Suggestion:** Consider dropping the "S" from the Settings tab's own header. Let the name wrap to two lines before cutting it short.
- **Size:** Small / Quick.

### 14. The most important flows lack tests for losing work
- **What:** The browser tests are extensive, but nothing protects "you can't lose a product by accident" (Cancel, swipe-back, a slow Save, saving twice).
- **Where:** `test/e2e/`. Covered today: the stale-load test (`staleload.spec.ts`).
- **Why it matters:** Once findings 1–3 are fixed, a future change could quietly bring the problem back.
- **Suggestion:** Add browser tests for each: Cancel with changes asks first; going back with changes asks first; a held Save request times out with the form still filled in; repeating a Save returns the same product.
- **Size:** Medium / Some work.

## What's already great (please don't break)

- **Privacy and security done properly.** Passkeys plus one-use recovery codes with a "this is the only time" screen. Session tokens are stored only as hashes. Strict security headers. Photo access is checked on the server, never originals for followers, never private, archived or kept-by-Log products (`server/routes/photos.ts` line 107). Location data is removed from photos by re-drawing them in the browser.
- **Offline basics that can't trap a phone on an old version:** a new offline helper each build, and old copies deleted. The app is honest about being offline: it checks whether the server actually answers, not just whether there's Wi-Fi (`online.ts`).
- **44-point tap targets** everywhere, including invisible enlarged areas round small buttons (`.clr`, `.more-photo`), and real accessibility labels on sliders and flags.
- **Reduce Motion respected** throughout.
- **Safe areas** for the notch and home bar handled in the header, tab bar and Save bar.
- **Upload first, commit on Save** for photos, and the "a slow load can't undo your change" guard (D55). These are thoughtful, tested reliability work.
- **The look:** the welcome screen, empty states and product page are genuinely polished and clear. The Overall explanation on rating screens is exactly the right amount of help.

*Couldn't check (needs Anton's iPhone):* Face ID and passkey flows, the date format, keyboard behaviour with the Save bar, scrolling smoothness of the animated leaderboard on an older iPhone, Larger Text, and exporting a large account.
