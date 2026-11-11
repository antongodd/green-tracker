// The short cut: whole bars lifted from the finished film, with its own mix of the same music.
// node short.mjs list            → prints the segments and writes timeline-short.json (for audio.py)
// node short.mjs cut in.mp4 out.mp4   → cuts the picture and lays sound-short.wav under it
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const TL = createRequire(import.meta.url)('./tl.js');
const W = new URL('.', import.meta.url).pathname;
const { S } = TL;
// [from, to) in frames of the long film; each a whole number of bars (80 frames)
const SEG = [
  ['chat', S.chat.at, S.chat.at + 160],
  ['rate', S.rate.at + 80, S.rate.at + 160],
  ['rank', S.rank.at, S.rank.at + 80],
  ['strainz', S.strainz.at + 80, S.strainz.at + 160],
  ['mates', S.mates.at + 40, S.mates.at + 120],
  ['looks', S.looks.at + 20, S.looks.at + 100],
  ['end', S.end.at + 16, S.end.at + 176],
];
const long = JSON.parse(readFileSync(W + 'timeline.json'));
let at = 0; const scenes = {}; const events = [];
for (const [id, a, b] of SEG) {
  scenes[id] = at / 30;
  for (const e of long.events) { const f = e.t * 30; if (f >= a - 0.5 && f < b - 0.5 && e.kind !== 'scene') events.push({ ...e, t: +((f - a + at) / 30).toFixed(4) }); }
  if (!['chat', 'end'].includes(id)) events.push({ t: at / 30, kind: 'scene', id });
  at += b - a;
}
events.push({ t: scenes.end, kind: 'impact' });
const tl = { fps: 30, bpm: 90, total: at / 30, short: true, scenes: { ...scenes, reveal: scenes.rate - 80 / 30, snap: scenes.rate, answer: scenes.end, sources: 0 }, events: events.filter((e, i, arr) => arr.findIndex((x) => x.t === e.t && x.kind === e.kind) === i).sort((a, b) => a.t - b.t) };
writeFileSync(W + 'timeline-short.json', JSON.stringify(tl, null, 1));
if (process.argv[2] === 'cut') {
  const [inp, out] = process.argv.slice(3);
  const sel = SEG.map(([, a, b]) => `between(n,${a},${b - 1})`).join('+');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inp, '-i', W + 'sound-short.wav', '-filter_complex', `[0:v]select='${sel}',setpts=N/30/TB[v]`, '-map', '[v]', '-map', '1:a',
    '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' });
}
console.log(at, 'frames', at / 30, 's', scenes);
