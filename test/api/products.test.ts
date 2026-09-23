import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import { Browser, signUp } from './client';

const input = (over: Partial<ProductInput> = {}): ProductInput => ({ ...emptyProductInput(), name: 'Gelato 41', ...over });

async function create(b: Browser, over: Partial<ProductInput> = {}): Promise<Product> {
  const res = await b.post('/api/products', input(over));
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return res.json.product;
}
const put = (b: Browser, id: string, body: ProductInput) => b.req('PUT', `/api/products/${id}`, body);

let me: Browser;
beforeAll(async () => {
  me = new Browser();
  await signUp(me);
});

describe('products', () => {
  it('creates a product with the brief’s defaults', async () => {
    const p = await create(me);
    expect(p).toMatchObject({
      name: 'Gelato 41',
      productType: 'flower',
      concentrateType: 'hash',
      strainType: null,
      dateTried: null,
      private: false,
      archived: false,
      ratings: {},
      purchases: [],
    });
  });

  it('auto-capitalises name, Source and supplier (only ever adding capitals)', async () => {
    const p = await create(me, {
      name: '  pineapple eXpress ',
      source: 'o’shea farms',
      purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 10, supplier: 'the corner shop' }],
    });
    expect(p.name).toBe('Pineapple EXpress');
    expect(p.source).toBe('O’shea Farms');
    expect(p.purchases[0]!.supplier).toBe('The Corner Shop');
  });

  it('switching type keeps ratings and concentrate type, hidden but stored (Do not reopen)', async () => {
    const p = await create(me, {
      productType: 'concentrate',
      concentrateType: 'live_rosin',
      ratings: { look: 8, consistency: 9, smell: 7.5, taste: 8.2, burn: 6, high: 9 },
    });
    // The edibles editor shows only Taste and High, so only those are sent.
    let res = await put(me, p.id, input({ productType: 'edibles', concentrateType: 'live_rosin', ratings: { taste: 6, high: 9 } }));
    expect(res.json.product.ratings).toEqual({ look: 8, consistency: 9, smell: 7.5, taste: 6, burn: 6, high: 9 });
    res = await put(me, p.id, input({ productType: 'concentrate', concentrateType: 'live_rosin', ratings: {} }));
    expect(res.json.product).toMatchObject({ concentrateType: 'live_rosin', ratings: { look: 8, consistency: 9, smell: 7.5, taste: 6, burn: 6, high: 9 } });
  });

  it('clears a rating back to unrated', async () => {
    const p = await create(me, { ratings: { look: 8, smell: 7 } });
    const res = await put(me, p.id, input({ ratings: { look: null, smell: 7 } }));
    expect(res.json.product.ratings).toEqual({ smell: 7 });
  });

  it('keeps edited purchases in entry order, adds new ones after, and drops ones with no total paid', async () => {
    const p = await create(me, {
      purchases: [
        { date: '2026-07-02', amount: 7, totalPaid: 18, supplier: null },
        { date: '2026-09-14', amount: 3.5, totalPaid: 10, supplier: null },
      ],
    });
    const [first, second] = p.purchases;
    expect([first!.seq, second!.seq]).toEqual([1, 2]);
    const res = await put(
      me,
      p.id,
      input({
        purchases: [
          { id: second!.id, date: '2026-09-14', amount: 3.5, totalPaid: 9.5, supplier: null },
          { date: '2026-09-20', amount: null, totalPaid: 5, supplier: null },
          { date: '2026-09-21', amount: 1, totalPaid: null, supplier: 'Discarded' },
        ],
      }),
    );
    const list = res.json.product.purchases as Product['purchases'];
    expect(list.map((x) => [x.seq, x.totalPaid, x.amount])).toEqual([
      [2, 9.5, 3.5],
      [3, 5, null],
    ]);
    expect(list[0]!.id).toBe(second!.id);
  });

  it('archives and un-archives; lists split by archive state', async () => {
    const b = new Browser();
    await signUp(b);
    const keep = await create(b, { name: 'Keep' });
    const gone = await create(b, { name: 'Gone' });
    expect((await b.post(`/api/products/${gone.id}/archived`, { value: true })).json.product.archived).toBe(true);
    expect((await b.get('/api/products')).json.products.map((p: Product) => p.id)).toEqual([keep.id]);
    expect((await b.get('/api/products?archived=1')).json.products.map((p: Product) => p.id)).toEqual([gone.id]);
    await b.post(`/api/products/${gone.id}/archived`, { value: false });
    expect((await b.get('/api/products')).json.products).toHaveLength(2);
  });

  it('private is off by default and saved by the switch', async () => {
    const p = await create(me);
    const res = await me.post(`/api/products/${p.id}/private`, { value: true });
    expect(res.json.product.private).toBe(true);
    expect((await me.get(`/api/products/${p.id}`)).json.product.private).toBe(true);
  });

  it('stores the Leafly link exactly as typed', async () => {
    const p = await create(me, { leaflyLink: 'leafly.com/strains/gelato-41' });
    expect(p.leaflyLink).toBe('leafly.com/strains/gelato-41');
  });

  it('keeps hit time as stored when the type moves away from Edibles', async () => {
    const p = await create(me, { productType: 'edibles', hitTimeMinutes: 75 });
    const res = await put(me, p.id, input({ productType: 'flower', hitTimeMinutes: 75 }));
    expect(res.json.product.hitTimeMinutes).toBe(75);
  });
});

