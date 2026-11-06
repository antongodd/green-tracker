import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { DEFAULT_PRIVACY, type Privacy } from '../../shared/domain/privacy';
import { Browser, signUp } from './client';

// Friends on Strainz (D94, 0.83.0): friends who've tried a strain, a friend's strains against yours, and their Want to
// try lists (names only, behind their own switch, off until they turn it on). Only what each friend already shares.

let me: Browser, sam: Browser, kai: Browser, stranger: Browser;
let myName: string, samName: string, kaiName: string;

const rated = (n: number) => ({ look: n, smell: n, taste: n, burn: n });
const product = async (b: Browser, name: string, over: Partial<ProductInput> = {}) => {
  const r = await b.post('/api/products', { ...emptyProductInput(), name, ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.product as { id: string };
};
const privacy = async (b: Browser, over: Partial<Privacy>) => expect((await b.req('PUT', '/api/privacy', { ...DEFAULT_PRIVACY, ...over })).status).toBe(200);
const follow = async (fan: Browser, fanName: string, owner: Browser, ownerName: string) => {
  await fan.post(`/api/people/u/${ownerName}/follow`);
  await owner.post(`/api/people/requests/${fanName}/approve`);
};
const friendsOf = async (name: string) => (await me.get(`/api/people/strain-friends?name=${encodeURIComponent(name)}`)).json.friends as { person: { username: string }; productId: string; score: number | null; kind: string; source: string | null }[];

beforeAll(async () => {
  [me, sam, kai, stranger] = [new Browser(), new Browser(), new Browser(), new Browser()];
  myName = (await signUp(me)).username;
  samName = (await signUp(sam)).username;
  kaiName = (await signUp(kai)).username;
  await signUp(stranger);
  await follow(me, myName, sam, samName);
  await follow(me, myName, kai, kaiName);
  await product(me, 'Zkittlez', { ratings: rated(8) });
  await product(me, 'Gelato 41', { ratings: rated(9) });
  await product(sam, 'zkittlez', { ratings: rated(9), source: 'Green Room' });
  await product(sam, 'Zkittlez', { ratings: rated(7), productType: 'concentrate', concentrateType: 'live_rosin' });
  await product(sam, 'Zkittlez', { ratings: rated(10), private: true });
  await product(sam, 'Runtz', { ratings: rated(8.5) });
  await product(kai, 'Zkittlez', { ratings: rated(8.2), source: 'Kush Co' });
  await product(stranger, 'Zkittlez', { ratings: rated(9.9) });
  await sam.post('/api/wants', { kind: 'strain', name: 'Permanent Marker', note: 'Secret note from Drew' });
  await sam.post('/api/wants', { kind: 'strain', name: 'gelato 41' });
  await sam.post('/api/wants', { kind: 'source', name: 'Cloud Nine', note: 'Fridays' });
});

describe('the new switch (D94)', () => {
  it('Want to try lists start off; a setting sent without it (an older app or file) keeps it off', async () => {
    expect((await sam.get('/api/privacy')).json.privacy.shareWants).toBe(false);
    const { shareWants: _, ...old } = DEFAULT_PRIVACY;
    const r = await sam.req('PUT', '/api/privacy', old);
    expect(r.status).toBe(200);
    expect(r.json.privacy.shareWants).toBe(false);
  });
});

describe('friends who’ve tried a strain (D94)', () => {
  it('lists the people you follow with that strain (capitals ignored), best first; never Private products or strangers', async () => {
    const f = await friendsOf('ZKITTLEZ');
    expect(f.map((x) => [x.person.username, x.score, x.kind])).toEqual([
      [samName, 9, 'Flower'],
      [kaiName, 8.2, 'Flower'],
      [samName, 7, 'Live rosin'],
    ]);
    expect(JSON.stringify(f)).not.toMatch(/9\.9|"10"|\b10\b/);
  });

  it('follows each friend’s own switches: no Leaderboard, nothing; no Source, no source', async () => {
    await privacy(kai, { shareSource: false });
    expect((await friendsOf('Zkittlez')).find((x) => x.person.username === kaiName)!.source).toBeNull();
    expect((await friendsOf('Zkittlez')).find((x) => x.person.username === samName && x.score === 9)!.source).toBe('Green Room');
    await privacy(kai, { shareBoard: false });
    expect((await friendsOf('Zkittlez')).map((x) => x.person.username)).not.toContain(kaiName);
    await privacy(kai, {});
  });

  it('a pending request or a block counts for nothing', async () => {
    const other = new Browser();
    const otherName = (await signUp(other)).username;
    await product(other, 'Zkittlez', { ratings: rated(6) });
    await me.post(`/api/people/u/${otherName}/follow`); // pending, never approved
    expect((await friendsOf('Zkittlez')).map((x) => x.person.username)).not.toContain(otherName);
    await kai.post(`/api/people/u/${myName}/block`);
    expect((await friendsOf('Zkittlez')).map((x) => x.person.username)).not.toContain(kaiName);
  });

  it('asks for a name', async () => {
    expect((await me.get('/api/people/strain-friends?name=%20')).status).toBe(400);
  });
});

describe('a friend’s Strainz page (D94)', () => {
  it('your strains against theirs: both tried (yours and theirs), only them; never their Private ones', async () => {
    const r = await me.get(`/api/people/u/${samName}/strainz`);
    expect(r.status).toBe(200);
    expect(r.json.comparison.both).toEqual([{ name: 'Zkittlez', yours: 8, theirs: 8, count: 2, productId: expect.any(String) }]);
    expect(r.json.comparison.onlyThem.map((s: { name: string; average: number }) => [s.name, s.average])).toEqual([['Runtz', 8.5]]);
    expect(r.json.wants).toBeNull(); // switched off
  });

  it('with Want to try switched on: names and kinds only, never the notes; marked when you’ve tried it', async () => {
    await privacy(sam, { shareWants: true });
    const r = await me.get(`/api/people/u/${samName}/strainz`);
    expect(r.json.wants).toEqual([
      { kind: 'source', name: 'Cloud Nine', tried: false },
      { kind: 'strain', name: 'Gelato 41', tried: true },
      { kind: 'strain', name: 'Permanent Marker', tried: false },
    ]);
    expect(JSON.stringify(r.json)).not.toMatch(/Secret note|Fridays|"note"/);
  });

  it('with the Leaderboard off, Want to try still shows when it’s on; strangers and the blocked get nothing', async () => {
    await privacy(sam, { shareBoard: false, shareWants: true });
    const r = await me.get(`/api/people/u/${samName}/strainz`);
    expect(r.json.comparison).toEqual({ both: [], onlyThem: [] });
    expect(r.json.wants).toHaveLength(3);
    expect((await stranger.get(`/api/people/u/${samName}/strainz`)).status).toBe(403);
    expect((await me.get(`/api/people/u/${kaiName}/strainz`)).status).toBe(404); // kai blocked me
    await privacy(sam, {});
  });

  it('adding one of theirs to your list is the usual Want to try, with the note "From @sam"', async () => {
    const r = await me.post('/api/wants', { kind: 'strain', name: 'Runtz', note: `From @${samName}` });
    expect(r.status).toBe(201);
    expect(r.json.want).toMatchObject({ name: 'Runtz', note: `From @${samName}` });
  });
});
