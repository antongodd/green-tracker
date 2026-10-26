# Sceptical investor: the website (2026-10-26)

## Overall verdict

This is a good-looking page that makes one clear promise: rate your weed out of 10 and you'll remember what was good. In ten seconds I know what it is, who it's for and that it's free. The glass phone, the slider and the link-preview picture are better than most funded start-ups manage. But I'd be uneasy putting my name to it.

The page asks strangers to keep a record of what they bought, what they paid and who they bought it from ("Know your plug"). It never tells them who holds that record, where it's kept, or how to get rid of it. The only reassurance is one footer line, "Your stash is your business." It says nothing about age, and it closes with "Roll one up and sign up."

For friends who already trust Anton, that's fine. For the public he wants to reach, the copy is very confident while the trust signals are thin. A cautious person, or a journalist or a host's abuse team, would notice that gap first. Fixing it is cheap and wouldn't spoil the tone.

I've kept to the website. The app's own gaps (no privacy notice, no age tick, no report button) are in the app review and I don't repeat them here, except where the website makes a promise that depends on them.

## Findings

### 1. The page invites people to record their dealer, but never says how that record is protected
- **What:** "Know your plug" and "add what you paid and where you got it" pitch the app as a log of purchases and suppliers. Nothing on the page explains who can see that log, where it's stored or how to delete it.
- **Where:** `index.html`, features 2 and 3; footer "Your stash is your business."
- **Why it matters:** In the UK, possessing cannabis is illegal, and supplying it is a much more serious crime. A neat, dated list of "what I bought, from whom, for how much" is exactly what a careful person would think twice about. The page treats it as a selling point and offers no reassurance. A cautious visitor leaves; a careless one signs up without thinking about it. Either way it reflects on Anton.
- **Suggestion:** Add a short **"Your data"** block of three or four plain lines:
  - "Only you see your suppliers and prices. Followers never do." (This is true, per D2.)
  - "You can export everything or delete your account any time, and deleting is for good."
  - "Kept on Cloudflare's servers. No ads, no selling, no tracking."

  Also consider softening "Know your plug" to "Know your brands and shops". It's the same feature without saying "dealer" out loud.
- **Size:** Big / Quick

### 2. No age line at all, while the closing call is "Roll one up and sign up"
- **What:** The page is written for drug users, closes by telling the reader to roll a joint, and says nothing about being 18 or over.
- **Where:** The final section ("Roll one up and sign up."), the whole page; D63 ("no age or legal note").
- **Why it matters:** If a host's abuse team, a parent or a reporter looks at the page, an under-18 is the first thing they'll ask about. This page is the public face of the app. A plain "For adults (18+)" costs nothing and takes away the easiest criticism. I understand D63 chose no age or legal note to keep the tone. I think it's worth reopening now that the site is public and Anton wants strangers.
- **Suggestion:** Reopen D63 for one small line. Put "18+" in the eyebrow ("Free · made for iPhone · no ads · 18+") or in the footer. No legal essay is needed.
- **Size:** Big / Quick (needs Anton to reopen D63)

### 3. The footer puts Anton's name on a cannabis site
- **What:** "Made by Anton, for the heads."
- **Where:** Footer of `index.html`.
- **Why it matters:** It's only a first name, but with the GitHub account and the app it can be traced. If the site ever attracts the wrong attention, the person named is the one who runs the database of other people's drug purchases. For a hobby project, that's personal risk with no upside.
- **Suggestion:** Ask Anton whether he's comfortable with it. "Made by one person, for the heads" keeps the charm and drops the name.
- **Size:** Medium / Quick

### 4. Nobody to contact, nothing about who runs it
- **What:** There's no contact address, no "who runs this" and no "what if it shuts down."
- **Where:** Whole page; footer.
- **Why it matters:** For a stranger deciding whether to hand over their purchase history, "can I reach a human?" is a basic credibility test. It's also how someone would report a problem (see the app review). Today the only way in is the app itself.
- **Suggestion:** Add one footer line: "Run by one person as a hobby. Questions or problems: [address]." Use a throwaway address, not a personal one (see finding 3).
- **Size:** Medium / Quick

### 5. "No tracking" is promised for the site, but read as a promise for the app
- **What:** The footer's "No ads. No tracking." is literally true of the website, which loads nothing from elsewhere (`_headers`). Visitors will read it as a promise about the app.
- **Where:** Footer; the eyebrow "no ads".
- **Why it matters:** That's fine if it's also true of the app. If the app ever adds error reporting or a third-party service, the website becomes misleading without anyone touching it.
- **Suggestion:** Make sure the claim stays true for the app, and note in SPEC §4 *Website* that this line is a promise about both. Better still, back it up with the "Your data" block from finding 1.
- **Size:** Medium / Quick

### 6. The strongest privacy point isn't mentioned: no email, no phone number, no password
- **What:** Sign-up is a username and a passkey (Face ID). The app never asks for an email address or phone number. The website doesn't say so.
- **Where:** Hero and "Get it" sections.
- **Why it matters:** For a cannabis app, "we don't even know your email" is the single most reassuring thing you can say, and it's also a real convenience. It's the reply to my worry in finding 1, and it's missing.
- **Suggestion:** Add one line near Sign up free: "No email, no phone number, no password. Just a username and Face ID." Check the wording against the real sign-up screen.
- **Size:** Medium / Quick

