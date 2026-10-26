# Sam's review: Green Tracker app (26 Oct 2026)

## Overall verdict

Honestly, this is the first strain app I'd actually keep. It looks lush: Aurora Glass with the coloured cards (violet for the 9s, teal, green, olive as the scores drop) makes my stash feel like a trophy cabinet, not a spreadsheet. Ranking is properly good: one tap to flip between Overall, Price and Value for money, and the product page tells me my price history and where I bought it. Where it falls down is the bits around the edges. Adding a product is a long scroll, and the photo, the thing I'd do first, sits near the bottom. The value-for-money numbers are just numbers with no meaning I can feel. And friends are a dead end: I can look at Jess's board, but the app never says "you both had Wedding Cake, she gave it 8.0, you gave it 9.1", which is the conversation we'd actually have. There's also one privacy thing that would make me nervous as a UK smoker (number 1 below). Fix that and the comparing, and I'd be telling my mates to get on it.

## Findings (most important first)

### 1. "Source" is shared with followers by default and described as "where you got it"
- **What:** Settings → Privacy describes Source as "Where you got it, e.g. Cookies.", and it's switched on for every new account. The add-product form's Source box says "Source/Brand" and doesn't say followers will see it.
- **Where:** 24-privacy, 06-add-product-empty (Source field); `client/src/screens/Privacy.tsx` line 31; `migrations/0007_privacy.sql` (`share_source ... DEFAULT 1`). SPEC D59 says the owner types the coffeeshop's name into Source when there's no brand.
- **Why it matters:** In the UK, "where you got it" for a lot of people is a person: "Dave", "the lad from work". If someone types their dealer's name into Source, every follower sees it on the product page and can tap it. Prices and suppliers are carefully kept private (good), but this one field undoes that for the most sensitive bit. It would put strangers off signing up, and that's the public Anton wants.
- **Suggestion:** Change the Privacy wording to "The brand or grower, e.g. Cookies. Shops and dealers go in a purchase's Supplier, which is never shared." Add a small "Followers can see this" hint under the Source box on the form. Think about starting new accounts with Source off. (The option stays; only its starting setting changes, so D45 and D59 aren't reopened.)
- **Size:** Big / Quick

### 2. Value for money is a bare number nobody understands
- **What:** Ranked by Value for money, rows show "1.67 VFM", "0.80 VFM". The only explanation, "Overall ÷ latest £/g", is on each product page.
- **Where:** 11-rank-by-vfm, 12-product, 12b-product-edible.
- **Why it matters:** "What's the best for the money?" is half the reason I'd use this. A 1.28 against a 0.96 means nothing in my head. I can see the order but not how big the gap is, and I can't explain it to a mate.
- **Suggestion:** Say it in pounds or points. For example, under the number on the row, "£4.69 per point", or show it as "Overall 7.7 for £6/g". Or relabel VFM as "points per £". Even a small "?" by "Rank: Value for money" that opens a one-line explanation would help.
- **Size:** Medium / Some work

### 3. An edible tops Value for money and its row says "£0.25/mg"
- **What:** Under All, ranked by Value for money, Peach Rings Gummies is #1 and its row shows "£0.25/mg" next to flower at "£6.00/g". The "per 20mg" note only appears when ranking by Price.
- **Where:** 11-rank-by-vfm (row 1), 10-leaderboard (row 4).
- **Why it matters:** At a glance £0.25/mg reads like £250 a gram, and a gummy winning "best for the money" over my flower looks like a bug, not a decision. I'll stop trusting the list. (I'm not arguing with the 20mg = 1g rule, D67. It just needs showing.)
- **Suggestion:** Under All, also show an edible's "£5.00 per 20mg" on its row when ranking by Value for money, the same as you already do under Price. Better still, add a tiny "≈ 1g of flower" tag.
- **Size:** Medium / Quick

