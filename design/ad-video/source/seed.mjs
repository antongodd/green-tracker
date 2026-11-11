// Seeds the private local copy of the app (never live or dev) with made-up accounts for the ad video.
// Photos, strain names and most scores are Anton's own (D88); people, sources and prices are made up.
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = 'http://localhost:8790';
const W = new URL('.', import.meta.url).pathname;
const PASSWORD = 'correct horse battery';
let ipn = 1;
class B {
  constructor() { this.ip = `10.9.0.${ipn++}`; this.cookies = new Map(); }
  hdr(extra = {}) {
    const h = { 'cf-connecting-ip': this.ip, origin: BASE, ...extra };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    return h;
  }
  keep(res) { for (const c of res.headers.getSetCookie()) { const [k, v] = c.split(';')[0].split('='); v ? this.cookies.set(k, v) : this.cookies.delete(k); } }
  async req(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: this.hdr(body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    this.keep(res);
    const json = await res.json().catch(() => ({}));
    if (res.status >= 300) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(json)}`);
    return json;
  }
  async upload(parts) {
    const form = new FormData();
    for (const [k, v] of Object.entries(parts)) {
      if (typeof v === 'string') form.append(k, v);
      else form.append(k, new Blob([v.bytes], { type: v.type }), `${k}.${v.type === 'image/png' ? 'png' : 'jpg'}`);
    }
    const res = await fetch(BASE + '/api/uploads', { method: 'POST', headers: this.hdr(), body: form });
    const json = await res.json();
    if (res.status >= 300) throw new Error(`upload ${res.status} ${JSON.stringify(json)}`);
    return json.upload;
  }
}
const png = (f) => ({ bytes: readFileSync(W + f), type: 'image/png' });
const jpg = (f) => ({ bytes: readFileSync(W + f), type: 'image/jpeg' });
const empty = {
  name: '', strainType: null, productType: 'flower', productTypeOther: null, concentrateType: 'hash', concentrateTypeOther: null,
  country: null, countryOther: null, source: null, dateTried: '2026-10-20', leaflyLink: null, notes: null, hitTimeMinutes: null,
  ratings: {}, purchases: [], photos: [], private: false,
};
// Six scores that average s, not all the same.
// Overall is the average of Look, Smell, Taste and Burn (High is rated but doesn't count): these four average s.
const spread = (s, k = 0) => {
  const o = [[0.5, -0.5, 0.5, -0.5], [0, 0.5, -0.5, 0], [-0.5, 0, 0.5, 0], [0.5, 0, 0, -0.5]][k % 4];
  const keys = ['look', 'smell', 'taste', 'burn'];
  const sh = s + 0.5 > 10 ? 0 : 1;
  return { consistency: s, high: Math.min(10, Math.round((s + (k % 3 ? 0.3 : -0.2)) * 10) / 10), ...Object.fromEntries(keys.map((key, i) => [key, Math.round((s + o[i] * sh) * 10) / 10])) };
};
async function account(b, username) {
  await b.req('POST', '/api/auth/signup', { email: `${username}@example.test`, password: PASSWORD, username, adult: true });
  const a = jpg(`nugs/av-${username}.jpg`);
  const up = await b.upload({ original: a, cropped: a, thumb: a });
  await b.req('PUT', '/api/profile/photo', { upload: up, crop: { x: 0, y: 0, w: 1, h: 1, square: true } });
}
let pk = 0;
async function product(b, name, nug, score, over = {}) {
  const up = await b.upload({ original: jpg(`nugs/${nug}-o.jpg`), cropped: png(`nugs/${nug}.png`), thumb: png(`nugs/${nug}-t.png`), cutout: '1' });
  return (await b.req('POST', '/api/products', { ...empty, name, strainType: 'hybrid', country: 'GB', ratings: score ? spread(score, pk++) : {}, photos: [{ upload: up, crop: null }], ...over })).product;
}
const me = new B(), jay = new B(), mira = new B(), kofi = new B(), sam = new B();
const P = { nugnotes: me, jay, mira, kofi, sam };
for (const [n, b] of Object.entries(P)) await account(b, n);
await me.req('PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });

const buy = (supplier, totalPaid, amount = 3.5, date = '2026-10-20') => ({ date, amount, totalPaid, supplier });
const mine = [
  ['Tide', 'tide', 9.3, { source: 'Coastline', dateTried: '2026-10-25', purchases: [buy('The Grove', 40, 3.5, '2026-10-25'), buy('The Grove', 40, 3.5, '2026-10-12')] }],
  ['California OG', 'california-og', 9.2, { source: 'Coastline', dateTried: '2026-10-22', purchases: [buy('Uncle Mo', 30, 3.5, '2026-10-22')] }],
  ['Lemon Popperz', 'lemon-popperz', 9.1, { source: 'Popperz', dateTried: '2026-10-18', purchases: [buy('The Grove', 45, 3.5, '2026-10-18'), buy('The Grove', 80, 7, '2026-11-01')] }],
  ['Zoozles', 'zoozles', 9.0, { strainType: 'indica', source: 'Terp Lab', dateTried: '2026-10-16', purchases: [buy('Northside', 38, 3.5, '2026-10-16')] }],
  ['Blue Zushi', 'blue-zushi', 8.9, { source: 'Coastline', dateTried: '2026-10-11', purchases: [buy('Kush Corner', 50, 3.5, '2026-10-11')] }],
  ['Zkittlez', 'zkittlez', 9.2, { productType: 'pre_roll', strainType: 'sativa', source: 'Homegrown', dateTried: '2026-09-14', purchases: [buy('Uncle Mo', 10, 1, '2026-09-14')] }],
  ['White Runtz', 'white-runtz', 8.6, { strainType: 'sativa', source: 'Popperz', dateTried: '2026-10-08', purchases: [buy('Northside', 35, 3.5, '2026-10-08')] }],
  ['Peanut Butter', 'peanut-butter', 8.5, { strainType: 'indica', source: 'Terp Lab', dateTried: '2026-10-06', purchases: [buy('The Grove', 42, 3.5, '2026-10-06')] }],
  ['Cherry Popperz', 'cherry-popperz', 8.4, { strainType: 'sativa', source: 'Popperz', dateTried: '2026-10-04', purchases: [buy('The Grove', 45, 3.5, '2026-10-04')] }],
  ['Watermelon Zkittlez', 'watermelon-zkittlez', 8.2, { strainType: 'indica', source: 'Homegrown', dateTried: '2026-10-02', purchases: [buy('Uncle Mo', 28, 3.5, '2026-10-02')] }],
  ['Hash Burger', 'hash-burger', 8.1, { strainType: 'sativa', source: 'Terp Lab', dateTried: '2026-09-28', purchases: [buy('Kush Corner', 36, 3.5, '2026-09-28')] }],
  ['Orange Diesel', 'orange-diesel', 8.0, { strainType: 'indica', source: 'Homegrown', dateTried: '2026-09-22', purchases: [buy('Uncle Mo', 25, 3.5, '2026-09-22')] }],
  ['Monster Cookies', 'monster-cookies', 7.9, { strainType: 'indica', source: 'Coastline', dateTried: '2026-09-19', purchases: [buy('Northside', 34, 3.5, '2026-09-19')] }],
  ['Lemon Popperz', 'lemon-popperz', 8.7, { productType: 'pre_roll', source: 'Popperz', dateTried: '2026-09-30', purchases: [buy('Kush Corner', 12, 1, '2026-09-30')] }],
  ['Acapulco Gold', 'acapulco-gold', 7.8, { strainType: 'sativa', source: 'Homegrown', dateTried: '2026-09-10', purchases: [buy('Uncle Mo', 25, 3.5, '2026-09-10')] }],
];
const ids = {};
for (const [n, f, s, o] of mine) { const p = await product(me, n, f, s, o); ids[n + (o.productType === 'pre_roll' ? ' pre' : '')] = p.id; }
// The star, added on camera: it starts as a draft with its cut-out and no scores (film.mjs finishes it).
const star = await product(me, 'Zkittlez', 'zkittlez', null, { strainType: null, source: null, country: null, dateTried: '2026-11-03' });

const fr = {};
const theirs = {
  jay: [['Zkittlez', 'zkittlez', 9.0, { strainType: 'sativa' }], ['Peanut Butter', 'peanut-butter', 9.1, { strainType: 'indica' }], ['Lemon Popperz', 'lemon-popperz', 8.5], ['Tide', 'tide', 8.8], ['Blue Zushi', 'blue-zushi', 8.2]],
  mira: [['Zkittlez', 'zkittlez', 8.5, { strainType: 'sativa' }], ['Watermelon Zkittlez', 'watermelon-zkittlez', 9.2, { strainType: 'indica' }], ['California OG', 'california-og', 8.9], ['Cherry Popperz', 'cherry-popperz', 8.0, { strainType: 'sativa' }]],
  kofi: [['Zkittlez', 'zkittlez', 9.7, { strainType: 'sativa' }], ['Zoozles', 'zoozles', 9.3, { strainType: 'indica' }], ['Mochi', 'mochi', 7.0], ['White Runtz', 'white-runtz', 8.8, { strainType: 'sativa' }]],
};
for (const [who, list] of Object.entries(theirs)) { fr[who] = {}; for (const [n, f, s, o] of list) fr[who][n] = await product(P[who], n, f, s, o ?? {}); }

// Everyone follows everyone (approved); @sam has asked to follow and waits.
const names = ['nugnotes', 'jay', 'mira', 'kofi'];
for (const a of names) for (const b of names) if (a !== b) { await P[a].req('POST', `/api/people/u/${b}/follow`); await P[b].req('POST', `/api/people/requests/${a}/approve`); }
await sam.req('POST', '/api/people/u/nugnotes/follow');

// Friends' posts.
async function post(who, name, caption) {
  const p = fr[who][name];
  const r = await P[who].req('POST', '/api/posts', { caption, about: { product: p.id }, photos: [{ fromPhotoId: p.photos[0].id }] });
  return r.post.id;
}
const p1 = await post('mira', 'Watermelon Zkittlez', 'smells like actual sweets 🍉');
await new Promise((r) => setTimeout(r, 1100));
const p2 = await post('kofi', 'Zoozles', 'top shelf. no notes.');
await new Promise((r) => setTimeout(r, 1100));
const p3 = await post('jay', 'Peanut Butter', 'this one’s a heater 🥜🔥');
for (const [who, id] of [['jay', p1], ['kofi', p1], ['mira', p2], ['jay', p2], ['mira', p3], ['kofi', p3]]) await P[who].req('PUT', `/api/posts/${id}/fire`);
await kofi.req('POST', `/api/posts/${p3}/comments`, { body: 'saving me some yeah?' });
await mira.req('POST', `/api/posts/${p1}/comments`, { body: 'gas ⛽' }).catch(() => {});

for (const w of [{ kind: 'strain', name: 'Gelato 41' }, { kind: 'strain', name: 'Permanent Marker', note: 'From @kofi' }, { kind: 'strain', name: 'Mochi' }, { kind: 'source', name: 'Cloud Nine' }]) await me.req('POST', '/api/wants', w);

const ck = (b) => Object.fromEntries(b.cookies);
writeFileSync(W + 'seed.json', JSON.stringify({ me: ck(me), jay: ck(jay), mira: ck(mira), kofi: ck(kofi), sam: ck(sam), ips: Object.fromEntries(Object.entries(P).map(([n, b]) => [n === 'nugnotes' ? 'me' : n, b.ip])), star: star.id, ids, fr: Object.fromEntries(Object.entries(fr).map(([w, o]) => [w, Object.fromEntries(Object.entries(o).map(([n, p]) => [n, p.id]))])), posts: { p1, p2, p3 } }, null, 2));
console.log('seeded', star.id);
