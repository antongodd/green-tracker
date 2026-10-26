# Marketing and brand review: the app (2026-10-26)

## Overall verdict

This doesn't look like a hobby project. The Aurora Glass look is confident and of a piece: the leaf mark, the chunky display font, the glowing scores and the green-to-teal buttons carry from the welcome screen through every tab. The product page, with its big 9.1 and the "#1 on your Leaderboard" badge, is the kind of screen people screenshot. "Your stash, ranked." is a good line. Where the app falls short is everything around that core.

- **The welcome screen is built for people who already have an account.** It shows no grown-up or privacy promise, and it doesn't help someone who arrived from a shared link.
- **A new account's first minutes are lonely.** The People tab only tells you to search for usernames you don't know, and nothing in the app helps you invite anyone or show off your Leaderboard.
- **For strangers to sign up and tell their friends**, the next work isn't more features or polish. It's three things: trust signals at the door, an "invite a friend" path, and one safe, shareable picture of your Leaderboard.

## Findings (most important first)

### 1. The welcome screen's main button is for people who already have an account
- **What:** The big filled button is "Sign in with passkey". "Create account" is a dark secondary button underneath.
- **Where:** 01-welcome; `client/src/screens/SignIn.tsx`.
- **Why it matters:** Every stranger arriving from the website or a friend's link sees signing in as the obvious next step. That's the wrong action for them, and some will tap it, fail and leave. Returning users mostly open the installed app already signed in, so they rarely see this screen.
- **Suggestion:** Make "Create account" (better: "Get started, it's free") the filled button. Make "I already have an account" the secondary one, and keep "Use a recovery code" as a small text link.
- **Size:** Big / Quick.

### 2. No age notice, and no grown-up framing anywhere at the door
- **What:** Neither the welcome screen nor the sign-up steps say "18+", and there's no line about using it responsibly or where it's legal.
- **Where:** 01-welcome, 02-signup-username.
- **Why it matters:** For a cannabis app in the UK, this is the most basic trust signal. Parents, community moderators (for example on Reddit or Discord) and journalists look for it first. Without it the app looks careless, and it gives any platform an easy reason to block or remove links to it.
- **Suggestion:**
  - Add a quiet line under the buttons: "For adults 18+. Green Tracker is a personal journal; it doesn't sell anything or tell you where to buy."
  - On sign-up step 1, add a required "I'm 18 or over" tick next to the username, in the same style as the recovery-codes tick on 04.
- **Size:** Big / Quick.

### 3. The app never makes its privacy promise up front
- **What:** The privacy story is strong, but it's buried in Settings → Privacy (24-privacy): approval-only followers, no email, no phone number, and prices, notes and the Log never shared. The welcome screen says none of it.
- **Where:** 01-welcome, 02-signup-username.
- **Why it matters:** For a UK cannabis user, "who can see this?" is the first worry. It's the biggest reason they'd hold back, and it's also the app's best selling point. Step 2's "There's no password" is a quiet advantage too.
- **Suggestion:** Add a three-point strip under the example Leaderboard on the welcome screen:
  - "No email or phone number"
  - "Private unless you approve someone"
  - "Free, no ads, no tracking"

  The website already says "Free · made for iPhone · no ads" (`og.png`), so this is also a brand-consistency fix.
- **Size:** Big / Quick.

### 4. No way to invite a friend, so the friends side starts empty
- **What:** A new account's People tab says "Not following anyone. Search for a username above." There's nothing for sharing your own username or a link to the app.
- **Where:** 05d-empty-people, 16-people-search.
- **Why it matters:** Word of mouth is this app's only realistic growth channel, and the friends feature only becomes fun once a friend is on it. Right now a keen user has to say "download this, then search for sam844m" by hand.
- **Suggestion:**
  - Add an "Invite a friend" button on the People empty state and on your own profile card. It would open the iPhone share sheet with a short message and the website link, for example: "I rate everything I try on Green Tracker. Add me: @sam844m".
  - It sends no data, only your username, and only when you choose to.
  - Optionally, a link that opens straight onto a follow request for that user.
- **Size:** Big / Some work.

