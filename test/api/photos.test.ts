import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import { photoUrl } from '../../shared/domain/photo';
import { Browser, signUp } from './client';

// The server stores and serves files; it never decodes them. A JPEG signature plus a
// label is enough to tell files apart.
const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));

const newSet = async (b: Browser, label: string) => {
  const r = await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.upload as string;
};
const recropSet = async (b: Browser, label: string) => {
  const r = await b.upload('/api/uploads', { cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) });
  expect(r.status).toBe(201);
  return r.json.upload as string;
};
const input = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), name: 'With photos', ...over });
const save = async (b: Browser, id: string | null, body: ProductInput) => {
  const r = id ? await b.req('PUT', `/api/products/${id}`, body) : await b.post('/api/products', body);
  return r;
};

let me: Browser;
beforeAll(async () => {
  me = new Browser();
  await signUp(me);
});

describe('photos', () => {
  it('attaches uploads on save, in order, and serves each variant', async () => {
    const a = await newSet(me, 'a');
    const b = await newSet(me, 'b');
    const res = await save(me, null, input({ photos: [{ upload: a, crop: null }, { upload: b, crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.5, square: true } }] }));
    expect(res.status).toBe(201);
    const p = res.json.product as Product;
    expect(p.photos).toHaveLength(2);
    expect(p.photos[1]!.crop).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5, square: true });
    for (const v of ['original', 'cropped', 'thumb'] as const) {
      const r = await me.raw(photoUrl(p.photos[0]!, v));
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('image/jpeg');
      expect(text(r.bytes)).toBe(`a-${v}`);
    }
  });

  it('serves photos privately with ETag revalidation (304 when unchanged)', async () => {
    const res = await save(me, null, input({ photos: [{ upload: await newSet(me, 'e'), crop: null }] }));
    const url = photoUrl(res.json.product.photos[0], 'thumb');
    const first = await me.raw(url);
    expect(first.headers.get('cache-control')).toBe('private, no-cache');
    const etag = first.headers.get('etag')!;
    expect((await me.raw(url, { 'if-none-match': etag })).status).toBe(304);
  });

  it('a re-crop from the editor replaces cropped + thumb, keeps the original, and changes the version', async () => {
    const created = (await save(me, null, input({ photos: [{ upload: await newSet(me, 'r'), crop: null }] }))).json.product as Product;
    const photo = created.photos[0]!;
    const old = await me.raw(photoUrl(photo, 'thumb'));
    const crop = await recropSet(me, 'r2');
    const updated = (await save(me, created.id, input({ photos: [{ id: photo.id, upload: crop, crop: { x: 0, y: 0, w: 1, h: 0.5, square: false } }] }))).json.product as Product;
    const next = updated.photos[0]!;
    expect(next.id).toBe(photo.id);
    expect(next.version).not.toBe(photo.version);
    expect(text((await me.raw(photoUrl(next, 'cropped'))).bytes)).toBe('r2-cropped');
    expect(text((await me.raw(photoUrl(next, 'original'))).bytes)).toBe('r-original');
    // The old ETag no longer matches.
    expect((await me.raw(photoUrl(next, 'thumb'), { 'if-none-match': old.headers.get('etag')! })).status).toBe(200);
  });

  it('an editor save without the photo deletes it; unchanged photos can be reordered', async () => {
    const [a, b, c] = [await newSet(me, 'x'), await newSet(me, 'y'), await newSet(me, 'z')];
    const p = (await save(me, null, input({ photos: [a, b, c].map((upload) => ({ upload, crop: null })) }))).json.product as Product;
    const [pa, pb, pc] = p.photos;
    const q = (await save(me, p.id, input({ photos: [{ id: pc!.id, crop: null }, { id: pa!.id, crop: null }] }))).json.product as Product;
    expect(q.photos.map((x) => x.id)).toEqual([pc!.id, pa!.id]);
    expect((await me.raw(photoUrl(pb!, 'thumb'))).status).toBe(403);
  });

  it('a crop from the profile saves straight away', async () => {
    const p = (await save(me, null, input({ photos: [{ upload: await newSet(me, 'pf'), crop: null }] }))).json.product as Product;
    const up = await recropSet(me, 'pf2');
    const res = await me.post(`/api/photos/${p.photos[0]!.id}/crop`, { upload: up, crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5, square: true } });
    expect(res.status).toBe(200);
    const again = (await me.get(`/api/products/${p.id}`)).json.product as Product;
    expect(again.photos[0]!.crop).toMatchObject({ square: true, w: 0.5 });
    expect(text((await me.raw(photoUrl(again.photos[0]!, 'cropped'))).bytes)).toBe('pf2-cropped');
    // "Reset to original": a crop of null.
    const reset = await me.post(`/api/photos/${p.photos[0]!.id}/crop`, { upload: await recropSet(me, 'pf3'), crop: null });
    expect(reset.json.photo.crop).toBeNull();
  });

  it('each upload attaches once; a cancelled upload is gone', async () => {
    const up = await newSet(me, 'once');
    expect((await save(me, null, input({ photos: [{ upload: up, crop: null }] }))).status).toBe(201);
    const again = await save(me, null, input({ photos: [{ upload: up, crop: null }] }));
    expect(again.status).toBe(400);
    expect(again.json.error).toBe('photo_upload_missing');

    const cancelled = await newSet(me, 'cancel');
    await me.del(`/api/uploads/${cancelled}`);
    expect((await save(me, null, input({ photos: [{ upload: cancelled, crop: null }] }))).json.error).toBe('photo_upload_missing');
  });

  it('rejects non-JPEG files and a new photo without an original', async () => {
    const bad = await me.upload('/api/uploads', { cropped: new TextEncoder().encode('<svg/>'), thumb: jpeg('t') });
    expect(bad.status).toBe(400);
    expect(bad.json.message).toBe('Photos must be JPEG images.');
    const noOriginal = await recropSet(me, 'no-orig');
    expect((await save(me, null, input({ photos: [{ upload: noOriginal, crop: null }] }))).json.error).toBe('invalid_photos');
  });

  it('rejects a crop outside the image', async () => {
    const res = await save(me, null, input({ photos: [{ upload: await newSet(me, 'c'), crop: { x: 0.8, y: 0, w: 0.5, h: 1, square: false } }] }));
    expect(res.status).toBe(400);
  });
});

