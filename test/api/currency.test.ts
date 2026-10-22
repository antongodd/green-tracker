import { describe, expect, inject, it } from 'vitest';
import type { RestoreProduct } from '../../shared/domain/backup';
import { emptyProductInput, type Product, type PurchaseInput } from '../../shared/domain/product';
import { Browser, signUp } from './client';
import { d1 } from './store';

// Currencies (D66, 0.56.0). Rates come from the stand-in service (test/fxStub.mjs): per euro,
// GBP 0.85 + day/1000, USD 1.10 + day/1000, working days only; any day in 2001 fails.

const fxCalls = async () => ((await (await fetch(`${inject('fxBase')}/calls`)).json()) as { calls: number }).calls;
const gbpPerEur = (day: number) => 0.85 + day / 1000;
const usdPerEur = (day: number) => 1.1 + day / 1000;

const buy = (over: Partial<PurchaseInput>): PurchaseInput => ({ date: '2026-10-20', amount: 3.5, totalPaid: 40, supplier: null, ...over });
async function product(b: Browser, purchases: PurchaseInput[], name = 'Haze') {
  const r = await b.post('/api/products', { ...emptyProductInput(), name, ratings: { look: 8 }, purchases });
  return r as { status: number; json: { product: Product; message?: string } };
}
const restoreProduct = (over: Partial<RestoreProduct>): RestoreProduct => ({ ...emptyProductInput(), name: 'X', archived: false, createdAt: 1_700_000_000_000, ...over });

