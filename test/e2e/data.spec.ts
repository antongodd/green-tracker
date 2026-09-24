import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { ExportFile } from '../../shared/domain/backup';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { shot, signUp } from './helpers';

const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });

/** A real JPEG set uploaded from inside the page. */
const upload = (page: Page, colour: string) =>
  page.evaluate(async (c) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 300, 200);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);

test('export everything, restore it after changes, then delete the account', async ({ page }) => {
  const username = await signUp(page);
  await post(page, '/api/products', {
    ...emptyProductInput(),
    name: 'Keeper',
    ratings: { look: 8, smell: 7, taste: 9, burn: 6, high: 2 },
    notes: 'My notes',
    purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 10, supplier: 'Shop' }],
    photos: [{ upload: await upload(page, '#3b8a4a'), crop: { x: 0, y: 0, w: 0.5, h: 0.5, square: false } }],
  });
  const archived = await post(page, '/api/products', { ...emptyProductInput(), name: 'Old Favourite', ratings: { look: 6 } });
  await post(page, `/api/products/${archived.product.id}/archived`, { value: true });
  await post(page, '/api/log', { ...emptyLogEntryInput(), name: 'Quick One', amount: 1, photos: [{ upload: await upload(page, '#8a3b6b'), crop: null }] });

  // More is grouped as the brief says.
  await page.getByRole('link', { name: 'More' }).click();
  for (const group of ['Account', 'Data', 'Products', 'About', 'Danger zone']) await expect(page.locator('.lh', { hasText: group })).toBeVisible();
  await shot(page, '60-more');

  // Export: one JSON file, photos embedded, no social or security data.
  await page.getByRole('link', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(new RegExp(`^green-tracker-${username}-\\d{4}-\\d{2}-\\d{2}\\.json$`));
  const path = await file.path();
  const json = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
  expect(json).toMatchObject({ format: 'green-tracker-export', version: 1, username });
  expect(json.products.map((p) => p.name).sort()).toEqual(['Keeper', 'Old Favourite']);
  const keeper = json.products.find((p) => p.name === 'Keeper')!;
  expect(keeper).toMatchObject({ notes: 'My notes', ratings: { look: 8, high: 2 }, purchases: [{ amount: 3.5, totalPaid: 10, supplier: 'Shop' }] });
  expect(keeper.photos[0]!.crop).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5, square: false });
  expect(Buffer.from(keeper.photos[0]!.original, 'base64').subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(json.products.find((p) => p.name === 'Old Favourite')!.archived).toBe(true);
  expect(json.logEntries.map((e) => [e.name, e.amount, !!e.photo])).toEqual([['Quick One', 1, true]]);
  const text = readFileSync(path, 'utf8');
  for (const key of ['follows', 'followers', 'blocks', 'passkeys', 'recovery', 'gt.view', 'rankBy']) expect(text).not.toContain(`"${key}`);

  // Change things, then restore the file.
  await post(page, '/api/products', { ...emptyProductInput(), name: 'Added Later' });
  await page.goto('/more/restore');
  await page.getByLabel('Choose an export file').setInputFiles(path);
  const contents = page.getByRole('region', { name: 'File contents' });
  await expect(contents).toContainText('1 + 1 archived');
  await expect(contents).toContainText(`@${username}`);
  await shot(page, '61-restore');
  await contents.getByRole('button', { name: 'Replace my data with this file' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my data' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.locator('.row')).toHaveCount(1);
  await expect(page.locator('.row')).toContainText('Keeper');
  await expect(page.locator('.row .thumb img')).toHaveJSProperty('complete', true);
  await page.locator('.row').click();
  await expect(page.getByText('My notes')).toBeVisible();
  await expect(page.locator('.hero-score b')).toHaveText('7.5');
  await page.goto('/log');
  await expect(page.locator('.lrow', { hasText: 'Quick One' })).toBeVisible();

  // Delete the account: the username must be typed, and the passkey confirms.
  await page.goto('/more/delete');
  const button = page.getByRole('button', { name: 'Delete my account' });
  await expect(button).toBeDisabled();
  await page.getByLabel('Type your username to confirm').fill('wrong');
  await expect(button).toBeDisabled();
  await page.getByLabel('Type your username to confirm').fill(username.toUpperCase());
  await shot(page, '62-delete');
  await button.click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText('Your account and all of its data have been deleted.')).toBeVisible();
  const again = (await page.evaluate(async (u) => (await fetch(`/api/auth/username?u=${u}`)).json(), username)) as { available: boolean };
  expect(again.available).toBe(true);
});

test('a file that isn’t an export is refused before anything changes', async ({ page }) => {
  await signUp(page);
  await page.goto('/more/restore');
  await page.getByLabel('Choose an export file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('alert')).toHaveText('This isn’t a Green Tracker export file.');
  await expect(page.getByRole('button', { name: 'Replace my data with this file' })).toHaveCount(0);
});
