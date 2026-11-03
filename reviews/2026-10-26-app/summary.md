# Review panel: the app (2026-10-26)

## In a nutshell
All five reviewers say the app is unusually polished. The look, the product page, the privacy set-up and passkey sign-in with no email are its strengths. Most of the weak spots sit around the core rather than in it. Three things matter most:
1. **Adding a product can lose your work without warning.** Cancel or a swipe back throws everything away, and so does the iPhone closing the app in the background. This hits Anton every time he buys something.
2. **Value for money confuses people.** An edible shows "£0.25/mg" at #1 next to flower at £6/g, and every score is labelled "VFM" with no explanation.
3. **Privacy and trust for strangers.** "Source" is described as "where you got it" and is shown to followers from the start. There's no 18+ notice or privacy notice. Export gives no warning that the file is unprotected.

Most fixes are small. A handful of bigger ideas would reopen past decisions, and those are Anton's call.

## Quick wins (big difference, little work)
1. **Ask before throwing away a product.** Show the existing "Keep editing / Discard" sheet when someone taps Cancel or swipes back after changing anything. Today it only appears when moving a Log entry to the Leaderboard. *Checked:* `Editor.tsx` line 224 asks only on that one path, and the back-swipe code in `router.ts` has no check for unsaved changes. Raised by the App developer. **Size: Big · Effort: Some work.**
2. **Make the Value for money rows readable.**
   - Show an edible's "£5.00 per 20mg" on its row under Value for money, as already happens under Price.
   - Replace the "VFM" caption with "Value" or "points per £".
   - *Checked:* `ProductRow.tsx` line 158 shows the per-20mg note only when ranking by Price. The VFM label is in `Controls.tsx`. On 11-rank-by-vfm the gummies sit at #1 with "£0.25/mg".
   - This finishes D67 rather than changing it. The developer's note that it is "still on dev" is out of date: it's live, so this is now a fix to the live app.
   - Raised by Sam, the App developer and the Proof-reader. **Size: Big · Effort: Quick.**
3. **Correct the Source wording, and warn people on the form.**
   - Privacy currently says "Where you got it, e.g. Cookies." *Checked:* `Privacy.tsx` line 31.
   - Change it to "The brand or grower, e.g. Cookies. Shops and dealers go in Supplier, which is never shared."
   - Add a small "Followers can see this" note under the Source box. Its placeholder is "Source/Brand" (checked on 06).
   - Sam, the Proof-reader and the Investor all raised this. It's the strongest point of agreement in the round. **Size: Big · Effort: Quick.**
4. **Add a warning line to Export.** For example: "This file isn't locked. Anyone who opens it can read everything, so keep it somewhere private." *Checked:* 27-export only suggests "Files or iCloud Drive". Raised by the Investor and the App developer. **Size: Medium · Effort: Quick.**
5. **Stop the + button covering the 5th row's score.**
   - It hides the "OVERALL" caption on 10-leaderboard and the score's caption on 11. *Checked:* the screens only leave about 24px of room at the bottom (`styles.css` line 189), less than the button needs.
   - Add about 88px of room at the bottom of any screen that has the button, so the last row can scroll clear of it.
   - Raised by Sam and the App developer. **Size: Small · Effort: Quick.**
6. **Put a time limit on Save.** If a save takes longer than about 20 seconds, stop and show "Couldn't reach Green Tracker. Your product is still here." *Checked:* `api.ts` has no time limit. Stopping the second tap from making a duplicate product is a slightly bigger job. Raised by the App developer. **Size: Medium · Effort: Some work.**
7. **Hide the "0 products · 0 countries · 0g" card on an empty Log**, as the empty Leaderboard already does. *Checked* on 05b. Raised by Marketing. **Size: Small · Effort: Quick.**
8. **Make "Create account" the main button on the welcome screen.** Make sign-in the second button. *Checked* on 01-welcome: "Sign in with passkey" is the filled button. People who already have an account usually open the app signed in, so strangers are the ones who see this screen most. Raised by Marketing. **Size: Big · Effort: Quick.**

## Worth doing next (bigger pieces)
1. **Keep a half-filled product if the app is closed.** Save the form on the phone as it's typed, then offer "Carry on with the product you were adding?" when the app opens again. iPhone Home Screen apps get closed in the background often, for example when you switch to the camera or answer a call. Raised by the App developer. Anton should decide how it treats photos that were uploaded but not yet saved. **Size: Big · Effort: Some work.**
2. **Move Photos up the form.**
   - Put Photos straight under Name, then Purchases, with Ratings lower down. *Checked:* Photos is currently 6th of 9 sections (06-add-product-empty-full).
   - The lighter "name and score now, details later" first add (Investor, Marketing) and Sam's "More details" fold for Country, Strain type and Leafly belong in the same piece of work.
   - Visual change, so it starts with a mockup. Raised by Sam, the Investor and Marketing. **Size: Medium · Effort: Some work.**
