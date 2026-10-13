import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { ExportFile } from '../../shared/domain/backup';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// Return to Log (D50, 0.43.0): a product page's Actions card offers Return to Log (between
// Private and Archive). It asks first, then the product is a Log entry again and its page
// opens, with a "Kept from your Leaderboard" card listing what's kept, hidden. Add to
// leaderboard brings it all back; Delete entry says the kept data goes too.
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};

const call = (method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );
const upload = () =>
  page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const x = c.getContext('2d')!;
    x.fillStyle = '#3a2f22';
    x.fillRect(0, 0, 800, 600);
    x.fillStyle = '#6f9a3f';
    x.beginPath();
    x.arc(400, 300, 200, 0, Math.PI * 2);
    x.fill();
    const img = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });
async function product(name: string, over: Partial<ProductInput> = {}) {
  const photos = [{ upload: await upload(), crop: null }, { upload: await upload(), crop: null }];
  ids[name] = (await call('POST', '/api/products', { ...emptyProductInput(), name, photos, ...over })).product.id;
}
const actions = () => page.getByRole('region', { name: 'Actions' });
const kept = () => page.getByRole('region', { name: 'Kept from your Leaderboard' });
/** A card's [label, value] pairs. */
const pairs = (region: ReturnType<Page['getByRole']>) =>
  region.locator('dt, dd').allTextContents().then((t) => t.reduce<string[][]>((rows, v, i) => (i % 2 ? rows[rows.length - 1]!.push(v) : rows.push([v]), rows), []));

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `rl${Date.now().toString(36).slice(-6)}`);
  await product('Zkittlez', {
    country: 'ES',
    ratings: { look: 9, smell: 8.5, taste: 9, burn: 8.5 },
    purchases: [
      { date: '2026-09-03', amount: 3.5, totalPaid: 30, supplier: null },
      { date: '2026-09-20', amount: 3.5, totalPaid: 30, supplier: null },
    ],
    notes: 'Sweet and smooth.',
  });
  await product('Short Stay', { ratings: { look: 7, taste: 8 }, purchases: [{ date: null, amount: 1, totalPaid: 10, supplier: null }], notes: 'Gone soon.' });
  await product('Stays Put', { ratings: { taste: 6 } });
});
test.afterAll(() => page.context().close());

test('Return to Log sits in Actions between Private and Archive, and asks first', async () => {
  await page.goto(`/products/${ids.Zkittlez}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Zkittlez' })).toBeVisible();
  await expect(actions().locator('.btn')).toHaveText(['Edit', 'Return to Log', 'Archive']);
  await expect(actions().getByRole('button', { name: 'Return to Log' }).locator('svg')).toHaveCount(1);
  await actions().getByRole('button', { name: 'Return to Log' }).click();
  const sheet = page.getByRole('dialog', { name: 'Return “Zkittlez” to your Log?' });
  await expect(sheet).toContainText('It leaves your Leaderboard and followers’ view. Its ratings, purchases, notes and photos are kept, hidden, for when you add it back.');
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  await shot(page, '49-return-sheet');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/products/${ids.Zkittlez}$`));
});

test('it becomes a Log entry: its page opens, with what it keeps; it’s off the Leaderboard and in the Log', async () => {
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Zkittlez' })).toBeVisible();
  await page.locator('.row', { hasText: 'Zkittlez' }).click();
  await actions().getByRole('button', { name: 'Return to Log' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Return to Log' }).click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  ids['Zkittlez entry'] = page.url().split('/').pop()!;
  await expect(page.getByRole('heading', { level: 1, name: 'Zkittlez' })).toBeVisible();
  await expect(page.locator('.log-tag')).toHaveText('In your Log');
  const details = await pairs(page.getByRole('region', { name: 'Details' }));
  expect(details.slice(0, 3)).toEqual([['Type', 'Flower'], ['Country', '🇪🇸 Spain'], ['Amount', '7g']]); // 3.5g + 3.5g
  await expect(kept()).toContainText('Hidden for now. Add to leaderboard brings it all back.');
  expect(await pairs(kept())).toEqual([['Ratings', '4 · Overall 8.8'], ['Purchases', '2 · £60.00'], ['Notes', 'Yes'], ['Other photos', '1']]);
  await expect(actions().locator('.btn')).toHaveText(['Add to leaderboard', 'Edit', 'Delete entry']);
  await shot(page, '49-returned-entry');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, '49-returned-entry-kept');

  // Back goes to the Log, where it's an entry again (no type mark: it opens the entry's page).
  await page.locator('.hdr').getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.lrow', { hasText: 'Zkittlez' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Stays Put' })).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Zkittlez' })).toHaveCount(0);
  // An old link to the product no longer opens it.
  await page.goto(`/products/${ids.Zkittlez}`);
  await expect(page.getByRole('heading', { name: 'Couldn’t open this product' })).toBeVisible();
});

