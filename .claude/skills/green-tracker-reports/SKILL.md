---
name: green-tracker-reports
description: Show Anton the reports people have made on the live Green Tracker app (posts, comments and people reported with Report, D84), and remove a post or comment only when he says so. Use when Anton asks to "see the reports", "check reports", whether anything has been reported, or to remove something that was reported.
---

# Reports (D84)

People report a post, a comment or a person with **⋯ → Report**. Each report is a row in the live database's
`reports` table (migration 0021). Anton sees them by asking a conversation: this recipe. It is like the account
audit (`green-tracker-account-audit`): read only, and nothing leaves the conversation, unless Anton asks for
something to be removed and confirms it (step 3).

## Hard rules

- **Read only** until Anton confirms a removal in so many words ("yes, remove it"). Never change a report, a block or
  a follow. Never deploy, never change a setting, never touch a branch, file or pull request.
- **Nothing leaves the conversation.** Show results as tables in your reply, never in the repository (it's public),
  a commit, a pull request, Drive, an Artifact, email or Slack. This file holds queries, **never results**.
- **Never select** `email`, `email_lower`, `password_hash`, passkeys, sessions or devices. The reported text (a
  caption or a comment) may be shown to Anton: he is the operator, and judging it is the point. Nothing else people
  wrote (notes, other comments) is shown.
- The reporter is never told anything, nor is the person reported. Don't suggest contacting anyone.
- You're not a lawyer. If something looks like a crime (supplying drugs to a named person, a child, a threat), say
  so plainly, suggest removing it, and say Anton may want proper advice; don't give legal advice.

## 1. Read the reports

The live database is D1 `green-tracker` (`database_id` in `wrangler.jsonc`, `account_id` at the top). The proxy
signs requests to `api.cloudflare.com`, so the token is a dummy. Save as `reports.py` in your scratchpad and run
`python3 -I reports.py`:

```python
import json, re, urllib.request
cfg = open('/home/user/green-tracker/wrangler.jsonc').read()  # adjust the path to the checkout
account = re.search(r'"account_id":\s*"([0-9a-f]+)"', cfg).group(1)
db = re.search(r'"database_name":\s*"green-tracker",\s*"database_id":\s*"([0-9a-f-]+)"', cfg).group(1)
SQL = """
SELECT r.id, r.kind, r.reason, datetime(r.created_at/1000,'unixepoch') AS reported_at,
  rep.username AS reported_by, own.username AS about_who,
  r.post_id, r.comment_id,
  CASE r.kind WHEN 'post' THEN (SELECT p.caption FROM posts p WHERE p.id = r.post_id)
              WHEN 'comment' THEN (SELECT c.body FROM post_comments c WHERE c.id = r.comment_id) END AS what_they_wrote,
  (SELECT COUNT(*) FROM reports x WHERE x.owner_id = r.owner_id) AS reports_about_them,
  EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = r.reporter_id AND b.blocked_id = r.owner_id) AS reporter_blocked_them
FROM reports r JOIN users rep ON rep.id = r.reporter_id JOIN users own ON own.id = r.owner_id
ORDER BY r.created_at DESC
"""
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query",
    data=json.dumps({"sql": SQL}).encode(),
    headers={"Authorization": "Bearer dummy", "Content-Type": "application/json"}, method="POST")
d = json.load(urllib.request.urlopen(req))
assert d["success"], d
print(json.dumps(d["result"][0]["results"], indent=1))
```

Reasons: `supply` Selling or offering to supply, `personal` Phone number, address or other personal details, `face`
Someone's face without their OK, `under18` Looks under 18, `abuse` Threats, hate or harassment, `other` Something
else. A report goes when the post, the comment or either account is deleted, so what's listed is still there.

## 2. Show them

In plain words (Anton isn't a developer): how many reports, how many new since this conversation last looked;
then a table, newest first: When, What (post / comment / person), Reason, About (@name), Reported by (@name), What
they wrote (shortened), Reports about them in all. Then **worth acting on**: supplying, personal details, under 18
and threats first, and anyone reported more than once. If there are none, say "No reports yet."

To see a reported post's photos, Anton opens it in the app only if he follows that person; you can't show them.

## 3. Removing something (only when Anton confirms)

When Anton asks to remove a post or comment: show exactly what will go (@name, the text, when), and wait for his
"yes". Then:

- **A comment:** `DELETE FROM post_comments WHERE id = '<comment_id>'` (its reports go with it).
- **A post:** first `SELECT user_id, image_set FROM post_photos WHERE post_id = '<post_id>' UNION SELECT user_id,
  image_set FROM posts WHERE id = '<post_id>'`, then `DELETE FROM posts WHERE id = '<post_id>'` (comments, fires,
  photos rows and reports go with it), then delete its files from R2 bucket `green-tracker-photos`:
  `u/<user_id>/s/<image_set>/cropped.jpg` and `thumb.jpg` (or `.png` for a cut-out) through the R2 API
  (`DELETE /accounts/<account>/r2/buckets/green-tracker-photos/objects/<key>`).
- **Closing an account** is bigger (everything they have goes, and their files): don't do it from this recipe. Say
  so and suggest a conversation of its own that plans it with him first.

Then run step 1 again and show that it's gone. Tell Anton that the person isn't told, and that a copy stays in
Cloudflare's 30-day backups (Time Travel) before it's gone for good.
