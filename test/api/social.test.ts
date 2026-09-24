import { beforeAll, describe, expect, it } from 'vitest';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { photoUrl } from '../../shared/domain/photo';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import { SHARED_PRODUCT_KEYS, type SharedProduct } from '../../shared/domain/social';
import { Browser, signUp, uniqueName } from './client';

// §17 "Accounts and social — privacy is the critical area". Every never-shared
// field of the owner's data carries a planted secret; checks run on raw responses.
const SECRETS = {
  notes: 'SECRET-NOTES-7f3',
  supplier: 'SECRET-SUPPLIER-9c1',
  leafly: 'https://secret-leafly.example/strain',
  dateTried: '2026-01-02',
  totalPaid: 12.34,
  logEntry: 'SECRET-LOG-ENTRY-44',
  privateName: 'SECRET-PRIVATE-HAZE',
  archivedName: 'SECRET-ARCHIVED-OG',
};
const FORBIDDEN_KEYS = ['purchases', 'totalPaid', 'amount', 'supplier', 'notes', 'leaflyLink', 'dateTried', 'private', 'archived', 'price', 'vfm', 'createdAt', 'updatedAt', 'crop', 'entries'];

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;

let owner: Browser, fan: Browser, stranger: Browser;
let ownerName: string, fanName: string, strangerName: string;
let visible: Product, edible: Product, privateP: Product, archivedP: Product;
let logPhotoId: string, logEntryId: string;

async function make(b: Browser, over: Partial<ProductInput>): Promise<Product> {
  const r = await b.post('/api/products', { ...emptyProductInput(), ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.product;
}
const products = (b: Browser, u = ownerName) => b.get(`/api/people/u/${u}/products`);
const follow = (b: Browser, u = ownerName) => b.post(`/api/people/u/${u}/follow`);
const approve = (u: string) => owner.post(`/api/people/requests/${u}/approve`);

beforeAll(async () => {
  [owner, fan, stranger] = [new Browser(), new Browser(), new Browser()];
  ownerName = (await signUp(owner, uniqueName('Bella'))).username;
  fanName = (await signUp(fan, uniqueName('fran'))).username;
  strangerName = (await signUp(stranger, uniqueName('sam'))).username;

  // Rated as a concentrate first, then switched: Consistency stays stored but must not be shared.
  visible = await make(owner, {
    name: 'Public Kush',
    strainType: 'hybrid',
    country: 'US',
    source: 'Visible Source',
    notes: SECRETS.notes,
    leaflyLink: SECRETS.leafly,
    dateTried: SECRETS.dateTried,
    ratings: { look: 8, consistency: 9, smell: 7, taste: 9, burn: 6, high: 2 },
    purchases: [{ date: '2026-01-02', amount: 3.5, totalPaid: SECRETS.totalPaid, supplier: SECRETS.supplier }],
    photos: [{ upload: await newSet(owner, 'vis'), crop: null }],
  });
  edible = await make(owner, { name: 'Shared Gummy', productType: 'edibles', hitTimeMinutes: 75, ratings: { taste: 6, high: 9 }, dateTried: '2025-05-05' });
  privateP = await make(owner, { name: SECRETS.privateName, private: true, ratings: { look: 9 }, photos: [{ upload: await newSet(owner, 'priv'), crop: null }] });
  archivedP = await make(owner, { name: SECRETS.archivedName, ratings: { look: 9 }, photos: [{ upload: await newSet(owner, 'arch'), crop: null }] });
  await owner.post(`/api/products/${archivedP.id}/archived`, { value: true });
  const entry = (await owner.post('/api/log', { ...emptyLogEntryInput(), name: SECRETS.logEntry, amount: 7, photos: [{ upload: await newSet(owner, 'log'), crop: null }] })).json.entry;
  logEntryId = entry.id;
  logPhotoId = entry.photo.id;
});

describe('non-followers and pending requests get nothing (§17)', () => {
  it('a non-follower gets only the username and their own relation', async () => {
    const r = await stranger.get(`/api/people/u/${ownerName.toLowerCase()}`);
    expect(r.json).toEqual({ person: { username: ownerName, relation: 'none' } });
    const list = await products(stranger);
    expect(list.status).toBe(403);
    expect(Object.keys(list.json).sort()).toEqual(['error', 'message']);
    expect(JSON.stringify(list.json)).not.toContain('Public Kush');
    expect((await stranger.raw(photoUrl(visible.photos[0]!, 'thumb'))).status).toBe(403);
  });

  it('a pending request grants no access', async () => {
    expect((await follow(fan)).json.person.relation).toBe('requested');
    expect((await owner.get('/api/auth/me')).json.pendingRequests).toBe(1);
    expect((await owner.get('/api/people/requests')).json.people).toContain(fanName);
    expect((await products(fan)).status).toBe(403);
    expect((await fan.get(`/api/people/u/${ownerName}/products/${visible.id}`)).status).toBe(403);
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'cropped'))).status).toBe(403);
  });
});

