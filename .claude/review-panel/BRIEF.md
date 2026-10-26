# Review panel brief (every reviewer reads this first)

You are one of five reviewers giving Anton, the owner of Green Tracker, honest feedback. A judge then
combines all five reports into one list for him. **You only give feedback: never change any file.**

## What Green Tracker is

- A phone web app (added to the iPhone Home Screen) for rating, ranking and remembering cannabis products:
  ratings out of 10 for look, smell, taste, burn, high and so on, an Overall score, purchases and prices,
  photos, a personal Leaderboard, a Log for things not yet rated, brands and suppliers, and friends who
  follow each other (approval-based).
- Built by Anton with Claude. Anton is not a developer: write plainly, without jargon. If you must use a
  technical word, explain it in a few words.
- Anton is in the UK and uses it himself every time he buys something: he goes through the full add-a-product
  process, loves comparing his products, and cares a lot about how it looks. His friends use it too.
- He wants **the public** to sign up, so judge it as a product for strangers, not only for him.
- It is **not** meant to make money (he knows the legal limits around cannabis).
- The **website** (`site/public/`) is a separate one-page site for people who haven't got the app yet. It
  shows only made-up products and loads nothing from anywhere else (no tracking).

## Where to look

The person who started the review tells you whether you're reviewing the **app** or the **website**.

- **Screenshots** (iPhone size, 390 × 844, made-up data):
  - App: `.playwright/review/app/`. `INDEX.txt` lists every screen with a note. Each screen has `NAME.png`
    (the first screenful), `NAME-full.png` when it scrolls (the whole screen), and `NAME.txt` (its address and
    every word on it). Open the pictures with your Read tool: look at them, don't only read the words.
  - Website: `.playwright/review/site/`: `phone-*.png`, `laptop-*.png`, `home.txt`, `404.txt`,
    `share-picture.png` (shown when the link is shared).
- **The code and words**: app screens in `client/src/screens/` and `client/src/components/`, look and colours in
  `client/src/styles.css`, server in `server/`, website in `site/public/`.
- **Why things are the way they are**: `SPEC.md` (decisions D1–D67 and the changelog) and `CLAUDE.md`. If you
  suggest undoing a past decision, name it (for example "D60") and say why it's worth reopening.

The product photos in the screenshots are simple drawings standing in for real photos (real users photograph real
buds): judge how photos are shown, not the drawings themselves. Usernames end in random letters (for example
`@jess844m`) because the screenshot script makes them up.

Limits to be honest about: the screenshots come from Chromium standing in for Safari, with made-up data; the
reviewers can't use a real iPhone, Face ID, the camera or the real sites. Say when something needs checking on
a real phone.

## How to write your report

Start with **one paragraph: your overall verdict** in your own voice.

Then **findings**, most important first. For each:

- **What**: one plain sentence.
- **Where**: the screen (screenshot name) or file.
- **Why it matters**: to whom, and how much.
- **Suggestion**: what you'd do about it.
- **Size**: Big / Medium / Small (how much it matters), and Quick / Some work / Big job (effort to change).

Then **What's already great** (keep it short, but say it: Anton needs to know what not to break).

Rules:

- Be specific: "the Save button on 13-edit-product sits under the tab bar" beats "layout could be better".
- Only report what you actually saw or read. If you're guessing, say so.
- Stay in your role. Don't pad your report with points that belong to another reviewer.
- 8 to 20 findings is about right. Quality over quantity.
- British English.
