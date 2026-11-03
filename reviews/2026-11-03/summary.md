# Review panel: the app and the website (2026-11-03)

## In a nutshell
All five reviewers say the app has got better and more fun. The Feed is the first thing that gives people a reason to open it between purchases, and posts, friends' pages in their own look and the light looks were praised by everyone. The server rules for who sees a post, and the way passwords are stored, held up when the App developer tried to break them. The weak spots are around the new parts and in things left over from last time. Three things matter most:
1. **A forgotten password is a dead end, and nothing warns you.** All five reviewers raised it.
2. **Adding a product (and now writing a post) can still lose all your work with one tap on Cancel.**
3. **Several privacy and data sentences are now untrue.** Since posts and email sign-in arrived, Privacy, Export, Delete and the Look pages describe the app as it was. The website still describes the app from a fortnight ago.

Almost nothing from the 26 Oct lists has been done. Most of it is quick.

## Since last time (26 Oct)
**Fixed or answered**
- [App] The Delete account wording about passkeys has gone (it was replaced by the password, D80).
- [App] On the new default board (Slim strip, D71), the + button now only touches the corner of row 6.
- [App] "The looks barely differ" (Marketing): the 15 looks now clearly differ.
- [App] "Nothing brings people back" (Investor): the Feed answers this for people who have friends on the app.
- [Website] Step 2 now matches today's Safari (⋯, View More), and there's a how-to video with captions.

