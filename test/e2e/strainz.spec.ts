import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// Strainz (D92, 0.81.0): the tab in the Log's place. Your products grouped by strain (the product's Name), a strain's
// page, two strains compared, Rename, the Want to try lists (strains on Strainz, sources on Sources) ticked off by a
// product, the Log entries you never rated, and the + beside the bar on every screen so the bar never changes width.
test.describe.configure({ mode: 'serial' });

let page: Page;
const call = (method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );
const rated = (n: number) => ({ look: n, smell: n, taste: n, burn: n });
const product = (name: string, over: Partial<ProductInput> = {}) => call('POST', '/api/products', { ...emptyProductInput(), name, ...over });
const axe = async () => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
const cards = () => page.locator('.scards').first().locator('.scard .nm');

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signUp(page, `sz${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`);
  await product('Zkittlez', { ratings: rated(9), strainType: 'indica', source: 'Green Room', dateTried: '2026-10-28', purchases: [{ date: '2026-10-28', amount: 2, totalPaid: 24, supplier: null }] });
  await product('ZKITTLEZ', { ratings: rated(8), productType: 'concentrate', concentrateType: 'live_rosin', strainType: 'indica', source: 'Kush Co', dateTried: '2026-09-14', purchases: [{ date: '2026-09-14', amount: 1, totalPaid: 40, supplier: null }] });
  await product('Zkittlez', { ratings: rated(7), strainType: 'indica', source: 'Leafy Lane', dateTried: '2026-06-02' });
  await product('Cookies Zkittlez', { ratings: rated(9.5), strainType: 'hybrid', dateTried: '2026-10-31' });
  await product('Gelato 41', { ratings: rated(8.5), strainType: 'hybrid', dateTried: '2026-10-11' });
  await product('Gelato 41', { ratings: rated(8.1), strainType: 'hybrid', dateTried: '2026-08-20' });
  await call('POST', '/api/log', { ...emptyLogEntryInput(), name: 'Amnesia Haze', country: 'NL' });
  await call('POST', '/api/log', { ...emptyLogEntryInput(), name: 'Gelato 41' }); // a product's name: shows under the strain only
});

test('the tab bar: Strainz in the Log’s place; the + beside the bar on every screen, the bar always the same width', async () => {
  await page.goto('/');
  await expect(page.locator('.nav .tab-l')).toHaveText(['Leaderboard', 'Strainz', 'Sources', 'Feed']);
  const first = (await page.locator('.nav').boundingBox())!;
  const pluses: Record<string, string> = {};
  for (const path of ['/', '/strainz', '/sources', '/feed', '/more', '/more/look', '/log', '/strainz/Zkittlez', '/strainz/Zkittlez/vs/Gelato%2041']) {
    await page.goto(path);
    const fab = page.locator('.fab');
    await expect(fab, path).toBeVisible();
    pluses[path] = (await fab.getAttribute('aria-label'))!;
    const bar = (await page.locator('.nav').boundingBox())!;
    expect(bar.width, `${path}: the bar's width`).toBeCloseTo(first.width, 0);
    expect(bar.x, path).toBeCloseTo(first.x, 0);
    const box = (await fab.boundingBox())!;
    expect(box.x, `${path}: the + is beside the bar`).toBeGreaterThan(bar.x + bar.width);
  }
  expect(pluses).toEqual({
    '/': 'Add a product',
    '/strainz': 'Add a strain to try',
    '/sources': 'Add a source to try',
    '/feed': 'New post',
    '/more': 'Add a product',
    '/more/look': 'Add a product',
    '/log': 'Add a product',
    '/strainz/Zkittlez': 'Add a Zkittlez product',
    '/strainz/Zkittlez/vs/Gelato%2041': 'Add a product',
  });
});

