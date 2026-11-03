# Sam, the everyday user: the app and the website (2026-11-03)

## Part 1: the app

### Overall verdict

The app's got more fun since last time. The Feed is the first thing in here that gives me a reason to open it when I haven't bought anything. A post with my Wedding Cake card under the photo ("9.1 OVERALL", 18b-post) is exactly what I'd send my mates anyway, and now it stays in the app. Seeing Jess's board in her own look is a lovely touch, and the light looks are properly readable. But the bit I do every time I buy something hasn't changed at all. The add-a-product form is the same long scroll with Photos sixth, Cancel still throws everything away without asking, and Value for money is still "1.67 VFM" with a gummy at #1 showing "£0.25/mg". The comparing-with-mates gap I flagged last time is still there, and the Feed makes it more obvious: Jess can post about something I've rated and nothing says "you gave this a 9.1". The one new thing that actually worries me is sign-up. It now wants my email and a password, and there's no "Forgot password?" anywhere. If I tap "Not now" on Face ID and forget my password after a session, my whole stash is gone.

### Findings (most important first)

#### 1. Forget your password and you're locked out for good, and nothing warns you
- **What:** Sign-up now asks for an email and password (D80). There's no "Forgot password?" link on the sign-in screen, and the Face ID step lets you tap "Not now" without saying that Face ID is your only backup.
- **Where:** 01b-login (Email, Password, Sign in, "or", Sign in with Face ID, nothing else), 04-signup-faceid ("Not now"). I searched `client/src` and "forgot" doesn't appear anywhere. CLAUDE.md's to-do list confirms that "a forgotten password with no Face ID can't be recovered".
- **Why it matters:** Forgetting a password is a when, not an if, for people like me. Someone who skipped Face ID loses every rating, photo and price, with no way back, and won't even know until it happens. That's the kind of thing that makes someone slag an app off to their mates.
- **Suggestion:** Until real reset emails exist:
  - On 04, under "Not now", add: "Without Face ID, a forgotten password can't be recovered yet."
  - Add a "Forgot password?" link on 01b that says honestly what to do: "Sign in with Face ID if you set it up. Otherwise we can't reset it yet."
  - Remind people now and then to Export.
  - This doesn't reopen D80, it just says what D80 means.
- **Size:** Big / Quick

#### 2. Giving my email to a weed app needs a reason
- **What:** Last time "no email, no phone number" was the biggest trust win. Now the first sign-up screen asks for an email, and all it says is "Your email is private. Nobody else ever sees it."
- **Where:** 02-signup-email, 25-email.
- **Why it matters:** My first thought is "why do they want this, and will they ever email me something with 'cannabis' in it?" The privacy line is good, but it doesn't answer that. Some people will put in a throwaway address, which is fine today but will bite them once password resets by email arrive.
- **Suggestion:** Add one line on 02: "Only for signing in. We don't send you anything, and nobody else sees it." When email resets do arrive, tell people once that the address has to be one they can actually get into.
- **Size:** Medium / Quick