describe('photo privacy (§17): serving checks the requester', () => {
  it('another user can’t see, use, crop or steal someone’s photo or upload', async () => {
    const victim = new Browser();
    await signUp(victim);
    const vp = (await save(victim, null, input({ photos: [{ upload: await newSet(victim, 'v'), crop: null }] }))).json.product as Product;
    const pendingUpload = await newSet(victim, 'pending');
    const attacker = new Browser();
    await signUp(attacker);

    for (const v of ['thumb', 'cropped', 'original'] as const) expect((await attacker.raw(photoUrl(vp.photos[0]!, v))).status).toBe(403);
    expect((await new Browser().raw(photoUrl(vp.photos[0]!, 'thumb'))).status).toBe(401);
    // Using the victim's pending upload or photo ID in the attacker's own product.
    expect((await save(attacker, null, input({ photos: [{ upload: pendingUpload, crop: null }] }))).json.error).toBe('photo_upload_missing');
    const mine = (await save(attacker, null, input({}))).json.product as Product;
    expect((await save(attacker, mine.id, input({ photos: [{ id: vp.photos[0]!.id, crop: null }] }))).json.error).toBe('invalid_photos');
    expect((await attacker.post(`/api/photos/${vp.photos[0]!.id}/crop`, { upload: await recropSet(attacker, 'a'), crop: null })).status).toBe(404);
    await attacker.del(`/api/uploads/${pendingUpload}`);
    // The victim's things are untouched.
    expect((await save(victim, null, input({ photos: [{ upload: pendingUpload, crop: null }] }))).status).toBe(201);
    expect(text((await victim.raw(photoUrl(vp.photos[0]!, 'thumb'))).bytes)).toBe('v-thumb');
  });

  it('the owner still sees photos of private and archived products', async () => {
    const p = (await save(me, null, input({ private: true, photos: [{ upload: await newSet(me, 'pa'), crop: null }] }))).json.product as Product;
    await me.post(`/api/products/${p.id}/archived`, { value: true });
    expect((await me.raw(photoUrl(p.photos[0]!, 'thumb'))).status).toBe(200);
  });
});
