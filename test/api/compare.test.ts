import { beforeAll, describe, expect, it } from 'vitest';
import type { Comparison } from '../../shared/domain/compare';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import { DEFAULT_PRIVACY, type Privacy } from '../../shared/domain/privacy';
import { POST_ABOUT_KEYS, type Post } from '../../shared/domain/posts';
import { overall } from '../../shared/domain/ratings';
import { Browser, signUp, uniqueName } from './client';

// You against them (D82): "You've had this too" and Compare boards. Every check reads the raw reply
// the viewer's phone gets: nothing the friend doesn't share (private, archived, returned to the Log,
// Source when off, prices, suppliers, notes, dates) may be in it, and only the same product
// (name AND Source AND type) ever counts.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;

let mira: Browser, me: Browser, stranger: Browser, pending: Browser;
let miraName: string, meName: string;
const theirs = {} as Record<'gelato' | 'otherBrand' | 'rosin' | 'blue' | 'private' | 'archived' | 'kept', Product>;
const mine = {} as Record<'gelato' | 'hash' | 'haze' | 'faithful' | 'kush' | 'blue', Product>;

async function make(b: Browser, over: Partial<ProductInput>): Promise<Product> {
  const r = await b.post('/api/products', { ...emptyProductInput(), ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.product;
}
const secret = { purchases: [{ date: '2026-10-01', amount: 3.5, totalPaid: 987.65, supplier: 'Hidden Shop Ltd' }], notes: 'Secret note words' };
const setPrivacy = async (over: Partial<Privacy>) => expect((await mira.req('PUT', '/api/privacy', { ...DEFAULT_PRIVACY, ...over })).status).toBe(200);
const page = async (id: string, b = me) => b.get(`/api/people/u/${miraName}/products/${id}`);
const compare = async (b = me) => {
  const r = await b.get(`/api/people/u/${miraName}/compare`);
  return { status: r.status, raw: JSON.stringify(r.json), c: r.json.comparison as Comparison };
};
/** Never anything Mira keeps to herself. */
const NEVER = ['Secret Haze', 'Old Faithful', 'Gone Kush', 'Hidden Shop', '987', 'Secret note', '2026-10-01', 'dateTried', 'purchases', 'supplier'];

beforeAll(async () => {
  [mira, me, stranger, pending] = [new Browser(), new Browser(), new Browser(), new Browser()];
  miraName = (await signUp(mira, uniqueName('cmira'))).username;
  meName = (await signUp(me, uniqueName('cme'))).username;
  await signUp(stranger, uniqueName('cstr'));
  await signUp(pending, uniqueName('cpen'));
  await me.post(`/api/people/u/${miraName}/follow`);
  expect((await mira.post(`/api/people/requests/${meName}/approve`)).status).toBe(200);
  await pending.post(`/api/people/u/${miraName}/follow`);

  // Mira's board.
  theirs.gelato = await make(mira, { name: 'Lemon Gelato', source: 'Cloud Nine Farms', ratings: { look: 8, smell: 8, taste: 8, burn: 8 }, ...secret });
  theirs.otherBrand = await make(mira, { name: 'Lemon Gelato', source: 'Somebody Else', ratings: { look: 6, smell: 6, taste: 6, burn: 6 } });
  theirs.rosin = await make(mira, { name: 'Cherry Frost', productType: 'concentrate', concentrateType: 'rosin', source: 'Copper Hill', ratings: { look: 9, consistency: 9, smell: 9, taste: 9, burn: 9 } });
  theirs.blue = await make(mira, { name: 'Blue Lagoon', source: 'Moonbay', ratings: { look: 9.5, smell: 9.5, taste: 9.5, burn: 9.5 } });
  theirs.private = await make(mira, { name: 'Secret Haze', source: 'Cloud Nine Farms', ratings: { look: 10, smell: 10, taste: 10, burn: 10 } });
  expect((await mira.post(`/api/products/${theirs.private.id}/private`, { value: true })).status).toBe(200);
  theirs.archived = await make(mira, { name: 'Old Faithful', source: 'Moonbay', ratings: { look: 7, smell: 7, taste: 7, burn: 7 } });
  expect((await mira.post(`/api/products/${theirs.archived.id}/archived`, { value: true })).status).toBe(200);
  theirs.kept = await make(mira, { name: 'Gone Kush', source: 'Moonbay', ratings: { look: 7, smell: 7, taste: 7, burn: 7 } });
  expect((await mira.post(`/api/log/return/${theirs.kept.id}`)).status).toBe(201);

  // My board: the same product written differently (and private: only I see what's worked out from it).
  mine.gelato = await make(me, { name: 'lemon  GELATO', source: 'cloud nine farms!', ratings: { look: 9, smell: 9, taste: 9, burn: 9 } });
  expect((await me.post(`/api/products/${mine.gelato.id}/private`, { value: true })).status).toBe(200);
  mine.hash = await make(me, { name: 'Cherry Frost', productType: 'concentrate', concentrateType: 'hash', source: 'Copper Hill', ratings: { look: 7, consistency: 7, smell: 7, taste: 7, burn: 7 } });
  mine.haze = await make(me, { name: 'Secret Haze', source: 'Cloud Nine Farms', ratings: { look: 5, smell: 5, taste: 5, burn: 5 } });
  mine.faithful = await make(me, { name: 'Old Faithful', source: 'Moonbay', ratings: { look: 5, smell: 5, taste: 5, burn: 5 } });
  mine.kush = await make(me, { name: 'Gone Kush', source: 'Moonbay', ratings: { look: 5, smell: 5, taste: 5, burn: 5 } });
  // My Blue Lagoon is archived: it doesn't count as having it.
  mine.blue = await make(me, { name: 'Blue Lagoon', source: 'Moonbay', ratings: { look: 4, smell: 4, taste: 4, burn: 4 } });
  expect((await me.post(`/api/products/${mine.blue.id}/archived`, { value: true })).status).toBe(200);
});

describe("You've had this too (D82)", () => {
  it('shows your score on their page only for the same product: name, Source and type', async () => {
    const r = await page(theirs.gelato.id);
    expect(r.status).toBe(200);
    expect(r.json.yours).toEqual({ id: mine.gelato.id, score: overall('flower', mine.gelato.ratings) });
    // Same name, another brand: not the same product.
    expect((await page(theirs.otherBrand.id)).json.yours).toBeNull();
    // A concentrate of another kind (rosin against hash): not the same product.
    expect((await page(theirs.rosin.id)).json.yours).toBeNull();
    // My archived Blue Lagoon doesn't count.
    expect((await page(theirs.blue.id)).json.yours).toBeNull();
  });

  it('never opens a product they keep to themselves, even when you have the same one', async () => {
    for (const p of [theirs.private, theirs.archived, theirs.kept]) {
      const r = await page(p.id);
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.json)).not.toContain(p.name);
    }
  });

  it('shows nothing when their Source isn’t shared: the same name alone is never the same product', async () => {
    await setPrivacy({ shareSource: false });
    try {
      const r = await page(theirs.gelato.id);
      expect(r.json.yours).toBeNull();
      expect(JSON.stringify(r.json)).not.toContain('Cloud Nine Farms');
    } finally {
      await setPrivacy({});
    }
  });

  it('is never given to strangers or people still waiting to be approved', async () => {
    for (const b of [stranger, pending]) {
      const r = await page(theirs.gelato.id, b);
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.json)).not.toContain('yours');
    }
  });

  it('on a post’s product card: your score for you, nothing for the poster or for a product they don’t share', async () => {
    const upload = async (l: string) => ({ cropped: jpeg(`${l}-c`), thumb: jpeg(`${l}-t`) });
    const set = async (l: string) => (await mira.upload('/api/uploads', await upload(l))).json.upload as string;
    const about = async (product: string) => {
      const r = await mira.post('/api/posts', { caption: product, about: { product }, photo: { upload: await set(product) } });
      expect(r.status, JSON.stringify(r.json)).toBe(201);
      return r.json.post as Post;
    };
    const gelatoPost = await about(theirs.gelato.id);
    const otherPost = await about(theirs.otherBrand.id);
    const seen = async (b: Browser, id: string) => (await b.get(`/api/posts/${id}`)).json.post as Post;
    const card = (await seen(me, gelatoPost.id)).about!;
    expect(Object.keys(card).sort()).toEqual([...POST_ABOUT_KEYS].sort());
    expect(card.yours).toEqual({ id: mine.gelato.id, score: overall('flower', mine.gelato.ratings) });
    expect((await seen(me, otherPost.id)).about!.yours).toBeNull();
    // Mira's own view of her post: nothing (it's her product).
    expect((await seen(mira, gelatoPost.id)).about!.yours).toBeNull();
    // In the Feed too.
    const feed = (await me.get('/api/posts/feed')).json.posts as Post[];
    expect(feed.find((p) => p.id === gelatoPost.id)?.about?.yours?.id).toBe(mine.gelato.id);
    // Source off: no match, and the card has no Source.
    await setPrivacy({ shareSource: false });
    try {
      const off = (await seen(me, gelatoPost.id)).about!;
      expect(off.yours).toBeNull();
      expect(off.source).toBeNull();
    } finally {
      await setPrivacy({});
    }
    // Made private later: a plain card, no score.
    expect((await mira.post(`/api/products/${theirs.gelato.id}/private`, { value: true })).status).toBe(200);
    try {
      const plain = (await seen(me, gelatoPost.id)).about!;
      expect(plain.kind).toBe('plain');
      expect(plain.yours).toBeNull();
    } finally {
      expect((await mira.post(`/api/products/${theirs.gelato.id}/private`, { value: false })).status).toBe(200);
    }
  });
});

