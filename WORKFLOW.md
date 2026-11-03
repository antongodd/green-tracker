# How a change gets made (for Anton)

A one-page guide to working with Claude on Green Tracker. You just talk normally; Claude picks the right recipe.
(The recipes are in `.claude/skills/`. You can also type their names, like `/go-live`, but you never need to.)

## Every conversation starts the same way

Claude reads you the **to-do list**, tells you if **another conversation** seems to be working on something, and
mentions anything on GT Dev **waiting for your "go live"**. Then it gets on with what you asked.

## Small or big?

Claude says which at the start. You can always overrule it.

| | Small | Big |
|---|---|---|
| What | A fix, wording, a tweak to something that's already there | A new feature, screen or Look; anything that changes the database, privacy or what followers see |
| You're asked | Nothing, unless what you want is unclear | Questions, then **"go ahead"** (and which mockup), then **"go live"** |
| You hear back | "It's live, here's how to see it" | "It's on GT Dev, here's how to try it", then later "It's live" |

### A small change

1. You say what you want.
2. Claude builds it, tests it, and puts it on GT Dev and then live, without stopping.
3. Claude tells you it's live and how to see it on your iPhone.

### A big change

1. You say what you want. Claude asks the questions only you can answer.
2. Claude sends a plan and **iPhone mockups**, with its pick marked. You choose and say **"go ahead"**.
3. Claude builds it and puts it on **GT Dev**, then sends exact steps to try it on your iPhone.
4. You try it and send screenshots of anything odd. Claude fixes things until you're happy.
5. You say **"go live"**. Claude puts it live and tells you how to see it.

## Who's on the app

Ask Claude to "audit all accounts" any time. You get a table in the conversation of everyone on the live
app: when they joined, when they were last on, what they've added, and who follows whom. It only looks; nothing is
saved or sent anywhere, and nobody's email is shown.

## A review

Ask for "the review panel" any time. Five reviewers (Sam, the everyday user, counts most; a proof-reader, a
developer, a marketing pro and a sceptic) look at the app and the website, and you get one page to read on your
phone, with a to-do list split into jobs, each for its own conversation.

## If something on live breaks

Tell Claude what you see (a screenshot helps). It **puts the previous version back first**, so the app works again
within minutes, and then fixes the problem properly.

## Two conversations at once

You can run two conversations at the same time. It works best when they're about **different parts of the app**:
"fix something on the Log" alongside "a new Look" is fine. Two changes to the same screen are better done one after
the other.

- You don't need to tell them about each other: each one checks GitHub for the other's work when it starts, and
  again before it finishes. If it's useful, though, say "another conversation is doing X".
- If both change the same notes or version number, whichever finishes second sorts it out.
- A small change goes live straight away, but **never takes a big change live with it** before you've said "go live"
  for that one. If that would happen, Claude tells you and asks.

## Words that do things

| You say | What happens |
|---|---|
| "go ahead" | A big change's plan is approved: Claude builds it and puts it on GT Dev |
| "go live" | What's on GT Dev goes to the live app |
| "what's on the to-do list?" | Claude reads it to you |
| "add X to the to-do list" | It goes on the list, in a quick notes-only update |
| "live is broken" | Claude puts the previous version back, then fixes it |
