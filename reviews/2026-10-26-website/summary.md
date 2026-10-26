# Review panel: the website (2026-10-26)

## In a nutshell
All five reviewers like the site. They say it looks like a funded start-up's page: the headline, the glass phone, the "Go on, rate it" slider and the share picture all work, and it really does load nothing from anywhere else. The weak spots are trust and the route from "interested" to "installed", not polish. Three things matter most:
1. **Say the privacy facts out loud.** There's no email, no phone number and no password, just a username and Face ID. Your supplier and prices are never shared. You can export or delete. Today the only privacy line is a small grey footer. Four reviewers raised this.
2. **Fix the install route.** Links opened from WhatsApp or Instagram open inside those apps, not Safari. Step 1 sends people away before they read steps 2 and 3. Laptop visitors can't get the site onto their phone. The app itself never suggests adding it to the Home Screen.
3. **Tidy the hero picture.** The "£9.50/g · value for money" chip shows a price, not value for money, and it covers Gushers Rosin's 8.8 on the phone, the laptop and the share picture.

An 18+ line and the risky slang ("Know your plug", "Roll one up") come up again and again. The 18+ line reopens D63, so it's under Ideas.

## Quick wins (big difference, little work)
1. **Add a short "Private by design" block.** Put three glass tiles after "What it does", and one line under the hero's Sign up free button: "No email, no phone number, no password. Just a username and Face ID." Raised by Marketing, the Investor, Sam and (on the footer) the Proof-reader. *Checked:* sign-up is username → passkey → recovery codes (`CreateAccount.tsx`), and D2 keeps Supplier away from followers. **Word it carefully so it stays true:**
   - Say "suppliers" and prices are private, not "sources". Source (the brand) **is** shown to followers by default, which is the app round's Quick win 3. The Investor's "nobody can find your sources but you" would be wrong.
   - "Delete for good" must match the app's privacy notice once it exists. The app round found the database keeps restore-to-an-earlier-moment backups (Cloudflare Time Travel).
   - "No cookies" is true of this page, so say "this page".
   Keep it in step with the app's privacy wording (app Quick win 3 and the privacy-notice idea). **Size: Big · Effort: Quick.**
2. **Fix the value-for-money chip.**
   - Relabel it "£9.50/g · price", or show a real value-for-money figure the way D67 does.
   - Move it off the score column.
   - Redraw `og.png` (from `site/og.html`).
   Raised by all of Marketing, the Proof-reader, Sam and the App developer. *Checked:* `index.html` line 58, and `.c2 { right: 0; top: 250px }` in `site.css`. The chip covers 8.8 on phone-home, laptop-home and the share picture. **Size: Medium · Effort: Quick.**
3. **Rewrite step 1 of "Get it".**
   - Title: "Open the app in Safari".
   - Text: "Tap **Sign up free** above. Opened this from WhatsApp, Instagram or Snapchat? Tap ⋯ and choose Open in Safari first."
   - Put button names in bold in steps 1–3.
   *Checked:* the app already says "This browser can't create passkeys. Open Green Tracker in Safari" (`CreateAccount.tsx` line 131), so people arriving from those apps really can hit a wall. The exact menu wording inside each app **needs checking on Anton's iPhone**. Raised by the App developer, Sam and the Proof-reader. **Size: Big · Effort: Quick.**
4. **Check the Share step against Anton's iPhone.** The App developer believes the latest Safari hides Share behind a ⋯ button. That's from memory, not checked, so it **needs checking on Anton's iPhone** before changing anything. Anton sends three screenshots (the bottom bar, the ⋯ menu, the Share sheet), then we redraw step 2 and its words to match. **Size: Big · Effort: Quick.**
5. **Draw the real address in the Safari picture.** It shows `green-tracker.workers.dev`; the real address is `green-tracker.green-tracker.workers.dev`. *Checked:* `index.html` line 106. Raised by the App developer, the Proof-reader, Sam and the Investor. **Size: Small · Effort: Quick.**
6. **Change "Know your plug" to "Know your sources"** (or "Know your brands and shops"). In UK slang "plug" means dealer. "Sources" also matches the app's Sources tab (D61). Raised by Marketing, the Investor and the Proof-reader. Sam likes the word, but the feature reads the same without it. **Size: Big · Effort: Quick.**
7. **Fix the laptop layout.** *Checked on laptop-home-full:*
   - The hero text starts further left than the sections below it. The page is 1080px wide but the sections are 860px.
   - Step 1 has an empty gap between its title and text. `.step` needs `align-content: start`.
   - Step 3 sits alone, because the steps are in two columns. Make it three across.
   - The rate card hugs the left.
   Add a laptop-width test so this can't slip again. Raised by the App developer and Marketing. **Size: Medium · Effort: Quick.**
