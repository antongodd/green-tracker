# Proof-reader's report: the website (`site/public/`), 2026-10-26

**Overall verdict.** This is clean, confident copy. I found no spelling mistakes, the British spellings are right ("colours"), the apostrophes and quotation marks are curly everywhere I looked (`’`, `“ ”`), and the voice is the same from top to bottom. The problems are smaller ones of accuracy and consistency:
- One label in the picture of the app is factually wrong ("value for money").
- The made-up leaderboard doesn't use the app's own wording.
- The headings mix full stops and none.
- A few instructions point at "the link" or "Sign up free" without making clear what that means.
- The 404 page tells people to "try again" when there's nothing to try.

None of this is embarrassing, but a stranger reading carefully would trip on two or three of these.

I read `home.txt`, `404.txt`, every phone, laptop and share picture, and the HTML and JS: titles, descriptions, alt and aria text, and the slider's verdicts.

---

## Findings

### 1. "£9.50/g · value for money" puts a price where a score should be
- **What:** The floating chip shows a price per gram labelled "value for money". In the app, value for money is a different number: Overall ÷ price, where higher is better (`client/src/screens/Profile.tsx:110`, D67).
- **Where:** The hero picture on `phone-home.png` and `laptop-home.png`, and on `share-picture.png`. The source is `site/public/index.html:58`: `£9.50/g<small>value for money</small>`.
- **Why it matters:** It teaches newcomers the wrong meaning of a term they'll meet in the app. It's also on the picture that shows when the link is shared, so it travels.
- **Suggestion:** Either relabel it as a price, `£9.50/g` with "price per gram", or show a value-for-money figure with a short note, for example `1.01` with "value for money · score per £/g". Remember to redraw `og.png` too.
- **Size:** Medium / Quick (plus redoing the share picture)

### 2. The pretend leaderboard says "All · Score"; the app says "Overall"
- **What:** The picture's header reads "All · Score". The app's Rank by options are "Overall", "Price", "Value for money" and so on (`shared/domain/leaderboard.ts:51`). There's no "Score" option.
- **Where:** `index.html:48`, visible in every hero screenshot and in `share-picture.png`.
- **Why it matters:** It's a small mismatch, but the aim of the picture is "this is what you'll see". Someone opening the app won't find "Score".
- **Suggestion:** Change it to "All · Overall".
- **Size:** Small / Quick

### 3. The picture logs a product that is already ranked
- **What:** The chip "Logged · Blue Zushi · 3.5g" sits next to the same Blue Zushi ranked #2 with 9.2. In the app, the Log is for things you haven't rated yet.
- **Where:** `index.html:59` and the hero on every screenshot.
- **Why it matters:** It's minor, but a careful reader will wonder how something can be logged and ranked at once.
- **Suggestion:** Use a product that isn't on the board, for example "Logged · Wedding Cake · 3.5g". Swap it in `og.png` too.
- **Size:** Small / Quick

### 4. Text in the pretend leaderboard is cut off or covered
- **What:**
  - "Watermelon Gummi…" is cut short (phone, laptop and share picture).
  - On the phone, the price chip covers "Concentrate · Frosty C…" and part of the 8.8 score.
  - The "Lemon Cherry Gelato" chip overlaps the phone's corner.
- **Where:** `phone-home.png` (bottom of the first screen), `laptop-home.png`, `share-picture.png`.
- **Why it matters:** These are words a reader tries to read and can't. On a page about tidy rankings, cut-off names look careless.
- **Suggestion:** Use a shorter made-up name, such as "Watermelon Gums" or "Melon Gummies". Nudge the price chip down or right on narrow screens so it doesn't cover a row.
- **Size:** Small / Quick to Some work

### 5. Headings mix full stops and no full stops
- **What:** All four section headings end with a full stop ("Your stash, sorted.", "Go on, rate it.", "On your iPhone in 20 seconds.", "Roll one up and sign up."). The cards and steps under them are mixed:
  - "Your top shelf, ranked", "Know your plug", "Peep your mates’ picks" and "Open it in Safari" have no full stop.
  - "Log it. Then forget it." and "Tap Add. Done." do.
- **Where:** `index.html:69, 74, 79, 84, 105, 107, 109`.
- **Why it matters:** It's the kind of inconsistency that makes a page feel unproofed. Here two headings simply need two sentences, which is reasonable, but it reads as a slip.
- **Suggestion:** Rule: section headings (h2) keep their full stop; card and step headings have none, unless they are two sentences. If you'd rather avoid the exception, use "Log it, then forget it" and "Tap Add, and you’re done".
- **Size:** Small / Quick

### 6. Step 1 is circular and the button name doesn't stand out
- **What:** "Open it in Safari" → "Tap Sign up free on this page, in Safari." Someone already in Safari is told to open it in Safari. Someone in another browser on iPhone (Chrome, or the Instagram or WhatsApp in-app browser) isn't told what to do. "Sign up free" also isn't marked as a button name, so the sentence reads oddly ("Tap sign up free on this page").
- **Where:** `index.html:105`, step 1 on `phone-home-full.png`.
- **Why it matters:** Install steps are where strangers give up. Link taps from WhatsApp or Instagram open in-app browsers, which can't add to the Home Screen.
- **Suggestion:** Retitle the step "Open the app in Safari". For the text: "Tap **Sign up free** above. If this page opened inside WhatsApp, Instagram or Chrome, open it in Safari first." Put button names in bold throughout, including **Share**, **Add to Home Screen** and **Add** in steps 2 and 3.
- **Size:** Medium / Quick

