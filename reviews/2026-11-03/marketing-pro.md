# Marketing pro: the app and the website (2026-11-03)

## Part 1: the app

### Overall verdict
The app has grown up a lot in a week, and mostly in the right direction for strangers. The Feed is the first feature that gives a newcomer a reason to come back that isn't their own buying. The posts look great: a big photo, the product card with its glowing score underneath, a 🔥 count. Fifteen Looks, including three light ones, finally feel like a reward, because Outrun's grid and sun, Lava Lamp's blobs and Daylight Mint's pale cards look clearly different from each other while still being one brand. Email and password sign-up is a better fit for normal people than passkeys alone. The weak spots are the same ones as last round, and almost none of them have been fixed:
- the welcome screen still pushes **Sign in** at strangers;
- there's still no 18+ line or privacy promise at the door;
- there's still no way to invite a friend or share anything outside the app.

Those matter more now than they did, because the app has become social: a Feed with nobody in it is the emptiest screen a newcomer can see. The move to email also quietly breaks the best privacy line the app had ("we don't even ask for your email"), so the trust story needs rewriting.

### Findings (most important first)

**1. The welcome screen still makes Sign in the main button** (still open from 2026-10-26)
- **What:** On 01-welcome the filled green button is "Sign in". "Create account" is the dark one underneath, and "Sign in with Face ID" sits under that, so two of the three actions are for people who already have an account.
- **Where:** 01-welcome; `client/src/screens/SignIn.tsx`.
- **Why it matters:** Strangers are the people who see this screen most often, because returning users open the installed app already signed in. Since the email change the mistake costs more: a stranger who taps Sign in lands on "Welcome back" with an email and password form and has to find "New here? Create account" (01b).
- **Suggestion:** Make "Get started, it's free" the filled button and "I have an account" the second one. Move "Sign in with Face ID" onto the sign-in screen only, where 01b already offers it.
- **Size:** Big / Quick.

**2. The privacy story now needs rewriting, because the app asks for an email**
- **What:** Last round's best trust line was "no email, no phone number, just a username". Since D80 that's no longer true. The sign-up step says "Your email is private. Nobody else ever sees it." (02), which is good, but it's the only privacy line before you're in, and the welcome screen says nothing at all.
- **Where:** 01-welcome, 02-signup-email.
- **Why it matters:** For a UK cannabis user, "can this be traced to me?" is the main reason not to sign up, and handing over an email makes that worry worse. They need a reason to trust the app at the very moment they're asked for one.
- **Suggestion:**
  - On 02, add under the subtitle: "Use any email you like: it's only for signing in. Nobody else sees it, and we never email you marketing." Only say "never email you" if Anton is happy to promise it; the "forgot password" item on his to-do list will mean sending some email.
  - Add a three-point strip on the welcome screen: "Private until you approve someone · Prices, shops and notes never shared · Free, no ads, no tracking".
- **Size:** Big / Quick.

