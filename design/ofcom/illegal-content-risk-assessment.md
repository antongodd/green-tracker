# Green Tracker: illegal content risk assessment

> **This is not legal advice.** A draft by Claude for Anton, from Ofcom's guidance and the app as it is on
> 3 November 2026 (version 0.73.1). Anton reads it, corrects it, signs it and keeps it. Points marked 🔎 come from
> summaries of Ofcom's guidance or from memory, because Ofcom's website couldn't be opened from where this was written:
> check them on Ofcom's site. Blanks marked ✍️ are for Anton.

## The record (what Ofcom expects written down)

| | |
|---|---|
| Service | Green Tracker, https://green-tracker.green-tracker.workers.dev (the app) and https://green-tracker-site.green-tracker.workers.dev (the website, which has no user content) |
| Kind of service | User-to-user (people share posts, photos and comments with each other). Not a search service. Not a pornography service. |
| Provider | Anton ✍️ (full name), running it alone, as a free hobby app, in the UK |
| Person responsible for these duties | Anton ✍️ (full name). Ofcom's Codes ask every service to name one person accountable for the illegal content, reporting and complaints duties 🔎 |
| Contact | greentracker.help@gmail.com (on the privacy page, the house rules and the website) |
| Date of this assessment | ✍️ (the day Anton signs it) |
| Version of the app assessed | 0.73.1 (live since 2026-11-03) |
| Number of accounts | ✍️ (from the account audit; a small number, mostly Anton's friends) |
| How it was done | Ofcom's four steps (below), using Ofcom's Risk Profiles for user-to-user services and its Register of Risks 🔎, plus the app's design records (`SPEC.md`), its code, and the review panel's report of 2026-11-03 |
| Evidence used | What the app lets people do (the code); the reports people have made (Report since 0.73.0: ✍️ how many so far, from "show me the reports"); what Anton knows about who uses it; no complaints received ✍️ |
| Result | **Drugs and psychoactive substances: medium risk.** Everything else: **low** or **negligible**. See the table. |
| Next review | By **3 November 2027** at the latest, and **before** any big change to what people can share (see "When this is looked at again") |
| Signed | ✍️ name, date |

## Step 1: understand the harms (what Green Tracker is)

Green Tracker is a **diary for adults** for rating cannabis products they've tried: a ranked list of products with
scores, photos, prices and notes (the *Leaderboard*), things tried but not rated (the *Log*), and where they came from.
It's made for iPhone, it's free, there are no ads, and it's run by one person.

**What people can share with each other** (the parts the Act is about):

- **Posts** (since 2026-11-02): up to 10 photos and a caption of up to 500 characters, optionally about one of their
  products or Log entries.
- **Comments** (up to 300 characters) and a 🔥 on posts.
- **Their profile**: an @name and a profile photo.
- **Their Leaderboard**, as far as their Privacy settings share it (name, type, strain, score, Source = the brand or
  grower, country, product photos). **Never** prices, the Supplier (the shop or dealer), amounts, dates or notes.

**Who sees it:**

- Posts and the Leaderboard: **only followers the person has approved** (D77, checked in the database on every
  request). There are **no public posts** and nothing can be seen without an account.
- A comment is seen by everyone who can see that post, so two of the poster's followers who don't know each other can
  see each other's comments.
- Anyone with an account can find another account by searching its @name, and send a follow request. Before a request
  is approved they see only the @name (and the profile photo, if the person allows it, D23).

**What isn't there** (each of these matters in Ofcom's Risk Profiles 🔎):

- **No private messages**, no group chats, no groups or communities.
- **No live streaming, no video**, no voice.
- **No clickable links** between people: captions and comments are plain text. The only link in the app, a product's
  Leafly link, is never shown to followers.
- **No public feed, no recommendations** of strangers, no "people you may know", no trending.
- **No buying, selling or payments** of any kind. Nothing is bought or sold through the app.
- **No anonymous use**: every account has an email and a password (D80). Emails aren't checked yet (to-do 11).
- Photos lose their hidden location data: every photo is redrawn in the phone before upload, which drops it.

