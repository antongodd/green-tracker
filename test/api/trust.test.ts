import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProductInput, type Product } from '../../shared/domain/product';
import type { Post } from '../../shared/domain/posts';
import { PHOTO_LIMIT, PHOTO_LIMIT_TEXT } from '../../shared/domain/trust';
import { Browser, emailFor, PASSWORD, signUp, uniqueName } from './client';
import { d1, userId } from './store';

// Trust basics for strangers (D84): the 18+ tick, reports (only of what you can see, D77) and the photo limit.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const newSet = async (b: Browser, label: string) => b.upload('/api/uploads', { original: jpeg(`${label}-o`), cropped: jpeg(`${label}-c`), thumb: jpeg(`${label}-t`) });
const postSet = async (b: Browser, label: string) => (await b.upload('/api/uploads', { cropped: jpeg(`${label}-c`), thumb: jpeg(`${label}-t`) })).json.upload as string;
const reportsBy = (name: string) => d1<{ kind: string; reason: string; hidden: number; post_id: string | null; comment_id: string | null; owner_id: string }>('SELECT kind, reason, hidden, post_id, comment_id, owner_id FROM reports WHERE reporter_id = ? ORDER BY created_at', userId(name)!);

describe('the 18+ tick', () => {
  it('sign-up needs it, and an account made with it is never asked again', async () => {
    const b = new Browser();
    const username = uniqueName('adult');
    const without = await b.post('/api/auth/signup', { email: emailFor(username), password: PASSWORD, username });
    expect(without.status).toBe(400);
    expect(without.json.error).toBe('needs_adult');
    const no = await b.post('/api/auth/signup', { email: emailFor(username), password: PASSWORD, username, adult: 'yes' });
    expect(no.status).toBe(400);
    expect((await b.post('/api/auth/signup', { email: emailFor(username), password: PASSWORD, username, adult: true })).status).toBe(200);
    expect((await b.get('/api/auth/me')).json.needsAdult).toBe(false);
    expect(d1<{ adult_at: number | null }>('SELECT adult_at FROM users WHERE id = ?', userId(username)!)[0]!.adult_at).toBeGreaterThan(0);
  });

  it('an account from before it can do nothing else until it ticks it, then never sees it again', async () => {
    const b = new Browser();
    const { username } = await signUp(b, uniqueName('older'), { passkey: false });
    expect((await new Browser().post('/api/test/not-adult', { username })).status).toBe(200);
    const me = (await b.get('/api/auth/me')).json;
    expect(me.needsAdult).toBe(true);
    expect(me.user.username).toBe(username);
    const blocked = await b.get('/api/products');
    expect(blocked.status).toBe(403);
    expect(blocked.json.error).toBe('needs_adult');
    expect((await b.get('/api/posts/feed')).status).toBe(403);
    expect((await b.post('/api/account/adult', {})).status).toBe(400);
    expect((await b.post('/api/account/adult', { adult: true })).status).toBe(200);
    expect((await b.get('/api/auth/me')).json.needsAdult).toBe(false);
    expect((await b.get('/api/products')).status).toBe(200);
    // Ticking again changes nothing (the first time stays).
    const first = d1<{ adult_at: number }>('SELECT adult_at FROM users WHERE id = ?', userId(username)!)[0]!.adult_at;
    expect((await b.post('/api/account/adult', { adult: true })).status).toBe(200);
    expect(d1<{ adult_at: number }>('SELECT adult_at FROM users WHERE id = ?', userId(username)!)[0]!.adult_at).toBe(first);
  });

  it('signing out still works before ticking it', async () => {
    const b = new Browser();
    const { username } = await signUp(b, uniqueName('leaver'), { passkey: false });
    await new Browser().post('/api/test/not-adult', { username });
    expect((await b.post('/api/auth/signout')).status).toBe(200);
    expect((await b.get('/api/auth/me')).json.user).toBeNull();
  });
});

