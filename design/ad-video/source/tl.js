// The timeline, shared by the picture (compose.html) and the sound (audio.py reads timeline.json, made by events.mjs).
// 90 beats a minute at 30 frames a second: a beat is exactly 20 frames, a bar 80. Every scene starts on a beat.
(function (root) {
  const FPS = 30, BEAT = 20, BAR = 80;
  // id, length in frames
  const order = [
    ['chat', 160], ['reveal', 80], ['snap', 160], ['rate', 320], ['rank', 200], ['strainz', 240], ['sources', 200],
    ['post', 240], ['mates', 240], ['private', 160], ['looks', 200], ['answer', 160], ['end', 200],
  ];
  const S = {}; let at = 0;
  for (const [id, len] of order) { S[id] = { id, at, len, end: at + len }; at += len; }
  const TL = {
    FPS, BEAT, BAR, S, order: order.map((o) => o[0]), total: at,
    // Which filmed frame each scene shows at its local frame L.
    map: {
      rate: (L) => ({ shot: 'editor', f: Math.min(324, L + 15) }),
      rank: (L) => ({ shot: 'board', f: Math.min(209, L) }),
      strainz: (L) => ({ shot: 'strainz', f: Math.min(257, L + 3) }),
      sources: (L) => ({ shot: 'sources', f: Math.min(190, L + 1) }),
      post: (L) => ({ shot: 'post', f: Math.min(257, L + 16) }),
      mates: (L) => (L < 140 ? { shot: 'mates1', f: Math.min(153, L + 10) } : { shot: 'mates2', f: Math.min(89, L - 140) }),
      private: (L) => (L < 80 ? { shot: 'private1', f: Math.min(78, L) } : { shot: 'private2', f: Math.min(79, L - 80) }),
      looks: (L) => ({ shot: 'look-' + TL.looks[Math.min(4, Math.floor(L / 40))], f: 5 + (L % 40) }),
    },
    looks: ['sakura', 'deepsea', 'lava', 'outrun', 'daysky'],
    chat: [
      { f: 6, who: 'jay', text: 'yo what was that one we had at mine last week?? 🔥' },
      { f: 56, who: 'me', text: 'the purple one?' },
      { f: 86, who: 'jay', text: 'nah the OTHER one' },
      { f: 116, who: 'mira', text: 'no idea 💀' },
    ],
    answer: [
      { f: 14, who: 'me', card: true },
      { f: 30, who: 'me', text: 'it was Zkittlez. 9.5 🔥' },
      { f: 74, who: 'jay', text: 'LEGEND. get it again' },
      { f: 104, who: 'mira', text: 'ok I need this app 👀' },
    ],
  };
  root.TL = TL;
  if (typeof module !== 'undefined') module.exports = TL;
})(typeof window !== 'undefined' ? window : globalThis);
