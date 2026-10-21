import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// D28 (0.21.0), D64 (0.54.0): scores, ranks, stats tiles, colour badge numbers, rating values and
// value for money use Unbounded, stored with the app (the owner found D28's rounded numbers too
// soft); titles and product names use it too. Prices, amounts and words keep the text font,
// Manrope. Both fonts are really drawn, not a fallback.
let page: Page;
let id = '';

const family = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily);
const rounded = async (sel: string) => expect(await family(sel), sel).toMatch(/^Unbounded, -apple-system/);
const usual = async (sel: string) => expect(await family(sel), sel).toMatch(/^Manrope, -apple-system/);
const display = async (sel: string) => expect(await family(sel), sel).toMatch(/^Unbounded, "Arial Black"/);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `num${Date.now().toString(36).slice(-6)}`);
  const body = { ...emptyProductInput(), name: 'Round Kush', strainType: 'hybrid', country: 'US', ratings: { look: 8.6, smell: 9.1 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }] };
  id = await page.evaluate(async (b) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }).product.id, body);
});
test.afterAll(async () => {
  await page.context().close();
});

test('scores, ranks and tiles use Unbounded; prices and names keep the text font', async () => {
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
  await expect(page.locator('main')).toHaveAttribute('data-band', '2'); // 8.9: Sapphire, #1 (D48)
  for (const sel of ['.hero-score b', '.gem-badge .n', '.rbar .v', '.vfm b']) await rounded(sel);
  for (const sel of ['.hero-price', '.purchase .u']) await usual(sel);
  await display('.hero h1');
  await display('.hdr .title');
  await page.goto(`/products/${id}/edit`);
  await expect(page.locator('.rate-top .val').first()).toBeVisible();
  await rounded('.rate-top .val');
  await usual('.rate-top .l');
});

test('the two fonts are stored with the app and really drawn (D64)', async () => {
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Round Kush' })).toBeVisible();
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['700 20px Unbounded', '600 16px Manrope'].map((f) => document.fonts.check(f));
  });
  expect(loaded).toEqual([true, true]);
  for (const f of ['unbounded', 'manrope']) {
    const r = await page.request.get(`/fonts/${f}.woff2`);
    expect(r.status(), f).toBe(200);
  }
});
