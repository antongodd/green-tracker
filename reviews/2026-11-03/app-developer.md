# App developer: the app and the website (2026-11-03)

## Part 1: the app

### Overall verdict

The new social and sign-in features are built carefully where it counts most. The rule for who can see a post, a comment or a 🔥 is checked by the server on every request. The product card under a post follows the poster's Privacy settings at that moment. Passwords are stored as salted hashes, and sign-in gives the same answer for a wrong password and an unknown email. I tried to find a way for a non-follower to read a post, a photo or a comment, and found none.

My worries are around the edges. The new sign-in has three gaps:
- If someone forgets their password and skipped Face ID, they lose their account. The app doesn't warn them, and the iPhone's password saving may not catch the two-step sign-up.
- The password check may be too heavy for Cloudflare's free plan.
- A few small holes let a stranger confirm someone's email is registered, or block them from signing in with their password.

The Feed looks right, but on a phone it feels slower and more stuck than it should. It downloads every post's full-size photo at once. It never refreshes while you're on it, and it has no pull-to-refresh.

Almost all of last round's "losing work" points are still open, and the new post composer has the same problem.

### Findings (most important first)

#### 1. Forget your password without Face ID and the account is gone, with no warning and possibly no saved password
- **What:** Recovery codes are gone, and "Forgot password" doesn't exist yet. So someone who taps "Not now" on Face ID and later forgets their password can never get back in. Nothing tells them this. Separately, the iPhone may not offer to save the password at sign-up, so it isn't saved to iCloud Keychain, the iPhone's password store.
- **Where:**
  - `04-signup-faceid`: the copy only says "Sign in with a glance instead of typing your password".
  - `01b-login`: there's no "Forgot password?" link at all.
  - Password saving, in `client/src/screens/CreateAccount.tsx`:
    - The email field on step 1 is marked `autoComplete="email"` (line 118). iCloud Keychain looks for `username`.
    - The password field disappears when step 2 opens, without a real form submission.
    - Step 2's form contains only the @name box. So Keychain may save nothing, or may save the password under the @name instead of the email.
- **Why it matters:** For strangers, the app now has no safety net at all, which is worse than recovery codes. It matters even more because an account made in Safari may have to sign in again inside the Home Screen app. There, a password that wasn't saved has to be remembered and typed.
- **Suggestion:**
  - Reword the Face ID offer: "Face ID is also your way back in if you forget your password. We can't reset passwords yet." Make "Use Face ID" clearly the main choice.
  - Add a "Forgot your password?" link on Sign in. It should say plainly: "Sign in with Face ID if you set it up. Otherwise we can't reset it yet."
  - In step 2's form, add a hidden field `autocomplete="username"` holding the email, plus a hidden `new-password` field. Mark step 1's email `autocomplete="username"` too. Then Safari's "Save password?" offer attaches to the email.
  - **Needs checking on Anton's iPhone:** create an account and confirm Keychain offers to save it, under the email.
- **Size:** Big / Quick.

#### 2. The password check may go over Cloudflare's free-plan computing limit
- **What:** Each sign-in, password change, email change and account deletion scrambles the password 100,000 times (PBKDF2). SPEC §4 says the app runs on the free plan, which allows about 10 milliseconds of computing per request. This step usually takes several times that. For an unknown email the first time, it is done twice: once to build a stand-in hash, once to check against it.
- **Where:** `server/lib/password.ts` (`ROUNDS = 100_000`, `dummy`); SPEC.md line 205 ("the free plan's CPU budget").
- **Why it matters:** If Cloudflare enforces the limit, sign-in fails with a Cloudflare error page, maybe only some of the time. That is the worst place for a failure. *This is a guess from the numbers: I can't see the live metrics.*
- **Suggestion:** Anton opens Cloudflare → Workers → green-tracker → Metrics and checks "CPU time" and errors on `/api/auth/signin` since today's release. If it's over, choose between:
  - the Workers Paid plan;
  - fewer rounds, which is a security trade-off and would loosen D80, so Anton's call.
- **Size:** Big if real / Quick to check.

#### 3. Someone holding your unlocked phone can add their own Face ID login, and changing your password doesn't remove it
- **What:** Adding a passkey needs only the signed-in session, not your password. While setting one up, the iPhone can offer to save it on another device (by QR code). So a person with your unlocked phone for a minute could add their own phone as a way into your account. Changing your password signs out other devices but keeps every passkey. "Sign out everywhere" keeps them too.
- **Where:** `server/routes/account.ts` `POST /passkeys/options` and `/passkeys/verify` (no `confirmPassword`); `PUT /password` deletes sessions only.
- **Why it matters:** This is cannabis data. The usual risk is a partner, flatmate or ex with the phone, and today they could keep access quietly.
- **Suggestion:**
  - Ask for the password before adding a passkey (reuse `confirmPassword`).
  - After a password change, show "These devices can still sign in with Face ID", with Remove buttons.
  - Show each passkey's "last used" date on `25c-passkeys`; it's already stored.