### 5. Nothing in the app is made for sharing
- **What:** The Leaderboard and product page are the best-looking screens, but the only way to show them off is an iPhone screenshot. That screenshot can include prices, source names and anything else that's on screen.
- **Where:** 10-leaderboard, 12-product. The only share-sheet use in the code is for recovery codes and Export.
- **Why it matters:** "My top 5 this month" is the post that brings in new users. If sharing isn't designed, people either don't share or share more than they meant to (prices, the shops they buy from).
- **Suggestion:** Add a "Share my top 5" picture, a branded card in the current look:
  - It shows strain names, scores and type badges only.
  - No photos, prices, sources, suppliers or country unless the user turns them on.
  - A small "Green Tracker" mark and the website address in the corner.

  A matching "Share this score" card on a product page would be the next step. This is new scope that touches privacy, so it needs Anton's decision.
- **Size:** Big / Some work.

### 6. Opened in Safari, the app never says how to add it to the Home Screen
- **What:** The website walks people through "On your iPhone in 20 seconds". The app itself has no add-to-Home-Screen hint, as far as I can see in the code.
- **Where:** 01-welcome; `client/src/screens/SignIn.tsx`, which has no check for whether it's running as an installed app.
- **Why it matters:** Friends will often send the app address, not the website. Without the hint, those people use it as a browser tab, forget it and never come back. A web app that's added to the Home Screen gets kept; one left as a tab doesn't.
- **Suggestion:** When the app is open in Safari rather than from the Home Screen, show a small card on the welcome screen and after sign-up: "Add Green Tracker to your Home Screen: tap Share, then Add to Home Screen." Use the same words and icons as the website's steps.
- **Size:** Medium / Some work. Needs checking on a real iPhone.

### 7. The first empty screen asks for the biggest job
- **What:** A brand-new Leaderboard offers only "Add a product". That opens the full form on 06, which has eight sections: Basics, Classification, Origin, Ratings, Purchases, Photos, Notes and Leafly.
- **Where:** 05-empty-leaderboard, 06-add-product-empty-full.
- **Why it matters:** Anton loves the full process, but a curious stranger wants their first "oh, nice" moment within a minute. That moment is seeing their first score glow on a card.
- **Suggestion:** Change the empty-state wording to promise speed: "Rate your first one: a name and four sliders is all it takes. Add photos and prices later." On the form, the Ratings section could say the rest is optional. A "skip to rating" first-run version is a bigger change and needs Anton's decision.
- **Size:** Big / Quick for the words, Some work for a lighter first add.

### 8. The empty Log shows a scoreboard of zeros
- **What:** A new account's Log has a big "0 PRODUCTS · 0 COUNTRIES · 0g TOTAL" card above the empty-state message.
- **Where:** 05b-empty-log.
- **Why it matters:** Big zeros read as "you have nothing" rather than as an invitation. It's the least premium moment in onboarding.
- **Suggestion:** Hide the stats card until there's at least one entry, the way the Leaderboard's empty state does on 05.
- **Size:** Small / Quick.

### 9. The date box shows the US order (mm/dd/yyyy)
- **What:** The "Date tried" field on a new product shows `mm/dd/yyyy`.
- **Where:** 06-add-product-empty-full.
- **Why it matters:** UK users read it as a sign the app wasn't made for them. It's a small polish point that's easy to spot. This may only be Chromium in the screenshot set-up: the iPhone may show the UK date picker.
- **Suggestion:** Check on a real iPhone set to UK. If it shows there, set the page language to en-GB or format the date yourself.
- **Size:** Small / Quick. Needs checking on a real phone.

### 10. Colour-tier names like "Violet" and "Jade" are unexplained on the product page
- **What:** The badge on the product page reads "Violet · #1 on your Leaderboard". The edible reads "Jade · #4".
- **Where:** 12-product, 12b-product-edible (the colour names come from D48/D49).
- **Why it matters:** To a new user or a friend looking at a screenshot, "Violet" means nothing. It looks like a strain name or a bug, and it weakens the screen most likely to be shared.
- **Suggestion:** Say what the colour means: "Top colour · #1 on your Leaderboard", or "9.0+ · #1 on your Leaderboard". Keep the colour itself.
- **Size:** Medium / Quick.

### 11. The welcome screen and the website say different things
- **What:**
  - The app says "Your stash, ranked." The website and share picture say "Rate your stash. Remember the fire." (`og.png`, `site/public/index.html`).
  - The app's example cards show leaf placeholders. The website's mock-up shows coloured product thumbnails, prices and "value for money".
  - The app's example lists Wedding Cake as Hybrid, while the made-up account on 10 has it as Indica (a small slip).
