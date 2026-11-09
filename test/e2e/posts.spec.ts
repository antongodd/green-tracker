import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { settled, shot, signUp, wholeScreenContrastFailures } from './helpers';

// Posts, comments and the Feed (D77): one journey through two accounts, as Anton will try it on GT Dev.
// Post from a product page; it shows in the Feed; a follower gives a fire and comments; the poster sees
// it. Then the Private product sheet, the friend's page tabs, and readability in a dark and a light look.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
let productId: string, privateId: string;
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
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
const upload = (page: Page, colour: string, original = true) =>
  page.evaluate(
    async ({ colour, original }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1a1f1a';
      ctx.fillRect(0, 0, 640, 640);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(320, 330, 190, 0, Math.PI * 2);
      ctx.fill();
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
      const form = new FormData();
      if (original) form.append('original', blob, 'original.jpg');
      form.append('cropped', blob, 'cropped.jpg');
      form.append('thumb', blob, 'thumb.jpg');
      return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
    },
    { colour, original },
  );

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  return { page, name };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'poster'));
  ({ page: fan, name: fanName } = await person(browser, 'friend'));
  const made = await call(owner, 'POST', '/api/products', P({ name: 'Lemon Haze', strainType: 'hybrid', country: 'NL', source: 'Green Leaf Co.', ratings: { look: 9.2, smell: 9.1, taste: 9, burn: 9 }, photos: [{ upload: await upload(owner, '#7cbf5a'), crop: null }] }));
  productId = made.product.id;
  const hidden = await call(owner, 'POST', '/api/products', P({ name: 'Purple Punch', private: true, ratings: { look: 8.6 }, photos: [{ upload: await upload(owner, '#8a5cc7'), crop: null }] }));
  privateId = hidden.product.id;
  await call(fan, 'POST', `/api/people/u/${ownerName}/follow`);
  await call(owner, 'POST', `/api/people/requests/${fanName}/approve`);
});

