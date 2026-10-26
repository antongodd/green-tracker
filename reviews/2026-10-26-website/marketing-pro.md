# Marketing and brand review: the website (2026-10-26)

## Overall verdict

This is a really good-looking site for a free hobby app. It looks like a funded start-up's launch page, not a side project. The headline works and the type is confident. The glass phone with floating chips says "Leaderboard for your stash" in about two seconds, and the "Go on, rate it" slider is a fun bit of play that most sites this size don't bother with. On the phone (`phone-home-full.png`) it flows from start to finish with no dead patches, and it's clearly the same brand as the app's welcome screen. My concerns are about who it can reach and whether a stranger trusts it, not about polish:

- **Search engines and strangers can't easily tell what it's about.** The words "cannabis", "weed" and "strain" don't appear anywhere on the page.
- **It's missing the trust signals a cautious UK visitor looks for.** It doesn't say 18+, and it doesn't make the privacy promise in plain terms.
- **A few slang lines are risky in public.** "Know your plug" and "Roll one up" read well to friends but could put off a moderator, a journalist or a medical patient.
- **The hero picture has one small factual slip**, the "value for money" chip.

I haven't repeated the app round's findings (the headline mismatch with the app's "Your stash, ranked.", the invite link, the share card). I only mention them where the website is directly involved.

## Findings (most important first)

### 1. The page never says "cannabis", so search engines, and some people, can't place it
- **What:** None of the title, the description, the headings or the body text say cannabis, weed, strain or journal. The only clues are "stash", "bud", "nugs" and "plug".
- **Where:** `site/public/index.html`: the `<title>`, `meta description`, h1 and h2s.
- **Why it matters:** Search is the one free, always-on channel this site can win. Someone typing "cannabis rating app UK" or "weed strain journal" will never find a page that doesn't use those words. A parent or a medical patient landing cold also has to guess. The page carries no Google-specific risk from saying it plainly. What gets flagged on mainstream platforms is ads, not a descriptive page.
- **Suggestion:**
  - Title: "Green Tracker: a free cannabis journal to rate and rank everything you try".
  - Meta description: "Rate every strain, cart and edible out of 10, track what you paid, and see your own top shelf. Free, private, no ads. Made for iPhone."
  - Under the h1, change the lede's opening to: "A private cannabis journal: every bud, cart and edible you try, scored out of 10 and ranked."
- **Size:** Big / Quick.

### 2. No age notice anywhere on the site
- **What:** Neither the page nor the footer says it's for adults.
- **Where:** `index.html` footer; `404.html`. This was a deliberate choice: D63 records "no age or legal note".
- **Why it matters:** I'd reopen D63 on this one point. A single quiet "18+" line is the cheapest trust signal a UK cannabis site can show. Reddit and Discord moderators, link-preview checkers and anyone a friend forwards it to look for it, and its absence makes a polished page look careless. It doesn't need a pop-up gate or legal wording.
- **Suggestion:** Footer line: "For adults 18+. Green Tracker is a personal journal. It doesn't sell anything or tell you where to buy." Optionally, add "18+" to the eyebrow pill: "Free · 18+ · made for iPhone · no ads".
- **Size:** Big / Quick (needs Anton to reopen part of D63).

### 3. "Know your plug" reads as "know your dealer"
- **What:** The Sources feature is headed "Know your plug". In UK slang a "plug" is a dealer.
- **Where:** "What it does", third card.
- **Why it matters:** It's the one line on the page that points at illegal supply. That's exactly what a moderator, a journalist or a cautious patient would screenshot. The feature itself, brands and where you bought things, is perfectly fine. Only the wording is the problem.
- **Suggestion:** "Know your brands." Or, keeping the cheeky tone: "Who grew the good stuff?" Body: "Every brand and shop gets its own page: what you got, how it scored and what you spent."
- **Size:** Big / Quick.

### 4. "Roll one up and sign up." makes using the call to action
- **What:** The closing heading tells the reader to roll a joint.
- **Where:** The final section (`.final`).
- **Why it matters:** It's catchy, but it's the line most likely to read as "encouraging use". That is the one thing a UK cannabis brand must avoid, and it's in the most prominent spot after the hero. It also leaves out people who don't smoke, such as edible users, vapers and patients.
- **Suggestion:** "Your top shelf is waiting." or "Start your Leaderboard." Keep "Free. No ads. Takes a minute." underneath, which is perfect.
- **Size:** Medium / Quick.

### 5. The privacy promise is the best selling point, and the page undersells it
- **What:** The only privacy words are a clause in the friends card and the small footer line "No ads. No tracking. Your stash is your business." The biggest reassurances aren't on the page at all: no email, no phone number, no password, only a username, followers by approval only, and prices, notes and the Log never shared.
- **Where:** `index.html`, the whole page; compare the app's Settings → Privacy.
- **Why it matters:** For a UK cannabis user, "who can see this, and can it be traced to me?" is the first worry. Nobody else in this space can honestly say "we don't even ask for your email". It should be loud, not in 12px grey text at the bottom.
- **Suggestion:** Add a short "Private by design" block after "What it does": three glass tiles in the same style.
  - "No email. No phone number. Just a username."
  - "Nobody sees anything until you say yes."
  - "No ads, no trackers, nothing sold. This page doesn't even use cookies."

  The last one is true and checkable (`_headers`: `connect-src 'none'`).
- **Size:** Big / Quick.

### 6. The "value for money" chip shows a price, not value for money
- **What:** The floating chip reads "£9.50/g · value for money". In the app, value for money is Overall ÷ price, a "higher is better" number (`shared/domain/money.ts`, D67). £9.50/g is just the price. The chip also sits on top of Gushers Rosin's score, hiding "8.8" on both phone and laptop.
- **Where:** `phone-home.png` and `laptop-home.png` (the `.chip.c2`); the same picture is in `share-picture.png`.
- **Why it matters:** Anyone who signs up will see value for money shown differently in the app, a small "the website doesn't match" moment. Hiding a score in the hero picture also looks like a layout slip, on the screen everyone sees first.
- **Suggestion:** Change the words to "£9.50/g · cheapest top 3", or show a real value-for-money style figure. Nudge the chip so it no longer covers the score column. Redraw `og.png` at the same time.
- **Size:** Medium / Quick.

### 7. Laptop visitors are offered "Put it on my iPhone" with no easy way to get it onto their iPhone
- **What:** On a laptop, the second button and the whole "Get it" section are iPhone instructions. The only help for a computer is "On Android or a computer? It works in your browser too."
- **Where:** `laptop-home.png` and `laptop-home-full.png`.
- **Why it matters:** A link shared in a group chat often gets opened on a laptop. That visitor is keen, but would have to type the address into their phone by hand. Most will put it off and forget.
- **Suggestion:** On wide screens only, add a QR code next to step 1: "Scan with your iPhone camera to open it in Safari." The QR code can be a plain picture stored with the site, so it keeps the "nothing loaded from anywhere else" rule (D63).
- **Size:** Medium / Some work.

### 8. The address looks untrustworthy when shared
- **What:** The site is at `green-tracker-site.green-tracker.workers.dev` and the app at `green-tracker.green-tracker.workers.dev`.
- **Where:** All links; `og:url`; what people see in WhatsApp and iMessage.
- **Why it matters:** A long, repeated, unfamiliar address is the classic look of a phishing link. That hurts most in exactly the word-of-mouth channel this app depends on. D63 chose the free address on purpose, and that's reasonable for now.
- **Suggestion:** When Anton is ready to share it beyond friends, consider a real domain, something like `greentracker.app` for around £10–£20 a year, with the site at the root and the app at `app.` in front. That would reopen part of D63, and moving the app's address affects passkeys, so it needs a proper plan. Flagging it now so it's on the list before a wider launch.
- **Size:** Medium / Big job.

### 9. No answers to the obvious questions
- **What:** The page has no FAQ.
- **Where:** Between "Get it" and the final call to action.
- **Why it matters:** A stranger's doubts are predictable, and each one left unanswered is a reason not to sign up. Their questions would be:
  - Is it really free, and why?
  - Who can see my stuff?
  - What if I lose my phone?
  - Does it work on Android?
  - Is this legal?
- **Suggestion:** Five short, collapsible questions in the same glass style. They also help search, because people literally type these questions. Suggested answers:
  - **Free?** "Yes. It's a passion project, with no ads and nothing to sell."
  - **Who sees it?** "Only people you approve, and never your prices, notes or Log."
  - **Lost phone?** "Your passkey comes with your iCloud Keychain, and you get recovery codes."
  - **Android?** "It works in any browser."
  - **Legal?** "It's a journal. It doesn't sell or supply anything."

  Check the lost-phone answer against how passkeys really behave before publishing.
- **Size:** Medium / Some work.

### 10. The slider demo ends with nowhere to go
- **What:** "Go on, rate it" is the most fun moment on the page. After it, the visitor scrolls straight into install instructions, with no nudge to sign up.
- **Where:** The "Try it" section.
- **Why it matters:** The moment straight after someone plays with something is when they're most likely to act.
- **Suggestion:** Add a small text link under the scale: "Now do it with your own stash → Sign up free". Or show it once the slider has been moved.
- **Size:** Small / Quick.

### 11. The voice is written only for recreational users
- **What:** "For the heads", "nugs", "mids", "plug" and "Roll one up" all speak to recreational smokers.
- **Where:** The whole page; the footer "Made by Anton, for the heads."
- **Why it matters:** UK medical-cannabis patients are the most legal, most organised and most comparison-minded audience for this app. They already track products and prices, but the current voice tells them it isn't for them. D63 asked for "like a stoner wrote it", so I'm not suggesting rewriting the tone. I'm suggesting one inclusive line.
- **Suggestion:** In the "Log it" card or the FAQ: "On a prescription? Track how each one works for you, and what it costs." It costs nothing and opens up a whole channel: patient forums, clinic communities and patient creators.
- **Size:** Medium / Quick.

### 12. The link-preview text repeats the headline instead of explaining the app
- **What:** The `og:description` is "Rate your stash. Remember the fire. Free, made for iPhone, no ads.", which is almost word for word what's already in the picture (`share-picture.png`).
- **Where:** `index.html` meta tags.
- **Why it matters:** In WhatsApp and iMessage the description is the only line under the picture. Repeating the headline wastes the one chance to say what the app actually is.
- **Suggestion:** `og:description`: "A private cannabis journal: rate every strain out of 10, rank your top shelf, track what you paid. Free, no ads, 18+." Consider `og:title` "Green Tracker: your stash, ranked", which also ties it to the app's welcome line (see app finding 11).
- **Size:** Small / Quick.

### 13. On a laptop the lower half feels thinner than the top
- **What:** The hero fills a wide screen well, but the sections below it leave large empty areas:
  - Step 3 sits alone in a two-column grid, with an empty space beside it.
  - The rate-it card fills only the left half.
  - The section headings start further in than the hero's text.
- **Where:** `laptop-home-full.png`.
- **Why it matters:** The design is premium, and premium is judged on the details. On a laptop it looks a little unfinished below the fold.
- **Suggestion:**
  - Put the three steps in a single row of three on wide screens.
  - Put a short "what the colours mean" note, or the FAQ, beside the rate-it card.
  - Line up the section headings with the hero's text.
- **Size:** Small / Quick.

### 14. The logo goes to the app, not the top of the website
- **What:** The "Green Tracker" logo in the top bar links to the live app, as does "Open app" next to it.
- **Where:** The header (`.brand`).
- **Why it matters:** People expect the logo to take them to the top of the site they're on. Two links to the same place, one of which looks like site navigation, is a small surprise. A visitor who hasn't signed up lands on the app's sign-in screen, which the app review already found is aimed at returning users.
- **Suggestion:** Make the logo go to `#` (the top of this page) and keep "Open app" as the single way into the app.
- **Size:** Small / Quick.

### 15. The 404 page is on brand but could do one more thing
- **What:** "Lost the lighter?" is a good line, and the page looks right. It offers only "Back to Green Tracker".
- **Where:** `phone-404.png`; `404.html`.
- **Why it matters:** It's minor. Most visitors who hit a 404 typed or pasted the address wrong and were probably looking for the app.
- **Suggestion:** Add a second, plain link: "Or open the app". Change "Head back and try again." to "That page doesn't exist." With the button below it, "try again" is redundant.
- **Size:** Small / Quick.

## Getting the word out: what the website should be ready for

- **Search:** findings 1, 9 and 12 are the whole job. A simple page that clearly uses "cannabis journal", "strain rating" and "weed tracker app UK" can rank, because there's little honest competition in the UK.
- **Communities:** UK cannabis subreddits, Discords and patient forums. Post as the maker ("I built a free, private journal for rating what you try"), not as an advert. The 18+ line and the "Know your plug" fix (findings 2 and 3) matter most here, because moderators judge the landing page.
- **Off-limits:**
  - Paid ads on Meta, Google or TikTok.
  - Any wording about where to buy.
  - Any "use more" framing (finding 4).
  - Made-up reviews or user counts. Keep the honest "Made by Anton" line instead.

## What's already great

- **The headline** "Rate your stash. Remember the fire." is memorable and fits the brand. The gradient on "Remember the fire." is lovely and readable.
- **The hero picture** explains the product without any words: a Leaderboard, scores, colours, a price. It's the strongest part of the page, and it makes a good share picture (`share-picture.png` is crisp and on brand).
- **The "Go on, rate it" slider** is a delightful, on-brand touch. Its verdicts ("Mids. Straight to the bottom.", "Top shelf. Holo unlocked.") are exactly the right voice.
- **The three install steps** have clear drawn pictures and honest timing ("20 seconds"). This is the hardest part of a web app's onboarding, and it's done well.
- **It's clearly the same brand as the app:** same leaf, same fonts, same green-to-teal button, same Aurora lights (compare `01-welcome.png`).
- **No tracking, nothing loaded from elsewhere, no cookies.** That's a genuine, provable trust story. Make it louder (finding 5), and don't break it when adding things like a QR code.
- **Two buttons only**, both clear, both repeated at the end. Don't add more.

Limits: I judged still screenshots from Chromium. I couldn't see the drifting lights, the glass blur, the scroll animations or the slider on a real iPhone, and I couldn't check how the link preview actually looks in WhatsApp or iMessage. Those need checking on Anton's phone.
