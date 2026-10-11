import { beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { DEFAULT_PRIVACY, type Privacy } from '../../shared/domain/privacy';
import { emptyProductInput } from '../../shared/domain/product';
import { Browser, signUp, uniqueName } from './client';

// D46 (0.39.0): Smokes is off on the live site until it's re-released. These run against a
// second server with SMOKES off: nothing about smokes can be added or changed and nothing
// reaches a follower, but everything already saved is kept (and still exported).

const EFFECT = 'OFF-SITE-EFFECT-5c';
const live = () => new Browser(undefined, inject('liveApiBase'));
let owner: Browser, fan: Browser;
let ownerName: string;
let productId: string;
let smokeId: string;

beforeAll(async () => {
  [owner, fan] = [live(), live()];
  ownerName = (await signUp(owner, uniqueName('off'))).username;
  const fanName = (await signUp(fan, uniqueName('offf'))).username;
  // Smokes saved before (here: arriving in a restore, which still works with Smokes off).
  const payload: RestorePayload = {
    products: [{ ...emptyProductInput(), name: 'Kept Kush', archived: false, createdAt: 1, smokes: [{ date: '2026-10-01', time: '20:00', amount: 0.3, effect: EFFECT, createdAt: 2 }] }],
    logEntries: [{ ...emptyLogEntryInput(), name: 'Kept Entry', createdAt: 3, smokes: [{ date: '2026-10-02', time: '21:00', amount: null, effect: null, createdAt: 4 }] }],
  };
  expect((await owner.post('/api/data/restore', payload)).status).toBe(200);
  const smokes = (await owner.get('/api/smokes')).json.smokes;
  productId = smokes.find((s: { productId: string | null }) => s.productId).productId;
  smokeId = smokes[0].id;
  await fan.post(`/api/people/u/${ownerName}/follow`);
  expect((await owner.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
  // Everything shared that could be: what applies is decided by the site, not just these.
  const all: Privacy = { ...DEFAULT_PRIVACY, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true };
  expect((await owner.req('PUT', '/api/privacy', all)).status).toBe(200);
});

describe('Smokes switched off (D46)', () => {
  it('the app is told which sites have Smokes, signed in or not', async () => {
    expect((await owner.get('/api/auth/me')).json.features).toEqual({ smokes: false });
    expect((await live().get('/api/auth/me')).json).toEqual({ user: null, features: { smokes: false } });
    expect((await new Browser().get('/api/auth/me')).json.features).toEqual({ smokes: true });
  });

  it('nothing can be added, changed or deleted', async () => {
    const add = await owner.post('/api/smokes', { productId, logEntryId: null, date: '2026-10-05', time: '20:00', amount: null, effect: null });
    expect(add.status).toBe(404);
    expect((await owner.req('PUT', `/api/smokes/${smokeId}`, { productId, logEntryId: null, date: '2026-10-05', time: '20:00', amount: null, effect: null })).status).toBe(404);
    expect((await owner.req('DELETE', `/api/smokes/${smokeId}`)).status).toBe(404);
    expect((await owner.get('/api/smokes')).json.smokes).toHaveLength(2);
  });

  it('what was saved is kept and still yours to export, effect included', async () => {
    const smokes = (await owner.get('/api/smokes')).json.smokes;
    expect(smokes.map((s: { date: string }) => s.date).sort()).toEqual(['2026-10-01', '2026-10-02']);
    expect(JSON.stringify(smokes)).toContain(EFFECT);
  });

  it('your Smokes privacy switches are kept, but nothing about smokes reaches a follower', async () => {
    expect((await owner.get('/api/privacy')).json.privacy).toMatchObject({ shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true });
    const board = await fan.get(`/api/people/u/${ownerName}/products`);
    expect(board.status).toBe(200);
    expect(board.json.products).toHaveLength(1);
    expect(board.json.options).toEqual({ mostUsed: false });
    const page = await fan.get(`/api/people/u/${ownerName}/products/${productId}`);
    expect(page.status).toBe(200);
    for (const raw of [JSON.stringify(board.json), JSON.stringify(page.json)]) expect(raw).not.toMatch(/smoke|20:00|OFF-SITE/i);
    // The preview on your Privacy screen agrees.
    const pv = (await owner.get('/api/privacy/preview')).json;
    expect(pv.options).toEqual({ mostUsed: false });
    expect(JSON.stringify(pv.products)).not.toMatch(/smoke/i);
  });

  it('everything else works as before: followers still see the board, Source and all', async () => {
    const product = (await owner.post('/api/products', { ...emptyProductInput(), name: 'New Bud', source: 'Shop Off' })).json.product;
    expect(product.name).toBe('New Bud');
    const board = (await fan.get(`/api/people/u/${ownerName}/products`)).json;
    expect(board.products.map((p: { name: string }) => p.name).sort()).toEqual(['Kept Kush', 'New Bud']);
    expect(JSON.stringify(board)).toContain('Shop Off');
  });
});
