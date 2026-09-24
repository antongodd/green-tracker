import { describe, expect, it } from 'vitest';
import type { RestorePayload, RestoreProduct } from '../../shared/domain/backup';
import { emptyLogEntryInput, type LogEntry } from '../../shared/domain/logEntry';
import { photoUrl } from '../../shared/domain/photo';
import { emptyProductInput, type Product } from '../../shared/domain/product';
import { SoftPasskey } from './authenticator';
import { Browser, signUp } from './client';
import { d1, r2Keys, userId } from './store';

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const eventually = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
  return check();
};

async function seed(b: Browser) {
  const kept = (
    await b.post('/api/products', {
      ...emptyProductInput(),
      name: 'Old Product',
      photos: [{ upload: await newSet(b, 'old'), crop: null }],
      purchases: [{ date: '2026-01-01', amount: 1, totalPaid: 5, supplier: null }],
    })
  ).json.product as Product;
  const entry = (await b.post('/api/log', { ...emptyLogEntryInput(), name: 'Old Entry', photos: [{ upload: await newSet(b, 'oldlog'), crop: null }] })).json.entry as LogEntry;
  return { kept, entry };
}

const restoreProduct = (over: Partial<RestoreProduct>): RestoreProduct => ({ ...emptyProductInput(), name: 'X', archived: false, createdAt: 1_700_000_000_000, ...over });

describe('restore (brief §13)', () => {
  it('replaces all the user’s data in one go, keeping everything the file holds', async () => {
    const b = new Browser();
    const { username } = await signUp(b);
    const { kept, entry } = await seed(b);
    const id = userId(username)!;
    const oldKeys = r2Keys(`u/${id}/`);
    expect(oldKeys.length).toBeGreaterThan(0);

    const photo = await newSet(b, 'new');
    const payload: RestorePayload = {
      products: [
        restoreProduct({
          name: 'Restored Flower',
          productType: 'edibles',
          // Hidden categories (from an earlier type) survive a restore.
          ratings: { look: 8, smell: 7, taste: 6, high: 9 },
          purchases: [
            { date: '2026-03-01', amount: 100, totalPaid: 12, supplier: 'First' },
            { date: '2026-03-01', amount: 50, totalPaid: 8, supplier: 'Second' },
          ],
          photos: [{ upload: photo, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5, square: true } }],
          notes: 'Notes survive',
          createdAt: 1_690_000_000_000,
        }),
        restoreProduct({ name: 'Restored Archived', archived: true, private: true }),
      ],
      logEntries: [{ ...emptyLogEntryInput(), name: 'Restored Entry', amount: 2, photos: [{ upload: await newSet(b, 'newlog'), crop: null }], createdAt: 1_680_000_000_000 }],
    };
    const res = await b.post('/api/data/restore', payload);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json).toEqual({ products: 2, logEntries: 1, photos: 2 });

    const products = [...(await b.get('/api/products')).json.products, ...(await b.get('/api/products?archived=1')).json.products] as Product[];
    expect(products.map((p) => p.name).sort()).toEqual(['Restored Archived', 'Restored Flower']);
    const flower = products.find((p) => p.name === 'Restored Flower')!;
    expect(flower).toMatchObject({ productType: 'edibles', ratings: { look: 8, smell: 7, taste: 6, high: 9 }, notes: 'Notes survive', createdAt: 1_690_000_000_000 });
    expect(flower.purchases.map((p) => [p.seq, p.supplier])).toEqual([[1, 'First'], [2, 'Second']]); // entry order kept
    expect(flower.photos[0]!.crop).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5, square: true });
    expect(text((await b.raw(photoUrl(flower.photos[0]!, 'original'))).bytes)).toBe('new-original');
    expect(products.find((p) => p.name === 'Restored Archived')).toMatchObject({ archived: true, private: true });
    const entries = (await b.get('/api/log')).json.entries as LogEntry[];
    expect(entries.map((e) => [e.name, e.amount])).toEqual([['Restored Entry', 2]]);

    // The old data is gone, rows and files.
    expect((await b.get(`/api/products/${kept.id}`)).status).toBe(404);
    expect((await b.get(`/api/log/${entry.id}`)).status).toBe(404);
    expect(await eventually(() => oldKeys.every((k) => !r2Keys(k).length))).toBe(true);
    expect(d1('SELECT COUNT(*) AS n FROM uploads WHERE user_id = ?', id)).toEqual([{ n: 0 }]);
  });

  it('a bad record rejects the whole restore and changes nothing', async () => {
    const b = new Browser();
    await signUp(b);
    const { kept } = await seed(b);
    const res = await b.post('/api/data/restore', { products: [restoreProduct({ name: 'Fine' }), restoreProduct({ name: 'Bad', ratings: { look: 11 } })], logEntries: [] });
    expect(res.status).toBe(400);
    expect(res.json.message).toBe('Product 2 (“Bad”): Ratings go from 1 to 10.');
    expect((await b.get('/api/products')).json.products.map((p: Product) => p.id)).toEqual([kept.id]);
  });

  it('refuses photos that aren’t this user’s fresh uploads', async () => {
    const [b, other] = [new Browser(), new Browser()];
    await signUp(b);
    await signUp(other);
    const theirs = await newSet(other, 'theirs');
    for (const upload of [theirs, 'no-such-upload']) {
      const res = await b.post('/api/data/restore', { products: [restoreProduct({ photos: [{ upload, crop: null }] })], logEntries: [] });
      expect(res.status).toBe(400);
    }
  });

  it('leaves follows, blocks, passkeys and sessions alone', async () => {
    const [b, fan] = [new Browser(), new Browser()];
    const { username } = await signUp(b);
    const fanName = (await signUp(fan)).username;
    await fan.post(`/api/people/u/${username}/follow`);
    await b.post(`/api/people/requests/${fanName}/approve`);
    await b.post('/api/data/restore', { products: [restoreProduct({ name: 'Shared After Restore' })], logEntries: [] });
    expect((await b.get('/api/people/followers')).json.people.map((p: { username: string }) => p.username)).toEqual([fanName]);
    expect((await fan.get(`/api/people/u/${username}/products`)).json.products.map((p: { name: string }) => p.name)).toEqual(['Shared After Restore']);
    expect((await b.get('/api/auth/me')).json.user.username).toBe(username);
  });
});