- **Where:** 01-welcome against `site/public/og.png`.
- **Why it matters:** Someone who taps the shared link and then opens the app should feel they've arrived at the same place. Right now the two read like cousins rather than one brand, and the app's welcome is the plainer of the two.
- **Suggestion:**
  - Choose one main line and use it in both places. I'd make "Your stash, ranked." the headline everywhere and keep "Remember the fire." as the website's playful second line.
  - Give the welcome's example cards the same coloured thumbnails as the website, and add a third line under the headline that mentions prices and value for money, which the app now does well (D66, D67).
- **Size:** Medium / Quick.

### 12. The four looks all look like one app, but the differences barely show at first glance
- **What:** In the Leaderboard screenshots, Holo Pearl (40-look-pearl) and Aurora (10) are almost the same at a glance, and Neon mostly changes the card colours. In the Appearance preview (21) the four look tiles are tiny.
- **Where:** 21-appearance, 40-look-*.
- **Why it matters:** For the brand this is good: nothing looks off-brand, and they feel premium and consistent. But a "four looks" feature people can't tell apart doesn't feel like a reward, and it's one of the fun things worth showing off.
- **Suggestion:** Give each look one clear signature on the Leaderboard. For example, Pearl's rainbow edge on every card and Forest's warmer background. Then make each Appearance tile a mini preview of that signature rather than a generic bar. This needs checking on a real iPhone, because the moving lights may already make the difference clearer than a still picture can.
- **Size:** Medium / Some work.

### 13. The Home Screen name may be cut off
- **What:** The installed app's `short_name` is "Green Tracker", which is 13 characters including the space.
- **Where:** `client/public/manifest.webmanifest`.
- **Why it matters:** The iPhone usually shortens Home Screen labels of about 12 or more characters to something like "Green Track…". That looks unfinished right next to polished apps. I'm guessing here: it depends on the iOS version and the font.
- **Suggestion:** Check on Anton's phone. If it's cut off, use "Green" or "GreenTrack" as the short name, and keep the full name everywhere else.
- **Size:** Small / Quick. Needs checking on a real phone.

### 14. The username step could sell the friends side better
- **What:** "People search for you by this name. It's the only thing others see until you approve them." This is reassuring and accurate, but it only says what's hidden.
- **Where:** 02-signup-username.
- **Why it matters:** It's a chance to say why you'd want friends on the app at all.
- **Suggestion:** "Friends find you by this name. Until you approve them, it's all they see. Pick something you don't mind them knowing; it doesn't need to be your real name." The last part is a quiet privacy tip that UK cannabis users will appreciate.
- **Size:** Small / Quick.

### 15. Getting the word out: what's realistic, and what to avoid
Not a screen, but the app needs to be ready for these channels.
- **What works:**
  - Word of mouth through the invite link (finding 4).
  - UK cannabis subreddits and Discords, and private patient communities. UK medical-cannabis patients are a strong, legal audience who already compare products and prices, so a "rate your prescriptions" angle is worth considering.
  - Small creators in that patient space, approached by message and not paid.
  - The website ranking in search for terms like "cannabis strain journal app" or "weed rating app UK".
- **What's off-limits:**
  - Paid ads on Meta, Google or TikTok.
  - Anything that says or suggests where to buy.
  - Any wording that reads as encouraging people to use more. The website's "Roll one up and sign up." is the line closest to that, so worth a second look in the website round.
- **Why it matters:** These channels depend on the trust signals above (findings 2 and 3). Moderators remove links that look careless.
- **Size:** Medium / Some work.

## What's already great (don't break these)
- **The welcome headline** "Your stash, ranked." It's short, clear and confident, and the fanned example Leaderboard shows the product right away using made-up data.
- **The product page hero** (12-product). The big score, the crown badge and the photo behind it make it the app's most screenshot-worthy screen.
- **One consistent brand.** The leaf mark, the display font, the green-to-teal buttons and the glowing score colours are the same across every screen, the icon and the share picture. The app icon is simple and works at small sizes.
- **Sign-up is three steps with a progress bar, and there's no password.** The wording on the passkey and recovery-code steps is clear and calm.
- **The privacy set-up** (24-privacy, 24b-privacy-preview). Approval-only followers, a preview of exactly what followers see, and a plain list of what's never shared. This is a real trust asset: put it forward rather than changing it.
- **The empty-state drawings** (podium, notebook, people) are on brand and friendly.
- **The tone is grown-up throughout:** no stoner jokes in the app itself, which is the right register for strangers and moderators.

*Limits:* I judged Chromium screenshots with made-up data, not a real iPhone. The Home Screen label, the date picker, how the looks animate and the add-to-Home-Screen flow all need checking on Anton's phone.