test('the tab bar has Feed in People’s place; People is the button at the top of the Feed', async () => {
  await owner.goto('/');
  const tabs = owner.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['Leaderboard', 'Strainz', 'Sources', 'Feed']); // Settings: your photo, top right (D87)
  await owner.getByRole('link', { name: 'Feed' }).click();
  await expect(owner).toHaveURL(/\/feed$/);
  await expect(owner.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
  await settled(owner);
  await shot(owner, 'posts-01-empty-feed');
  await owner.getByRole('link', { name: 'People', exact: true }).click();
  await expect(owner).toHaveURL(/\/people$/);
  await expect(owner.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page');
  await owner.getByRole('link', { name: 'Back' }).click();
  await expect(owner).toHaveURL(/\/feed$/);
});

test('post from a product page: its cover, a caption, then the Feed with the post at the top', async () => {
  await owner.goto(`/products/${productId}`);
  await owner.getByRole('link', { name: 'Post' }).click();
  await expect(owner).toHaveURL(new RegExp(`/feed/new/p/${productId}$`));
  await expect(owner.locator('.compose-photo img')).toBeVisible();
  await expect(owner.locator('.row.about')).toContainText('Lemon Haze');
  await owner.getByLabel('Caption').fill('Sunday afternoon with this one.\nSmells like actual lemons.');
  await settled(owner);
  await shot(owner, 'posts-02-composer');
  await owner.getByRole('button', { name: 'Post' }).click();
  await expect(owner).toHaveURL(/\/feed$/);
  const first = owner.locator('.post').first();
  await expect(first).toContainText('Sunday afternoon with this one.');
  await expect(first.locator('.row.about')).toContainText('9.1');
  await expect(first.locator('.post-photo img')).toHaveJSProperty('complete', true);
  await settled(owner);
  await shot(owner, 'posts-03-feed');
});

test('a follower sees it in their Feed, gives a fire and comments; the poster sees both', async () => {
  await fan.goto('/feed');
  const post = fan.locator('.post', { hasText: 'Sunday afternoon' });
  await expect(post).toBeVisible();
  // The card opens the poster's product, in their look.
  await expect(post.locator('a.row.about')).toHaveAttribute('href', `/u/${ownerName}/p/${productId}`);
  await post.getByRole('button', { name: 'Give a fire' }).click();
  await expect(post.getByRole('button', { name: 'Give a fire' })).toHaveAttribute('aria-pressed', 'true');
  await expect(post.locator('.act.count')).toHaveText('1');
  await post.getByRole('link', { name: 'Open the post' }).click();
  await expect(fan).toHaveURL(/\/posts\//);
  await expect(fan.locator('.comment-box .who-sees')).toHaveText(`Everyone who follows @${ownerName} sees your comment and your @name.`);
  await fan.getByRole('textbox', { name: 'Add a comment' }).fill('Need to try this');
  await fan.getByRole('button', { name: 'Send' }).click();
  await expect(fan.locator('.cmt', { hasText: 'Need to try this' })).toBeVisible();
  await settled(fan);
  await shot(fan, 'posts-04-post-page');

  await owner.reload();
  const mine = owner.locator('.post', { hasText: 'Sunday afternoon' });
  await expect(mine.locator('.post-cmts')).toContainText('Need to try this');
  await expect(mine.locator('.act.count')).toHaveText('1');
  await mine.locator('.act.count').click();
  await expect(owner.getByRole('dialog', { name: 'Who gave a fire' })).toContainText(`@${fanName}`);
});

test('a Private product: the sheet, then “Make visible and post” does both', async () => {
  await owner.goto(`/feed/new/p/${privateId}`);
  await expect(owner.locator('.compose-photo img')).toBeVisible();
  await owner.getByRole('button', { name: 'Post' }).click();
  const sheet = owner.getByRole('dialog', { name: 'This product is private.' });
  await expect(sheet).toContainText('Your followers can’t see it. Make it visible and post it?');
  await settled(owner);
  await shot(owner, 'posts-05-private-sheet');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  expect((await call(owner, 'GET', `/api/products/${privateId}`)).product.private).toBe(true);
  await owner.getByRole('button', { name: 'Post' }).click();
  await owner.getByRole('button', { name: 'Make visible and post' }).click();
  await expect(owner).toHaveURL(/\/feed$/);
  expect((await call(owner, 'GET', `/api/products/${privateId}`)).product.private).toBe(false);
  await expect(owner.locator('.post').first().locator('.row.about')).toContainText('Purple Punch');
});

test('from the Feed’s + button: what’s it about, then just a photo needs a photo first', async () => {
  await owner.goto('/feed');
  await owner.getByRole('button', { name: 'New post' }).click();
  await expect(owner.getByRole('dialog', { name: 'What’s this about?' })).toBeVisible();
  // Your Leaderboard to pick from, newest first (0.67.1): Purple Punch was added after Lemon Haze.
  await owner.getByRole('button', { name: 'Something on my Leaderboard' }).click();
  await expect(owner.locator('.pick-list .pick b')).toHaveText(['Purple Punch', 'Lemon Haze']);
  await owner.getByRole('button', { name: 'Back' }).click();
  await owner.getByRole('button', { name: 'Just a photo' }).click();
  await expect(owner.getByRole('button', { name: 'Post' })).toBeDisabled();
  await expect(owner.getByText('Add a photo to post')).toBeVisible();
  await expect(owner.locator('.compose-safe')).toHaveText('Your followers see these photos. Leave out faces, places and anything with a name or number.');
});

test('a friend’s page: Leaderboard | Posts, in their look; /u/<them>/posts opens on Posts', async () => {
  await call(owner, 'PUT', '/api/appearance', { look: 'neon', top: 'strip', preset: 'aurora', markFirst: true });
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.getByRole('tab', { name: 'Leaderboard' })).toHaveAttribute('aria-selected', 'true');
  await expect(fan.locator('.row').first()).toBeVisible();
  await fan.getByRole('tab', { name: 'Posts' }).click();
  await expect(fan).toHaveURL(new RegExp(`/u/${ownerName}/posts$`));
  await expect(fan.locator('.post')).toHaveCount(2);
  await expect(fan.locator('html')).toHaveAttribute('data-look', 'neon');
  await settled(fan);
  await shot(fan, 'posts-06-friend-posts');
  await fan.reload();
  await expect(fan.getByRole('tab', { name: 'Posts' })).toHaveAttribute('aria-selected', 'true');
  await call(owner, 'PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
});

test('your own page from People: the same two tabs, your posts with Edit and Delete', async () => {
  await owner.goto('/people');
  await owner.getByRole('link', { name: 'Your page' }).click();
  await expect(owner).toHaveURL(new RegExp(`/u/${ownerName}$`));
  await owner.getByRole('tab', { name: 'Posts' }).click();
  const first = owner.locator('.post').first();
  await first.getByRole('button', { name: 'Your post’s actions' }).click();
  await owner.getByRole('button', { name: 'Edit caption' }).click();
  await owner.getByRole('textbox', { name: 'Edit caption' }).fill('Rainy day sorted.');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(first.locator('.post-caption')).toHaveText('Rainy day sorted.');
  await expect(first).toContainText('edited');
});

test('several photos (D78): add the product’s second photo, post, then swipe through them; the card shows its cover', async () => {
  const two = await call(owner, 'POST', '/api/products', P({ name: 'Two Shots', ratings: { look: 8.2 }, photos: [{ upload: await upload(owner, '#d9c45a'), crop: null }, { upload: await upload(owner, '#5ab0d9'), crop: null }] }));
  await owner.goto(`/feed/new/p/${two.product.id}`);
  await expect(owner.locator('.compose-photos .pslot')).toHaveCount(1);
  await owner.getByRole('button', { name: 'Its photo 2' }).click();
  await expect(owner.locator('.compose-photos .pslot')).toHaveCount(2);
  await expect(owner.locator('.compose-photo .photo-count')).toHaveText('1/2');
  await settled(owner);
  await shot(owner, 'posts-08-composer-two');
  await owner.getByRole('button', { name: 'Post' }).click();
  await expect(owner).toHaveURL(/\/feed$/);
  const first = owner.locator('.post').first();
  await expect(first.locator('.post-photo img')).toHaveCount(2);
  await expect(first.locator('.photo-count')).toHaveText('1/2');
  await expect(first.locator('.photo-dots span')).toHaveCount(2);
  // The card's thumbnail is the product's cover, not the icon.
  await expect(first.locator('.row.about .thumb img')).toHaveCount(1);
  await first.locator('.track').evaluate((t) => t.scrollTo({ left: t.clientWidth }));
  await expect(first.locator('.photo-count')).toHaveText('2/2');
  await expect(first.locator('.photo-dots span.on')).toHaveCount(1);
  // Both photos are the same height (the first one's shape).
  const heights = await first.locator('.post-photo img').evaluateAll((imgs) => imgs.map((i) => Math.round(i.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);
  await settled(owner);
  await shot(owner, 'posts-09-feed-two');
});

for (const look of ['aurora', 'sakura', 'daysky'] as const) {
  test(`readable and accessible in ${look}: the Feed, a post’s page and the composer`, async () => {
    test.slow();
    await call(fan, 'PUT', '/api/appearance', { look, top: 'strip', preset: 'aurora', markFirst: true });
    await fan.goto('/feed');
    await expect(fan.locator('.post').first()).toBeVisible();
    await expect(fan.locator('.post-photo img').first()).toHaveJSProperty('complete', true);
    await settled(fan);
    expect((await new AxeBuilder({ page: fan }).analyze()).violations).toEqual([]);
    expect(await wholeScreenContrastFailures(fan, '/feed', '.post-who .u, .post-caption, .post-cmts p, .row.about .name, .row.about .ptype, .row.about .meta, .row.about .score b, .row.about .score .cap, .post-acts .act.count, .friends-row .t b, .friends-row .t small, .friends-row .go')).toEqual([]);
    await fan.locator('.post', { hasText: 'Sunday afternoon' }).getByRole('link', { name: 'Open the post' }).click();
    await expect(fan.locator('.cmt').first()).toBeVisible();
    await settled(fan);
    expect((await new AxeBuilder({ page: fan }).analyze()).violations).toEqual([]);
    await fan.goto('/feed/new');
    await fan.getByRole('button', { name: 'Just a photo' }).click();
    await settled(fan);
    expect((await new AxeBuilder({ page: fan }).analyze()).violations).toEqual([]);
    if (look === 'daysky') await shot(fan, 'posts-07-feed-daysky');
  });
}

test.afterAll(async () => {
  await call(fan, 'PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
});
