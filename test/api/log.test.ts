import { beforeAll, describe, expect, it } from 'vitest';
import { emptyLogEntryInput, promotionInput, type LogEntry, type LogEntryInput } from '../../shared/domain/logEntry';
import { photoUrl } from '../../shared/domain/photo';
import type { Product } from '../../shared/domain/product';
import { Browser, signUp } from './client';

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;

const entry = (over: Partial<LogEntryInput> = {}): LogEntryInput => ({ ...emptyLogEntryInput(), name: 'Gary Payton', ...over });
async function create(b: Browser, over: Partial<LogEntryInput> = {}): Promise<LogEntry> {
  const r = await b.post('/api/log', entry(over));
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.entry;
}

let me: Browser;
beforeAll(async () => {
  me = new Browser();
  await signUp(me);
});

describe('loose log entries', () => {
  it('creates, edits and lists entries; auto-capitalises the name', async () => {
    const e = await create(me, { name: 'wedding cake', country: 'US', amount: 3.5 });
    expect(e).toMatchObject({ name: 'Wedding Cake', productType: 'flower', country: 'US', amount: 3.5, photo: null });
    const r = await me.req('PUT', `/api/log/${e.id}`, entry({ name: 'Wedding Cake', productType: 'edibles', amount: 100 }));
    expect(r.json.entry).toMatchObject({ productType: 'edibles', amount: 100, country: null });
    expect((await me.get('/api/log')).json.entries.map((x: LogEntry) => x.id)).toContain(e.id);
  });

  it('has one photo at most', async () => {
    const res = await me.post('/api/log', entry({ photos: [{ upload: await newSet(me, 'a'), crop: null }, { upload: await newSet(me, 'b'), crop: null }] }));
    expect(res.status).toBe(400);
    expect(res.json.message).toBe('A log entry has one photo.');
  });

  it('rejects a blank name and a zero amount', async () => {
    expect((await me.post('/api/log', entry({ name: ' ' }))).json.message).toBe('Give the entry a name.');
    expect((await me.post('/api/log', entry({ amount: 0 }))).json.message).toBe('Amount must be more than 0.');
  });

  it('hard-deletes an entry and its photo', async () => {
    const e = await create(me, { photos: [{ upload: await newSet(me, 'del'), crop: null }] });
    expect((await me.raw(photoUrl(e.photo!, 'thumb'))).status).toBe(200);
    expect((await me.del(`/api/log/${e.id}`)).status).toBe(200);
    expect((await me.get(`/api/log/${e.id}`)).status).toBe(404);
    expect((await me.raw(photoUrl(e.photo!, 'thumb'))).status).toBe(403);
  });
});

describe('promotion (§10.2)', () => {
  it('creates the product, moves the photo (original too) and deletes the entry — atomically', async () => {
    const e = await create(me, { name: 'RS11', country: 'TH', productType: 'concentrate', concentrateType: 'rosin', amount: 2, photos: [{ upload: await newSet(me, 'promo'), crop: null }] });
    const photo = e.photo!;
    const body = promotionInput({ ...entry(), name: e.name, country: e.country, productType: e.productType, concentrateType: e.concentrateType, amount: e.amount, photos: [{ id: photo.id, crop: null }] });
    const res = await me.post(`/api/log/${e.id}/promote`, body);
    expect(res.status).toBe(201);
    const p = res.json.product as Product;
    expect(p).toMatchObject({ name: 'RS11', country: 'TH', productType: 'concentrate', concentrateType: 'rosin', ratings: {}, purchases: [] }); // amount dropped
    expect(p.photos.map((x) => x.id)).toEqual([photo.id]); // the same photo, re-assigned
    expect(text((await me.raw(photoUrl(p.photos[0]!, 'original'))).bytes)).toBe('promo-original');
    expect((await me.get(`/api/log/${e.id}`)).status).toBe(404);
  });

  it('a failed promotion changes nothing', async () => {
    const e = await create(me, { name: 'Keep Me', photos: [{ upload: await newSet(me, 'keep'), crop: null }] });
    const bad = await me.post(`/api/log/${e.id}/promote`, { ...promotionInput(entry({ name: '' })), photos: [{ id: e.photo!.id, crop: null }] });
    expect(bad.status).toBe(400);
    const still = (await me.get(`/api/log/${e.id}`)).json.entry as LogEntry;
    expect(still.photo?.id).toBe(e.photo!.id);
    const count = (await me.get('/api/products')).json.products.filter((x: Product) => x.name === 'Keep Me').length;
    expect(count).toBe(0);
  });

  it('removing the photo in the product editor deletes it on promotion', async () => {
    const e = await create(me, { name: 'No Photo After', photos: [{ upload: await newSet(me, 'rm'), crop: null }] });
    const res = await me.post(`/api/log/${e.id}/promote`, promotionInput(entry({ name: 'No Photo After', photos: [] })));
    expect(res.json.product.photos).toEqual([]);
    expect((await me.raw(photoUrl(e.photo!, 'thumb'))).status).toBe(403);
  });

  it('a new crop made in the product editor applies to the moved photo', async () => {
    const e = await create(me, { name: 'Recrop', photos: [{ upload: await newSet(me, 'rc'), crop: null }] });
    const crop = (await me.upload('/api/uploads', { cropped: jpeg('rc2-cropped'), thumb: jpeg('rc2-thumb') })).json.upload as string;
    const res = await me.post(`/api/log/${e.id}/promote`, promotionInput(entry({ name: 'Recrop', photos: [{ id: e.photo!.id, upload: crop, crop: { x: 0, y: 0, w: 0.5, h: 0.5, square: true } }] })));
    const p = res.json.product as Product;
    expect(text((await me.raw(photoUrl(p.photos[0]!, 'cropped'))).bytes)).toBe('rc2-cropped');
    expect(text((await me.raw(photoUrl(p.photos[0]!, 'original'))).bytes)).toBe('rc-original');
  });
});

describe('privacy: another user’s entries are out of reach (§17)', () => {
  it('every route treats their IDs as missing', async () => {
    const victim = new Browser();
    await signUp(victim);
    const e = await create(victim, { name: 'Secret', photos: [{ upload: await newSet(victim, 's'), crop: null }] });
    const attacker = new Browser();
    await signUp(attacker);
    for (const res of [
      await attacker.get(`/api/log/${e.id}`),
      await attacker.req('PUT', `/api/log/${e.id}`, entry()),
      await attacker.del(`/api/log/${e.id}`),
      await attacker.post(`/api/log/${e.id}/promote`, promotionInput(entry({ photos: [{ id: e.photo!.id, crop: null }] }))),
    ]) {
      expect(res.status).toBe(404);
    }
    // Adopting someone else's photo into your own product, by ID, is refused too.
    const mine = await create(attacker, { name: 'Mine' });
    expect((await attacker.post(`/api/log/${mine.id}/promote`, promotionInput(entry({ photos: [{ id: e.photo!.id, crop: null }] })))).json.error).toBe('invalid_photos');
    expect((await attacker.get('/api/log')).json.entries.map((x: LogEntry) => x.name)).toEqual(['Mine']);
    expect((await victim.get(`/api/log/${e.id}`)).json.entry.photo.id).toBe(e.photo!.id);
  });
});
