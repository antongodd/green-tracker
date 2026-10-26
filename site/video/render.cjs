// Renders the website's how-to video (D68) from the source in site/video/src.
// Run from the repo root: node site/video/render.cjs   (needs ffmpeg, and Playwright's Chromium).
// Writes site/video/out/player.html (the animation with its controls and sound, to watch in a browser),
// site/video/out/master.mp4, and the website's copies: site/public/media/home-screen.mp4 and home-screen.jpg.
// Every frame is a pure function of time, so a re-render gives the same video.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const DIR = __dirname, OUT = path.join(DIR, 'out'), MEDIA = path.join(DIR, '..', 'public', 'media');
fs.mkdirSync(OUT, { recursive: true });
const libs = ['harness.js', 'sound.js', 'scene.js', 'score.js'].map((f) => fs.readFileSync(path.join(DIR, 'src', f), 'utf8')).join('\n');
const page = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n' + fs.readFileSync(path.join(DIR, 'player.tpl.html'), 'utf8').replace('/*__LIBS__*/', () => libs);
fs.writeFileSync(path.join(OUT, 'player.html'), page);

const ff = (args) => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('file://' + path.join(OUT, 'player.html')); await p.evaluate(() => window.ready);
  const D = await p.evaluate(() => window.DURATION);
  // the sound, as 32-bit float stereo at 48 kHz, fetched in pieces
  const peak = await p.evaluate(async () => { const r = await SOUND.renderOffline(window.scoreSound, DURATION, 48000, { voiceover: false }); window.__a = new Uint8Array(r.inter.buffer); return r.peak; });
  const n = await p.evaluate(() => window.__a.length), parts = [];
  for (let i = 0; i < n; i += 1 << 20) parts.push(Buffer.from(await p.evaluate(([i, c]) => { let s = ''; const u = window.__a.subarray(i, i + c); for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s); }, [i, 1 << 20]), 'base64'));
  fs.writeFileSync(path.join(OUT, 'audio.f32'), Buffer.concat(parts));
  console.log('sound peak', peak.toFixed(3));
  // the frames, 30 a second, piped to ffmpeg
  const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', path.join(OUT, 'audio.f32'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'master.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(D * 30);
  for (let i = 0; i < frames; i++) {
    const url = await p.evaluate((t) => { seek(t); return document.getElementById('c').toDataURL('image/png'); }, i / 30);
    if (!enc.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => enc.stdin.once('drain', r));
  }
  enc.stdin.end(); await new Promise((r) => enc.on('close', r));
  // the thumbnail (D68: thumbnail 1, the phone with the leaf)
  await p.evaluate(() => { const c = document.getElementById('c').getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1280, 720); GTX.poster(c, 1280, 720, 'phone'); });
  fs.writeFileSync(path.join(OUT, 'poster.png'), Buffer.from((await p.evaluate(() => document.getElementById('c').toDataURL('image/png'))).split(',')[1], 'base64'));
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  // the website's copies: a smaller file that looks the same, and the thumbnail as a JPEG
  ff(['-i', path.join(OUT, 'master.mp4'), '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(MEDIA, 'home-screen.mp4')]);
  ff(['-i', path.join(OUT, 'poster.png'), '-q:v', '3', path.join(MEDIA, 'home-screen.jpg')]);
  console.log(`${frames} frames; wrote site/public/media/home-screen.mp4 and home-screen.jpg`);
})().catch((e) => { console.error(e); process.exit(1); });
