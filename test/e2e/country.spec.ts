import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { shot, signUp } from './helpers';

// The searchable country picker (D16), in both editors, on one seeded account.
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

const field = () => page.getByLabel('Country', { exact: true });
const picker = () => page.getByRole('dialog', { name: 'Choose a country' });
const search = () => picker().getByRole('searchbox', { name: 'Search countries' });
const rows = (section: string) => picker().getByRole('region', { name: section, exact: true }).getByRole('button');

test('flags beside every country, a Used section, and typing filters the list', async () => {
  await page.goto('/products/new');
  await expect(field()).toHaveText('Not set');
  await field().click();
  await expect(picker()).toBeVisible();
  // The search box has focus, so typing starts straight away.
  await expect(search()).toBeFocused();

  // Used: most used first, archived and Other left out.
  await expect(rows('Used')).toHaveText(['🇪🇸Spain', '🇨🇦Canada', '🇲🇦Morocco']);
  const all = rows('All countries');
  await expect(all.first()).toHaveText('Not set');
  await expect(all.first()).toHaveAttribute('aria-current', 'true');
  await expect(all.nth(1)).toHaveText('🇦🇫Afghanistan');
  await expect(all.last()).toHaveText('Other…');
  await shot(page, 'country-picker');

  await page.keyboard.type('uk');
  await expect(picker().getByRole('region', { name: 'Used' })).toHaveCount(0);
  await expect(rows('Matching countries')).toHaveText(['🇬🇧United Kingdom', '🇺🇦Ukraine', 'Other…']);
  await shot(page, 'country-picker-search');
  await rows('Matching countries').first().click();

  await expect(picker()).toHaveCount(0);
  await expect(field()).toHaveText('🇬🇧United Kingdom');
  await expect(field()).toBeFocused();
  await shot(page, 'country-field');

  // Reopening marks the choice; Cancel changes nothing.
  await field().click();
  await search().fill('united');
  await expect(rows('Matching countries').first()).toHaveAttribute('aria-current', 'true');
  await picker().getByRole('button', { name: 'Cancel' }).click();
  await expect(field()).toHaveText('🇬🇧United Kingdom');

  // Enter picks the best match.
  await field().click();
  await search().fill('holland');
  await search().press('Enter');
  await expect(field()).toHaveText('🇳🇱Netherlands');

  await page.getByLabel('Name', { exact: true }).fill('Picked Here');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  const { products } = await get('/api/products');
  expect(products.find((p: { name: string }) => p.name === 'Picked Here')).toMatchObject({ country: 'NL', countryOther: null });
});

test('no match offers to use the typed text as Other', async () => {
  await page.goto('/log/new');
  await page.getByLabel('Name', { exact: true }).fill('Island Sample');
  await field().click();
  await search().fill('Isle of Man');
  await expect(picker().getByText('No matching countries')).toBeVisible();
  await shot(page, 'country-picker-other');
  await picker().getByRole('button', { name: 'Use “Isle of Man” as Other' }).click();

  await expect(field()).toHaveText('Other');
  await expect(page.getByLabel('Which country?')).toHaveValue('Isle of Man');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page).toHaveURL(/\/log$/);
  const { entries } = await get('/api/log');
  expect(entries.find((e: { name: string }) => e.name === 'Island Sample')).toMatchObject({ country: 'OTHER', countryOther: 'Isle of Man' });
});

test('Not set and Other can be picked from the list', async () => {
  const { entries } = await get('/api/log');
  const id = entries.find((e: { name: string }) => e.name === 'F').id;
  await page.goto(`/log/${id}`);
  await expect(field()).toHaveText('🇪🇸Spain');

  await field().click();
  await rows('All countries').last().click();
  await expect(field()).toHaveText('Other');
  await expect(page.getByLabel('Which country?')).toHaveValue('');

  await field().click();
  await rows('All countries').first().click();
  await expect(field()).toHaveText('Not set');
  await expect(page.getByLabel('Which country?')).toHaveCount(0);

  // Escape closes without changing anything (desktop keyboards).
  await field().click();
  await search().fill('spa');
  await page.keyboard.press('Escape');
  await expect(picker()).toHaveCount(0);
  await expect(field()).toHaveText('Not set');
});
