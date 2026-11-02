# Brief: Posts, comments and a Feed

**Built** as D77 (0.66.0, on dev 2026-11-02). Anton's picks at the mockup stage: open points 1–3 and 5 as recommended;
for 4, the round + button (like the Leaderboard and Log) rather than a button in the header. SPEC.md D77 and §4 are
what was built; this brief is kept as the record of the request.

Written 2026-11-02 with Anton, from his friends' feedback. Hand this to a new conversation to build it.
Read `CLAUDE.md`, `README.md` and `SPEC.md` first, as always. This brief adds to them and doesn't replace any of
their rules.

## In one paragraph (for Anton)

Friends can **post what they're smoking**. A post is usually built around one of your products or Log entries:
a photo, a caption, and a little card showing the product's name, type and score that friends can tap to see the
product. You can also post just a photo. Only your approved followers see your posts. They can **comment** and
give a **🔥**. A new **Feed** tab shows your friends' posts, newest first, and takes the People tab's place in the
tab bar; People is still one tap away from the Feed. On a friend's page there are now two tabs, **Leaderboard |
Posts**.

## Anton's decisions (record as D77)

| # | Question | Anton's answer |
|---|---|---|
| 1 | What is a post? | **Option C, built around B:** a post usually shares one of your products or Log entries (its photo, name, type and score as a card, plus a caption). You can also post just a photo with a caption. |
| 2 | Who sees posts? | **Only approved followers** (and you). No public posts. |
| 3 | Reactions as well as comments? | **Yes:** a one-tap 🔥 as well as comments. |
| 4 | Where does the Feed go? | **Option B: Feed replaces People in the tab bar.** People is reached from the Feed (and from your photo at the top, as now). |
| 5 | Posting a Private product | **Not allowed as it is, but the app offers to make it visible**, then posts it in one go. |
| 6 | Anything else from the friends? | No. |

Also agreed in the discussion (my recommendations, which Anton didn't change):
- Comments are **one flat list** with no replies to replies. You can delete your own comments, and you can delete
  any comment on your own post.
- **Unfollow or block:** posts, comments and 🔥s disappear at once, both ways.
- **Delete account:** removes your posts, comments and 🔥s everywhere.
- You can **edit a post's caption** and **delete a post**. **One photo per post** to start with.
- **Phone notifications** are not part of this. They could come later as their own item.

## How to run this (CLAUDE.md, D75)

This is a **big change**: a new feature, new tables, and a change to what followers see.

1. **Mockups first.** Make interactive iPhone mockups (an artifact) with your recommendation marked for:
   - the Feed (the tab bar with Feed in People's place, and the People button in the Feed's header);
   - a post in the Feed (product card version, Log entry version, photo-only version);
   - a post's own page with comments and the 🔥;
   - writing a post (the composer), including the "this product is private" step;
   - a friend's page with **Leaderboard | Posts**, and your own page;
   - the empty Feed.

   Settle the "Open points" at the end of this brief with Anton at the same time. Wait for **"go ahead"** and his
   picks.
2. Build it, merge it into `dev` once its check is green, check **deploy-dev** is green, and give Anton exact iPhone
   steps to try it on **GT Dev**. He has two friends testing, but **only Anton can get into dev**. So the
   comments and the Feed should be tried with a second account he makes on dev himself (give him the steps: sign
   up a second account in a private Safari tab, follow each other, post, comment).
3. Wait for **"go live"**.

If it grows too big for one go, split it and tell Anton: **step 1** posts, the Feed, comments, 🔥 and the friend's
page tabs; **step 2** the Feed badge (the "something new" counts).

## What it does

### A post

- **Photo**: one, required. Shown big, the same width as the Feed card, cropped the way it was cropped (cut-outs
  show without a background, like product photos, D26).
- **Caption**: optional, up to **500 characters**, plain text with line breaks kept. No links made clickable
  and no @mentions (not part of this item).
- **What it's about** (optional): **one** of your products, **or** one of your Log entries, **or** nothing
  (photo only).
- **Who and when**: the poster's photo (D23 rule) and @username, and the time ("2h", "Yesterday", then a date).
- **🔥 count** and **comment count** under the photo.

**The card** (product or Log entry) sits under the photo:
- **A product** shows its name, type (and strain type), its score in the poster's Leaderboard colours (D48, the
  band it is in, as on their board) and Source if their Privacy allows it (D45). **Never** price, supplier,
  amounts or dates tried (D2, D3). Tapping it opens their product page (`/u/<them>/p/<id>`, in their look, D74).
  Your own post's card opens your own product.