### 7. The address looks like a phishing link, and the install picture shows a different one
- **What:** The app lives at `green-tracker.green-tracker.workers.dev`, and the site at `green-tracker-site.green-tracker.workers.dev`. Step 1's drawn Safari bar shows `green-tracker.workers.dev`, which is a different address.
- **Where:** "Get it" step 1 picture; every link to the app; the `og:url` setting.
- **Why it matters:** A cautious person sees a long, repeated, unfamiliar address and wonders if it's a scam. A careful one notices the picture doesn't match what's in their address bar. D63 chose the free address knowingly, and a real domain costs about £10 a year, so I wouldn't push hard. But passkeys are tied to the exact app address (D11), so if a domain is ever wanted, sooner is cheaper than later.
- **Suggestion:** Make the drawn address match the real one (or show just "green-tracker…"). Note "own domain before going wider" as a future item for Anton to decide.
- **Size:** Small / Quick (the picture); Medium / Some work (a domain, later)

### 8. Nothing tells a stranger it's a personal journal, not a marketplace
- **What:** Supplier pages, "£9.50/g value for money" and "Know your plug" could read as if the app lists or reviews dealers publicly.
- **Where:** Feature cards; the "value for money" chip in the hero picture.
- **Why it matters:** Cloudflare's rules, or anyone reporting the site, would treat "a private diary of what I tried" very differently from "a directory of where to buy." The app is the first. The page doesn't say so, so a quick reader could think it's the second.
- **Suggestion:** Add one line in "What it does": "It's your own diary. Nothing is for sale, and nobody can find your sources but you."
- **Size:** Medium / Quick

### 9. No reason to come back, and no reason to bring a friend
- **What:** The page sells the first rating, not the hundredth. The friends card ("Peep your mates' picks") is the only growth hook, and it's mostly a privacy reassurance.
- **Where:** Feature cards; final section.
- **Why it matters:** Strangers who sign up from a link need a picture of month three: your top 10, what you spent this year, which shop is worth it. That's what makes the habit stick, and Anton himself loves comparing. Friends are the only way the app spreads, and the page doesn't make "get your mates on it" a reason to sign up.
- **Suggestion:** Rewrite one card around the payoff ("After a month you'll know your top shelf, your best-value buy and which shop is worth the trip"). Reword the friends card to suggest getting your crew on it.
- **Size:** Medium / Quick

### 10. "On your iPhone in 20 seconds" skips over what happens if you lose the phone
- **What:** The install steps are clear, but nothing says that the account is tied to Face ID on this phone, or that you can export your data.
- **Where:** "Get it" section.
- **Why it matters:** A stranger who logs 50 products and then changes phone will blame the app. Saying "you can export everything" also builds trust (finding 1).
- **Suggestion:** Add one sentence under step 3: "New phone? Your passkey moves with your iCloud Keychain, and you can export everything any time." Check this is accurate for the recovery flow before using it.
- **Size:** Small / Quick

### 11. Android and computer users are an afterthought
- **What:** "Made for iPhone" sits at the top of the page, and Android gets one line at the bottom of the install section.
- **Where:** Hero eyebrow; "On Android or a computer?"
- **Why it matters:** About half of UK phones are Android. If Anton wants the public, the first thing many visitors read tells them it isn't for them. I couldn't check how the app behaves on Android here.
- **Suggestion:** Keep iPhone first, but change the eyebrow to "Free · best on iPhone · no ads" so Android users don't bounce. (I'm guessing at the effect; it's worth asking Anton who he expects.)
- **Size:** Small / Quick

## What's already great

- **Clear promise in one line.** "Rate your stash. Remember the fire." plus the "what was that one?" sentence. I knew what it was instantly.
- **Nothing loads from anywhere else.** The strict security headers and the fonts stored on the site make "No tracking" actually true for the website. That's rare and worth protecting.
- **Made-up products only.** Nobody's real data or real dealers appear, including in the link-preview picture.
- **The link-preview picture (`share-picture.png`) is excellent.** Sharing the link in a group chat is realistically the only way it grows, and this picture does the job.
- **Friends are framed around consent** ("Only if they say yes"). That's the right instinct; just extend it to the data story.
- **The install steps are concrete and honest** about the Share button and scrolling down the list.

## If I were deciding today

- **Show me a "Your data" block on the page:** suppliers and prices are private, no email or phone is asked for, export and delete are available, and where the data is kept. That turns the riskiest part of the pitch into the most reassuring.
- **One line for adults, and a contact.** "18+" and a throwaway contact address (and no personal name) would remove the two easiest criticisms. This needs D63 reopened, but only slightly.
- **Show me that it's a diary, not a directory, and why I'd still use it in three months.** Then I'd believe strangers would sign up, stay, and not cause Anton trouble.

*Limits:* I judged this from the files in `site/public/`, the phone, laptop and link-preview screenshots (Chromium, not Safari), SPEC D63 and §4 *Website*. I couldn't see the real site, the glass and moving lights on a real iPhone, or how the preview looks in WhatsApp or iMessage. The no-email point and the passkey or iCloud claim in finding 10 come from the app review and the SPEC, and should be checked against the real sign-up before they go on the page.
