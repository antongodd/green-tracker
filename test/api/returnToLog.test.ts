import { beforeAll, describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { keptPromotionInput, logEntryToInput, type LogEntry } from '../../shared/domain/logEntry';
import { photoUrl } from '../../shared/domain/photo';
import { emptyProductInput, productToInput, type Product, type ProductInput } from '../../shared/domain/product';
import type { SharedProduct } from '../../shared/domain/social';
import { Browser, signUp } from './client';
import { d1, r2Keys, userId } from './store';

// Return to Log (D50, 0.43.0): a Leaderboard product becomes a Log entry again, keeping
// everything else hidden until Add to leaderboard brings it back.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const eventually = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
  return check();
};

let me: Browser, fan: Browser, other: Browser;
let myName: string;

/** A full product: three photos, a hidden rating (from when it was a concentrate), purchases, notes. */
async function rich(b: Browser, name: string, over: Partial<ProductInput> = {}): Promise<Product> {
  const photos = [];
  for (const l of ['one', 'two', 'three']) photos.push({ upload: await newSet(b, `${name}-${l}`), crop: null });
  const base: ProductInput = {
    ...emptyProductInput(),
    name,
    productType: 'concentrate',
    country: 'ES',
    ratings: { look: 9, consistency: 8, smell: 9, taste: 9, burn: 8 },
    purchases: [
      { date: '2026-09-03', amount: 3.5, totalPaid: 30, supplier: 'Club A' },
      { date: '2026-09-20', amount: 3.5, totalPaid: 30, supplier: null },
      { date: '2026-09-25', amount: null, totalPaid: 5, supplier: null },
    ],
    notes: 'Sweet and smooth.',
    photos,
    ...over,
  };
  const created = (await b.post('/api/products', base)).json.product as Product;
  // Now a flower: "consistency" stays stored but hidden.
  const r = await b.req('PUT', `/api/products/${created.id}`, { ...productToInput(created), productType: 'flower', ratings: { look: 9, smell: 9, taste: 9, burn: 8, high: null } });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return r.json.product;
}
const returnToLog = (b: Browser, id: string) => b.post(`/api/log/return/${id}`);