describe('purchases in other currencies (D66)', () => {
  it('everyone starts on £; a purchase keeps its currency and the rate it was saved with', async () => {
    const b = new Browser();
    await signUp(b);
    expect((await b.get('/api/auth/me')).json.currency).toBe('GBP');
    expect((await new Browser().get('/api/auth/me')).json).not.toHaveProperty('currency');
    const r = await product(b, [
      buy({ totalPaid: 30 }), // no currency: the main one
      buy({ currency: 'EUR', rate: 0.86, date: '2026-10-21' }),
      buy({ currency: 'GBP', rate: 2, date: '2026-10-01' }), // the main one is always 1
    ]);
    expect(r.status).toBe(201);
    const [a, eur, gbp] = [...r.json.product.purchases].sort((x, y) => x.seq - y.seq);
    expect(a).toMatchObject({ totalPaid: 30, currency: 'GBP', rate: 1 });
    expect(eur).toMatchObject({ totalPaid: 40, currency: 'EUR', rate: 0.86 });
    expect(gbp).toMatchObject({ currency: 'GBP', rate: 1 });
  });

  it('refuses a purchase in another currency without a rate, an unknown currency and a bad rate', async () => {
    const b = new Browser();
    await signUp(b);
    const noRate = await product(b, [buy({ currency: 'EUR' })]);
    expect(noRate.status).toBe(400);
    expect(noRate.json.message).toBe('A purchase in € needs an exchange rate.');
    expect((await product(b, [buy({ currency: 'XYZ', rate: 1 })])).status).toBe(400);
    for (const rate of [0, -1, 'a', 1e9]) expect((await product(b, [buy({ currency: 'EUR', rate: rate as number })])).status, String(rate)).toBe(400);
    expect((await b.get('/api/products')).json.products).toEqual([]);
  });

  it('never reaches followers: a friend’s board has no currencies or rates', async () => {
    const owner = new Browser();
    const fan = new Browser();
    const ownerName = (await signUp(owner)).username;
    const fanName = (await signUp(fan)).username;
    await product(owner, [buy({ currency: 'EUR', rate: 0.86 })], 'Shown Abroad');
    await fan.post(`/api/people/u/${ownerName}/follow`);
    expect((await owner.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
    const board = await fan.get(`/api/people/u/${ownerName}/products`);
    expect(board.status).toBe(200);
    expect(JSON.stringify(board.json)).toContain('Shown Abroad');
    expect(JSON.stringify(board.json)).not.toMatch(/"currency"|"rate"|0\.86|EUR/);
  });
});

describe('exchange rates (D66)', () => {
  it('the rate for a day, the working day before for a weekend, between any two currencies; kept once fetched', async () => {
    const b = new Browser();
    await signUp(b);
    const rate = async (q: string) => (await b.get(`/api/money/rate?${q}`)).json;
    expect(await rate('from=EUR&to=GBP&date=2026-09-15')).toEqual({ rate: gbpPerEur(15), day: '2026-09-15' });
    // A Sunday: Friday's rate.
    expect((await rate('from=EUR&to=GBP&date=2026-09-13')).rate).toBeCloseTo(gbpPerEur(11), 12);
    expect((await rate('from=GBP&to=EUR&date=2026-09-15')).rate).toBeCloseTo(1 / gbpPerEur(15), 12);
    expect((await rate('from=USD&to=GBP&date=2026-09-15')).rate).toBeCloseTo(gbpPerEur(15) / usdPerEur(15), 12);
    expect((await rate('from=GBP&to=GBP&date=2026-09-15')).rate).toBe(1);
    // Kept: asking again doesn't ask the service.
    const before = await fxCalls();
    expect((await rate('from=USD&to=GBP&date=2026-09-15')).rate).toBeCloseTo(gbpPerEur(15) / usdPerEur(15), 12);
    expect(await fxCalls()).toBe(before);
    expect(d1('SELECT per_eur FROM fx_rates WHERE day = ? AND currency = ?', '2026-09-15', 'GBP')).toEqual([{ per_eur: gbpPerEur(15) }]);
    // No date, or a future one: today.
    expect((await b.get('/api/money/rate?from=EUR&to=GBP')).status).toBe(200);
    expect((await rate('from=EUR&to=GBP&date=2999-01-01')).day).toBe(new Date().toISOString().slice(0, 10));
  });

  it('says so when the service can’t answer; refuses what it can’t read; only for someone signed in', async () => {
    const b = new Browser();
    await signUp(b);
    const down = await b.get('/api/money/rate?from=EUR&to=GBP&date=2001-05-02');
    expect(down.status).toBe(503);
    expect(down.json.message).toBe('Couldn’t get the exchange rate just now. Type it in instead.');
    expect((await b.get('/api/money/rate?from=XYZ&to=GBP')).status).toBe(400);
    expect((await b.get('/api/money/rate?from=EUR&to=GBP&date=2026-02-30')).status).toBe(400);
    expect((await new Browser().get('/api/money/rate?from=EUR&to=GBP')).status).toBe(401);
  });

  it('asks again without the ECB choice should the service refuse it', async () => {
    const b = new Browser();
    await signUp(b);
    const r = await b.get('/api/money/rate?from=ZAR&to=GBP&date=2026-09-15');
    expect(r.status).toBe(200);
    expect(r.json.rate).toBeCloseTo(gbpPerEur(15) / (2 + 15 / 1000), 12);
  });
});

describe('your main currency (D66)', () => {
  it('changing it works every purchase out again at its day’s rate; typed rates are replaced', async () => {
    const b = new Browser();
    await signUp(b);
    const p = (
      await product(b, [
        buy({ totalPaid: 30, date: '2026-09-15' }), // £
        buy({ currency: 'EUR', rate: 0.5, date: '2026-09-16' }), // a typed rate
        buy({ currency: 'USD', rate: 0.75, date: '2026-09-17' }),
      ])
    ).json.product;
    expect((await b.req('PUT', '/api/money', { currency: 'EUR' })).json).toEqual({ currency: 'EUR' });
    expect((await b.get('/api/auth/me')).json.currency).toBe('EUR');
    const after = (await b.get(`/api/products/${p.id}`)).json.product as Product;
    const by = (c: string) => after.purchases.find((x) => x.currency === c)!;
    expect(by('GBP').rate).toBeCloseTo(1 / gbpPerEur(15), 12);
    expect(by('EUR').rate).toBe(1);
    expect(by('USD').rate).toBeCloseTo(1 / usdPerEur(17), 12);
    // A new purchase in the main currency needs no rate; one in £ now does.
    expect((await product(b, [buy({})])).json.product.purchases[0]).toMatchObject({ currency: 'EUR', rate: 1 });
    expect((await product(b, [buy({ currency: 'GBP' })])).status).toBe(400);
    // And back: the € purchase gets its day's rate, not the one typed at first.
    expect((await b.req('PUT', '/api/money', { currency: 'GBP' })).status).toBe(200);
    const back = (await b.get(`/api/products/${p.id}`)).json.product as Product;
    expect(back.purchases.find((x) => x.currency === 'GBP')!.rate).toBe(1);
    expect(back.purchases.find((x) => x.currency === 'EUR')!.rate).toBeCloseTo(gbpPerEur(16), 12);
  });

  it('nothing changes when a rate can’t be had; refuses an unknown currency; yours only', async () => {
    const b = new Browser();
    await signUp(b);
    const p = (await product(b, [buy({ totalPaid: 10, date: '2001-05-02' })])).json.product;
    const r = await b.req('PUT', '/api/money', { currency: 'EUR' });
    expect(r.status).toBe(503);
    expect(r.json.message).toBe('Couldn’t get the exchange rates just now, so nothing has changed. Please try again later.');
    expect((await b.get('/api/auth/me')).json.currency).toBe('GBP');
    expect((await b.get(`/api/products/${p.id}`)).json.product.purchases[0]).toMatchObject({ currency: 'GBP', rate: 1 });
    expect((await b.req('PUT', '/api/money', { currency: 'XYZ' })).status).toBe(400);
    expect((await b.req('PUT', '/api/money', {})).status).toBe(400);
    expect((await new Browser().req('PUT', '/api/money', { currency: 'EUR' })).status).toBe(401);
  });
});

describe('restore with currencies (D66)', () => {
  it('a file from before 0.56.0 is all £: its purchases get their day’s rate into your main currency', async () => {
    const b = new Browser();
    await signUp(b);
    await b.req('PUT', '/api/money', { currency: 'EUR' });
    const res = await b.post('/api/data/restore', {
      products: [restoreProduct({ name: 'Old File', purchases: [{ date: '2026-09-15', amount: 1, totalPaid: 10, supplier: null }] })],
      logEntries: [],
    });
    expect(res.status).toBe(200);
    const [p] = (await b.get('/api/products')).json.products as Product[];
    expect(p!.purchases[0]).toMatchObject({ currency: 'GBP', totalPaid: 10 });
    expect(p!.purchases[0]!.rate).toBeCloseTo(1 / gbpPerEur(15), 12);
    expect((await b.get('/api/auth/me')).json.currency).toBe('EUR');
  });

  it('a file’s main currency and rates come back as they were', async () => {
    const b = new Browser();
    await signUp(b);
    const res = await b.post('/api/data/restore', {
      products: [
        restoreProduct({
          name: 'New File',
          purchases: [
            { date: '2026-09-15', amount: 1, totalPaid: 10, supplier: null, currency: 'EUR', rate: 1.2 },
            { date: '2026-09-16', amount: 1, totalPaid: 12, supplier: null, currency: 'USD', rate: 1 },
          ],
        }),
      ],
      logEntries: [],
      money: { currency: 'USD' },
    });
    expect(res.status).toBe(200);
    expect((await b.get('/api/auth/me')).json.currency).toBe('USD');
    const [p] = (await b.get('/api/products')).json.products as Product[];
    const sorted = [...p!.purchases].sort((x, y) => x.seq - y.seq);
    expect(sorted.map((x) => [x.currency, x.rate])).toEqual([
      ['EUR', 1.2],
      ['USD', 1],
    ]);
  });

  it('a restore that needs a rate the service can’t give changes nothing', async () => {
    const b = new Browser();
    await signUp(b);
    await product(b, [buy({ totalPaid: 7 })], 'Still Here');
    await b.req('PUT', '/api/money', { currency: 'EUR' });
    const res = await b.post('/api/data/restore', {
      products: [restoreProduct({ name: 'Old File', purchases: [{ date: '2001-05-02', amount: 1, totalPaid: 10, supplier: null }] })],
      logEntries: [],
    });
    expect(res.status).toBe(503);
    expect(((await b.get('/api/products')).json.products as Product[]).map((x) => x.name)).toEqual(['Still Here']);
    expect((await b.post('/api/data/restore', { products: [], logEntries: [], money: { currency: 'XYZ' } })).status).toBe(400);
  });
});
