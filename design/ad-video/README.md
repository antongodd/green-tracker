# The ad video (2026-11-10)

An 85-second film of Green Tracker for the website and for social media, plus a 24-second short cut. It replaces the
26-second ad of 5 November (which showed the app before Strainz, the new Looks and the Feed cards). GT Ideas #37.
**It isn't on the website yet**: that's its own job (GT Ideas #29, a big change, after #26).

| File | What |
|---|---|
| `ad-vertical.mp4` | The film, upright, 1080×1920, 30 fps, H.264 + AAC, 85 s, about 30 MB, `+faststart`. For phones, Reels, TikTok, Stories. Its first frame is the poster. Sound at −16 LUFS. |
| `ad.mp4` | The same film, widescreen, 1920×1080, about 31 MB. For the website and YouTube. |
| `ad-short-vertical.mp4` | The short cut, upright, 24 s, about 8 MB: the question, rate, rank, Strainz, friends, Looks, the end card. |
| `ad-vertical-poster.jpg`, `ad-poster.jpg`, `ad-short-vertical-poster.jpg` | The posters (the new #1 on the Leaderboard). |
| `share-copy.txt` | A line to post with it. |
| `source/` | How it was made (below). Not needed to use the videos. |

For the website the files are large: re-encode smaller first (`ffmpeg -i ad.mp4 -crf 26 -preset slow …`), and load
nothing until it's played (`preload="none"`, the poster), like the how-to video (D68).

## What's in it (for captions and the page's words)

No speech: music and soft effects only. The words on screen:

| Time | Scene | On screen |
|---|---|---|
| 0:00–0:05 | The problem | A group chat, "the sesh 🌿": "yo what was that one we had at mine last week?? 🔥" · "the purple one?" · "nah the OTHER one" · "no idea 💀". **Every sesh. Same question.** |
| 0:05–0:08 | The reveal | The app's icon opens into the Leaderboard. GREEN TRACKER · **Remember the fire.** |
| 0:08–0:13 | Snap it | A photo of a bud on a table; the background is cut away. **Snap your bud. We cut it out.** |
| 0:13–0:24 | Rate it | New product: the name typed (Zkittlez), Sativa, the five scores slid up, Save; then its page, #1 on your Leaderboard, 9.5. **Rate it while it's fresh.** then **9.5. Certified gas.** |
| 0:24–0:31 | Rank it | The Leaderboard, Zkittlez at #1 ("New #1"), then a scroll down the list. **Your top shelf, sorted.** |
| 0:31–0:39 | Strainz | The shelves, a swipe, then Zkittlez's page: average, kinds, price, friends who've tried it, your Zkittlez products. **Every strain you've ever had.** |
| 0:39–0:45 | Sources | Sources, then The Grove's page: 4 products, £292.00 spent. **Know your plug. Know your spend.** |
| 0:45–0:53 | Post it | New post, the caption "last week's winner 🔥", Post; the Feed, then 3 🔥 and two comments arrive. **Show your mates the gas.** |
| 0:53–1:01 | Your mates | @jay's Zkittlez: "You've had this too" (9.5 against 9.0), Friends who've tried it; then @jay's Strainz tab, You've both tried. **See who's had what.** |
| 1:01–1:07 | Private | A follow request approved; the Private switch on a product. **Only the mates you approve.** |
| 1:07–1:13 | Looks | The Leaderboard in five Looks: Sakura, Deep Sea, Lava Lamp, Outrun, Daylight. **Your stash. Your look.** |
| 1:13–1:19 | The answer | The chat again: a Zkittlez card, "it was Zkittlez. 9.5 🔥" · "LEGEND. get it again" · "ok I need this app 👀". **Now you just know.** |
| 1:19–1:25 | The end card | **Green Tracker** · Rate your stash. Remember the fire. · Free · Made for iPhone · No ads · 18+ · Sign up free · Link in bio |

## What's real and what's made up (D88's rule)

- **The app's screens are the real app** (0.84.1), filmed frame by frame from a private local copy, never live or dev
  data. Every tap, slide, Save and Post in the film really happened in that copy.
- **Anton's own**: the cut-out photos, the strain names and most scores, read once, read-only, from his live account
  (public products only; with his yes on 2026-11-10). Zkittlez is the star at 9.5 for the story (his real score is
  8.8); a second Zkittlez (a pre-roll) and a Lemon Popperz pre-roll were added so Strainz has something to show.
- **Made up**: the people (@nugnotes, @jay, @mira, @kofi, @sam and their emoji photos), the group chat, every source
  (The Grove, Northside, Uncle Mo, Kush Corner, Coastline, Popperz, Terp Lab, Homegrown, Rainbow Farm), every price,
  the post's caption and the comments, the Want to try lists.
- **Drawn for the video, not filmed**: the group chat, the icon opening, the end card, and the *Snap it* moment (the
  table under the bud is drawn; the cut-out is the one the app's own Remove background made of Anton's photo). In
  *Rate it* the form is the real editor of a draft that already held that cut-out, with its title changed to "New
  product". The iPhone around the screen, the status bar (4:20) and the finger are drawn.
- Nobody is shown smoking. The music and effects were synthesized for it (`source/audio.py`): no licence or credit.
- **Not checked by ear**: the film was made in the cloud, where nothing can be listened to. The sound was checked by
  its levels and its spectrum only. Anton listens before it's used anywhere.

## How it was made (`source/`)

Made with the `brag` skill, following its own-tools route (as the first ad did): no Hyperframes in the cloud.

1. `reset.sh` starts the app locally on the browser tests' server (port 8790, a fresh database) and runs `seed.mjs`,
   which makes the pretend accounts through the API. It needs the photos in `nugs/` (not kept in the repository:
   Anton's cut-outs as `<strain>.png`, a 320px `-t.png`, a `-o.jpg` original, and `av-<name>.jpg` avatars).
2. `shots.mjs` films the shots in order with `film.mjs`: one screenshot per 1/30 s at 3×, with **every CSS animation
   and transition paused and stepped by hand** (`__step`), so the app's own motion (the Look's lights, the colour
   set's sparkles, switches, page fades) is smooth however long a screenshot takes. View transitions are switched off
   (`lib.mjs`); the moves between pages are drawn in `compose.html`. Fonts: Inter stands in for the iPhone's own.
3. `tl.js` is the timeline: 90 beats a minute at 30 frames a second, so a beat is exactly 20 frames and every scene
   starts on one. `events.mjs` turns it (and where the finger pressed) into `timeline.json`; `audio.py` writes the
   music and effects from that, so sound and picture share one grid.
4. `compose.html` draws any moment (`render(t)`; `?v=1` upright). `render.mjs` photographs it 30 times a second into
   ffmpeg; `stills.mjs` takes single moments to check. `short.mjs` lifts whole bars from the finished film for the
   short cut, with its own mix (`audio.py short`).
5. Last: sound to −16 LUFS (`loudnorm`), the poster laid over frame 0, H.264 at CRF 21.

The filmed frames (about 700 MB) weren't kept.
