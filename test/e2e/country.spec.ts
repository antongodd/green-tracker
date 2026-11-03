import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// The searchable country field (D16), in both editors, on one seeded account. Since D81 its list opens
// right under the box, in the form, instead of on a screen of its own.
let context: BrowserContext;
let page: Page;
test.describe.configure({ mode: 'serial' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (path: string): Promise<any> => page.evaluate(async (path) => (await fetch(path)).json(), path);

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page);
  // Used: Spain ×3, Canada ×2 (one a Log entry), Morocco ×1; Other and archived don't count.
  for (const [name, country] of [['A', 'ES'], ['B', 'ES'], ['C', 'CA'], ['D', 'MA'], ['E', 'OTHER']]) {
    await post('/api/products', { ...emptyProductInput(), name, country, countryOther: country === 'OTHER' ? 'Tasmania' : null });
  }
  const archived = await post('/api/products', { ...emptyProductInput(), name: 'Archived', country: 'JP' });
  await post(`/api/products/${archived.product.id}/archived`, { value: true });
  await post('/api/log', { ...emptyLogEntryInput(), name: 'F', country: 'ES' });
  await post('/api/log', { ...emptyLogEntryInput(), name: 'G', country: 'CA' });
});
test.afterAll(() => context.close());

const field = () => page.getByRole('combobox', { name: 'Country', exact: true });
const list = () => page.getByRole('group', { name: 'Countries', exact: true });
const rows = (section: string) => list().getByRole('region', { name: section, exact: true }).getByRole('button');
const flag = () => page.locator('.cbox > .flag');

test('the list opens under the box: Used first, flags, and typing filters it', async () => {
  await page.goto('/products/new');
  await expect(field()).toHaveValue('');
  await expect(field()).toHaveAttribute('placeholder', 'Not set');
  await expect(field()).toHaveAttribute('aria-expanded', 'false');
  await field().click();
  await expect(list()).toBeVisible();
  await expect(field()).toHaveAttribute('aria-expanded', 'true');
  // You type straight into the box; nothing covers the form (no screen of its own).
  await expect(field()).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#app')).not.toHaveAttribute('inert');
  // Right under the box, as wide, and the box has moved up near the top of the screen.
  const fb = (await field().boundingBox())!;
  const lb = (await list().boundingBox())!;
  expect(lb.y).toBeGreaterThanOrEqual(fb.y + fb.height);
  expect(lb.y).toBeLessThanOrEqual(fb.y + fb.height + 12);
  expect(Math.abs(lb.x - fb.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(lb.width - fb.width)).toBeLessThanOrEqual(1);
  expect(fb.y).toBeLessThan(250);
  // About five rows tall, scrolling inside.
  expect(lb.height).toBeLessThanOrEqual(280);
  expect(await list().evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  // Used: most used first, archived and Other left out.
  await expect(rows('Used')).toHaveText(['🇪🇸Spain', '🇨🇦Canada', '🇲🇦Morocco']);
  const all = rows('All countries');
  await expect(all.first()).toHaveText('Not set');
  await expect(all.first()).toHaveAttribute('aria-current', 'true');
  await expect(all.nth(1)).toHaveText('🇦🇫Afghanistan');
  await expect(all.last()).toHaveText('Other…');
  await shot(page, 'country-picker');

  await page.keyboard.type('uk');
  await expect(list().getByRole('region', { name: 'Used' })).toHaveCount(0);
  await expect(rows('Matching countries')).toHaveText(['🇬🇧United Kingdom', '🇺🇦Ukraine', 'Other…']);
  await shot(page, 'country-picker-search');
  await rows('Matching countries').first().click();

  // Picked: the list closes, the box shows the flag and name, and the keyboard goes.
  await expect(list()).toHaveCount(0);
  await expect(field()).toHaveValue('United Kingdom');
  await expect(flag()).toHaveText('🇬🇧');
  await expect(field()).not.toBeFocused();
  await shot(page, 'country-field');

  // Reopening marks the choice; Escape changes nothing.
  await field().click();
  await expect(field()).toHaveValue('');
  await page.keyboard.type('united');
  await expect(rows('Matching countries').first()).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(list()).toHaveCount(0);
  await expect(field()).toHaveValue('United Kingdom');

  // A tap elsewhere closes it unchanged too.
  await field().click();
  await page.keyboard.type('spa');
  await page.getByLabel('Name', { exact: true }).click();
  await expect(list()).toHaveCount(0);
  await expect(field()).toHaveValue('United Kingdom');

  // Enter picks the best match, and stays in the box.
  await field().click();
  await page.keyboard.type('holland');
  await page.keyboard.press('Enter');
  await expect(field()).toHaveValue('Netherlands');
  await expect(field()).toBeFocused();
  await expect(list()).toHaveCount(0);

  await page.getByLabel('Name', { exact: true }).fill('Picked Here');
  await page.getByRole('button', { name: 'Save' }).click();
  // Wait for the saved product's profile (/products/new matches /products/<id> too).
  await expect(page).toHaveURL(/\/products\/(?!new$)[^/]+$/);
  const { products } = await get('/api/products');
  expect(products.find((p: { name: string }) => p.name === 'Picked Here')).toMatchObject({ country: 'NL', countryOther: null });
});

test('no match offers to use the typed text as Other', async () => {
  await page.goto('/log/new');
  await page.getByLabel('Name', { exact: true }).fill('Island Sample');
  await field().click();
  await field().fill('Isle of Man');
  await expect(list().getByText('No matching countries')).toBeVisible();
  await shot(page, 'country-picker-other');
  await list().getByRole('button', { name: 'Use “Isle of Man” as Other' }).click();

  await expect(field()).toHaveValue('Other');
  await expect(page.getByLabel('Which country?')).toHaveValue('Isle of Man');
  await page.getByRole('button', { name: 'Save to Log' }).click();
  await expect(page).toHaveURL(/\/log$/);
  const { entries } = await get('/api/log');
  expect(entries.find((e: { name: string }) => e.name === 'Island Sample')).toMatchObject({ country: 'OTHER', countryOther: 'Isle of Man' });
});

test('Not set and Other can be picked from the list', async () => {
  const { entries } = await get('/api/log');
  const id = entries.find((e: { name: string }) => e.name === 'F').id;
  await page.goto(`/log/${id}/edit`); // its form (D41: /log/:id is the entry's page)
  await expect(field()).toHaveValue('Spain');
  await expect(flag()).toHaveText('🇪🇸');

  await field().click();
  await rows('All countries').last().scrollIntoViewIfNeeded();
  await rows('All countries').last().click();
  await expect(field()).toHaveValue('Other');
  await expect(flag()).toHaveCount(0);
  await expect(page.getByLabel('Which country?')).toHaveValue('');

  await field().click();
  await rows('All countries').first().click();
  await expect(field()).toHaveValue('');
  await expect(page.getByLabel('Which country?')).toHaveCount(0);
});

test('readable and accessible, open', async () => {
  await page.goto('/products/new');
  await field().click();
  await expect(rows('Used').first()).toBeVisible();
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).include('.cfield').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  // Only the rows in sight: the rest are scrolled out of the list's own window.
  const lb = (await list().boundingBox())!;
  const boxes = (await textBoxes(page, '.cdrop .cap, .cp-row .nm')).filter((b) => b.y >= Math.max(100, lb.y) && b.y + b.h <= Math.min(740, lb.y + lb.height));
  expect(boxes.length).toBeGreaterThan(3);
  expect(await contrastFailures(page, boxes, 1)).toEqual([]);
});
