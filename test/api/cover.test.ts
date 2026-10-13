import { beforeAll, describe, expect, it } from 'vitest';
import type { RestoreProduct } from '../../shared/domain/backup';
import { emptyLogEntryInput, type LogEntry } from '../../shared/domain/logEntry';
import { emptyProductInput, type Product } from '../../shared/domain/product';
import type { SharedProduct } from '../../shared/domain/social';
import { Browser, signUp } from './client';

// Set as cover (D52, 0.44.0): a product's cover is its first photo; Set as cover on the
// product page moves a photo to the front at once, keeping the others in order.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const ids = (p: { photos: { id: string }[] }) => p.photos.map((x) => x.id);
const cover = (b: Browser, photoId: string) => b.post(`/api/photos/${photoId}/cover`);

let me: Browser, fan: Browser, other: Browser;
let myName: string;

async function withPhotos(b: Browser, name: string, n = 3): Promise<Product> {
  const photos = [];
  for (let i = 0; i < n; i++) photos.push({ upload: await newSet(b, `${name}-${i}`), crop: null });
  const r = await b.post('/api/products', { ...emptyProductInput(), name, photos });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.product;
}

beforeAll(async () => {
  [me, fan, other] = [new Browser(), new Browser(), new Browser()];
  myName = (await signUp(me)).username;
  const fanName = (await signUp(fan)).username;
  await signUp(other);
  await fan.post(`/api/people/u/${myName}/follow`);
  expect((await me.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
});

describe('Set as cover', () => {
  it('moves the photo to the front and keeps the others in order, saved at once', async () => {
    const p = await withPhotos(me, 'Gelato 41', 4);
    const [a, b, c, d] = ids(p);
    const r = await cover(me, c!);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(ids(r.json.product)).toEqual([c, a, b, d]);
    expect(ids((await me.get(`/api/products/${p.id}`)).json.product)).toEqual([c, a, b, d]);
    // Again, with another: still one list, in order.
    expect(ids((await cover(me, d!)).json.product)).toEqual([d, c, a, b]);
    // The cover already: nothing changes.
    expect(ids((await cover(me, d!)).json.product)).toEqual([d, c, a, b]);
    // The Leaderboard list carries the same order (its rows show the first).
    const listed = ((await me.get('/api/products')).json.products as Product[]).find((x) => x.id === p.id)!;
    expect(ids(listed)).toEqual([d, c, a, b]);
  });

  it('followers see the new cover first', async () => {
    const p = await withPhotos(me, 'Shared Cover');
    const [a, b, c] = ids(p);
    await cover(me, b!);
    const shared = (await fan.get(`/api/people/u/${myName}/products/${p.id}`)).json.product as SharedProduct;
    expect(ids(shared)).toEqual([b, a, c]);
  });

  it('is refused for someone else’s photo, a Log entry’s and one a returned entry keeps (D50)', async () => {
    const p = await withPhotos(me, 'Mine Only');
    const theirs = await cover(other, ids(p)[1]!);
    expect(theirs.status).toBe(404);
    expect(ids((await me.get(`/api/products/${p.id}`)).json.product)).toEqual(ids(p));

    const entry = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Loose', photos: [{ upload: await newSet(me, 'loose'), crop: null }] })).json.entry as LogEntry;
    expect((await cover(me, entry.photo!.id)).status).toBe(404);

    const returned = await withPhotos(me, 'Returned');
    const e = (await me.post(`/api/log/return/${returned.id}`)).json.entry as LogEntry;
    expect(e.kept?.id).toBe(returned.id);
    expect((await cover(me, ids(returned)[2]!)).status).toBe(404);
    expect(ids((await me.get(`/api/log/${e.id}`)).json.entry.kept)).toEqual(ids(returned).slice(1));

    expect((await cover(me, 'no-such-photo')).status).toBe(404);
  });

  it('Return to Log takes the chosen cover', async () => {
    const p = await withPhotos(me, 'Cover Returns');
    const [a, b, c] = ids(p);
    await cover(me, c!);
    const e = (await me.post(`/api/log/return/${p.id}`)).json.entry as LogEntry;
    expect(e.photo?.id).toBe(c);
    expect(ids(e.kept!)).toEqual([a, b]);
  });

  it('a restore keeps the photos in the order the file lists them, so the cover survives', async () => {
    const b = new Browser();
    await signUp(b);
    const photos = [];
    for (const l of ['second', 'first', 'third']) photos.push({ upload: await newSet(b, l), crop: null });
    const product: RestoreProduct = { ...emptyProductInput(), name: 'Round Trip', archived: false, createdAt: 1_700_000_000_000, photos };
    const r = await b.post('/api/data/restore', { products: [product], logEntries: [] });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const [restored] = (await b.get('/api/products')).json.products as Product[];
    const originals = await Promise.all(restored!.photos.map(async (ph) => new TextDecoder().decode((await b.raw(`/api/photos/${ph.id}/original?v=${ph.version}`)).bytes.slice(4))));
    expect(originals).toEqual(['second-original', 'first-original', 'third-original']);
  });
});