describe('an approved follower sees identity, ratings and photos — nothing else (§5, §17)', () => {
  let raw: string;
  let shared: SharedProduct[];
  beforeAll(async () => {
    expect((await approve(fanName)).status).toBe(200);
    const r = await products(fan);
    expect(r.status).toBe(200);
    raw = JSON.stringify(r.json);
    shared = r.json.products;
  });

  it('lists only visible products: no private, no archived', () => {
    expect(shared.map((p) => p.name).sort()).toEqual(['Public Kush', 'Shared Gummy']);
    expect(raw).not.toContain(SECRETS.privateName);
    expect(raw).not.toContain(SECRETS.archivedName);
  });

  it('the raw response contains no price, purchase, amount, supplier, VFM, notes, date tried, Leafly or Log data', () => {
    for (const secret of [SECRETS.notes, SECRETS.supplier, SECRETS.leafly, SECRETS.dateTried, String(SECRETS.totalPaid), SECRETS.logEntry]) {
      expect(raw, secret).not.toContain(secret);
    }
    for (const key of FORBIDDEN_KEYS) expect(raw, key).not.toContain(`"${key}"`);
  });

  it('every product carries exactly the allow-listed fields', () => {
    for (const p of shared) expect(Object.keys(p).sort()).toEqual([...SHARED_PRODUCT_KEYS].sort());
  });

  it('shares Source (D1), ratings in the current set only, and hit time for edibles', () => {
    const kush = shared.find((p) => p.name === 'Public Kush')!;
    expect(kush.source).toBe('Visible Source');
    expect(kush.ratings).toEqual({ look: 8, smell: 7, taste: 9, burn: 6, high: 2 }); // no Consistency
    expect(kush.concentrateType).toBeNull();
    expect(shared.find((p) => p.name === 'Shared Gummy')!.hitTimeMinutes).toBe(75);
  });

  it('ties are ordered by the server without sending dates (D3)', () => {
    const kush = shared.find((p) => p.name === 'Public Kush')!;
    const gummy = shared.find((p) => p.name === 'Shared Gummy')!;
    expect(kush.tieRank).toBeLessThan(gummy.tieRank); // 2026 is more recent than 2025
  });

  it('one product’s profile has the same limits; private and archived ones are not found', async () => {
    const one = await fan.get(`/api/people/u/${ownerName}/products/${visible.id}`);
    expect(Object.keys(one.json.product).sort()).toEqual([...SHARED_PRODUCT_KEYS].sort());
    expect(JSON.stringify(one.json)).not.toContain(SECRETS.notes);
    for (const id of [privateP.id, archivedP.id]) {
      const r = await fan.get(`/api/people/u/${ownerName}/products/${id}`);
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.json)).not.toContain('SECRET');
    }
  });

  it('photos: cropped and thumb only; originals, private, archived and Log photos are not authorised', async () => {
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'cropped'))).status).toBe(200);
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'thumb'))).status).toBe(200);
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'original'))).status).toBe(403);
    for (const ph of [privateP.photos[0]!, archivedP.photos[0]!]) {
      for (const v of ['thumb', 'cropped', 'original'] as const) expect((await fan.raw(photoUrl(ph, v))).status).toBe(403);
    }
    expect((await fan.raw(`/api/photos/${logPhotoId}/thumb`)).status).toBe(403);
  });

  it('making a product private or archiving it hides it and its photos at once', async () => {
    await owner.post(`/api/products/${visible.id}/private`, { value: true });
    expect((await products(fan)).json.products.map((p: SharedProduct) => p.name)).toEqual(['Shared Gummy']);
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'thumb'))).status).toBe(403);
    await owner.post(`/api/products/${visible.id}/private`, { value: false });
    expect((await fan.raw(photoUrl(visible.photos[0]!, 'thumb'))).status).toBe(200);
  });

  it('the follower can’t edit, archive, crop, promote or read anything of the owner’s', async () => {
    for (const r of [
      await fan.req('PUT', `/api/products/${visible.id}`, { ...emptyProductInput(), name: 'Hijack' }),
      await fan.post(`/api/products/${visible.id}/archived`, { value: true }),
      await fan.post(`/api/products/${visible.id}/private`, { value: true }),
      await fan.get(`/api/products/${visible.id}`),
      await fan.post(`/api/photos/${visible.photos[0]!.id}/crop`, { upload: 'x', crop: null }),
      await fan.get(`/api/log/${logEntryId}`),
      await fan.post(`/api/log/${logEntryId}/promote`, { ...emptyProductInput(), name: 'Hijack' }),
    ]) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).not.toContain('SECRET');
    }
    expect((await owner.get(`/api/products/${visible.id}`)).json.product.name).toBe('Public Kush');
  });
});