describe('validation', () => {
  it.each<[string, Partial<ProductInput> | Record<string, unknown>, string]>([
    ['blank name', { name: '   ' }, 'Give the product a name.'],
    ['rating above 10', { ratings: { look: 10.5 } }, 'Ratings go from 1 to 10.'],
    ['rating below 1', { ratings: { look: 0 } }, 'Ratings go from 1 to 10.'],
    ['unknown category', { ratings: { vibes: 5 } as never }, 'Unknown rating category.'],
    ['hit time off-step', { hitTimeMinutes: 20 }, 'Hit time must be 0–3 hours in 15-minute steps.'],
    ['hit time over 3h', { hitTimeMinutes: 195 }, 'Hit time must be 0–3 hours in 15-minute steps.'],
    ['bad date', { dateTried: '2026-02-30' }, 'Date tried isn’t a valid date.'],
    ['unknown type', { productType: 'tincture' as never }, 'Choose a product type from the list.'],
    ['unknown country', { country: 'XX' }, 'Choose a country from the list.'],
    ['zero amount', { purchases: [{ date: null, amount: 0, totalPaid: 5, supplier: null }] }, 'Amount must be more than 0.'],
  ])('rejects %s', async (_, over, message) => {
    const res = await me.post('/api/products', input(over as Partial<ProductInput>));
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: 'invalid_product', message });
  });

  it('accepts decimals and the Other pattern', async () => {
    const p = await create(me, { ratings: { look: 7.3 }, productType: 'other', productTypeOther: 'Tincture', country: 'OTHER', countryOther: 'Atlantis' });
    expect(p).toMatchObject({ ratings: { look: 7.3 }, productTypeOther: 'Tincture', countryOther: 'Atlantis' });
  });
});

describe('privacy: one user can never read or write another’s products (§17)', () => {
  it('treats someone else’s product ID as missing, for every route', async () => {
    const victim = new Browser();
    await signUp(victim);
    const secret = await create(victim, { name: 'Victim’s product', notes: 'private notes', ratings: { look: 9 } });
    const attacker = new Browser();
    await signUp(attacker);

    for (const res of [
      await attacker.get(`/api/products/${secret.id}`),
      await put(attacker, secret.id, input({ name: 'Hijacked', ratings: { look: 1 } })),
      await attacker.post(`/api/products/${secret.id}/archived`, { value: true }),
      await attacker.post(`/api/products/${secret.id}/private`, { value: true }),
    ]) {
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.json)).not.toContain('Victim');
    }
    expect((await attacker.get('/api/products')).json.products).toEqual([]);
    const still = (await victim.get(`/api/products/${secret.id}`)).json.product;
    expect(still).toMatchObject({ name: 'Victim’s Product', ratings: { look: 9 }, archived: false, private: false });
  });

  it('requires sign-in', async () => {
    expect((await new Browser().get('/api/products')).status).toBe(401);
  });
});