- **A Log entry** shows its name, type and "In the Log". It has no score, because Log entries have no ratings.
  Log entries aren't shared with followers anywhere else, so **the card doesn't open anything** for a follower.
  On your own post it opens the entry.
- If the product **stops being visible** to followers (made Private, archived, returned to the Log, or the
  poster's board is hidden in Privacy), the card shows only the name and type and doesn't open. The post itself
  stays. Work this out on every request, never stored.

### Writing a post (the composer)

Ways in:
- **A Post button** in the **Actions** card of your product page (`client/src/screens/Profile.tsx`) and of a Log
  entry's page (`client/src/screens/LogEntry.tsx`). It opens the composer with that product or entry already
  attached.
- **A New post button** (a "+" or pencil, top right) in the **Feed** header. It asks "What's this about?" with three
  choices: **Something on my Leaderboard** (a searchable list of your products), **Something in my Log** (your Log
  entries), **Just a photo**.

The composer:
- The **photo** starts as the product's cover (or the entry's photo). Under it: **Choose another** (the product's
  other photos), **Take or choose a new photo** (camera or library, then the existing Crop and Cut out tools), and
  **Remove**. With no photo, Post stays disabled and says why.
- The **caption** box, with a small count near the limit.
- A live **preview of the card**.
- **Post**: a big moment, so it plays a sound and has a tick (D56: `play()` after success and `<Tick />`). Then it
  goes to the Feed with the new post at the top.