3. **"You rated this 9.1" on a friend's product.** When you have a product with the same name, say so on your friend's page. This reuses the name matching from D59 and shares nothing new. It's the cheapest way to give people a reason to come back. Raised by Sam and the Investor. **Size: Big · Effort: Some work.**
4. **An "Invite a friend / share my username" button** on People and on your profile card, opening the iPhone share sheet. Raised by Marketing and the Investor. If it includes the website address, it touches D63, which says there's no link to the website from the app. **Size: Big · Effort: Some work.**
5. **Make the rating sliders easier one-handed.** Either show "tap to type" as visible text, or add − / + buttons next to each score. *Checked:* the sliders move in steps of 0.1, and the "Tap to type a value" hint is only read out to screen readers. Raised by Sam. Needs checking on the iPhone. **Size: Medium · Effort: Quick.**
6. **Follow the iPhone's text-size setting.** Text sizes are fixed (the tab labels are 10px), so Larger Text in iPhone settings has no effect. Raised by the App developer. **Size: Medium · Effort: Big job.**
7. **Open faster on a weak signal.** When opening, wait no more than 2–3 seconds for the network before using the copy saved on the phone. *Checked:* `sw.js` waits for the network with no time limit. Raised by the App developer. **Size: Medium · Effort: Quick.**

## Ideas to think about
- **18+ tick and a one-screen privacy notice.** The notice would say what's kept, where, for how long (including backups), who runs the app, and a contact address for reports. Raised by the Investor and Marketing. D63's "no age or legal note" was decided for the website only, so this is new scope for the app rather than reopening D63 directly.
- **Source switched off by default for new accounts** (Sam, the Investor). New accounts currently share it (`share_source DEFAULT 1`, checked). This narrows D1/D45 for new accounts only. My view: do the wording fix (Quick win 3) first, then decide.
- **Optional Face ID when opening the app.** You stay signed in for 60 days (checked), so anyone holding an unlocked phone sees everything. Raised by the Investor.
- **"Hide money" switch, and a "use a nickname, not a real name" hint in Supplier** (Investor). Price and Supplier are already optional (checked), so this is about labelling them, not changing how they work.
- **Let the phone keep your own photos for longer.** Today the phone checks every photo with the server each time it's shown, so access can be withdrawn at once. Raised by the App developer. Touches how quickly D23's photo privacy rule takes effect.
- **"Share my top 5" picture** with names and scores only (Marketing). New sharing, so it's a privacy decision.
- **A "Buy again?" switch or effect tags** (Sam). This adds new data, so think about Export and followers.
- **Show "Best value" in the top stats card when ranking by Value for money** (Sam).
- **Freeze new looks and decoration** (Investor). This is a matter of focus, not a bug, and it would touch D56, D64 and D65.
- **Pause the moving card effects while rows are off screen** (App developer, not checked). Test first: scroll a long Leaderboard on an older iPhone.
- **Export as a zip file, and retry a photo that fails** (App developer, not checked on a big account).

## Words to fix
| Where | Now | Should be |
|---|---|---|
| Block confirmation (`People.tsx` 263) | "…undo this in More → Blocked people." | "…undo this in Settings → Blocked people." |
| Archive confirmation (`Profile.tsx` 449) | "…tiles and followers’ view… un-archive it from More → Archive." | "…totals and followers’ view… bring it back from Settings → Archive." |
| Overall line (`ratings.ts` 60), every product page | "High is rated but doesn't count." / "X and Y are rated but doesn't count." | "doesn’t" with a curly apostrophe; "are rated but don’t count." |
| Privacy, Source | "Where you got it, e.g. Cookies." | "The brand or grower, e.g. Cookies." |
| Source box placeholder | "Source/Brand" | "e.g. Cookies" |
| Sources screen title | "Brands & suppliers" (cut off in the header) | "Brands and suppliers", if it fits |
| Empty Sources (05c) | "Add a Source to a product, or a Supplier to a purchase" | "Add a brand to a product, or a supplier to a purchase, and it shows here." |
| Rows ranked by Value for money (11) | "VFM" | "Value" |
| Rank by under Flower (`productTypes.ts` 83) | "Price per gram" | "Price" |
| Edible value line (12b) | "Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better" | "Overall score for each £ spent, counting 20mg as 1g of flower. Higher is better." (This avoids an effect claim.) |
| Leafly placeholder (cut off on 06) | "Paste a link, or leave empty to search by name" | "Paste a link, or leave blank" |
| Buttons and messages | "Add to leaderboard", "Add a log entry", "Save to log", "see your leaderboard" | Capitals: "Leaderboard", "Log" |
| Type names | "Pre roll", "Edibles", "Live Rosin" / "Live Resin" | "Pre-roll", "Edible", "Live rosin" / "Live resin" (check the tests) |
| Editor | "Rated 0 of 5" | "Rated 0 of 5 categories" |
| Product badge (12, 12b) | "Violet · #1…", "Jade · #4…" | "#1 on your Leaderboard" alone, or "9.0+ · #1…" (also raised by Marketing) |
| Edible page | "HIT TIME" | "Time to kick in" |
| Settings | "Leaderboard top — Glass hero" | "Leaderboard top — One big card" |
| Log (14) | "Rows with a type mark…" | "Rows with a leaf or other icon…" |
| Sources (15) | "best: Amnesia Haze" | "Best: Amnesia Haze" |
| Delete account (31) | "Face ID or your passkey" | "your passkey (Face ID, Touch ID or your screen lock)" |
| Money (23) | "USUAL" | "COMMON" |
| Server error messages | A mix of "could not" and "couldn’t"; "Not found.", "Unknown rating category." | "couldn’t" throughout, and messages that say what to do next |
| No-score dashes | "–" on rows, "—" in the editor | One dash everywhere |