### 7. The address in the Safari drawing isn't the real address
- **What:** The drawn address bar shows `green-tracker.workers.dev`. The real app is at `green-tracker.green-tracker.workers.dev`.
- **Where:** `index.html:106`, step 1.
- **Why it matters:** Someone may type what they see, and that address won't reach the app.
- **Suggestion:** Show `green-tracker.green-tracker.workers.dev`, or leave the bar blank, or blur it so nobody copies it.
- **Size:** Small / Quick

### 8. "Just open the link": which link?
- **What:** "On Android or a computer? It works in your browser too. Just open the link and sign up." The page has no single "link". There are buttons.
- **Where:** `index.html:112`.
- **Why it matters:** It's a vague instruction for the very readers who don't get the iPhone steps.
- **Suggestion:** "On Android or a computer? It works in your browser too: just tap **Sign up free**."
- **Size:** Small / Quick

### 9. The 404 page says "try again", but there's nothing to try
- **What:** "There’s nothing here. Head back and try again." After "head back" there's no action to retry. Also, on a phone the last word, "again.", wraps onto a line of its own (`phone-404.png`).
- **Where:** `site/public/404.html:15`.
- **Why it matters:** Error text should say what to do next. This one half does.
- **Suggestion:** "This page doesn’t exist. Head back to the start." That's shorter, and it should also fix the lonely last word.
- **Size:** Small / Quick

### 10. "20 seconds" here, "Takes a minute" there
- **What:** The install section promises "On your iPhone in 20 seconds." The final banner says "Free. No ads. Takes a minute."
- **Where:** `index.html:103` and `:117`.
- **Why it matters:** Strictly these are two different things (installing versus signing up), but a reader sees two different time promises a screen apart.
- **Suggestion:** Make one cover the other ("Takes a minute, start to finish"), or drop the number from one of them.
- **Size:** Small / Quick

### 11. Slang a UK stranger may not get, or may read the wrong way
- **What:** The voice leans heavily on slang: "fire", "mids", "nugs", "plug", "heads", "Peep your mates’ picks", "Holo unlocked".
  - "Peep" is American slang. A UK reader would more naturally say "have a nosey at" or "check out".
  - "Know your plug" means "know your dealer", which sits awkwardly next to the legal care in the brief.
  - "Holo unlocked" (the 9.5+ verdict in `site.js:24`) means nothing until you've used the app.
- **Where:** `index.html:79, 84, 122`; `site.js:24`.
- **Why it matters:** A playful tone is good and consistent, so keep most of it. But the brief says to judge the site as a product for strangers, and three of these are either unclear or carry a meaning Anton may not want to put in writing.
- **Suggestion:**
  - "Check out your mates’ picks" (or "Have a nosey at your mates’ picks").
  - "Know your sources" (this also matches the app's **Sources** tab, D61).
  - "Top shelf. Shiny holo colours unlocked." (or simply "Top shelf.")
  - This one is Anton's call on tone.
- **Size:** Small / Quick

### 12. The rate-it slider's name is its verdict
- **What:** The visible label tied to the slider is the verdict ("Fire.", "Mids. Straight to the bottom."). A screen reader therefore announces the slider's name as "Fire." and the name changes as you drag. Its value text already repeats the verdict ("9.2 out of 10: Fire.").
- **Where:** `index.html:95–96`, `site.js:35`.
- **Why it matters:** It's a wording problem for blind visitors. The control has no stable name such as "Score".
- **Suggestion:** Give the slider `aria-label="Score"`. Keep the verdict as plain text, not as its `<label>`.
- **Size:** Small / Quick

### 13. "Snap the nugs" leaves out carts and edibles
- **What:** The hero promises "Every bud, cart and edible". The Log card then says "Snap the nugs", which only fits flower.
- **Where:** `index.html:75`.
- **Why it matters:** It's minor, but people who mostly buy edibles may feel it isn't for them.
- **Suggestion:** "Snap a photo, add what you paid and where you got it."
- **Size:** Small / Quick

### 14. "Earns its colours" is unexplained
- **What:** "The fire floats to the top and earns its colours." A newcomer doesn't know the app colours top scores (D48).
- **Where:** `index.html:70`.
- **Why it matters:** It's a nice line, but it only makes sense to someone who already knows the app.
- **Suggestion:** "The fire floats to the top and glows in its own colours. The mids sink."
- **Size:** Small / Quick

---

## What's already great

- **Spelling and punctuation are clean throughout:** British spellings, curly apostrophes and quotes everywhere (I found no straight ones in the visible text), and the same "·" separator style in the eyebrow, the scale and the product lines.
- **The page title, meta description and share text agree:** "Rate your stash. Remember the fire." with "Free, made for iPhone, no ads", and `lang="en-GB"` is set.
- **The decorative images are hidden from screen readers properly:** the logo inside the brand link and the drawn steps. The hero picture has a sensible description ("…with made-up products ranked by score").
- **The step names match iOS exactly:** "Share", "Add to Home Screen", "Add".
- **The slider verdicts are funny and fit the voice:** "Not bad. Not fire." is a lovely line.
- **The footer is short and reassuring:** "No ads. No tracking. Your stash is your business." Keep it.

**Couldn't check:** how the page reads in real Safari on an iPhone (the screenshots come from Chromium), and what the real WhatsApp or iMessage link preview looks like. Finding 6 (in-app browsers) needs trying on a real phone.