**Still open** (checked in today's code and screenshots)
- [App] All of last round's to-do list:
  - Cancel throws work away.
  - Value for money still shows "VFM" and "£0.25/mg".
  - Source still says "Where you got it".
  - No Export warning.
  - The empty Log still shows zeros.
  - Sign in is still the main welcome button.
  - Save has no time limit.
  - Photos are still the 6th section of the form.
  - No 18+ line and no privacy notice.
- [App] Nearly all of the Proof-reader's 17 wording points.
- [Website] Everything except step 2:
  - the value-for-money chip;
  - "Know your plug";
  - the wrong address in the drawing;
  - the WhatsApp line;
  - the laptop layout and the small buttons;
  - the slider's name;
  - the 404 page;
  - no privacy block.

## Quick wins (big difference, little work)
1. **[App] Say plainly what happens if you forget your password.**
   - Add a "Forgot password?" link on Sign in: "We can't reset passwords by email yet. If you set up Face ID, use that."
   - On the Face ID offer: "Face ID is also your way back in if you forget your password."
   - Under the sign-up password: "Pick one you'll remember."
   - Checked: there's no "forgot" anywhere in the app, and "Not now" has no warning.
   - Also checked: even after signing in with Face ID, you can't set a new password, because changing it needs the current one (`account.ts` line 136). So Face ID gets you in but doesn't fully rescue you.
   - Raised by all five; Sam's #1. **Size: Big · Effort: Quick.**
2. **[App] Help the iPhone save the password at sign-up.**
   - Mark the email box as the "username" for the iPhone's password store (iCloud Keychain). It is marked "email" today (`CreateAccount.tsx` line 118).
   - Put a hidden copy of the email and password in step 2's form. That form has only the @name box, so Keychain may save nothing, or save it under the @name.
   - Must be tried on Anton's iPhone. Raised by the App developer. **Size: Big · Effort: Quick.**
3. **[App] Ask before throwing work away.**
   - Show "Keep editing / Discard" on Cancel and on swipe-back whenever anything has changed, in the add/edit form and in the new post composer.
   - Checked: `Editor.tsx` line 224 asks only when moving a Log entry over. `Composer.tsx` line 172 leaves at once, dropping up to 10 photos and a caption.
   - Raised by Sam and the App developer. **Size: Big · Effort: Some work.**
4. **[App] Bring the privacy sentences up to date.**
   - Privacy, "Share my Leaderboard" off: "followers see only your name and your posts".
   - Privacy footnote: "…never shared, except what you choose to post".
   - The followers, unfollow and block messages: "Leaderboard and posts".
   - Checked: `Privacy.tsx` lines 27 and 173.
   - Raised by the Proof-reader. **Size: Big · Effort: Quick.**
5. **[App] Fix the Source description, and warn on the form.**
   - Privacy: "The brand or grower, e.g. Cookies. Shops and dealers go in Supplier, which is never shared."
   - Add "Followers can see this" under the Source box, and replace the "Source/Brand" placeholder.
   - It matters more now: Source shows on post cards in the Feed (checked on 18b).
   - Raised by Sam, Marketing and the Investor (the strongest agreement, two rounds running). **Size: Big · Effort: Quick.**
6. **[App] Export, Restore and Delete: list posts, and add the warning.**
   - Export: add "Your posts" to "In the file".
   - Delete: add "Your posts, and your comments and 🔥 on others'" to "What goes".
   - Restore: "…Log, photos and posts (if the file has them). Your email, password, passkeys and followers stay."
   - Export: "This file isn't locked. Anyone who opens it can read everything."
   - Checked: `Data.tsx` lines 75–101, 192 and 303–327.
   - Raised by all four of the others besides Marketing. **Size: Medium · Effort: Quick.**
7. **[App] Value for money you can read.**
   - Show "per 20mg" on an edible's row under Value for money, as already happens under Price. Today it shows only under Price (`ProductRow.tsx` line 184).
   - Rename "VFM" to "Value".
   - Raised by Sam, the Proof-reader and the App developer. **Size: Big · Effort: Quick.**
8. **[App] The look-page footnotes are wrong since D74.** "Friends' boards show in your look too" should be "Your followers see your board in it too". Checked: `Appearance.tsx` lines 213 and 277. Raised by the Proof-reader. **Size: Medium · Effort: Quick.**
9. **[App] The first comment hides under the comment box.**
   - Leave room for the bar and make it solid.
   - Checked on 18b-post: "Need to try this one" shows through "Add a comment…".
   - Then Anton types a comment on his iPhone, to check the keyboard.
   - Raised by Sam, the Proof-reader and the App developer. **Size: Small · Effort: Quick.**
10. **[App] One line under the comment box:** "Everyone who follows @sam sees your comment and @name." Anton chose this in D77; the line only says it out loud. Raised by the App developer. **Size: Medium · Effort: Quick.**
11. **[App] One line in the post composer:** "Your followers see these photos. Leave out faces, places and anything with a name or number." Raised by the Investor. **Size: Medium · Effort: Quick.**
12. **[App] Small layout fixes.**
    - Room under the list so the + doesn't cover row 5's score on the big glass hero (checked on 40-look-daymint).
    - Hide "0 products · 0 countries · 0g" on an empty Log (checked on 05b).
    - Make the 🔥 count, "View all comments" and "more" 44 points tall.
    - Raised by Sam, Marketing and the App developer. **Size: Small · Effort: Quick.**
13. **[App] A quicker Feed.**
    - Load photos only as they scroll into view. Checked: the first photo of every post is full size and loads at once (`PostCard.tsx` line 118).
    - Tapping the Feed tab again goes to the top and refreshes.
    - Reload when you come back to the app.
    - Raised by the App developer. **Size: Medium · Effort: Quick.**
14. **[App] Check the server's computing time for sign-in (Anton, 2 minutes).**
    - Each password check works the password 100,000 times; Cloudflare's free plan allows about 10ms of computing per request.
    - Steps: Cloudflare → Workers → green-tracker → Metrics. Look at CPU time and errors since today.
    - Not checked: it's a guess from the numbers. Raised by the App developer. **Size: Big if real · Effort: Quick.**
15. **[Website] Catch up with the app.** Each point checked in `index.html`:
    - Say what sign-up asks for: "Just an email and password. Your email stays private; Face ID is optional." Never use last round's "no email, no password" line: it's now false (four reviewers warn).
    - Rewrite the friends card around posts ("Post what you're smoking. Only friends you approve see it.").
    - Use one time everywhere: "20 seconds", "24 seconds" and "Takes a minute" all appear.
    - Draw the real address in step 1.
    - Relabel the chip "£9.50/g · price", move it off the 8.8, and redraw the share picture.
    - Raised by all five. **Size: Big · Effort: Quick.**

## Worth doing next (bigger pieces)
1. **[App] "You rated this 9.1" on a friend's product page and on a post's card**, when you have a product with the same name. It shares nothing new. Raised by Sam (still open) and the Investor. **Size: Big · Effort: Some work.**
2. **[Both] Trust basics for strangers.** Raised by the Investor and Marketing; Sam backs the 18+ line. **Size: Big · Effort: Some work.**
   - An "I'm 18 or over" tick at sign-up.
   - One plain privacy screen: what's kept, including the email, where, who can see it, backups, and a contact address.
   - Short terms.
   - A **Report** button on posts, comments and profiles. Checked: there's none; Block is the only tool.
3. **[App] An "Invite a friend / share my @name" button** on the empty Feed and on People. Checked: the iPhone share sheet is used only by Export. Raised by Marketing and the Investor (still open). **Size: Big · Effort: Some work.**
4. **[App] Sign-in hardening.** Raised by the App developer and the Investor. **Size: Medium · Effort: Some work.**
   - Count only *wrong* passwords against the per-email limit. Checked: `auth.ts` line 139 counts every try before checking, so anyone who knows your email can keep you locked out. D80's own wording says "wrong tries", so this makes the code match it, but CLAUDE.md asks you to approve any change to those limits.
   - Ask for the password before adding a new Face ID (passkey). Checked: it isn't asked for today.
   - Show the passkeys after a password change.
   - Add tests for each.
5. **[App] A quicker add-a-product form.**
   - Order it Photos, Name and Type, Purchase, then Ratings.
   - Fold Country, Strain type and Leafly under "More details".
   - Add − / + buttons by each score.
   - Mockups first. Raised by Sam (still open), the Investor and Marketing. **Size: Medium · Effort: Some work.**
6. **[App] Keep a half-filled product if the iPhone closes the app**, and a 20-second limit on Save so it can't hang or make a duplicate. Raised by the App developer (still open). **Size: Big · Effort: Some work.**
7. **[Website] The rest of last round's list:**
   - the WhatsApp/Instagram line in step 1;
   - the laptop layout;
   - 44-point top buttons;
   - the slider's fixed name;
   - the 404 page;
   - a QR code for laptop visitors.

   Also check on the iPhone whether a Safari sign-up stays signed in when you open the new Home Screen icon. If not, people now have to type their password there (App developer). **Size: Medium · Effort: Quick to Some work.**
8. **[App] Things to check on Anton's iPhone first:**
   - the clock and battery colour in a light look, and on a friend's light page (App developer, not checked);
   - Feed scrolling on an older iPhone (the blur over moving lights);
   - typing a comment with the keyboard up.

## Ideas to think about
- **[App] Welcome screen: "Create account" as the main button** (Sam, Marketing; still open). Strangers are the ones who see this screen. Anton picked this layout (option A) in D80, so it's his call; I recommend it.
- **[App] A different icon for the Feed's + (a pencil or "Post")** (Sam). Anton chose the round + in D77. Raise it with him; don't just change it.
- **[App] Let someone signed in with Face ID set a new password without the old one.** This is the real rescue for a forgotten password until email exists. It changes D80's rule, so it's Anton's call.
- **[App] Sending email** (password reset, checking the email is real) **brought forward.** It would also close a leak: sign-up and Change email tell anyone whether an email has an account. Checked: `auth.ts` line 113 and `account.ts`. Raised by the App developer and the Investor. A domain of Anton's would be needed, and the Investor notes it's cheaper to move address now, because passwords work on any address (reopens D63's free address).
- **[App] "Share as picture" for your own posts, then "Share my top 5"** (Marketing). This is new sharing, so it's a privacy decision.
- **[App] An optional Face ID or password lock when opening the app** (Investor; still open).
- **[App] A per-account photo limit and a Cloudflare billing alert** (Investor). The alert costs nothing; set it today.
- **[App] Fewer "NEW" tags:** 11 of 15 looks and 5 of 10 colour sets carry one. Also, names used twice (Deep Sea, Aurora). Raised by the Proof-reader and Marketing.
- **[App] Tap a look to preview it on your own board** (Sam).
- **[App] A tag icon instead of the shop-front for the Sources tab** (Marketing): a shop next to cannabis reads as "where to buy".
- **[Website] 18+ and "nothing is bought or sold here"** in the footer and badge. **Reopens D63** ("no age or legal note"). Decide it with the app's 18+ tick.
- **[Website] "Know your plug" → "Know your brands"** (Marketing, Investor, Proof-reader). "Plug" means dealer. **"Roll one up and sign up"** and **"Made by Anton"** are Anton's call (D63's tone).
- **[Website] Say "cannabis" in the title for search; add a FAQ, a "Pick your look" strip, and a tall video for phones** (Marketing, Sam, App developer).

## Words to fix
| Where | Now | Should be |
|---|---|---|
| Look / Top / Colours footnote | Friends’ boards show in your look too. | Your followers see your board in it too. |
| Leaderboard top | The Log, friends’ boards and brand pages use it too. | The Log and brand pages use it too. |
| Privacy, Share my Leaderboard | Off: followers see nothing but your name. | Off: followers see only your name and your posts. |
| Privacy, Source | Where you got it, e.g. Cookies. | The brand or grower, e.g. Cookies. |
| Source box | Source/Brand | e.g. Cookies |
| Restore | Followers and passkeys stay as they are. | Your email, password, passkeys and followers stay as they are. |
| Block / Archive messages | More → Blocked people / More → Archive | Settings → Blocked people / Settings → Archive |
| Server (`posts.ts`) | Archived products can’t be posted. Un-archive it first. | This product is archived. Bring it back from Settings → Archive first. |
| Post picker | …aren’t listed: post their Log entry instead. | Archived products aren’t listed. For one you’ve returned to the Log, post its Log entry instead. |
| Overall line (`ratings.ts` 60) | doesn't count / are rated but doesn't count | doesn’t count / are rated but don’t count |
| Brand page strip | 1 products | 1 product (and "1 country") |
| Post page, VoiceOver | 1 comments | 1 comment |
| Rows under Value for money | VFM | Value |
| Product badge | Amethyst · #1 on your Leaderboard | #1 on your Leaderboard |
| Edible value line | Overall ÷ latest £ per 20mg (the same effect as 1g of flower) | Overall score for each £ spent, counting 20mg as 1g of flower |
| Capitals | Add to leaderboard, Save to log, see their leaderboard, That log entry… | Leaderboard, Log |
| Settings | Face ID (passkeys) | Face ID and passkeys (the same as its page title) |
| Email and Delete fields | Your password | Current password |
| Sources title | Brands & supplie… (cut off) | Brands and suppliers |
| Type names | Pre roll · Edibles · Live Rosin | Pre-roll · Edible · Live rosin |
| Website heading and captions | 20 seconds / 24 seconds / Takes a minute | One time throughout |
| Website video's last caption | Share → Add to Home Screen | Share → View More → Add to Home Screen |
| Website card 4 | Peep your mates’ picks | See your mates’ picks and posts |
| Website chip | £9.50/g · value for money | £9.50/g · price |

The Proof-reader's earlier table (Money "USUAL", the Leafly hint, "HIT TIME", dashes, "could not", the 404 page) still stands too.

## What everyone liked
- **The Feed and posts:** the big photo, the product card with its glowing score, the 🔥, swiping between photos, and coming back to where you were.
- **The posts rule:** followers only, checked by the server on every request; no prices or suppliers on post cards.
- **Password handling:** a salted hash, one answer for a wrong password and an unknown email, and a password needed to delete the account.
- **Friends' pages in their own look**, the light looks, Outrun and Sakura.
- **Calm sign-up wording:** "Your email is private", Face ID offered once, and "Pick your @name".
- **The empty Feed's line:** "Only your approved followers ever see yours."
- **The website:** the headline, the slider, the video (it loads only when tapped, with captions), and nothing loaded from anywhere else.

## The sceptic's view (kept separate)
- **The hard questions:**
  - The email turns an anonymous diary into a named record of dated, priced purchases from named suppliers.
  - Posts and comments very likely bring the app under the UK's Online Safety Act, however small and free it is. That means a risk note, a way to report, and terms. The Investor isn't a lawyer: Anton should run Ofcom's online checker once, and the ICO's fee self-assessment.
- **Risks:**
  - There's no Report button, while a comment like "I can sort you an eighth" is exactly what the Act targets.
  - "Nobody else ever sees it" overstates things: Anton and Cloudflare can. Better: "Only you see it. We use it only to sign you in", plus "any email you can get into works".
  - Sign-up reveals whether an email has an account.
  - No contact route, so Anton is now a lone moderator with no plan.
  - Photo storage has no cap and no billing alert.
- **Focus:** eleven looks and five colour sets shipped since 26 Oct, but none of the trust items, though most are a sentence each. The Investor would stop asking for a freeze on looks once one "trust basics" item is on the list.
- **If deciding today:**
  1. An 18+ tick, a privacy notice with a contact, terms, and Report.
  2. Help people keep less risky data: the email hint, the Source wording, the composer line, the Export warning, and an honest password line.
  3. Plan email sending now, not "later".
- **Website:** a "Your data" block that's true today; 18+, a contact, and Terms and Privacy links in the footer; show the Feed with "only friends you approve".

## Checked and set aside
- **"The gummy wins Value for money" (Sam):** not a bug. Anton chose to count 20mg as 1g in D67. Only the display is unclear (Quick win 7).
- **"NEW on 9 of 15 looks" (Proof-reader) / "12" (Marketing):** it's 11 of 15 looks and 5 of 10 colour sets (`gems.ts`).
- **"Make visible and post contradicts 'Private stays hidden'" (Proof-reader):** it asks first, then makes the product visible. The Privacy sentence is still true. Dropped.
- **"Restore replaces posts" (Proof-reader):** only when the file has posts (checked, `Data.tsx` line 226). The wording has been corrected to match.
- **"Comments show your @name to strangers" (App developer) as a privacy flaw:** Anton chose this in D77. Kept only as a wording line (Quick win 10).
- **Sam's "change the Feed's +":** Anton picked it in D77. Moved to Ideas.
- **Not checked** (kept, but needing Cloudflare or the iPhone):
  - computing time on sign-in;
  - the status bar in light looks;
  - Keychain saving;
  - Safari sign-in carrying over to the Home Screen;
  - the video's size on a phone;
  - "Sign out everywhere keeps passkeys".

## Suggested to-do list, as separate jobs

**1. Forgot-password safety net.** *Small.*
- "Forgot password?" link with honest words, and the Face ID offer reworded.
- Keychain hints on the sign-up forms (try on the iPhone).
- The "too many tries" message mentions Face ID.
- Anton checks sign-in computing time in Cloudflare.
- *Anton decides:* nothing; the wording just describes how D80 works.

**2. Don't lose my work.** *Small* (the questions and the time limit); keeping a half-filled product after the app closes is a later *Big* job.
- Keep editing / Discard in the add/edit form and the post composer, on Cancel and swipe-back.
- A 20-second limit on Save and Post; no duplicate on a second tap.

**3. Privacy and data words that are out of date.** *Small* (words only, no rule changes).
- The Privacy page sentences and Source wording; "Followers can see this" under Source.
- Export, Restore and Delete lists; the Export warning.
- The Look-page footnotes.
- Lines under the comment box and in the composer.
- The sign-up email line ("Only you see it…").

**4. Small fixes on the Leaderboard, Log and Feed.** *Small.*
- Value for money: "per 20mg" on rows, "Value" not "VFM".
- Room under the +; no zeros on an empty Log.
- The comment hidden under the bar; 44-point post buttons.
- Feed photos load as you scroll; tapping the tab again refreshes; reload on return.

**5. Wording fixes across the app.** *Small.*
- The Words table: "More" → "Settings", doesn’t/don’t, plurals, capitals, badge colour names, type names, the archive messages, Current password.

**6. Website catch-up.** *Small* for the words; the hero redraw is some work.
- Say what sign-up asks for; the Feed card; one time throughout; the video's caption.
- The real address; the chip relabelled and moved, and the share picture redrawn.
- Step 1 for WhatsApp; laptop layout; 44-point buttons; the slider's name; the 404 page.
- *Anton decides:* "Know your plug", "Roll one up", "Made by Anton". Check on the iPhone whether the Safari sign-in carries over.

**7. Trust basics for strangers (app and website together).** *Big* (a Report button needs a database change; it changes what's on show at sign-up).
- 18+ tick; a privacy notice and terms with a contact address.
- Report on posts, comments and profiles.
- A per-account photo limit; a Cloudflare billing alert.
- *Anton decides first:* whether to do it at all; a contact address; 18+ on the website (reopens D63); whether to run the Ofcom and ICO checkers.

**8. Friends: you against them, and inviting someone.** *Big* (changes what you see on friends' pages).
- "You rated this 9.1" on a friend's product and on post cards.
- An "Invite a friend / share my @name" button.
- *Anton decides:* whether the invite includes the website address (D63).

**9. Sign-in hardening.** *Big* (sign-in changes to try on the iPhone).
- Count only wrong passwords per email.
- Ask for the password before adding a passkey; show passkeys after a password change.
- Tests for each.
- *Anton decides:* approve the per-email limit change (CLAUDE.md rule); whether Face ID may set a new password without the old one (changes D80).

**10. A quicker add-a-product form.** *Big* (visual; mockups first).
- Photos first; optional details folded away; − / + by each score.
- *Anton decides:* his pick of the mockups.

Files checked include `/home/user/green-tracker/client/src/screens/CreateAccount.tsx`, `/home/user/green-tracker/client/src/screens/Editor.tsx`, `/home/user/green-tracker/client/src/screens/Composer.tsx`, `/home/user/green-tracker/client/src/screens/Data.tsx`, `/home/user/green-tracker/client/src/screens/Privacy.tsx`, `/home/user/green-tracker/client/src/screens/Appearance.tsx`, `/home/user/green-tracker/server/routes/auth.ts`, `/home/user/green-tracker/server/routes/account.ts`, `/home/user/green-tracker/server/lib/rateLimit.ts` and `/home/user/green-tracker/site/public/index.html`, plus screenshots 18b-post, 40-look-daymint, 11-rank-by-vfm, 05b-empty-log and 15b-brand in `/home/user/green-tracker/.playwright/review/app/`.