**3. Still no 18+ or grown-up framing anywhere** (still open from 2026-10-26)
- **What:** No age line on the welcome screen or in sign-up (I searched the screens' code: nothing).
- **Where:** 01-welcome, 02-signup-email.
- **Why it matters:** Now that there are posts, comments and a Feed, this is a social space as well as a diary. Any moderator, parent or journalist checks the age line first. Without one, the app looks careless, and it gives Reddit or Discord moderators a reason to remove links.
- **Suggestion:** On 02, add a required tick: "I'm 18 or over". Under the welcome buttons, add: "For adults 18+. A personal journal: nothing is sold here."
- **Size:** Big / Quick.

**4. The social side starts empty, and there's still no way to invite anyone** (still open from 2026-10-26, now more urgent)
- **What:** A new account's Feed says "Post something / Find people" (05d). "Find people" opens a search box and "Not following anyone. Search for a username above." (05e). There's nothing for sharing your own @name or a link. In the code, the only use of the iPhone share sheet is for Export.
- **Where:** 05d-empty-feed, 05e-empty-people, 16-people-search.
- **Why it matters:** The Feed is now one of five tabs and the most "come back tomorrow" part of the app, but it only works with friends in it. Word of mouth is the main growth channel this app has, and right now it depends on people spelling out usernames to each other.
- **Suggestion:** Add an "Invite a friend" button on the empty Feed (in place of, or next to, "Find people") and on your People card. It opens the share sheet with: "I rate everything I try on Green Tracker. Add me: @samjcnh" and the app's address. It shares only your @name, and only when you tap it. If the message includes the website address, that touches D63.
- **Size:** Big / Some work.

**5. Posts are the most shareable thing in the app, but they can't leave it**
- **What:** A post with a product (18b) is the best-looking "show-off" card in the app: a photo, the product card with Wedding Cake 9.1, the brand and a caption. But the only way to share it outside is a screenshot, and a screenshot also catches the tab bar, comments and @names.
- **Where:** 18-feed, 18b-post, 12-product.
- **Why it matters:** "Share my top 5" was last round's idea; posts make it easier. One clean picture, made by the app and carrying a small Green Tracker mark, does the marketing every time someone shares it.
- **Suggestion:** In a post's ⋯ menu (your own posts only), add "Share as picture". It would make a branded square in your Look: the photo, the product name, the score and the type, with no @names, comments, prices or source unless you choose them. Then add "Share my top 5" on the Leaderboard. This is new sharing, so it's a privacy decision for Anton.
- **Size:** Big / Some work.

**6. No "Forgot password?" link, and no word about what happens if you forget**
- **What:** The sign-in screen (01b) has Email, Password, Sign in, Face ID and "New here?", but no "Forgot password?". Anton's to-do list confirms that a forgotten password with no Face ID can't be recovered yet.
- **Where:** 01b-login, 04-signup-faceid.
- **Why it matters:** For strangers, a password that can't be recovered is a trust and polish gap: a missing "Forgot password?" looks unfinished. People who tap "Not now" on Face ID (04) are the ones at risk.
- **Suggestion:** Until email sending exists:
  - Add a small "Forgot password?" link that explains honestly: "We can't reset it by email yet. If you set up Face ID, use that, then change your password in Settings."
  - On 04, make "Not now" a little less tempting: "Use Face ID: it's also your way back in if you forget your password."
- **Size:** Medium / Quick.

**7. Source is still described as "Where you got it", and it's still shared by default** (still open from 2026-10-26)
- **What:** Privacy (24-privacy) still says "Source: Where you got it, e.g. Cookies." and the switch is on.
- **Where:** 24-privacy; `client/src/screens/Privacy.tsx`.
- **Why it matters:** "Where you got it" invites people to type their dealer, and that is then shown to followers and appears on posts (18b shows the brand under the product). With posts going out to every follower, this is the most likely way a user gets hurt, and the most likely thing a journalist would quote.
- **Suggestion:** "The brand or grower, e.g. Cookies. Shops and dealers go in Supplier, which is never shared."
- **Size:** Big / Quick.

**8. The product badge says "Amethyst", which means nothing to a newcomer** (still open from 2026-10-26, in a new form)
- **What:** The Gems default renamed the colour, so 12-product now reads "Amethyst · #1 on your Leaderboard".
- **Where:** 12-product.
- **Why it matters:** This is the app's most screenshot-worthy screen. A stranger, or a friend looking at a screenshot, will read "Amethyst" as a strain name.
- **Suggestion:** "#1 on your Leaderboard" alone, or "Top tier · #1 on your Leaderboard".
- **Size:** Medium / Quick.

**9. The first empty screens still don't promise speed, and the Log still shows zeros** (still open from 2026-10-26)
- **What:**
  - 05-empty-leaderboard says "Add the first thing you've tried and it'll appear here", then opens the full eight-section form.
  - 05b-empty-log still shows a "0 products · 0 countries · 0g total" strip above the empty notebook.
- **Where:** 05, 05b.
- **Why it matters:** The "this is great" moment is seeing your first score glow. Nothing tells a newcomer it's only a minute away.
- **Suggestion:**
  - Leaderboard: "Rate your first one: a name and a few sliders. Photos and prices can wait."
  - Hide the zero strip on an empty Log.
- **Size:** Medium / Quick.

**10. The welcome screen doesn't show the newest selling points**
- **What:** The example Leaderboard on 01 uses plain leaf placeholders. It shows nothing of posts and the Feed, or of the Looks.
- **Where:** 01-welcome.
- **Why it matters:** The two newest things (friends' posts, 15 looks) are what make it feel like a "proper app" rather than a spreadsheet, and a stranger only learns about them after signing up.
- **Suggestion:**
  - Change the subtitle to: "Rate, rank and remember everything you try. Share the best with friends you approve."
  - Give the example cards coloured thumbnails like the website's.
  - Optionally, let the example cards cycle slowly through two or three Looks: a free, honest demo of the Looks.
- **Size:** Medium / Quick for the words, Some work for cycling the Looks.

**11. The Looks are now a real brand asset, but they need a little curating**
- **What:** 21-look shows 15 looks with "NEW" badges on 12 of them. The previews do now differ clearly, which fixes my "they barely differ" point from last round. Outrun and Lava Lamp are a long way from the green Aurora brand, and Daylight Mint (40-look-daymint) turns the leaf in the header pale and washed out.
- **Where:** 21-look, 40-look-outrun, 40-look-daymint.
- **Why it matters:** Variety is great as a reward. But the app's identity should still read as Green Tracker in any Look, especially in screenshots people share.
- **Suggestion:**
  - Keep the leaf mark and the "Green Tracker" wordmark in full brand green in every Look. In Daylight Mint it currently looks faded; on light looks use the deeper green.
  - Drop the "NEW" badges after a couple of weeks; twelve at once reads as a feature dump.
  - On the website, show a "Pick your look" strip (Part 2).
- **Size:** Small / Quick.

**12. The Sources tab icon is a shop front**
- **What:** The Sources tab uses a shopfront icon.
- **Where:** Tab bar on every screen (05 onwards).
- **Why it matters:** It's a small thing, but a shop icon next to cannabis reads as "where to buy". That's the one impression a UK cannabis app must avoid in screenshots.
- **Suggestion:** Use a tag, a label or a "brand" badge icon.
- **Size:** Small / Quick.

**13. The Home Screen label** (still open from 2026-10-26, not checked)
- **What:** `short_name` is still "Green Tracker" (`client/public/manifest.webmanifest`).
- **Where:** `client/public/manifest.webmanifest`.
- **Why it matters:** A label cut to "Green Track…" looks unfinished next to polished apps.
- **Suggestion:** Check Anton's Home Screen. Only change it if the label is cut off.
- **Size:** Small / Quick.

**14. No hint to add the app to the Home Screen** (still open from 2026-10-26)
- **What:** There's still no add-to-Home-Screen hint anywhere in the app (I found no check in `client/src` for whether it's running from the Home Screen).
- **Where:** 01-welcome; `client/src`.
- **Why it matters:** Invites will mostly be links. Someone who stays in a Safari tab never sees the Feed badge and drifts away.
- **Suggestion:** Show a one-time card after sign-up, only in Safari, using the same words as the website's steps.
- **Size:** Medium / Some work. Needs checking on a real iPhone.

### What's already great (don't break these)
- **"Your stash, ranked."** is still the best line in the brand.
- **The post card (18b):** the photo, then the product card with its glowing score, then the 🔥. It's premium and very "show your mates".
- **The empty Feed's wording:** "Only your approved followers ever see yours." This is exactly the right reassurance in exactly the right place. More of this.
- **"Your email is private. Nobody else ever sees it."** on sign-up step 1, and Face ID offered calmly as optional (04).
- **The Look page (21):** Dark mode and Light mode sections, with previews that really differ. It's a fun, premium feature that looks good in screenshots.
- **The privacy preview** ("What followers see", "Open their view") is still a real trust asset.
- **The grown-up tone:** no stoner jokes in the app itself.

---

## Part 2: the website

### Overall verdict
The website is unchanged since 26 October apart from the install step and the video, and the app has moved on a long way since then. The page still sells a private Leaderboard for one. It doesn't mention the Feed, posts, comments or 🔥, the fifteen Looks, or that you sign up with an email. Its hero picture shows an older style of Leaderboard with "All · Score", which the app doesn't have. Almost every quick win from last round is still open: the value-for-money chip, "Know your plug", no 18+, no privacy block, no word "cannabis", the wrong address in step 1. It's still a beautiful page, and the headline, the slider and the video are still right. But a stranger who signs up now gets a noticeably different and better app than the one advertised, and that's wasted marketing. One pass over the words and one redrawn hero picture would fix most of it.

### Findings (most important first)

**1. The page no longer describes the app**
- **What:** "What it does" has four cards: ranked, log it, plug, mates. There's nothing about posts, the Feed, comments, the 🔥 or the Looks. "Peep your mates' picks" only covers following someone's Leaderboard.
- **Where:** `site/public/index.html`, "What it does"; home.txt lines 47–64.
- **Why it matters:** The social side and the Looks are exactly what makes someone forward the link to a friend. People decide on the website, and right now it undersells the app.
- **Suggestion:**
  - Replace card 4 with: **"Show your mates"**: "Post a photo of what you're trying, tag it to your Leaderboard, and get a 🔥 from friends. Only people you approve ever see it."
  - Add card 5: **"Make it yours"**: "Fifteen looks, from Aurora to Outrun to Daylight. Your friends see your board in your look."
  - Ideally, add a small second phone in the hero showing a post card, or a "Pick your look" strip of 4–5 tiles drawn from the real previews.
- **Size:** Big / Quick for the words, Some work for the pictures.

**2. The hero picture and share picture show an app that doesn't exist any more**
- **What:** The mock Leaderboard shows "All · Score" (the app says "Rank: Overall"), three square stat tiles (new accounts get the Slim strip), and "£9.50/g · value for money", which is a price, not value for money, and still covers Gushers Rosin's 8.8 on phone, laptop and `share-picture.png`. "Watermelon Gummi…" is still cut off.
- **Where:** phone-home, laptop-home, share-picture.png; `site/public/og.png`.
- **Why it matters:** This is the first picture anyone sees, on the site and in every WhatsApp preview. When it doesn't match the app, the first minute after sign-up feels like "is this the same thing?"
- **Suggestion:** Redraw it to match today's default (the Gems colours and the Slim strip):
  - Change "All · Score" to "Rank: Overall".
  - Change the chip to "£9.50/g · price", or to a real value-for-money score, and move it off the score column.
  - Shorten the name to "Melon Gummies".
  - Replace the "Logged" chip with a "🔥 3 · @jess" chip to hint at the Feed.
  - Re-render `og.png`.
- **Size:** Big / Quick to Some work.

**3. Say what the sign-up actually asks for, and make the privacy promise loud** (still open from 2026-10-26, now with different words)
- **What:** The only privacy words are still the footer's "No ads. No tracking. Your stash is your business." Note: last round's suggested "No email, no phone number" is **now false** (D80) and must not be used.
- **Where:** `index.html`, after "What it does", and under the hero buttons.
- **Why it matters:** For cautious UK users this is the main reason to sign up or not, and the email step will surprise people who were expecting "just a username".
- **Suggestion:** Add a "Private by design" block with three tiles:
  - "Just an email and a password. Your email is never shown to anyone."
  - "Nobody sees anything until you say yes. Your prices, shops, notes and Log are never shared."
  - "No ads, no trackers, nothing sold. This page doesn't even use cookies."

  Under the hero buttons: "Sign up with an email in a minute. Face ID optional."

  Check the wording against the app's Source fix (Part 1, finding 7), so it stays true.
- **Size:** Big / Quick.

**4. "Know your plug" is still there** (still open from 2026-10-26)
- **What:** Card 3 is still headed "Know your plug". In UK slang a "plug" is a dealer.
- **Where:** Card 3.
- **Why it matters:** Posts now make the app look social, so a page that seems to talk about dealers is even more of a moderator and press risk.
- **Suggestion:** "Know your brands", with this body: "Every brand and shop gets its own page: what you got, how it scored and what you spent."
- **Size:** Big / Quick.

**5. No 18+ line** (still open from 2026-10-26; reopens D63)
- **What:** There's no age line anywhere on the site.
- **Where:** The top pill and the footer.
- **Why it matters:** The site now leads to a social feed, so this matters more than it did.
- **Suggestion:**
  - Pill: "Free · 18+ · no ads · best on iPhone".
  - Footer: "For adults 18+. A personal journal: nothing is bought or sold here."
  - Do it together with the app's 18+ tick (Part 1, finding 3).
- **Size:** Big / Quick.

**6. Search engines still can't tell what it is** (still open from 2026-10-26)
- **What:** The title is "Green Tracker · rate your stash, remember the fire". The description and `og:description` never say cannabis, strain or journal, and the `og:description` just repeats the headline.
- **Where:** `index.html` lines 6–13.
- **Why it matters:** Search is the only free channel that keeps working with no effort, and this page can't be found for what people actually type.
- **Suggestion:**
  - Title: "Green Tracker: a free cannabis journal to rate, rank and share what you try".
  - `og:description`: "Rate every strain, cart and edible out of 10, rank your top shelf, and share the best with friends you approve. Free, private, no ads. 18+."
  - `og:title`: "Green Tracker: your stash, ranked".
- **Size:** Medium / Quick.

**7. The step 1 picture shows the wrong address** (still open from 2026-10-26)
- **What:** The Safari bar in step 1 still reads `green-tracker.workers.dev`.
- **Where:** home.txt line 86.
- **Why it matters:** It's a small trust slip, and some people will type what they see.
- **Suggestion:** Show `green-tracker.green-tracker.workers.dev`, or shorten it visibly with an ellipsis. Also add the in-app-browser tip from last round: "Opened this from WhatsApp or Instagram? Tap ⋯ and Open in Safari first."
- **Size:** Medium / Quick.

**8. "Roll one up and sign up." as the closing line** (still open from 2026-10-26; Anton's call)
- **What:** The closing call to action tells the reader to roll a joint.
- **Where:** The final section (`.final`).
- **Why it matters:** It's still the line that reads most like encouraging use. Sam likes it, so it's a judgement call.
- **Suggestion:** If the site is ever posted to forums, swap it for "Your top shelf is waiting." Keep "Free. No ads. Takes a minute."
- **Size:** Medium / Quick.

**9. No FAQ, and the questions have changed** (still open from 2026-10-26)
- **What:** The page still has no FAQ.
- **Where:** Between "Get it" and the final call to action.
- **Why it matters:** People's doubts are now different: why an email, what if I forget my password, who sees my posts. Each unanswered one is a reason not to sign up.
- **Suggestion:** Five short questions:
  - "Why an email?" Only for signing in; never shown to anyone.
  - "Who sees my posts?" Only followers you've approved.
  - "Forgot my password?" Answer honestly, matching where Anton's to-do list stands.
  - "Android?" Works in any browser.
  - "Is it legal?" It's a personal journal; nothing is sold.
- **Size:** Medium / Some work.

**10. Laptop layout and QR code** (still open from 2026-10-26)
- **What:** On a laptop, the hero text and the sections below still start at different points, and there's still no QR code for laptop visitors.
- **Where:** laptop-home, laptop-home-full.
- **Why it matters:** Links shared in group chats get opened on laptops, and those visitors can't easily get the app onto their phone.
- **Suggestion:** Line up the hero text and the sections, and add a QR code stored with the site (so nothing loads from elsewhere) next to step 1.
- **Size:** Small / Quick to Some work.

**11. The 404 page and the small words** (still open from 2026-10-26)
- **What:** The 404 page still says "There's nothing here. Head back and try again." "Peep" (an American word) and "Snap the nugs" are unchanged.
- **Where:** `404.html`, cards 2 and 4.
- **Why it matters:** These are small things, but they're quick to fix.
- **Suggestion:** Use last round's wording table. "Peep your mates' picks" goes anyway if card 4 is rewritten (finding 1).
- **Size:** Small / Quick.

### Getting the word out (both parts)
- **Realistic channels:**
  - Word of mouth through an invite button (Part 1, finding 4) and shareable post pictures (Part 1, finding 5).
  - UK cannabis subreddits, Discords and patient forums, posted as the maker: "I built a free, private journal for rating what you try".
  - Search, once the page says what it is.
  - Unpaid small creators in the UK medical-patient space.
- **Before posting anywhere public:** the 18+ line, "Know your plug" fixed, and the privacy block. Moderators judge the landing page.
- **Off-limits:**
  - Paid ads on mainstream platforms.
  - Anything about where to buy (which is also why the shop icon matters).
  - "Use more" wording.
  - Made-up user counts or reviews.
  - Public posts. The Feed must stay approved-followers-only (D77); never add a public "explore" feed for growth.

### What's already great
- **The headline, the gradient and the type.** It still looks like a funded start-up.
- **The how-to video and the updated step 2** ("View More", the ⋯ tip): the install route is better than last round.
- **The "Go on, rate it" slider** and its verdicts.
- **Nothing loaded from elsewhere, no cookies.** It's a provable trust story, so keep it when adding pictures or a QR code.
- **Only two buttons**, repeated at the end.

*Limits:* I judged Chromium screenshots with made-up data. I couldn't check on a real iPhone the Home Screen label, iCloud Keychain's password prompt, how the Looks move, the in-app browsers of WhatsApp and Instagram, or the real link preview. Those need Anton's phone.

**Files referred to:**
- /home/user/green-tracker/client/src/screens/SignIn.tsx
- /home/user/green-tracker/client/src/screens/Privacy.tsx
- /home/user/green-tracker/client/public/manifest.webmanifest
- /home/user/green-tracker/site/public/index.html
- /home/user/green-tracker/site/public/og.png
- /home/user/green-tracker/site/public/404.html
- Screenshots in /home/user/green-tracker/.playwright/review/app/ (01, 01b, 02, 04, 05, 05b, 05d, 05e, 12, 18b, 21, 24, 40-look-outrun, 40-look-daymint) and /home/user/green-tracker/.playwright/review/site/