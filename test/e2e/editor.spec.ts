import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { scoreHeat } from '../../shared/domain/heat';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { NAME_EXAMPLES, SOURCE_EXAMPLES } from '../../shared/domain/examples';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D34 (0.27.0): the editors' section headings carry an icon; ratings are slim (name and number
// on one line, a thinner slider under it) and a counting, rated one takes its score's colour;
// High where it doesn't count is grey; Overall is live in the Ratings heading; the date boxes
// draw their own calendar icon on the left, inside the box. D81 (0.70.0): the product editor in
// the owner's order (Name, Photos, The product, Ratings, Purchases, Notes, Leafly, Private),
// − / + by each score, Type and Strain type as chips, and no note under High.
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
  expect(await heads()).toEqual(['Name', 'Photos', 'The product', 'Ratings', 'Purchases', 'Notes', 'Leafly'].map((label) => ({ label, icon: true })));
  // Name's heading is its box's label (0.70.2).
  await expect(page.locator('.gh label.cap[for="name"]')).toHaveText('Name');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Wedding Cake');
  // Name comes first, on its own; Private last.
  const order = await page.locator('.editor > *').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? (e.querySelector('#name') ? 'Name' : e.querySelector('[role=switch]') ? 'Private' : e.tagName)));
  expect(order.filter((x) => x !== 'BUTTON')).toEqual(['Name', 'Photos', 'The product', 'Ratings', 'Purchases', 'Notes', 'Leafly', 'Private']);
  await expect(page.locator('.switch-row .gh-ic svg')).toHaveCount(1);
  expect(await color('.gh > .cap')).toBe('rgb(111, 233, 164)');
  await shot(page, '90-editor-top');
  await page.goto(`/log/${entryId}/edit`);
  await expect(page.getByLabel('Name')).toBeVisible();
  expect(await heads()).toEqual(['Basics', 'Classification', 'Origin', 'Amount', 'Photo'].map((label) => ({ label, icon: true })));
});

test('ratings stay slim, every row one line and the same height, High too (D81)', async () => {
  await openEditor();
  for (const key of ['look', 'smell', 'taste', 'burn', 'high']) {
    const box = (await rate(key).boundingBox())!;
    expect(box.height, key).toBeLessThanOrEqual(76);
    expect(box.height, key).toBeGreaterThanOrEqual(68);
    // The name sits on one line.
    expect((await rate(key).locator('.l > span').first().boundingBox())!.height, key).toBeLessThan(30);
  }
  // − and + are 44-point targets, clear of each other and of the number.
  for (const name of ['Lower Look', 'Raise Look']) {
    const b = (await page.getByRole('button', { name }).boundingBox())!;
    expect(b.width, name).toBeGreaterThanOrEqual(44);
    expect(b.height, name).toBeGreaterThanOrEqual(44);
  }
  // The ✕ is smaller to look at, but still a 44px target.
  await rate('look').evaluate((e) => e.scrollIntoView({ block: 'center' })); // the Ratings card is lower down since D81
  const clr = (await rate('look').locator('.clr').boundingBox())!;
  const [cx, cy] = [clr.x + clr.width / 2, clr.y + clr.height / 2];
  for (const [x, y] of [[cx, cy - 20], [cx - 20, cy], [cx + 20, cy]] as const) {
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.clr'), [x, y])).toBe(true);
  }
});

