import { beforeAll, describe, expect, it } from 'vitest';
import type { RestorePayload } from '../../shared/domain/backup';
import { Browser, signUp, uniqueName } from './client';
import { d1, r2Keys, userId } from './store';

// Profile photos (D23). Who may see yours: you; people you follow or have asked to
// follow (you reached out to them); your approved followers. Never: someone whose
// request you haven't approved, strangers, anyone blocked either way. Others only
// ever get the crop, never the original. Checked on raw responses.

const jpeg = (label: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label)]);
const text = (b: Uint8Array) => new TextDecoder().decode(b.slice(4));
const newSet = async (b: Browser, label: string) =>
  (await b.upload('/api/uploads', { original: jpeg(`${label}-original`), cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const recropSet = async (b: Browser, label: string) => (await b.upload('/api/uploads', { cropped: jpeg(`${label}-cropped`), thumb: jpeg(`${label}-thumb`) })).json.upload as string;
const eventually = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
  return check();
};
const SQUARE = { x: 0.1, y: 0.2, w: 0.5, h: 0.5, square: true };
const setPhoto = (b: Browser, upload: string, crop: unknown = SQUARE) => b.req('PUT', '/api/profile/photo', { upload, crop });
const theirPhoto = (b: Browser, username: string, variant = 'thumb') => b.raw(`/api/people/u/${username}/photo/${variant}`);

describe('your own profile photo', () => {
  it('sets, serves, re-frames (keeping the original) and removes it, cleaning up files', async () => {
    const me = new Browser();
    const { username } = await signUp(me);
    const id = userId(username)!;
    expect((await me.get('/api/auth/me')).json.user).toEqual({ username });
    expect((await me.raw('/api/profile/photo/thumb')).status).toBe(404);

    const first = await newSet(me, 'first');
    const res = await setPhoto(me, first);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect((await me.get('/api/auth/me')).json.user).toEqual({ username, photo: { version: first, crop: SQUARE } });
    for (const v of ['original', 'cropped', 'thumb']) {
      const r = await me.raw(`/api/profile/photo/${v}`);
      expect(r.status).toBe(200);
      expect(text(r.bytes)).toBe(`first-${v}`);
      expect(r.headers.get('cache-control')).toBe('private, no-cache');
    }

    // Re-frame: a set without an original keeps the photo's original.
    const reframe = await recropSet(me, 'reframe');
    expect((await setPhoto(me, reframe, { x: 0, y: 0, w: 1, h: 1, square: true })).status).toBe(200);
    expect(text((await me.raw('/api/profile/photo/original')).bytes)).toBe('first-original');
    expect(text((await me.raw('/api/profile/photo/cropped')).bytes)).toBe('reframe-cropped');
    expect(await eventually(() => !r2Keys(`u/${id}/s/${first}/cropped`).length)).toBe(true);
    expect(r2Keys(`u/${id}/s/${first}/original`)).toHaveLength(1);

    // A new photo replaces everything of the old one.
    const second = await newSet(me, 'second');
    expect((await setPhoto(me, second)).status).toBe(200);
    expect(await eventually(() => !r2Keys(`u/${id}/s/${first}/`).length && !r2Keys(`u/${id}/s/${reframe}/`).length)).toBe(true);

    expect((await me.del('/api/profile/photo')).status).toBe(200);
    expect((await me.get('/api/auth/me')).json.user).toEqual({ username });
    expect(d1('SELECT COUNT(*) AS n FROM profile_photos WHERE user_id = ?', id)).toEqual([{ n: 0 }]);
    expect(await eventually(() => r2Keys(`u/${id}/`).length === 0)).toBe(true);
  });

  it('refuses a re-frame with no photo, a bad crop, and uploads that aren’t yours or are used up', async () => {
    const [me, other] = [new Browser(), new Browser()];
    await signUp(me);
    await signUp(other);
    expect((await setPhoto(me, await recropSet(me, 'nophoto'))).json.error).toBe('invalid_photos');
    expect((await setPhoto(me, await newSet(me, 'badcrop'), { x: 0.8, y: 0, w: 0.5, h: 0.5 })).status).toBe(400);
    expect((await setPhoto(me, await newSet(me, 'nocrop'), null)).status).toBe(400);
    expect((await setPhoto(me, await newSet(other, 'theirs'))).json.error).toBe('photo_upload_missing');
    const once = await newSet(me, 'once');
    expect((await setPhoto(me, once)).status).toBe(200);
    expect((await setPhoto(me, once)).json.error).toBe('photo_upload_missing');
  });
});

describe('who sees your profile photo (D23)', () => {
  let me: Browser, follower: Browser, idol: Browser, asked: Browser, requester: Browser, stranger: Browser;
  let meName: string, followerName: string, idolName: string, askedName: string, requesterName: string, strangerName: string;
  let version: string;

  beforeAll(async () => {
    [me, follower, idol, asked, requester, stranger] = [new Browser(), new Browser(), new Browser(), new Browser(), new Browser(), new Browser()];
    meName = (await signUp(me, uniqueName('Pia'))).username;
    followerName = (await signUp(follower, uniqueName('fol'))).username;
    idolName = (await signUp(idol, uniqueName('ido'))).username;
    askedName = (await signUp(asked, uniqueName('ask'))).username;
    requesterName = (await signUp(requester, uniqueName('req'))).username;
    strangerName = (await signUp(stranger, uniqueName('str'))).username;
    version = await newSet(me, 'pia');
    expect((await setPhoto(me, version)).status).toBe(200);
    // Everyone else has a photo too, to check what I see of them.
    for (const [b, n] of [[follower, 'fol'], [idol, 'ido'], [asked, 'ask'], [requester, 'req'], [stranger, 'str']] as const) expect((await setPhoto(b, await newSet(b, n))).status).toBe(200);

    await follower.post(`/api/people/u/${meName}/follow`);
    await me.post(`/api/people/requests/${followerName}/approve`); // follower → me, approved
    await me.post(`/api/people/u/${idolName}/follow`);
    await idol.post(`/api/people/requests/${meName}/approve`); // me → idol, approved
    await me.post(`/api/people/u/${askedName}/follow`); // me → asked, pending
    await requester.post(`/api/people/u/${meName}/follow`); // requester → me, pending (not approved)
  });

  it('shows it to your followers, people you follow and people you’ve asked; never to an unapproved requester or a stranger', async () => {
    for (const [b, name, allowed] of [
      [follower, 'follower', true],
      [idol, 'someone I follow', true],
      [asked, 'someone I asked to follow', true],
      [requester, 'someone whose request I haven’t approved', false],
      [stranger, 'a stranger', false],
    ] as const) {
      const r = await theirPhoto(b, meName);
      expect(r.status, name).toBe(allowed ? 200 : 403);
      if (allowed) expect(text(r.bytes), name).toBe('pia-thumb');
      const card = (await b.get(`/api/people/u/${meName}`)).json.person;
      expect(card.photo, name).toBe(allowed ? version : undefined);
      if (!allowed) expect(Object.keys(card).sort(), name).toEqual(['relation', 'username']);
    }
    expect((await theirPhoto(follower, meName, 'cropped')).status).toBe(200);
  });

  it('never serves the original to anyone else, and refuses everything else with one identical 403', async () => {
    const original = await theirPhoto(follower, meName, 'original');
    expect(original.status).toBe(403);
    const denied = [original, await theirPhoto(stranger, meName), await theirPhoto(stranger, 'no_such_person_x'), await theirPhoto(follower, meName, 'nonsense')];
    const noPhoto = new Browser();
    const noPhotoName = (await signUp(noPhoto)).username;
    await noPhoto.post(`/api/people/u/${meName}/follow`);
    await me.post(`/api/people/requests/${noPhotoName}/approve`);
    await me.post(`/api/people/u/${noPhotoName}/follow`);
    await noPhoto.post(`/api/people/requests/${meName}/approve`);
    denied.push(await theirPhoto(me, noPhotoName)); // connected, but they have no photo
    const bodies = new Set(denied.map((d) => `${d.status} ${new TextDecoder().decode(d.bytes)}`));
    expect(bodies.size).toBe(1);
    expect([...bodies][0]).toContain('403');
  });

  it('puts photos in lists only where the rule allows', async () => {
    // My lists: everyone there reached out to me or accepted me, except the one I only asked.
    const following = (await me.get('/api/people/following')).json.people as { username: string; photo?: string }[];
    expect(following.find((p) => p.username === idolName)?.photo).toBeTruthy();
    expect(following.find((p) => p.username === askedName)).toEqual({ username: askedName, relation: 'requested' }); // asked hasn't approved me
    expect((await me.get('/api/people/followers')).json.people.find((p: { username: string }) => p.username === followerName).photo).toBeTruthy();
    const requests = (await me.get('/api/people/requests')).json;
    expect(requests.people).toEqual([requesterName]);
    expect(Object.keys(requests.photos)).toEqual([requesterName]); // they reached out to me
    // Their lists.
    expect((await asked.get('/api/people/requests')).json.photos[meName]).toBe(version);
    expect((await requester.get('/api/people/following')).json.people).toEqual([{ username: meName, relation: 'requested' }]);
    expect((await follower.get('/api/people/following')).json.people[0].photo).toBe(version);
    // Search: a stranger gets username and relation only.
    const found = (await stranger.get(`/api/people/search?q=${meName.slice(0, 6)}`)).json.people.find((p: { username: string }) => p.username === meName);
    expect(found).toEqual({ username: meName, relation: 'none' });
    const raw = JSON.stringify((await stranger.get(`/api/people/search?q=${meName.slice(0, 6)}`)).json);
    expect(raw).not.toContain(version);
  });

  it('approving a request reveals it; unfollowing and blocking (either way) end access at once', async () => {
    const [a, b] = [new Browser(), new Browser()];
    const aName = (await signUp(a)).username;
    await signUp(b);
    expect((await setPhoto(a, await newSet(a, 'a'))).status).toBe(200);
    expect((await setPhoto(b, await newSet(b, 'b'))).status).toBe(200);
    const bName = (await b.get('/api/auth/me')).json.user.username;

    await b.post(`/api/people/u/${aName}/follow`);
    expect((await theirPhoto(b, aName)).status).toBe(403); // pending
    await a.post(`/api/people/requests/${bName}/approve`);
    expect((await theirPhoto(b, aName)).status).toBe(200);
    await b.del(`/api/people/u/${aName}/follow`);
    expect((await theirPhoto(b, aName)).status).toBe(403);

    await b.post(`/api/people/u/${aName}/follow`);
    await a.post(`/api/people/requests/${bName}/approve`);
    await a.post(`/api/people/u/${bName}/block`);
    expect((await theirPhoto(b, aName)).status).toBe(403);
    await a.del(`/api/people/u/${bName}/block`);

    // They block me: I lose theirs, and they don't see mine through an old request.
    await a.post(`/api/people/u/${bName}/follow`); // a reached out to b
    expect((await theirPhoto(b, aName)).status).toBe(200);
    expect((await theirPhoto(a, bName)).status).toBe(403); // asking doesn't reveal theirs
    await b.post(`/api/people/u/${aName}/block`);
    expect((await theirPhoto(b, aName)).status).toBe(403);
    expect((await theirPhoto(a, bName)).status).toBe(403);
  });
});

describe('restore and the profile photo (D23)', () => {
  const empty = (): RestorePayload => ({ products: [], logEntries: [] });

  it('a file from before 0.17.0 leaves it alone; a newer file restores it or removes it', async () => {
    const b = new Browser();
    const { username } = await signUp(b);
    const id = userId(username)!;
    const current = await newSet(b, 'current');
    await setPhoto(b, current);

    let r = await b.post('/api/data/restore', empty());
    expect(r.json.profilePhoto).toBe('kept');
    expect((await b.get('/api/auth/me')).json.user.photo.version).toBe(current);

    const restored = await newSet(b, 'restored');
    r = await b.post('/api/data/restore', { ...empty(), profilePhoto: { upload: restored, crop: SQUARE } });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.profilePhoto).toBe('restored');
    expect((await b.get('/api/auth/me')).json.user.photo).toEqual({ version: restored, crop: SQUARE });
    expect(text((await b.raw('/api/profile/photo/original')).bytes)).toBe('restored-original');
    expect(await eventually(() => !r2Keys(`u/${id}/s/${current}/`).length)).toBe(true);

    r = await b.post('/api/data/restore', { ...empty(), profilePhoto: null });
    expect(r.json.profilePhoto).toBe('removed');
    expect((await b.get('/api/auth/me')).json.user.photo).toBeUndefined();
    expect(await eventually(() => r2Keys(`u/${id}/`).length === 0)).toBe(true);
  });

  it('refuses a profile photo that isn’t a fresh upload of yours with its original, changing nothing', async () => {
    const [b, other] = [new Browser(), new Browser()];
    await signUp(b);
    await signUp(other);
    const current = await newSet(b, 'keep');
    await setPhoto(b, current);
    for (const upload of [await newSet(other, 'foreign'), await recropSet(b, 'no-original')]) {
      const r = await b.post('/api/data/restore', { ...empty(), profilePhoto: { upload, crop: SQUARE } });
      expect(r.status).toBe(400);
    }
    expect((await b.post('/api/data/restore', { ...empty(), profilePhoto: { upload: await newSet(b, 'nocrop'), crop: null } })).status).toBe(400);
    expect((await b.get('/api/auth/me')).json.user.photo.version).toBe(current);
  });
});
