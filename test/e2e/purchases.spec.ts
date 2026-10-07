import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Purchases in the product editor (D42, 0.35.0): each purchase folds into a one-line row (date,
// a Latest tag on the newest, amount · total · supplier, the price per unit on the right); tapping
// it opens its fields, one at a time. Add purchase opens a new one at the bottom with the cursor in
// Amount. A purchase that stops the save opens by itself. One account; products seeded by the API.
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};
const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const product = async (name: string, over: Partial<ProductInput>) => (ids[name] = (await post('/api/products', { ...emptyProductInput(), name, ...over })).product.id);

const card = (n: number) => page.getByRole('group', { name: `Purchase ${n}` });
const row = (n: number) => card(n).locator('.psum');
/** Each purchase row as shown: [title, line under it, price]. */
const rows = () =>
  page.locator('.pcard .psum').evaluateAll((els) => els.map((e) => [e.querySelector('.l b')!.textContent, e.querySelector('.l > span')!.textContent, e.querySelector('.r')!.textContent]));
const openEditor = async (name: string) => {
  await page.goto(`/products/${ids[name]}/edit`);
  await expect(page.getByRole('region', { name: 'Purchases' })).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `pu${Date.now().toString(36).slice(-6)}`);
  // Entered oldest first but out of date order: the 14 Sep one is the latest (newest date).
  await product('Gelato 41', {
    ratings: { look: 8 },
    purchases: [
      { date: '2026-08-01', amount: 7, totalPaid: 17.5, supplier: 'Grasshopper Farms Craft Collective' },
      { date: '2026-09-14', amount: 3.5, totalPaid: 9.5, supplier: 'Cookies' },
      { date: null, amount: null, totalPaid: 12, supplier: null },
    ],
  });
  await product('Gummies', { productType: 'edibles', purchases: [{ date: '2026-09-02', amount: 100, totalPaid: 18, supplier: 'Kiva' }] });
});
test.afterAll(() => page.context().close());

test('saved purchases fold into rows: date, Latest on the newest, amount · total · supplier, the price per unit', async () => {
  await openEditor('Gelato 41');
  expect(await rows()).toEqual([
    ['1 Aug 2026', '7g · £17.50 · Grasshopper Farms Craft Collective', '£2.50/g'],
    ['14 Sep 2026Latest', '3.5g · £9.50 · Cookies', '£2.71/g'],
    ['No date', '£12.00', '—'],
  ]);
  await expect(page.locator('.tag-latest')).toHaveCount(1);
  await expect(card(2).locator('.tag-latest')).toHaveText('Latest');
  // Folded: no fields until a row is opened; each row says so to a screen reader.
  await expect(page.locator('.pbody')).toHaveCount(0);
  for (const n of [1, 2, 3]) await expect(row(n)).toHaveAttribute('aria-expanded', 'false');
  // The price uses the rounded numbers (D28); a long supplier is cut short, never wrapping the row.
  expect(await row(1).locator('.r').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('ui-rounded');
  expect(await row(1).locator('.l > span').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await page.locator('.pcard').first().scrollIntoViewIfNeeded();
  await shot(page, '93-purchases-rows');

  await openEditor('Gummies');
  expect(await rows()).toEqual([['2 Sep 2026Latest', '100mg · £18.00 · Kiva', '£0.18/mg']]);
});

test('tapping a row opens its fields, one at a time; its summary follows what you type', async () => {
  await openEditor('Gelato 41');
  await row(2).click();
  await expect(row(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(card(2).getByLabel('Amount (g)')).toHaveValue('3.5');
  await expect(card(2).getByLabel('Supplier')).toHaveValue('Cookies');
  // Opening another folds the first.
  await row(1).click();
  await expect(row(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(row(2)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.pbody')).toHaveCount(1);
  // Edits show on the row straight away, and folding keeps them.
  await card(1).getByLabel('Total paid (£)').fill('14');
  await expect(row(1).locator('.r')).toHaveText('£2.00/g');
  await row(1).click();
  await expect(page.locator('.pbody')).toHaveCount(0);
  expect((await rows())[0]).toEqual(['1 Aug 2026', '7g · £14.00 · Grasshopper Farms Craft Collective', '£2.00/g']);
  await page.getByRole('button', { name: 'Cancel' }).click(); // nothing saved
});

test('Add purchase opens a new one at the bottom, dated today, with the cursor in Amount; it closes the open one', async () => {
  await openEditor('Gelato 41');
  await row(1).click();
  await page.getByRole('button', { name: 'Add purchase' }).click();
  await expect(card(4)).toBeVisible();
  await expect(row(4)).toHaveAttribute('aria-expanded', 'true');
  await expect(row(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(card(4).getByLabel('Date')).not.toHaveValue('');
  await expect(card(4).getByLabel('Amount (g)')).toBeFocused();
  // No total paid yet: amber, on the row and in the fields.
  await expect(row(4).locator('.warn')).toHaveText('Needs a total paid to be kept');
  await expect(card(4).locator('.pcard-foot .warn')).toHaveText('Needs a total paid to be kept');
  expect(await row(4).locator('.warn').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(240, 169, 59)');
  await expect(row(4).locator('.r')).toHaveText('—');
  await card(4).getByLabel('Amount (g)').fill('1');
  await card(4).getByLabel('Total paid (£)').fill('3');
  await expect(row(4).locator('.r')).toHaveText('£3.00/g');
  // Dated today, it's now the latest.
  await expect(card(4).locator('.tag-latest')).toBeVisible();
  await expect(card(2).locator('.tag-latest')).toHaveCount(0);
  await shot(page, '94-purchases-new');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole('region', { name: 'Price history' }).locator('.purchase')).toHaveCount(4);
});

test('Remove takes a purchase out; nothing is saved until Save', async () => {
  await openEditor('Gelato 41');
  await expect(page.locator('.pcard')).toHaveCount(4);
  await row(3).click(); // the undated one
  await card(3).getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.pcard')).toHaveCount(3);
  await expect(page.locator('.pbody')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await openEditor('Gelato 41');
  await expect(page.locator('.pcard')).toHaveCount(4); // Cancel kept it
});

test('a purchase that stops the save opens by itself, with the message', async () => {
  await openEditor('Gelato 41');
  await row(1).click();
  await row(1).click(); // all folded
  await row(2).click();
  await card(2).getByLabel('Total paid (£)').fill('nine');
  await row(2).click(); // folded again
  await row(1).click(); // another one open instead
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Amounts and prices must be numbers.');
  await expect(row(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(card(2).getByLabel('Total paid (£)')).toHaveValue('nine');
  await expect(page).toHaveURL(/\/edit$/);
});

test('readable and accessible, folded and open', async () => {
  await openEditor('Gelato 41');
  await row(2).click();
  await card(1).scrollIntoViewIfNeeded();
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).include('section[aria-label="Purchases"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  // The rows' text on their cards, measured from pixels, with the section scrolled to the top.
  await page.locator('section[aria-label="Purchases"]').evaluate((s) => window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 60));
  const boxes = (await textBoxes(page, '.psum .l b, .psum .l > span, .psum .r, .tag-latest')).filter((b) => b.y >= 50 && b.y + b.h <= 790);
  expect(boxes.length).toBeGreaterThan(3);
  const worst = await contrastFailures(page, boxes, 1);
  expect(worst, worst.join('\n')).toEqual([]);
});