test('Strainz: a card per strain (the name, capitals ignored; Cookies Zkittlez another), sorted four ways', async () => {
  await page.goto('/strainz');
  await expect(page.getByRole('tab', { name: /Tried/ })).toHaveAttribute('aria-selected', 'true');
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
  const card = (name: string) => page.locator('.scard', { has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) });
  await expect(card('Zkittlez').locator('.avg')).toHaveText('Average 8.0');
  await expect(card('Zkittlez').locator('.sub')).toHaveText('3 products · Indica');
  await expect(card('Cookies Zkittlez').locator('.role.once')).toHaveText('Tried once');
  await expect(card('Zkittlez').locator('.role.once')).toHaveCount(0);
  await expect(page.locator('.strainz-lead')).toHaveText('3 strains · your favourite Cookies Zkittlez');
  await page.getByRole('button', { name: 'Most tried' }).click();
  await expect(cards()).toHaveText(['Zkittlez', 'Gelato 41', 'Cookies Zkittlez']);
  await page.getByRole('button', { name: 'Recently tried' }).click();
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Zkittlez', 'Gelato 41']);
  await page.getByRole('button', { name: 'A–Z' }).click();
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
  await page.getByLabel('Search strains').fill('zkit');
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Zkittlez']);
  await page.getByLabel('Search strains').fill('');
  await page.getByRole('button', { name: 'Best average' }).click();
  // The Log entry you never rated, under its own heading; the one named like a product isn't there.
  const unrated = page.locator('.unrated');
  await expect(unrated.locator('.group-h')).toHaveText(/Tried, not rated\s*1/);
  await expect(unrated.locator('.nm')).toHaveText(['Amnesia Haze']);
  await shot(page, 'strainz-list');
  expect(await axe()).toEqual([]);
  expect(await wholeScreenContrastFailures(page, '/strainz', '.scard .nm, .scard .avg, .scard .sub, .role, .pill, .seg button, .strainz-lead, .group-h .gname, .group-h .n, .ll-t, .log-link .small')).toEqual([]);
  // Your Log, by country, is still there.
  await page.getByRole('link', { name: /Your Log/ }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText(/^Strainz/);
  await expect(page.locator('.lrow .name')).toContainText(['Amnesia Haze']);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/strainz$/);
});

test('a strain’s page: average, place, best and lowest, kinds, price, sources, days, its products; + adds one with its name', async () => {
  await page.goto('/strainz');
  await page.locator('.scard', { hasText: /^.*Zkittlez.*3 products/ }).click();
  await expect(page).toHaveURL(/\/strainz\/Zkittlez$/);
  await expect(page.locator('.sh-name')).toHaveText('Zkittlez');
  await expect(page.locator('.strain-place')).toHaveText('#3 of your 3 rated strains.');
  const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => `${e.querySelector('.cap')!.textContent} ${e.querySelector('b')!.textContent}`));
  expect(tiles).toEqual(['Average 8.0', 'Products 3', 'Best 9.0']);
  const facts = await page.locator('.facts > div').evaluateAll((els) => els.map((e) => `${e.querySelector('dt')!.textContent}: ${e.querySelector('dd')!.textContent}`));
  expect(facts).toEqual(['Kinds: Flower, Live rosin', 'Price per gram: £26.00 on average', 'Value for money: 0.48', 'From: Green Room, Kush Co, Leafy Lane', 'First tried: 2 Jun 2026', 'Last tried: 28 Oct 2026']);
  await expect(page.locator('.rows .row .name')).toHaveText(['Zkittlez', 'ZKITTLEZ', 'Zkittlez']);
  await shot(page, 'strainz-strain');
  expect(await axe()).toEqual([]);
  await page.getByRole('button', { name: 'Add a Zkittlez product' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Zkittlez');
  await page.goBack();
  await expect(page.locator('.sh-name')).toHaveText('Zkittlez');
});

test('Compare: pick another strain, side by side, the better figure on each line marked', async () => {
  await page.goto('/strainz/Zkittlez');
  await page.getByRole('button', { name: 'Compare' }).click();
  const sheet = page.getByRole('dialog', { name: 'Compare Zkittlez with…' });
  await expect(sheet.locator('.opt.pick > span:first-child')).toHaveText(['Cookies Zkittlez', 'Gelato 41']);
  await sheet.getByRole('link', { name: /Gelato 41/ }).click();
  await expect(page).toHaveURL(/\/strainz\/Zkittlez\/vs\/Gelato%2041$/);
  const rows = await page.locator('table.vs tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.children].map((c) => (c.textContent ?? '').trim() + (c.classList.contains('win') ? '*' : ''))),
  );
  expect(rows).toEqual([
    ['8.0', 'Average', '8.3 (better)*'],
    ['3 (better)*', 'Times tried', '2'],
    ['9.0 (better)*', 'Best', '8.5'],
    ['7.0', 'Lowest', '8.1 (better)*'],
    ['£26.00', 'Price per gram', '–'],
    ['0.48', 'Value for money', '–'],
    ['28 Oct 2026 (better)*', 'Last tried', '11 Oct 2026'],
  ]);
  await shot(page, 'strainz-compare');
  expect(await axe()).toEqual([]);
});

