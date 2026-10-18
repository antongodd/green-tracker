import { expect, test, type Page, type Route } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// A slow page load can't undo your change (D55, 0.46.1). Opening a product page asks the
// server for a fresh copy; if you flick Private or tap Set as cover before it arrives, that
// older copy used to land afterwards and put the page (and the app's memory) back as it was.
test.describe.configure({ mode: 'serial' });

let page: Page;
let id: string;

const post = (path: string, body?: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(), { path, body });
const upload = (colour: string) =>
  page.evaluate(async (colour) => {
    const c = document.createElement('canvas');
    [c.width, c.height] = [800, 600];
    const x = c.getContext('2d')!;
    x.fillStyle = colour;
    x.fillRect(0, 0, 800, 600);
    const img = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);
const shown = () => page.locator('.pgrid .pcell img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src.match(/photos\/([^/]+)\//)![1]!));

/**
 * Opens the product from the Leaderboard (so it draws at once from the app's memory) while
 * the page's own fresh copy is fetched from the server straight away but held back: the
 * returned function lets it arrive, old as it is.
 */
async function openWithSlowLoad(): Promise<() => Promise<void>> {
  await page.goto('/');
  const row = page.locator('.row', { hasText: 'Slow Haze' });
  await expect(row).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let arrived!: () => void;
  const done = new Promise<void>((r) => (arrived = r));
  let held = false;
  await page.route(`**/api/products/${id}`, async (route: Route) => {
    if (held || route.request().method() !== 'GET') return route.fallback();
    held = true;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
    arrived();
  });
  await row.click();
  await expect(page.getByRole('switch', { name: /Private/ })).toBeVisible();
  return async () => {
    release();
    await done;
    // Give the late copy time to land on screen if it's going to.
    await page.waitForTimeout(300);
  };
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `slow${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  const photos = [];
  for (const c of ['#7d5a36', '#2c3a5a']) photos.push({ upload: await upload(c), crop: null });
  const input: ProductInput = { ...emptyProductInput(), name: 'Slow Haze', country: 'US', ratings: { look: 8, smell: 8, taste: 8, burn: 8 }, photos };
  id = (await post('/api/products', input)).product.id;
});
test.afterAll(async () => {
  await page.context().close();
});

test('Private stays on when the page’s slower first load arrives after it', async () => {
  const arrive = await openWithSlowLoad();
  const flick = page.getByRole('switch', { name: /Private/ });
  await expect(flick).not.toBeChecked();
  const saved = page.waitForResponse((r) => r.url().endsWith(`/api/products/${id}/private`) && r.ok());
  await flick.check();
  await saved;
  await expect(flick).toBeChecked();
  await arrive();
  await expect(flick).toBeChecked();
  await expect(page.locator('.hero').getByText('Private')).toBeVisible();
  // The app's memory kept it too: the Leaderboard row shows the lock straight away.
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('.row', { hasText: 'Slow Haze' }).getByRole('img', { name: 'Private' })).toBeVisible();
});

test('a new cover stays when the page’s slower first load arrives after it', async () => {
  const arrive = await openWithSlowLoad();
  const [first, second] = await shown();
  await page.getByRole('button', { name: 'Open photo 2' }).click();
  await page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Set as cover' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cover updated' })).toBeVisible();
  expect(await shown()).toEqual([second, first]);
  await arrive();
  expect(await shown()).toEqual([second, first]);
  await expect(page.locator('.hero-photo > img:not(.hero-old)')).toHaveAttribute('src', new RegExp(`/photos/${second}/`));
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('.row', { hasText: 'Slow Haze' }).locator('.thumb img')).toHaveAttribute('src', new RegExp(`/photos/${second}/`));
});
