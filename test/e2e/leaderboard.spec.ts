import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { shot, signUp } from './helpers';

// One account for the file (sign-up is rate-limited), seeded through the real API.
// Expected figures are worked by hand from the brief's rules.
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const SEED: ProductInput[] = [
  P({ name: 'Gelato 41', strainType: 'hybrid', country: 'US', source: 'Cookies', dateTried: '2026-09-14', ratings: { look: 9.2, smell: 9, taste: 8.8, burn: 8.6, high: 9.4 }, purchases: [{ date: '2026-09-14', amount: 3.5, totalPaid: 9.5, supplier: null }] }), // 8.9
  P({ name: 'Lemon Cherry Gelato', strainType: 'hybrid', country: 'CA', source: 'Grasshopper Farms Craft Collective', ratings: { look: 8.6, smell: 8.9, taste: 8.7, burn: 8.2 }, purchases: [{ date: '2026-09-01', amount: 7, totalPaid: 17.5, supplier: null }] }), // 8.6
  P({ name: 'Blue Zushi Live Rosin', productType: 'concentrate', concentrateType: 'live_rosin', strainType: 'indica', country: 'US', ratings: { look: 8.4, smell: 8.5, taste: 8.6, burn: 8.2 }, purchases: [{ date: '2026-08-01', amount: 1, totalPaid: 45, supplier: null }] }), // 8.425, no Consistency
  P({ name: 'Peach Rings Gummies', productType: 'edibles', strainType: 'sativa', country: 'CA', source: 'Wana', private: true, ratings: { taste: 7.2, high: 8.7 }, purchases: [{ date: '2026-09-06', amount: 100, totalPaid: 12, supplier: null }] }), // 8.2
  P({ name: 'Camino Midnight Blueberry', productType: 'edibles', country: 'US', source: 'Kiva', ratings: { taste: 8, high: 8.5 }, purchases: [{ date: '2026-09-02', amount: 100, totalPaid: 18, supplier: null }] }), // 8.333
  P({ name: 'Chocolate Brownie', productType: 'edibles', country: 'NL', ratings: { taste: 6, high: 9 }, purchases: [{ date: '2026-09-03', amount: 100, totalPaid: 5, supplier: null }] }), // 8.0
  P({ name: 'Moroccan Hash', productType: 'concentrate', country: 'MA', ratings: { look: 7.6, consistency: 7.8, smell: 7.2, taste: 7.5, burn: 7.4 }, purchases: [{ date: '2026-07-01', amount: 1, totalPaid: 8, supplier: null }] }), // 7.5
  P({ name: 'Mystery Sample', productType: 'other', dateTried: '2026-08-12' }), // unrated
  ...Array.from({ length: 8 }, (_, i) => P({ name: `Filler ${String(i + 1).padStart(2, '0')}`, ratings: { look: 5 + i / 10 } })), // 5.0 … 5.7
];

let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page);
  for (const body of SEED) {
    const status = await page.evaluate(async (b) => (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status, body);
    expect(status).toBe(201);
  }
});
test.afterAll(() => context.close());

const rows = () => page.locator('.row');
const tile = (label: string) => page.locator('.tile', { hasText: label }).locator('b');
const pill = (name: 'Rank by' | 'Type') => page.getByLabel(name, { exact: true });
const pillBox = (name: 'Rank by' | 'Type') => pill(name).locator('..');

test('default: Overall, all types; podium, tiles, unrated last', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);
  await expect(rows().nth(0)).toContainText('Gelato 41');
  await expect(rows().nth(0)).toHaveClass(/p1/);
  await expect(rows().nth(1)).toHaveClass(/p2/);
  await expect(rows().nth(2)).toHaveClass(/p3/);
  await expect(rows().nth(15)).toContainText('Mystery Sample');
  await expect(rows().nth(15)).toContainText('Unrated');
  await expect(tile('Products')).toHaveText('16');
  await expect(tile('Average')).toHaveText('6.7'); // 100.758 ÷ 15 rated
  await expect(tile('Total')).toHaveText('12.5g'); // 3.5 + 7 + 1 + 1; no edibles
  await expect(pillBox('Rank by')).not.toHaveClass(/active/);
  await expect(pillBox('Type')).not.toHaveClass(/active/);
  await shot(page, '20-leaderboard');
});

test('filter to Edibles: ranks renumber, podium follows, tiles recalculate, TOTAL 0g', async () => {
  await pill('Type').selectOption('edibles');
  await expect(pillBox('Type')).toHaveClass(/active/);
  await expect(pillBox('Type')).toContainText('Type: Edibles');
  await expect(rows()).toHaveCount(3);
  await expect(rows().nth(0)).toContainText('Camino Midnight Blueberry');
  await expect(rows().nth(0).locator('.rk')).toHaveText('1');
  await expect(rows().nth(0)).toHaveClass(/p1/);
  await expect(tile('Products')).toHaveText('3');
  await expect(tile('Average')).toHaveText('8.2');
  await expect(tile('Total')).toHaveText('0g');
});

