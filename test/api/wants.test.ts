import { beforeAll, describe, expect, it } from 'vitest';
import { emptyLogEntryInput, type LogEntry } from '../../shared/domain/logEntry';
import { emptyProductInput, productToInput, type Product, type ProductInput } from '../../shared/domain/product';
import type { Want } from '../../shared/domain/wants';
import { Browser, signUp } from './client';
import { d1, userId } from './store';

// Strainz (D92, 0.81.0): the Want to try lists (strains and sources, private), ticked off by a saved product, and
// renaming a strain.

let me: Browser, fan: Browser;
let myName: string, fanName: string;

const product = async (b: Browser, name: string, over: Partial<ProductInput> = {}) => {
  const r = await b.post('/api/products', { ...emptyProductInput(), name, ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json as { product: Product; tickedOff: { kind: string; name: string }[] };
};
const want = (b: Browser, kind: string, name: string, note?: string | null) => b.post('/api/wants', { kind, name, ...(note !== undefined ? { note } : {}) });
const list = async (b: Browser) => (await b.get('/api/wants')).json.wants as Want[];
const names = async (b: Browser) => (await list(b)).map((w) => `${w.kind}:${w.name}`).sort();

beforeAll(async () => {
  me = new Browser();
  fan = new Browser();
  myName = (await signUp(me)).username;
  fanName = (await signUp(fan)).username;
  // The fan follows me, approved: still sees nothing of my lists.
  await fan.post(`/api/people/u/${myName}/follow`);
  await me.post(`/api/people/requests/${fanName}/approve`);
});

describe('Want to try lists (D92)', () => {
  it('adds a strain and a source, newest first, with notes; the name is capitalised like a product’s', async () => {
    const a = await want(me, 'strain', '  runtz ', 'Heard about it from Drew');
    expect(a.status, JSON.stringify(a.json)).toBe(201);
    expect(a.json.want).toMatchObject({ kind: 'strain', name: 'Runtz', note: 'Heard about it from Drew' });
    await new Promise((r) => setTimeout(r, 5));
    expect((await want(me, 'source', 'Cloud Nine', '   ')).json.want).toMatchObject({ kind: 'source', name: 'Cloud Nine', note: null });
    const l = await list(me);
    expect(l.map((w) => w.name)).toEqual(['Cloud Nine', 'Runtz']);
  });

  it('the same name twice on a list is refused (capitals and spaces don’t count); the other list can have it', async () => {
    const again = await want(me, 'strain', 'RUN TZ');
    expect(again.status).toBe(409);
    expect(again.json.message).toBe('RUN TZ is already on your list.');
    expect((await want(me, 'source', 'Runtz')).status).toBe(201);
    expect(await names(me)).toEqual(['source:Cloud Nine', 'source:Runtz', 'strain:Runtz']);
  });

  it('checks what it’s given', async () => {
    for (const [body, message] of [
      [{ kind: 'strain', name: '   ' }, 'Give the strain a name.'],
      [{ kind: 'source', name: '' }, 'Give the source a name.'],
      [{ kind: 'strain', name: 'x'.repeat(101) }, 'Keep the name to 100 characters.'],
      [{ kind: 'strain', name: 'Ok', note: 'n'.repeat(201) }, 'Keep the note to 200 characters.'],
      [{ kind: 'brand', name: 'Ok' }, 'That couldn’t be read.'],
    ] as const) {
      const r = await me.post('/api/wants', body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.message).toBe(message);
    }
  });

  it('private: nobody else can read or remove them, followers included, and nothing of them reaches a follower', async () => {
    const mine = await list(me);
    expect(await list(fan)).toEqual([]);
    const r = await fan.del(`/api/wants/${mine[0]!.id}`);
    expect(r.status).toBe(404);
    expect(await list(me)).toHaveLength(mine.length);
    // Every follower reply about me: none mentions a want.
    for (const path of [`/api/people/u/${myName}`, `/api/people/u/${myName}/products`, `/api/people/u/${myName}/compare`]) {
      const res = await fan.get(path);
      expect(JSON.stringify(res.json), path).not.toMatch(/Cloud Nine|Heard about it/);
    }
    expect((await new Browser().get('/api/wants')).status).toBe(401);
  });

  it('Remove takes one off', async () => {
    const r = (await list(me)).find((w) => w.kind === 'source' && w.name === 'Runtz')!;
    expect((await me.del(`/api/wants/${r.id}`)).status).toBe(200);
    expect((await me.del(`/api/wants/${r.id}`)).status).toBe(404);
    expect(await names(me)).toEqual(['source:Cloud Nine', 'strain:Runtz']);
  });

  it('a product with the name ticks the strain off; from the source or bought there ticks the source off', async () => {
    // Not yet: another strain, another source.
    expect((await product(me, 'Runtz Cake', { source: 'Cloud Ten' })).tickedOff).toEqual([]);
    const saved = await product(me, 'runtz', { purchases: [{ date: '2026-11-01', amount: 1, totalPaid: 12, supplier: 'cloud nine' }] });
    expect([...saved.tickedOff].sort((x, y) => x.kind.localeCompare(y.kind))).toEqual([
      { kind: 'source', name: 'Cloud Nine' },
      { kind: 'strain', name: 'Runtz' },
    ]);
    expect(await list(me)).toEqual([]);
  });

  it('editing a product into the name ticks it off too, and so does adding a Log entry to the Leaderboard', async () => {
    await want(me, 'strain', 'Gelato 41');
    await want(me, 'source', 'Kush Co');
    const p = (await product(me, 'Gelato')).product;
    const edited = await me.put(`/api/products/${p.id}`, { ...productToInput(p), name: 'Gelato 41' });
    expect(edited.status).toBe(200);
    expect(edited.json.tickedOff).toEqual([{ kind: 'strain', name: 'Gelato 41' }]);
    const entry = (await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Something' })).json.entry as LogEntry;
    const promoted = await me.post(`/api/log/${entry.id}/promote`, { ...emptyProductInput(), name: 'Something', source: 'KUSH CO' });
    expect(promoted.status).toBe(201);
    expect(promoted.json.tickedOff).toEqual([{ kind: 'source', name: 'Kush Co' }]);
    expect(await list(me)).toEqual([]);
  });

  it('a product that isn’t saved ticks nothing off', async () => {
    await want(me, 'strain', 'Lemon Cherry Gelato');
    const r = await me.post('/api/products', { ...emptyProductInput(), name: 'Lemon Cherry Gelato', ratings: { look: 99 } });
    expect(r.status).toBe(400);
    expect(await names(me)).toEqual(['strain:Lemon Cherry Gelato']);
  });

  it('go with the account', async () => {
    const b = new Browser();
    const { username: name } = await signUp(b);
    await want(b, 'strain', 'Gone');
    const id = userId(name)!;
    expect(d1('SELECT COUNT(*) AS n FROM wants WHERE user_id = ?', id)[0]).toEqual({ n: 1 });
    expect((await b.post('/api/data/delete', { username: name, password: 'correct horse battery' })).status).toBe(200);
    expect(d1('SELECT COUNT(*) AS n FROM wants WHERE user_id = ?', id)[0]).toEqual({ n: 0 });
  });
});

describe('Restore and the lists (D92)', () => {
  it('a file with lists replaces yours (the same name twice kept once); one without leaves yours', async () => {
    const b = new Browser();
    await signUp(b);
    await want(b, 'strain', 'Old One');
    const without = await b.post('/api/data/restore', { products: [], logEntries: [] });
    expect(without.status, JSON.stringify(without.json)).toBe(200);
    expect(without.json.wants).toBe('kept');
    expect(await names(b)).toEqual(['strain:Old One']);
    const r = await b.post('/api/data/restore', {
      products: [],
      logEntries: [],
      wants: [
        { kind: 'strain', name: 'Runtz', note: 'From Drew', createdAt: 1_700_000_000_000 },
        { kind: 'strain', name: 'runtz', note: null, createdAt: 1_700_000_000_001 },
        { kind: 'source', name: 'Cloud Nine', note: null, createdAt: 1_700_000_000_002 },
      ],
    });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.wants).toBe(2);
    const l = await list(b);
    expect(l.map((w) => [w.kind, w.name, w.note, w.createdAt])).toEqual([
      ['source', 'Cloud Nine', null, 1_700_000_000_002],
      ['strain', 'Runtz', 'From Drew', 1_700_000_000_000],
    ]);
    const bad = await b.post('/api/data/restore', { products: [], logEntries: [], wants: [{ kind: 'strain', name: '', createdAt: 1 }] });
    expect(bad.status).toBe(400);
    expect(bad.json.message).toBe('The Want to try lists couldn’t be read.');
  });
});

describe('Rename a strain (D92)', () => {
  it('renames every product and Log entry with the name (archived and returned ones too), joining strains', async () => {
    const b = new Browser();
    await signUp(b);
    const one = (await product(b, 'Zkittles')).product;
    const two = (await product(b, 'zkittles ')).product;
    await b.post(`/api/products/${two.id}/archived`, { value: true });
    const other = (await product(b, 'Cookies Zkittles')).product;
    const entry = (await b.post('/api/log', { ...emptyLogEntryInput(), name: 'ZKITTLES' })).json.entry as LogEntry;
    await want(b, 'strain', 'Zkittlez');
    const r = await b.post('/api/products/rename-strain', { from: 'Zkittles', to: ' zkittlez' });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toEqual({ name: 'Zkittlez', products: 2, logEntries: 1, tickedOff: [{ kind: 'strain', name: 'Zkittlez' }] });
    expect((await b.get(`/api/products/${one.id}`)).json.product.name).toBe('Zkittlez');
    expect((await b.get(`/api/products/${two.id}`)).json.product.name).toBe('Zkittlez');
    expect((await b.get(`/api/products/${other.id}`)).json.product.name).toBe('Cookies Zkittles');
    expect((await b.get(`/api/log/${entry.id}`)).json.entry.name).toBe('Zkittlez');
  });

  it('only your own, and only a name you have', async () => {
    const b = new Browser();
    await signUp(b);
    await product(b, 'Mine');
    expect((await me.post('/api/products/rename-strain', { from: 'Mine', to: 'Theirs' })).status).toBe(404);
    expect((await b.post('/api/products/rename-strain', { from: 'Mine', to: '  ' })).json.message).toBe('Give the strain a name.');
    expect((await b.post('/api/products/rename-strain', { from: 'Mine', to: 'x'.repeat(101) })).status).toBe(400);
    expect((await b.get('/api/products')).json.products.map((p: Product) => p.name)).toEqual(['Mine']);
  });
});