describe('access ends immediately (§17)', () => {
  const canSee = async () => (await products(fan)).status === 200 && (await fan.raw(photoUrl(visible.photos[0]!, 'thumb'))).status === 200;
  const refollow = async () => {
    await follow(fan);
    await approve(fanName);
    expect(await canSee()).toBe(true);
  };

  it('on unfollow', async () => {
    await refollow();
    await fan.del(`/api/people/u/${ownerName}/follow`);
    expect(await canSee()).toBe(false);
  });

  it('on removal by the owner', async () => {
    await refollow();
    await owner.del(`/api/people/followers/${fanName}`);
    expect(await canSee()).toBe(false);
  });

  it('on a block — which also hides the blocker and stops new requests, silently', async () => {
    await refollow();
    await owner.post(`/api/people/u/${fanName}/block`);
    expect(await canSee()).toBe(false);
    // The blocked person can't find, view or request the blocker.
    expect((await fan.get(`/api/people/search?q=${ownerName.slice(0, 5)}`)).json.people.map((p: { username: string }) => p.username)).not.toContain(ownerName);
    expect((await fan.get(`/api/people/u/${ownerName}`)).status).toBe(404);
    expect((await follow(fan)).status).toBe(404);
    // Follows in both directions were removed.
    expect((await owner.get('/api/people/followers')).json.people).toEqual([]);
    expect((await owner.get('/api/people/blocked')).json.people).toEqual([fanName]);
    // Undone from the blocked list: they can request again.
    await owner.del(`/api/people/u/${fanName}/block`);
    expect((await follow(fan)).json.person.relation).toBe('requested');
  });
});

describe('the follow flow', () => {
  it('declining is silent: the requester just sees Follow again', async () => {
    await follow(stranger);
    await owner.post(`/api/people/requests/${strangerName}/decline`);
    expect((await stranger.get(`/api/people/u/${ownerName}`)).json.person.relation).toBe('none');
  });

  it('following is one-way', async () => {
    const [a, b] = [new Browser(), new Browser()];
    const an = (await signUp(a)).username;
    const bn = (await signUp(b)).username;
    await follow(a, bn);
    await b.post(`/api/people/requests/${an}/approve`);
    expect((await a.get(`/api/people/u/${bn}`)).json.person.relation).toBe('following');
    expect((await b.get(`/api/people/u/${an}`)).json.person.relation).toBe('none');
    expect((await b.get('/api/people/followers')).json.people).toEqual([{ username: an, relation: 'none' }]);
    expect((await a.get('/api/people/following')).json.people).toEqual([{ username: bn, relation: 'following' }]);
  });

  it('you can’t follow yourself; unknown usernames are not found', async () => {
    expect((await follow(owner, ownerName)).status).toBe(404);
    expect((await follow(owner, 'nobody_here_xyz')).status).toBe(404);
  });

  it('search matches usernames, case-insensitively, and treats _ and % literally', async () => {
    const found = (await stranger.get(`/api/people/search?q=${ownerName.slice(0, 5).toUpperCase()}`)).json.people;
    expect(found).toContainEqual({ username: ownerName, relation: 'none' });
    expect((await stranger.get('/api/people/search?q=%25%25')).json.people).toEqual([]);
    expect((await stranger.get('/api/people/search?q=__')).json.people).toEqual([]);
    expect((await stranger.get('/api/people/search?q=b')).json.people).toEqual([]); // at least 2 characters
  });
});
