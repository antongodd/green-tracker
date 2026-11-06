// Renders compose.html frame by frame (every frame a pure function of time) to an MP4 with the soundtrack.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const v = process.argv[2] === 'v';
const out = process.argv[3];
const FPS = 30, DUR = 26.0;
const [w, h] = v ? [1080, 1920] : [1920, 1080];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: w, height: h } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8899/compose.html' + (v ? '?v=1' : ''));
await p.evaluate(() => window.ready);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', 'sound.wav',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.round(FPS * DUR);
for (let i = 0; i < total; i++) {
  await p.evaluate((t) => window.render(t), i / FPS);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await p.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 90 === 0) console.log('frame', i);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();
console.log('done', out);
