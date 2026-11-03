import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { settled, signUp } from './helpers';

// Don't lose my work (0.69.2): the product, Log entry and post editors ask "Keep editing / Discard"
// before throwing anything away, on Cancel and on a swipe back from the edge (page.goBack() is what
// the swipe does). With nothing changed they just leave. Save and Post can't be sent twice by a
// double tap, and give up after 20 seconds instead of hanging on a weak signal.
test.describe.configure({ mode: 'serial' });

let page: Page;
let productId: string, entryId: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return r.json();
    },
    { method, path, body },
  );
/** A small real JPEG, uploaded as a photo set from the page (as posts.spec.ts does). */
const upload = () =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#7cbf5a';
    ctx.fillRect(0, 0, 320, 320);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('original', blob, 'original.jpg');
    form.append('cropped', blob, 'cropped.jpg');
    form.append('thumb', blob, 'thumb.jpg');
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });
const sheet = (title: string) => page.getByRole('dialog', { name: title });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `keep${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  productId = (await call('POST', '/api/products', { ...emptyProductInput(), name: 'Lemon Haze', ratings: { look: 8 }, photos: [{ upload: await upload(), crop: null }] })).product.id;
  entryId = (await call('POST', '/api/log', { ...emptyLogEntryInput(), name: 'Loose One' })).entry.id;
});

test('a new product: Cancel with nothing filled in just leaves', async () => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a product' }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a new product: Cancel and a swipe back ask; Keep editing keeps it, Discard throws it away', async () => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a product' }).click();
  await page.getByLabel('Name').fill('Half Done');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet('Discard this product?')).toBeVisible();
  await settled(page);
  await sheet('Discard this product?').getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Half Done');

  // A swipe from the edge puts the editor straight back and asks.
  await page.goBack();
  await expect(sheet('Discard this product?')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/new$/);
  await sheet('Discard this product?').getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Half Done');

  // Asked again after Keep editing; Discard leaves, and nothing was added.
  await page.goBack();
  await sheet('Discard this product?').getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.row', { hasText: 'Lemon Haze' })).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Half Done' })).toHaveCount(0);
});

test('editing a product: a swipe back asks; after Save, leaving doesn’t', async () => {
  await page.goto(`/products/${productId}`);
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await expect(page.getByLabel('Name')).toHaveValue('Lemon Haze');
  // Unchanged: a swipe back just goes back.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByLabel('Name').fill('Lemon Haze OG');
  await page.goBack();
  await expect(sheet('Discard your changes?')).toBeVisible();
  await sheet('Discard your changes?').getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Lemon Haze OG' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a Log entry: Cancel asks once changed, new or saved', async () => {
  await page.goto('/log');
  await page.getByRole('button', { name: 'Add a Log entry' }).click();
  await page.getByLabel('Name').fill('Mystery');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await sheet('Discard this entry?').getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.lrow', { hasText: 'Mystery' })).toHaveCount(0);

  await page.goto(`/log/${entryId}`);
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await expect(page.getByLabel('Name')).toHaveValue('Loose One');
  await page.getByLabel('Name').fill('Loose Two');
  await page.goBack();
  await expect(sheet('Discard your changes?')).toBeVisible();
  await sheet('Discard your changes?').getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(new RegExp(`/log/${entryId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Loose One' })).toBeVisible();
});

test('a post: unchanged from a product’s Post button just leaves; a caption asks on Cancel and on a swipe', async () => {
  await page.goto(`/products/${productId}`);
  await page.getByRole('link', { name: 'Post' }).click();
  await expect(page.getByLabel('Caption')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('link', { name: 'Post' }).click();
  await page.getByLabel('Caption').fill('Lovely stuff');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await sheet('Discard this post?').getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Caption')).toHaveValue('Lovely stuff');
  await page.goBack();
  await expect(sheet('Discard this post?')).toBeVisible();
  await sheet('Discard this post?').getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  expect((await call('GET', '/api/posts/mine')).posts).toHaveLength(0);
});

test('Save tapped twice sends it once', async () => {
  let posts = 0;
  await page.route('**/api/products', async (route) => {
    if (route.request().method() === 'POST') posts++;
    await new Promise((r) => setTimeout(r, 300));
    await route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a product' }).click();
  await page.getByLabel('Name').fill('Twice Tapped');
  // Two taps in the same moment, before the screen can show "Saving…".
  await page.getByRole('button', { name: 'Save' }).evaluate((b: HTMLButtonElement) => (b.click(), b.click()));
  await expect(page.getByRole('heading', { level: 1, name: 'Twice Tapped' })).toBeVisible();
  expect(posts).toBe(1);
  await page.unroute('**/api/products');
});

test('Post that gets no answer stops after 20 seconds and says to check the Feed', async () => {
  await page.clock.install();
  await page.route('**/api/posts', () => {}); // never answers: a dead signal
  await page.goto(`/products/${productId}`);
  await page.getByRole('link', { name: 'Post' }).click();
  await page.getByLabel('Caption').fill('Stuck');
  const post = page.getByRole('button', { name: 'Post', exact: true });
  await expect(post).toBeEnabled();
  await post.click();
  await expect(page.getByRole('button', { name: 'Posting…' })).toBeDisabled();
  await page.clock.runFor(19_000);
  await expect(page.getByRole('button', { name: 'Posting…' })).toBeVisible();
  await page.clock.runFor(2_000);
  await expect(page.getByRole('alert')).toHaveText('That took too long, so it stopped. It may have been saved anyway: check the Feed before you try again.');
  await expect(post).toBeEnabled();
  await page.unroute('**/api/posts');
});