describe('reports (only what you can see)', () => {
  let owner: Browser, fan: Browser, fan2: Browser, stranger: Browser, blocked: Browser;
  let ownerName: string, fanName: string, fan2Name: string, strangerName: string, blockedName: string;
  let post: Post;

  const follow = async (b: Browser, name: string, of: Browser, ofName: string) => {
    await b.post(`/api/people/u/${ofName}/follow`);
    expect((await of.post(`/api/people/requests/${name}/approve`)).status).toBe(200);
  };
  const feedPost = async (b: Browser, id: string) => ((await b.get('/api/posts/feed')).json.posts as Post[]).find((p) => p.id === id);

  beforeAll(async () => {
    [owner, fan, fan2, stranger, blocked] = [new Browser(), new Browser(), new Browser(), new Browser(), new Browser()];
    ownerName = (await signUp(owner, uniqueName('rpowner'), { passkey: false })).username;
    fanName = (await signUp(fan, uniqueName('rpfan'), { passkey: false })).username;
    fan2Name = (await signUp(fan2, uniqueName('rpfantwo'), { passkey: false })).username;
    strangerName = (await signUp(stranger, uniqueName('rpstrange'), { passkey: false })).username;
    blockedName = (await signUp(blocked, uniqueName('rpblocked'), { passkey: false })).username;
    await follow(fan, fanName, owner, ownerName);
    await follow(fan2, fan2Name, owner, ownerName);
    await follow(blocked, blockedName, owner, ownerName);
    const r = await owner.post('/api/posts', { caption: 'Sunday pick', about: null, photo: { upload: await postSet(owner, 'rp') } });
    expect(r.status).toBe(201);
    post = r.json.post;
    expect((await owner.post(`/api/people/u/${blockedName}/block`)).status).toBe(200);
  });

  it('a follower reports a post: hidden for them only, saved for Anton, the owner never told', async () => {
    expect((await fan.post(`/api/posts/${post.id}/report`, { reason: 'nonsense' })).status).toBe(400);
    expect((await fan.post(`/api/posts/${post.id}/report`, {})).status).toBe(400);
    expect((await fan.post(`/api/posts/${post.id}/report`, { reason: 'supply' })).status).toBe(200);
    expect((await feedPost(fan, post.id))?.hiddenByYou).toBe(true);
    expect((await fan.get(`/api/posts/${post.id}`)).json.post.hiddenByYou).toBe(true);
    // Nobody else sees a trace of it, the owner included.
    for (const b of [owner, fan2]) {
      const raw = JSON.stringify((await b.get('/api/posts/feed')).json);
      expect(raw).not.toContain('hiddenByYou');
      expect(raw).not.toContain(fanName);
    }
    expect(reportsBy(fanName)).toEqual([{ kind: 'post', reason: 'supply', hidden: 1, post_id: post.id, comment_id: null, owner_id: userId(ownerName) }]);
    // Reporting again changes the reason; still one report.
    expect((await fan.post(`/api/posts/${post.id}/report`, { reason: 'personal' })).status).toBe(200);
    expect(reportsBy(fanName).map((r) => r.reason)).toEqual(['personal']);
  });

  it('Show it brings the post back for them; the report stays', async () => {
    const r = await fan.del(`/api/posts/${post.id}/report`);
    expect(r.status).toBe(200);
    expect(r.json.post.hiddenByYou).toBeUndefined();
    expect((await feedPost(fan, post.id))?.hiddenByYou).toBeUndefined();
    expect(reportsBy(fanName)).toHaveLength(1);
    expect(reportsBy(fanName)[0]!.hidden).toBe(0);
  });

  it("nobody can report a post they can't see, or their own: the same answer as anything else unseen", async () => {
    for (const b of [stranger, blocked]) {
      const r = await b.post(`/api/posts/${post.id}/report`, { reason: 'abuse' });
      expect(r.status).toBe(404);
      expect(r.json.message).toBe('This post isn’t available.');
    }
    expect((await fan.post('/api/posts/no-such-post/report', { reason: 'abuse' })).status).toBe(404);
    expect((await owner.post(`/api/posts/${post.id}/report`, { reason: 'abuse' })).status).toBe(400);
    expect(reportsBy(strangerName)).toEqual([]);
    expect(reportsBy(blockedName)).toEqual([]);
  });

  it('a comment: reported by someone who sees it, hidden for them only; never your own', async () => {
    const r = await fan2.post(`/api/posts/${post.id}/comments`, { body: 'I can sort you some, message me' });
    expect(r.status).toBe(201);
    const cid = (r.json.post as Post).comments.find((c) => c.username === fan2Name)!.id;
    expect((await fan2.post(`/api/posts/${post.id}/comments/${cid}/report`, { reason: 'supply' })).status).toBe(400);
    expect((await stranger.post(`/api/posts/${post.id}/comments/${cid}/report`, { reason: 'supply' })).status).toBe(404);
    expect((await fan.post(`/api/posts/${post.id}/comments/${cid}/report`, { reason: 'supply' })).status).toBe(200);
    expect((await fan.get(`/api/posts/${post.id}`)).json.post.comments.find((c: { id: string }) => c.id === cid).hiddenByYou).toBe(true);
    expect((await owner.get(`/api/posts/${post.id}`)).json.post.comments.find((c: { id: string }) => c.id === cid).hiddenByYou).toBeUndefined();
    expect(reportsBy(fanName).find((x) => x.kind === 'comment')).toMatchObject({ comment_id: cid, post_id: post.id, owner_id: userId(fan2Name), hidden: 1 });
    // Show it.
    const shown = await fan.del(`/api/posts/${post.id}/comments/${cid}/report`);
    expect(shown.status).toBe(200);
    expect((shown.json.post as Post).comments.find((c) => c.id === cid)!.hiddenByYou).toBeUndefined();
    // The owner can report a comment on their own post too.
    expect((await owner.post(`/api/posts/${post.id}/comments/${cid}/report`, { reason: 'other' })).status).toBe(200);
  });

  it("a comment its author can't see any more (unfollowed) can't be reported, as it isn't shown", async () => {
    const extra = new Browser();
    const extraName = (await signUp(extra, uniqueName('rpgone'), { passkey: false })).username;
    await follow(extra, extraName, owner, ownerName);
    const cid = ((await extra.post(`/api/posts/${post.id}/comments`, { body: 'gone soon' })).json.post as Post).comments.find((c) => c.username === extraName)!.id;
    expect((await extra.del(`/api/people/u/${ownerName}/follow`)).status).toBe(200);
    expect((await fan.post(`/api/posts/${post.id}/comments/${cid}/report`, { reason: 'abuse' })).status).toBe(404);
  });

  it('a person: anyone you can find; "Also block" blocks them; someone who blocked you can’t be found', async () => {
    const r = await stranger.post(`/api/people/u/${ownerName}/report`, { reason: 'under18', block: false });
    expect(r.status).toBe(200);
    expect(r.json.person.relation).toBe('none');
    expect(reportsBy(strangerName)).toEqual([{ kind: 'person', reason: 'under18', hidden: 1, post_id: null, comment_id: null, owner_id: userId(ownerName) }]);
    const withBlock = await fan2.post(`/api/people/u/${ownerName}/report`, { reason: 'abuse', block: true });
    expect(withBlock.status).toBe(200);
    expect(withBlock.json.person.relation).toBe('blocked');
    expect(d1('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', userId(fan2Name)!, userId(ownerName)!)).toHaveLength(1);
    expect(d1('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?', userId(fan2Name)!, userId(ownerName)!)).toHaveLength(0);
    expect((await blocked.post(`/api/people/u/${ownerName}/report`, { reason: 'abuse' })).status).toBe(404);
    expect((await stranger.post(`/api/people/u/${strangerName}/report`, { reason: 'abuse' })).status).toBe(404);
    expect((await stranger.post('/api/people/u/nobody-here-at-all/report', { reason: 'abuse' })).status).toBe(404);
  });

  it('deleting the post takes its reports with it; deleting an account takes the reports it made', async () => {
    const before = d1<{ n: number }>('SELECT COUNT(*) AS n FROM reports WHERE post_id = ?', post.id)[0]!.n;
    expect(before).toBeGreaterThan(0);
    expect((await owner.del(`/api/posts/${post.id}`)).status).toBe(200);
    expect(d1<{ n: number }>('SELECT COUNT(*) AS n FROM reports WHERE post_id = ?', post.id)[0]!.n).toBe(0);
    const strangerId = userId(strangerName)!;
    expect((await stranger.post('/api/data/delete', { username: strangerName, password: PASSWORD })).status).toBe(200);
    expect(d1('SELECT 1 FROM reports WHERE reporter_id = ?', strangerId)).toEqual([]);
  });
});

