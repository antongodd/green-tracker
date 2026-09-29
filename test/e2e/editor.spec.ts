import { expect, test, type Page } from '@playwright/test';
import { scoreHeat } from '../../shared/domain/heat';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, shot, signUp, textBoxes } from './helpers';

// D34 (0.27.0): the editors' section headings carry an icon; ratings are slim (name and number
// on one line, a thinner slider under it) and a counting, rated one takes its score's colour;
// High where it doesn't count is grey with a note; Overall is live in the Ratings heading; the
// date boxes draw their own calendar icon on the left, inside the box.
test.describe.configure({ mode: 'serial' });
let page: Page;
let id = '';
let entryId = '';

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const rate = (key: string) => page.locator('.rate', { has: page.locator(`#rate-${key}-range`) });
const color = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).color);
const heads = () => page.locator('.editor .gh').evaluateAll((els) => els.map((e) => ({ label: e.querySelector('.cap')!.textContent, icon: !!e.querySelector('.gh-ic svg') })));

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `edt${Date.now().toString(36).slice(-6)}`);
  id = (await post('/api/products', { ...emptyProductInput(), name: 'Wedding Cake', strainType: 'hybrid', country: 'US', dateTried: '2026-09-12', ratings: { look: 9.1, smell: 8.4, taste: 7.2, burn: 5.1, high: 9.4 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: 'Local' }] })).product.id;
  entryId = (await post('/api/log', { ...emptyLogEntryInput(), name: 'Loose One', country: 'US', amount: 1 })).entry.id;
});
test.afterAll(async () => {
  await page.context().close();
});

const openEditor = async () => {
  await page.goto(`/products/${id}/edit`);
  await expect(page.locator('#rate-look-range')).toBeVisible();
};

test('every section heading has its icon, in the product and Log editors', async () => {
  await openEditor();
  expect(await heads()).toEqual(['Basics', 'Classification', 'Origin', 'Ratings', 'Purchases', 'Photos', 'Notes', 'Leafly'].map((label) => ({ label, icon: true })));
  await expect(page.locator('.switch-row .gh-ic svg')).toHaveCount(1);
  expect(await color('.gh > .cap')).toBe('rgb(88, 224, 140)');
  await shot(page, '90-editor-top');
  await page.goto(`/log/${entryId}`);
  await expect(page.getByLabel('Name')).toBeVisible();
  expect(await heads()).toEqual(['Basics', 'Classification', 'Origin', 'Amount', 'Photo'].map((label) => ({ label, icon: true })));
});

test('ratings are slim: each row about a third shorter than before (82px)', async () => {
  await openEditor();
  for (const key of ['look', 'smell', 'taste', 'burn']) {
    const box = (await rate(key).boundingBox())!;
    expect(box.height, key).toBeLessThanOrEqual(64);
    expect(box.height, key).toBeGreaterThanOrEqual(56);
  }
  // High carries its one-line note, so it's a little taller, still well under 82px.
  expect((await rate('high').boundingBox())!.height).toBeLessThanOrEqual(72);
  // The ✕ is smaller to look at, but still a 44px target.
  const clr = (await rate('look').locator('.clr').boundingBox())!;
  const [cx, cy] = [clr.x + clr.width / 2, clr.y + clr.height / 2];
  for (const [x, y] of [[cx, cy - 20], [cx - 20, cy], [cx + 20, cy]] as const) {
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.clr'), [x, y])).toBe(true);
  }
});

test('a counting rating takes its score’s colour; High where it doesn’t count is grey with a note', async () => {
  await openEditor();
  for (const [key, v] of [['look', 9.1], ['smell', 8.4], ['taste', 7.2], ['burn', 5.1]] as const) {
    const heat = scoreHeat(key, v)!;
    await expect(rate(key)).toHaveAttribute('data-heat', heat);
    expect(await rate(key).locator('.rate-top .val').evaluate((e) => getComputedStyle(e).color), key).toBe(heat);
    expect(await rate(key).locator('.slider-thumb').evaluate((e) => getComputedStyle(e).backgroundColor), key).toBe(heat);
    expect(await rate(key).locator('.slider-fill').evaluate((e) => getComputedStyle(e).backgroundImage), key).toContain(heat);
  }
  await expect(rate('high')).not.toHaveAttribute('data-heat');
  await expect(rate('high')).toHaveClass(/\bmuted\b/);
  await expect(rate('high').getByText('Doesn’t count towards Overall')).toBeVisible();
  expect(await rate('high').locator('.slider-fill').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(238, 244, 240, 0.28)');
  await shot(page, '91-editor-ratings');
  // An unrated one stays plain.
  await rate('burn').locator('.clr').click();
  await expect(rate('burn')).not.toHaveAttribute('data-heat');
  await expect(rate('burn').locator('.rate-top .val')).toHaveText('—');
});

test('on an edible High counts, so it’s coloured', async () => {
  await openEditor();
  await page.getByLabel('Product type').selectOption('edibles');
  await expect(rate('high')).toHaveAttribute('data-heat', scoreHeat('high', 9.4)!);
  await expect(rate('high')).not.toHaveClass(/\bmuted\b/);
  await expect(rate('high').locator('small')).toHaveCount(0);
});

test('Overall is live in the Ratings heading, in its colour, and a dash when nothing counts', async () => {
  await openEditor();
  const ov = page.locator('.gh-ov b');
  await expect(ov).toHaveText('7.5'); // (9.1 + 8.4 + 7.2 + 5.1) / 4
  expect(await ov.evaluate((e) => getComputedStyle(e).color)).toBe(scoreHeat('overall', (9.1 + 8.4 + 7.2 + 5.1) / 4));
  await expect(page.getByText('Rated 5 of 5', { exact: true })).toBeVisible();
  await page.locator('#rate-burn-range').focus();
  await page.keyboard.press('End'); // Burn 10
  await expect(ov).toHaveText('8.7'); // (9.1 + 8.4 + 7.2 + 10) / 4
  expect(await ov.evaluate((e) => getComputedStyle(e).color)).toBe(scoreHeat('overall', (9.1 + 8.4 + 7.2 + 10) / 4));
  for (const key of ['look', 'smell', 'taste', 'burn']) await rate(key).locator('.clr').click();
  await expect(ov).toHaveText('—');
  await expect(ov).toHaveClass(/\bnone\b/);
});

test('the date boxes draw their calendar icon on the left, fully inside the box', async () => {
  await openEditor();
  for (const input of [page.getByLabel('Date tried'), page.getByRole('group', { name: 'Purchase 1' }).getByLabel('Date')]) {
    const box = (await input.boundingBox())!;
    const icon = (await input.locator('xpath=..').locator('svg').boundingBox())!;
    expect(icon.x).toBeGreaterThanOrEqual(box.x + 4);
    expect(icon.x + icon.width).toBeLessThanOrEqual(box.x + 40);
    expect(icon.y).toBeGreaterThanOrEqual(box.y);
    expect(icon.y + icon.height).toBeLessThanOrEqual(box.y + box.height);
    expect(await input.evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThanOrEqual(34);
  }
  await page.getByRole('group', { name: 'Purchase 1' }).scrollIntoViewIfNeeded();
  await shot(page, '92-editor-dates');
});

test('readable: headings, names, coloured numbers and Overall', async () => {
  await openEditor();
  // The whole Ratings card on screen, clear of the Save bar (it's what gets photographed).
  await page.getByRole('region', { name: 'Ratings' }).evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -70));
  expect(await contrastFailures(page, await textBoxes(page, '.gh > .cap, .gh-ov b, .rate-top .l, .rate-top .val'), 1)).toEqual([]);
});