### 4. Friends' boards are a dead end: no "you vs them"
- **What:** Jess has Wedding Cake at 8.0 and I have it at 9.1, but neither her board nor her product page mentions it. There's no feed of what mates added lately, and her product page has only her scores and photo.
- **Where:** 17-friend, 17b-friend-product, 16c-people-following.
- **Why it matters:** "What did my mate think of it?" and "is mine better than theirs?" are the fun bits. Right now I'd check a friend's board once, then never again, because nothing tells me there's anything new.
- **Suggestion:** (a) On a friend's product, add a line "You rated this 9.1 →" when you have the same name (name matching already exists from D59). (b) On People, a simple "New from people you follow" list (name, score, when). (c) Maybe an optional one-line review followers can see. Notes are rightly private (D45), but a separate short "verdict" line I choose to share would add the banter.
- **Size:** Big / Some work (a) / Big job (b, c)

### 5. Photos come last when adding a product
- **What:** Order on the form: Basics, Classification, Origin, Ratings, Purchases, **Photos**, Notes, Leafly, Private. The photo box is about 1,300px down the page.
- **Where:** 06-add-product-empty-full, 13-edit-product-full.
- **Why it matters:** When I pick something up, the first thing I do is snap the bud, and I rate it later once I've smoked it. Scrolling past a big ratings block to find the camera is the kind of chore that made me drop other apps, especially at night, one-handed.
- **Suggestion:** Put Photos straight under Name (or make the top of the form the big photo, like the product page's hero), and Purchases next. Ratings can go lower, since they're often filled in a day later.
- **Size:** Medium / Quick

### 6. The rating sliders are fiddly one-handed, and typing a score is hidden
- **What:** Each slider runs 1–10 in steps of 0.1, about 90 positions across one phone width. You can tap the "—" to type a number, but nothing says so.
- **Where:** 06-add-product-empty (Ratings); `client/src/components/inputs.tsx` (`step={0.1}`, the "Tap to type a value" button is only described for screen readers).
- **Why it matters:** Landing on 8.5 rather than 8.3 with a thumb, a bit stoned, is hard. Five sliders like that is the most annoying part of adding a product. (Needs checking on a real iPhone. Chromium can't show how it feels.)
- **Suggestion:** Show "tap to type" as visible hint text the first time, or put small − / + buttons beside each score. Or make the slider snap to whole numbers and have − / + nudge by 0.1.
- **Size:** Medium / Quick

### 7. Dates show as American mm/dd/yyyy in the form
- **What:** "Date tried" shows "mm/dd/yyyy" when empty and "10/02/2026" when filled, while the product page shows "2 Oct 2026".
- **Where:** 06-add-product-empty, 13-edit-product-full.
- **Why it matters:** As a Brit I'd read 10/02 as 10 February. It's probably just Chromium running in US English for the screenshots, and a UK iPhone may show it properly. **Check on a real phone.**
- **Suggestion:** If the iPhone shows it the UK way, nothing to do. Also consider filling Date tried with today by default, since you're usually adding it the day you try it.
- **Size:** Small / Quick

### 8. The + button covers the 5th row's score
- **What:** On the Leaderboard's first screen, the round + sits on top of the 5th product's "OVERALL" label ("OV…"). The same happens in every look.
- **Where:** 10-leaderboard, 40-look-neon, 40-look-pearl, 40-look-forest, 41-top-strip.
- **Why it matters:** It's the first thing you see every time you open the app, and it looks a bit clumsy on an otherwise polished screen.
- **Suggestion:** Pull the score column in a little on rows that pass under the button, or shrink or nudge the button. Fine to leave if it's only ever covered while scrolling.
- **Size:** Small / Quick

### 9. The big stats card wastes space, and doesn't change with Rank by
- **What:** Glass hero has a chunk of empty space under "Your #1 · …". When ranked by Value for money it still leads with "AVERAGE 7.9", which isn't what I'm looking at.
- **Where:** 10-leaderboard, 11-rank-by-vfm, 17-friend.
- **Why it matters:** The first screen is prime space. On Value for money I'd love to see "Best value: Amnesia Haze, £6/g" up there instead.
- **Suggestion:** Tighten the bottom padding. When ranked by Price or Value for money, show the matching headline (cheapest per gram, average £/g, best value). The Slim strip (41-top-strip) is a nice fix for people who want rows; maybe point people to it.
- **Size:** Small / Some work

### 10. No quick "is this better than last time?"
- **What:** When I rebuy or rate a new batch, nothing compares it to my last one, or to my average for that type or brand.
- **Where:** 12-product (Price history shows price only); 15b-brand has averages but you have to go looking.
- **Why it matters:** "Is this better than last time?" is a big one for me. Batches vary, and if the app answered it I'd log every bag.
- **Suggestion:** On a product page, add a small line under Overall, such as "+0.6 vs your flower average" or "Your best from Jungle Boys". Price history could show "↓ £1.43/g cheaper than last time" (the numbers are already there).
- **Size:** Medium / Some work

### 11. A few questions I'd never know the answer to
- **What:** Country (where it was grown) and Strain type (Indica/Sativa) sit high on the form. For UK street or club stuff I rarely know either for sure, and both default to "Not set".
- **Where:** 06-add-product-empty.
- **Why it matters:** They take up the first screen and make the form feel like homework. They're fine to skip, but they look required.
- **Suggestion:** Keep them, but group them lower as "Details (optional)", or tuck them behind "More details". Keep only Name, Type and Photo up top.
- **Size:** Small / Quick

### 12. The Leafly box's hint is cut off and very US-centric
- **What:** The placeholder reads "Paste a link, or leave empty to search by" and stops there. Leafly is mostly a US thing.
- **Where:** 06-add-product-empty-full, 13-edit-product-full.
- **Why it matters:** It's minor, but it's the kind of half-sentence that makes an app feel unfinished.
- **Suggestion:** Shorten it ("Optional link") and say the rest underneath, or move Leafly into the optional "More details" group from 11.
- **Size:** Small / Quick

### 13. Things I'd want to record that aren't there
- **What:** No "would buy again" yes/no, and no quick effect or vibe tags (sleepy, giggly, creative, couch). Notes is the only free space.
- **Where:** 06-add-product-empty-full.
- **Why it matters:** "Would I buy it again?" is the one-tap answer I'd actually use when I'm at my supplier deciding. Tags would make my stash searchable ("what's good for sleep?") and give friends something to look at.
- **Suggestion:** Add a "Buy again?" switch, shown as a small badge on the row and countable on brand pages. Effect tags could come later. (New data, so it's Anton's call, with export and followers to think about.)
- **Size:** Medium / Some work

## What's already great (don't break these)

- **The looks.** Aurora Glass is gorgeous, Neon Night's hot-pink #1 is a laugh, and Holo Pearl's rainbow numbers look classy. Score colours on the cards make the board readable at a glance. The Appearance screen with a live preview is spot on (21-appearance).
- **The product page.** The big photo, the big score, the "Violet · #1 on your Leaderboard" badge, rating bars, and price history with per-gram prices and "LATEST". It's exactly what I'd want to show off (12-product).
- **Rank by and Type with the iPhone's own pickers.** Fast and familiar.
- **Price per gram worked out for me**, from "7g · £80.00". I never have to do maths.
- **Privacy basics.** Prices, suppliers, notes and the Log are never shared, there's a "what followers see" preview (24b), and follows need approving. That's what makes me comfortable having mates on it. Fix number 1 and it's solid.
- **Passkeys and no email.** Signing up without handing over an email or phone number is a big trust win for a weed app.
- **Typing suggestions for Source and Supplier** (D59), so I'm not typing "Greenleaf Club" every time.

*Limits: I only had the screenshots (Chromium standing in for Safari, made-up data). How the sliders feel, the date format, the + button and the pickers all need checking on a real iPhone.*
