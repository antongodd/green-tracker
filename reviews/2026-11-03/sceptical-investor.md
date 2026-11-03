# Sceptical investor: the app and the website (2026-11-03)

## Part 1: the app

### Overall verdict

The craft is better than last week. The Feed is the first real answer to my old question, "why would anyone open this between purchases?", and the password work is careful: a salted hash, the same answer for a wrong password and an unknown email, and limits on wrong tries. But the risk picture has changed, and not in Anton's favour.

- **Email.** Last round, the best thing I could say about trust was "it doesn't even know your email". Now it does. A record of dated, priced cannabis purchases with named suppliers is tied to a real email address, which for most people means their real name.
- **Posts and comments.** These turn a private diary into a place where users publish to each other. In the UK that very likely brings the app under the Online Safety Act, whatever its size and even though it's free.
- **Nothing from my last list is done.** No privacy notice, no 18+ check, no way to report anything, no contact, no Export warning, and the Source wording is unchanged.
- **Meanwhile the decoration grew.** Since 26 Oct the app gained eleven looks, five colour sets, posts, multi-photo posts and a photo viewer.

I'm not asking Anton to stop building what he loves. I'm saying the basics of a public service are now overdue. They are mostly words, not code.

### Findings (most important first)

#### 1. Posts and comments very likely make this an "online service" under the Online Safety Act, and there's no reporting route, no terms and no plan
- **What:** Since D77, users publish photos and captions to each other, and comment under each other's posts. There's no way to report a post, comment or person. The only tools are Block and the poster deleting comments on their own post.
- **Where:** 18-feed (a friend's post has no ⋯ menu at all; only your own does), 18b-post, 17-friend; `client/src/` has no "Report" anywhere (checked).
- **Why it matters:** I'm not a lawyer, but as I understand it the Online Safety Act 2023 covers any service where users can share content with other users and that has UK users. It doesn't matter if it's free or tiny. The basic duties include:
  - a written assessment of the risk of illegal content;
  - a simple way for users to report content and complain;
  - terms that say how users are protected;
  - an assessment of whether children are likely to use it.

  Drug supply offences are on the Act's list of priority illegal content. A comment like "I can sort you an eighth, message me on 07…" is exactly the kind of thing it's aimed at.
  - D77 lets a commenter you never approved be seen by all the poster's followers. So one bad comment reaches people who don't know the commenter.
  - Cloudflare's own rules on illegal content apply to Anton as the operator too.
  - (Still open from 26 Oct: "Nothing to report a person or content".)
- **Suggestion:**
  - A "Report" item on every post, comment and profile. It can simply hide the item from the reporter and save a row Anton can look at; no email needed.
  - A one-page set of terms: no selling, no offering to supply, no phone numbers or addresses, no faces without consent, 18+.
  - A short written risk note, kept in `design/`.
  - Anton should run Ofcom's online "does the Online Safety Act apply to me" checker once and keep the answer.
- **Size:** Big / Some work

#### 2. The email turns an anonymous diary into a named one
- **What:** Since D80, every account has an email. It's stored as typed, and it's required: older accounts can't skip adding one. The sign-up screen says "Your email is private. Nobody else ever sees it."
- **Where:** 02-signup-email, 25-email, 20-settings (the email is shown under Account); SPEC §4 *Email and password* (`users.email`).
- **Why it matters:**
  - Before, a leak of the database or a look at it by someone else exposed usernames like "@samjcnh". Now it exposes "jane.smith@gmail.com bought 7g from Mo's for £80 on 12 October".
  - "Nobody else ever sees it" isn't strictly true. Anton can see it, and Cloudflare holds it. A cautious user would read the sentence as a promise it can't keep.
  - Most people will type their main email without thinking.
- **Suggestion:**
  - Reword to "Only you see it. We use it only to sign you in."
  - Add one hint under the box: "Any email you can get into works. It doesn't need your name in it." Then users who care can use a separate address. (Once Forgot password exists, the address must be one they can actually open, so say "one you can get into".)
  - Keep the email out of Export and away from followers, as now.
- **Size:** Big / Quick

#### 3. Still no privacy notice, 18+ check or contact address, and the email makes this more urgent (still open from 26 Oct)
- **What:** Sign-up is now email, password and @name, with no age line, no link to what's kept and where, and no "who runs this". Settings has no About or Privacy notice row.
- **Where:** 01-welcome, 02-signup-email, 03-signup-username, 20-settings.
- **Why it matters:**
  - UK GDPR expects a privacy notice from anyone collecting personal data from the public. Records of drug use are the most sensitive kind of data, and now they sit next to an email.
  - The Online Safety Act's children's assessment (finding 1) starts from "can children use it?". Today nothing on screen even says no.
  - Anton may also need to pay the ICO's yearly data protection fee now that strangers' data is held. There are exemptions; I'm not certain which applies, so he should check the ICO's self-assessment once.
  - Delete still says "It can't be undone". Cloudflare's restore-to-an-earlier-moment backups (Time Travel) still keep deleted data for a while (still open from 26 Oct).
- **Suggestion:**
  - An "I'm 18 or over" tick on 02-signup-email.
  - One plain screen, linked from sign-up and Settings. It should say:
    - what's kept, including the email;
    - where (Cloudflare, Western Europe);
    - who can see it (you, approved followers for what Privacy allows, and Anton as the operator);
    - how long backups keep deleted data;
    - how to export and delete;
    - a contact address for problems.
- **Size:** Big / Quick

#### 4. Sign-up tells anyone whether an email address has an account
- **What:** Creating an account with an email that's already used says "There's already an account with that email. Sign in instead."
- **Where:** `server/routes/auth.ts` lines 36 and 113 (`EMAIL_TAKEN`); the same in `server/routes/account.ts` when changing your email.
- **Why it matters:** Sign-in carefully gives the same answer for a wrong password and an unknown email (D80), but sign-up gives the game away. A partner, parent or employer can type someone's email into Create account and learn in one try whether that person keeps a cannabis diary. The limit of 10 sign-ups an hour stops bulk checking, not a single targeted check. For most apps this is normal. For this one, being on the app is itself the sensitive fact.
- **Suggestion:** It can't be fully fixed until the app can send email. Then both cases can say "Check your inbox", and only the real owner learns the answer. Until then:
  - Put it in the privacy notice honestly.
  - Put "the app sends email" higher on the to-do list (it already blocks item 2, Forgot password). It fixes this, password reset and checking the email is real in one go.
- **Size:** Medium / Big job (needs email sending; already on the list)

#### 5. A forgotten password is a dead end, and nothing warns you
- **What:** There's no "Forgot password?" link on 01b-login. Sign-up says nothing about passwords not being resettable. Face ID is offered once and "Not now" dismisses it. The email isn't checked either, so a typo at sign-up locks the address to the wrong place for good.
- **Where:** 01b-login, 02-signup-email, 04-signup-faceid; D80 "Not yet".
- **Why it matters:** A stranger who logs 40 products, skips Face ID and forgets their password loses everything. They see only "That email and password don't match", with nowhere to go. Last round they at least had recovery codes. They'll blame the app, and they'll tell their friends.
- **Suggestion:**
  - On 02-signup-email: "We can't reset passwords yet. Let your iPhone save it, and turn on Face ID next."
  - On 01b-login: a "Forgot password?" link that says the same honestly and points to Face ID.
  - Remind people to Export now and then. Whether iCloud Keychain really offers to save the password needs checking on Anton's iPhone (CLAUDE.md lists it as not checked).
- **Size:** Medium / Quick

#### 6. Posts invite the riskiest photos, and the composer doesn't say so
- **What:** D78 was built for "the bud, the joint, where you're smoking": up to 10 photos a post, always shown to followers whatever the Product photos switch says. Posting a Private product is one tap ("Make visible and post").
- **Where:** 18c-new-post, `Composer.tsx` (the only note is "What followers see under the photo"); 24-privacy ("Posts are always shared with your followers").
- **Why it matters:** "Where you're smoking" is a location. A photo of a session shows friends' faces, house numbers, car number plates, or a bag with someone's handwriting on it. Hidden location data in the photo file is reportedly removed (good, but check on a real iPhone). What the picture itself shows is not. Every approved follower can screenshot it, and follows are approved once and rarely reviewed.
- **Suggestion:** One line in the composer above Post: "Your followers see these photos. Leave out faces, places and anything with a name or number on it." It costs nothing and puts the right thought in front of the user at the right moment.
- **Size:** Medium / Quick

#### 7. The app still builds a priced, named supplier record, and Source still says "where you got it" (still open from 26 Oct)
- **What:**
  - Sources still shows "Mo's · 3 products · £190.00 spent · Bought here".
  - Privacy still describes Source as "Where you got it, e.g. Cookies." and shares it with followers by default.
  - The Source box's placeholder is still "Source/Brand".
- **Where:** 15-sources, 24-privacy, `Privacy.tsx`, `Editor.tsx` line 368.
- **Why it matters:** This was the panel's strongest agreement last round, and nothing changed. With an email on the account (finding 2), the record now has a name on it. And a product's Source now also appears on post cards in the Feed.
- **Suggestion:** The same as last time:
  - Privacy: "The brand or grower, e.g. Cookies. Shops and dealers go in Supplier, which is never shared."
  - "Followers can see this" under the Source box.
  - "Use a nickname" as the Supplier hint.
  - Optionally, a "Hide money" switch.
- **Size:** Big / Quick

#### 8. Export: still no warning, and the words are now out of date
- **What:**
  - 27-export still only suggests "Files or iCloud Drive", with no warning that the file isn't locked (still open from 26 Oct).
  - Its "In the file" list doesn't mention posts, although Export carries them (D77).
  - 31-delete's "What goes" doesn't mention posts, comments or fires, although deleting removes them.
- **Where:** 27-export, 31-delete.
- **Why it matters:** Export is the whole risk in one file, and the user can't see everything that's in it. Delete is a promise, and an incomplete list reads as "maybe my posts stay".
- **Suggestion:**
  - Add "This file isn't locked. Anyone who opens it can read everything."
  - Add "Your posts" to both lists, and "your comments and fires" to Delete.
- **Size:** Medium / Quick

#### 9. An unlocked phone still opens straight to everything (still open from 26 Oct)
- **What:** You stay signed in for 60 days, renewed whenever you use the app (`server/lib/session.ts`). Opening the icon shows the Leaderboard, prices, Sources and now the Feed.
- **Where:** 10-leaderboard, 15-sources, 18-feed.
- **Why it matters:** Phones get handed over. With a password now on every account, an optional "Ask for Face ID or my password when opening" is easier to offer than before, because there's always a fallback.
- **Suggestion:** An optional lock in Settings → Account, off by default. Test it on a real iPhone, because Home Screen apps behave differently.
- **Size:** Medium / Some work

#### 10. The Feed is a real reason to come back, but only for people who already have friends on it
- **What:** The Feed, the dot on its tab and comments give existing users a reason to open the app between purchases. A stranger who arrives alone sees "Nothing here yet" (05d-empty-feed). There are no phone notifications, so the dot only works for people who open the app anyway.
- **Where:** 05d-empty-feed, 05-empty-leaderboard, 06-add-product-empty-full.
- **Why it matters:** For Anton and his mates, the Feed solves my old "little brings people back" point. For a stranger, the first five minutes are unchanged:
  - an empty board, then the same long add form (still open from 26 Oct);
  - an empty Feed with no friends to follow.
- **Suggestion:** Keep the Feed. Steer a newcomer to one quick success: "Rate three things and see your podium", or a short first add (the panel's Worth doing next item 2).
- **Size:** Big / Some work

#### 11. Still no way to bring a friend in, and now the app is worth little without one (still open from 26 Oct)
- **What:** People is still search by exact username. There's no "Share my username" button anywhere (`navigator.share` is only used by Export).
- **Where:** 05e-empty-people, 16-people-search, 05d-empty-feed ("Find people").
- **Why it matters:** The Feed made friends the main reason to stay. Without an invite, every new user must already know someone's exact @name.
- **Suggestion:** A "Share my username" button on People and on the empty Feed. It would open the iPhone share sheet with "Follow me on Green Tracker: @name" and the app address. Follows stay approval-based, as now.
- **Size:** Medium / Quick

#### 12. Focus: the trust basics keep losing to decoration
- **What:** Since 26 Oct the releases added:
  - eleven more looks (fifteen now) and five more colour sets;
  - "their look" on friends' pages;
  - posts, then up to 10 photos a post;
  - a photo viewer on every row;
  - email sign-in.

  None of the panel's trust items made it in (findings 3, 7 and 8), though most are a sentence each.
- **Where:** SPEC changelog 0.59–0.69; CLAUDE.md to-do list (no trust item on it).
- **Why it matters:** Each look comes with readability tests across every screen. Each social feature adds a privacy rule that must hold forever. One person and an AI are maintaining that. Every week the public is invited in without the basics, the gap gets harder to explain if something goes wrong.
- **Suggestion:** Put one "trust basics" item on the to-do list now, above any new look:
  - an 18+ tick;
  - a privacy notice and terms with a contact address;
  - a Report button;
  - the Source, Export, Delete and composer wording.

  Then I'd stop asking for a freeze on looks.
- **Size:** Big / Quick (a decision)

#### 13. Photo storage now grows faster, still with no cap or billing alert (still open from 26 Oct)
- **What:** Each post photo is the post's own copy (a cropped image and a thumbnail), separate from the product's photos. There can be up to 10 a post and 30 posts an hour per account. Uploads have no per-account cap (checked: the only limits are on posts, comments, fires, sign-in and sign-up).
- **Where:** `server/routes/posts.ts` `POST_LIMITS`; SPEC §4 *Posts*.
- **Why it matters:** One keen user, or one abuser, can add hundreds of photos an hour, and Anton pays for the storage. A mistaken bulk upload can't be spotted, because there's no alert.
- **Suggestion:**
  - Set a Cloudflare billing alert today.
  - Set a sensible per-account photo ceiling (a few thousand), with a polite message when it's reached.
- **Size:** Small / Quick

#### 14. Anton is now a moderator and the holder of everyone's email, alone
- **What:** With posts, comments and stored emails, the operator's job now includes:
  - handling reports;
  - answering "I've forgotten my password";
  - answering "delete my data" from someone who can't sign in;
  - deciding what to do about an illegal comment.

  There's no contact route and no written plan.
- **Where:** 20-settings (only a version number); no contact anywhere (still open from 26 Oct).
- **Why it matters:** Strangers will send these requests. Today they can't reach anyone, and Anton has no plan for what he'd do.
- **Suggestion:**
  - A throwaway contact address, in the privacy notice and on the website.
  - A five-line plan in `design/`: what Anton does with a report, an illegal post, a locked-out user, and a request from the police. Keep the answer to that last one in mind when deciding how long to keep data.
- **Size:** Medium / Quick

#### 15. A small upside: email sign-in makes moving to your own address cheaper
- **What:** Passkeys only work on the exact address they were made for (D11). Passwords work on any address.
- **Where:** D11, D80.
- **Why it matters:** Last round, moving off `workers.dev` meant everyone would lose sign-in. Now they'd just sign in with email and password, then add Face ID again. Sending email (for password reset) also needs a domain of Anton's.
- **Suggestion:** If an own domain is ever wanted, the cheapest time is now, together with the email-sending work. Anton's call (reopens D63's choice of the free address).
- **Size:** Small / Some work

### What's already great (don't break it)

- **The posts rule is serious.** Approved followers only, checked on every request. An unfollow, removal or block ends access at once. Post cards never carry prices, suppliers, amounts or dates. A Private product asks before it's posted.
- **The password handling is right.** A salted hash, one answer for a wrong password and an unknown email at sign-in, limits on wrong tries, other devices signed out after a password change, and a password needed to delete the account.
- **The email stays out of Export and away from followers.** Keep it that way.
- **The empty Feed tells the truth:** "Only your approved followers ever see yours."
- **There are limits on posts, comments and fires**, set from day one.
- **No trackers, data in Western Europe, Delete wipes the photo storage.** All still true.

### If I were deciding today

- **Show me the public-service basics:** an 18+ tick, a one-screen privacy notice that mentions the email and backups, short terms, a contact address, and a Report button on posts, comments and profiles. These turn "a hobby with followers" into something defensible under the Online Safety Act and UK GDPR.
- **Show me the app helps people keep less dangerous information:**
  - an email hint ("doesn't need your name");
  - the Source wording fixed;
  - a composer line about faces and places;
  - an Export warning;
  - an honest "we can't reset passwords yet" line.
- **Show me sending email is planned, not "later".** It fixes Forgot password, checking the email is real, and sign-up revealing who has an account, all at once.

*Optional, only if he ever wanted to cover costs:* a "buy me a coffee" donation link remains the only path I'd suggest. It should be kept well away from anything about cannabis sales.

*Limits:* I worked from the screenshots (Chromium, made-up data), SPEC.md and a read of the server code. I couldn't check:
- Face ID, iCloud Keychain saving the password, or what a real iPhone photo keeps;
- Cloudflare's current terms and how long its backups keep deleted data;
- whether the Online Safety Act or the ICO fee formally apply. That's my understanding as a non-lawyer, and Anton should check both with the official online checkers.

## Part 2: the website

### Overall verdict

The page is unchanged since last round apart from the how-to video, which is clear. So everything I said on 26 Oct still stands. It sells a record of what you bought, who from and for how much, with no "your data" block, no 18+ line, no contact, "Know your plug", "Roll one up and sign up" and "Made by Anton".

Two things are new:
- **The app now asks for an email**, and the page says nothing about it. The good news is that the "no email" line I suggested last time was never added, because it would now be false.
- **The page doesn't mention posts or the Feed**, which are now the app's main reason to come back, and its main new risk.

### Findings

#### 1. Still no "Your data" block, and it now needs to cover the email (still open from 26 Oct, changed)
- **What:** The only privacy words are the footer's "No ads. No tracking. Your stash is your business."
- **Where:** `site/public/index.html` line 130; the whole page.
- **Why it matters:** The first thing a visitor meets after Sign up free is an email box. A cautious person wants to know why before they type.
- **Suggestion:** Three or four lines:
  - "Your email is only for signing in. Followers never see it, and we never send newsletters."
  - "Your suppliers, prices and notes are never shared."
  - "Export everything or delete your account any time."
  - "Kept on Cloudflare in Western Europe."

  Don't say "no email" anywhere; that's now wrong. Keep the wording in step with the app's privacy notice (Part 1, finding 3).
- **Size:** Big / Quick

#### 2. No 18+ line, while the closing call is still "Roll one up and sign up" (still open from 26 Oct)
- **What:** No age line anywhere. The final section still reads "Roll one up and sign up."
- **Where:** `index.html` lines 36 and 124.
- **Why it matters:** With posts and comments, the app very likely has duties about children under the Online Safety Act (Part 1, finding 1). The public page is the first place anyone would look for "is this for adults?".
- **Suggestion:** Add "18+" to the eyebrow ("Free · made for iPhone · no ads · 18+") and to the app's sign-up. This reopens D63's "no age or legal note".
- **Size:** Big / Quick

#### 3. Posts and the Feed aren't mentioned, so the page undersells the app and skips the reassurance
- **What:** The friends card is still "Peep your mates' picks: follow friends and see their top shelf". Nothing says you can post, comment or give a fire, or who sees it.
- **Where:** `index.html` lines 82–86.
- **Why it matters:** The Feed is the strongest "come back next week" reason the app now has. And "who sees my posts?" is the first question a cautious person asks about a cannabis app with photos.
- **Suggestion:** Rewrite the card around the Feed and consent: "Post what you're smoking. Only friends you approve see it." Use one made-up post in the picture if it fits.
- **Size:** Medium / Quick

#### 4. No contact, no terms, no way to report (still open from 26 Oct, more urgent)
- **What:** There's no contact address or terms link on the page.
- **Where:** Footer.
- **Why it matters:** The app now hosts content users share with each other. A public page with no way to reach the operator is the first thing a host's abuse team or Ofcom would notice. It's also where a locked-out user (Part 1, finding 5) would look for help.
- **Suggestion:** A footer line: "Run by one person as a hobby. Problems or reports: [throwaway address] · Terms · Privacy". Use the same privacy and terms text as the app.
- **Size:** Medium / Quick

#### 5. "Know your plug" and "Made by Anton" are still there (still open from 26 Oct)
- **What:** Card 3's heading is "Know your plug", and the footer says "Made by Anton, for the heads."
- **Where:** `index.html` lines 79 and 130.
- **Why it matters:**
  - "Plug" means dealer, and the app now ties those records to an email.
  - Anton's name sits on the page of a service that holds strangers' emails next to their drug purchases.
- **Suggestion:** "Know your sources", and "Made by one person, for the heads". Both are Anton's call.
- **Size:** Medium / Quick

#### 6. The drawn address is still wrong; a real domain is now cheaper (still open from 26 Oct)
- **What:** Step 1's drawn Safari bar still shows `green-tracker.workers.dev`. The real address is `green-tracker.green-tracker.workers.dev`.
- **Where:** `index.html` line 114.
- **Why it matters:** A mismatch on a cannabis site makes a cautious person wonder if it's a scam. Since D80, moving to an own domain no longer locks everyone out (Part 1, finding 15), and sending password-reset emails will need one anyway.
- **Suggestion:** Fix the drawn address now. Decide about a domain together with the email-sending work.
- **Size:** Small / Quick (the drawing); Medium / Some work (a domain)

### What's already great

- **The video is honest and careful.** It shows the real ⋯ → Share → View More route, downloads nothing until tapped, and has captions.
- **Still loads nothing from anywhere else**, so "No tracking" is true for the page. Checked: the app still has no tracking code either. Keep both true.
- **Made-up products only**, and "Only if they say yes" frames friends around consent.

### If I were deciding today

- **A "Your data" block that's true today:** the email is for signing in only, suppliers and prices are never shared, export and delete, where it's kept.
- **18+, a throwaway contact, and Terms and Privacy links in the footer**, matching the app.
- **Show the Feed, with "only friends you approve see it"**, so the page sells the reason to come back and answers the scariest question in the same line.

*Limits:* I judged this from `site/public/index.html`, the phone screenshots and the SPEC. I couldn't see the real site, how the video plays on a real iPhone, or how the link preview looks in WhatsApp or iMessage.

**Files referred to:**
- /home/user/green-tracker/server/routes/auth.ts (lines 36 and 113: sign-up reveals whether an email has an account)
- /home/user/green-tracker/server/routes/account.ts (the same message when changing your email)
- /home/user/green-tracker/server/routes/posts.ts (`POST_LIMITS`: the only limits on posts, comments and fires)
- /home/user/green-tracker/server/lib/rateLimit.ts (no limit on photo uploads)
- /home/user/green-tracker/server/lib/session.ts (`SESSION_TTL = 60 * DAY`)
- /home/user/green-tracker/client/src/screens/Privacy.tsx (Source: "Where you got it, e.g. Cookies.")
- /home/user/green-tracker/client/src/screens/Editor.tsx (line 368: "Source/Brand" placeholder)
- /home/user/green-tracker/client/src/screens/Composer.tsx (no note about faces or places)
- /home/user/green-tracker/site/public/index.html (lines 36, 79, 82–86, 114, 124, 130)
- /home/user/green-tracker/.playwright/review/app/ (01b-login, 02-signup-email, 04-signup-faceid, 05d-empty-feed, 15-sources, 18-feed, 18b-post, 18c-new-post, 20-settings, 24-privacy, 25-email, 27-export, 31-delete)