- **Size:** Medium / Quick.

#### 4. Sign-up and Change email reveal whether an email has an account
- **What:** Sign-in rightly hides whether an email is registered. Sign-up doesn't: entering a used email says "There's already an account with that email. Sign in instead." The same happens in Settings → Email and on the old-account "Add an email" screen.
- **Where:** `server/routes/auth.ts` `/signup` (`EMAIL_TAKEN`); `server/routes/account.ts` `/email` and `/login`.
- **Why it matters:** One try is enough to answer "is my partner, employee or child on the cannabis app?" Sign-up is limited to 10 tries an hour per network, which doesn't help when someone checks one specific person. This undercuts the promise in D80 and CLAUDE.md that the email is never shown to anyone else.
- **Suggestion:** This can't be closed without the app sending email (to-do item 2). When that is built, make sign-up say "Check your email to finish" in both cases. Until then, at least say on the to-do list that this leak exists, so the website and app don't promise more than is true.
- **Size:** Medium / Some work, tied to to-do 2.

#### 5. Anyone who knows your email can stop you signing in with your password
- **What:** The limit of 10 tries per email every 15 minutes counts every try, right or wrong, from anyone. Ten junk tries every 15 minutes keeps that account locked out of password sign-in indefinitely.
- **Where:** `server/routes/auth.ts` `/signin`: `hit(LIMITS.signinEmail)` is called before the password is checked. `server/lib/rateLimit.ts` says "wrong passwords" but counts all tries.
- **Why it matters:** It's cheap to do, and the victim just sees "Too many attempts". If they have no Face ID, they are completely locked out (see finding 1).
- **Suggestion:**
  - Count only wrong tries. Check the per-network limit first, then count the per-email limit only on a wrong password.
  - Let a correct password from a device that has signed in before get through even when the email is limited. A simple version: a long-lived "known device" cookie per account.
  - Make the 429 ("too many tries") message say "or sign in with Face ID".
- **Size:** Medium / Some work.

#### 6. The Feed downloads every post's full-size photo at once
- **What:** In the list, each post's first photo is the 1600px "cropped" picture and isn't lazy-loaded. Lazy-loading means waiting until it's about to scroll into view. So opening the Feed fetches up to 20 large photos straight away. Each one is still re-checked with the server every time it's shown (`private, no-cache`), and each card has a blur effect behind it.
- **Where:**
  - `client/src/components/PostCard.tsx` `PostPhotos`: `loading={i === 0 ? undefined : 'lazy'}` and `postPhotoUrl(post, 'cropped', i)`.
  - `server/lib/photos.ts` line 166.
  - `.post { backdrop-filter: blur(14px) }` in `styles.css`.
- **Why it matters:** On 4G that is several megabytes before the Feed settles. The Feed is the tab people will open most often to see what's new.
- **Suggestion:**
  - Lazy-load every photo except the first post's.
  - Make a middle size, about 1080px on the long side, for lists and use 1600px only on the post page. That needs a new upload variant, so it's some work. The lazy loading alone is quick.
  - Reconsider the photo caching (still open, below).
  - On the server, `aboutFor` in `server/routes/posts.ts` loads each poster's privacy and colours one after another, two database trips per person. Batch them into one query.
- **Size:** Medium / Quick (lazy loading) to Some work (middle size).

