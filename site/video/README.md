# The website's how-to video (D68)

The 24-second video on the website's "Get it" section, showing how to put Green Tracker on an iPhone Home Screen
in Safari on iOS 26 (⋯ → Share → View More → Add to Home Screen → Add). It's drawn in code (a canvas, frame by
frame) in a frosted-glass style, with synthesized sound. This folder isn't published; only the rendered files in
`site/public/media/` are.

- `src/harness.js`: drawing helpers (seeded randomness, noise, colour).
- `src/sound.js`: the sound kit (Web Audio, no audio files).
- `src/scene.js`: the picture. `explainer(ctx, W, H, t)` draws the frame at time `t`; `GTX.poster(…, 'phone')` draws
  the thumbnail. The iPhone screens follow the owner's screenshots of Safari on iOS 26 (2026-10-26). The products are
  the app's and the website's made-up ones; the people in the share sheet are plain figures.
- `src/score.js`: the sound, with every time matched to the picture.
- `player.tpl.html`: a player (play, scrub, sound, loop) the sources are poured into.

To change it, edit `src/`, then from the repo root run `node site/video/render.cjs` (needs ffmpeg; set
`PW_CHROMIUM=/opt/pw-browsers/chromium` in the cloud environment). It writes `site/video/out/player.html` to watch in
a browser (it loads the Inter font from Google Fonts, which is fine here: it isn't part of the website) and replaces
`site/public/media/home-screen.mp4` and `home-screen.jpg`. If the timings change, update the captions in
`site/public/media/home-screen.vtt` to match.