#### 3. Friends: still no "you vs them", and the Feed makes the gap obvious (still open from 26 Oct)
- **What:** Jess has Wedding Cake at 8.0 and I have it at 9.1. Her product page, her board and any post about it never mention my score.
- **Where:** 17-friend, 17b-friend-product-full, 18b-post (the post's product card).
- **Why it matters:** "What did my mate think of it?" is now the main reason to scroll the Feed. A post card that said "You: 9.1" when I've had the same thing would start the banter by itself, and it's what would make me open the app daily.
- **Suggestion:** On a friend's product page and on a post's product card, when I have a product with the same name, add a small line: "You rated this 9.1 →". It reuses the name matching from D59 and shares nothing new.
- **Size:** Big / Some work

#### 4. Adding a product can still lose everything (still open from 26 Oct)
- **What:** Cancel only asks "Keep editing / Discard" when you're moving a Log entry over. On a new product it just throws it all away.
- **Where:** 06-add-product-empty; `client/src/screens/Editor.tsx` (the Discard sheet is only on the Log path, around line 532).
- **Why it matters:** At night, one-handed, a stray tap on Cancel (top left, right where your thumb goes for "back") wipes five ratings and photos. Do that once and I'd stop logging.
- **Suggestion:** Ask before discarding whenever anything has been changed, on Cancel and on swipe-back.
- **Size:** Big / Some work

#### 5. The add-a-product form hasn't changed: photo last, homework first (still open from 26 Oct)
- **What:** The order is still Basics, Classification, Origin, Ratings, Purchases, then Photos, Notes, Leafly, Private. Other points from last time are also still there:
  - Country and Strain type still sit near the top.
  - The Source box still says "Source/Brand".
  - The Leafly hint is still cut off ("…to search by").
  - The sliders still move in 0.1 steps with a hidden "tap to type".
- **Where:** 06-add-product-empty-full.
- **Why it matters:** This is the bit I do every single time, and it's the chore that made me drop other apps. Meanwhile the new Post screen (18c) is three big buttons and done, so the add form now feels like the old part of the app.
- **Suggestion:** Order it Photos, Name and Type, Purchase, then Ratings. Fold Country, Strain type and Leafly under "More details". Add − / + buttons beside each score, or show "tap to type" as visible text. Mock it up first, since it's a visual change.
- **Size:** Medium / Some work

#### 6. Value for money is still a bare number, and the gummy still "wins" (still open from 26 Oct)
- **What:** Ranked by Value for money, the rows say "1.67 VFM", "1.28 VFM", and Peach Rings Gummies is #1 with "£0.25/mg" next to flower at £6.00/g.
- **Where:** 11-rank-by-vfm. The product page still says "Overall ÷ latest £/g".
- **Why it matters:** "What's best for the money?" is half the reason I use this, and right now it reads like a bug.
- **Suggestion:** Under Value for money, show "£5.00 per 20mg" on the edible's row, as already happens under Price. Rename "VFM" to "Value" or "points per £".
- **Size:** Big / Quick

#### 7. Source is still described as "where you got it", and now it travels on posts too (still open from 26 Oct)
- **What:** Privacy still says "Source: Where you got it, e.g. Cookies." A post's product card shows the Source to followers ("Jungle Boys" on 18b), and "Posts are always shared with your followers."
- **Where:** 24-privacy, 18b-post, 06 (the "Source/Brand" box).
- **Why it matters:** If someone types their dealer's name into Source, it now ends up on a post as well as on the product page. In the UK, "where you got it" is often a person.
- **Suggestion:** Reword it to "The brand or grower, e.g. Cookies. Shops and dealers go in Supplier, which is never shared." Add a small "Followers can see this" under the Source box.
- **Size:** Big / Quick

#### 8. On the Feed, the + makes a post; everywhere else it adds a product
- **What:** The round + is the same everywhere, but on the Feed it's "New post" (`Feed.tsx` line 154), while on the Leaderboard it's Add a product.
- **Where:** 18-feed vs 10-leaderboard.
- **Why it matters:** I just bought something, I'm on the Feed because a mate posted, I hit + to add my new bag, and I get "What's this about?" instead. A bit stoned, that's a "huh?" moment.
- **Suggestion:** Give the Feed's button a camera or pencil icon instead of +, or a label ("Post").
- **Size:** Small / Quick

#### 9. Comments start hidden under the comment box
- **What:** On a post, the first comment ("@jessjcnh Need to try this one") sits behind the see-through comment bar, so you see its words faintly through "Add a comment…".
- **Where:** 18b-post and 18b-post-full.
- **Why it matters:** It looks broken, and you might think nobody's commented when someone has. The screen can scroll further, so it's mostly cosmetic, but it's the first thing you see on a post.
- **Suggestion:** Make the comment bar solid, or tighten the space between the photo and the card so the first comment shows on the first screenful. Even a "1 comment ↓" hint would help.
- **Size:** Small / Quick

#### 10. Export and Delete account don't mention posts
- **What:** Delete's "What goes" list and Export's "In the file" list name products, Log, photos, followers and settings, but not posts, comments or 🔥. The code does delete them, and the changelog says Export includes them.
- **Where:** 31-delete, 27-export (`migrations/0017_posts.sql` deletes posts along with the account).
- **Why it matters:** "If I delete, do my posts and comments on mates' posts go?" is the first thing I'd wonder. The list not saying so makes me unsure.
- **Suggestion:** Add "Your posts, comments and 🔥" to both lists. Also add last round's Export warning that the file isn't locked (still open from 26 Oct).
- **Size:** Small / Quick

#### 11. Fifteen looks, ten colour sets, three tops: choosing is guesswork
- **What:** The Look page shows each look as a tiny "9.3" chip. Leaderboard colours has its own preview with three made-up rows. You can't see your actual board in a look before you pick it, and some names appear in both lists (Deep Sea, Aurora).
- **Where:** 21-look, 21c-colours, 21b-top.
- **Why it matters:** I love the looks (Outrun with the grid is mint), but with roughly 450 possible combinations I'd flip back and forth between Settings and the Leaderboard to find the right one. That's a chore in the one part that's meant to be fun.
- **Suggestion:** Tap a look to preview it on your own Leaderboard behind a "Use this / Back" bar, or offer a handful of ready-made combos ("Outrun + Synthwave"). When a look and a colour set share a name, show them as a matching pair.
- **Size:** Medium / Some work

#### 12. The + still covers a score in the big-hero layouts (still open from 26 Oct)
- **What:** With the glass hero, the + sits on the 5th row's "OVERALL" ("OVER…") in every look. On the default Slim strip it now only touches row 6's corner.
- **Where:** 40-look-daymint, 40-look-outrun (and the other 40-look screens).
- **Why it matters:** It's the first screen you see, and anyone who picks the big hero gets the clumsy version.
- **Suggestion:** Add bottom space under the list (last round's quick win 5), or pull the score column in on rows that pass under the button.
- **Size:** Small / Quick

#### 13. Still no "is this better than last time?" (still open from 26 Oct)
- **What:** Price history lists £11.43/g and £12.86/g but doesn't say "£1.43/g cheaper than last time". There's also no "+0.6 vs your flower average".
- **Where:** 12-product.
- **Why it matters:** Batches vary. That one line would make me log every re-buy.
- **Suggestion:** Add one line under Overall and one under the latest price.
- **Size:** Medium / Some work

#### 14. Smaller things
- **Welcome screen:** "Sign in" is still the big green button and "Create account" the dull one (still open from 26 Oct, quick win 8). Strangers are the ones who see this screen. Small / Quick.
- **People:** it's now an unlabelled icon in the Feed's top-left, where my thumb expects "back". The requests badge helps, but a new user won't find "Find people" except from the empty Feed. Small / Quick.
- **Header cut off:** "Leaderboard col…" (21c-colours). Small / Quick.
- **Top stats ignore Rank by:** ranked by Value for money, the strip still leads with "7.9 average" (still open from 26 Oct). "Best value: Amnesia Haze" would be better. Small / Some work.
- **Product badge:** it says "Amethyst · #1 on your Leaderboard". "Amethyst" means nothing to me; "#1 on your Leaderboard" alone is enough (still open from 26 Oct, words table). Small / Quick.
- **Empty Log:** it still shows "0 products · 0 countries · 0g" (still open from 26 Oct). Small / Quick.

### What's already great (don't break these)
- **The Feed and posts.** Photo, caption, the product card with its score, the 🔥, several photos with "1/2" and dots. Followers only, and no prices or suppliers on the card (I checked `server/routes/posts.ts`). This is the daily-habit feature.
- **Friends' pages in their own look** (17-friend). It feels like visiting their room, not a spreadsheet.
- **The light looks.** Daylight Mint (40-look-daymint) is clean and readable, and the light score cards look classy. It's good for smoking in the garden in summer.
- **Outrun, Sakura and the rest.** Still gorgeous, and the product page in Sakura is a proper show-off screen.
- **Face ID offered once and optional, and "Your email is private" said up front.** Calm and clear.
- **Delete account** still offers Export first and asks you to type your username.
- **Tapping a row's photo opens it full screen** (D79). I couldn't see it in the screenshots, but going by the description it's exactly what I want when showing a mate.

*Limits: Chromium screenshots and made-up data only. I couldn't try the photo viewer, Face ID, iCloud Keychain saving the password, or how the sliders feel on a real iPhone.*

## Part 2: the website

### Overall verdict

The site still looks expensive and still talks like me. The new how-to video above the install steps is a big help: it's exactly what I'd send a non-techy mate. But apart from the video, the page hasn't caught up with the app. It sells the app as it was a fortnight ago. It doesn't mention the Feed and posts (now the most social bit), it doesn't show any of the 15 looks, and it says nothing about what sign-up now asks for. Last round's hero fixes are still waiting too.

### Findings

#### 1. Nothing about what sign-up asks for
- **What:** The app now needs an email and password, but the site never says that the email stays private, that Face ID is optional, or that it's free with nothing sold.
- **Where:** Hero badge "Free · made for iPhone · no ads", footer "Your stash is your business" (home.txt).
- **Why it matters:** Last round's advice ("no email, no phone number") is now wrong, so nothing on the page answers "what am I handing over?". For a weed app, that's the question that decides whether people sign up.
- **Suggestion:** Under Sign up free, add: "Just an email and password. Your email stays private, and Face ID is optional." Keep it in step with the app's wording (Part 1, finding 2).
- **Size:** Big / Quick

#### 2. The Feed isn't on the site
- **What:** "Peep your mates' picks" only mentions seeing friends' top shelf. Posts, comments and 🔥 aren't mentioned anywhere.
- **Where:** Fourth feature card.
- **Why it matters:** "My mates post what they're smoking and I can fire it" is what gets a group chat to sign up together.
- **Suggestion:** Rewrite the card: "See what your mates are smoking. Post your bud, get a 🔥, start the chat. Only people you approve." A tiny drawn post card would sell it even better. Swap "Peep" for "See" while you're there (still open from 26 Oct).
- **Size:** Medium / Quick

#### 3. It still doesn't show the looks (still open from 26 Oct, and stronger now)
- **What:** There are 15 looks including light ones, plus 10 colour sets, and the site only shows Aurora.
- **Where:** Hero, feature cards.
- **Why it matters:** For people like me and Anton, making your stash look nice is half the fun. A strip of four little phones (Aurora, Outrun, Sakura, Daylight Mint) would sell it in a second.
- **Suggestion:** Add a "Pick your look" strip with made-up rows.
- **Size:** Medium / Some work

#### 4. The hero chip still says "value for money" for a price, and still covers 8.8 (still open from 26 Oct)
- **What:** "£9.50/g · value for money" sits on top of Gushers Rosin's score.
- **Where:** phone-home.png (bottom right), laptop-home, share-picture.
- **Why it matters:** It's the first thing you see, and a hidden score on a leaderboard looks like a mistake.
- **Suggestion:** Relabel it "£9.50/g · price", move it off the scores, and redraw the share picture. Also change "All · Score" to "All · Overall".
- **Size:** Medium / Quick

#### 5. Opening the link from WhatsApp or Instagram (still open from 26 Oct)
- **What:** Step 1 still just says "Open it in Safari", with nothing for people who tapped the link inside WhatsApp or Instagram.
- **Where:** "Get it", step 1.
- **Why it matters:** The password helps, since signing up no longer needs Face ID in the right browser. But Add to Home Screen still only works from Safari, and a mate's link opens inside WhatsApp. **Check on a real iPhone.**
- **Suggestion:** Add one line: "Opened this from WhatsApp or Instagram? Tap ⋯ and choose Open in Safari first."
- **Size:** Medium / Quick

#### 6. The address in the Safari drawing is still wrong (still open from 26 Oct)
- **What:** The drawing shows `green-tracker.workers.dev`, but the real app is at `green-tracker.green-tracker.workers.dev`.
- **Where:** Step 1 picture.
- **Why it matters:** It's a trust wobble at the exact moment someone's deciding.
- **Suggestion:** Draw the real address, or leave it out of the drawing.
- **Size:** Small / Quick

#### 7. Three different times
- **What:** "On your iPhone in 20 seconds", the video's "24 seconds", and "Takes a minute" further down.
- **Where:** "Get it" heading, the video caption, the final section.
- **Why it matters:** It's small, but it looks careless right next to the video that proves the point.
- **Suggestion:** Use one number, for example "About 30 seconds" everywhere.
- **Size:** Small / Quick

#### 8. 18+ and "nothing is sold here" (still open from 26 Oct; reopens D63)
- **What:** There's still no adults-only line and nothing saying the app doesn't sell or supply anything.
- **Where:** Footer.
- **Why it matters:** One line makes it clearly a personal diary, and it matters more now that strangers can post to each other.
- **Suggestion:** Add to the footer: "For adults. A personal diary: nothing is bought or sold here." It reopens D63, so it's Anton's call, together with the app.
- **Size:** Small / Quick

### What's already great
- **The how-to video** (D68): it plays only when tapped, has captions, and the written steps now mention ⋯ and View More. It's exactly what a non-techy mate needs.
- **The headline, the glow and the holo rows.** It still looks like a proper app's site.
- **The tone and the rate-it slider** ("Fire.", "1 · bin it / 10 · top shelf").
- **Nothing loaded from elsewhere and made-up products only.** Keep that when adding looks or a post picture.

*Limits: Chromium screenshots only. The WhatsApp and Instagram browsers, the video playing, and the real link preview need checking on Anton's iPhone.*

**Files referred to:** /home/user/green-tracker/client/src/screens/Editor.tsx, /home/user/green-tracker/client/src/screens/Feed.tsx, /home/user/green-tracker/client/src/screens/PostPage.tsx, /home/user/green-tracker/client/src/styles.css (lines 1953–1970), /home/user/green-tracker/server/routes/posts.ts, /home/user/green-tracker/migrations/0017_posts.sql, /home/user/green-tracker/site/public/index.html, screenshots in /home/user/green-tracker/.playwright/review/app/ and /home/user/green-tracker/.playwright/review/site/.