#### 7. The Feed never updates while you're on it
- **What:**
  - There's no pull-to-refresh. A Home Screen app has none built in.
  - Tapping the Feed tab while on the Feed does nothing: `record()` in `client/src/router.ts` ignores navigating to the same address.
  - The Feed dot and the follow-request number come from `/auth/me`, which loads only when the app starts (`client/src/main.tsx`).
  - Nothing reloads when you return to the app from the background (there's no `visibilitychange` handler).
- **Where:** `client/src/screens/Feed.tsx`, `router.ts` line 34, `main.tsx` line 69.
- **Why it matters:** iOS keeps Home Screen apps alive for days. A friend posts, and you see nothing until you switch tabs or force-quit the app. The "Now" times go stale too. People expect "tap the tab again = back to the top and refresh".
- **Suggestion:**
  - Tapping the active tab scrolls to the top, or reloads if you're already at the top.
  - Call `refresh()` and reload the Feed's first page when the app comes back to the front.
  - Optionally add a "New posts" pill at the top.
- **Size:** Medium / Some work.

#### 8. A comment shows your @name to all of the poster's followers, and nobody is told
- **What:** If you comment on or 🔥 a friend's post, all of their approved followers see your @name, and they can tap through to your page. Many of those followers don't know you and haven't been approved by you. ("Who gave a fire" lists names too.) The privacy page only says "Posts are always shared with your followers"; nothing at the comment box says who will see it. Profile photos are correctly protected by D23.
- **Where:** `18b-post` (comment box), `24-privacy`; `server/routes/posts.ts` `commentsFor`, `/:id/fires`.
- **Why it matters:** In a cannabis app, being visibly connected to a stranger's circle is a real exposure, and people assume a comment is "between me and my friend".
- **Suggestion:** Add a small line under the comment box: "Everyone who follows @sam can see your comment and @name." Add the same line on Privacy, under the Posts sentence.
- **Size:** Medium / Quick.

#### 9. Typing a comment: the keyboard, the comment box and the tab bar need checking on a real phone
- **What:** The comment box is pinned just above the tab bar, which stays visible. Nothing adjusts for the iPhone keyboard (no `visualViewport` handling, unlike `CountryPicker.tsx`). In the screenshot, the only comment, "Need to try this one", shows faintly through the see-through comment box until you scroll.
- **Where:** `.comment-box` in `styles.css` around line 1964; `client/src/screens/PostPage.tsx`; screenshot `18b-post`.
- **Why it matters:** iPhones handle fixed bottom bars with the keyboard badly: the box can jump, sit behind the keyboard, or leave the tab bar floating above it. Comments are the main way people interact on a post.
- **Suggestion:**
  - Anton types a comment on his iPhone and sends a screenshot.
  - Hide the tab bar while the comment box is focused. Track the keyboard's height with `visualViewport`, as the country picker already does.
  - Make the comment bar solid, so the text under it doesn't show through.
- **Size:** Medium / Quick (check first).

#### 10. Light looks and the iPhone's status bar may not match
- **What:** The time and battery colour is set by `apple-mobile-web-app-status-bar-style`. The app switches it to `default` for light looks while it's running (`client/src/screenLook.ts` line 24, `client/public/look.js` line 19). On iPhone this setting is generally read only when the Home Screen app starts. So:
  - after choosing a Daylight look, the clock may stay white on a light header until the app is restarted;
  - a dark-look user visiting a friend's page in a light look (D74) would always get white status text on a light screen.
- **Where:** `40-look-daymint`, `screenLook.ts`, `look.js`.
- **Why it matters:** The clock and battery become invisible, and it looks broken in exactly the screens Anton cares about visually. *From my knowledge of iOS; needs checking on the phone.*
- **Suggestion:** On Anton's iPhone, (a) switch to Daylight Mint and look at the clock, (b) restart and look again, (c) visit a friend's page in a light look from a dark one. If it's wrong, keep `black-translucent` always and give light looks a darker strip behind the status bar so the white text stays readable.
- **Size:** Medium / Quick (check).

#### 11. Losing work: still open, and the new post composer has it too (still open from 26 Oct)
- **What:**
  - Cancel and swipe-back still throw away a new or edited product without asking. `client/src/screens/Editor.tsx` line 224 only asks on the "Add to leaderboard" path.
  - The new post composer is the same: Cancel calls `back('/feed')` straight away (`client/src/screens/Composer.tsx` line 172). That throws away up to 10 photos, crops, cut-outs and a caption.
  - No server request has a time limit (`client/src/api.ts`), so "Post" or "Save" on a weak signal can hang, and a second tap can create a duplicate.
  - A half-filled product still isn't kept if iOS closes the app.
- **Why it matters:** This is still the biggest everyday risk for Anton, and now for anyone who posts.
- **Suggestion:** As last round: show the "Keep editing / Discard" sheet when anything has changed, on Cancel and swipe-back, in the Editor and the Composer; a 20-second time limit; an id made on the phone for each save so a repeat isn't a duplicate; and add tests for each.
- **Size:** Big / Some work.

#### 12. Delete account and Export don't mention posts
- **What:**
  - The "What goes" list on `31-delete` doesn't say your posts, your comments on friends' posts and your 🔥s are deleted. The code does delete them.
  - `27-export` doesn't say posts are in the file, which they are (`client/src/backup.ts` line 101).
  - The "this file isn't locked, keep it private" warning is still missing (still open from 26 Oct).
- **Where:** `client/src/screens/Data.tsx`; screenshots `27-export`, `31-delete`.
- **Why it matters:** People deciding to leave need to know their comments on other people's posts go too. The export is a complete, unlocked record of someone's cannabis buying.
- **Suggestion:** Add "Your posts, and your comments and 🔥s on others' posts" to What goes, and "Your posts and their photos" to In the file. Add the warning line.
- **Size:** Small / Quick.

#### 13. Some post buttons are smaller than a thumb
- **What:**
  - The 🔥 count ("see who") is only 32 points wide and sits right against the 🔥 button, so it's easy to give a fire when you meant to see who gave one, or the other way round.
  - "View all N comments" is 32 points tall and "more" is 36. Apple's minimum is 44.
- **Where:** `styles.css`: `.post-acts .act.count`, `.post-cmts .all`, `.post .more-text`.
- **Suggestion:** Give each 44 points (add invisible padding if needed) and put a little more space between the 🔥 and its count.
- **Size:** Small / Quick.

#### 14. Lots of blur and constant motion, now with a scrolling Feed of photos (still open from 26 Oct, wider now)
- **What:** Every post card has a blurred background over moving lights. 15 Looks each have their own animated backgrounds, and coloured leaderboard rows still shimmer all the time.
- **Why it matters:** On older iPhones, a long Feed of blurred cards over moving lights is the classic cause of jerky scrolling and a warm battery. *Needs a real-phone check.*
- **Suggestion:** Scroll a 20-post Feed on the oldest iPhone available. If it stutters, drop `backdrop-filter` from `.post`: the photo covers most of the card anyway. Pause the background lights while scrolling, or when the app is in the background.
- **Size:** Medium / Some work.

#### 15. Other points still open from 26 Oct
- **Text doesn't follow the iPhone's text-size setting.** There are 215 fixed `px` font sizes in `styles.css` and only one `rem`. (Medium / Big job)
- **The + button covers the 5th row's score.** On `40-look-daymint` it hides Zkittlez's "OVERALL". `.screen` bottom padding is still `nav-h + 24px`. (Small / Quick)
- **Value for money still shows "£0.25/mg" for an edible**, with no "per 20mg" note (`client/src/components/ProductRow.tsx` line 184). (Medium / Quick)
- **Photos are re-checked with the server on every view** (`private, no-cache`), which now affects post photos too. (Medium / Quick)
- **Opening on a weak signal waits for the network with no time limit** (`client/public/sw.js`). (Medium / Quick)
- **Export is one big text file built in memory.** It now also holds every post photo, so it grows faster. (Medium / Some work)

#### 16. Tests for the new security edges
- **What:** A few edge cases that protect accounts have no test that would catch them coming back:
  - adding a passkey without the password (finding 3);
  - the per-email limit locking out a correct password (finding 5);
  - sign-up saying an email is taken (finding 4, once it's fixed).
- **Suggestion:** Add API tests (fast and steady) alongside each fix. Check each new test fails on today's code before the fix goes in.
- **Size:** Small / Quick.

### What's already great (please don't break)
- **The post rule is in the database query itself** (`visiblePostSql`, `actorShownSql`) on the list, the single post, every photo, comments, 🔥 counts and the Feed dot. Every refusal gives the same "not available" answer, so nobody can tell whether a post exists. The product card under a post is worked out fresh each time from the poster's Privacy settings, the product's Private and Archived state and D50's kept rule.
- **Posts keep their own copy of each photo**, uploaded first and attached only on Post. A missing photo changes nothing.
- **Password storage:** salted PBKDF2, compared in constant time, and the same time and answer for an unknown email. A password change signs other devices out. Delete asks for the password.
- **The sign-in boxes are set up properly:** `current-password` and `new-password` hints, Show / Hide, and 16px text so the iPhone doesn't zoom in.
- **Photo swiping in posts** snaps one photo at a time, keeps the post the same height, has a "1/2" count and screen-reader labels.
- **Coming back from a post lands where you were** in the Feed.
- **The Feed's empty state** says who sees your posts.

*Couldn't check (needs Anton's iPhone or Cloudflare):* the free plan's computing time on sign-in, whether iCloud Keychain saves the password at sign-up, typing a comment with the keyboard up, the status bar in light looks and on a friend's light page, Feed scrolling on an older iPhone, and swiping photos next to the screen edge without triggering swipe-back.

---

## Part 2: the website

### Overall verdict

Little has changed since 26 Oct, apart from the how-to video. The video is done well:
- nothing downloads until you press play (`preload="none"`);
- it has captions;
- it's served from the site itself, so the no-tracking rule holds;
- step 2 now mentions the ⋯ button on newer iPhones, which partly fixes my earlier point.

Most of last round's quick wins are still open. D80 also changes two things the site needs to think about: a Safari sign-up now means typing a password again in the Home Screen app, and the planned "no email, no password" privacy line would now be false.

### Findings

#### 1. After D80, the install steps likely leave people retyping their password
- **What:** Step 1 still says to sign up in Safari, then add the app to the Home Screen. An iPhone may keep a Home Screen app's sign-in separate from Safari's. If so, people open the new icon to a sign-in screen. Before D80, Face ID got them in. Now many will have only an email and password, which they may not have saved (app finding 1).
- **Where:** `site/public/index.html`, steps 1 to 3.
- **Why it matters:** This is where strangers drop off, right after deciding to join.
- **Suggestion:**
  - Check on Anton's iPhone: sign up in Safari, add to the Home Screen, open it. Is he still signed in?
  - If not, either reorder the steps (add to the Home Screen first, then sign up inside it) or add to step 3: "Open it and sign in with your email and password."
- **Size:** Big / Quick.

#### 2. Any privacy wording added to the site must now match D80
- **What:** Last round's quick win 1 suggested the line "No email, no phone number, no password". That is no longer true.
- **Suggestion:** If the "Private by design" block is built, word it as "Your email is private: nobody else ever sees it. Your suppliers, prices and notes are never shared." Don't claim more about the email until finding 4 in Part 1 is fixed.
- **Size:** Medium / Quick.

#### 3. The video is landscape and small on a phone
- **What:** The video is 1280 × 720 (wide), showing a tall phone. On a 390-point-wide screen the phone inside it is only about 80 points tall (`phone-home-full.png`). The heading also says "20 seconds" while the caption says "24 seconds".
- **Where:** `index.html` `<figure class="video">`; `site/video/`.
- **Suggestion:** Render a tall 9:16 version for phones (`<source media="(max-width: 600px)">`), still with `preload="none"`, and use one number for the time.
- **Size:** Small / Some work.

#### 4. Still open from 26 Oct (all Quick)
- **The "£9.50/g · value for money" chip still covers Gushers Rosin's 8.8** on phone, laptop and the share picture. Label it "price", move it, and redraw `og.png`.
- **The step 1 picture still shows `green-tracker.workers.dev`**, not the real `green-tracker.green-tracker.workers.dev`.
- **The laptop layout slips are unchanged** (`laptop-home-full.png`): the hero starts further left than the sections, step 1 has a gap under its title, step 3 sits alone, and the rate card hugs the left. A laptop-width test is still missing.
- **The "Open app" button (~36pt) and the logo (30pt) are still under 44 points** (`site.css` lines 53 and 58).
- **The rate slider is still named by its verdict**, which changes as you drag ("Fire."), so VoiceOver hears a changing name (`index.html` line 95).
- **There's still no line for people arriving from Instagram, Snapchat or WhatsApp**, whose built-in browsers can't add to the Home Screen.
- **The lost page still links only to the website**, with no "Open the app" link and no `theme-color` (`404.html`).
- **The live check after a deploy still only reads `version.txt`.** Nothing checks the real site's security headers or that a lost page returns "not found" (`.github/workflows`, the "Website serves this build" step).
- **Search basics are still missing** (Anton's call): no canonical tag, `robots.txt`, `og:image:alt` or `og:site_name`.

### What's already great (don't break)
- **Still loads nothing from anywhere else.** The video and its captions are allowed only from the site itself (`media-src 'self'`).
- **The video doesn't download until it's played**, plays in the page rather than full screen, and has captions.
- **Reduce Motion, no JavaScript, safe areas and zoom** all still work as before.
- **Step 2 now reflects today's Safari** (the ⋯ button, View More).

*Couldn't check:* whether a Safari sign-up carries over to the Home Screen app, how the video looks and plays on a real iPhone, and how the link preview looks in WhatsApp and iMessage.

**Main files:** `server/lib/password.ts`, `server/routes/auth.ts`, `server/routes/account.ts`, `server/routes/posts.ts`, `client/src/screens/CreateAccount.tsx`, `client/src/screens/Feed.tsx`, `client/src/components/PostCard.tsx`, `client/src/screens/PostPage.tsx`, `client/src/screens/Composer.tsx`, `client/src/screenLook.ts`, `client/src/styles.css`, `site/public/index.html`.