describe('Compare boards (D82)', () => {
  it('compares your board with what they share, and nothing more', async () => {
    const { status, raw, c } = await compare();
    expect(status).toBe(200);
    for (const word of NEVER) expect(raw).not.toContain(word);
    // Their side: the four shared products only.
    expect(c.them.products).toBe(4);
    expect(c.them.top).toMatchObject({ id: theirs.blue.id, name: 'Blue Lagoon', source: 'Moonbay' });
    expect(c.them.favouriteType).toBe('flower');
    expect(c.sourceShared).toBe(true);
    // Your side: your board as you see it (private counted, archived not).
    expect(c.you.products).toBe(5);
    expect(c.you.top?.id).toBe(mine.gelato.id);
    // The same product only: Lemon Gelato. Not Cherry Frost (another kind), not her private/archived/returned ones.
    expect(c.both).toHaveLength(1);
    expect(c.both[0]).toMatchObject({ name: 'Lemon Gelato', yours: { id: mine.gelato.id }, theirs: { id: theirs.gelato.id } });
    // Brands you've both tried: from shared products only (her Moonbay is Blue Lagoon alone).
    const names = c.brands.map((b) => b.name).sort();
    expect(names).toEqual(['Cloud Nine Farms', 'Copper Hill', 'Moonbay']);
    expect(c.brands.find((b) => b.name === 'Moonbay')!.them.products).toBe(1);
    expect(c.brands.find((b) => b.name === 'Cloud Nine Farms')!.them.products).toBe(1);
    // Their top picks you haven't tried: everything shared and rated but the Gelato you've had.
    expect(c.picks.map((p) => p.id)).toEqual([theirs.blue.id, theirs.rosin.id, theirs.otherBrand.id]);
  });

  it('with Source not shared: no brands, no "both had", and their picks are simply their best', async () => {
    await setPrivacy({ shareSource: false });
    try {
      const { raw, c } = await compare();
      for (const word of NEVER) expect(raw).not.toContain(word);
      // Her brands appear nowhere on her side (your own side is yours: your #1's brand may be the same words).
      const hers = JSON.stringify({ them: c.them, both: c.both, brands: c.brands, picks: c.picks });
      for (const word of ['Moonbay', 'Copper Hill', 'Cloud Nine Farms', 'Somebody Else']) expect(hers).not.toContain(word);
      expect(c.sourceShared).toBe(false);
      expect(c.both).toEqual([]);
      expect(c.brands).toEqual([]);
      expect(c.them.favouriteBrand).toBeNull();
      expect(c.picks.map((p) => p.id)).toEqual([theirs.blue.id, theirs.rosin.id, theirs.gelato.id, theirs.otherBrand.id]);
    } finally {
      await setPrivacy({});
    }
  });

  it('with their Leaderboard not shared: nothing of theirs at all', async () => {
    await setPrivacy({ shareBoard: false });
    try {
      const { status, raw, c } = await compare();
      expect(status).toBe(200);
      for (const word of [...NEVER, 'Blue Lagoon', 'Cherry Frost', 'Moonbay']) expect(raw).not.toContain(word);
      expect(c.them).toMatchObject({ products: 0, average: null, top: null, favouriteType: null, favouriteBrand: null });
      expect(c.both).toEqual([]);
      expect(c.brands).toEqual([]);
      expect(c.picks).toEqual([]);
    } finally {
      await setPrivacy({});
    }
  });

  it('is refused to strangers, people waiting for approval, and once you are blocked', async () => {
    for (const b of [stranger, pending]) expect((await compare(b)).status).toBe(403);
    expect((await new Browser().get(`/api/people/u/${miraName}/compare`)).status).toBe(401);
    const watcher = new Browser();
    const watcherName = (await signUp(watcher, uniqueName('cwat'))).username;
    await watcher.post(`/api/people/u/${miraName}/follow`);
    expect((await mira.post(`/api/people/requests/${watcherName}/approve`)).status).toBe(200);
    expect((await compare(watcher)).status).toBe(200);
    expect((await mira.post(`/api/people/u/${watcherName}/block`)).status).toBe(200);
    const r = await compare(watcher);
    expect(r.status).toBe(404);
    expect(r.raw).not.toContain('Blue Lagoon');
  });
});
