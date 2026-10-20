import { beforeAll, describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { photoUrl } from '../../shared/domain/photo';
import { emptyProductInput, type Product } from '../../shared/domain/product';
import { DEFAULT_PRIVACY, type Privacy } from '../../shared/domain/privacy';
import { SHARED_PRODUCT_KEYS, type SharedProduct } from '../../shared/domain/social';
import { Browser, signUp, uniqueName } from './client';

// Privacy settings (D45, 0.38.0). Every check runs on the raw response a follower's phone
// receives: what's switched off must not be in it at all.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;

let owner: Browser, fan: Browser, stranger: Browser, requester: Browser;
let ownerName: string, fanName: string;
let kush: Product;

const set = async (over: Partial<Privacy>) => {
  const r = await owner.req('PUT', '/api/privacy', { ...DEFAULT_PRIVACY, ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
};
const board = async (b = fan) => {
  const r = await b.get(`/api/people/u/${ownerName}/products`);
  return { status: r.status, json: r.json, raw: JSON.stringify(r.json), products: (r.json.products ?? []) as SharedProduct[] };
};
const page = (b = fan) => b.get(`/api/people/u/${ownerName}/products/${kush.id}`);
const avatarIn = async (b: Browser, path: string) => JSON.stringify((await b.get(path)).json).includes('"photo"');

beforeAll(async () => {
  [owner, fan, stranger, requester] = [new Browser(), new Browser(), new Browser(), new Browser()];
  ownerName = (await signUp(owner, uniqueName('priv'))).username;
  fanName = (await signUp(fan, uniqueName('pfan'))).username;
  await signUp(stranger, uniqueName('pstr'));
  await signUp(requester, uniqueName('preq'));
  kush = (
    await owner.post('/api/products', {
      ...emptyProductInput(),
      name: 'Shared Kush',
      country: 'MA',
      source: 'Secret Source Co',
      ratings: { look: 8 },
      photos: [{ upload: await newSet(owner, 'kush'), crop: null }],
    })
  ).json.product;
  expect((await owner.req('PUT', '/api/profile/photo', { upload: await newSet(owner, 'me'), crop: { x: 0, y: 0, w: 1, h: 1, square: true } })).status).toBe(200);
  await fan.post(`/api/people/u/${ownerName}/follow`);
  expect((await owner.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
  // The owner reached out to the requester: D23 lets the requester see the owner's photo.
  await owner.post(`/api/people/u/${(await requester.get('/api/auth/me')).json.user.username}/follow`);
});

describe('privacy settings (D45)', () => {
  it('start as before 0.38.0, are yours only, and refuse anything that isn’t a full set of switches', async () => {
    expect((await owner.get('/api/privacy')).json.privacy).toEqual(DEFAULT_PRIVACY);
    expect((await new Browser().get('/api/privacy')).status).toBe(401);
    expect((await owner.req('PUT', '/api/privacy', { shareBoard: false })).status).toBe(400);
    expect((await owner.req('PUT', '/api/privacy', { ...DEFAULT_PRIVACY, shareBoard: 'no' })).status).toBe(400);
    // Defaults: exactly the allow-listed fields, Source, country and photos shared.
    const b = await board();
    const p = b.products[0]!;
    expect(Object.keys(p).sort()).toEqual([...SHARED_PRODUCT_KEYS].sort());
    expect(p).toMatchObject({ source: 'Secret Source Co', country: 'MA' });
    expect(p.photos).toHaveLength(1);
    // Smokes are gone (D60): nothing about them, nor any board options.
    expect(b.json.options).toBeUndefined();
    expect(b.raw).not.toMatch(/smoke|mostUsed/i);
  });

  it('settings sent with the old Smokes switches (an app from before 0.50.0) are taken without them', async () => {
    const r = await owner.req('PUT', '/api/privacy', { ...DEFAULT_PRIVACY, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true });
    expect(r.status).toBe(200);
    expect(r.json.privacy).toEqual(DEFAULT_PRIVACY);
    expect((await owner.get('/api/privacy')).json.privacy).toEqual(DEFAULT_PRIVACY);
  });

  it('there is no Smokes any more: its addresses are gone', async () => {
    expect((await owner.get('/api/smokes')).status).toBe(404);
    expect((await owner.post('/api/smokes', { productId: kush.id, logEntryId: null, date: '2026-10-01', time: '20:00', amount: null, effect: null })).status).toBe(404);
  });

  it('Source, Country and photos off: gone from the board, the page and the photo files', async () => {
    await set({ shareSource: false, shareCountry: false, sharePhotos: false });
    const b = await board();
    expect(b.raw).not.toContain('Secret Source Co');
    expect(b.products[0]).toMatchObject({ source: null, country: null, countryOther: null, photos: [] });
    const one = await page();
    expect(JSON.stringify(one.json)).not.toContain('Secret Source Co');
    expect(one.json.product).toMatchObject({ source: null, country: null, photos: [] });
    for (const v of ['thumb', 'cropped'] as const) expect((await fan.raw(photoUrl(kush.photos[0]!, v))).status).toBe(403);
    expect((await owner.raw(photoUrl(kush.photos[0]!, 'thumb'))).status).toBe(200); // still yours
    await set({});
    expect((await fan.raw(photoUrl(kush.photos[0]!, 'thumb'))).status).toBe(200);
  });

  it('Share my Leaderboard off: no products, no pages, no photos, whatever the other switches say', async () => {
    await set({ shareBoard: false });
    const b = await board();
    expect(b.status).toBe(200);
    expect(b.products).toEqual([]);
    expect(b.raw).not.toMatch(/Shared Kush|Secret Source/);
    expect((await page()).status).toBe(404);
    expect((await fan.raw(photoUrl(kush.photos[0]!, 'thumb'))).status).toBe(403);
    await set({});
    expect((await board()).products).toHaveLength(1);
  });

  it('profile photo off: your letter for everyone else, everywhere; still yours to see', async () => {
    const reqName = (await requester.get('/api/auth/me')).json.user.username;
    expect(await avatarIn(fan, `/api/people/u/${ownerName}`)).toBe(true);
    expect(await avatarIn(fan, '/api/people/following')).toBe(true);
    const requestPhoto = async () => (await requester.get('/api/people/requests')).json.photos[ownerName];
    expect(await requestPhoto()).toBeTruthy();
    expect((await fan.raw(`/api/people/u/${ownerName}/photo/thumb`)).status).toBe(200);

    await set({ shareProfilePhoto: false });
    expect(await avatarIn(fan, `/api/people/u/${ownerName}`)).toBe(false);
    expect(await avatarIn(fan, '/api/people/following')).toBe(false);
    expect(await avatarIn(fan, `/api/people/u/${ownerName}/products`)).toBe(false);
    expect(await requestPhoto()).toBeUndefined();
    expect(JSON.stringify((await fan.get(`/api/people/search?q=${ownerName.slice(0, 6)}`)).json)).not.toContain('"photo"');
    expect((await fan.raw(`/api/people/u/${ownerName}/photo/thumb`)).status).toBe(403);
    expect((await owner.get('/api/auth/me')).json.user.photo).toBeTruthy(); // you still see your own
    expect(reqName).toBeTruthy();
    await set({});
    expect((await fan.raw(`/api/people/u/${ownerName}/photo/thumb`)).status).toBe(200);
  });

  it('a stranger still gets nothing at all, whatever you share', async () => {
    const r = await stranger.get(`/api/people/u/${ownerName}/products`);
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.json)).not.toMatch(/Shared Kush/);
  });

  it('the preview is your board exactly as a follower gets it', async () => {
    await set({ shareSource: false });
    const pv = (await owner.get('/api/privacy/preview')).json;
    const b = await board();
    expect(pv.products).toEqual(b.products);
    expect(pv.shared).toBe(true);
    await set({ shareBoard: false });
    expect((await owner.get('/api/privacy/preview')).json).toMatchObject({ products: [], shared: false });
    await set({});
  });
});

describe('export and restore (D45)', () => {
  it('a restore puts the file’s settings back; a file from before 0.38.0 leaves yours alone', async () => {
    const b = new Browser();
    await signUp(b);
    const theirs: Privacy = { ...DEFAULT_PRIVACY, shareSource: false };
    const payload: RestorePayload = { products: [{ ...emptyProductInput(), name: 'P', archived: false, createdAt: 1 }], logEntries: [], privacy: theirs };
    expect((await b.post('/api/data/restore', payload)).status).toBe(200);
    expect((await b.get('/api/privacy')).json.privacy).toEqual(theirs);
    expect((await b.post('/api/data/restore', { products: [], logEntries: [] })).status).toBe(200);
    expect((await b.get('/api/privacy')).json.privacy).toEqual(theirs);
    const bad = await b.post('/api/data/restore', { products: [], logEntries: [], privacy: { shareBoard: 1 } });
    expect(bad.status).toBe(400);
  });
});