**A Private product** (Anton's answer 5): pressing Post on a Private product (or picking one in the list) shows a
sheet:
> **This product is private.** Your followers can't see it. Make it visible and post it?
> **Make visible and post** · Cancel

"Make visible and post" turns Private off and posts in one step (one request, all or nothing, so you can't end up
with only half of it done). If you cancel, nothing changes. **Archived** products and **kept** ones (returned to the
Log, D50) aren't offered and have no Post button. Post their Log entry instead.

**The photo belongs to the post.** Posting makes the post its **own copy** of the photo (a server-side R2 copy of
the cropped image and thumbnail, never the original). So later crops, deletes or a product going Private never
change or break a post, and deleting the post deletes only its own copy.

### The Feed (a new tab, in People's place)

- **Tab bar:** Leaderboard · Log · Sources · **Feed** · Settings. Feed gets its own icon pair (solid when on,
  outline when off, D35), for example two overlapping speech bubbles or a stack of cards. Mock it up.
- **The header:** title "Feed". On the left, a **People** button (the people icon) carrying the **follow requests
  badge** that the People tab has now. On the right, **New post**. Your photo (MeButton, D25) stays where the main
  tabs put it. Check in the mockup that it all fits; if it doesn't, New post can be a floating button.
- **The list:** posts by **you and everyone you follow (approved)**, newest first, loaded **20 at a time** as you
  scroll (a cursor of `created_at` and `id`, not page numbers). Each post shows its photo, caption (clamped to 3
  lines with **more**), card, 🔥 and comment count, and the first **two comments**.
- **Tapping** the photo, the comment count or "View all N comments" opens **the post's page**. Tapping someone's
  name or photo opens their page.
- **Pull to refresh** isn't needed. The Feed reloads when you open the tab, as other tabs do. It keeps your scroll
  position when you come back from a post (`scrollReturn`).
- **Empty Feed:** a drawing (D33) with "Nothing here yet" and two buttons, **Find people** (opens People) and
  **Post something**.
- **Shimmer** (D37) while loading: three post-shaped placeholders.
- The Feed shows in **your own look**. A post's page does too. Only a friend's page (both tabs) shows in their look.

### People

- People keeps its screen and address (`/people`), with Following · Followers · Requests (D24) and your card at the
  top. It's reached from the **People button in the Feed** and from **your photo** (MeButton) as now.
- With no People tab, the **Back** button on People goes to the Feed. People shows no tab as current (or Feed;
  decide in the mockup).
- **The tab-bar badge** moves to Feed: it shows the follow requests count, the same number as now. The Feed badge
  for new posts and comments is under "Something new" below.

### A friend's page: Leaderboard | Posts

- `/u/<them>` gets a **two-way switch at the top: Leaderboard | Posts**, opening on **Leaderboard** as now.
  `/u/<them>/posts` opens on Posts, so Back and links work.
- **Posts** is their posts, newest first, in the same card as the Feed, in **their look** (D74: the whole page is
  already wrapped in `InTheirLook`).
- **Not following them** (or a pending request): no switch, exactly as now ("Follow to see their leaderboard"
  becomes "Follow to see their leaderboard and posts").
- **Your own page**: tapping your card in People opens `/u/<you>` with the same two tabs. **Posts** is yours, with
  edit and delete. **Leaderboard** is your board as followers see it, the same as Settings → Privacy → Preview.
  Mock this up. If it gets fiddly, your card can open a plain "Your posts" page instead; ask Anton.

### A post's page

`/posts/<id>`: the post in full (the whole caption), then **every comment**, oldest first, then a **comment box**
fixed above the keyboard ("Add a comment…", up to **300 characters**, **Send**).

- **⋯ menu** on your own post: **Edit caption**, **Delete post** (a confirm sheet, red, with a tick, D56).
- **A comment** shows the photo (D23 rule), @username, the text and the time. Pressing and holding, or a ⋯,
  offers **Delete** on your own comments and on any comment on your own post.
- **🔥**: tap to give, tap again to take back. One per person per post. A small pop when you give one (no sound;
  sounds are only for big moments). **Tapping the count** lists who gave one.
- A post that's **gone** (deleted, unfollowed, blocked) shows "This post isn't available" (the same 404 for every
  reason, so it can't be used to find things out).

### Something new (the Feed badge)

- **On the Feed tab:** a dot when there's something you haven't seen: a new post by someone you follow, or a
  new comment or 🔥 on **your** posts. The **number** stays the follow requests count, as on People today.
  Mock up both together.
- **"Seen"** is one time per account (`users.feed_seen_at` or a small table), set when you open the Feed.
  Comments and 🔥s on your posts are marked seen when you open the Feed, or open that post.
- The session's `/api/auth/me` already carries `pendingRequests`. Add `feedNew: boolean` next to it, so the badge
  costs no extra request.

## Privacy and access (the important part)

- **The one rule:** a post is visible to **its owner** and to anyone who passes **`canView(db, viewer, owner)`**
  (`server/lib/social.ts`): an approved follow and no block either way. Checked **on every request**, so access
  ends the moment someone unfollows, is removed or is blocked. Everything (the post, its photo, its comments, its
  🔥s, the counts) goes through that rule. Any new query that lists posts must apply it in SQL, not by filtering
  afterwards.
- **Commenters you don't know.** Your followers may not follow each other, but they'll see each other's comments
  on your posts: their **@username and comment**. Their **profile photo follows D23 exactly**
  (`photoColumnSql(viewer, commenter)`), so someone you're not connected to shows as a letter. Tapping their name
  opens their page, which shows only "Follow" unless you follow them. **Anton must OK this in the mockup stage**
  (open point 1).
- **Blocks between commenters:** if you've blocked someone, or they've blocked you, you don't see their
  comments or 🔥s anywhere, and they don't see yours. The counts leave them out too.
- **Privacy switches (D45):** a post is something you chose to share, so **posts show whatever your Privacy
  says**. The product card leaves out Source when `shareSource` is off and Country when `shareCountry` is off, and
  it **doesn't open** when `shareBoard` is off. The post's **own photo is always shown**, because you chose it for
  the post, even when `sharePhotos` (product photos) is off. Say this on the Privacy screen in one line: "Posts
  are always shared with your followers."
- **No new privacy switch** for posts in this item (ask before adding one).
- **Field allow-list:** follower replies are built field by field, like `SharedProduct`. Never send purchase
  fields, dates tried, amounts, the original photo, or the Log entry's details beyond name and type.
- **Photos:** a new route serves a post's photo (`cropped` or `thumb` only) after the `canView` check, the same
  403 for every refusal (copy `people.get('/u/:username/photo/:variant')`). Revalidated on every view, not cached
  publicly.
- **Rate limits** (`server/lib/rateLimit.ts`): something generous like 30 posts, 200 comments and 600 🔥 per
  hour per account, so a script can't flood a Feed.

## Data (new migration files only: `migrations/0017_posts.sql`; 0016 is D76)

Suggested tables (adjust if the code suggests better; never edit old migrations):

```sql
CREATE TABLE posts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  log_entry_id  TEXT REFERENCES log_entries(id) ON DELETE SET NULL,
  about_name    TEXT,            -- name and type as posted, for when the product or entry has gone
  about_type    TEXT,
  caption       TEXT NOT NULL DEFAULT '',
  image_set     TEXT NOT NULL,   -- the post's own copy (cropped + thumb) in R2
  cutout        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER,
  CHECK (product_id IS NULL OR log_entry_id IS NULL)
);
CREATE INDEX posts_user_time ON posts(user_id, created_at DESC);

CREATE TABLE post_comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX post_comments_post ON post_comments(post_id, created_at);

CREATE TABLE post_fires (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- the badge
ALTER TABLE users ADD COLUMN feed_seen_at INTEGER;
```

Things to get right:
- **R2 objects:** deleting a post, or an account, must delete the post's photo objects too (`deleteLater`, as
  photos do). Check how account deletion clears R2 today and include posts.