8. **Make "Open app" and the logo link 44 points tall** (today they're about 36 and 30). *Checked:* `.btn.sm` is 8px padding with 13px text. Raised by the App developer. **Size: Small · Effort: Quick.**
9. **Give the rate slider a fixed name.** Today its label is the verdict, so VoiceOver hears a name that changes ("Fire.") and the verdict twice. Use `aria-label="Score for Blue Zushi"` and make the verdict plain text. *Checked:* `index.html` line 95 and `site.js` line 35. Raised by the App developer and the Proof-reader. **Size: Small · Effort: Quick.**
10. **The lost page:**
    - Add "Or open the app" (the app's full address).
    - Change the words to "This page doesn't exist." (Marketing) or "This page doesn't exist. Head back to the start." (Proof-reader). That also fixes "again." sitting alone on its own line (checked on phone-404).
    - Add the same theme-colour line as the front page.
    Raised by the App developer, Marketing and the Proof-reader. **Size: Small · Effort: Quick.**

## Worth doing next (bigger pieces)
1. **A one-time "Add to Home Screen" hint inside the app.** It shows only in Safari, never in the Home Screen app, with the same steps as the website. *Checked:* there's no install hint anywhere in `client/src`. This is an app change, so it needs Anton's go-ahead for that scope. It doesn't link to the website, so D63's "no link from the app" still holds. Two related things **need checking on Anton's iPhone**:
   - Does an account made in Safari stay signed in when you open the new Home Screen icon?
   - If not, add a line under step 3: "Open it and tap Sign in: Face ID does the rest."
   Raised by the App developer and Sam. **Size: Big · Effort: Some work.**
2. **A QR code for laptop visitors.** On wide screens, show "Point your iPhone camera here" next to the steps. Draw it once and store it with the site, so nothing loads from elsewhere. Raised by the App developer and Marketing. **Size: Medium · Effort: Quick to Some work.**
3. **Show what you actually rate, and the payoff.** Two options:
   - List smell, taste, burn and high in the first card, or turn the slider into three or four category sliders that make up the Overall (Sam).
   - Add a "month three" line: your top shelf, best-value buy and which shop is worth it (Investor).
   **Size: Medium · Effort: Some work.**
4. **A short FAQ:** Free? Who sees it? Lost phone? Android? Legal? Raised by Marketing. It also answers the Investor's "lost phone / export" point. The passkey and iCloud answer must be checked against how recovery really works before it goes up. **Size: Medium · Effort: Some work.**
5. **Check the live site after each deploy.** Today the tests only check the files on this computer, so nothing checks the real site after it goes up. After each live deploy, check that the real address sends the security headers and that an unknown page returns "not found". Raised by the App developer. **Size: Small · Effort: Quick.**
6. **Smoothness on older iPhones.** About 14 frosted panels sit over drifting blurred lights, and the animations never stop (not checked). Test first by scrolling on the oldest iPhone available. Only then make the lights cheaper or pause what's off screen. Raised by the App developer. **Size: Medium · Effort: Some work.**

## Ideas to think about
- **An 18+ line** in the footer or the top badge. Raised by Marketing, the Investor and Sam. **Reopens D63** ("no age or legal note"). Decide it together with the app round's idea of an 18+ tick at sign-up, so the site and the app say the same thing.
- **"A personal diary: nothing is bought or sold here"** in the footer or the cards (Investor, Sam, Marketing's footer line). Same D63 question, and it fits with the 18+ line.
- **Say "cannabis" in the title and description**, and add the search-engine basics: canonical tag, `robots.txt`, `og:image:alt`, `og:site_name`, and a better `og:description` for the link preview. Raised by Marketing and the App developer. This is a choice between discretion and being findable. Anton decides.
- **"Roll one up and sign up."** Marketing and the Investor say it encourages use and leaves out edible users. Sam loves it. D63 asked for "like a stoner wrote it". My view: change "Know your plug" (Quick win 6), and keep this line unless Anton is aiming at forums or patients. Marketing's alternative is "Your top shelf is waiting."
- **"Made by Anton"** in the footer: the Investor says it ties his name to the site. Anton's call.
- **A contact address**, a throwaway one (Investor). It matches the app round's "contact or report route" idea.
- **"Best on iPhone · works anywhere"** instead of "made for iPhone", so Android friends don't leave (Investor, Sam).
- **One line for prescription patients** (Marketing). It changes who the site speaks to.
- **Own domain before going wider** (Marketing, Investor). **Reopens D63**. Passkeys are tied to the app's address (D11), so a move needs a proper plan, and sooner is cheaper.
- **A "Pick your look" strip** showing the four looks (Sam). A picture of the add screen (Sam). A "You 8.6 · @jess 9.1" friend moment (Sam). A sign-up nudge under the slider (Marketing).
- **The logo goes to the top of the website, not the app** (Marketing). It's a small change, but the App developer treats the logo as a way into the app. Either works.
- **Long caching for the fonts** (App developer). Only worth doing if the font file names ever get a version number in them.

## Words to fix
| Where | Now | Should be |
|---|---|---|
| Hero chip (`index.html` 58, `og.png`) | £9.50/g · value for money | £9.50/g · price |
| Pretend Leaderboard header (48) | All · Score | All · Overall (the app has no "Score" option; checked) |
| "Logged" chip (59) | Logged · Blue Zushi · 3.5g (Blue Zushi is also ranked #2) | Logged · Wedding Cake · 3.5g |
| Pretend row 4 | Watermelon Gummies (cut to "Watermelon Gummi…" on laptop and share picture; checked) | Melon Gummies |
| Step 1 (105) | Open it in Safari / Tap Sign up free on this page, in Safari. | Open the app in Safari / Tap **Sign up free** above… (see Quick win 3) |
| Android line (112) | Just open the link and sign up. | Just tap **Sign up free**. |
| Card 3 (79) | Know your plug | Know your sources |
| Card 4 (84) | Peep your mates’ picks | Check out your mates’ picks (Proof-reader, Sam: "peep" is American) |
| Card 2 (75) | Snap the nugs, add what you paid… | Snap a photo, add what you paid… |
| Card 1 (70) | …and earns its colours. | …and glows in its own colours. |
| Card and step headings | Some end in a full stop, some don't | No full stop on card and step headings: "Log it, then forget it", "Tap Add, and you’re done" |
| Times (103 / 117) | "20 seconds" and "Takes a minute" | Takes a minute, start to finish (or drop one number) |
| Slider verdict (`site.js` 24) | Top shelf. Holo unlocked. | Top shelf. Shiny colours unlocked. (tone: Anton's call) |
| 404 (`404.html` 15) | There’s nothing here. Head back and try again. | This page doesn’t exist. Head back to the start. |

## What everyone liked
- **The headline and the look:** "Rate your stash. Remember the fire.", the gradient, and clearly the same brand as the app.
- **The hero phone and the share picture.** It explains the app without words and makes a crisp WhatsApp or iMessage preview.
- **The rate-it slider** and its verdicts ("Not bad. Not fire.").
- **Drawn install steps** that are honest about timing.
- **Nothing loads from elsewhere:** strict security headers and fonts stored with the site. It works without JavaScript and respects Reduce Motion. Keep this when adding a QR code.
- **Made-up products only, and only two buttons.** Don't add more.

## The sceptic's view (kept separate)
- **The hard question:** the page sells a dated record of what you bought, from whom and for how much, and never says who holds it, where it's kept or how to delete it. One footer line ("Your stash is your business") is a vibe, not a fact.
- **The risks:**
  - No age line, while the closing line is "Roll one up".
  - "Know your plug" reads as "dealer".
  - Anton's first name in the footer.
  - No contact.
  - The site's "No tracking" will be read as a promise about the app, so it must stay true there too. *Checked:* the app has no tracking or analytics code today. Note this in SPEC §4 *Website*.
  - A quick reader could mistake it for a directory of where to buy.
  - The long `workers.dev` address looks like a phishing link.
- **If deciding today:**
  1. A "Your data" block.
  2. "18+" and a throwaway contact, with no personal name.
  3. Show it's a diary, not a directory, and why you'd still use it in three months.

  He'd accept the free address for now.

## Checked and set aside
- **Investor: "nobody can find your sources but you".** That's wrong: Source (the brand) is shown to followers by default. Only Supplier is private (D2). The wording is corrected in Quick win 1.
- **Investor: "deleting is for good".** Kept out of the suggested wording until the app's privacy notice settles what backups keep.
- **Marketing and Investor: lost-phone or iCloud Keychain answers.** Plausible, but they must be checked against the real recovery flow (recovery codes exist; checked) before publishing.
- **App developer: Share is behind ⋯ in current Safari.** Not something anyone could see. It's a check on Anton's iPhone (Quick win 4), not a fact.
- **Sam: £9.50/g is unrealistically cheap for rosin.** It's made-up data. Relabelling the chip (Quick win 2) is enough.
- **Proof-reader: "Lemon Cherry Gelato chip overlaps the phone's corner".** It's a deliberate floating effect and covers nothing you need to read. Set aside.
- **Proof-reader: someone may type the drawn address.** The address is still fixed (Quick win 5); the stronger reason is the trust wobble.
- **"Logged" chip next to a ranked product.** Kept as a wording fix only; how the app treats a re-buy of a ranked product wasn't checked.

## Suggested to-do list
1. Hero picture clean-up: the chip label and position, "All · Overall", the Logged and Watermelon names, the real address in step 1, then redraw `og.png`.
2. A "Private by design" block and the "no email, no phone, no password" line, worded in step with the app's Source and privacy fixes.
3. Install steps: rewrite step 1 for WhatsApp and Instagram, then check steps 2 and 3 against screenshots from Anton's iPhone.
4. Words pass: "Know your sources", "Check out", headings, the Android line, the 404 page (from the table).
5. Laptop layout fixes and a laptop-width test, plus 44-point top links and the slider's fixed name.
6. An "Add to Home Screen" hint inside the app, and check on the iPhone whether a Safari sign-up carries over.
7. A QR code for laptop visitors.
8. Decide the trust basics for both the site and the app together: 18+, "nothing is sold here", a contact, "Made by Anton", and whether to say "cannabis" for search (reopens D63).

**To check on Anton's iPhone:** where Share is in today's Safari; how to get out of WhatsApp's and Instagram's built-in browsers; whether a Safari sign-up carries over to the Home Screen app; how smooth the lights and glass are on an older iPhone; how the real link preview looks in WhatsApp and iMessage.
