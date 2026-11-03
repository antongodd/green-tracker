---
name: green-tracker-account-audit
description: Audit every account on the live Green Tracker app. Use when Anton asks to "audit all accounts", see everyone on Green Tracker, who's joined, who follows whom, or how the app is spreading. Read-only; shows a table in the conversation and saves nothing anywhere.
---

# Account audit (read only)

Anton wants to see everyone on the live app as a table **inside the conversation**. It answers "who's on it, are
they using it, and how did they find it" as friends pass the app on.

## Hard rules

- **Read only.** Only `SELECT` queries. Never `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, or a migration. Never
  deploy, never change a setting. Other conversations may be working at the same time: touch no branch, file or pull
  request.
- **Nothing leaves the conversation.** Show the result as a markdown table in your reply. Don't write it to the
  repository (it's public), a commit, a pull request, Google Drive or Sheets, an Artifact, email or Slack. Don't send
  a file. A scratch file in your scratchpad is fine while you work, never in the repository.
- **Never select** `email`, `email_lower`, `password_hash`, passkey keys, session tokens, captions, comments' text
  or anything people wrote. The app promises an email is never shown to anyone else (D80); counts and @names are
  enough. If Anton asks for emails, tell him that and ask him to confirm before showing them only to him.
- This recipe holds the query, **never results**. Don't paste anyone's data into this file.

## 1. Run the query

The live database is D1 `green-tracker` (`database_id` in `wrangler.jsonc`, account `account_id` at the top of
it). The cloud environment's proxy signs requests to `api.cloudflare.com`, so the token is a dummy. Save this as
`audit.py` in your scratchpad and run `python3 -I audit.py`:

```python
import json, re, urllib.request
cfg = open('/home/user/green-tracker/wrangler.jsonc').read()  # adjust the path to the checkout
account = re.search(r'"account_id":\s*"([0-9a-f]+)"', cfg).group(1)
db = re.search(r'"database_name":\s*"green-tracker",\s*"database_id":\s*"([0-9a-f-]+)"', cfg).group(1)
SQL = """
SELECT u.username,
  date(u.created_at/1000,'unixepoch') AS joined,
  CAST(julianday('now') - julianday(u.created_at/1000,'unixepoch') AS INTEGER) AS days_on,
  (SELECT date((MAX(expires_at)-5184000000)/1000,'unixepoch') FROM sessions s WHERE s.user_id=u.id) AS last_seen,
  (u.email IS NOT NULL) AS has_email,
  (SELECT COUNT(*) FROM passkeys p WHERE p.user_id=u.id) AS face_id,
  (SELECT COUNT(*) FROM products p WHERE p.user_id=u.id) AS products,
  (SELECT COUNT(*) FROM log_entries l WHERE l.user_id=u.id) AS log_entries,
  (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) AS posts,
  (SELECT COUNT(*) FROM post_comments c WHERE c.user_id=u.id) AS comments,
  (SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id AND f.status='approved') AS followers,
  (SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id AND f.status='approved') AS following,
  (SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id AND f.status='pending') AS requests_waiting,
  (SELECT group_concat(x.username, ', ') FROM follows f JOIN users x ON x.id=f.follower_id
     WHERE f.followed_id=u.id AND f.status='approved') AS followed_by,
  (SELECT x.username FROM follows f JOIN users x ON x.id=f.followed_id
     WHERE f.follower_id=u.id ORDER BY f.created_at LIMIT 1) AS first_followed
FROM users u ORDER BY u.created_at
"""
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query",
    data=json.dumps({"sql": SQL}).encode(),
    headers={"Authorization": "Bearer dummy", "Content-Type": "application/json"}, method="POST")
d = json.load(urllib.request.urlopen(req))
assert d["success"], d
print(json.dumps(d["result"][0]["results"], indent=1))
```

Notes on the columns:
- Times are in milliseconds. **Last seen** is a guess: sign-ins last 60 days (`SESSION_TTL`) and slide forward
  when used, so the newest expiry minus 60 days is about the last visit. Say "about".
- **First followed** is the first person they asked to follow: usually whoever told them about the app.
- If the query fails because a column or table changed, check `migrations/` and fix this file in a notes-only pull
  request (still never with results in it).

## 2. Show it

Reply with, in plain words (Anton isn't a developer):

1. **A summary**: how many accounts; how many joined in the last 7 days; how many seen in the last 7 days; how many
   haven't added an email and password yet; follow requests still waiting.
2. **The table**, oldest account first, one row each: @name, Joined, Last seen (about), Email & password (Yes / Not
   yet), Face ID (Yes / No), Products, Log entries, Posts, Comments, Followers, Following, Requests waiting, Followed
   by, First followed. Mark Anton's own accounts (`anton_godd`, and `anton_pc` if still there) with "(you)".
   If the table is too wide to read on a phone, split it: one table for who and when, one for activity and follows.
3. **What's new** since the last audit in this conversation, if there was one (new accounts, new follows).
   Across conversations there's no earlier result to compare with: say so, and compare by join dates instead.
4. **Worth noticing**, briefly: people who joined but never added anything, people who don't follow Anton
   (friends of friends), people not seen for a while.