- **Add to leaderboard** (a Log entry promoted to a product, `client/src/promotion.ts` and its route): move the
  entry's posts to the new product (`product_id = new`, `log_entry_id = NULL`) in the same batch, so the card
  starts showing a score. **Return to Log** (D50): the product is kept and hidden, so its posts' cards stop
  opening for followers (that falls out of "work it out on every request"). Moving them to the entry isn't needed.
- **Deleting** a product or Log entry leaves its posts with only `about_name` and `about_type` (a plain card).
- **Late loads (D55):** the composer's "make visible and post" changes a product, so call `changing(id)`.

## API (Hono, `server/routes/posts.ts`, mounted at `/api/posts`)

| Method and path | What |
|---|---|
| `GET /api/posts/feed?before=<cursor>` | Your Feed: yours and people you follow, 20 at a time, each with up to 2 comments, counts, `youFired`. |
| `GET /api/people/u/:username/posts?before=` | Their posts (`canView`), in the same shape. Your own works too. |
| `POST /api/posts` | Make a post: `{ caption, about: {product\|logEntry\|none}, photo: {fromPhotoId} \| {uploadId}, makeVisible?: true }`. A Private product without `makeVisible` → 409 `product_private`. Archived or kept → 409. |
| `GET /api/posts/:id` | One post, every comment (oldest first), counts. 404 for anything you can't see. |
| `PATCH /api/posts/:id` | Edit the caption (owner only). |
| `DELETE /api/posts/:id` | Delete (owner only); its R2 objects later. |
| `POST /api/posts/:id/comments` / `DELETE /api/posts/:id/comments/:cid` | Comment; delete (the comment's author or the post's owner). |
| `PUT` / `DELETE /api/posts/:id/fire` | Give or take back a 🔥. |
| `GET /api/posts/:id/fires` | Who gave one (block rule applies). |
| `GET /api/posts/:id/photo/:variant` | `cropped` or `thumb`, after `canView`. |
| `POST /api/posts/seen` | Mark the Feed seen (or do it as part of `GET feed` with no cursor). |

A new photo for a post can reuse the existing upload flow (`server/routes/photos.ts` `uploads`) and then copy into
the post. Shared types go in `shared/domain/posts.ts` (limits: caption 500, comment 300, with a validator and unit
tests, like the other domain files).

## The client

- `client/src/components/chrome.tsx`: `Tab` gets `'feed'` in place of `'people'`; Feed icons in `icons.tsx`; the
  badge moves.