describe('the photo limit', () => {
  // `filler` holds the made-up photo rows (never saved again); `product` is the one the tests save.
  let b: Browser, name: string, filler: Product, product: Product;
  const make = async (n: string) => {
    const r = await b.post('/api/products', { ...emptyProductInput(), name: n });
    expect(r.status).toBe(201);
    return r.json.product as Product;
  };
  beforeAll(async () => {
    b = new Browser();
    name = (await signUp(b, uniqueName('photos'), { passkey: false })).username;
    filler = await make('Lots of photos');
    product = await make('Lemon Gelato');
  });
  const fill = async (count: number) => expect((await new Browser().post('/api/test/fill-photos', { username: name, product: filler.id, count })).status).toBe(200);
  const save = (photos: { upload: string }[]) => b.put(`/api/products/${product.id}`, { ...emptyProductInput(), name: 'Lemon Gelato', photos });
  const count = async () => (await b.get('/api/auth/me')).json.photoCount as number;

  it('counts every photo for you, and an upload says how many you had', async () => {
    expect(await count()).toBe(0);
    await fill(PHOTO_LIMIT - 2);
    expect(await count()).toBe(PHOTO_LIMIT - 2);
    const up = await newSet(b, 'near');
    expect(up.status).toBe(201);
    expect(up.json.photoCount).toBe(PHOTO_LIMIT - 2);
  });

  it('a Save that would go past it is refused politely, and nothing changes', async () => {
    const ups = [];
    for (const label of ['one', 'two', 'three']) ups.push({ upload: (await newSet(b, label)).json.upload as string });
    const r = await save(ups);
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ error: 'photo_limit', message: PHOTO_LIMIT_TEXT });
    expect(await count()).toBe(PHOTO_LIMIT - 2);
    expect((await b.get(`/api/products/${product.id}`)).json.product.photos).toEqual([]);
    // Two fit exactly.
    const ok = await save(ups.slice(0, 2));
    expect(ok.status, JSON.stringify(ok.json)).toBe(200);
    expect(await count()).toBe(PHOTO_LIMIT);
  });

  it('at the limit: a new photo is refused before it is stored; a post with a photo too', async () => {
    const r = await newSet(b, 'full');
    expect(r.status).toBe(409);
    expect(r.json.message).toBe(PHOTO_LIMIT_TEXT);
    const post = await b.post('/api/posts', { caption: 'one more', about: null, photo: { upload: await postSet(b, 'full-post') } });
    expect(post.status).toBe(409);
    expect(post.json.error).toBe('photo_limit');
    expect(d1('SELECT 1 FROM posts WHERE user_id = ?', userId(name)!)).toEqual([]);
  });

  it('deleting photos frees room at once', async () => {
    expect((await save([])).status).toBe(200);
    expect(await count()).toBe(PHOTO_LIMIT - 2);
    expect((await newSet(b, 'room')).status).toBe(201);
  });
});
