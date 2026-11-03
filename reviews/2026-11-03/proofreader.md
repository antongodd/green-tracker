# Proof-reader: the app and the website (2026-11-03)

## Part 1: the app

**Overall verdict.** The new wording is mostly good. The sign-up screens are short and warm ("Your email is private. Nobody else ever sees it.", "Sign in with a glance instead of typing your password."). The new error messages say what to do next ("There’s already an account with that email. Sign in instead."). Curly apostrophes are used throughout the new code. The weak spot is **accuracy**: several older sentences were not updated when posts (D77), "their look" (D74) and email and password (D80) arrived, so they now say things that aren't true. Three of these are about privacy or deleting your data. Almost every slip from my 26 Oct report is still there: none of the 17 has been fixed except the Delete-account passkey line (finding 14), which went with D80. Limits: these are Chromium screenshots with made-up data. Placeholders and sheets I checked in the code, not on screen.

### Findings

**1. The Appearance pages say friends' boards show in *your* look, but since D74 they show in *theirs***
- **What:** This footnote is on all three pages: "Saved to your account, so it follows you to a new phone. Friends’ boards show in your look too." Leaderboard top and Leaderboard colours have the same sentence with "top" and "colours". The Leaderboard top page also says: "The Log, friends’ boards and brand pages use it too."
- **Where:** 21-look, 21b-top, 21c-colours (`client/src/screens/Appearance.tsx` lines 213 and 277).
- **Why it matters:** It's the opposite of what happens (SPEC 0.64.0: a friend's pages are in "their Look, Leaderboard top and colours"). It also hides a fact people care about: followers see *your* choice.
- **Suggestion:** "Saved to your account, so it follows you to a new phone. Your followers see your board in it too." On the top page: "The Log and brand pages use it too."
- **Size:** Medium · Quick.

**2. Privacy and the People messages still say followers see nothing but your Leaderboard, but posts and Log entries can now be shared**
- **What:**
  - 24-privacy: "Off: followers see nothing but your name."
  - "…Prices, purchases, suppliers, notes, date tried, Leafly links and your Log are never shared." But a post can be about a Log entry, and followers see its name and type (Composer: "Followers see only its name and type.").
  - "A product you’ve made Private stays hidden whatever these say." But "Make visible and post" turns Private off.
  - The new line "Posts are always shared with your followers." sits on its own underneath and contradicts the lines above it.
  - People and Person still talk only about the board: "People who follow you see your leaderboard, never your Log, prices or notes." (Followers, empty), "You’ll need to request again to see their leaderboard." (Unfollow), "They stop seeing your leaderboard straight away." (Remove follower), and the block messages ("…or see your leaderboard").
- **Why it matters:** These are privacy promises. Someone who turns off "Share my Leaderboard" may think followers see nothing at all.
- **Suggestion:**
  - "Off: followers see only your name and your posts."
  - Footnote: "…and your Log are never shared, except what you choose to post. Posts are always shared with your followers."
  - Followers empty state: "People who follow you see your Leaderboard and posts, never your prices or notes."
  - Unfollow: "…to see their Leaderboard and posts."
  - Block: "…or see your Leaderboard and posts."
- **Size:** Big · Quick.

**3. Export, Restore and Delete don't mention posts**
- **What:**
  - Export's "In the file" list leaves out posts, though the file does include them (`backup.ts`).
  - Delete's "What goes" list leaves out posts, comments and fires, though they are deleted (`server/routes/data.ts` line 331).
  - Restore says "Replaces your products, Log and photos with an export file. Followers and passkeys stay as they are." Posts are replaced too, and your email and password also stay.
- **Where:** 27-export, 28-restore, 31-delete (`Data.tsx` lines 81–101, 192, 306–327).
- **Suggestion:**
  - Export: add "Your posts" with the small line "not comments or fires on them".
  - Delete: add "Your posts, and your comments and fires on others’".
  - Restore: "Replaces your products, Log, photos and posts with an export file. Your email, password, passkeys and followers stay as they are."
- **Size:** Medium · Quick.

**4. Nothing tells you what to do if you forget your password**
- **What:** Neither the sign-in screen (01b) nor sign-up (02) says what happens if you forget your password. There's no "Forgot password?" link, which is honest, because there's no reset yet (to-do item 2). But nobody is told that.
  - Changing the password needs the current one (`account.ts` line 136).
  - Deleting your account needs it too.
  - So even someone who can still get in with Face ID can't set a new password.
  - The old-account screen ("Add an email and password") also says "Recovery codes are gone, so you don’t need to keep them any more" without saying what replaces them.