test('Want to try: the + adds a strain (it says when you’ve tried it); a product with its name ticks it off', async () => {
  await page.goto('/strainz');
  await page.getByRole('button', { name: 'Add a strain to try' }).click();
  const sheet = page.getByRole('dialog', { name: 'A strain to try' });
  await sheet.getByLabel('Strain', { exact: true }).fill('zkittlez');
  await expect(sheet.locator('.hint')).toHaveText('You’ve tried Zkittlez: 3 products.');
  await sheet.getByLabel('Strain', { exact: true }).fill('runtz');
  await expect(sheet.locator('.hint')).toHaveCount(0);
  await sheet.getByLabel('Note (optional)').fill('Heard about it from Drew');
  await shot(page, 'strainz-want-sheet');
  expect(await axe()).toEqual([]);
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('tab', { name: /Want to try/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Want to try/ })).toHaveText(/Want to try\s*1/);
  await expect(page.locator('.wants .w-name')).toHaveText(['Runtz']);
  await expect(page.locator('.wants .w-note')).toHaveText(['Heard about it from Drew']);
  await shot(page, 'strainz-want-list');
  expect(await axe()).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.w-name, .w-note, .wants .btn, .footnote, .seg button'))).toEqual([]);
  // The same name again: said plainly.
  await page.goto('/strainz'); // textBoxes hid the words it measured
  await page.getByRole('button', { name: 'Add a strain to try' }).click();
  await page.getByRole('dialog').getByLabel('Strain', { exact: true }).fill('RUNTZ');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('alert')).toHaveText('RUNTZ is already on your list.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  // Add a Runtz product: it leaves the list, and says so.
  await page.goto('/products/new');
  await page.getByLabel('Name', { exact: true }).fill('Runtz');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.toast.ticked')).toHaveText('You tried Runtz! It’s off your Want to try list.');
  await page.goto('/strainz');
  await expect(page.getByRole('tab', { name: /Want to try/ })).toHaveText(/Want to try\s*0/);
  await page.getByRole('tab', { name: /Want to try/ }).click();
  await expect(page.getByRole('heading', { name: 'No strains to try yet' })).toBeVisible();
});

test('Remove takes one off the list', async () => {
  await call('POST', '/api/wants', { kind: 'strain', name: 'Apple Fritter' });
  await page.goto('/strainz');
  await page.getByRole('tab', { name: /Want to try/ }).click();
  await expect(page.locator('.wants .w-name')).toHaveText(['Apple Fritter']);
  await page.getByRole('button', { name: 'Remove Apple Fritter' }).click();
  await expect(page.getByRole('heading', { name: 'No strains to try yet' })).toBeVisible();
  expect((await call('GET', '/api/wants')).wants).toEqual([]);
  await page.getByRole('tab', { name: /Tried/ }).click();
});

test('Sources to try: the + adds a source; a product bought there ticks it off', async () => {
  await page.goto('/sources');
  await expect(page.getByRole('tab', { name: /Tried/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Add a source to try' }).click();
  const sheet = page.getByRole('dialog', { name: 'A source to try' });
  await sheet.getByLabel('Brand, grower or seller').fill('green room');
  await expect(sheet.locator('.hint')).toHaveText('You’ve had 1 product from Green Room.');
  await sheet.getByLabel('Brand, grower or seller').fill('Cloud Nine');
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('tab', { name: /To try/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.wants .w-name')).toHaveText(['Cloud Nine']);
  await shot(page, 'sources-to-try');
  expect(await axe()).toEqual([]);
  await product('Wedding Cake', { purchases: [{ date: '2026-11-01', amount: 1, totalPaid: 10, supplier: 'cloud nine' }] });
  await page.goto('/sources');
  await page.getByRole('tab', { name: /To try/ }).click();
  await expect(page.getByRole('heading', { name: 'No sources to try yet' })).toBeVisible();
  await page.getByRole('tab', { name: /Tried/ }).click();
});

test('Rename: every product with the name takes the new one; renaming into another strain joins them', async () => {
  await page.goto('/strainz/Gelato%2041');
  await page.getByRole('button', { name: 'Rename' }).click();
  const sheet = page.getByRole('dialog', { name: 'Rename Gelato 41' });
  await expect(sheet).toContainText('All 2 of its products take the new name');
  await sheet.getByLabel('Name').fill('zkittlez');
  await sheet.getByRole('button', { name: 'Rename' }).click();
  await expect(page).toHaveURL(/\/strainz\/Zkittlez$/);
  await expect(page.locator('.tile', { hasText: 'Products' }).locator('b')).toHaveText('5');
  await page.goto('/strainz');
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Zkittlez', 'Runtz', 'Wedding Cake']);
});

test('a product moved to Tried, not rated shows there, and Back from it goes to Strainz', async () => {
  const p = (await product('Blue Dream', { ratings: rated(6) })).product;
  await page.goto('/strainz');
  await page.goto(`/products/${p.id}`);
  await page.getByRole('button', { name: 'Move to Tried, not rated' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Tried, not rated' }).click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/strainz$/);
  await expect(page.locator('.unrated .nm')).toHaveText(['Blue Dream', 'Amnesia Haze']);
});