beforeAll(async () => {
  [me, fan, other] = [new Browser(), new Browser(), new Browser()];
  myName = (await signUp(me)).username;
  const fanName = (await signUp(fan)).username;
  await signUp(other);
  await fan.post(`/api/people/u/${myName}/follow`);
  expect((await me.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
});

describe('Return to Log', () => {
  it('turns the product into a Log entry and keeps the rest, hidden', async () => {
    const p = await rich(me, 'Zkittlez');
    const r = await returnToLog(me, p.id);
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const e = r.json.entry as LogEntry;
    // The entry: its name, type and country; all purchases' amounts added up; its first photo; logged when the product was added.
    expect(e).toMatchObject({ name: 'Zkittlez', productType: 'flower', country: 'ES', amount: 7, createdAt: p.createdAt });
    expect(e.photo?.id).toBe(p.photos[0]!.id);
    expect(text((await me.raw(photoUrl(e.photo!, 'original'))).bytes)).toBe('Zkittlez-one-original');
    // Kept: everything else, as it was.
    expect(e.kept).toMatchObject({ id: p.id, notes: 'Sweet and smooth.', ratings: { look: 9, consistency: 8, smell: 9, taste: 9, burn: 8 } });
    expect(e.kept!.purchases.map((x) => x.id)).toEqual(p.purchases.map((x) => x.id));
    expect(e.kept!.photos.map((x) => x.id)).toEqual(p.photos.slice(1).map((x) => x.id));
    // In the Log list too.
    expect(((await me.get('/api/log')).json.entries as LogEntry[]).find((x) => x.id === e.id)?.kept?.id).toBe(p.id);
  });

  it('hides the kept product everywhere a product shows, and refuses changes to it', async () => {
    const p = await rich(me, 'Hidden Kush');
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    expect(((await me.get('/api/products')).json.products as Product[]).map((x) => x.id)).not.toContain(p.id);
    expect(((await me.get('/api/products?archived=1')).json.products as Product[]).map((x) => x.id)).not.toContain(p.id);
    expect((await me.get(`/api/products/${p.id}`)).status).toBe(404);
    expect((await me.req('PUT', `/api/products/${p.id}`, productToInput(p))).status).toBe(404);
    expect((await me.post(`/api/products/${p.id}/private`, { value: true })).status).toBe(404);
    expect((await me.post(`/api/products/${p.id}/archived`, { value: true })).status).toBe(404);
    // Twice: it's already in the Log.
    expect((await returnToLog(me, p.id)).status).toBe(404);
    // The owner can still see its photos (they come back with it).
    expect((await me.raw(photoUrl(e.kept!.photos[0]!, 'thumb'))).status).toBe(200);
  });

  it('followers stop seeing it, photos included', async () => {
    const p = await rich(me, 'Fan Favourite');
    const board = async () => ((await fan.get(`/api/people/u/${myName}/products`)).json.products as SharedProduct[]).map((x) => x.id);
    expect(await board()).toContain(p.id);
    expect((await fan.raw(photoUrl(p.photos[1]!, 'thumb'))).status).toBe(200);
    await returnToLog(me, p.id);
    expect(await board()).not.toContain(p.id);
    expect((await fan.get(`/api/people/u/${myName}/products/${p.id}`)).status).toBe(404);
    for (const ph of p.photos) expect((await fan.raw(photoUrl(ph, 'thumb'))).status).toBe(403);
    expect(JSON.stringify((await me.get('/api/privacy')).json)).not.toContain(p.id);
  });

  it('an archived product is un-archived first; someone else’s is missing', async () => {
    const p = await rich(me, 'Boxed Up');
    await me.post(`/api/products/${p.id}/archived`, { value: true });
    const r = await returnToLog(me, p.id);
    expect(r.status).toBe(409);
    expect(r.json.message).toBe('Un-archive it first.');
    expect((await returnToLog(other, p.id)).status).toBe(404);
    expect((await me.get(`/api/products/${p.id}`)).json.product.archived).toBe(true);
  });

  it('no amounts in its purchases: no amount; no photos: no photo', async () => {
    const p = (await me.post('/api/products', { ...emptyProductInput(), name: 'Bare', purchases: [{ date: null, amount: null, totalPaid: 10, supplier: null }] })).json.product as Product;
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    expect(e).toMatchObject({ amount: null, photo: null });
    expect(e.kept!.photos).toEqual([]);
  });
});

describe('Add to leaderboard brings it back', () => {
  it('as it was: the same product, its place in time, ratings, purchases and photos', async () => {
    const p = await rich(me, 'Round Trip');
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    const res = await me.post(`/api/log/${e.id}/promote`, keptPromotionInput(logEntryToInput(e), e.kept!));
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    const back = res.json.product as Product;
    expect(back.id).toBe(p.id);
    expect(back).toMatchObject({ name: 'Round Trip', productType: 'flower', country: 'ES', notes: 'Sweet and smooth.', createdAt: p.createdAt, ratings: p.ratings });
    expect(back.ratings.consistency).toBe(8); // the hidden one too
    expect(back.purchases).toEqual(p.purchases);
    expect(back.photos.map((x) => x.id)).toEqual(p.photos.map((x) => x.id)); // the first photo first again
    expect((await me.get(`/api/log/${e.id}`)).status).toBe(404);
    expect(((await me.get('/api/products')).json.products as Product[]).map((x) => x.id)).toContain(p.id);
    // And it can go back again.
    expect((await returnToLog(me, p.id)).status).toBe(201);
  });

  it('with changes made in the Log: its name, type and photo; the purchases stay as they were', async () => {
    const p = await rich(me, 'Renamed Later');
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    // Its photo removed in the Log.
    const put = await me.req('PUT', `/api/log/${e.id}`, { ...logEntryToInput(e), name: 'Renamed Now', productType: 'pre_roll', amount: 12, photos: [] });
    expect(put.status, JSON.stringify(put.json)).toBe(200);
    const edited = put.json.entry as LogEntry;
    expect(edited.kept?.id).toBe(p.id);
    const back = (await me.post(`/api/log/${e.id}/promote`, keptPromotionInput(logEntryToInput(edited), edited.kept!))).json.product as Product;
    expect(back).toMatchObject({ id: p.id, name: 'Renamed Now', productType: 'pre_roll' });
    expect(back.purchases).toEqual(p.purchases);
    expect(back.photos.map((x) => x.id)).toEqual(p.photos.slice(1).map((x) => x.id));
  });

  it('its photo swapped for a new one in the Log (D51): the new one leads, the kept ones follow', async () => {
    const p = await rich(me, 'Swapped In Log');
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    const put = await me.req('PUT', `/api/log/${e.id}`, { ...logEntryToInput(e), photos: [{ upload: await newSet(me, 'swapped-new'), crop: null }] });
    expect(put.status, JSON.stringify(put.json)).toBe(200);
    const edited = put.json.entry as LogEntry;
    expect((await me.raw(photoUrl(p.photos[0]!, 'thumb'))).status).toBe(403);
    const back = (await me.post(`/api/log/${e.id}/promote`, keptPromotionInput(logEntryToInput(edited), edited.kept!))).json.product as Product;
    expect(back.photos.map((x) => x.id)).toEqual([edited.photo!.id, ...p.photos.slice(1).map((x) => x.id)]);
    expect(text((await me.raw(photoUrl(back.photos[0]!, 'original'))).bytes)).toBe('swapped-new-original');
  });
});

describe('Delete entry', () => {
  it('deletes what it keeps too: the product, its ratings, purchases and every photo file', async () => {
    const p = await rich(me, 'Gone For Good');
    const e = (await returnToLog(me, p.id)).json.entry as LogEntry;
    const id = userId(myName)!;
    const sets = d1<{ original_set: string }>('SELECT original_set FROM photos WHERE product_id = ?1 OR log_entry_id = ?2', p.id, e.id).map((r) => r.original_set);
    expect(sets).toHaveLength(3);
    expect((await me.del(`/api/log/${e.id}`)).status).toBe(200);
    expect(d1('SELECT 1 FROM products WHERE id = ?', p.id)).toHaveLength(0);
    expect(d1('SELECT 1 FROM ratings WHERE product_id = ?', p.id)).toHaveLength(0);
    expect(d1('SELECT 1 FROM purchases WHERE product_id = ?', p.id)).toHaveLength(0);
    expect(await eventually(() => sets.every((s) => r2Keys(`u/${id}/s/${s}/`).length === 0))).toBe(true);
  });
});

describe('Export and restore', () => {
  it('restores a returned entry with what it keeps', async () => {
    const b = new Browser();
    await signUp(b);
    const kept = { ...emptyProductInput(), name: 'Kept One', ratings: { look: 8, taste: 9 }, notes: 'Kept notes', purchases: [{ date: null, amount: 2, totalPaid: 20, supplier: null }], photos: [{ upload: await newSet(b, 'kept'), crop: null }], createdAt: 1_700_000_000_000 };
    const payload: RestorePayload = {
      products: [],
      logEntries: [{ ...logEntryToInput({ name: 'Kept One', productType: 'flower', productTypeOther: null, concentrateType: 'hash', concentrateTypeOther: null, country: null, countryOther: null, amount: 2, photo: null } as LogEntry), photos: [{ upload: await newSet(b, 'entry'), crop: null }], createdAt: 1_700_000_000_000, kept }],
    };
    const r = await b.post('/api/data/restore', payload);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toMatchObject({ products: 0, logEntries: 1, photos: 2 });
    const [e] = (await b.get('/api/log')).json.entries as LogEntry[];
    expect(e).toMatchObject({ name: 'Kept One', amount: 2 });
    expect(e!.kept).toMatchObject({ name: 'Kept One', notes: 'Kept notes', ratings: { look: 8, taste: 9 } });
    expect(e!.kept!.photos).toHaveLength(1);
    expect(text((await b.raw(photoUrl(e!.kept!.photos[0]!, 'original'))).bytes)).toBe('kept-original');
    expect((await b.get('/api/products')).json.products).toEqual([]);
  });

  it('a bad kept product rejects the whole restore', async () => {
    const b = new Browser();
    await signUp(b);
    const entry = { ...logEntryToInput({ name: 'E', productType: 'flower', productTypeOther: null, concentrateType: 'hash', concentrateTypeOther: null, country: null, countryOther: null, amount: null, photo: null } as LogEntry), createdAt: 1_700_000_000_000 };
    const r = await b.post('/api/data/restore', { products: [], logEntries: [{ ...entry, kept: { ...emptyProductInput(), name: '', createdAt: 1_700_000_000_000 } }] });
    expect(r.status).toBe(400);
    expect(r.json.message).toBe('Log entry 1: Give the product a name.');
  });
});