- New screens: `client/src/screens/Feed.tsx`, `PostPage.tsx`, `Composer.tsx`; a `PostCard` component shared by the
  Feed, a person's Posts tab and your own page.
- `client/src/main.tsx`: routes `/feed`, `/feed/new`, `/posts/:id`, `/u/:username/posts`; old `/people` links keep
  working.
- `Person.tsx`: the Leaderboard | Posts switch; `People.tsx`: Back to the Feed.
- `Profile.tsx` and `LogEntry.tsx`: the Post button in Actions.
- `client/src/api.ts`: the new calls.
- **Every look:** the Feed, post cards, the composer and the comment box must read well in **all fifteen looks**,
  dark and light (D72: anything with its own colour needs a `html[data-tone="light"]` version). Looks change only
  colours and the background (D70).
- **Entrance animations:** any new one goes into `settled()` (testing notes).

## Tests (add these; grep **all** test files for anything renamed, especially the People tab)

**API tests (`test/api/`), most of the testing:**
- Only the owner and approved followers can see a post, its photo, comments and 🔥s; a pending request, an
  unfollow, a removal and a block each end access at once (one test each). Every refusal is the same 404 or 403.
- The Feed has only you and people you follow, newest first, and paging gives no repeats or gaps.
- Commenters blocked either way are hidden from each other, and from the counts.
- The profile photo of an unconnected commenter isn't sent (D23).
- A Private product: 409 without `makeVisible`; with it, the product is visible and the post exists (and neither
  happens if one fails). Archived and kept can't be posted.
- The product card follows Privacy (Source, Country, opening) and never carries price, supplier or dates (test the
  raw response, like D2's test).
- Deleting a post, product, Log entry or account; promotion moves a Log entry's posts to the product.
- Caption and comment limits; edit and delete only by the right person; rate limits.
- Export and Restore (open point 3).

**Unit tests:** the limits validator, the time labels ("2h", "Yesterday").

**Browser tests** (only what needs a browser): one journey (post from a product page, see it in the Feed, a second
account comments and gives a 🔥, the first sees it); the Private sheet; the tab bar and the People button
(`tabbar.spec.ts`, `people.spec.ts`, `header.spec.ts`, `profile.spec.ts`, `theirlook.spec.ts` all mention People:
update them); readability and axe on the Feed, a post's page and the composer in a dark and a light look
(`wholeScreenContrastFailures` for the Feed, which is long). Put the journey and the privacy test in the **core**
set (`test:e2e:core`), since they touch followers and privacy.

## Notes to update in the same pull request

- `SPEC.md`: **D77** with Anton's answers above, a §4 section "Posts, comments and the Feed", the changelog entry;
  amend **D6** (tabs: Feed in People's place) and **D24** (People is reached from the Feed).
- `CLAUDE.md`: the to-do item marked **on dev** (version, date); a testing note on posts (the access rule, how to
  make a second account and a post in a test).
- `README.md` if it lists screens or tabs.
- **Version:** a new minor (0.65.0).
- The **website** (`site/`) needn't change; ask Anton if he wants posts mentioned.

## Open points to settle with Anton at the mockup stage

1. **Commenters who don't know each other** can see each other's @username and comments on a shared friend's post
   (photo only per D23). Is that OK? (Recommended: yes. It's how every social app works, and it's only your
   followers.)
2. **Your own page**: `/u/<you>` with Leaderboard | Posts (recommended), or a plain "Your posts" page?
3. **Export and Restore:** recommended: your **posts** (caption, what they're about, the photo) go in the export
   file and come back on Restore. Comments and 🔥s don't, because they belong to conversations with other
   accounts that won't exist where you restore (for example, live → dev). The discussion first said "your own
   comments too"; this is the reason to drop them. Confirm.
4. **New post button:** in the Feed header (recommended) or a floating button?
5. **The Feed's icon** and whether the dot and the requests number sit together on it.

## Not part of this (ask before adding)

Phone notifications · more than one photo per post · videos · replies to comments · @mentions or hashtags ·
public posts or a "discover" feed · reporting posts · a privacy switch for posts · posting to someone else's page.
