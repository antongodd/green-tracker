import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// D28 (0.21.0), D64 (0.54.0), D87 (0.76.0): scores, ranks, stats, colour badge numbers, rating values and
// value for money use SF Pro Rounded (ui-rounded, the owner's pick of four, as in Fitness); titles,
// product names, prices, amounts and words use SF Pro (-apple-system). Both are Apple's own, already
// on the iPhone: nothing is downloaded (Chromium here draws its stand-in).
let page: Page;
let id = '';

const family = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily);
const rounded = async (sel: string) => expect(await family(sel), sel).toMatch(/^ui-rounded, "SF Pro Rounded"/);
const usual = async (sel: string) => expect(await family(sel), sel).toMatch(/^-apple-system, BlinkMacSystemFont, "SF Pro Text"/);
const display = async (sel: string) => expect(await family(sel), sel).toMatch(/^-apple-system, BlinkMacSystemFont, "SF Pro Display"/);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `num${Date.now().toString(36).slice(-6)}`);
  const body = { ...emptyProductInput(), name: 'Round Kush', strainType: 'hybrid', country: 'US', ratings: { look: 8.6, smell: 9.1 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }] };
  id = await page.evaluate(async (b) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }).product.id, body);
});
test.afterAll(async () => {
  await page.context().close();
});

test('scores, ranks and tiles use SF Pro Rounded; prices and names keep SF Pro', async () => {
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
  await usual('.hdr .title');
  await page.goto(`/products/${id}/edit`);
  await expect(page.locator('.rate-top .val').first()).toBeVisible();
  await rounded('.rate-top .val');
  await usual('.rate-top .l');
});

test('D87: Apple’s own fonts, so the app downloads no font at all', async () => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font') asked.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Round Kush' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(asked).toEqual([]);
  expect(await page.evaluate(() => document.fonts.size)).toBe(0);
});
