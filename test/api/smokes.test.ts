import { beforeAll, describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { emptyLogEntryInput, promotionInput, type LogEntry } from '../../shared/domain/logEntry';
import { emptyProductInput, type Product } from '../../shared/domain/product';
import type { Smoke, SmokeInput } from '../../shared/domain/smoke';
import { Browser, signUp } from './client';
import { d1 } from './store';

// Smokes (D43, 0.36.0): yours only, each pointing at one of your products or Log entries.

let me: Browser, other: Browser;
let product: Product, entry: LogEntry, theirs: Product;

const smoke = (over: Partial<SmokeInput> = {}): SmokeInput => ({ productId: product.id, logEntryId: null, date: '2026-10-07', time: '21:40', amount: 0.3, effect: 'Relaxed', ...over });
async function add(b: Browser, over: Partial<SmokeInput> = {}): Promise<Smoke> {
  const r = await b.post('/api/smokes', smoke(over));
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.smoke;
}
const list = async (b: Browser) => (await b.get('/api/smokes')).json.smokes as Smoke[];

beforeAll(async () => {
  [me, other] = [new Browser(), new Browser()];
  await signUp(me);
  await signUp(other);
  product = (await me.post('/api/products', { ...emptyProductInput(), name: 'Wedding Cake' })).json.product;
  entry = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Sour Gummies', productType: 'edibles' })).json.entry;
  theirs = (await other.post('/api/products', { ...emptyProductInput(), name: 'Not Yours' })).json.product;
});

describe('smokes', () => {
  it('adds, lists newest first, changes and deletes', async () => {
    const a = await add(me, { date: '2026-10-06', time: '19:05' });
    const b = await add(me, { productId: null, logEntryId: entry.id, date: '2026-10-07', time: '08:00', amount: 10, effect: '  Body high  ' });
    expect(b).toMatchObject({ productId: null, logEntryId: entry.id, amount: 10, effect: 'Body high' });
    expect((await list(me)).map((s) => s.id).slice(0, 2)).toEqual([b.id, a.id]);

    const changed = await me.req('PUT', `/api/smokes/${a.id}`, smoke({ date: '2026-10-06', time: '20:00', amount: null, effect: '' }));
    expect(changed.status).toBe(200);
    expect(changed.json.smoke).toMatchObject({ id: a.id, time: '20:00', amount: null, effect: null });

    expect((await me.del(`/api/smokes/${a.id}`)).status).toBe(200);
    expect((await list(me)).map((s) => s.id)).not.toContain(a.id);
    expect((await me.del(`/api/smokes/${a.id}`)).status).toBe(404);
  });

  it('checks every field like the app does', async () => {
    const bad = async (over: Partial<SmokeInput> | Record<string, unknown>) => (await me.post('/api/smokes', { ...smoke(), ...over })).json.message;
    expect(await bad({ date: '2026-13-01' })).toBe('Choose a date.');
    expect(await bad({ time: '25:00' })).toBe('Choose a time.');
    expect(await bad({ amount: -1 })).toBe('How much must be more than 0.');
    expect(await bad({ productId: null })).toBe('Choose what you had.');
    expect(await bad({ logEntryId: entry.id })).toBe('Choose what you had.');
    // The server can't know your time zone: a day past its own today, never more.
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect(await bad({ date: later })).toBe('The date can’t be in the future.');
  });

  it('only ever points at your own products and Log entries, and only you can see or touch it', async () => {
    expect((await me.post('/api/smokes', smoke({ productId: theirs.id }))).status).toBe(404);
    expect((await other.post('/api/smokes', smoke())).status).toBe(404); // my product, their account
    expect((await other.post('/api/smokes', smoke({ productId: null, logEntryId: entry.id }))).status).toBe(404);
    const mine = await add(me);
    expect((await other.req('PUT', `/api/smokes/${mine.id}`, smoke({ productId: theirs.id }))).status).toBe(404);
    expect((await other.del(`/api/smokes/${mine.id}`)).status).toBe(404);
    expect(await list(other)).toEqual([]);
    // Moving one of mine onto someone else's product is refused too.
    expect((await me.req('PUT', `/api/smokes/${mine.id}`, smoke({ productId: theirs.id }))).status).toBe(404);
    expect((await new Browser().get('/api/smokes')).status).toBe(401);
  });

  it('never reaches a follower: not in their product list, not in a product page', async () => {
    const owner = d1<{ username: string }>('SELECT u.username FROM users u JOIN products p ON p.user_id = u.id WHERE p.id = ?', product.id)[0]!.username;
    const fanName = (await me.get('/api/auth/me')).json.user.username;
    const fan = new Browser();
    const { username } = await signUp(fan);
    await fan.post(`/api/people/u/${owner}/follow`);
    expect((await me.post(`/api/people/requests/${username}/approve`)).status).toBe(200);
    expect(fanName).toBe(owner);
    const raw = [JSON.stringify((await fan.get(`/api/people/u/${owner}/products`)).json), JSON.stringify((await fan.get(`/api/people/u/${owner}/products/${product.id}`)).json)];
    expect(raw[0]).toContain('Wedding Cake');
    for (const body of raw) expect(body.toLowerCase()).not.toMatch(/smoke|relaxed|21:40/);
  });
});

describe('with the Log', () => {
  it('Add to leaderboard moves an entry’s smokes to the new product, in the same save', async () => {
    const e = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Promote Me' })).json.entry as LogEntry;
    const s1 = await add(me, { productId: null, logEntryId: e.id });
    const s2 = await add(me, { productId: null, logEntryId: e.id, time: '22:00' });
    const res = await me.post(`/api/log/${e.id}/promote`, promotionInput({ ...emptyLogEntryInput(), name: 'Promote Me' }));
    expect(res.status).toBe(201);
    const moved = (await list(me)).filter((s) => s.id === s1.id || s.id === s2.id);
    expect(moved.map((s) => [s.productId, s.logEntryId])).toEqual([
      [res.json.product.id, null],
      [res.json.product.id, null],
    ]);
  });

  it('a failed promotion leaves the smokes on the entry', async () => {
    const e = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Stay Put' })).json.entry as LogEntry;
    const s = await add(me, { productId: null, logEntryId: e.id });
    expect((await me.post(`/api/log/${e.id}/promote`, promotionInput({ ...emptyLogEntryInput(), name: '' }))).status).toBe(400);
    expect((await list(me)).find((x) => x.id === s.id)).toMatchObject({ productId: null, logEntryId: e.id });
  });

  it('deleting an entry deletes its smokes', async () => {
    const e = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Delete Me' })).json.entry as LogEntry;
    const s = await add(me, { productId: null, logEntryId: e.id });
    expect((await me.del(`/api/log/${e.id}`)).status).toBe(200);
    expect((await list(me)).map((x) => x.id)).not.toContain(s.id);
    expect(d1('SELECT COUNT(*) AS n FROM smokes WHERE id = ?', s.id)).toEqual([{ n: 0 }]);
  });

  it('archiving a product keeps its smokes', async () => {
    const p = (await me.post('/api/products', { ...emptyProductInput(), name: 'Archive Me' })).json.product as Product;
    const s = await add(me, { productId: p.id });
    expect((await me.post(`/api/products/${p.id}/archived`, { value: true })).status).toBe(200);
    expect((await list(me)).map((x) => x.id)).toContain(s.id);
  });
});

describe('restore', () => {
  it('replaces your smokes with the file’s, each on its own product or entry; an older file has none', async () => {
    const b = new Browser();
    await signUp(b);
    const p = (await b.post('/api/products', { ...emptyProductInput(), name: 'Before' })).json.product as Product;
    await add(b, { productId: p.id });
    const payload: RestorePayload = {
      products: [
        {
          ...emptyProductInput(),
          name: 'Restored',
          archived: false,
          createdAt: 1_700_000_000_000,
          smokes: [
            { date: '2026-09-01', time: '20:00', amount: 0.5, effect: 'Calm', createdAt: 1_700_000_000_001 },
            { date: '2026-09-02', time: '21:00', amount: null, effect: null, createdAt: 1_700_000_000_002 },
          ],
        },
      ],
      logEntries: [{ ...emptyLogEntryInput(), name: 'Restored Entry', createdAt: 1_700_000_000_000, smokes: [{ date: '2026-09-03', time: '07:30', amount: 10, effect: null, createdAt: 1_700_000_000_003 }] }],
    };
    const res = await b.post('/api/data/restore', payload);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.smokes).toBe(3);
    const [product] = (await b.get('/api/products')).json.products as Product[];
    const [e] = (await b.get('/api/log')).json.entries as LogEntry[];
    expect((await list(b)).map((s) => [s.date, s.time, s.amount, s.effect, s.productId ?? s.logEntryId, s.createdAt])).toEqual([
      ['2026-09-03', '07:30', 10, null, e!.id, 1_700_000_000_003],
      ['2026-09-02', '21:00', null, null, product!.id, 1_700_000_000_002],
      ['2026-09-01', '20:00', 0.5, 'Calm', product!.id, 1_700_000_000_001],
    ]);

    // A file from before 0.36.0: no smokes anywhere.
    const old = await b.post('/api/data/restore', { products: [{ ...emptyProductInput(), name: 'Old', archived: false, createdAt: 1_600_000_000_000 }], logEntries: [] });
    expect(old.status).toBe(200);
    expect(await list(b)).toEqual([]);
  });

  it('a bad smoke stops the whole restore, before anything changes', async () => {
    const b = new Browser();
    await signUp(b);
    const p = (await b.post('/api/products', { ...emptyProductInput(), name: 'Keep' })).json.product as Product;
    await add(b, { productId: p.id });
    const res = await b.post('/api/data/restore', {
      products: [{ ...emptyProductInput(), name: 'X', archived: false, createdAt: 1, smokes: [{ date: 'nope', time: '20:00', amount: null, effect: null, createdAt: 1 }] }],
      logEntries: [],
    });
    expect(res.status).toBe(400);
    expect(res.json.message).toBe('Product 1 (“X”): a smoke: Choose a date.');
    expect(await list(b)).toHaveLength(1);
  });
});
