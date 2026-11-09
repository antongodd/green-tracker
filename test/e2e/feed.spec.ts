import { expect, test, type Browser, type Page } from '@playwright/test';
import { settled, shot, signUp } from './helpers';

// The Feed and a post, made quicker and easier to tap (0.69.9, job 4 of the 2026-11-03 review):
// only the first post's photo loads at once; the 🔥 count, "View all N comments" and "more" are 44
// points; the comment box is solid and the last comment scrolls clear of it; tapping the Feed tab
// again goes to the top and fetches new posts; coming back to the app does too, and the badge catches up.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return r.json();
    },
    { method, path, body },
  );
/** A small real JPEG, uploaded as a photo set from the page. */
const upload = (page: Page, colour: string) =>
  page.evaluate(async (colour) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 600, 600);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('cropped', blob, 'cropped.jpg');
    form.append('thumb', blob, 'thumb.jpg');
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);
const post = async (page: Page, caption: string, colour = '#4f8a4f') => {
  const r = await call(page, 'POST', '/api/posts', { caption, about: null, photo: { upload: await upload(page, colour) } });
  expect(r.post?.id, JSON.stringify(r)).toBeTruthy();
  return r.post.id as string;
};
/** The app going to the background and coming back (iOS fires visibilitychange; the test browser never hides). */
const backToFront = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  return { page, name };
}

let firstId: string;
test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'feedo'));
  ({ page: fan, name: fanName } = await person(browser, 'feedf'));
  await call(fan, 'POST', `/api/people/u/${ownerName}/follow`);
  await call(owner, 'POST', `/api/people/requests/${fanName}/approve`);
  // The oldest post gets three comments ("View all 3 comments") and a long caption ("more").
  firstId = await post(owner, `${'A long one. '.repeat(20)}The end.`, '#7cbf5a');
  for (const body of ['Need to try this one', 'Looks great', 'Where from?']) await call(fan, 'POST', `/api/posts/${firstId}/comments`, { body });
  for (let i = 1; i <= 5; i++) await post(owner, `Post number ${i}`, ['#c75a5a', '#5a7cc7', '#c7b25a', '#8a5cc7', '#5ac7b2'][i - 1]);
});

test('only the first post’s photo loads at once; every other photo waits until it scrolls near', async () => {
  await fan.goto('/feed');
  const imgs = fan.locator('.posts .post-photo img');
  await expect(imgs).toHaveCount(6);
  const loading = await imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).loading));
  expect(loading).toEqual(['auto', 'lazy', 'lazy', 'lazy', 'lazy', 'lazy']);
  // A post's own page shows its photo at once.
  await fan.goto(`/posts/${firstId}`);
  await expect(fan.locator('.post-photo img').first()).toHaveJSProperty('loading', 'auto');
});

test('the 🔥 count, “View all 3 comments” and “more” are 44 points, and the count sits apart from the 🔥', async () => {
  await fan.goto('/feed');
  const card = fan.locator('.post', { hasText: 'The end.' });
  await card.scrollIntoViewIfNeeded();
  await call(fan, 'PUT', `/api/posts/${firstId}/fire`);
  await fan.reload();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.act.count')).toHaveText('1');
  const size = async (sel: string) => (await card.locator(sel).boundingBox())!;
  for (const sel of ['.act.count', '.post-cmts .all', '.more-text']) {
    const b = await size(sel);
    expect(b.height, sel).toBeGreaterThanOrEqual(44);
    expect(b.width, sel).toBeGreaterThanOrEqual(44);
  }
  await expect(card.locator('.post-cmts .all')).toHaveText('View all 3 comments');
  const fire = await size('.act.fire');
  const count = await size('.act.count');
  expect(count.x - (fire.x + fire.width)).toBeGreaterThanOrEqual(4);
});

test('the comment box is solid, and the last comment scrolls clear of it at any width', async () => {
  for (const width of [390, 320]) {
    await fan.setViewportSize({ width, height: 700 });
    await fan.goto(`/posts/${firstId}`);
    await expect(fan.locator('.cmt')).toHaveCount(3);
    const box = fan.locator('.comment-box');
    const style = await box.evaluate((e) => {
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, blur: s.backdropFilter };
    });
    expect(style.bg, 'no see-through colour').not.toMatch(/rgba\(.*,\s*0?\.\d+\)$/);
    expect(style.blur).toBe('none');
    // The line under the box (who sees your comment) is inside it.
    const b = (await box.boundingBox())!;
    const line = (await box.locator('.who-sees').boundingBox())!;
    expect(line.y + line.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
    await fan.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => fan.evaluate(() => Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);
    const last = (await fan.locator('.cmt').last().boundingBox())!;
    expect(last.y + last.height, `${width}px`).toBeLessThanOrEqual(b.y);
  }
  await settled(fan);
  await shot(fan, 'feed-01-comment-box');
  await fan.setViewportSize({ width: 390, height: 844 });
});

