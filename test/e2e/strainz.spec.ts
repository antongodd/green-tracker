import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { formatDay } from '../../shared/domain/strains';
import { contrastFailures, railContrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// Strainz (D92, 0.81.0): the tab in the Log's place. Your products grouped by strain (the product's Name), a strain's
// page, two strains compared, Rename, the Want to try lists (strains on Strainz, sources on Sources) ticked off by a
// product, the Log entries you never rated, and the + beside the bar on every screen so the bar never changes width.
// D100: Most smoked (grams) next to Most tried (products and Log entries), Log entries part of their strain, no edibles.
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
  await call('POST', '/api/log', { ...emptyLogEntryInput(), name: 'Gelato 41', amount: 3.5 }); // a product's name: part of that strain (D100)
  // D100: edibles aren't strains: neither this product nor this Log entry is on Strainz.
  await product('Zkittlez', { ratings: { taste: 10, high: 10 }, productType: 'edibles', purchases: [{ date: '2026-10-01', amount: 100, totalPaid: 10, supplier: null }] });
  await call('POST', '/api/log', { ...emptyLogEntryInput(), name: 'Gummy Bears', productType: 'edibles', amount: 50 });
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

/** The names on a shelf, in order. */
const shelf = (title: string) => page.getByRole('list', { name: title, exact: true }).locator('.pk-n');
/** Today, as a strain's page and Compare show it: a Log entry counts from the day it was added. */
const today = () => formatDay(new Date().toISOString().slice(0, 10));

test('Strainz (D93, shelves; D100): your favourite on top, then Your favourites, Most smoked, Most tried, Recently tried, Unranked', async () => {
  await page.goto('/strainz');
  await expect(page.locator('.fav-card .fav-n')).toHaveText('Cookies Zkittlez');
  await expect(page.locator('.fav-card .fav-m')).toHaveText('9.5 average · 4 strains tried');
  await expect(page.locator('.shelf h2')).toHaveText(['Your favourites', 'Most smoked', 'Most tried', 'Recently tried', 'Unranked']); // no Want to try yet: hidden
  await expect(shelf('Your favourites')).toHaveText(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
  // Most smoked: grams bought and logged (Gelato 41's Log entry 3.5g; Zkittlez 2g + 1g, its edible not counted); only
  // strains with a weight.
  await expect(shelf('Most smoked')).toHaveText(['Gelato 41', 'Zkittlez']);
  await expect(page.getByRole('list', { name: 'Most smoked', exact: true }).locator('.pk-m')).toHaveText(['3.5g', '3g']);
  await expect(page.getByRole('list', { name: 'Most smoked', exact: true }).getByRole('link', { name: 'Gelato 41, average 8.3, 3.5g smoked' })).toBeVisible();
  // Most tried: products and Log entries (Gelato 41: two and one, ahead of Zkittlez on the average).
  await expect(shelf('Most tried')).toHaveText(['Gelato 41', 'Zkittlez', 'Cookies Zkittlez', 'Amnesia Haze']);
  await expect(page.getByRole('list', { name: 'Most tried', exact: true }).locator('.pk-m')).toHaveText(['×3', '×3', '×1', '×1']);
  // A Log entry counts from the day it was added (today).
  await expect(shelf('Recently tried')).toHaveText(['Amnesia Haze', 'Gelato 41', 'Cookies Zkittlez', 'Zkittlez']);
  // The strain only in your Log; the edibles nowhere.
  await expect(shelf('Unranked')).toHaveText(['Amnesia Haze']);
  await expect(page.locator('.pk-n', { hasText: 'Gummy Bears' })).toHaveCount(0);
  const z = page.getByRole('list', { name: 'Your favourites', exact: true }).getByRole('link', { name: 'Zkittlez, average 8.0, tried 3 times' });
  await expect(z.locator('.sring-v')).toHaveText('8.0');
  await expect(page.getByRole('list', { name: 'Your favourites', exact: true }).getByRole('link', { name: /^Cookies Zkittlez/ }).locator('.pk-m')).toHaveText('×1');
  await expect(z.locator('.pk-m')).toHaveText('×3');
  // The ring fills to the average out of 10.
  const filled = await z.locator('circle.fill').evaluate((c) => {
    const [on, all] = c.getAttribute('stroke-dasharray')!.split(' ').map(Number);
    return on! / all!;
  });
  expect(filled).toBeCloseTo(0.8, 2);
  await shot(page, 'strainz-shelves');
  expect(await axe()).toEqual([]);
  expect(await wholeScreenContrastFailures(page, '/strainz', '.fav-k, .fav-n, .fav-m, .shelf h2, .shelf-h a, .pk-n, .pk-m, .sring-v')).toEqual([]);
  // Each shelf along its whole length (the words off the screen's side, D100's longer shelves).
  expect(await railContrastFailures(page, '/strainz', '.pk-n, .pk-m, .sring-v')).toEqual([]);
});

test('the shelves are readable in the light look (Daylight) too', async () => {
  await call('PUT', '/api/appearance', { look: 'daysky', top: 'strip', preset: 'aurora', markFirst: false });
  try {
    await page.goto('/strainz');
    await expect(page.locator('html')).toHaveAttribute('data-tone', 'light');
    await expect(page.locator('.fav-card .fav-n')).toHaveText('Cookies Zkittlez');
    expect(await axe()).toEqual([]);
    expect(await wholeScreenContrastFailures(page, '/strainz', '.fav-k, .fav-n, .fav-m, .shelf h2, .shelf-h a, .pk-n, .pk-m, .sring-v')).toEqual([]);
    expect(await railContrastFailures(page, '/strainz', '.pk-n, .pk-m, .sring-v')).toEqual([]);
  } finally {
    await call('PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: false });
    await page.evaluate(() => localStorage.setItem('gt.look', 'aurora'));
  }
});

test('a full shelf scrolls inside itself; the page never slides sideways, and the top card sits in the middle', async ({ browser }) => {
  // 0.82.0 (Anton's screenshots, 30 strains): the shelves' column took the length of its longest row, so on iPhone the
  // whole screen slid sideways and the top card ran off the right edge.
  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signUp(other, `sz3${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`);
  for (let i = 0; i < 8; i++)
    await other.evaluate((p) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }), {
      ...emptyProductInput(),
      name: `Strain Number ${i + 1}`,
      ratings: rated(9 - i / 4),
    });
  await other.goto('/strainz');
  const fr = other.getByRole('list', { name: 'Your favourites', exact: true });
  await expect(fr.locator('.pk-n')).toHaveCount(8);
  expect(await other.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const rail of await other.locator('ul.rail').all()) {
    const box = (await rail.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBeLessThanOrEqual(390);
  }
  const fav = (await other.locator('.fav-card').boundingBox())!;
  expect(Math.abs(fav.x - (390 - (fav.x + fav.width))), 'the top card has the same gap on both sides').toBeLessThanOrEqual(1);
  // Swiping a row moves only that row.
  await fr.evaluate((el) => el.scrollBy({ left: 300 }));
  await expect.poll(() => fr.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await other.getByRole('list', { name: 'Most tried', exact: true }).evaluate((el) => el.scrollLeft)).toBe(0);
  expect(await other.evaluate(() => window.scrollX)).toBe(0);
  await other.context().close();
});

test('no Unranked shelf when every strain you’ve had is ranked', async ({ browser }) => {
  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signUp(other, `sz2${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`);
  await other.evaluate((p) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }), {
    ...emptyProductInput(),
    name: 'Only One',
    ratings: rated(8),
  });
  await other.goto('/strainz');
  await expect(other.locator('.shelf h2')).toHaveText(['Your favourites']);
  await expect(other.getByRole('heading', { name: 'Unranked' })).toHaveCount(0);
  await other.context().close();
});

