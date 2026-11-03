# Website review: app developer and designer (2026-10-26)

**Overall verdict.** This is a good-looking, lean and honest little site. It loads nothing from anywhere else. It is small (about 100 KB before the pictures), it still works with JavaScript off, it respects Reduce Motion, and the first screenful on a phone shows the pitch and both buttons. The share picture is crisp. My worries are about what happens *after* a stranger is interested. The three install steps may not match the Safari on today's iPhones, and step 1 sends people away from the steps before they've done steps 2 and 3. People arriving from Instagram, Snapchat or TikTok, or on a laptop, have no real route onto their iPhone. On top of that there are a few layout slips on a laptop and a score hidden behind a floating chip. I can't use a real iPhone, so anything about smoothness, blur and Safari's menus needs checking on Anton's phone.

## Findings

### 1. The "add to Home Screen" steps may describe an older Safari
- **What:** Step 2 says "Tap Share" and the picture shows a Share button next to the address bar. On recent iPhones (iOS 26, the current version), Safari's usual layout puts Share inside the **⋯** button at the bottom. A stranger may not find the button the site describes. *This is from my knowledge of iOS, not something I could see.*
- **Where:** `site/public/index.html` lines 105–110 (steps 1–3 and their pictures); screenshot `phone-home-full.png`, "Get it".
- **Why it matters:** These steps are the whole route from interested to installed. If step 2 doesn't match the phone, people give up. This matters for every new user. It matters less for Anton, who already knows the way.
- **Suggestion:** Anton takes three screenshots on his own iPhone in Safari: the bottom bar, the menu behind ⋯, and the Share sheet. Redraw the pictures and reword step 2 to match, for example "Tap ⋯, then Share, then Add to Home Screen" if that's what his phone shows.
- **Size:** Big / Quick.

### 2. Step 1 sends people away before they've seen steps 2 and 3, and the app never reminds them
- **What:** Step 1 says "Tap Sign up free on this page, in Safari". That leaves the website for the app, so steps 2 and 3 are no longer on screen. The app itself never suggests adding it to the Home Screen: I searched `client/src` and found no install hint.
- **Where:** `index.html` line 105; there is no install hint anywhere in `client/src`.
- **Why it matters:** Many people will sign up in a Safari tab and never add the app. Then it feels like a website, not an app. There's a second, possible problem, which I can't confirm and which needs checking on a real phone: an iPhone may keep the Home Screen app's sign-in separate from Safari's. In that case people who sign up in Safari would have to sign in again inside the Home Screen app. Passkeys make that quick, but it's still confusing.
- **Suggestion:** Either reorder the steps (open the app → Share → Add to Home Screen → open it from the Home Screen → sign up there), or keep this order and add a small one-time banner in the app. The banner would appear only in Safari, never in the Home Screen app, and say "Add Green Tracker to your Home Screen" with the same steps. The banner is a change to the app, so it needs Anton's go-ahead for that scope.
- **Size:** Big / Some work.

### 3. People who open the link inside Instagram, Snapchat, TikTok or Messenger can't follow the steps
- **What:** A link tapped inside those apps opens in the app's own built-in browser. That browser has no "Add to Home Screen". Step 1's title says "Open it in Safari" but doesn't say how to get there.
- **Where:** `index.html` line 105; `site/public/site.js` (it has no check for this).
- **Why it matters:** Anton wants the public to sign up, and strangers often arrive from social media. They will reach step 2 and find no such option.
- **Suggestion:** Add one plain sentence to step 1: "Opened this from Instagram or Snapchat? Tap ⋯ and choose Open in Safari (or Open in browser) first." Optionally, `site.js` could recognise these built-in browsers and show that line at the top. It would still send nothing anywhere.
- **Size:** Medium / Quick.

### 4. On a laptop, "Put it on my iPhone" has no way across to the phone
- **What:** On a laptop the button scrolls to instructions that begin "Open it in Safari… Tap Share", which can't be done on a computer.
- **Where:** `laptop-home-full.png`; `index.html` line 41 and the "Get it" section.
- **Why it matters:** Anyone who finds the site on a computer has to copy the address to their phone by hand.
- **Suggestion:** On wide screens (the existing `min-width: 900px` rule), show a QR code for the site's address with "Point your iPhone camera here". Draw it once as an SVG stored with the site, so the "nothing from anywhere else" rule still holds.
- **Size:** Medium / Quick.

### 5. Laptop layout slips: content edges don't line up, there's an odd gap in step 1, and step 3 sits alone
- **What:** On a laptop:
  - The headline starts further left than every section below it.
  - In the step 1 card, the line "Tap Sign up free…" sits well below its title, with a strange empty gap.
  - Step 3 sits alone with an empty space beside it.
  - The "Go on, rate it" card hugs the left side, with nothing on its right.