- **Why it matters:** A stranger who forgets it is locked out with no explanation.
- **Suggestion:**
  - Under the sign-up password: "Pick one you’ll remember: there’s no reset by email yet." Saying "Face ID can still sign you in" is also true.
  - Sign-in: a small line "Forgotten it? Sign in with Face ID if you set it up."
  - Whether a reset should exist isn't for me to decide (to-do item 2). This is only about saying how things stand.
- **Size:** Medium · Quick.

**5. Settings still names a tab that no longer exists, "More"** (still open from 26 Oct)
- "You can undo this in **More** → Blocked people." (`People.tsx` line 268)
- "…you can un-archive it from **More** → Archive." (`Profile.tsx` line 353)
- **Suggestion:** "Settings → Blocked people" and "you can bring it back from Settings → Archive."
- **Size:** Medium · Quick.

**6. "Un-archive" is in new messages too, and one of them has a grammar slip**
- **What:** New server message: "Archived products can’t be posted. Un-archive it first." This mixes plural "products" with singular "it". The Log has "Un-archive it first." (`log.ts` line 182), and the button says "Un-archive" (Profile, Archive).
- **What else:** The new post picker says "Archived products and ones returned to the Log aren’t listed: post their Log entry instead." An archived product has no Log entry, so that advice is wrong for archived products.
- **Suggestion:**
  - Server message: "This product is archived. Bring it back from Settings → Archive first."
  - Button: "Bring back" (or "Unarchive").
  - Picker: "Archived products aren’t listed. For one you’ve returned to the Log, post its Log entry instead."
- **Size:** Small · Quick.

**7. Plurals: "1 products" and "1 comments"**
- **What:**
  - 15b-brand shows "**1 products** · 9.1 average · £125.00 spent". The stat label is always "Products" (Brands, Leaderboard, Person, Log tiles), so any board with one product, or a Log with one country ("1 countries"), reads wrongly.
  - On a post's own page, the hidden label for VoiceOver reads "1 comments" (`PostCard.tsx` line 312). The Feed version gets the plural right.
- **Suggestion:** "1 product", "1 country", and use the same `=== 1` check on the post page.
- **Size:** Small · Quick.

**8. The comment on a post's page is hidden under the comment box**
- **What:** On 18b-post (and -full), the only comment, "Need to try this one", is drawn behind the "Add a comment…" bar. You can see its letters through the placeholder, and its author line is covered too.
- **Why it matters:** The words overlap and can't be read. The comment is the point of that screen.
- **Suggestion:** Leave space under the list for the fixed bar (bottom padding the height of the bar). Check on an iPhone with the keyboard up.
- **Size:** Medium · Quick.

**9. Capitals on "Leaderboard" and "Log" still wander, and new code adds more** (still open from 26 Oct)
- Older: "Add to leaderboard" (14c, `LogEntry.tsx`, `Editor.tsx` 334), "Add a log entry" (05b and the + button), "New log entry", "Save to log" (14b), "Your log entry stays as it was.", "View leaderboard", "Follow to see their leaderboard." (server `people.ts` 189 and `Person.tsx`).
- New: "Follow to see their leaderboard and posts." (`Person.tsx` 145), "That log entry doesn’t exist." (`posts.ts` 392), "…log entry / log entries…" in the Restore confirmation (`Data.tsx` 255).
- The new code gets it right elsewhere: "Your Leaderboard", "Something in my Log", "In the Log".
- **Suggestion:** Capital L every time: "Add to Leaderboard", "Add a Log entry", "Save to Log".
- **Size:** Small · Quick.

**10. Jargon on the Leaderboard and product page** (still open from 26 Oct)
- "VFM" under every row when ranking by Value for money (11-rank-by-vfm). Use "VALUE".
- The colour name in the product badge: "Amethyst · #1 on your Leaderboard", "Emerald · #4…", and now "Prism · #1…" (40-look-daysky-product). Prism isn't a colour name at all, it's the set's name. Use "#1 on your Leaderboard" alone.
- "Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better" (12b). This is a dosing claim, and the ÷ reads like a formula. Use "Overall score for each £ spent, counting 20mg as 1g of flower. Higher is better."
- "HIT TIME — Not set" (12b). Use "Time to kick in".
- "Rows with a type mark have a full profile on your Leaderboard." (14-log) and Privacy's "Without them, followers see the type’s mark." Use "the leaf or other icon".
- "…hidden from your Leaderboard, Log, **tiles** and followers" and "Products you archive from their **profile**" (29-archive, plus the Archive sheet). Use "totals" and "product page".
- **Size:** Medium together · Quick.

