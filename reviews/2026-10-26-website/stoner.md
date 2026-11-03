# Website review: Sam (everyday flower smoker, UK)

**Verdict.** If a mate sent me this link, I'd tap Sign up. It looks expensive: dark, glowy, a proper app on the front rather than a clip-art leaf. "Rate your stash. Remember the fire." is a good line, and "what was that one?" is exactly the problem I have. The words mostly sound like how I talk ("plug", "mids", "top shelf", "bin it"), and the little rate-it slider is a good toy. Two things hold it back. First, it doesn't tell me the two facts that would make me sign up without thinking: **no email, no phone number, just a username and Face ID (a passkey)**, and **what I actually score** (smell, taste, burn, high). Second, it doesn't warn me about the one thing that will go wrong, which is opening it from a mate's WhatsApp message. It sells the leaderboard well but never shows what adding a bud looks like, and that's the bit that made me drop every other strain app.

## Findings

### 1. It never says you don't need an email or phone number
- **What:** Sign-up only asks for a username and a passkey (Face ID), but the website doesn't say so anywhere.
- **Where:** `site/public/index.html` (hero, "Get it", final section); the sign-up steps are in `client/src/screens/CreateAccount.tsx`.
- **Why it matters:** For a weed app this is the biggest trust win there is. My first thought on any "sign up" button is "what am I giving them?" The footer's "Your stash is your business" is nice, but it's a vibe, not a fact. "No email. No phone number. Just a username and Face ID" would get people over the line.
- **Suggestion:** Add it to the hero badge or right under the Sign up button, and say it again in the final "Roll one up" section.
- **Size:** Big / Quick

### 2. A link opened from WhatsApp or Instagram won't be in Safari
- **What:** Step 1 says "Open it in Safari", but a link a mate sends opens inside WhatsApp's or Instagram's own browser, and nothing tells me how to get out of it.
- **Where:** "Get it", step 1 (`#install`).
- **Why it matters:** That's how most people will arrive ("imagine a mate sent you the link"). If they sign up inside WhatsApp's browser, I'm guessing that either the passkey fails or they can't Add to Home Screen. The app itself says "This browser can't create passkeys. Open Green Tracker in Safari" (`CreateAccount.tsx`), so people will hit a wall. **This needs checking on a real iPhone.**
- **Suggestion:** Add one line to step 1, something like: "Opened this from WhatsApp or Instagram? Tap ⋯ / the compass and choose Open in Safari first." Better still, if the page can tell it's in an in-app browser, show a small banner saying the same.
- **Size:** Big / Some work

### 3. It never shows what you actually rate
- **What:** The site says "scored out of 10" but never mentions the categories (look, smell, taste, burn, high and so on) that roll up into the Overall score.
- **Where:** Hero text and the "Your stash, sorted." cards.
- **Why it matters:** Every app can do "out of 10". Breaking a bud down into smell, taste, burn and high is what makes this one for people who care about quality. Right now it reads like a star-rating app.
- **Suggestion:** Change the "Go on, rate it" toy so it shows three or four category sliders (Smell, Taste, Burn, High) that make up the Overall, or at least list the categories in the first feature card.
- **Size:** Big / Some work

### 4. It never shows how quick adding a product is
- **What:** "Log it. Then forget it." is the only nod to adding something, and there's no picture of the add screen.
- **Where:** Second feature card (camera icon).
- **Why it matters:** Adding things being a chore is exactly why I dropped other apps. Anyone who's been burned before will want to see that adding a bud is quick. The hero shows the reward (the leaderboard) but not the work.
- **Suggestion:** Add a second small phone drawing, or a three-step strip: photo, type and plug, scores. Give an honest time if it's true ("about a minute").
- **Size:** Medium / Some work

### 5. The "value for money" chip shows a price, not a value
- **What:** The floating chip says "£9.50/g · value for money", but in the app Value for money is the Overall score divided by the price per gram (`shared/domain/money.ts`, D67). £9.50/g is just a price.
- **Where:** Hero chip `c2`, on the phone, laptop and share picture.
- **Why it matters:** Comparing on value is one of my favourite things in the app, and this chip sells it wrong. It also uses the orange rosin colour, and £9.50/g for rosin is unrealistically cheap. Anyone who knows prices will clock that. Small, but it nudges the "is this legit?" feeling.
- **Suggestion:** Show it the way the app does (for example "Best value: Blue Zushi" with its number), or relabel it "£9.50/g · price". Pair it with a flower nug and a realistic flower price.
- **Size:** Medium / Quick