test('an ordinary Log entry has no Kept card', async () => {
  const id = (await call('POST', '/api/log', { name: 'Plain Entry', productType: 'flower', productTypeOther: null, concentrateType: 'hash', concentrateTypeOther: null, country: null, countryOther: null, amount: null, photos: [] })).entry.id;
  await page.goto(`/log/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Plain Entry' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
  await expect(kept()).toHaveCount(0);
});

test('the Kept card and the page are readable and accessible', async () => {
  const path = `/log/${ids['Zkittlez entry']}`;
  await page.goto(path);
  await expect(kept()).toBeVisible();
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  const worst = await wholeScreenContrastFailures(page, path, '.kept-head strong, .kept-head .small, .kept dt, .kept dd');
  expect(worst, worst.join('\n')).toEqual([]);
});

test('Delete entry says what’s kept goes too', async () => {
  const entry = await call('POST', `/api/log/return/${ids['Short Stay']}`);
  await page.goto(`/log/${entry.entry.id}`);
  await actions().getByRole('button', { name: 'Delete entry' }).click();
  const sheet = page.getByRole('dialog', { name: 'Delete “Short Stay”?' });
  await expect(sheet).toContainText(
    'This removes the entry and its photo for good. What’s kept from your Leaderboard goes too: 2 ratings, 1 purchase, notes and 1 other photo.',
  );
  await sheet.getByRole('button', { name: 'Delete entry' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.lrow', { hasText: 'Short Stay' })).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Stays Put' })).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Short Stay' })).toHaveCount(0);
});

test('Add to leaderboard brings it all back: ratings, purchases, notes and both photos', async () => {
  await page.goto(`/log/${ids['Zkittlez entry']}`);
  await actions().getByRole('button', { name: 'Add to leaderboard' }).click();
  await expect(page.locator('.hdr')).toContainText('Add to leaderboard');
  await expect(page.getByLabel('Name')).toHaveValue('Zkittlez');
  await expect(page.locator('#notes')).toHaveValue('Sweet and smooth.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${ids.Zkittlez}$`)); // the same product
  await expect(page.getByRole('heading', { level: 1, name: 'Zkittlez' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Price history' }).locator('.purchase')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Notes' })).toContainText('Sweet and smooth.');
  await expect(page.locator('.poster .hero')).toContainText('8.8');
  const p = (await call('GET', `/api/products/${ids.Zkittlez}`)).product;
  expect(p.photos).toHaveLength(2);
  expect(p.ratings).toEqual({ look: 9, smell: 8.5, taste: 9, burn: 8.5 });
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Zkittlez' })).toBeVisible();
  await page.goto('/log');
  await expect(page.locator('.lrow', { hasText: 'Zkittlez' })).toBeVisible(); // a product row now
  await expect(page.locator('.lrow', { hasText: 'Zkittlez' }).locator('svg')).not.toHaveCount(0);
});

test('not on an archived product; offline it waits for the connection', async () => {
  await call('POST', `/api/products/${ids['Stays Put']}/archived`, { value: true });
  await page.goto(`/products/${ids['Stays Put']}`);
  await expect(actions().getByRole('button', { name: 'Un-archive' })).toBeVisible();
  await expect(actions().getByRole('button', { name: 'Return to Log' })).toHaveCount(0);
  await call('POST', `/api/products/${ids['Stays Put']}/archived`, { value: false });

  await page.goto(`/products/${ids.Zkittlez}`);
  await expect(actions().getByRole('button', { name: 'Return to Log' })).toBeEnabled();
  await page.context().setOffline(true);
  await expect(actions().getByRole('button', { name: 'Return to Log' })).toBeDisabled();
  await page.context().setOffline(false);
  await expect(actions().getByRole('button', { name: 'Return to Log' })).toBeEnabled();
});

test('the product page’s Actions stay readable', async () => {
  await page.goto(`/products/${ids.Zkittlez}`);
  await expect(actions()).toBeVisible();
  await actions().scrollIntoViewIfNeeded();
  await settled(page);
  const worst = await contrastFailures(page, await textBoxes(page, '.sect[aria-label="Actions"] .btn'), 1);
  expect(worst, worst.join('\n')).toEqual([]);
});

test('Export carries what a returned entry keeps, and Restore brings it back', async () => {
  await product('Travels Well', { ratings: { look: 8, taste: 9 }, purchases: [{ date: '2026-09-01', amount: 2, totalPaid: 20, supplier: 'Shop' }], notes: 'Packed.' });
  await call('POST', `/api/log/return/${ids['Travels Well']}`);
  await page.goto('/more/export');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const path = await (await download).path();
  const json = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
  const e = json.logEntries.find((x) => x.name === 'Travels Well')!;
  expect(e.amount).toBe(2);
  expect(e.photo).not.toBeNull();
  expect(e.kept).toMatchObject({ name: 'Travels Well', notes: 'Packed.', ratings: { look: 8, taste: 9 }, purchases: [{ amount: 2, totalPaid: 20, supplier: 'Shop' }] });
  expect(e.kept!.photos).toHaveLength(1);
  expect(Buffer.from(e.kept!.photos[0]!.original, 'base64').subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(json.products.map((p) => p.name)).not.toContain('Travels Well');

  await page.goto('/more/restore');
  await page.getByLabel('Choose an export file').setInputFiles(path);
  await page.getByRole('button', { name: 'Replace my data with this file' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my data' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await page.goto('/log');
  await page.locator('.lrow', { hasText: 'Travels Well' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Travels Well' })).toBeVisible();
  expect(await pairs(kept())).toEqual([['Ratings', '2 · Overall 8.5'], ['Purchases', '1 · £20.00'], ['Notes', 'Yes'], ['Other photos', '1']]);
});