test('tapping the Feed tab while on the Feed goes to the top and shows a new post', async () => {
  await fan.goto('/feed');
  await expect(fan.locator('.posts .post')).toHaveCount(6);
  await fan.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => fan.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await post(owner, 'Fresh from the tab');
  const feed = fan.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Feed' });
  await feed.click();
  await expect(fan).toHaveURL(/\/feed$/);
  await expect(fan.locator('.posts .post').first()).toContainText('Fresh from the tab');
  await expect.poll(() => fan.evaluate(() => window.scrollY)).toBe(0);
  await expect(fan.locator('.posts .post')).toHaveCount(7);
  // Tapped again at the top: still one of each post.
  await feed.click();
  await expect(fan.locator('.posts .post')).toHaveCount(7);
});

test('coming back to the app: the Feed shows what’s new, in its place, and the follow requests number catches up', async () => {
  await fan.goto('/feed');
  await expect(fan.locator('.posts .post')).toHaveCount(7);
  await post(owner, 'Posted while you were away');
  await backToFront(fan);
  await expect(fan.locator('.posts .post').first()).toContainText('Posted while you were away');
  await expect(fan.locator('.posts .post')).toHaveCount(8);

  // Scrolled down, the post you were reading stays where it was as a new one comes in above.
  const reading = fan.locator('.post', { hasText: 'Post number 2' });
  await reading.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 200));
  await expect.poll(async () => Math.round((await reading.boundingBox())!.y)).toBe(200);
  await post(owner, 'Another while away');
  await backToFront(fan);
  await expect(fan.locator('.posts .post')).toHaveCount(9);
  expect(Math.abs((await reading.boundingBox())!.y - 200)).toBeLessThanOrEqual(2);

  // On another tab, a new follow request shows on the Feed tab once the app is back.
  await fan.goto('/');
  const tab = fan.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Feed/ });
  await expect(tab.locator('.badge:not(.dot)')).toHaveCount(0);
  await call(owner, 'POST', `/api/people/u/${fanName}/follow`);
  await backToFront(fan);
  await expect(tab.locator('.badge:not(.dot)')).toHaveText('1');
});

test('each post is its own card with a gap between, and the Friends row at the top opens People (D95)', async () => {
  // By now the owner has asked to follow the fan (the test above), so the fan has 1 follow request.
  await fan.setViewportSize({ width: 390, height: 844 });
  await fan.goto('/feed');
  const posts = fan.locator('.posts .post');
  await expect(posts).toHaveCount(9);
  await settled(fan);

  // A card: an edge and a pane of its own, rounded, the photo inside it, and clear space before the next one.
  const card = await posts.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { edge: s.borderTopWidth, bg: s.backgroundColor + s.backgroundImage, radius: parseFloat(s.borderTopLeftRadius), filter: s.backdropFilter };
  });
  expect(card.edge).toBe('1px');
  expect(card.bg).not.toBe('rgba(0, 0, 0, 0)none');
  expect(card.radius).toBeGreaterThanOrEqual(20);
  expect(card.filter).toBe('none'); // a sheet inside a card with a backdrop-filter is placed in the card
  const [a, b] = [(await posts.nth(0).boundingBox())!, (await posts.nth(1).boundingBox())!];
  expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(10);
  const photo = (await posts.first().locator('.post-photo').boundingBox())!;
  expect(photo.x).toBeGreaterThan(a.x);
  expect(photo.x + photo.width).toBeLessThan(a.x + a.width);

  // The Friends row: above the first post, the icon, the one person followed, the request, People ›, on one line.
  const row = fan.getByRole('link', { name: 'Friends. You follow 1 person. 1 follow request' });
  await expect(row).toBeVisible();
  await expect(row.locator('.ico svg')).toHaveCount(1);
  await expect(row.locator('.ico .badge')).toHaveText('1');
  await expect(row.locator('.faces .av')).toHaveCount(1);
  await expect(row.locator('.go')).toHaveText('People ›');
  const r = (await row.boundingBox())!;
  expect(r.y + r.height).toBeLessThanOrEqual(a.y);
  expect(r.height).toBeLessThanOrEqual(72);
  expect(r.x + r.width).toBeLessThanOrEqual(390);
  // The icon in the header stays, for once the row has scrolled away.
  await expect(fan.getByRole('link', { name: 'People, 1 follow request' })).toBeVisible();
  await shot(fan, 'feed-02-cards-friends');

  await row.click();
  await expect(fan).toHaveURL(/\/people$/);

  // Following nobody: the row says so, with no photos.
  await owner.goto('/feed');
  const own = owner.getByRole('link', { name: 'Friends. Find people to follow' });
  await expect(own).toBeVisible();
  await expect(own.locator('.faces')).toHaveCount(0);
});