### 6. The value chip covers a score in the hero
- **What:** The £9.50/g chip sits on top of Gushers Rosin's 8.8, so the score is cut off ("8" or hidden).
- **Where:** `phone-home.png` (bottom right), `laptop-home.png`, and `share-picture.png` (where it's half-covered).
- **Why it matters:** It's the first thing you see, and a hidden number looks like a mistake. It's a leaderboard, and the scores are the point.
- **Suggestion:** Move the chip down a row, or over the rank and photo side instead of the score.
- **Size:** Small / Quick

### 7. The address in the Safari drawing isn't the real one
- **What:** Step 1's drawing shows `green-tracker.workers.dev`, but the real app is at `green-tracker.green-tracker.workers.dev`.
- **Where:** "Get it", step 1 picture.
- **Why it matters:** Someone comparing the drawing to their address bar will wonder if they're on the right site. It's a small trust wobble at the exact moment they're deciding.
- **Suggestion:** Show the real address, or leave it out of the drawing.
- **Size:** Small / Quick

### 8. Sign up in Safari, then install: will I have to log in twice?
- **What:** The steps say to sign up in Safari and then Add to Home Screen. I'm guessing the Home Screen app starts signed out (iPhones often keep those separate).
- **Where:** "Get it", steps 1–3.
- **Why it matters:** If I open the new icon and get a sign-in screen, I'll think it lost my account. **This needs checking on a real iPhone.**
- **Suggestion:** If it does happen, add one line under step 3: "Open it and tap Sign in: Face ID does the rest."
- **Size:** Medium / Quick

### 9. No word on whether I can take my data with me or delete it
- **What:** The page says "no tracking" but doesn't mention that you can export your stuff or delete your account (I'm assuming the app can do both; I saw Data and Privacy screens but didn't check).
- **Where:** Footer and fourth feature card.
- **Why it matters:** "What happens if I want out?" is the second trust question after "what do they know about me?". With weed, it matters more than usual.
- **Suggestion:** Add a short privacy strip: no email, no tracking, friends only see what you approve, export or delete any time.
- **Size:** Medium / Quick

### 10. Friends are the best bit, but they only get one card
- **What:** "Peep your mates' picks" is one card of text, with no picture of a mate's profile or a "your mate rated this 9.4" moment.
- **Where:** Fourth feature card.
- **Why it matters:** "My mate's on it" is what actually gets people to sign up, and comparing with friends is the fun part. Also, "peep" sounds a bit American next to all the UK slang.
- **Suggestion:** Show a small made-up comparison ("You 8.6 · @jess 9.1"). Swap "Peep" for "See" or "Check".
- **Size:** Medium / Some work

### 11. It doesn't show the looks
- **What:** The app has four looks (D65), but the site only shows Aurora.
- **Where:** Hero and feature cards.
- **Why it matters:** Making your stash look nice is half the fun for people like me and Anton. A quick row of four small phones in the four looks would sell it in a second.
- **Suggestion:** Add a small "Pick your look" strip, or let the hero cycle through the looks.
- **Size:** Small / Some work

### 12. "Made for iPhone" up top might put Android mates off
- **What:** The badge says "made for iPhone", and the Android note is a small line near the bottom.
- **Where:** Hero badge; the "On Android or a computer?" line.
- **Why it matters:** In any group of mates someone's on Android. They'll read the badge and close the page before they reach the note.
- **Suggestion:** Change the badge to "Free · best on iPhone · works anywhere · no ads", or move the Android line up near the buttons.
- **Size:** Small / Quick

### 13. Nothing says it's for adults or that nothing's sold here
- **What:** There's no "18+" note and nothing saying the app doesn't sell or supply anything.
- **Where:** Footer.
- **Why it matters:** "Know your plug" plus "Roll one up" could make a cautious person (or whoever hosts the site) wonder what this is. One line makes it clearly a personal diary.
- **Suggestion:** Add to the footer: "For adults. A personal diary: nothing is bought or sold here."
- **Size:** Small / Quick

## What's already great
- **The look.** The glowy dark background, the chunky title, and the holo leaderboard rows that change colour by score. It feels like a nice place to keep your stash. The laptop layout is clean too.
- **The tone.** "Remember the fire", "The mids sink", "1 · bin it / 10 · top shelf", "Roll one up and sign up", and the 404's "Lost the lighter?" all made me smile without being cringe.
- **The rate-it slider.** The verdicts ("Mids. Straight to the bottom.", "Top shelf. Holo unlocked.") and the row changing colour are fun, and they make the point in a few seconds.
- **The install steps.** Drawn steps showing the Share button and "Add to Home Screen" highlighted: exactly what a non-techy mate needs.
- **The share picture.** It looks great as a WhatsApp or iMessage preview: big title, the app's leaderboard, and "Free · made for iPhone · no ads".
- **Privacy basics.** It loads nothing from anywhere else (no tracking), says "Only if they say yes" about friends, and uses only made-up products. Keep all of that.

Caveat: this is based on Chromium screenshots and the code, not a real iPhone. Findings 2 and 8 (in-app browsers and staying signed in after install) especially need a real-phone check.