- **Where:** `laptop-home-full.png`. Code in `site/public/site.css`:
  - The hero sits in the 1080px-wide `.page`, but `.sec` and `.final` are capped at 860px (lines 204 and 209).
  - `.step` (line 153) has no `align-content: start`. When card 1 is stretched to match card 2's height, the extra space is shared out between its rows.
  - `.steps` is two columns across (line 208), but there are three steps.
- **Why it matters:** Visitors who find the site on a computer see an unfinished-looking page. Anton cares a lot about looks.
- **Suggestion:**
  - Give the hero the same 860px width, or widen the sections to match it.
  - Add `align-content: start` to `.step`.
  - On a laptop, show the steps three across, or one under another.
  - Centre the rate card, or put a short line of text beside it.
- **Size:** Medium / Quick.

### 6. The "£9.50/g value for money" chip hides a score in the phone picture
- **What:** The floating chip covers Gushers Rosin's score (8.8): fully on a laptop, partly in the share picture, and on a phone it also covers the end of the row's name. The point of the picture is "products ranked by score", so hiding a score works against it.
- **Where:** `phone-home.png`, `laptop-home.png`, `share-picture.png`; `site.css` line 123 (`.c2 { right: 0; top: 250px }`), and the same placement in `site/og.html`.
- **Why it matters:** It's a small thing, but it's in the first thing people see, and in every WhatsApp or iMessage preview.
- **Suggestion:** Move the chip so it sits between two rows' scores, or over the phone's empty bottom area. Then redraw `og.png`.
- **Size:** Small / Quick.