**11. The sentence about Overall still has a straight apostrophe and a grammar slip** (still open from 26 Oct)
- "High is rated but doesn't count." uses a straight `'`. It's on every product page and editor (06, 12, 12c, 13, 17b, all 40-*-product).
- For more than one category, `shared/domain/ratings.ts` line 60 writes "are rated but doesn't count".
- **Suggestion:** "doesn’t" with a curly apostrophe, and "don’t" for the plural.
- **Size:** Medium · Quick.

**12. "Sources" has four names** (still open from 26 Oct)
- **What:**
  - The tab says Sources, but the title says "Brands & supplie…", which is cut off (15-sources picture).
  - The editor field is "Source" with the placeholder "Source/Brand".
  - The empty state has "Add a Source to a product, or a Supplier to a purchase", with capitals mid-sentence.
  - Privacy: "Source — Where you got it, e.g. Cookies." Where you *got* it is the supplier, which is never shared.
- **What's new:** On a brand page every row now carries a "Brand" tag (15b: the Jungle Boys page, with a tag that just says "Brand"), which reads oddly.
- **Suggestion:**
  - Title "Brands and suppliers".
  - Empty state: "Add a brand to a product, or a supplier to a purchase, and it shows here."
  - Privacy: "Who made it, e.g. Cookies."
  - On a brand's page, show the tag only when it's "Bought here".
- **Size:** Medium · Some work.

**13. Small inconsistencies in the new account screens**
- Settings says "Face ID (passkeys)", but that page's title is "Face ID" (20 against 25c). Use one name, "Face ID and passkeys".
- The same field is "Your password" on Email (25) and Delete (31) but "Current password" on Password (25b). Use "Current password" in all three.
- The Password page has no lead line, though Email has one. Add "After a change, any other phone or computer is signed out." That's what happens (the success message already says it).
- **Size:** Small · Quick.

**14. "NEW" on 9 of 15 Looks and 5 of 10 colour sets, and two names used twice**
- A week on, more than half the list says NEW, so the label tells you nothing.
- "Deep Sea" is both a Look and a colour set. "Aurora" and "Neon" are colour sets beside the "Aurora Glass" and "Neon Night" Looks. A friend saying "I'm on Deep Sea" is ambiguous.
- "The green look, tidied" (Deep Forest) means nothing to a newcomer. Try "Deep greens, calm and simple".
- **Size:** Small · Quick.

**15. Other earlier slips still open** (still open from 26 Oct)

| Where | Now | Should be |
|---|---|---|
| Type names (`productTypes.ts`) | Pre roll · Edibles · Live Rosin · Live Resin | Pre-roll · Edible · Live rosin · Live resin |
| Rank by under Flower (11b) | Price per gram | Price |
| Editor (06, 13) | Rated 0 of 5 | Rated 0 of 5 categories |
| Leafly placeholder (`Editor.tsx` 497) | Paste a link, or leave empty to search by name (cut off) | Paste a link, or leave blank |
| Sources cards (15) | best: Amnesia Haze | Best: Amnesia Haze |
| Privacy preview (24b) | …Change it in Privacy | …Change this in Privacy. |
| People empty (05e) | Not following anyone / You’re not following anyone yet. Search… | Not following anyone / Search for a username above to follow a friend. |
| Money (23) | USUAL | COMMON |
| Money (23) | Prices shown together are in this currency, so everything can be compared. | Totals and comparisons use this currency. |
| Settings (20) | Followers see: Leaderboard, Source, Country, Photos | Leaderboard, Source, Country, Photos |
| Unrated score | "–" on rows, "—" in ratings | One dash everywhere |
| Server errors | "could not" (photos, passkey, request) beside "couldn’t" (posts) | "couldn’t" throughout |
| Server errors | "Not found.", "The request is missing something." | "That isn’t here any more." / "Something’s missing. Please try again." |

### Words to fix (new this round)

