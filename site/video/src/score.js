// ---------- sound: frosted glass (soft glass taps, airy panel slides, gentle chimes, a calm pad) ----------
// Every time below is copied from explainer()'s own timings, so each sound lands on the frame its event appears.
function scoreSound(k) {
  const D = DURATION;
  const busy = [];
  // glass tap: a light fingertip click on a glass pane (tiny click + a short, soft glassy ring)
  const tap = (t, f, g, p = 0, minor = true) => { busy.push(t); k.play('click', t, { f: f * 1.3, gain: 0.45 * g, pan: p, minor }); k.tone(t, { f, dur: 0.16, gain: 0.07 * g, a: 0.002, pan: p, verb: 0.25, minor }); k.tone(t, { f: f * 1.5, dur: 0.08, gain: 0.025 * g, a: 0.002, pan: p, minor }); };
  // soft chime: rounded sine with an octave shimmer and room
  const chime = (t, n, g, p = 0, dur = 1.2, minor) => { const f = k.hz(n); busy.push(t); k.tone(t, { f, dur, gain: 0.1 * g, a: 0.004, pan: p, verb: 0.4, minor }); k.tone(t, { f: f * 2, dur: dur * 0.45, gain: 0.025 * g, a: 0.003, pan: p, verb: 0.4, minor }); };
  // a frosted panel glides up into place (EO over ~0.6 s): an airy breath that settles with a tap
  const frost = (t0, p, g = 1, d = 0.6) => { k.noise(t0, { dur: d, color: 'pink', filter: 'bandpass', f: [[0, 700], [d * 0.6, 1500], [d, 1100]], q: 0.8, gain: 0.06 * g, a: d * 0.2, pan: p, verb: 0.2 }); tap(t0 + d * 0.47, 880, 0.7 * g, p); };
  // glowing connector draws on: a soft, rising shimmer that follows the eased line
  const glow = (t0, t1, f0, f1, g, p) => { const d = t1 - t0; k.noise(t0, { dur: d + 0.1, color: 'pink', filter: 'bandpass', f: [[0, f0], [d, f1]], q: 4, gain: 0.05 * g, a: d * 0.5, pan: p, verb: 0.3, minor: true }); k.tone(t0, { f: [[0, f0 / 2], [d, f1 / 2]], type: 'sine', dur: d + 0.1, gain: 0.025 * g, a: d * 0.5, pan: p, minor: true }); };
  // the camera glides: a low air movement
  const glide = (t0, t1, g = 1) => { const d = t1 - t0; k.noise(t0, { dur: d + 0.15, color: 'pink', filter: 'bandpass', f: [[0, 240], [d * 0.5, 560], [d, 260]], q: 0.7, gain: 0.04 * g, a: d * 0.5, verb: 0.15 }); };
  // the step badge flips to a new number
  const flip = (t, n) => { k.play('swish', t, { dur: 0.14, gain: 0.35, pan: 0.45, minor: true }); chime(t + 0.2, n, 0.55, 0.45, 0.6); };
  // a sheet slides up inside the phone
  const sheet = (t0, d, p) => k.noise(t0, { dur: d + 0.1, color: 'pink', filter: 'bandpass', f: [[0, 500], [d * 0.6, 1800], [d, 900]], q: 0.9, gain: 0.07, a: d * 0.45, pan: p, verb: 0.2 });

  k.bed('room', 0, D, { gain: 0.18 });
  k.music('pad', 0, D, { bpm: 84, gain: 0.32, chords: [['D3', 'F#3', 'A3', 'C#4'], ['B2', 'D3', 'F#3', 'A3'], ['G2', 'B2', 'D3', 'F#3'], ['A2', 'C#3', 'E3', 'G3'], ['G2', 'B2', 'D3', 'F#3'], ['D3', 'F#3', 'A3', 'D4']] });

  // ---- 1 hook: the title card fades up (0.1-0.6), its pill (0.5-0.9), then glides into the header (1.5-2.3)
  k.noise(0.05, { dur: 0.7, color: 'pink', filter: 'bandpass', f: [[0, 600], [0.5, 1400]], q: 0.8, gain: 0.05, a: 0.3, verb: 0.3 });
  chime(0.18, 'F#5', 1, 0, 1.6); chime(0.18, 'A4', 0.7, 0, 1.6);
  tap(0.62, 1100, 0.55, 0);
  k.noise(1.5, { dur: 0.85, color: 'pink', filter: 'lowpass', f: [[0, 800], [0.85, 350]], gain: 0.045, a: 0.35, pan: 0.3, minor: true });
  tap(2.25, 980, 0.5, 0.45); // header settles

  // ---- 2 step 1: phone rises (2.1-2.8), step card (2.5-3.1), the address types (2.9-3.6), page loads (3.95)
  frost(2.1, -0.15, 1, 0.7);
  frost(2.5, 0.45, 0.9);
  chime(2.75, 'D5', 0.6, 0.45, 0.8); // big "1"
  for (let i = 0; i < 8; i++) k.play('key', 2.92 + i * 0.085, { gain: 0.45, pan: -0.15, minor: true });
  k.noise(3.6, { dur: 0.5, filter: 'bandpass', f: [[0, 1200], [0.5, 2400]], q: 3, gain: 0.03, a: 0.2, pan: -0.15, minor: true }); // load line
  tap(3.98, 1250, 0.6, -0.15); chime(4.0, 'A5', 0.45, -0.15, 0.7);

  // ---- 3 tap Share: camera dives to the bar (5.0-5.9), badge flips to 2 (5.4), line to ⋯ (5.9-6.4), tip pill (6.1),
  //      tap ⋯ (6.8), the menu pops (6.88-7.15), Share lights (7.15), tap Share (7.5), the share sheet slides up (7.6-8.15)
  glide(5.0, 5.9);
  flip(5.4, 'E5');
  glow(5.9, 6.4, 700, 1600, 1, 0.1);
  tap(6.02, 1500, 0.4, 0.05); // ring lights on ⋯
  tap(6.15, 1000, 0.6, 0.4); // "Share button in the bar? Tap it"
  tap(6.8, 900, 1.1, 0.05, false); // press ⋯
  k.play('pop', 6.92, { f: 700, gain: 0.35, pan: 0.05, minor: true }); // menu pops
  chime(7.17, 'A5', 0.4, 0, 0.5, true);
  tap(7.5, 950, 1.1, 0, false); // press Share
  sheet(7.6, 0.55, 0);

  // ---- 4 View More, then Add to Home Screen: camera (7.7-8.5), title "Tap View More" (8.3), line (8.7-9.2), tap (9.5),
  //      the list opens (9.6-10.2), title "Add to Home Screen" (10.0), line (10.4-10.9), row lights (10.5), tap (11.4)
  glide(7.7, 8.5, 0.8);
  k.play('swish', 8.3, { dur: 0.16, gain: 0.3, pan: 0.45, minor: true });
  glow(8.7, 9.2, 800, 1600, 0.9, 0.2);
  tap(9.5, 1000, 1.0, 0.2, false);
  k.noise(9.6, { dur: 0.6, color: 'pink', filter: 'bandpass', f: [[0, 600], [0.6, 1400]], q: 0.9, gain: 0.05, a: 0.25, minor: true }); // list unfolds
  for (let i = 0; i < 6; i++) k.play('tick', 9.68 + i * 0.07, { f: 3400 + i * 150, gain: 0.32, pan: -0.05, minor: true });
  k.play('swish', 10.0, { dur: 0.16, gain: 0.3, pan: 0.45, minor: true });
  glow(10.4, 10.9, 800, 1700, 1, 0.15);
  chime(10.52, 'B5', 0.8, -0.05, 0.9);
  tap(11.4, 900, 1.1, -0.1, false);

  // ---- 5 tap Add: sheet slides (11.95-12.5), camera (12.4-13.2), badge flips to 3 (12.8), switch glows (13.4), line (13.7-14.2), Add (14.6)
  sheet(11.95, 0.55, -0.1);
  glide(12.4, 13.2, 0.8);
  flip(12.8, 'F#5');
  k.play('blip', 13.42, { f: 'A5', type: 'sine', dur: 0.09, gain: 0.8, pan: -0.1, minor: true });
  glow(13.7, 14.2, 900, 1800, 1, 0.1);
  tap(14.6, 1000, 1.2, 0.05, false);

  // ---- 6 Home Screen: frost wipe (14.8-15.9), camera (14.9-15.8), "Done" (15.9), icon lands (16.6, the biggest hit), label (16.7)
  k.noise(14.8, { dur: 1.1, color: 'pink', filter: 'bandpass', f: [[0, 2600], [0.5, 900], [1.1, 500]], q: 0.6, gain: 0.09, a: 0.45, verb: 0.35 });
  glide(14.9, 15.8, 0.7);
  k.play('swish', 15.9, { dur: 0.14, gain: 0.3, pan: 0.45, minor: true });
  k.tone(16.1, { f: [[0, 400], [0.45, 900]], type: 'sine', dur: 0.5, gain: 0.05, a: 0.3, pan: -0.15 }); // icon drops in
  k.play('thud', 16.6, { f: 90, gain: 0.6, pan: -0.15 });
  k.noise(16.6, { dur: 1.0, color: 'pink', filter: 'lowpass', f: [[0, 2200], [0.9, 400]], gain: 0.15, verb: 0.4 });
  ['D5', 'F#5', 'A5', 'D6'].forEach((n, i) => chime(16.6 + i * 0.03, n, 1.3 - i * 0.15, (i - 1.5) * 0.25, 1.8));
  k.play('sparkle', 16.62, { n: 7, gain: 0.9 });
  tap(16.82, 1150, 0.6, -0.15); // "Green Tracker" pill

  // ---- 7 opens full screen: tap (18.1), app grows (18.35-18.95), rows (18.8+), step (18.8), pill and lines (19.3-19.8)
  tap(18.1, 950, 1.0, -0.15, false);
  k.noise(18.35, { dur: 0.6, color: 'pink', filter: 'bandpass', f: [[0, 400], [0.6, 2000]], q: 0.9, gain: 0.07, a: 0.35, pan: -0.15, verb: 0.25 });
  for (let i = 0; i < 5; i++) k.play('tick', 18.92 + i * 0.08, { f: 3000 + i * 250, gain: 0.35, pan: -0.15, minor: true });
  k.play('swish', 18.8, { dur: 0.14, gain: 0.25, pan: 0.45, minor: true });
  tap(19.35, 1050, 0.7, -0.6);
  glow(19.4, 19.8, 900, 1600, 0.8, -0.5);

  // ---- 8 takeaway: pull back (20.9-21.8), card grows (21-21.8), rows (21.5, 21.75, 22), pill (22.2) resolves
  glide(20.9, 21.8, 0.9);
  ['D5', 'E5', 'F#5'].forEach((n, i) => { tap(21.6 + i * 0.25, 900 + i * 150, 0.7, 0.3); chime(21.62 + i * 0.25, n, 0.45, 0.3, 0.6, true); });
  frost(22.2, 0.3, 0.6, 0.4);
  ['A4', 'D5', 'F#5', 'A5'].forEach((n, i) => chime(22.4 + i * 0.07, n, 0.7 - i * 0.1, (i - 1.5) * 0.25, 1.6));
  k.tone(22.4, { f: 'D2', type: 'triangle', dur: 1.5, gain: 0.12, a: 0.02 });
}