### 7. Lots of things move all the time; this may stutter and warm up older iPhones
- **What:** About 14 frosted-glass panels sit over 5 large blurred lights that drift forever. The holo rows, the shine sweeping across the button, the pulsing dot, the tap hints and the floating phone also never stop, even when they are off screen. The page offers no way to pause the movement (only the iPhone's Reduce Motion setting stops it).
- **Where:** `site.css` lines 40–46 (the blurred lights), 49–51, 61, 65–66, 116–118 and 131 (the glass panels), 60, 101–105, 164 and 171 (the animations that never stop).
- **Why it matters:** Each blurred panel has to be redrawn whenever the lights move behind it. On an iPhone XR or 11 this can make scrolling jerky and use battery. The holo shimmer is animated in a way that forces a full repaint every frame. This needs checking on an older iPhone; I can't see it from here.
- **Suggestion:**
  - Scroll the page on the oldest iPhone available (a friend's) and watch for stutter.
  - If it stutters, draw the lights as soft gradients instead of blurring them, so the effect is cheaper.
  - Pause animations that are off screen; `site.js` already has an IntersectionObserver (code that notices when things come into view) and could do this.
  - Consider letting the drifting stop after a minute or so.
- **Size:** Medium / Some work.

### 8. The "Open app" button and the logo link are smaller than a comfortable thumb target
- **What:** "Open app" is about 36 points tall, and the logo link is 30. Apple recommends at least 44.
- **Where:** `site.css` line 58 (`.btn.sm`, 8px padding with 13px text) and line 53 (`.brand img`, 30px); `phone-home.png`, top bar.
- **Why it matters:** These are the most-tapped links for returning visitors, up in the hard-to-reach top corner.
- **Suggestion:** Give `.btn.sm` and `.brand` `min-height: 44px`. The look can stay the same with a little more padding.
- **Size:** Small / Quick.

### 9. The rate slider's spoken name keeps changing, and VoiceOver says the verdict twice
- **What:** The slider's label is the verdict text ("Fire.", "Mids…"), which changes as you drag. The slider's spoken value also ends with the verdict. VoiceOver will say something like "Fire., 9.2 out of 10: Fire., adjustable", and nothing says what is being rated.
- **Where:** `index.html` lines 95–96 (`<label for="rate" id="rate-verdict">`); `site.js` line 80.
- **Why it matters:** It's a small annoyance for blind visitors, and an easy fix.
- **Suggestion:** Give the slider a fixed name such as `aria-label="Score for Blue Zushi"`, turn the verdict label into a normal `<p>`, and keep the verdict in the spoken value (`aria-valuetext`) as it is now.
- **Size:** Small / Quick.

### 10. Search-engine basics: the page never says what it's for in words a search would match
- **What:**
  - Neither the title, the description nor the page text says "cannabis" or "weed"; it only says "bud", "cart", "stash" and "nugs".
  - There's no canonical address tag (it tells search engines which address is the real one), no `robots.txt` and no sitemap.
  - The share picture has no description (`og:image:alt`) and no site name (`og:site_name`).
  - There's no `favicon.ico`, which some browsers ask for and which currently gets the "lost" page.
- **Where:** `index.html` lines 6–18; `site/public/` (no robots.txt or favicon.ico).
- **Why it matters:** Strangers searching for "cannabis rating app" are unlikely to find it. Anton may prefer it this way for discretion; that's his call, but it should be a choice he makes knowingly.
- **Suggestion:** Ask Anton whether he wants to be findable. If yes, put "cannabis" in the title and description, and add the canonical tag, a two-line `robots.txt`, `og:image:alt` and `og:site_name`. These are quick, and none of them loads anything from elsewhere.
- **Size:** Medium / Quick.

### 11. The "lost" page only links back to the website
- **What:** Someone who mixes up the two addresses (for example types `/signup` on the website's address) sees "Back to Green Tracker", which goes to the website's front page, not the app. The lost page also lacks the top-bar colour setting that the front page has.
- **Where:** `site/public/404.html`; `phone-404.png`, `laptop-404.png`.
- **Why it matters:** It's a small dead end. The page looks lovely otherwise.
- **Suggestion:** Add a second link, "Open the app" (to the app's absolute address), and the same `theme-color` line as `index.html`.
- **Size:** Small / Quick.

### 12. The Safari picture shows an address that isn't the real one
- **What:** The step 1 picture shows `green-tracker.workers.dev`. People will actually see `green-tracker.green-tracker.workers.dev`.
- **Where:** `index.html` line 106.
- **Why it matters:** Careful people check the address bar before signing up. A mismatch can look like a scam warning sign.
- **Suggestion:** Show the real app address. It will be shortened with "…" on narrow screens, which is fine.
- **Size:** Small / Quick.

### 13. The real site's behaviour isn't checked after a deploy, and the laptop layout has no test
- **What:** The tests serve the files themselves, and always give the lost page a "not found" status. Nothing checks that the real Cloudflare site:
  - applies the security headers from `_headers`;
  - returns "not found" (rather than "OK") for the lost page.

  The "Website serves this build" step only reads `version.txt`. The layout test only tries phone widths (320, 390 and 430), so finding 5 slipped through.
- **Where:** `test/e2e/website.spec.ts` lines 32–43 and 103–109; `.github/workflows/*.yml`, the "Website serves this build" step.
- **Why it matters:** A Cloudflare settings change could quietly drop the privacy headers that D63 promises, and nobody would notice.
- **Suggestion:**
  - After the live deploy, check the real address: that `curl -I` (a request that fetches only the headers) shows the Content-Security-Policy line, and that a made-up address returns 404 (not found).
  - Add a laptop-width test that checks the sections line up with the headline, and that the step cards have no gap between title and text.
- **Size:** Small / Quick.

### 14. Repeat visits re-check every file
- **What:** `_headers` sets no caching rules, so on each visit the phone asks the server again about the fonts, CSS and pictures.
- **Where:** `site/public/_headers`.
- **Why it matters:** It's minor: the files are small and the answers are quick. On a bad 4G signal, though, each round trip adds delay.
- **Suggestion:** If the file names ever get a version in them, add long caching for `/fonts/*`. Otherwise leave it.
- **Size:** Small / Quick.

## What's already great (don't break these)
- **Nothing loads from anywhere else.** There's a strict security policy, `connect-src 'none'`, the fonts are stored with the site, and a test enforces all of this. That's a real privacy promise, well kept.
- **Small and quick:** about 9 KB of HTML, 18 KB of CSS, 2 KB of script and 75 KB of fonts, with the fonts preloaded.
- **Still works without JavaScript:** blocks are visible from the start and only animate if the script runs.
- **Reduce Motion stops everything,** including the script-driven animations, and a test checks it.
- **Safe-area gutters and `viewport-fit=cover`** are handled properly, nothing spills sideways at 320–430px, and zooming isn't blocked.
- **The phone's first screenful** shows the brand, the pitch and both buttons.
- **The phone picture is one labelled image** for VoiceOver (`role="img"`), not dozens of fake rows read aloud.
- **A readability-over-the-lights test** that goes all the way down the page.
- **The share picture** is sharp and on-brand at 1200 × 630.
- **The honest Android/computer note** and the friendly copy suit the audience.

## Limits
I reviewed screenshots from Chromium standing in for Safari, plus the code. I couldn't check:
- Safari's current menus (findings 1–3);
- whether a sign-up in Safari carries over to the Home Screen app (finding 2);
- how smooth the blur and the lights are on real, especially older, iPhones (finding 7);
- how the link preview really looks in WhatsApp and iMessage.

All of these need checking on Anton's phone.
