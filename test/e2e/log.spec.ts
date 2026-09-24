import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyLogEntryInput, type LogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { expectTilesCentredAndWashed, shot, signUp } from './helpers';

// The approved mockup's Log, seeded through the real API (with real photos).
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const E = (over: Partial<LogEntryInput>): LogEntryInput => ({ ...emptyLogEntryInput(), ...over });
const buy = (amount: number | null, totalPaid = 10) => ({ date: '2026-09-01', amount, totalPaid, supplier: null });

let context: BrowserContext;
let page: Page;
test.describe.configure({ mode: 'serial' });

/** Uploads a generated JPEG set from inside the page; returns the upload id. */
const upload = (colour: string) =>
  page.evaluate(async (c) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 400, 400);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);
const post = (path: string, body: unknown) =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page);
  const photo = async (c: string) => [{ upload: await upload(c), crop: null }];
  for (const p of [
    P({ name: 'Blue Zushi Live Rosin', country: 'US', productType: 'concentrate', photos: await photo('#c98a2c') }),
    P({ name: 'Gelato 41', country: 'US', photos: await photo('#5f7f3d'), purchases: [buy(3.5), buy(7)] }),
    P({ name: 'Lemon Cherry Gelato', country: 'CA', photos: await photo('#7c9350'), purchases: [buy(7)] }),
    P({ name: 'Peach Rings Gummies', country: 'CA', productType: 'edibles', purchases: [buy(100)] }),
    P({ name: 'Moroccan Hash', country: 'MA', productType: 'concentrate', photos: await photo('#4a3622'), purchases: [buy(1)] }),
    P({ name: 'Zkittlez Pre roll', country: 'ES', productType: 'pre_roll' }),
    P({ name: 'Mystery Sample', productType: 'other' }),
  ]) {
    await post('/api/products', p);
  }
  const archived = (await post('/api/products', P({ name: 'Archived One', country: 'US', purchases: [buy(10)] }))) as { product: { id: string } };
  await post(`/api/products/${archived.product.id}/archived`, { value: true });
  for (const e of [
    E({ name: 'Gary Payton', country: 'US', amount: 3.5, photos: await photo('#6f8f4a') }),
    E({ name: 'Wedding Cake', country: 'US', amount: 3.5 }),
    E({ name: 'Pink Kush', country: 'CA', amount: 7 }),
    E({ name: 'Tangie', amount: 1 }),
  ]) {
    await post('/api/log', e);
  }
});
test.afterAll(() => context.close());

const group = (name: string) => page.getByRole('region', { name, exact: true });
const tile = (label: string) => page.locator('.tile', { hasText: label }).locator('b');
const names = (name: string) => group(name).locator('.lrow .name').allTextContents();

test('grouped by country, ordered as the brief says, with the right tiles', async () => {
  await page.goto('/log');
  const headers = page.locator('.group-h');
  await expect(headers).toHaveCount(5);
  expect((await headers.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim())).toEqual([
    '🇺🇸United States4',
    '🇨🇦Canada3',
    '🇲🇦Morocco1',
    '🇪🇸Spain1',
    'No country2',
  ]);
  // Photos first, then A–Z; products and loose entries interleave as equals.
  expect(await names('United States')).toEqual(['Blue Zushi Live Rosin', 'Gary Payton', 'Gelato 41', 'Wedding Cake']);
  expect(await names('No country')).toEqual(['Mystery Sample', 'Tangie']);
  // Tiles: 11 distinct names, 4 countries (No country excluded), 33.5g = 10.5 + 7 + 1 bought + 15 loose
  // (the archived product and edibles are excluded).
  await expect(tile('Products')).toHaveText('11');
  await expect(tile('Countries')).toHaveText('4');
  await expect(tile('Total')).toHaveText('33.5g');
  await expectTilesCentredAndWashed(page);
  // COUNTRIES is the longest label: still fits on the narrowest iPhone.
  await page.setViewportSize({ width: 375, height: 812 });
  await expectTilesCentredAndWashed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // The type mark ("has a full profile") is on product rows only.
  const us = group('United States');
  await expect(us.locator('.lrow', { hasText: 'Gelato 41' }).getByRole('img', { name: 'Flower product' })).toBeVisible();
  await expect(us.locator('.lrow', { hasText: 'Wedding Cake' }).locator('.mk')).toHaveCount(0);
  await expect(page.locator('.lrow', { hasText: 'Archived One' })).toHaveCount(0);
  await expect(page.locator('.footnote')).toBeVisible();
  await shot(page, '40-log');
});