test('Rank by Price per mg: highest first, relabelled score, price also on the metadata line', async () => {
  await pill('Rank by').selectOption('price');
  await expect(pillBox('Rank by')).toHaveClass(/active/);
  await expect(rows().nth(0).locator('.score')).toHaveText(/£0\.18\s*Price/i);
  await expect(rows().nth(1).locator('.score')).toHaveText(/£0\.12\s*Price/i);
  await expect(rows().nth(2).locator('.score')).toHaveText(/£0\.05\s*Price/i);
  await expect(rows().nth(0).locator('.meta')).toContainText('£0.18/mg');
  await shot(page, '21-edibles-price');
});

test('the view is remembered on this device', async () => {
  await page.reload();
  await expect(pillBox('Type')).toContainText('Edibles');
  await expect(pillBox('Rank by')).toContainText(/Price/);
  await expect(rows()).toHaveCount(3);
});

test('Rank by Consistency under Concentrate hides concentrates without it', async () => {
  await pill('Type').selectOption('concentrate');
  await pill('Rank by').selectOption('consistency');
  await expect(rows()).toHaveCount(1);
  await expect(rows().nth(0)).toContainText('Moroccan Hash');
  await expect(rows().nth(0).locator('.score')).toHaveText(/7\.8\s*Consistency/i);
  await expect(tile('Products')).toHaveText('1');
});

test('a Rank by that the new filter lacks falls back to Overall and overwrites the stored setting', async () => {
  await pill('Type').selectOption('all');
  await pill('Rank by').selectOption('look');
  await pill('Type').selectOption('edibles');
  await expect(pill('Rank by')).toHaveValue('overall');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gt.view')!))).toEqual({ filter: 'edibles', rankBy: 'overall' });
});

test('empty states: filtered, and ranking (which wins when both apply)', async () => {
  await pill('Type').selectOption('pre_roll');
  await expect(page.getByRole('heading', { name: 'No Pre roll yet' })).toBeVisible();
  await expect(page.getByText('You have 16 products, but none are Pre roll.')).toBeVisible();
  await expect(tile('Products')).toHaveText('0');
  await shot(page, '22-filtered-empty');

  await pill('Rank by').selectOption('smell');
  await expect(page.getByRole('heading', { name: 'Nothing rated on Smell' })).toBeVisible();
  await expect(page.getByText('None of your Pre roll products has a Smell rating yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Rank by Overall' }).click();
  await expect(pill('Rank by')).toHaveValue('overall');
  await expect(page.getByRole('heading', { name: 'No Pre roll yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all types' }).click();
  await expect(rows()).toHaveCount(16);
});

test('labels fit at 375px for every filter × Rank by combination; short forms only where measured', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  const compacted: string[] = [];
  const types = await pill('Type').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  for (const t of types) {
    await pill('Type').selectOption(t);
    const ranks = await pill('Rank by').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    for (const r of ranks) {
      await pill('Rank by').selectOption(r);
      const m = await page.locator('.controls').evaluate((el) => ({ overflow: el.scrollWidth > el.clientWidth + 1, text: el.textContent }));
      expect(m.overflow, `${t} × ${r}`).toBe(false);
      if (/VFM|Consis\.|Price\/|Conc\./.test(m.text ?? '')) compacted.push(`${t} × ${r}: ${m.text}`);
    }
  }
  console.log(`Abbreviated at 375px (${compacted.length}):\n${compacted.join('\n')}`);
  // At the design width (390px) and above, every combination the brief expects to be
  // tight still gets full labels unless measured otherwise — recorded in SPEC.
  await page.setViewportSize({ width: 390, height: 844 });
  await pill('Type').selectOption('all');
  await pill('Rank by').selectOption('overall');
});

test('coming back from a product lands on the tapped row; tab switches start at the top', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);

  // A row already visible at the top: the page stays at the top.
  await rows().nth(1).click();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(rows()).toHaveCount(16);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // A row further down: back puts it at roughly the same screen position.
  const target = rows().nth(12);
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(100);
  const before = (await target.boundingBox())!.y;
  const name = (await target.locator('.name').textContent())!;
  // Tap it where it is (Playwright's click would scroll it first).
  await target.evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  const row = page.locator('.row', { hasText: name });
  await expect.poll(async () => Math.abs((await row.boundingBox())!.y - before)).toBeLessThan(12);

  // Tab switches start at the top.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(rows()).toHaveCount(16);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // A row that's gone (archived) → top.
  const last = rows().nth(14);
  await last.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await last.click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(rows()).toHaveCount(15);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('§17: re-rate a product from 8th to 2nd, come back → it is on screen at its new position', async () => {
  await page.goto('/');
  const eighth = rows().nth(7);
  await expect(eighth.locator('.rk')).toHaveText('8');
  const name = (await eighth.locator('.name').textContent())!;
  await eighth.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await eighth.evaluate((el: HTMLElement) => el.click());
  await page.getByRole('link', { name: 'Edit' }).first().click();
  // 8.7 puts it second, behind Gelato 41's 8.9.
  await page.getByRole('button', { name: /^Look: .*Tap to type/ }).click();
  await page.getByLabel('Look (1 to 10)').fill('8.7');
  await page.getByLabel('Look (1 to 10)').press('Enter');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();

  const row = page.locator('.row', { hasText: name });
  await expect(row.locator('.rk')).toHaveText('2');
  await expect(row).toBeInViewport();
});