describe('delete account (brief §4, §17)', () => {
  async function confirmDelete(b: Browser, passkey: SoftPasskey, username: string) {
    const opts = await b.post('/api/data/delete/options');
    return b.post('/api/data/delete', { challengeId: opts.json.challengeId, response: await passkey.authenticate(opts.json.options), username });
  }

  it('needs the username typed and a fresh passkey check of this account', async () => {
    const [b, other] = [new Browser(), new Browser()];
    const { username, passkey } = await signUp(b);
    const { passkey: otherKey } = await signUp(other);
    expect((await confirmDelete(b, passkey, 'someone-else')).json.error).toBe('username_mismatch');
    expect((await confirmDelete(b, otherKey, username)).json.error).toBe('passkey_failed');
    const replay = await b.post('/api/data/delete', { challengeId: 'made-up', response: {}, username });
    expect(replay.status).toBe(400);
    expect((await b.get('/api/auth/me')).json.user.username).toBe(username);
  });

  it('removes everything: rows in every table, every R2 file, follows both ways, pending requests, blocks', async () => {
    const [b, fan, idol, blocked] = [new Browser(), new Browser(), new Browser(), new Browser()];
    const { username, passkey } = await signUp(b);
    const fanName = (await signUp(fan)).username;
    const idolName = (await signUp(idol)).username;
    const blockedName = (await signUp(blocked)).username;
    const id = userId(username)!;

    const product = (
      await b.post('/api/products', {
        ...emptyProductInput(),
        name: 'Doomed',
        ratings: { look: 8 },
        purchases: [{ date: null, amount: 1, totalPaid: 1, supplier: null }],
        photos: [{ upload: await newSet(b, 'doomed'), crop: null }],
      })
    ).json.product as Product;
    await b.post('/api/log', { ...emptyLogEntryInput(), name: 'Doomed Entry', photos: [{ upload: await newSet(b, 'doomedlog'), crop: null }] });
    await newSet(b, 'pending-upload'); // never saved
    await fan.post(`/api/people/u/${username}/follow`);
    await b.post(`/api/people/requests/${fanName}/approve`);
    await b.post(`/api/people/u/${idolName}/follow`); // pending, outgoing
    await b.post(`/api/people/u/${blockedName}/block`);
    expect(r2Keys(`u/${id}/`).length).toBe(9); // 3 sets × 3 files

    const res = await confirmDelete(b, passkey, username.toUpperCase());
    expect(res.status).toBe(200);

    // Signed out, and the passkey leads nowhere.
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
    for (const table of ['users WHERE id', 'products WHERE user_id', 'ratings WHERE user_id', 'purchases WHERE user_id', 'log_entries WHERE user_id', 'photos WHERE user_id', 'uploads WHERE user_id', 'sessions WHERE user_id', 'passkeys WHERE user_id', 'recovery_codes WHERE user_id']) {
      expect(d1(`SELECT COUNT(*) AS n FROM ${table} = ?`, id), table).toEqual([{ n: 0 }]);
    }
    expect(d1('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ? OR followed_id = ?', id, id)).toEqual([{ n: 0 }]);
    expect(d1('SELECT COUNT(*) AS n FROM blocks WHERE blocker_id = ? OR blocked_id = ?', id, id)).toEqual([{ n: 0 }]);
    expect(r2Keys(`u/${id}/`)).toEqual([]);

    // For everyone else, the account simply no longer exists.
    expect((await fan.get(`/api/people/u/${username}`)).status).toBe(404);
    expect((await fan.raw(photoUrl(product.photos[0]!, 'thumb'))).status).toBe(403);
    expect((await idol.get('/api/people/requests')).json.people).toEqual([]);
    expect((await new Browser().get(`/api/auth/username?u=${username}`)).json.available).toBe(true);
  });
});
