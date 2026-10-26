# Sceptical investor review: Green Tracker app (26 Oct 2026)

## Overall verdict

This is a beautifully made app built for one very specific person, and it shows. The craft is well above what I'd expect from a hobby product: passkeys with no email, a careful rule for what followers can see, a delete that really deletes, and a look that most funded start-ups would envy. But you've asked strangers to sign up, and to a stranger it's a polished notebook with no obvious reason to come back and no way to bring friends in. The bigger issue is risk. The app now keeps a tidy, dated, priced record of buying an illegal drug in the UK, including a "Bought here" list of named suppliers with money spent at each. If I were backing it, I'd ask for one thing before any growth work: the app should help users keep less dangerous information, and tell them plainly what it holds and where. Most of what follows is about that. The rest is focus.

## Findings (most important first)

### 1. The app builds a priced, dated purchase record that could incriminate its user
- **What:** Every purchase stores the date, amount, price and supplier. Sources then adds them up per supplier ("Mo's · 2 products · £100.00 spent · Bought here").
- **Where:** 15-sources, 13-edit-product (Purchases: "7g · £80.00 · Greenleaf Club"), 10-leaderboard ("£11.43/g").
- **Why it matters:** In the UK, possession is illegal. Regular, priced purchases from a named person can also look like evidence of supply, or name someone else. Anyone holding an unlocked phone, or a police download of it, sees a ready-made summary. This is the biggest risk for every user, and nothing on screen tells them about it.
- **Suggestion:**
  - Make supplier and price optional and clearly labelled as optional.
  - Suggest nicknames or initials in the Supplier box (for example "use a nickname, not a real name").
  - Consider a "Hide money" switch that drops prices and Spent from every screen.
  - Write one honest sentence in an "About your data" screen.
  - Don't remove the feature (Anton loves comparing), but stop pushing it as the default.
- **Size:** Big / Some work

### 2. No age check, terms or privacy notice anywhere in the app
- **What:** Sign-up is a username and a passkey. Nowhere does the app say you must be 18 or over, what the app is, who runs it, where data lives, or how long it's kept.
- **Where:** 01-welcome, 02-signup-username, 20-settings (no About/Privacy notice row). D63 chose "no age or legal note" for the website, and the app follows suit.
- **Why it matters:** UK GDPR expects a privacy notice for anyone collecting personal data from the public. The data here is about drug use, which is arguably health data or data about offences, the most sensitive kind. Under-18s are the group most at risk and the one a regulator or host would ask about first. Today the only "policy" is Anton's good intentions.
- **Suggestion:**
  - Add a short "I'm 18 or over" tick at sign-up.
  - Add a plain one-screen privacy notice: what's stored, where (Cloudflare, Western Europe), who can see it, how to export and delete, and no tracking.
  - Link the notice from Settings and from sign-up.
  - This would mean reopening D63's "no age or legal note", at least for the app. I think that's worth doing once strangers are invited.
- **Size:** Big / Quick

