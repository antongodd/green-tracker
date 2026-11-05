// Seeds the private local copy of the app (never live or dev) with two made-up accounts for the ad video.
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = 'http://localhost:8790';
const W = new URL('.', import.meta.url).pathname;
const PASSWORD = 'correct horse battery';

class B {
  constructor(ip) { this.ip = ip; this.cookies = new Map(); }
  hdr(extra = {}) {
    const h = { 'cf-connecting-ip': this.ip, origin: 'http://localhost:8790', ...extra };
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
const all = (s) => ({ look: s, consistency: s, smell: s, taste: s, burn: s, high: s });

async function account(b, username, avatar) {
  await b.req('POST', '/api/auth/signup', { email: `${username}@example.test`, password: PASSWORD, username, adult: true });
  const up = await b.upload({ original: jpg(avatar), cropped: jpg(avatar), thumb: jpg(avatar) });
  await b.req('PUT', '/api/profile/photo', { upload: up, crop: { x: 0, y: 0, w: 1, h: 1, square: true } });
}
async function product(b, name, nug, score, over = {}) {
  const up = await b.upload({ original: jpg(`nugs/${nug}-o.jpg`), cropped: png(`nugs/${nug}.png`), thumb: png(`nugs/${nug}-t.png`), cutout: '1' });
  return (await b.req('POST', '/api/products', { ...empty, name, strainType: 'hybrid', source: null, country: 'GB', ratings: all(score), photos: [{ upload: up, crop: null }], ...over })).product;
}

const me = new B('10.9.0.1'), friend = new B('10.9.0.2');
await account(me, 'nugnotes', 'me.jpg');
await account(friend, 'mira', 'friend.jpg');
await me.req('PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
await friend.req('PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: false });

// Anton's public website set (D88). Mega Z Emerald is added on camera, so it isn't here.
// Made-up shops and plugs, made-up prices (D88: sellers, prices and people stay made up).
const buy = (supplier, totalPaid, amount = 3.5, date = '2026-10-20') => ({ date, amount, totalPaid, supplier });
const mine = [
  ['Mega Z Emerald', 'mega-z-emerald', 9.5, { purchases: [buy('The Grove', 45, 3.5, '2026-11-01')] }],
  ['Super Boof', 'super-boof', 9.5, { productType: 'concentrate', purchases: [buy('Northside', 40, 1, '2026-10-28')] }],
  ['Tide', 'tide', 9.3, { purchases: [buy('The Grove', 40, 3.5, '2026-10-25'), buy('The Grove', 40, 3.5, '2026-10-12')] }],
  ['California OG', 'california-og', 9.2, { purchases: [buy('Uncle Mo', 30, 3.5, '2026-10-22')] }],
  ['Lemon Popperz', 'lemon-popperz', 9.1, { purchases: [buy('Northside', 35, 3.5, '2026-10-18')] }],
  ['Cherry Popperz', 'cherry-popperz', 8.9, { strainType: 'sativa', purchases: [buy('The Grove', 38, 3.5, '2026-10-15')] }],
  ['Zkittlez', 'zkittlez', 8.7, { strainType: 'sativa', purchases: [buy('Uncle Mo', 28, 3.5, '2026-10-10')] }],
  ['White Runtz', 'white-runtz', 8.6, { strainType: 'sativa', purchases: [buy('Northside', 35, 3.5, '2026-10-08')] }],
  ['Orange Diesel', 'orange-diesel', 8.4, { strainType: 'indica', purchases: [buy('Uncle Mo', 25, 3.5, '2026-10-05')] }],
  ['Watermelon Zkittlez', 'watermelon-zkittlez', 8.2, { strainType: 'indica', purchases: [buy('The Grove', 36, 3.5, '2026-10-02')] }],
  ['Blue Zushi', 'blue-zushi', 8.0, { purchases: [buy('Kush Corner', 33, 3.5, '2026-09-28')] }],
];
const ids = {};
for (const [n, f, s, o] of mine) ids[n] = (await product(me, n, f, s, o)).id;
const theirs = await product(friend, 'Mega Z Emerald', 'mega-z-emerald', 8.0);
await product(friend, 'Tide', 'tide', 8.8);

await me.req('POST', '/api/people/u/mira/follow');
await friend.req('POST', '/api/people/requests/nugnotes/approve');
await friend.req('POST', '/api/people/u/nugnotes/follow');
await me.req('POST', '/api/people/requests/mira/approve');
writeFileSync(W + 'seed.json', JSON.stringify({ me: Object.fromEntries(me.cookies), friend: Object.fromEntries(friend.cookies), theirs: theirs.id, mega: ids['Mega Z Emerald'] }, null, 2));
console.log('seeded', theirs.id);