| Where | Now | Should be |
|---|---|---|
| Look / Top / Colours footnote | Friends’ boards show in your look too. | Your followers see your board in it too. |
| Leaderboard top | The Log, friends’ boards and brand pages use it too. | The Log and brand pages use it too. |
| Privacy, Share my Leaderboard | Off: followers see nothing but your name. | Off: followers see only your name and your posts. |
| Privacy footnote | …and your Log are never shared. | …and your Log are never shared, except what you choose to post. |
| Followers empty | People who follow you see your leaderboard, never your Log, prices or notes. | People who follow you see your Leaderboard and posts, never your prices or notes. |
| Restore | Followers and passkeys stay as they are. | Your email, password, passkeys and followers stay as they are. |
| Export list | (no posts line) | Your posts |
| Delete list | (no posts line) | Your posts, and your comments and fires on others’ |
| Server `posts.ts` 380 | Archived products can’t be posted. Un-archive it first. | This product is archived. Bring it back from Settings → Archive first. |
| Post picker note | …aren’t listed: post their Log entry instead. | Archived products aren’t listed. For one you’ve returned to the Log, post its Log entry instead. |
| Brand page strip (15b) | 1 products | 1 product |
| Post page, hidden label | 1 comments | 1 comment |
| Server `posts.ts` 392 | That log entry doesn’t exist. | That Log entry doesn’t exist. |
| Person (`Person.tsx` 145) | Follow to see their leaderboard and posts. | Follow to see their Leaderboard and posts. |
| Settings | Face ID (passkeys) | Face ID and passkeys (and the same as the page title) |
| Email / Delete fields | Your password | Current password |

### What's already great
- The sign-up flow is plain and kind: "Pick your @name / Friends find you by this name. It’s the only thing others see until you approve them." and "Use Face ID next time? … Not now".
- The new errors tell you what to do next: "That email and password don’t match." (the same for both cases, as D80 wants), "The photo upload has expired. Please add the photo again.", "Too many attempts. Please wait a few minutes and try again."
- The post wording is natural: "What’s this about?", "Just a photo", "What followers see under the photo", "This product is private. Your followers can’t see it. Make it visible and post it?", "Delete this post? It goes for everyone, with its comments and fires."
- The Restore summary is careful: "No profile photo in this file: yours stays." and "Your posts are left as they are."
- Curly quotes and apostrophes are right in all the new code. British spelling holds ("colours", "favourite", "any more").

**Couldn't check:** the iPhone keyboard and iCloud Keychain prompts on the email and password screens, the real Face ID wording, and how the comment bar sits with the keyboard up. All need a real iPhone.

## Part 2: the website

**Overall verdict.** The site hasn't changed since 26 Oct apart from the how-to video (D68), so it is still clean, curly-quoted and consistent in voice. None of my 14 points from last round has been fixed. The video adds one new mismatch (20 seconds against 24). The app has moved on in two ways the site doesn't mention: you now sign up with an email and password, and there's a Feed of posts. Neither is wrong on the page today, but one wording idea from last round would now be false (see finding 3).

### Findings

**1. "20 seconds" in the heading, "24 seconds" right under it**
- **What:** The heading says "On your iPhone in 20 seconds." The video caption below says "Watch it done: … 24 seconds." The video's first caption says "Green Tracker on your iPhone. 20 seconds, in Safari." The closing banner says "Takes a minute."
- **Where:** `index.html` lines 103, 110 and 125; `media/home-screen.vtt` line 4.
- **Suggestion:** Drop the number from the heading ("On your iPhone in three taps.") and from the first caption. Keep "24 seconds" for the video's length.
- **Size:** Small · Quick.

**2. The video's last caption leaves out a step it just taught**
- **What:** "Get it in 3 steps: open it in Safari, Share → Add to Home Screen, tap Add." This skips "View More", which step 2 and the earlier captions say you need. The video also says "Leave Open as Web App on.", which the written steps never mention.
- **Suggestion:** "…Share → View More → Add to Home Screen, tap Add." Add "Leave Open as Web App on." to step 3's text. Check the wording on Anton's iPhone.
- **Size:** Small · Quick.