**Who uses it:** adults in the UK, mostly Anton's friends and their friends, invited by sharing the website (D82). The
house rules and sign-up say 18 or over. The children's access assessment covers children separately.

## Step 2: assess the risk of each kind of illegal harm

Ofcom asks for each of the **17 kinds of priority illegal content** to be assessed on its own, plus other illegal
content 🔎 (Ofcom splits child sexual abuse into grooming, abuse images, and links to abuse images; they're three rows
here). For each: **how likely** it is to appear on Green Tracker, and **how bad** it would be if it did (how many people
it reaches, how badly they could be hurt). Ofcom's levels are **negligible, low, medium, high** 🔎.

What already reduces every risk below:

- **Small and closed:** only approved followers see anything; nothing is public; no strangers are recommended.
- **No private messages, groups, links, video or live streams**, which Ofcom's Risk Profiles link to most of these
  harms 🔎.
- **House rules** (Settings › About › House rules; agreed to at sign-up): 18+, no selling or supplying (“no ‘DM me’”), no
  personal details, no faces without a yes, be decent.
- **Report** on every post, comment and profile, with six reasons (selling or offering to supply; personal details;
  someone's face without their OK; looks under 18; threats, hate or harassment; something else). It hides the thing
  for the reporter at once. Anton reads reports and removes posts and comments that break the rules.
- **Block** (they can't see you or your posts, comments or fires, and you don't see theirs), **Remove follower**, and
  the poster can **delete any comment** on their own post.
- **Limits:** 30 posts, 200 comments and 60 reports an hour per account; 10 sign-ups an hour per address; 3,000
  photos an account.
- **Delete account** removes everything at once.

| Kind of illegal content | Likely? | How bad? | Risk | Why |
|---|---|---|---|---|
| **Drugs and psychoactive substances** (offering to supply, supplying, being concerned in supply) | **Possible** | Moderate: reaches only that poster's approved followers, but supply is serious | **Medium** | The whole app is about cannabis, and its users buy it, so a comment like "got some spare, want an eighth?" or a caption naming a price and a number is easy to imagine. Posts and comments are Ofcom's "posting content" and "commenting" risk factors 🔎. Kept down by: no messages, no links, no public reach, the house rule, a Report reason for exactly this, the Supplier never being shared, and Source wording that means the brand, not the dealer (0.69.3). Showing your own use is not one of these offences; offering to supply is. |
| Child sexual abuse: grooming | Unlikely | Very severe | **Low** | Adults only, approval-only following, no messages, so an adult can't contact a child privately. Comments are seen by everyone on the post. "Looks under 18" is a Report reason. Not negligible because the age tick can be lied past. |
| Child sexual abuse: images | Very unlikely | Very severe | **Low** | Photos can be posted, which Ofcom links to this harm 🔎, but only to approved followers, never publicly. Nothing in the app's purpose invites it. No automatic image scanning (Ofcom asks it only of large or high-risk file-sharing services 🔎). |
| Child sexual abuse: links to images | Very unlikely | Very severe | **Negligible** | No clickable links anywhere between users. |
| Terrorism | Very unlikely | Severe | **Negligible** | Nothing in the purpose; no public reach, no groups. |
| Hate | Unlikely | Moderate, small reach | **Low** | Comments and captions are text; a house rule; a Report reason. |
| Harassment, stalking, threats and abuse | Unlikely | Moderate | **Low** | Comments between followers who don't know each other are possible (D77). Block, Remove follower, deleting comments on your post, Report; follow requests need approval, and a request shows only an @name. |
| Controlling or coercive behaviour | Unlikely | Moderate | **Low** | A partner who knows the password could read someone's diary, but that's not content shared on the service. Same tools as above. |
| Intimate image abuse | Very unlikely | Severe | **Low** | Photos can be posted to followers; the house rules ask for a yes before posting anyone's face; a Report reason for faces. |
| Extreme pornography | Very unlikely | Severe | **Negligible** | Nothing in the purpose; only approved followers. |
| Sexual exploitation of adults | Very unlikely | Severe | **Negligible** | No messages, no money, no public profiles beyond an @name. |
| Human trafficking | Very unlikely | Very severe | **Negligible** | As above. |
| Unlawful immigration | Very unlikely | Severe | **Negligible** | As above. |
| Fraud and financial offences | Unlikely | Moderate | **Low** | No payments, no links, no marketplace. A fake account could pretend to be a friend to get a follow approved. |
| Proceeds of crime | Very unlikely | Moderate | **Negligible** | Nothing is bought or sold through the app; prices are never shared. |
| Firearms, knives and other weapons | Very unlikely | Severe | **Negligible** | Nothing in the purpose. |
| Encouraging or assisting suicide (or serious self-harm) | Very unlikely | Very severe | **Low** | Possible in any comment box, but the reach is a few friends. Report ("Something else"); Anton removes it. |
| Foreign interference | Very unlikely | Moderate | **Negligible** | No public reach. |
| Animal cruelty | Very unlikely | Moderate | **Negligible** | Nothing in the purpose. |
| Other illegal content (for example threatening or false messages sent to harm someone, sending unwanted sexual images) 🔎 | Unlikely | Moderate | **Low** | Covered by the same rules, Report and Block. |

The names and number of the kinds of harm are Ofcom's list as Claude knew it (17 kinds), checked against search
summaries only 🔎. If Ofcom's list on its site differs, add the missing row the same way.

**Overall:** one **medium** risk (drugs) and nothing high. In Ofcom's terms that's probably a **small, single-risk
service** (not "multi-risk", which would need medium or high in two or more kinds 🔎).

## Step 3: decide what to do, do it, and write it down

Ofcom's Codes of Practice list measures; a service that follows the ones that apply to it counts as doing enough 🔎.
For a small service, most apply only at medium or high risk. What Claude understands applies to Green Tracker, and
where it stands:

| Measure (Ofcom's Codes, 🔎 wording from summaries) | Green Tracker | Done? |
|---|---|---|
| A **named person** accountable for the illegal content, reporting and complaints duties | Anton (this paper) | ✍️ once signed |
| A way to **review content** that may be illegal and **take it down swiftly** when you know about it | Anton reads reports with the reports recipe and removes posts and comments on his "yes" | Partly: reports reach Anton only when he asks (to-do 13) |
| An easy way for users to **report** illegal content | ⋯ › Report on posts, comments and profiles | Yes |
| A way to **complain**, including about a decision (for example your post was removed), with complaints dealt with | The contact address | Partly: the house rules don't say you can complain about a decision (to-do 13) |
| **Terms** that say how people are protected from illegal content, clear and easy to find | House rules and privacy page, linked at sign-up and in Settings | Yes (the complaints line above aside) |
| **Remove accounts** of banned (proscribed) organisations | Not expected here; no way yet to close someone else's account | Partly (to-do 13) |
| For a medium drug risk: keep the rules **enforced** and the reporting **prioritised** for supply | "Selling or offering to supply" is the first Report reason; the reports recipe lists supply first | Yes |

**What else could be done** (not needed now; worth it if the risk grows):

1. Reports reaching Anton without asking: a weekly reminder, or a message when one arrives (to-do 13).
2. A way to close an account that keeps breaking the rules (to-do 13).
3. A gentle check when someone types a phone number or "DM me" in a caption or comment ("The house rules say no
   selling or personal details"). Not proposed yet: ask Anton first.
4. A proper age check, if the app opens up beyond friends (to-do 14).

## Step 4: report, review and update

- **Who sees this:** Anton is the whole organisation, so there's no board to report to; signing it is the step.
- **Keep the record**, and every older version, somewhere safe outside the app 🔎 (Ofcom's record-keeping guidance asks
  for records to be kept and to be available if it asks).
- **When this is looked at again:**
  - at least **once a year** (by 3 November 2027);
  - **before** a big change to what people can share or who can see it: private messages, groups, public posts or a
    public Feed, links, video or live streams, recommending people, selling, or opening sign-up to everyone. Ofcom
    expects the assessment to be redone **before** a significant change is made 🔎;
  - if reports show a new kind of problem, or the number of accounts grows a lot;
  - if Ofcom changes its Risk Profiles or Codes.

---

✍️ Signed: ______________________ (Anton, the person responsible)  Date: ____________
