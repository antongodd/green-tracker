# The ad video (2026-11-04/05)

A 26-second ad for Green Tracker, made for the website and for sharing. Anton approved this cut on 2026-11-05.
**It isn't on the website yet**: adding it is its own job (a big change: where it goes, on the preview first,
live on Anton's "go live").

| File | What |
|---|---|
| `ad.mp4` | Widescreen, 1920×1080, 30 fps, H.264 + AAC, 26 s, about 6 MB, `+faststart`. Its first frame is the poster. Sound at −16 LUFS. |
| `ad-poster.jpg` | Its poster: the Leaderboard with Mega Z Emerald at #1 (13.5 s). |
| `ad-vertical.mp4` | Upright, 1080×1920, the same cut, for Stories, TikTok and WhatsApp Status. |
| `ad-vertical-poster.jpg` | Its poster. |
| `share-copy.txt` | A line to post with it. |
| `source/` | How it was made (below). Not needed to use the video. |

## What's in it (for captions and the page's words)

There's no speech: music and soft effects only. These are the words on screen, which captions (a `.vtt` like
`site/public/media/home-screen.vtt`) could follow:

| Time | On screen |
|---|---|
| 0.0–3.0 | A text from "Jay": "bro what was that one we had last month 🔥" … "no idea 💀" |
| 3.0–5.5 | Green Tracker's icon. **Rate your stash. Remember the fire.** |
| 5.5–10.0 | RATE IT · **Score it out of 10.** Name, photo, a slide of your thumb. (The add-a-product form: Mega Z Emerald, its photo, Hybrid, Look up to 9.5.) |
| 10.0–14.0 | RANK IT · **Your Leaderboard, sorted.** Your best, always at the top. (Mega Z Emerald drops in at #1.) |
| 14.0–18.5 | SHARE IT · **Post it. Your friends see it.** Only the friends you approve. (Posting it; @mira's 🔥 and "need to try this 👀".) |
| 18.5–22.5 | TRACK IT · **Know your plug.** Every shop, coffeeshop and plug, and what you spent there. (Sources, then The Grove's page.) |
| 22.5–26.0 | **Green Tracker** · Rate your stash. Remember the fire. · Free · Made for iPhone · No ads · 18+ · Sign up free · green-tracker-site.green-tracker.workers.dev |

## What's real and what's made up (D88's rule)

- The screens are the real app (0.77.1, before the stage B/C Looks and Strainz), filmed from a private local copy,
  never live or dev data.
- Anton's own photos, strain names and top-five scores, the ones already public on the website (Mega Z Emerald 9.5,
  Super Boof, Tide, California OG, Lemon Popperz). The other scores are made up.
- Made up: the people (@nugnotes, @mira, "Jay", plain-figure profile photos), the shops and plugs (The Grove,
  Northside, Uncle Mo, Kush Corner), every price, the post caption and the comment.
- The music and effects were synthesized for it (`source/audio.py`): no licence or credit needed.

## On the website, when it's added

- Like the how-to video (D68): `preload="none"`, the poster, `playsinline`, sound only when tapped, nothing loaded
  from anywhere else. Copy the files into `site/public/media/` (the website only serves that folder).
- The test browser can't decode H.264, so tests check the settings and what's downloaded when, not playback.
- The app on screen is 0.77.1's: the Leaderboard colours and Looks have changed since (stages B and C), and the Log
  tab is now Strainz. Re-filming would need the steps below.

## How it was made (`source/`)

Made with the `brag` skill (its slim version). The real app ran locally on the browser tests' server
(`E2E_PORT=8790 node test/e2e/server.mjs`); `seed.mjs` made the two pretend accounts through the API with the
website's photos (cut-outs as PNG, thumbnails, an original on a dark background); `film.mjs` (editor, Leaderboard)
and `film2.mjs` (Feed, Sources) took 3× screenshots at 393×852 with `--safe-top` 50px and `--safe-bottom` 30px and
`LANG=en_GB` (UK dates). **Film only settled screens:** screenshots taken while the app animates play back jerky
(Anton spotted it); the moves between screens are drawn in `compose.html`, a page where `render(t)` draws any moment.
`render.mjs` screenshots it 30 times a second into ffmpeg with `sound.wav` from `audio.py` (120 bpm, every cut and
effect on the beat); `stills.mjs` takes single moments to check. Finally the poster was laid over frame 0 and the
sound set to −16 LUFS with ffmpeg's `loudnorm`. The screenshots themselves (about 300 MB) weren't kept.