### 3. "Delete" is immediate in the app, but database backups keep the data for a while
- **What:** Delete account removes everything at once (31-delete, SPEC §4 "Your data and account"). But SPEC notes that D1 has "Time Travel" (Cloudflare's restore-to-a-past-moment backup), so deleted rows can still be recovered for a period. I think it's around 30 days on the free plan, but that needs checking with Cloudflare.
- **Where:** SPEC.md, the PWA & hardening "Rollback" note; 31-delete.
- **Why it matters:** "It can't be undone" is true for the user but not completely true for the data. A privacy notice should say so honestly.
- **Suggestion:** One line in the privacy notice: "Deleted data disappears from backups within N days." Check the actual period with Cloudflare.
- **Size:** Medium / Quick

### 4. Source is shared with followers by default, and in practice it can be a dealer's name
- **What:** New accounts share Leaderboard, Source, Country and photos with approved followers by default (`share_source DEFAULT 1`). Per D59, when there's no brand, Anton types the coffeeshop's or seller's name into Source.
- **Where:** 24-privacy (all switches on), 24b-privacy-preview (Source shown on each row), `migrations/*privacy*`.
- **Why it matters:** Followers must be approved, which helps. But a stranger who approves a friend-of-a-friend may not realise that "Source" means "where you got it". For many UK users, that's a person. Supplier is carefully never shared (D2), yet Source can carry the same fact.
- **Suggestion:** For new public accounts, consider Source off by default. At least, add a nudge under the Source box in the editor: "Followers can see this. Use a brand, not a person." This would narrow D1 and D45 for new accounts only. Existing accounts keep what they chose.
- **Size:** Medium / Quick

### 5. There's no lock on the app itself; a 60-day sign-in means an unlocked phone shows everything
- **What:** Sessions last 60 days and renew with use (`server/lib/session.ts`). Opening the Home Screen icon goes straight to the Leaderboard, prices and Sources.
- **Where:** 10-leaderboard, 15-sources; `SESSION_TTL = 60 * DAY`.
- **Why it matters:** Phones get handed to partners, parents and police. Delete already demands a fresh Face ID (good), but reading doesn't.
- **Suggestion:** An optional "Ask for Face ID when opening" setting, using the passkey check the app already has. Even a "re-check after 15 minutes away" option would do. It needs testing on a real iPhone, because Home Screen apps behave differently.
- **Size:** Medium / Some work

### 6. Export makes an unprotected file of everything and suggests putting it in iCloud
- **What:** Export writes one plain file with every purchase, price, supplier, note and photo. The screen suggests "Save to Files to keep it in Files or iCloud Drive".
- **Where:** 27-export; SPEC §4 Export.
- **Why it matters:** That file is the whole risk from finding 1, in one document, synced to a cloud account that can be requested by authorities or reached through a shared Apple ID.
- **Suggestion:** One warning line on Export: "This file isn't locked; anyone who opens it can read everything." Optionally add a password-protected export later.
- **Size:** Medium / Quick (warning); Big job (encryption)

### 7. Nothing to report a person or content, and one owner to deal with it
- **What:** You can block someone, but you can't report a username, photo or product name. Product names, notes, Source and photos are free text and free images, visible to followers.
- **Where:** 16b-people-requests, 17-friend, 17b-friend-product (no report option); SPEC Phase 7 (Block only).
- **Why it matters:** With the public signing up, someone will post a photo with a face, a phone number in a Source, or a username that's abuse. Cloudflare's own rules on illegal content apply to Anton as the operator. Today the only way to hear about it is if someone knows Anton personally.
- **Suggestion:** At minimum, publish a contact address (in the privacy notice) for "report a problem". A "Report" item in the ⋯ menu that emails Anton would be better. Also decide in advance what he'll do when a report arrives.
- **Size:** Medium / Quick (contact) to Some work (in-app)

### 8. A stranger gets no reason to stay after five minutes
- **What:** The welcome screen says "Your stash, ranked." Then the new user faces an empty podium and a long form (06-add-product-empty: Basics, Classification, Origin, five ratings, Purchases, Photos, Notes, Leafly, Private).
- **Where:** 01-welcome, 05-empty-leaderboard, 06-add-product-empty-full.
- **Why it matters:** Anton fills this in every purchase because he loves it. Most people won't. If the first entry feels like homework, they won't make a second, and a ranking needs at least three or four products to mean anything.
- **Suggestion:**
  - Make the first add feel two-tap: name plus Overall, with "add more detail later".
  - Or steer newcomers to the Log first (14b-log-new is already short).
  - The empty Leaderboard could say "Rate three things and see your podium".
- **Size:** Big / Some work

### 9. Little brings people back
- **What:** There are no reminders, no "what's new from friends", and no "want to try" list. A friend's product page (17b) is read-only, with no "add to my Log" or "I've tried this too".
- **Where:** 17-friend, 17b-friend-product, 05d-empty-people.
- **Why it matters:** The app is used at the moment of buying, which for many users is weekly at most. Between purchases there's nothing to open it for.
- **Suggestion:** The cheapest hook is social: on a friend's product, "Add to my Log" (a wish list) or "Compare with mine". This doesn't add any new sharing of private data.
- **Size:** Medium / Some work

### 10. No way to bring friends in
- **What:** People is search-by-exact-username only. There's no invite link or "share my profile" button, and per D63 the app has no link to the website.
- **Where:** 05d-empty-people ("Search for a username above"), 16-people-search.
- **Why it matters:** The social side is the only growth engine this app has. Today it relies on reading a username out loud.
- **Suggestion:** A "Share my username" button that opens the iPhone share sheet with the site link and "follow me: @name". Keep follows approval-based, as now.
- **Size:** Medium / Quick

### 11. Too many surfaces for one person to keep running
- **What:** Five tabs, four looks, three Leaderboard tops, colour presets, sounds and ticks, an on-phone AI cut-out with a 48MB model, currencies with an outside rate service, and brands and suppliers.
- **Where:** 20-settings, 21-appearance, 22-sounds, 23-currency, 40-look-* screens.
- **Why it matters:** Every one of these needs testing whenever anything changes, by one non-developer and an AI. The rate service (Frankfurter) is an outside dependency, and if it changes, purchases in other currencies can't be saved. That's fine for a hobby, but it's a lot of moving parts for strangers to rely on.
- **Suggestion:** I'd freeze new looks and decoration. If anything is cut, the sounds and ticks screen and the Neon/Pearl/Forest looks are the least core. Spend the effort on findings 1–8 instead.
- **Size:** Medium / Quick (a decision, not code)

### 12. Single-person dependency, and no visible plan if it breaks or stops
- **What:** Anton is the only operator. There's no status page, no contact, and no statement of what happens if he shuts it down.
- **Where:** 20-settings (only a version number); SPEC "Rollback".
- **Why it matters:** Strangers trusting it with years of notes deserve to know the app is a hobby and that Export is their safety net.
- **Suggestion:** One line in the privacy notice or Settings: "Run by one person as a hobby. Export now and then to keep your own copy." Add a contact address.
- **Size:** Small / Quick

### 13. Costs grow with photos, and there's no cap
- **What:** Each photo is stored as an original (1600px), a crop and a thumbnail, and cut-outs add PNGs. There's no visible limit per user. The server is on Cloudflare's free plan (SPEC Photos: "the free plan's CPU budget").
- **Where:** SPEC §4 Photos; 12-product photo grid.
- **Why it matters:** For friends it's pennies. A few hundred keen strangers, or one abuser uploading in bulk, could push storage past the free allowance, and Anton pays.
- **Suggestion:** A sensible per-account photo cap (for example 20 per product, a few thousand per account). Also set a billing alert in Cloudflare. Sign-up is already limited to 10 an hour per network (good).
- **Size:** Small / Quick

### 14. App store and hosting exposure (a guess, worth checking)
- **What:** The app is a Home Screen web app on a `workers.dev` address, not an App Store app, so Apple's cannabis rules don't apply. Cloudflare's acceptable-use terms do.
- **Where:** General; SPEC D11.
- **Why it matters:** I haven't checked Cloudflare's current terms on cannabis content. The app doesn't sell anything, which helps a lot. But if Cloudflare ever objected, every passkey is tied to that exact address (D11), so moving would force everyone onto recovery codes.
- **Suggestion:** Read Cloudflare's acceptable-use terms once, and keep the "personal journal, no selling, no listings" framing visible. Keep Export prominent as the escape route.
- **Size:** Small / Quick

## What's already great (don't break it)

- **No email, no phone number, just a passkey and recovery codes (D4).** There's very little to leak about who a user is. It's a real selling point, and the app should say so on the welcome screen.
- **The follower rules are serious.** Followers come from an allow-list, Supplier and prices are never shared (D2), the date tried is hidden (D3), blocked people are invisible, and photos are 403 whether or not they exist. The Privacy screen (24) with "Open their view" (24b) is the clearest I've seen in a small app.
- **Delete account (31) is honest and safe.** It lists exactly what goes, offers Export first, and needs Face ID as well as the typed username. It wipes the photo storage too.
- **Photos are processed on the phone,** and the cut-out AI never sends photos anywhere (D26). Redrawing on the phone should also drop the hidden location data that iPhone photos carry. That's worth confirming on a real iPhone with a photo taken with Location on.
- **No trackers, and network addresses are stored only scrambled (hashed) for rate limits.** Data stays in Western Europe.
- **The look.** The welcome screen (01) sells the idea in a single glance.

## If I were deciding today

- **Show me the app helps users carry less risk:** optional or "Hide money" prices and suppliers, a nickname nudge, a Face ID lock, and a warning on Export. Then I'd stop worrying that the product's best feature is also its biggest liability.
- **Show me the basics a public service needs:** an 18+ check, a one-screen privacy notice (what, where, how long, backups, contact), and a way to report someone.
- **Show me a second visit:** a two-tap first entry, a share-my-username button, and one reason to open it between purchases. If friends don't invite friends, this stays a beautiful app for Anton and his mates, which is a perfectly good outcome if that's what he wants.

*Optional, only if he ever wanted to cover running costs:* a "buy me a coffee" donation link. It's legal and simple, and it doesn't touch cannabis sales. I wouldn't do more than that.

*Limits:* this is based on the screenshots (Chromium, made-up data), SPEC.md and a light read of the server code. I couldn't test Face ID, the real Home Screen app, what's left in iPhone photos, or Cloudflare's current terms and backup period. Those need checking.