test('See all: a shelf’s whole list as cards, with search and the four sorts', async () => {
  await page.goto('/strainz');
  await page.getByRole('link', { name: 'See all: Most tried' }).click();
  await expect(page).toHaveURL(/\/strainz\/list\/tried$/);
  await expect(page.locator('.hdr .title')).toHaveText(/Most tried/);
  await expect(page.getByRole('button', { name: 'Most tried' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards()).toHaveText(['Gelato 41', 'Zkittlez', 'Cookies Zkittlez', 'Amnesia Haze']);
  const card = (name: string) => page.locator('.scard', { has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) });
  await expect(card('Zkittlez').locator('.avg')).toHaveText('Average 8.0');
  await expect(card('Zkittlez').locator('.sub')).toHaveText('3 products · 3g · Indica');
  await expect(card('Gelato 41').locator('.sub')).toHaveText('2 products · 1 in your Log · 3.5g · Hybrid');
  await expect(card('Amnesia Haze').locator('.sub')).toHaveText('In your Log');
  await expect(card('Cookies Zkittlez').locator('.role.once')).toHaveText('Tried once');
  await page.getByRole('button', { name: 'Most smoked' }).click();
  await expect(cards()).toHaveText(['Gelato 41', 'Zkittlez']);
  await page.getByRole('button', { name: 'Recently tried' }).click();
  await expect(cards()).toHaveText(['Amnesia Haze', 'Gelato 41', 'Cookies Zkittlez', 'Zkittlez']);
  await page.getByRole('button', { name: 'A–Z' }).click();
  await expect(cards()).toHaveText(['Amnesia Haze', 'Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
  await page.getByLabel('Search strains').fill('zkit');
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Zkittlez']);
  expect(await axe()).toEqual([]);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/strainz$/);
  // Your favourites' See all also lists the entries you never rated.
  await page.getByRole('link', { name: 'See all: Your favourites' }).click();
  await expect(cards()).toHaveText(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
  await expect(page.locator('.unrated .nm')).toHaveText(['Amnesia Haze']);
  // Unranked's own link opens the Log, by country.
  await page.goto('/strainz');
  await page.getByRole('link', { name: 'Your Log: Unranked' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText(/^Strainz/);
  await expect(page.locator('.lrow .name')).toContainText(['Amnesia Haze']);
});

test('a strain’s page: average, place, best and lowest, kinds, price, sources, days, its products; + adds one with its name', async () => {
  await page.goto('/strainz');
  await page.getByRole('list', { name: 'Most tried', exact: true }).getByRole('link', { name: /^Zkittlez,/ }).click();
  await expect(page).toHaveURL(/\/strainz\/Zkittlez$/);
  await expect(page.locator('.sh-name')).toHaveText('Zkittlez');
  await expect(page.locator('.strain-place')).toHaveText('#3 of your 3 rated strains.');
  const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => `${e.querySelector('.cap')!.textContent} ${e.querySelector('b')!.textContent}`));
  expect(tiles).toEqual(['Average 8.0', 'Tried 3', 'Best 9.0']);
  const facts = await page.locator('.facts > div').evaluateAll((els) => els.map((e) => `${e.querySelector('dt')!.textContent}: ${e.querySelector('dd')!.textContent}`));
  // The edible Zkittlez isn't counted (D100): not in Kinds, Total smoked or the products.
  expect(facts).toEqual(['Kinds: Flower, Live rosin', 'Total smoked: 3g', 'Price per gram: £26.00 on average', 'Value for money: 0.48', 'From: Green Room, Kush Co, Leafy Lane', 'First tried: 2 Jun 2026', 'Last tried: 28 Oct 2026']);
  await expect(page.locator('.rows .row .name')).toHaveText(['Zkittlez', 'ZKITTLEZ', 'Zkittlez']);
  await expect(page.getByRole('heading', { name: 'From your Log' })).toHaveCount(0);
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
  await expect(sheet.locator('.opt.pick > span:first-child')).toHaveText(['Amnesia Haze', 'Cookies Zkittlez', 'Gelato 41']); // D100: a strain only in your Log too
  await sheet.getByRole('link', { name: /Gelato 41/ }).click();
  await expect(page).toHaveURL(/\/strainz\/Zkittlez\/vs\/Gelato%2041$/);
  const rows = await page.locator('table.vs tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.children].map((c) => (c.textContent ?? '').trim() + (c.classList.contains('win') ? '*' : ''))),
  );
  expect(rows).toEqual([
    ['8.0', 'Average', '8.3 (better)*'],
    ['3', 'Times tried', '3'],
    ['3g', 'Total smoked', '3.5g (better)*'],
    ['9.0 (better)*', 'Best', '8.5'],
    ['7.0', 'Lowest', '8.1 (better)*'],
    ['£26.00', 'Price per gram', '–'],
    ['0.48', 'Value for money', '–'],
    ['28 Oct 2026', 'Last tried', `${today()} (better)*`],
  ]);
  await shot(page, 'strainz-compare');
  expect(await axe()).toEqual([]);
});

test('Want to try: the + adds a strain (it says when you’ve tried it); a product with its name ticks it off', async () => {
  await page.goto('/strainz');
  await page.getByRole('button', { name: 'Add a strain to try' }).click();
  const sheet = page.getByRole('dialog', { name: 'A strain to try' });
  await sheet.getByLabel('Strain', { exact: true }).fill('zkittlez');
  await expect(sheet.locator('.hint')).toHaveText('You’ve tried Zkittlez: 3 times.');
  await sheet.getByLabel('Strain', { exact: true }).fill('runtz');
  await expect(sheet.locator('.hint')).toHaveCount(0);
  await sheet.getByLabel('Note (optional)').fill('Heard about it from Drew');
  await shot(page, 'strainz-want-sheet');
  expect(await axe()).toEqual([]);
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(sheet).toBeHidden();
  // A Want to try shelf appears, between Most tried and Recently tried, with Add one at its end.
  await expect(page.locator('.shelf h2')).toHaveText(['Your favourites', 'Most smoked', 'Most tried', 'Want to try', 'Recently tried', 'Unranked']);
  await expect(shelf('Want to try')).toHaveText(['Runtz', 'Add one']);
  // See all: the whole list, with its notes.
  await page.getByRole('link', { name: 'See all: Want to try' }).click();
  await expect(page).toHaveURL(/\/strainz\/list\/want$/);
  await expect(page.locator('.wants .w-name')).toHaveText(['Runtz']);
  await expect(page.locator('.wants .w-note')).toHaveText(['Heard about it from Drew']);
  await shot(page, 'strainz-want-list');
  expect(await axe()).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.w-name, .w-note, .wants .btn, .footnote'))).toEqual([]);
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
  await expect(shelf('Your favourites')).toContainText(['Runtz']);
  await expect(page.locator('.shelf h2')).not.toContainText(['Want to try']);
});

test('a strain on the Want to try shelf: tap it for its note and Remove', async () => {
  await call('POST', '/api/wants', { kind: 'strain', name: 'Apple Fritter', note: 'Kush Co sometimes has it' });
  await page.goto('/strainz');
  await page.getByRole('button', { name: 'Apple Fritter, on your Want to try list' }).click();
  const sheet = page.getByRole('dialog', { name: 'Apple Fritter' });
  await expect(sheet).toContainText('Kush Co sometimes has it');
  expect(await axe()).toEqual([]);
  await sheet.getByRole('button', { name: 'Remove from list' }).click();
  await expect(page.locator('.shelf h2')).not.toContainText(['Want to try']);
  expect((await call('GET', '/api/wants')).wants).toEqual([]);
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
  await expect(page.locator('.tile', { hasText: 'Tried' }).locator('b')).toHaveText('6'); // five products and the Log entry
  await page.goto('/strainz');
  await expect(shelf('Your favourites')).toHaveText(['Cookies Zkittlez', 'Zkittlez', 'Runtz', 'Wedding Cake']);
});

test('a product moved to Unranked shows there, and Back from it goes to Strainz', async () => {
  const p = (await product('Blue Dream', { ratings: rated(6) })).product;
  await page.goto('/strainz');
  await page.goto(`/products/${p.id}`);
  await page.getByRole('button', { name: 'Move to Unranked' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Unranked' }).click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/strainz$/);
  await expect(shelf('Unranked')).toHaveText(['Blue Dream', 'Amnesia Haze']);
});

test('D100: a strain’s Log entries are on its page (no score), and a strain only in your Log opens a strain page too', async () => {
  await page.goto('/strainz');
  await page.getByRole('list', { name: 'Unranked', exact: true }).getByRole('link', { name: 'Amnesia Haze, unranked' }).click();
  await expect(page).toHaveURL(/\/strainz\/Amnesia%20Haze$/);
  await expect(page.locator('.sh-name')).toHaveText('Amnesia Haze');
  await expect(page.locator('.strain-place')).toHaveText('Only in your Log so far.');
  const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => `${e.querySelector('.cap')!.textContent} ${e.querySelector('b')!.textContent}`));
  expect(tiles).toEqual(['Average –', 'Tried 1', 'Best –']);
  await expect(page.getByRole('heading', { name: /^Your .* products/ })).toHaveCount(0);
  const log = page.getByRole('region', { name: /From your Log/ });
  await expect(log.locator('.lrow .name')).toHaveText([`Amnesia Haze${'Flower · ' + today()}`]);
  await expect(log.locator('.footnote')).toHaveText('Not rated yet. Open one and add it to your Leaderboard to give it a score.');
  expect(await axe()).toEqual([]);
  expect(await wholeScreenContrastFailures(page, '/strainz/Amnesia%20Haze', '.sh-name, .strain-place, .lrow .name, .lr-m, .role.log, .footnote')).toEqual([]);
  // A strain with products and a Log entry lists both (Gelato 41 was renamed into Zkittlez above); the entry opens
  // its own page.
  await page.goto('/strainz/Zkittlez');
  await expect(page.locator('.tile', { hasText: 'Tried' }).locator('b')).toHaveText('6');
  await expect(page.locator('.facts > div', { hasText: 'Total smoked' }).locator('dd')).toHaveText('6.5g');
  await expect(page.locator('.rows .row')).toHaveCount(5);
  const entry = page.getByRole('region', { name: /From your Log/ }).locator('.lrow');
  await expect(entry.locator('.lr-m')).toHaveText(`Flower · ${today()} · 3.5g`);
  await expect(page.getByRole('region', { name: /From your Log/ }).locator('.footnote')).toHaveText('Log entries have no score, so they don’t change the average.');
  await shot(page, 'strainz-strain-log');
  expect(await axe()).toEqual([]);
  await entry.click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  // An edible-only name has no strain page.
  await page.goto('/strainz/Gummy%20Bears');
  await expect(page.locator('.sh-name')).toHaveCount(0);
});
