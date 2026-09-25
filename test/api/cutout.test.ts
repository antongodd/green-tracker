import { beforeAll, describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { photoUrl, type PhotoRecord } from '../../shared/domain/photo';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import type { SharedProduct } from '../../shared/domain/social';
import { Browser, signUp, uniqueName } from './client';
import { d1, r2Keys, userId } from './store';

// Remove background (D26): a cut-out is a version of a photo, like a crop, whose image
// and thumbnail are transparent PNGs. The server only checks, stores and serves them.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const png = (label: string) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(label)]);
const label = (b: Uint8Array) => new TextDecoder().decode(b.slice(b[0] === 0x89 ? 8 : 4));

const newSet = async (b: Browser, name: string) => {
  const r = await b.upload('/api/uploads', { original: jpeg(`${name}-original`), cropped: jpeg(`${name}-cropped`), thumb: jpeg(`${name}-thumb`) });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.upload as string;
};
/** A cut-out set: PNG image and thumbnail; with the original for a photo that's new. */
const cutSet = async (b: Browser, name: string, withOriginal = false) => {
  const r = await b.upload('/api/uploads', {
    ...(withOriginal ? { original: jpeg(`${name}-original`) } : {}),
    cropped: png(`${name}-cut`),
    thumb: png(`${name}-cutthumb`),
    cutout: '1',
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.upload as string;
};
const recropSet = async (b: Browser, name: string) => (await b.upload('/api/uploads', { cropped: jpeg(`${name}-cropped`), thumb: jpeg(`${name}-thumb`) })).json.upload as string;
const input = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), name: 'Cut', ...over });

let me: Browser;
let myName: string;
beforeAll(async () => {
  me = new Browser();
  myName = (await signUp(me, uniqueName('cutter'))).username;
});

describe('cut-out uploads', () => {
  it('must be PNG, and only cut-outs may be PNG', async () => {
    const bad: Record<string, Uint8Array | string>[] = [
      { cropped: jpeg('x'), thumb: png('x'), cutout: '1' },
      { cropped: png('x'), thumb: jpeg('x'), cutout: '1' },
      { original: png('x'), cropped: png('x'), thumb: png('x'), cutout: '1' }, // the original stays the JPEG photo
      { cropped: png('x'), thumb: png('x') }, // not marked as a cut-out
    ];
    for (const parts of bad) {
      const r = await me.upload('/api/uploads', parts);
      expect(r.status, JSON.stringify(parts)).toBe(400);
      expect(r.json.error).toBe('bad_upload');
    }
    const ok = await cutSet(me, 'ok', true);
    expect(d1<{ cutout: number; has_original: number }>('SELECT cutout, has_original FROM uploads WHERE id = ?', ok)[0]).toEqual({ cutout: 1, has_original: 1 });
  });
});

describe('cut-outs on a product', () => {
  it('from the profile: saved at once, crop kept, served as PNG; Restore background is a plain re-crop', async () => {
    const crop = { x: 0.1, y: 0.1, w: 0.6, h: 0.6, square: false };
    const p = (await me.post('/api/products', input({ photos: [{ upload: await newSet(me, 'p'), crop }] }))).json.product as Product;
    const before = p.photos[0]!;
    expect(before.cutout).toBe(false);

    const cut = await cutSet(me, 'p1');
    const r = await me.post(`/api/photos/${before.id}/crop`, { upload: cut, crop });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const after = r.json.photo as PhotoRecord;
    expect(after).toEqual({ id: before.id, version: cut, crop, cutout: true });
    expect(((await me.get(`/api/products/${p.id}`)).json.product as Product).photos[0]).toEqual(after);
    for (const [v, type, text] of [
      ['cropped', 'image/png', 'p1-cut'],
      ['thumb', 'image/png', 'p1-cutthumb'],
      ['original', 'image/jpeg', 'p-original'],
    ] as const) {
      const res = await me.raw(photoUrl(after, v));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type'), v).toBe(type);
      expect(label(res.bytes)).toBe(text);
    }
    // The old crop's files are gone; the original stays.
    const id = userId(myName)!;
    await expect.poll(() => r2Keys(`u/${id}/s/${before.version}/`)).toEqual([`u/${id}/s/${before.version}/original.jpg`]);

    // Restore background: an ordinary re-crop of the same crop.
    const plain = await recropSet(me, 'p2');
    const back = (await me.post(`/api/photos/${before.id}/crop`, { upload: plain, crop })).json.photo as PhotoRecord;
    expect(back).toEqual({ id: before.id, version: plain, crop, cutout: false });
    expect((await me.raw(photoUrl(back, 'cropped'))).headers.get('content-type')).toBe('image/jpeg');
    await expect.poll(() => r2Keys(`u/${id}/s/${cut}/`)).toEqual([]);
  });

  it('from the editor: a new photo can be a cut-out, and a saved one becomes one on Save', async () => {
    const created = await me.post('/api/products', input({ photos: [{ upload: await cutSet(me, 'n', true), crop: null }, { upload: await newSet(me, 'm'), crop: null }] }));
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const p = created.json.product as Product;
    expect(p.photos.map((x) => x.cutout)).toEqual([true, false]);
    expect(label((await me.raw(photoUrl(p.photos[0]!, 'original'))).bytes)).toBe('n-original');
    expect((await me.raw(photoUrl(p.photos[0]!, 'cropped'))).headers.get('content-type')).toBe('image/png');

    // A cut-out set without an original can't be a new photo.
    const orphan = await me.post('/api/products', input({ photos: [{ upload: await cutSet(me, 'o'), crop: null }] }));
    expect(orphan.status).toBe(400);

    const saved = await me.req('PUT', `/api/products/${p.id}`, input({ photos: [{ id: p.photos[0]!.id, upload: await recropSet(me, 'n2'), crop: null }, { id: p.photos[1]!.id, upload: await cutSet(me, 'm2'), crop: null }] }));
    expect(saved.status, JSON.stringify(saved.json)).toBe(200);
    expect((saved.json.product as Product).photos.map((x) => x.cutout)).toEqual([false, true]);
  });

  it('a Log entry photo can be a cut-out, and promotion keeps it', async () => {
    const e = await me.post('/api/log', { ...emptyLogEntryInput(), name: 'Loose', photos: [{ upload: await cutSet(me, 'l', true), crop: null }] });
    expect(e.status, JSON.stringify(e.json)).toBe(201);
    expect(e.json.entry.photo.cutout).toBe(true);
    const photoId = e.json.entry.photo.id as string;
    const promoted = await me.post(`/api/log/${e.json.entry.id}/promote`, input({ name: 'Promoted', photos: [{ id: photoId, crop: null }] }));
    expect(promoted.status, JSON.stringify(promoted.json)).toBe(201);
    expect((promoted.json.product as Product).photos[0]).toMatchObject({ id: photoId, cutout: true });
  });

  it('a profile photo can never be a cut-out', async () => {
    const r = await me.req('PUT', '/api/profile/photo', { upload: await cutSet(me, 'face', true), crop: { x: 0, y: 0, w: 1, h: 1, square: true } });
    expect(r.status).toBe(400);
    expect((await me.get('/api/auth/me')).json.user.photo).toBeFalsy();
  });
});