**3. Last round's "no password" privacy line must not go up now**
- **What:** The website summary's Quick win 1 suggested "No email, no phone number, no password. Just a username and Face ID." Since D80 that's false: sign-up asks for an email and a password.
- **Suggestion:** If the privacy block is built, word it as "Your email stays private. Nobody else ever sees it." (the app's own words), and say "suppliers and prices are never shared".
- **Size:** Medium · Quick (a warning for whoever does that change).

**4. The friends card doesn't mention posts**
- **What:** "Peep your mates’ picks: Follow friends and see their top shelf." The app now has a Feed of posts, comments and fires (D77), which is a big part of the friends side.
- **Suggestion:** "Follow friends, see their top shelf and their posts. Only if they say yes." This also replaces "Peep", which is American (still open from 26 Oct).
- **Size:** Small · Quick.

**5. Earlier points still open** (still open from 26 Oct)

| Where | Now | Should be |
|---|---|---|
| Hero chip (`index.html` 58, `og.png`) | £9.50/g · value for money | £9.50/g · price |
| Pretend board header (48) | All · Score | All · Overall |
| Logged chip (59) | Logged · Blue Zushi · 3.5g (also ranked #2) | Logged · Wedding Cake · 3.5g |
| Pretend row 4 (54) | Watermelon Gummies (cut off on laptop and share picture) | Melon Gummies |
| Step 1 (113) | Open it in Safari / Tap Sign up free on this page, in Safari. | Open the app in Safari / Tap **Sign up free** above. Opened this inside WhatsApp or Instagram? Open it in Safari first. |
| Safari drawing (114) | green-tracker.workers.dev | green-tracker.green-tracker.workers.dev |
| Android line (120) | Just open the link and sign up. | Just tap **Sign up free**. |
| Card 3 (79) | Know your plug | Know your sources |
| Card 2 (75) | Snap the nugs, add what you paid… | Snap a photo, add what you paid… |
| Card 1 (70) | …and earns its colours. | …and glows in its own colours. |
| Card and step headings | "Log it. Then forget it." and "Tap Add. Done." against others with no full stop | Log it, then forget it / Tap Add, and you’re done |
| Slider (95, `site.js` 35) | the label is the changing verdict | `aria-label="Score for Blue Zushi"`; the verdict as plain text |
| Slider verdict (`site.js` 24) | Top shelf. Holo unlocked. | Top shelf. Shiny colours unlocked. (tone: Anton's call) |
| 404 (`404.html` 15) | There’s nothing here. Head back and try again. ("again." still alone on its line on phone-404) | This page doesn’t exist. Head back to the start. |

**6. A small one: the captions file says `srclang="en"`, but the page says `en-GB`**
- **Where:** `index.html` line 108.
- **Suggestion:** `srclang="en-GB"`, label "English (UK)". It doesn't change anything you can see.
- **Size:** Small · Quick.

### What's already great
- The headline, "Rate your stash. Remember the fire.", and the slider's verdicts ("Not bad. Not fire.") are still the best lines on the page.
- The video captions are clear, short and British ("tap ⋯ at the bottom, then Share"), and the "Share button in the bar? Tap it." aside is thoughtful.
- Curly quotes and apostrophes and the "·" separator are used everywhere. There are no spelling slips.
- The footer: "No ads. No tracking. Your stash is your business."

**Couldn't check:** real Safari and the current Share menu wording, the WhatsApp and iMessage link preview, and playing the video itself (the test browser can't decode it).

**Files I looked at:**
- `/home/user/green-tracker/client/src/screens/Appearance.tsx`
- `/home/user/green-tracker/client/src/screens/Privacy.tsx`
- `/home/user/green-tracker/client/src/screens/Data.tsx`
- `/home/user/green-tracker/client/src/screens/People.tsx`
- `/home/user/green-tracker/client/src/screens/Person.tsx`
- `/home/user/green-tracker/client/src/screens/Composer.tsx`
- `/home/user/green-tracker/client/src/screens/LoginDetails.tsx`
- `/home/user/green-tracker/client/src/screens/SignIn.tsx`
- `/home/user/green-tracker/client/src/screens/CreateAccount.tsx`
- `/home/user/green-tracker/client/src/screens/Profile.tsx`
- `/home/user/green-tracker/client/src/components/PostCard.tsx`
- `/home/user/green-tracker/server/routes/posts.ts`
- `/home/user/green-tracker/server/routes/account.ts`
- `/home/user/green-tracker/shared/domain/ratings.ts`
- `/home/user/green-tracker/site/public/index.html`
- `/home/user/green-tracker/site/public/media/home-screen.vtt`
- `/home/user/green-tracker/site/public/404.html`