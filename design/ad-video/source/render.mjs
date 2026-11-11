// Renders compose.html frame by frame to an MP4 with the soundtrack: node render.mjs v|h out.mp4 [from to]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const TL = createRequire(import.meta.url)('./tl.js');
const v = process.argv[2] === 'v';
const out = process.argv[3];
const from = Number(process.argv[4] ?? 0), to = Number(process.argv[5] ?? TL.total);
const FPS = 30;
const [w, h] = v ? [1080, 1920] : [1920, 1080];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: w, height: h } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8899/compose.html' + (v ? '?v=1' : ''));
await p.evaluate(() => window.ready);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-ss', String(from / FPS), '-i', 'sound.wav',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-color_range', 'tv', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = from; i < to; i++) {
  await p.evaluate((t) => window.render(t), i / FPS);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await p.screenshot({ type: 'jpeg', quality: 97 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log('frame', i, Math.round((Date.now() - t0) / 1000) + 's');
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();
console.log('done', out);