describe('followers', () => {
  it('see that a photo is a cut-out and get its PNG — never the original', async () => {
    const owner = new Browser();
    const fan = new Browser();
    const ownerName = (await signUp(owner, uniqueName('grower'))).username;
    const fanName = (await signUp(fan, uniqueName('friend'))).username;
    const p = (await owner.post('/api/products', input({ name: 'Shared Cut', ratings: { look: 8 }, photos: [{ upload: await cutSet(owner, 's', true), crop: null }] }))).json.product as Product;
    await fan.post(`/api/people/u/${ownerName}/follow`);
    expect((await owner.post(`/api/people/requests/${fanName}/approve`)).status).toBe(200);

    const shared = (await fan.get(`/api/people/u/${ownerName}/products`)).json.products as SharedProduct[];
    expect(shared[0]!.photos).toEqual([{ id: p.photos[0]!.id, version: p.photos[0]!.version, cutout: true }]);
    const cropped = await fan.raw(photoUrl(shared[0]!.photos[0]!, 'cropped'));
    expect(cropped.status).toBe(200);
    expect(cropped.headers.get('content-type')).toBe('image/png');
    expect((await fan.raw(photoUrl(shared[0]!.photos[0]!, 'thumb'))).headers.get('content-type')).toBe('image/png');
    expect((await fan.raw(photoUrl(shared[0]!.photos[0]!, 'original'))).status).toBe(403);
  });
});

describe('restore', () => {
  it('keeps cut-outs (the uploads say which), and refuses a cut-out as the profile photo', async () => {
    const b = new Browser();
    await signUp(b);
    const payload: RestorePayload = {
      products: [
        {
          ...emptyProductInput(),
          name: 'Restored Cut',
          archived: false,
          createdAt: 1_700_000_000_000,
          photos: [
            { upload: await cutSet(b, 'rc', true), crop: { x: 0, y: 0, w: 0.5, h: 0.5, square: true } },
            { upload: await newSet(b, 'rp'), crop: null },
          ],
        },
      ],
      logEntries: [{ ...emptyLogEntryInput(), name: 'Restored Loose', photos: [{ upload: await cutSet(b, 'rl', true), crop: null }], createdAt: 1_700_000_000_000 }],
    };
    const bad = await b.post('/api/data/restore', { ...payload, profilePhoto: { upload: await cutSet(b, 'rf', true), crop: { x: 0, y: 0, w: 1, h: 1, square: true } } });
    expect(bad.status).toBe(400);
    expect((await b.get('/api/products')).json.products).toEqual([]);

    const res = await b.post('/api/data/restore', payload);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    const p = (await b.get('/api/products')).json.products[0] as Product;
    expect(p.photos.map((x) => [x.cutout, x.crop?.square ?? null])).toEqual([
      [true, true],
      [false, null],
    ]);
    expect((await b.raw(photoUrl(p.photos[0]!, 'cropped'))).headers.get('content-type')).toBe('image/png');
    expect((await b.get('/api/log')).json.entries[0].photo.cutout).toBe(true);
  });
});
