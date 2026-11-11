import { describe, expect, it } from 'vitest';
import { freshTour, type Tour } from '../../shared/domain/tour';
import { emptyProductInput } from '../../shared/domain/product';
import { Browser, emailFor, PASSWORD, signUp, uniqueName } from './client';

// Getting started (D97): a new account has it from sign-up; an account from before it has none until it asks
// (Show me round again). Yours only: nobody else's reply carries it, and neither do Export or Restore.

const me = async (b: Browser) => (await b.get('/api/auth/me')).json;
/** An account as it was before D97: the test servers' header skips Getting started at sign-up. */
async function oldAccount(b: Browser, username = uniqueName('old')) {
  const r = await b.req('POST', '/api/auth/signup', { email: emailFor(username), password: PASSWORD, username, adult: true }, { 'x-gt-tour': 'off' });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return username;
}

describe('Getting started', () => {
  it('a new account starts with a fresh one', async () => {
    const b = new Browser();
    await signUp(b, uniqueName('tour'), { passkey: false });
    expect((await me(b)).tour).toEqual(freshTour());
  });

  it('saves where you’re up to; a later, staler save can’t untick a step or bring the welcome back', async () => {
    const b = new Browser();
    await signUp(b, uniqueName('tour'), { passkey: false });
    const first: Tour = { welcomed: true, view: 'open', done: ['product'], visited: ['strainz'], seen: ['add'] };
    const r1 = await b.put('/api/tour', first);
    expect(r1.status, JSON.stringify(r1.json)).toBe(200);
    expect(r1.json.tour).toEqual(first);
    // Another phone, which never saw the first save: made smaller, Sources opened, a post posted.
    const r2 = await b.put('/api/tour', { welcomed: false, view: 'small', done: ['post'], visited: ['sources'], seen: [] });
    expect(r2.json.tour).toEqual({ welcomed: true, view: 'small', done: ['product', 'places', 'post'], visited: ['strainz', 'sources'], seen: ['add'] });
    expect((await me(b)).tour).toEqual(r2.json.tour);
    // Hidden: kept, so it stays away on every phone.
    await b.put('/api/tour', { ...r2.json.tour, view: 'off' });
    expect((await me(b)).tour.view).toBe('off');
  });

  it('refuses a state it can’t read, and anyone not signed in', async () => {
    const b = new Browser();
    await signUp(b, uniqueName('tour'), { passkey: false });
    for (const bad of [{}, { ...freshTour(), view: 'big' }, { ...freshTour(), done: ['everything'] }, { ...freshTour(), welcomed: 1 }]) {
      const r = await b.put('/api/tour', bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.json.error).toBe('invalid_tour');
    }
    expect((await me(b)).tour).toEqual(freshTour());
    const out = new Browser();
    expect((await out.put('/api/tour', freshTour())).status).toBe(401);
    expect((await out.post('/api/tour/restart')).status).toBe(401);
  });

  it('an account from before it has none, and can’t be given one by a save; Show me round again starts it, welcome skipped', async () => {
    const b = new Browser();
    await oldAccount(b);
    expect((await me(b)).tour).toBeNull();
    const r = await b.put('/api/tour', freshTour());
    expect(r.status).toBe(404);
    expect(r.json.error).toBe('no_tour');
    expect((await me(b)).tour).toBeNull();
    const again = await b.post('/api/tour/restart');
    expect(again.status).toBe(200);
    expect(again.json.tour).toEqual(freshTour(true));
    expect((await me(b)).tour).toEqual(freshTour(true));
  });

  it('Show me round again clears the steps and hints of an account that finished or hid it', async () => {
    const b = new Browser();
    await signUp(b, uniqueName('tour'), { passkey: false });
    await b.put('/api/tour', { welcomed: true, view: 'off', done: ['product', 'places', 'friend', 'post', 'look'], visited: ['strainz', 'sources'], seen: ['add', 'look'] });
    expect((await b.post('/api/tour/restart')).json.tour).toEqual(freshTour(true));
  });

  it('is yours only: not in what a follower receives, and Restore leaves it alone', async () => {
    const [owner, fan] = [new Browser(), new Browser()];
    const ownerName = (await signUp(owner, uniqueName('gsown'), { passkey: false })).username;
    const fanName = (await signUp(fan, uniqueName('gsfan'), { passkey: false })).username;
    await owner.post('/api/products', { ...emptyProductInput(), name: 'Shared Kush' });
    const mine: Tour = { welcomed: true, view: 'small', done: ['product'], visited: [], seen: ['add'] };
    await owner.put('/api/tour', mine);
    await fan.post(`/api/people/u/${ownerName}/follow`);
    await owner.post(`/api/people/requests/${fanName}/approve`);
    for (const path of [`/api/people/u/${ownerName}`, `/api/people/u/${ownerName}/products`, '/api/people/following', `/api/people/u/${ownerName}/strainz`]) {
      const r = await fan.get(path);
      expect(r.status, path).toBe(200);
      const raw = JSON.stringify(r.json);
      expect(raw, path).not.toContain('"tour"');
      expect(raw, path).not.toContain('welcomed');
    }
    // Export is put together on the phone from your products, Log, lists and settings (client/src/backup.ts), which
    // never asks for this. Restoring a backup (even one with a made-up tour in it) changes nothing about it.
    const restored = await owner.post('/api/data/restore', { products: [], logEntries: [], tour: freshTour() });
    expect(restored.status, JSON.stringify(restored.json)).toBe(200);
    expect((await me(owner)).tour).toEqual(mine);
  });
});
