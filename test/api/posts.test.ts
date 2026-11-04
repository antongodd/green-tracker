import { beforeAll, describe, expect, it } from 'vitest';
import { emptyLogEntryInput, type LogEntry } from '../../shared/domain/logEntry';
import { emptyProductInput, type Product, type ProductInput } from '../../shared/domain/product';
import { POST_ABOUT_KEYS, POST_KEYS, postPhotoUrl, type Post } from '../../shared/domain/posts';
import type { RestorePayload } from '../../shared/domain/backup';
import { Browser, signUp, uniqueName } from './client';
import { d1, r2Keys, userId } from './store';

// Posts, comments and fires (D77). The rule: the owner and approved followers only, checked on every
// request; a pending request, an unfollow, a removal and a block each end access at once. Checked on
// raw replies, with secrets planted in every field followers must never get.

const SECRETS = { notes: 'SECRET-NOTES-p0st', supplier: 'SECRET-SUPPLIER-p0st', leafly: 'https://secret-leafly.example/p0st', dateTried: '2026-03-04', totalPaid: 43.21 };

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const postSet = async (b: Browser, label: string) => (await b.upload('/api/uploads', { cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const eventually = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
  return check();
};

let owner: Browser, fan: Browser, fan2: Browser, pending: Browser, stranger: Browser;
let ownerName: string, fanName: string, fan2Name: string, pendingName: string;

async function make(b: Browser, over: Partial<ProductInput>): Promise<Product> {
  const r = await b.post('/api/products', { ...emptyProductInput(), ...over });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.product;
}
const follow = async (b: Browser, name: string, of = owner, ofName = ownerName) => {
  await b.post(`/api/people/u/${ofName}/follow`);
  expect((await of.post(`/api/people/requests/${name}/approve`)).status).toBe(200);
};
async function post(b: Browser, body: Record<string, unknown>): Promise<Post> {
  const r = await b.post('/api/posts', body);
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.post;
}
const photoPost = async (b: Browser, caption: string) => post(b, { caption, about: null, photo: { upload: await postSet(b, caption) } });
const feed = async (b: Browser, before?: string) => (await b.get(`/api/posts/feed${before ? `?before=${before}` : ''}`)).json as { posts: Post[]; next: string | null };
/** Can `b` see the post anywhere: its page, its photo, the Feed? */
async function sees(b: Browser, p: Post) {
  const page = (await b.get(`/api/posts/${p.id}`)).status;
  const photo = (await b.raw(postPhotoUrl(p, 'thumb'))).status;
  const inFeed = (await feed(b)).posts.some((x) => x.id === p.id);
  return { page, photo, inFeed };
}

beforeAll(async () => {
  [owner, fan, fan2, pending, stranger] = [new Browser(), new Browser(), new Browser(), new Browser(), new Browser()];
  ownerName = (await signUp(owner, uniqueName('poster'))).username;
  fanName = (await signUp(fan, uniqueName('fan'))).username;
  fan2Name = (await signUp(fan2, uniqueName('fantwo'))).username;
  pendingName = (await signUp(pending, uniqueName('pend'))).username;
  await signUp(stranger, uniqueName('strange'));
  await follow(fan, fanName);
  await follow(fan2, fan2Name);
  await pending.post(`/api/people/u/${ownerName}/follow`); // never approved
});

describe('a post', () => {
  let product: Product;
  let p: Post;
  beforeAll(async () => {
    product = await make(owner, {
      name: 'Post Kush',
      strainType: 'hybrid',
      country: 'NL',
      source: 'Posted Source',
      notes: SECRETS.notes,
      leaflyLink: SECRETS.leafly,
      dateTried: SECRETS.dateTried,
      ratings: { look: 9, smell: 9, taste: 9, burn: 9, high: 3 },
      purchases: [{ date: '2026-01-02', amount: 3.5, totalPaid: SECRETS.totalPaid, supplier: SECRETS.supplier }],
      photos: [{ upload: await newSet(owner, 'cover'), crop: null }],
    });
    p = await post(owner, { caption: '  First line\nsecond line  ', about: { product: product.id }, photo: { fromPhotoId: product.photos[0]!.id } });
  });

  it('keeps the caption’s line breaks and gives the owner their own card', async () => {
    expect(p.caption).toBe('First line\nsecond line');
    expect(p.mine).toBe(true);
    expect(p.about).toMatchObject({ kind: 'product', name: 'Post Kush', score: 9, href: `/products/${product.id}`, source: 'Posted Source', preset: 'aurora' });
  });

  it('is its own copy of the photo: the cropped image, never the original, and not changed by a later crop', async () => {
    expect(p.image.version).not.toBe(product.photos[0]!.version);
    expect(text((await fan.raw(postPhotoUrl(p, 'cropped'))).bytes)).toBe('cover-cropped');
    expect((await fan.raw(`/api/posts/${p.id}/photo/original`)).status).toBe(403);
    // A new crop of the product's photo leaves the post's alone.
    const recrop = await postSet(owner, 'recrop');
    expect((await owner.post(`/api/photos/${product.photos[0]!.id}/crop`, { upload: recrop, crop: { x: 0, y: 0, w: 0.5, h: 0.5, square: false } })).status).toBe(200);
    expect(text((await fan.raw(postPhotoUrl(p, 'cropped'))).bytes)).toBe('cover-cropped');
  });

  it('reaches an approved follower with only the shared fields', async () => {
    const r = await fan.get(`/api/posts/${p.id}`);
    expect(r.status).toBe(200);
    const raw = JSON.stringify(r.json);
    for (const s of [SECRETS.notes, SECRETS.supplier, SECRETS.leafly, SECRETS.dateTried, String(SECRETS.totalPaid)]) expect(raw).not.toContain(s);
    for (const k of Object.keys(r.json.post)) expect(POST_KEYS).toContain(k);
    for (const k of Object.keys(r.json.post.about)) expect(POST_ABOUT_KEYS).toContain(k);
    expect(r.json.post.mine).toBe(false);
    expect(r.json.post.about).toMatchObject({ kind: 'product', name: 'Post Kush', strainType: 'hybrid', score: 9, source: 'Posted Source', country: 'NL', href: `/u/${ownerName}/p/${product.id}` });
    expect(await sees(fan, p)).toEqual({ page: 200, photo: 200, inFeed: true });
  });

  it('is the same 404 / 403 for a stranger, a pending request and a made-up id', async () => {
    for (const b of [stranger, pending]) {
      expect(await sees(b, p)).toEqual({ page: 404, photo: 403, inFeed: false });
      expect((await b.post(`/api/posts/${p.id}/comments`, { body: 'hi' })).status).toBe(404);
      expect((await b.req('PUT', `/api/posts/${p.id}/fire`)).status).toBe(404);
      expect((await b.get(`/api/posts/${p.id}/fires`)).status).toBe(404);
      expect((await b.get(`/api/posts/by/${ownerName}`)).status).toBe(403);
    }
    const made = await stranger.get('/api/posts/made-up-id');
    expect(made.status).toBe(404);
    expect(made.json).toEqual((await stranger.get(`/api/posts/${p.id}`)).json);
  });

  it('follows Privacy: no Source, no Country, and a card that doesn’t open when the board is hidden; its own photo is always shown', async () => {
    await owner.req('PUT', '/api/privacy', { shareBoard: true, shareSource: false, shareCountry: false, sharePhotos: false, shareProfilePhoto: true });
    let a = (await fan.get(`/api/posts/${p.id}`)).json.post.about;
    expect(a).toMatchObject({ kind: 'product', source: null, country: null });
    expect((await fan.raw(postPhotoUrl(p, 'thumb'))).status).toBe(200);
    await owner.req('PUT', '/api/privacy', { shareBoard: false, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
    a = (await fan.get(`/api/posts/${p.id}`)).json.post.about;
    expect(a).toMatchObject({ kind: 'plain', name: 'Post Kush', href: null, score: null, source: null });
    await owner.req('PUT', '/api/privacy', { shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
  });

  it('turns into a plain card when the product goes private or is archived, and back again', async () => {
    for (const flag of ['private', 'archived']) {
      await owner.post(`/api/products/${product.id}/${flag}`, { value: true });
      expect((await fan.get(`/api/posts/${p.id}`)).json.post.about).toMatchObject({ kind: 'plain', href: null, score: null });
      expect((await owner.get(`/api/posts/${p.id}`)).json.post.about.kind).toBe('product'); // the owner still sees theirs
      await owner.post(`/api/products/${product.id}/${flag}`, { value: false });
      expect((await fan.get(`/api/posts/${p.id}`)).json.post.about.kind).toBe('product');
    }
  });

  it('edits and deletes only for its owner', async () => {
    expect((await fan.req('PUT', `/api/posts/${p.id}`, { caption: 'hacked' })).status).toBe(404);
    expect((await fan.del(`/api/posts/${p.id}`)).status).toBe(404);
    const edited = await owner.req('PUT', `/api/posts/${p.id}`, { caption: 'Edited' });
    expect(edited.json.post.caption).toBe('Edited');
    expect(edited.json.post.editedAt).toBeGreaterThan(0);
    expect((await owner.req('PUT', `/api/posts/${p.id}`, { caption: 'x'.repeat(501) })).status).toBe(400);
  });
});

describe('making a post', () => {
  it('needs a photo, and a caption of 500 characters at most', async () => {
    expect((await owner.post('/api/posts', { caption: 'no photo', about: null })).json.error).toBe('invalid_post');
    expect((await owner.post('/api/posts', { caption: 'x'.repeat(501), about: null, photo: { upload: await postSet(owner, 'long') } })).json.error).toBe('invalid_post');
    const ok = await post(owner, { caption: 'é'.repeat(500), about: null, photo: { upload: await postSet(owner, 'max') } });
    expect(ok.about).toBeNull();
  });

  it('won’t take someone else’s product, photo or upload', async () => {
    const theirs = await make(fan, { name: 'Fan Thing', photos: [{ upload: await newSet(fan, 'fanthing'), crop: null }] });
    expect((await owner.post('/api/posts', { about: { product: theirs.id }, photo: { upload: await postSet(owner, 'x1') } })).status).toBe(404);
    expect((await owner.post('/api/posts', { about: null, photo: { fromPhotoId: theirs.photos[0]!.id } })).status).toBe(400);
    expect((await owner.post('/api/posts', { about: null, photo: { upload: await postSet(fan, 'x2') } })).status).toBe(400);
  });

  it('a Private product: refused without “make visible”; with it, the product turns visible and the post exists', async () => {
    const secret = await make(owner, { name: 'Hidden Haze', private: true, ratings: { look: 7 } });
    const upload = await postSet(owner, 'priv');
    const refused = await owner.post('/api/posts', { caption: '', about: { product: secret.id }, photo: { upload } });
    expect(refused.status).toBe(409);
    expect(refused.json.error).toBe('product_private');
    expect((await owner.get(`/api/products/${secret.id}`)).json.product.private).toBe(true);
    const done = await post(owner, { caption: '', about: { product: secret.id }, photo: { upload }, makeVisible: true });
    expect((await owner.get(`/api/products/${secret.id}`)).json.product.private).toBe(false);
    expect((await fan.get(`/api/posts/${done.id}`)).json.post.about).toMatchObject({ kind: 'product', name: 'Hidden Haze' });
  });

  it('a failed post changes nothing: the product stays private when the photo is gone', async () => {
    const secret = await make(owner, { name: 'Still Hidden', private: true });
    const r = await owner.post('/api/posts', { about: { product: secret.id }, photo: { upload: 'expired-upload' }, makeVisible: true });
    expect(r.status).toBe(400);
    expect((await owner.get(`/api/products/${secret.id}`)).json.product.private).toBe(true);
  });

  it('archived products and ones returned to the Log can’t be posted', async () => {
    const archived = await make(owner, { name: 'Old One' });
    await owner.post(`/api/products/${archived.id}/archived`, { value: true });
    expect((await owner.post('/api/posts', { about: { product: archived.id }, photo: { upload: await postSet(owner, 'a') } })).json.error).toBe('archived');
    const returned = await make(owner, { name: 'Gone Back' });
    expect((await owner.post(`/api/log/return/${returned.id}`)).status).toBe(201);
    expect((await owner.post('/api/posts', { about: { product: returned.id }, photo: { upload: await postSet(owner, 'k') } })).json.error).toBe('kept');
  });

  it('a Log entry: only its name and type, opening only for its owner; Add to leaderboard moves the post to the product', async () => {
    const entry = (await owner.post('/api/log', { ...emptyLogEntryInput(), name: 'Logged Cart', productType: 'concentrate', amount: 0.5, photos: [{ upload: await newSet(owner, 'logph'), crop: null }] })).json.entry as LogEntry;
    const p = await post(owner, { caption: 'from the log', about: { logEntry: entry.id }, photo: { fromPhotoId: entry.photo!.id } });
    expect(p.about).toMatchObject({ kind: 'log', name: 'Logged Cart', productType: 'concentrate', href: `/log/${entry.id}` });
    const seen = (await fan.get(`/api/posts/${p.id}`)).json.post.about;
    expect(seen).toEqual({ kind: 'log', name: 'Logged Cart', productType: 'concentrate', productTypeOther: null, strainType: null, score: null, preset: null, source: null, country: null, countryOther: null, href: null, photo: null, yours: null });
    expect(JSON.stringify(seen)).not.toContain('0.5');

    const promoted = await owner.post(`/api/log/${entry.id}/promote`, { ...emptyProductInput(), name: 'Logged Cart', productType: 'concentrate', ratings: { look: 8, smell: 8, taste: 8, consistency: 8 }, photos: [{ id: entry.photo!.id, crop: null }] });
    expect(promoted.status).toBe(201);
    expect((await fan.get(`/api/posts/${p.id}`)).json.post.about).toMatchObject({ kind: 'product', score: 8, href: `/u/${ownerName}/p/${promoted.json.product.id}` });
  });

  it('deleting the product leaves the post with a plain card; deleting the post removes its photo files', async () => {
    const doomed = await make(owner, { name: 'Doomed Bud', photos: [{ upload: await newSet(owner, 'doomed'), crop: null }] });
    const p = await post(owner, { about: { product: doomed.id }, photo: { fromPhotoId: doomed.photos[0]!.id } });
    const entry = (await owner.post('/api/log', { ...emptyLogEntryInput(), name: 'Doomed Entry' })).json.entry as LogEntry;
    const q = await post(owner, { about: { logEntry: entry.id }, photo: { upload: await postSet(owner, 'q') } });
    // A product is deleted with the Log entry that keeps it (D50): return it, then delete the entry.
    const back = (await owner.post(`/api/log/return/${doomed.id}`)).json.entry as LogEntry;
    expect((await fan.get(`/api/posts/${p.id}`)).json.post.about).toMatchObject({ kind: 'plain', name: 'Doomed Bud', href: null });
    expect((await owner.del(`/api/log/${back.id}`)).status).toBe(200);
    expect(d1('SELECT product_id FROM posts WHERE id = ?', p.id)).toEqual([{ product_id: null }]);
    expect((await owner.del(`/api/log/${entry.id}`)).status).toBe(200);
    expect((await fan.get(`/api/posts/${p.id}`)).json.post.about).toMatchObject({ kind: 'plain', name: 'Doomed Bud', href: null });
    expect((await fan.get(`/api/posts/${q.id}`)).json.post.about).toMatchObject({ kind: 'plain', name: 'Doomed Entry', href: null });
    expect(text((await fan.raw(postPhotoUrl(p, 'cropped'))).bytes)).toBe('doomed-cropped');

    const id = userId(ownerName)!;
    expect(r2Keys(`u/${id}/s/${p.image.version}/`).length).toBe(2);
    expect((await owner.del(`/api/posts/${p.id}`)).status).toBe(200);
    expect(await eventually(() => r2Keys(`u/${id}/s/${p.image.version}/`).length === 0)).toBe(true);
    expect((await fan.get(`/api/posts/${p.id}`)).status).toBe(404);
  });
});

describe('several photos in a post (D78)', () => {
  it('up to ten, in order, each its own copy; each served only to those who may see the post', async () => {
    const prod = await make(owner, { name: 'Dump Kush', photos: [{ upload: await newSet(owner, 'dump-a'), crop: null }, { upload: await newSet(owner, 'dump-b'), crop: null }] });
    const p = await post(owner, { caption: 'a dump', about: { product: prod.id }, photos: [{ fromPhotoId: prod.photos[1]!.id }, { upload: await postSet(owner, 'joint') }, { fromPhotoId: prod.photos[0]!.id }] });
    expect(p.photos).toHaveLength(3);
    expect(p.image.version).toBe(p.photos[0]!.version);
    const texts = [];
    for (let n = 0; n < 3; n++) texts.push(text((await fan.raw(postPhotoUrl(p, 'cropped', n))).bytes));
    expect(texts).toEqual(['dump-b-cropped', 'joint-cropped', 'dump-a-cropped']);
    expect((await fan.raw(postPhotoUrl(p, 'thumb', 3))).status).toBe(403); // no fourth
    for (const b of [stranger, pending]) expect((await b.raw(postPhotoUrl(p, 'cropped', 1))).status).toBe(403);
    const eleven = await Promise.all(Array.from({ length: 11 }, (_, i) => postSet(owner, `many${i}`)));
    expect((await owner.post('/api/posts', { about: null, photos: eleven.map((upload) => ({ upload })) })).status).toBe(400);
    // Deleting it deletes every photo's files.
    const id = userId(ownerName)!;
    expect((await owner.del(`/api/posts/${p.id}`)).status).toBe(200);
    for (const ph of p.photos) expect(await eventually(() => r2Keys(`u/${id}/s/${ph.version}/`).length === 0)).toBe(true);
  });

  it('one missing photo stops the whole post, and nothing is left behind', async () => {
    const before = (await owner.get(`/api/posts/by/${ownerName}`)).json.posts.length;
    const r = await owner.post('/api/posts', { about: null, photos: [{ upload: await postSet(owner, 'fine') }, { upload: 'expired' }] });
    expect(r.status).toBe(400);
    expect((await owner.get(`/api/posts/by/${ownerName}`)).json.posts.length).toBe(before);
  });

  it('the card shows the product’s cover while their Privacy shares photos; never a Log entry’s photo', async () => {
    const prod = await make(owner, { name: 'Covered', photos: [{ upload: await newSet(owner, 'cov'), crop: null }] });
    const p = await post(owner, { about: { product: prod.id }, photos: [{ upload: await postSet(owner, 'x') }] });
    let a = (await fan.get(`/api/posts/${p.id}`)).json.post.about;
    expect(a.photo).toEqual({ id: prod.photos[0]!.id, version: prod.photos[0]!.version, cutout: false });
    expect((await fan.raw(`/api/photos/${a.photo.id}/thumb`)).status).toBe(200);
    await owner.req('PUT', '/api/privacy', { shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: false, shareProfilePhoto: true });
    a = (await fan.get(`/api/posts/${p.id}`)).json.post.about;
    expect(a.photo).toBeNull();
    expect((await owner.get(`/api/posts/${p.id}`)).json.post.about.photo).not.toBeNull(); // yours, always
    await owner.req('PUT', '/api/privacy', { shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
  });
});

describe('comments and fires', () => {
  let p: Post;
  beforeAll(async () => {
    p = await photoPost(owner, 'talk about it');
  });

  it('comments: flat, oldest first, 300 characters at most, deletable by their author or the post’s owner', async () => {
    expect((await fan.post(`/api/posts/${p.id}/comments`, { body: '   ' })).status).toBe(400);
    expect((await fan.post(`/api/posts/${p.id}/comments`, { body: 'x'.repeat(301) })).status).toBe(400);
    const a = (await fan.post(`/api/posts/${p.id}/comments`, { body: 'first' })).json.post as Post;
    await fan2.post(`/api/posts/${p.id}/comments`, { body: 'second' });
    const c = (await fan.post(`/api/posts/${p.id}/comments`, { body: 'third' })).json.post as Post;
    expect(c.comments.map((x) => x.body)).toEqual(['first', 'second', 'third']);
    expect(c.commentCount).toBe(3);
    // In the Feed, the first two.
    const inFeed = (await feed(fan)).posts.find((x) => x.id === p.id)!;
    expect(inFeed.comments.map((x) => x.body)).toEqual(['first', 'second']);
    expect(inFeed.commentCount).toBe(3);

    const firstId = a.comments[0]!.id;
    const secondId = c.comments[1]!.id;
    expect((await fan2.del(`/api/posts/${p.id}/comments/${firstId}`)).status).toBe(404); // not theirs
    expect(c.comments.map((x) => x.canDelete)).toEqual([true, false, true]);
    expect((await owner.get(`/api/posts/${p.id}`)).json.post.comments.every((x: { canDelete: boolean }) => x.canDelete)).toBe(true);
    expect((await owner.del(`/api/posts/${p.id}/comments/${secondId}`)).status).toBe(200); // the owner may
    expect((await fan.del(`/api/posts/${p.id}/comments/${firstId}`)).status).toBe(200); // the author may
    expect((await fan.get(`/api/posts/${p.id}`)).json.post.comments.map((x: { body: string }) => x.body)).toEqual(['third']);
  });

  it('fires: one each, take it back, count and who', async () => {
    let r = await fan.req('PUT', `/api/posts/${p.id}/fire`);
    expect(r.json).toEqual({ fires: 1, youFired: true });
    r = await fan.req('PUT', `/api/posts/${p.id}/fire`);
    expect(r.json).toEqual({ fires: 1, youFired: true });
    await fan2.req('PUT', `/api/posts/${p.id}/fire`);
    expect((await owner.get(`/api/posts/${p.id}/fires`)).json.people.map((x: { username: string }) => x.username).sort()).toEqual([fanName, fan2Name].sort());
    r = await fan.del(`/api/posts/${p.id}/fire`);
    expect(r.json).toEqual({ fires: 1, youFired: false });
    await fan.req('PUT', `/api/posts/${p.id}/fire`);
  });

  it('a commenter you don’t know: their username and words, but not their photo (D23)', async () => {
    const photo = await newSet(fan2, 'fan2-face');
    expect((await fan2.req('PUT', '/api/profile/photo', { upload: photo, crop: { x: 0, y: 0, w: 1, h: 1, square: true } })).status).toBe(200);
    await fan2.post(`/api/posts/${p.id}/comments`, { body: 'hello from fan two' });
    const seenByFan = (await fan.get(`/api/posts/${p.id}`)).json.post.comments.find((x: { username: string }) => x.username === fan2Name);
    expect(seenByFan.body).toBe('hello from fan two');
    expect(seenByFan.photo).toBeUndefined();
    const seenByOwner = (await owner.get(`/api/posts/${p.id}`)).json.post.comments.find((x: { username: string }) => x.username === fan2Name);
    expect(seenByOwner.photo).toBeTruthy();
  });

  it('commenters blocked either way are hidden from each other, and left out of the counts', async () => {
    const before = (await fan.get(`/api/posts/${p.id}`)).json.post as Post;
    expect(before.comments.some((x) => x.username === fan2Name)).toBe(true);
    expect(before.fires).toBe(2);
    await fan.post(`/api/people/u/${fan2Name}/block`);
    const fanView = (await fan.get(`/api/posts/${p.id}`)).json.post as Post;
    expect(fanView.comments.some((x) => x.username === fan2Name)).toBe(false);
    expect(fanView.fires).toBe(1);
    expect(fanView.commentCount).toBe(before.commentCount - 1);
    expect((await fan.get(`/api/posts/${p.id}/fires`)).json.people.map((x: { username: string }) => x.username)).toEqual([fanName]);
    const fan2View = (await fan2.get(`/api/posts/${p.id}`)).json.post as Post;
    expect(fan2View.comments.some((x) => x.username === fanName)).toBe(false);
    expect(fan2View.fires).toBe(1);
    // The owner still sees both.
    expect((await owner.get(`/api/posts/${p.id}`)).json.post.fires).toBe(2);
    await fan.del(`/api/people/u/${fan2Name}/block`);
  });

  it('the Feed dot: something new from people you follow, and comments or fires on your posts', async () => {
    await feed(fan); // seen
    expect((await fan.get('/api/auth/me')).json.feedNew).toBe(false);
    await photoPost(owner, 'brand new');
    expect((await fan.get('/api/auth/me')).json.feedNew).toBe(true);
    await feed(fan);
    expect((await fan.get('/api/auth/me')).json.feedNew).toBe(false);
    // The owner's own post doesn't count for them; a comment on it does.
    await feed(owner);
    expect((await owner.get('/api/auth/me')).json.feedNew).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    await fan.post(`/api/posts/${p.id}/comments`, { body: 'ping' });
    expect((await owner.get('/api/auth/me')).json.feedNew).toBe(true);
  });
});

describe('access ends at once', () => {
  let leaver: Browser, leaverName: string, p: Post;
  beforeAll(async () => {
    leaver = new Browser();
    leaverName = (await signUp(leaver, uniqueName('leaver'))).username;
    p = await photoPost(owner, 'for the leaver');
  });
  const join = () => follow(leaver, leaverName);
  const shown = async () => sees(leaver, p);

  it('on unfollow, and their comments and fires go too', async () => {
    await join();
    expect(await shown()).toEqual({ page: 200, photo: 200, inFeed: true });
    await leaver.post(`/api/posts/${p.id}/comments`, { body: 'bye soon' });
    await leaver.req('PUT', `/api/posts/${p.id}/fire`);
    expect((await fan.get(`/api/posts/${p.id}`)).json.post.comments.map((x: { body: string }) => x.body)).toContain('bye soon');
    await leaver.del(`/api/people/u/${ownerName}/follow`);
    expect(await shown()).toEqual({ page: 404, photo: 403, inFeed: false });
    const fanView = (await fan.get(`/api/posts/${p.id}`)).json.post as Post;
    expect(fanView.comments.map((x) => x.body)).not.toContain('bye soon');
    expect(fanView.fires).toBe(0);
  });

  it('on removal by the owner', async () => {
    await join();
    expect((await shown()).page).toBe(200);
    await owner.del(`/api/people/followers/${leaverName}`);
    expect(await shown()).toEqual({ page: 404, photo: 403, inFeed: false });
  });

  it('on a block either way', async () => {
    await join();
    await owner.post(`/api/people/u/${leaverName}/block`);
    expect(await shown()).toEqual({ page: 404, photo: 403, inFeed: false });
    expect((await leaver.get(`/api/posts/by/${ownerName}`)).status).toBe(404);
    await owner.del(`/api/people/u/${leaverName}/block`);
    await join();
    await leaver.post(`/api/people/u/${ownerName}/block`);
    expect(await shown()).toEqual({ page: 404, photo: 403, inFeed: false });
    // And the owner no longer sees the blocker's posts either.
    await leaver.del(`/api/people/u/${ownerName}/block`);
  });
});

describe('the Feed and a person’s posts', () => {
  it('only you and people you follow, newest first, 20 at a time with no repeats or gaps', async () => {
    const pager = new Browser();
    const pagerName = (await signUp(pager, uniqueName('pager'))).username;
    await pager.post(`/api/people/u/${ownerName}/follow`);
    await owner.post(`/api/people/requests/${pagerName}/approve`);
    const mine: Post[] = [];
    for (let i = 0; i < 23; i++) mine.push(await photoPost(pager, `pager ${i}`));
    const strangerPost = await photoPost(stranger, 'nobody follows me');

    const all: Post[] = [];
    let next: string | null | undefined;
    let pages = 0;
    do {
      const r = await feed(pager, next ?? undefined);
      expect(r.posts.length).toBeLessThanOrEqual(20);
      all.push(...r.posts);
      next = r.next;
      pages++;
    } while (next && pages < 10);
    expect(pages).toBeGreaterThan(1);
    const ids = all.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of mine) expect(ids).toContain(m.id);
    expect(ids).not.toContain(strangerPost.id);
    expect(all.every((x) => x.username === pagerName || x.username === ownerName)).toBe(true);
    const times = all.map((x) => x.createdAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    // Their posts: the same, one person only; your own too.
    const theirs = (await fan.get(`/api/posts/by/${ownerName}`)).json.posts as Post[];
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((x) => x.username === ownerName)).toBe(true);
    expect((await pager.get(`/api/posts/by/${pagerName}`)).json.posts.length).toBe(20);

    // 30 posts an hour.
    for (let i = 23; i < 30; i++) await photoPost(pager, `pager ${i}`);
    const limited = await pager.post('/api/posts', { about: null, photo: { upload: await postSet(pager, 'one too many') } });
    expect(limited.status).toBe(429);
    expect((await fan.get('/api/posts/feed?before=not-a-cursor')).status).toBe(400);
  });
});

describe('export, restore and deleting an account', () => {
  it('your posts list for export, and Restore brings them back linked to the restored product', async () => {
    const b = new Browser();
    await signUp(b);
    const prod = await make(b, { name: 'Restored Bud', ratings: { look: 8 } });
    await post(b, { caption: 'before restore', about: { product: prod.id }, photo: { upload: await postSet(b, 'old') } });
    const mine = (await b.get('/api/posts/mine')).json.posts;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ productId: prod.id, logEntryId: null, caption: 'before restore', aboutName: { name: 'Restored Bud' } });

    const payload: RestorePayload = {
      products: [{ ...emptyProductInput(), name: 'Restored Bud', ratings: { look: 8 }, archived: false, createdAt: 1 }],
      logEntries: [{ ...emptyLogEntryInput(), name: 'Restored Entry', createdAt: 2 }],
      posts: [
        { caption: 'about the bud', createdAt: 10, editedAt: null, about: { product: 0 }, aboutName: { name: 'Restored Bud', productType: 'flower', productTypeOther: null, strainType: null }, uploads: [await postSet(b, 'r1'), await postSet(b, 'r1b')] },
        { caption: 'about the entry', createdAt: 11, editedAt: 12, about: { logEntry: 0 }, aboutName: { name: 'Restored Entry', productType: 'flower', productTypeOther: null, strainType: null }, uploads: [await postSet(b, 'r2')] },
        { caption: 'just a photo', createdAt: 12, editedAt: null, about: null, aboutName: null, uploads: [await postSet(b, 'r3')] },
      ],
    };
    const r = await b.post('/api/data/restore', payload);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.posts).toBe(3);
    const after = (await b.get('/api/posts/mine')).json.posts;
    expect(after.map((x: { caption: string }) => x.caption)).toEqual(['about the bud', 'about the entry', 'just a photo']);
    const products = (await b.get('/api/products')).json.products as Product[];
    expect(after[0].productId).toBe(products[0]!.id);
    expect(after[1].logEntryId).toBeTruthy();
    expect(after[1].editedAt).toBe(12);
    expect(after[0].photos).toHaveLength(2); // D78: every photo comes back, in order
    // A file without posts leaves them alone.
    expect((await b.post('/api/data/restore', { products: [], logEntries: [] })).json.posts).toBe('kept');
    expect((await b.get('/api/posts/mine')).json.posts).toHaveLength(3);
    // A bad reference is refused before anything changes.
    const bad = await b.post('/api/data/restore', { products: [], logEntries: [], posts: [{ caption: '', createdAt: 1, editedAt: null, about: { product: 5 }, aboutName: null, uploads: [await postSet(b, 'bad')] }] });
    expect(bad.status).toBe(400);
  });

  it('deleting an account removes its posts, comments and fires everywhere', async () => {
    const b = new Browser();
    const { username, passkey } = await signUp(b);
    await follow(b, username);
    const mine = await photoPost(b, 'leaving soon');
    const theirs = await photoPost(owner, 'stay');
    await b.post(`/api/posts/${theirs.id}/comments`, { body: 'my last words' });
    await b.req('PUT', `/api/posts/${theirs.id}/fire`);
    const id = userId(username)!;
    const opts = await b.post('/api/data/delete/options');
    expect((await b.post('/api/data/delete', { challengeId: opts.json.challengeId, response: await passkey.authenticate(opts.json.options), username })).status).toBe(200);
    for (const t of ['posts', 'post_comments', 'post_fires']) expect(d1(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`, id)).toEqual([{ n: 0 }]);
    expect(r2Keys(`u/${id}/`)).toEqual([]);
    const after = (await owner.get(`/api/posts/${theirs.id}`)).json.post as Post;
    expect(after.comments.map((x) => x.body)).not.toContain('my last words');
    expect((await owner.get(`/api/posts/${mine.id}`)).status).toBe(404);
  });
});
