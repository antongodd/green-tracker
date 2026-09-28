import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// D28 (0.21.0): scores, ranks, stats tiles, podium badge numbers, rating values and value for
// money use the iPhone's own rounded font (SF Pro Rounded, `ui-rounded`). Prices, amounts and
// words keep the usual font. Chromium on Linux has no rounded font, so it draws the fallback:
// this checks each number asks for it, not how it looks (the owner checks that on the iPhone).
let page: Page;
let id = '';

const family = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily);
const rounded = async (sel: string) => expect(await family(sel), sel).toMatch(/^ui-rounded, "SF Pro Rounded", -apple-system/);
const usual = async (sel: string) => expect(await family(sel), sel).toMatch(/^-apple-system/);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `num${Date.now().toString(36).slice(-6)}`);
  const body = { ...emptyProductInput(), name: 'Round Kush', strainType: 'hybrid', country: 'US', ratings: { look: 8.6, smell: 9.1 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }] };
  id = await page.evaluate(async (b) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }).product.id, body);
});
test.afterAll(async () => {
  await page.context().close();
});

test('scores, ranks and tiles use the rounded numbers; prices and names keep the usual font', async () => {
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Round Kush' })).toBeVisible();
  for (const sel of ['.row .score b', '.row .rk', '.tile b']) await rounded(sel);
  for (const sel of ['.row .name', '.meta .price', '.tile .cap']) await usual(sel);
  await page.goto('/log');
  await expect(page.locator('.tile b').first()).toBeVisible();
  await rounded('.tile b');
});

test('on the product page and in the editor too', async () => {
  await page.goto(`/products/${id}`);
  await expect(page.locator('main')).toHaveAttribute('data-podium', '1');
  for (const sel of ['.hero-score b', '.podium-badge .n', '.rbar .v', '.vfm b']) await rounded(sel);
  for (const sel of ['.hero h1', '.hero-price', '.purchase .u']) await usual(sel);
  await page.goto(`/products/${id}/edit`);
  await expect(page.locator('.rate-top .val').first()).toBeVisible();
  await rounded('.rate-top .val');
  await usual('.rate-top .l');
});