test('the Type filter is shared with the Leaderboard; empty groups are not drawn', async () => {
  await page.getByLabel('Type', { exact: true }).selectOption('edibles');
  await expect(page.locator('.group-h')).toHaveCount(1);
  await expect(group('Canada').locator('.lrow')).toHaveCount(1);
  await expect(tile('Products')).toHaveText('1');
  await expect(tile('Total')).toHaveText('0g');
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('edibles');
  await page.getByLabel('Type', { exact: true }).selectOption('all');
  await page.getByRole('link', { name: 'Log' }).click();
  await expect(page.locator('.group-h')).toHaveCount(5);
});

test('a product row opens its profile, which returns to the Log', async () => {
  await group('United States').getByRole('link', { name: /Gelato 41/ }).click();
  await expect(page.getByRole('heading', { name: 'Gelato 41' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/log$/);
});

test('a loose entry opens its editor; edits save back to the Log', async () => {
  await group('United States').getByRole('link', { name: /Wedding Cake/ }).click();
  await expect(page.getByLabel('Amount (g)')).toHaveValue('3.5');
  await page.getByLabel('Amount (g)').fill('7');
  await shot(page, '41-log-editor');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(tile('Total')).toHaveText('37g');
});

test('delete a loose entry behind a confirmation', async () => {
  await group('No country').getByRole('link', { name: /Tangie/ }).click();
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(group('No country').locator('.lrow')).toHaveCount(1);
  await expect(tile('Total')).toHaveText('36g');
});

test('add a new loose entry', async () => {
  await page.getByRole('button', { name: 'Add a log entry' }).click();
  await page.getByLabel('Name').fill('sour diesel');
  await page.getByLabel('Product type').selectOption('edibles');
  await expect(page.getByLabel('Amount (mg THC)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to leaderboard' })).toHaveCount(0); // saved entries only
  await expect(page.getByRole('button', { name: 'Delete entry' })).toHaveCount(0);
  await page.getByLabel('Amount (mg THC)').fill('50');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(group('No country').getByRole('link', { name: /Sour Diesel/ })).toBeVisible();
  await expect(tile('Total')).toHaveText('36g'); // edibles never count
});

test('promotion: pre-filled from the live form, commits nothing until Save, asks before leaving', async () => {
  await group('United States').getByRole('link', { name: /Gary Payton/ }).click();
  await page.getByLabel('Name').fill('Gary Payton OG'); // unsaved edit carries over
  await page.getByRole('button', { name: 'Add to leaderboard' }).click();
  await expect(page.getByText('Add to leaderboard', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Gary Payton OG');
  await expect(page.getByLabel('Country', { exact: true })).toHaveText('🇺🇸United States');
  await expect(page.locator('.pgrid .pcell')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Purchase 1' })).toHaveCount(0); // the amount is dropped
  await shot(page, '42-promote');

  // Cancel asks first; Keep editing stays, Discard leaves the entry untouched.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Gary Payton OG');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Save to log' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Gary Payton');

  // Promote for real.
  await page.getByRole('button', { name: 'Add to leaderboard' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Gary Payton' })).toBeVisible();
  await expect(page.locator('.hero-photo img')).toBeVisible(); // the photo moved with it
  // Back goes to the Log (not the deleted entry); the row is now a product row.
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(group('United States').locator('.lrow', { hasText: 'Gary Payton' }).getByRole('img', { name: 'Flower product' })).toBeVisible();
  await expect(tile('Total')).toHaveText('32.5g'); // the entry's 3.5g amount was dropped
  // On the Leaderboard it's unrated, so it sits among the unrated rows at the bottom
  // (everything in this seed is unrated; ties go by name).
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  const gary = page.locator('.row', { hasText: 'Gary Payton' });
  await expect(gary).toContainText('Unrated');
  await expect(page.locator('.row').filter({ hasNotText: 'Unrated' })).toHaveCount(0);
});
