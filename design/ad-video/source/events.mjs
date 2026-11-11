// Works out when each sound belongs (from the timeline and what was filmed) → timeline.json for audio.py.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const TL = createRequire(import.meta.url)('./tl.js');
const W = new URL('.', import.meta.url).pathname;
const meta = (s) => JSON.parse(readFileSync(`${W}film/${s}.json`));
const ev = [];
const add = (f, kind, extra = {}) => ev.push({ t: +(f / TL.FPS).toFixed(4), kind, ...extra });
const { S } = TL;
// scene starts
for (const id of TL.order) add(S[id].at, 'scene', { id });
// the chat
for (const m of TL.chat) add(S.chat.at + m.f, m.who === 'me' ? 'send' : 'recv');
for (const m of TL.answer) add(S.answer.at + m.f, m.who === 'me' ? 'send' : 'recv');
// reveal, snap
add(S.reveal.at + 2, 'boom'); add(S.reveal.at + 22, 'riser', { len: 58 / 30 });
add(S.snap.at, 'shutter'); add(S.snap.at + 34, 'scan', { len: 48 / 30 }); add(S.snap.at + 82, 'ding'); add(S.snap.at + 112, 'whoosh');
// taps: every moment the finger goes down in a filmed scene
for (const id of ['rate', 'rank', 'strainz', 'sources', 'post', 'mates', 'private']) {
  const sc = S[id]; let last = null;
  for (let L = 0; L < sc.len; L++) {
    const m = TL.map[id](L); const fr = meta(m.shot).frames; const g = fr[m.f];
    const key = m.shot + ':' + m.f;
    if (key !== last && g && g.down && !(fr[m.f - 1] && fr[m.f - 1].down)) add(sc.at + L, 'tap');
    last = key;
  }
}
const ed = meta('editor').marks, po = meta('post').marks;
for (let i = 0; i < 8; i++) add(S.rate.at + ed.type + 3 * i - 15 + 3, 'key');
add(S.rate.at + ed.rate - 15 + 9, 'slide', { len: 26 / 30 });
add(S.rate.at + ed.saved - 15, 'success');
for (let i = 0; i < 20; i++) add(S.post.at + po.type + 2 * i - 16 + 2, 'key');
add(S.post.at + po.feed - 16, 'pop');
for (let i = 0; i < 3; i++) add(S.post.at + po.react - 16 + i * 5, 'react', { i });
add(S.rank.at + 10, 'bell'); add(S.sources.at + 116, 'bell'); add(S.mates.at + 66, 'bell'); add(S.private.at + 112, 'bell');
add(S.strainz.at + meta('strainz').marks.page - 3, 'whoosh'); add(S.sources.at + meta('sources').marks.page - 1, 'whoosh');
add(S.private.at + meta('private1').marks.done, 'success2');
for (let i = 1; i < 5; i++) add(S.looks.at + i * 40, 'swish');
add(S.end.at, 'impact');
ev.sort((a, b) => a.t - b.t);
writeFileSync(W + 'timeline.json', JSON.stringify({ fps: TL.FPS, bpm: 90, total: TL.total / TL.FPS, scenes: Object.fromEntries(TL.order.map((k) => [k, S[k].at / TL.FPS])), events: ev }, null, 1));
console.log(ev.length, 'events', Object.entries(ev.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {})).map(([k, v]) => k + ':' + v).join(' '));