test('a counting rating takes its score’s colour; High where it doesn’t count is grey, said only to screen readers', async () => {
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
  await expect(rate('high').locator('.visually-hidden')).toHaveText('Doesn’t count towards Overall');
  await expect(page.getByRole('button', { name: /^High: 9\.4, doesn’t count towards overall\. Tap to type/ })).toBeVisible();
  expect(await rate('high').locator('.slider-fill').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(238, 244, 240, 0.28)');
  await shot(page, '91-editor-ratings');
  // An unrated one stays plain.
  await rate('burn').locator('.clr').click();
  await expect(rate('burn')).not.toHaveAttribute('data-heat');
  await expect(rate('burn').locator('.rate-top .val')).toHaveText('–');
});

test('on an edible High counts, so it’s coloured', async () => {
  await openEditor();
  await page.getByRole('radio', { name: 'Edible', exact: true }).click();
  await expect(rate('high')).toHaveAttribute('data-heat', scoreHeat('high', 9.4)!);
  await expect(rate('high')).not.toHaveClass(/\bmuted\b/);
  await expect(rate('high').locator('.visually-hidden')).toHaveCount(0);
});

test('Overall is live in the Ratings heading, in its colour, and a dash when nothing counts', async () => {
  await openEditor();
  const ov = page.locator('.gh-ov b');
  await expect(ov).toHaveText('7.5'); // (9.1 + 8.4 + 7.2 + 5.1) / 4
  expect(await ov.evaluate((e) => getComputedStyle(e).color)).toBe(scoreHeat('overall', (9.1 + 8.4 + 7.2 + 5.1) / 4));
  await expect(page.getByText('Rated 5 of 5 categories', { exact: true })).toBeVisible();
  await page.locator('#rate-burn-range').focus();
  await page.keyboard.press('End'); // Burn 10
  await expect(ov).toHaveText('8.7'); // (9.1 + 8.4 + 7.2 + 10) / 4
  expect(await ov.evaluate((e) => getComputedStyle(e).color)).toBe(scoreHeat('overall', (9.1 + 8.4 + 7.2 + 10) / 4));
  for (const key of ['look', 'smell', 'taste', 'burn']) await rate(key).locator('.clr').click();
  await expect(ov).toHaveText('–');
  await expect(ov).toHaveClass(/\bnone\b/);
});

test('the date boxes draw their calendar icon on the left, fully inside the box', async () => {
  await openEditor();
  // A saved purchase is folded into its row (D42): open it.
  await page.getByRole('group', { name: 'Purchase 1' }).locator('.psum').click();
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

const val = (key: string) => rate(key).locator('.rate-top .val');

test('− and + move a score 0.1; an unrated one starts at 5.0; held, it keeps going (D81)', async () => {
  await openEditor();
  await rate('burn').locator('.clr').click();
  await expect(val('burn')).toHaveText('–');
  await page.getByRole('button', { name: 'Raise Burn' }).click();
  await expect(val('burn')).toHaveText('5.0');
  await expect(rate('burn')).toHaveAttribute('data-heat', scoreHeat('burn', 5)!);
  await page.getByRole('button', { name: 'Lower Burn' }).click();
  await page.getByRole('button', { name: 'Lower Burn' }).click();
  await expect(val('burn')).toHaveText('4.8');
  await expect(page.locator('.gh-ov b')).toHaveText('7.4'); // (9.1 + 8.4 + 7.2 + 4.8) / 4
  // From the keyboard too.
  await page.getByRole('button', { name: 'Raise Smell' }).focus();
  await page.keyboard.press('Enter');
  await expect(val('smell')).toHaveText('8.5');
  // Held down, it keeps going (wait on the number, never a fixed time), and letting go stops it.
  const raise = (await page.getByRole('button', { name: 'Raise Taste' }).boundingBox())!;
  await page.mouse.move(raise.x + raise.width / 2, raise.y + raise.height / 2);
  await page.mouse.down();
  await expect.poll(async () => Number(await val('taste').textContent()), { timeout: 5000 }).toBeGreaterThanOrEqual(7.6);
  await page.mouse.up();
  const held = await val('taste').textContent();
  await page.getByRole('button', { name: 'Lower Taste' }).focus(); // something else, then check it stayed
  await expect(val('taste')).toHaveText(held!);
  // Never past 10.
  await page.getByRole('slider', { name: 'Look', exact: true }).press('End');
  await page.getByRole('button', { name: 'Raise Look' }).click();
  await expect(val('look')).toHaveText('10.0');
});

test('Type and Strain type are one tap each; tapping the chosen strain again clears it (D81)', async () => {
  await openEditor();
  const radio = (name: string) => page.getByRole('radio', { name, exact: true });
  await expect(page.getByRole('radiogroup', { name: 'Type', exact: true }).getByRole('radio')).toHaveCount(5); // no Not set
  await expect(radio('Flower')).toBeChecked();
  await expect(radio('Hybrid')).toBeChecked();
  await radio('Hybrid').click();
  for (const s of ['Indica', 'Sativa', 'Hybrid']) await expect(radio(s)).not.toBeChecked();
  await radio('Sativa').click();
  await expect(radio('Sativa')).toBeChecked();
  await radio('Concentrate').click();
  await expect(page.getByLabel('Concentrate type')).toBeVisible();
  await expect(rate('consistency')).toBeVisible();
  await radio('Other').click();
  await expect(page.getByLabel('What type?')).toBeVisible();
});

test('a new product: examples from the owner’s lists, tried today, one wide Add photos, no purchase open (D81)', async () => {
  const names = new Set<string>();
  const sources = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await page.goto('/products/new');
    await expect(page.getByLabel('Name')).toBeVisible();
    const name = (await page.getByLabel('Name').getAttribute('placeholder'))!;
    const source = (await page.getByLabel('Source').getAttribute('placeholder'))!;
    expect(name).toMatch(/^e\.g\. /);
    expect(NAME_EXAMPLES).toContain(name.slice('e.g. '.length));
    expect(source).toMatch(/^The brand or grower, e\.g\. /);
    expect(SOURCE_EXAMPLES).toContain(source.slice('The brand or grower, e.g. '.length));
    names.add(name);
    sources.add(source);
  }
  expect(names.size + sources.size).toBeGreaterThan(2); // picked afresh, not always the same
  await expect(page.getByLabel('Date tried')).toHaveValue(await page.evaluate(() => new Date().toLocaleDateString('en-CA')));
  await expect(page.locator('.pcard')).toHaveCount(0);
  const wide = (await page.locator('.add-cell.wide').boundingBox())!;
  const card = (await page.getByRole('region', { name: 'Photos' }).boundingBox())!;
  expect(wide.width).toBeGreaterThan(card.width - 40);
  await expect(page.locator('.add-cell.wide')).toContainText('Take one, or pick from your library');
  // Untouched, Cancel just leaves (today's date isn't a change).
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/new$/);
});

test('readable and accessible: the product card and the scores (D81)', async () => {
  await openEditor();
  await page.getByRole('region', { name: 'The product' }).evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -70));
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).include('.editor').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  const top = (await textBoxes(page, '.choice > span, .field > .flabel, .field > label')).filter((b) => b.y >= 100 && b.y + b.h <= 740);
  expect(top.length).toBeGreaterThan(5);
  expect(await contrastFailures(page, top, 1)).toEqual([]);
  await shot(page, '93-editor-product');
});
