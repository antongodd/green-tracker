import { expect, test, type Page, type Route } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// D37 (0.30.0): while a screen waits for its data, faint shapes laid out like the screen show
// (after 250ms, so quick loads never flicker), with a soft light sweeping across (none under
// Reduce Motion); screen readers hear "Loading"; the real screen (or the error) replaces them.
test.describe.configure({ mode: 'serial' });
let page: Page;
let name = '';
let id = '';

/** Holds back the next GET matching `url` until released (or answers it with an error); later requests pass. */
async function hold(url: string | RegExp, fail = false) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let used = false;
  await page.route(url, async (route: Route) => {
    if (used || route.request().method() !== 'GET') return route.fallback();
    used = true;
    await gate;
    if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server_error', message: 'Something went wrong.' }) });
    return route.fallback();
  });
  return async () => release();
}

const placeholder = () => page.getByRole('status', { name: 'Loading' });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  name = await signUp(page, `ld${Date.now().toString(36).slice(-6)}`);
  id = await page.evaluate(async (b) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }).product.id, { ...emptyProductInput(), name: 'Slow Kush', ratings: { look: 8 } });
});

test('a slow Leaderboard shows its shapes with the sweep, then the real rows', async () => {
  const release = await hold('**/api/products');
  await page.goto('/');
  await expect(placeholder()).toBeVisible();
  const skel = page.locator('.skel-board');
  await expect(skel.locator('.sk-row')).toHaveCount(6);
  await expect(skel.locator('.sk-tile')).toHaveCount(3);
  expect(await skel.locator('.sk').first().evaluate((e) => getComputedStyle(e, '::after').animationName)).toBe('sk-sweep');
  await page.screenshot({ path: '.playwright/screens/98-loading-board.png' });
  await release();
  await expect(page.locator('.row', { hasText: 'Slow Kush' })).toBeVisible();
  await expect(placeholder()).toHaveCount(0);
});

test('nothing shows for the first moment, so a quick load never flickers', async () => {
  const release = await hold('**/api/products');
  await page.goto('/');
  await expect(page.locator('main.screen')).toBeVisible();
  // Just after the screen appears, still waiting: no shapes yet (they wait 250ms).
  expect(await page.evaluate(() => !!document.querySelector('.skel'))).toBe(false);
  await expect(placeholder()).toBeVisible();
  await release();
  await expect(page.locator('.row', { hasText: 'Slow Kush' })).toBeVisible();
});

test('Reduce Motion: the shapes stay still', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const release = await hold('**/api/products');
  await page.goto('/');
  await expect(placeholder()).toBeVisible();
  expect(await page.locator('.sk').first().evaluate((e) => getComputedStyle(e, '::after').animationName)).toBe('none');
  await release();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('if loading fails, the error replaces the shapes', async () => {
  const release = await hold('**/api/products', true);
  await page.goto('/');
  await expect(placeholder()).toBeVisible();
  await release();
  await expect(page.getByRole('heading', { name: 'Couldn’t load your products' })).toBeVisible();
  await expect(placeholder()).toHaveCount(0);
});

test('the Log, a product page and the People lists each have their own shapes', async () => {
  let release = await hold('**/api/log');
  await page.goto('/log');
  await expect(page.locator('.skel-log')).toBeVisible();
  await expect(page.locator('.skel-log .sk-gh')).toHaveCount(2);
  await release();
  await expect(placeholder()).toHaveCount(0);

  release = await hold(`**/api/products/${id}`);
  await page.goto(`/products/${id}`);
  await expect(page.locator('.skel-product .sk-hero')).toBeVisible();
  await expect(page.locator('.skel-product .sk-bar')).toHaveCount(4);
  await page.screenshot({ path: '.playwright/screens/99-loading-product.png' });
  await release();
  await expect(page.locator('.hero h1')).toHaveText('Slow Kush');
  await expect(placeholder()).toHaveCount(0);

  release = await hold('**/api/people/following');
  await page.goto('/people');
  await page.getByRole('tab', { name: /Following/ }).click();
  await expect(page.locator('.skel-people .sk-th.round')).toHaveCount(3);
  await release();
  await expect(page.getByRole('heading', { name: 'Not following anyone' })).toBeVisible();
  await expect(placeholder()).toHaveCount(0);
});

test('a friend’s board shows the Leaderboard shapes while it loads', async ({ browser }) => {
  const friend = await (await browser.newContext()).newPage();
  const friendName = await signUp(friend, `fr${Date.now().toString(36).slice(-6)}`);
  await page.evaluate(async (u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), friendName);
  await friend.evaluate(async (u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), name);
  const release = await hold(new RegExp(`/api/people/u/${friendName}$`));
  await page.goto(`/u/${friendName}`);
  await expect(page.locator('.skel-board')).toBeVisible();
  await release();
  await expect(page.getByRole('heading', { name: 'Nothing to see yet' })).toBeVisible();
  await expect(placeholder()).toHaveCount(0);
  await friend.context().close();
});
