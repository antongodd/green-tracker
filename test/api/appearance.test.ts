import { describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { DEFAULT_APPEARANCE, type Appearance } from '../../shared/domain/gems';
import { emptyProductInput } from '../../shared/domain/product';
import { Browser, signUp } from './client';

// Appearance (D48, 0.41.0): your Leaderboard colours and #1 mark, saved to your account.

describe('appearance settings (D48)', () => {
  it('start on Gems with #1 marked, come with who you are, are yours only, and refuse anything but a full set', async () => {
    const b = new Browser();
    await signUp(b);
    expect((await b.get('/api/appearance')).json.appearance).toEqual(DEFAULT_APPEARANCE);
    expect((await b.get('/api/auth/me')).json.appearance).toEqual(DEFAULT_APPEARANCE);
    expect((await new Browser().get('/api/appearance')).status).toBe(401);
    expect((await new Browser().req('PUT', '/api/appearance', DEFAULT_APPEARANCE)).status).toBe(401);
    // Signed out: nothing about anyone's appearance.
    expect((await new Browser().get('/api/auth/me')).json).not.toHaveProperty('appearance');
    for (const bad of [{ preset: 'gold', markFirst: true }, { preset: 'gems' }, { preset: 'gems', markFirst: 'yes' }, []]) {
      expect((await b.req('PUT', '/api/appearance', bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await b.get('/api/appearance')).json.appearance).toEqual(DEFAULT_APPEARANCE);
  });

  it('a change is saved to the account: another phone signed in sees it', async () => {
    const b = new Browser();
    await signUp(b);
    const mine: Appearance = { look: 'aurora', top: 'strip', preset: 'metals', markFirst: false };
    const r = await b.req('PUT', '/api/appearance', mine);
    expect(r.status).toBe(200);
    expect(r.json.appearance).toEqual(mine);
    expect((await b.get('/api/auth/me')).json.appearance).toEqual(mine);
    expect((await b.req('PUT', '/api/appearance', { look: 'aurora', top: 'tiles', preset: 'neon', markFirst: true })).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual({ look: 'aurora', top: 'tiles', preset: 'neon', markFirst: true });
    // An app still open from before 0.54.0 sends no look or top: they take the defaults.
    expect((await b.req('PUT', '/api/appearance', { preset: 'prism', markFirst: true })).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual({ look: 'aurora', top: 'hero', preset: 'prism', markFirst: true });
    // Every look can be saved since D65; one that doesn't exist is refused.
    expect((await b.req('PUT', '/api/appearance', { look: 'pearl', top: 'hero', preset: 'prism', markFirst: true })).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual({ look: 'pearl', top: 'hero', preset: 'prism', markFirst: true });
    expect((await b.req('PUT', '/api/appearance', { look: 'sepia', top: 'hero', preset: 'prism', markFirst: true })).status).toBe(400);
    // D69's five sets can be saved (the database allows them since 0013_more_colours.sql).
    for (const preset of ['sunset', 'deepsea', 'ember', 'cosmos', 'synthwave']) {
      expect((await b.req('PUT', '/api/appearance', { look: 'aurora', top: 'hero', preset, markFirst: true })).status, preset).toBe(200);
      expect((await b.get('/api/appearance')).json.appearance, preset).toEqual({ look: 'aurora', top: 'hero', preset, markFirst: true });
    }
    // D70's eight looks can be saved (the database allows them since 0014_more_looks.sql).
    for (const look of ['sakura', 'fireflies', 'deepsea', 'frost', 'nebula', 'outrun', 'lava', 'haze']) {
      expect((await b.req('PUT', '/api/appearance', { look, top: 'hero', preset: 'cosmos', markFirst: true })).status, look).toBe(200);
      expect((await b.get('/api/appearance')).json.appearance, look).toEqual({ look, top: 'hero', preset: 'cosmos', markFirst: true });
    }
  });

  it('never reaches anyone else: a friend’s board carries no appearance', async () => {
    const owner = new Browser();
    const fan = new Browser();
    const ownerName = (await signUp(owner)).username;
    const fanName = (await signUp(fan)).username;
    await owner.req('PUT', '/api/appearance', { preset: 'metals', markFirst: false });
    await owner.post('/api/products', { ...emptyProductInput(), name: 'Shown', ratings: { look: 9 } });
    await fan.post(`/api/people/u/${ownerName}/follow`);
    expect((await owner.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);
    const board = await fan.get(`/api/people/u/${ownerName}/products`);
    expect(board.status).toBe(200);
    expect(JSON.stringify(board.json)).not.toMatch(/metals|preset|markFirst|appearance/i);
    // The fan's own setting is untouched.
    expect((await fan.get('/api/appearance')).json.appearance).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('export and restore (D48)', () => {
  it('a restore puts the file’s settings back; a file from before 0.41.0 leaves yours alone; a bad one is refused', async () => {
    const b = new Browser();
    await signUp(b);
    const theirs: Appearance = { look: 'aurora', top: 'tiles', preset: 'prism', markFirst: false };
    const payload: RestorePayload = { products: [{ ...emptyProductInput(), name: 'P', archived: false, createdAt: 1 }], logEntries: [], appearance: theirs };
    expect((await b.post('/api/data/restore', payload)).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual(theirs);
    expect((await b.post('/api/data/restore', { products: [], logEntries: [] })).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual(theirs);
    const bad = await b.post('/api/data/restore', { products: [], logEntries: [], appearance: { preset: 'gold', markFirst: true } });
    expect(bad.status).toBe(400);
    expect((await b.get('/api/appearance')).json.appearance).toEqual(theirs);
    // A file from before 0.54.0 has a preset but no look or top: those take the defaults (D64).
    expect((await b.post('/api/data/restore', { products: [], logEntries: [], appearance: { preset: 'metals', markFirst: true } })).status).toBe(200);
    expect((await b.get('/api/appearance')).json.appearance).toEqual({ look: 'aurora', top: 'hero', preset: 'metals', markFirst: true });
  });
});