## What everyone liked
- **The look:** Aurora Glass, the score colours, and the product page hero with its big score. Several reviewers called it the most screenshot-worthy screen.
- **Ranking:** a single tap to switch between Overall, Price and Value for money, with price per gram worked out for you.
- **Privacy:** followers must be approved; suppliers, prices, notes and the Log are never shared; you can preview what followers see (24b).
- **Sign-up:** passkeys, no email or phone number, and a recovery-codes screen that is clear and calm.
- **Delete account:** honest, offers Export first, and asks for Face ID.
- **Reliability work:** 44-point tap targets, Reduce Motion respected, location data stripped from photos, and the D55 fix that stops a slow page load undoing your change.

## The sceptic's view (kept separate)
- **The biggest risk:** the app builds a dated, priced record of buying cannabis, with a per-supplier "£ spent" summary on Sources. Anyone holding an unlocked phone, or the police after downloading it, gets a ready-made summary. The Investor doesn't want the feature removed, only to stop pushing it as the default:
  - say clearly that price and supplier are optional;
  - suggest nicknames in Supplier;
  - offer a "Hide money" switch;
  - add a Face ID lock;
  - add the Export warning.
- **Things a public service is expected to have:**
  - an 18+ tick at sign-up;
  - a privacy notice that is honest about backups (SPEC confirms the database has Cloudflare Time Travel, its restore-to-an-earlier-moment backup; check how long it keeps data);
  - a contact or report route (today you can only block someone);
  - a plain "run by one person as a hobby; export now and then" line.
- **Growth:** strangers have little reason to come back and no way to invite friends.
- **Running costs and focus:**
  - Too many features for one person to keep working; freeze new looks and decoration.
  - Set a cap on photos and a Cloudflare billing alert.
  - Read Cloudflare's acceptable-use terms once. Every passkey is tied to the current address (D11), so moving would be painful.
- **If deciding today:**
  1. Help users carry less risk.
  2. Add the basics a public service needs.
  3. Give people a reason for a second visit.

  Otherwise it stays "a beautiful app for Anton and his mates", which is fine if that's the goal.

## Checked and set aside
- **"Still on dev" (App developer, on Value for money):** out of date. D66 and D67 are live in 0.57.1. The finding itself stands (Quick win 2).
- **mm/dd/yyyy date box (raised by four reviewers):** the page is marked `lang="en-GB"` (checked), so this is very likely Chromium in the screenshot set-up. It's a check on the iPhone, not a bug. Marketing's "set the page language to en-GB" is already done.
- **"Make supplier and price optional" (Investor):** they already are. A purchase is optional, and Supplier can be left blank (checked). Only the labelling suggestion remains.
- **Wedding Cake is "Hybrid" on the welcome screen but "Indica" on 10 (Marketing):** the review account is made-up data, so they don't need to match.
- **Save bar floating mid-form in 06-add-product-empty-full:** an effect of photographing the whole page at once, not a bug. The real keyboard-and-Save-bar behaviour still needs an iPhone check (App developer).
- **Home Screen name "Green Tracker" cut off (Marketing):** a guess (not checked). Look at Anton's Home Screen before changing anything.
- **The four looks barely differ (Marketing):** a matter of taste, judged from still pictures. The moving lights may make the difference clear on the phone. Not ranked.
- **The "S" circle repeating the Settings card (App developer):** minor. Not ranked.

## Suggested to-do list
1. Ask before discarding a new or edited product (Cancel and swipe-back).
2. Value for money clean-up: the per-20mg note on Value for money rows, "VFM" renamed, and the edible line reworded so it makes no effect claim.
3. Source and privacy wording: the Privacy line, a "followers can see this" note in the editor, and the Export warning.
4. Words pass: "More" → "Settings", "doesn’t/don’t", capitals, type names, Leafly placeholder, the rest of the table.
5. Small layout fixes: room under the + button, no zero-stats card on an empty Log, "Create account" as the main welcome button.
6. Save that can't hang or make a duplicate, then keep a half-filled product if the app closes.
7. Add-a-product order: Photos near the top, optional details folded away (mockups first).
8. Decide on the trust basics for strangers: 18+ tick, a privacy notice with a contact address, and whether Source starts switched off.

**To check on Anton's iPhone:** the date box order, typing in Notes, Leafly and Amount with the Save bar showing, the Home Screen label, how the sliders feel, and whether scrolling stays smooth on a long Leaderboard.
