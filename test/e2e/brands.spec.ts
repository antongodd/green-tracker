import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { settled, shot, signUp, wholeScreenContrastFailures } from './helpers';

// Brands and suppliers (D59, 0.49.0; option A of the mockups). Names you've used in Source and
// Supplier are offered under those boxes as you type, and saved in the spelling you already use;
// tapping one on a product page opens everything with that name (as the brand and/or where it was
// bought); the Sources tab (D61) shows them all as cards. A follower can tap your Source to see your
// products from that brand: never where you bought anything.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName = '';
const ids: Record<string, string> = {};

const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );
const product = async (name: string, over: Partial<ProductInput>) => {
  const p = (await call(owner, 'POST', '/api/products', { ...emptyProductInput(), name, ...over })).product;
  ids[name] = p.id;
  return p;
};
/** A real JPEG set uploaded from inside the page. */
const upload = (page: Page, colour: string): Promise<string> =>
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
const rated = (n: number) => ({ look: n, smell: n, taste: n, burn: n });
const buy = (supplier: string, totalPaid: number) => ({ date: '2026-10-01', amount: 2, totalPaid, supplier });
const axe = async (page: Page) => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
const suggestions = (page: Page, box: string) => page.locator(`.suggest[data-for="${box}"]`);
const chips = (page: Page, box: string) => suggestions(page, box).locator('.chip .t');
/** Names on a brand page's rows, best first, with their tags. */
const brandRows = async (page: Page, n: number) => {
  await expect(page.locator('.rows .row')).toHaveCount(n);
  return page.locator('.rows .row').evaluateAll((els) => els.map((e) => [e.querySelector('.name')!.textContent, [...e.querySelectorAll('.role')].map((r) => r.textContent).join(' + ')]));
};
const tiles = (page: Page) => page.locator('.tile').evaluateAll((els) => els.map((e) => `${e.querySelector('.cap')!.textContent} ${e.querySelector('b')!.textContent}`));

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'br'));
  const f = await person(browser, 'bf');
  fan = f.page;
  // Grasshopper: the brand of three (one private), where two were bought (one typed in small letters).
  // Grasshopper's best product has a photo: its card shows it (D61).
  const amnesia = await product('Amnesia Haze', { source: 'Grasshopper', ratings: rated(9), purchases: [buy('Grasshopper', 24)], photos: [{ upload: await upload(owner, '#3b8a4a'), crop: null }] });
  ids.amnesiaPhoto = amnesia.photos[0].id;
  await product('Super Lemon Haze', { ratings: rated(8), purchases: [buy('grasshopper', 30)] });
  await product('Cheese', { source: 'Grasshopper', ratings: rated(7) });
  await product('Secret Bud', { source: 'Grasshopper', ratings: rated(6), private: true });
  await product('Gelato', { source: 'Cookies', ratings: rated(8.5), purchases: [buy("Barney's", 15)] });
  // Archived: left out of everything.
  await product('Old One', { source: 'Old Brand', ratings: rated(5), purchases: [buy('Grasshopper', 99)] });
  await call(owner, 'POST', `/api/products/${ids['Old One']}/archived`, { value: true });
  await call(fan, 'POST', `/api/people/u/${ownerName}/follow`);
  await call(owner, 'POST', `/api/people/requests/${f.name}/approve`);
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

test('Source offers the names you use, most used first, and narrows as you type; a tap fills it and closes the keyboard', async () => {
  await owner.goto('/products/new');
  const source = owner.locator('#source');
  await source.click();
  // From Source and Supplier alike, archived products left out; the count is how many products.
  await expect(chips(owner, 'source')).toHaveText(['Grasshopper', "Barney's", 'Cookies']);
  await expect(suggestions(owner, 'source').locator('.chip').first()).toContainText('4');
  await source.fill('gr');
  await expect(chips(owner, 'source')).toHaveText(['Grasshopper']);
  await source.fill('old');
  await expect(suggestions(owner, 'source')).toHaveCount(0);
  await source.fill('gr');
  await suggestions(owner, 'source').getByRole('button', { name: /Grasshopper/ }).click();
  await expect(source).toHaveValue('Grasshopper');
  await expect(source).not.toBeFocused(); // D61: the box is done, so the keyboard goes
  await expect(suggestions(owner, 'source')).toHaveCount(0);
  expect(await axe(owner)).toEqual([]);
});

test('a tap still picks when the phone takes focus from the box as the finger lands', async () => {
  const source = owner.locator('#source');
  await source.fill('coo');
  const chip = suggestions(owner, 'source').getByRole('button', { name: /Cookies/ });
  const box = (await chip.boundingBox())!;
  // As iPhone Safari can: the box loses focus between the finger landing and the click.
  await chip.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: box.x + 5, clientY: box.y + 5 });
  await source.evaluate((e) => (e as HTMLInputElement).blur());
  await chip.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  await chip.click();
  await expect(source).toHaveValue('Cookies');
  await expect(source).not.toBeFocused();
  await source.fill('');
});

test('the same name spelt differently is saved as the spelling you use; a typo asks "Did you mean"', async () => {
  const source = owner.locator('#source');
  await source.fill('GRASS HOPPER');
  await expect(suggestions(owner, 'source')).toContainText('Saved as “Grasshopper”, the name you already use');
  await owner.locator('#name').click();
  await expect(source).toHaveValue('Grasshopper');
  await expect(suggestions(owner, 'source')).toHaveCount(0); // gone once you leave the box
  await source.fill('grashopper');
  await expect(suggestions(owner, 'source').locator('.suggest-cap')).toHaveText('Did you mean');
  await expect(chips(owner, 'source')).toHaveText(['Grasshopper']);
  await shot(owner, '160-brand-suggestions');
  // A new name is kept as typed, capitalised (as before).
  await source.fill('the bulldog');
  await owner.locator('#name').click();
  await expect(source).toHaveValue('The Bulldog');
});

test('keyboard: Tab moves into the suggestions without closing them, Enter picks one and returns to the box', async () => {
  const source = owner.locator('#source');
  await source.fill('c');
  await source.press('Tab');
  await expect(suggestions(owner, 'source').getByRole('button', { name: /Cookies/ })).toBeFocused();
  await owner.keyboard.press('Enter');
  await expect(source).toHaveValue('Cookies');
  await expect(source).toBeFocused();
});

test("Supplier offers the product's Source first, and saves the spelling you use", async () => {
  await owner.locator('#name').fill('Brand New');
  await owner.getByRole('button', { name: 'Add purchase' }).click();
  const supplier = owner.locator('[id$="-supplier"]');
  await supplier.click();
  const box = (await supplier.getAttribute('id'))!;
  await expect(chips(owner, box)).toHaveText(['Cookies', 'Grasshopper', "Barney's"]);
  await supplier.fill('barneys');
  await expect(suggestions(owner, box)).toContainText("Saved as “Barney's”");
  await owner.locator('[id$="-paid"]').fill('20');
  await expect(supplier).toHaveValue("Barney's");
  await owner.locator('.savebar .btn.primary').click();
  await expect(owner).toHaveURL(/\/products\/[^/]+$/);
  const saved = (await call(owner, 'GET', '/api/products')).products.find((p: any) => p.name === 'Brand New');
  expect([saved.source, saved.purchases[0].supplier]).toEqual(['Cookies', "Barney's"]);
  ids['Brand New'] = saved.id;
});

test("a product page's Source opens everything from that name, together and tagged, best first", async () => {
  await owner.goto(`/products/${ids['Amnesia Haze']}`);
  const details = owner.getByRole('region', { name: 'Details' });
  await details.getByRole('link', { name: 'Grasshopper' }).click();
  await expect(owner).toHaveURL(/\/brands\/Grasshopper$/);
  await expect(owner.locator('.hdr .title')).toHaveText('Grasshopper');
  await expect(owner.locator('.brand-lead')).toHaveText('Everything from Grasshopper, or bought there.');
  // Archived left out; private ones are yours, so they're here. Spent here: 24 + 30 (not the archived 99).
  expect(await brandRows(owner, 4)).toEqual([
    ['Amnesia Haze', 'Brand + Bought here'],
    ['Super Lemon Haze', 'Bought here'],
    ['Cheese', 'Brand'],
    ['Secret Bud', 'Brand'],
  ]);
  expect(await tiles(owner)).toEqual(['Products 4', 'Average 7.5', 'Spent here £54.00']);
  await expect(owner.locator('.nav .tab[aria-current="page"]')).toContainText('Leaderboard');
  expect(await axe(owner)).toEqual([]);
  await shot(owner, '161-brand-page'); // before the contrast check, which hides the text it measures
  expect(await wholeScreenContrastFailures(owner, '/brands/Grasshopper', '.brand-lead, .row .name, .role, .tile b, .tile .cap')).toEqual([]);
  // A row opens the product.
  await owner.locator('.row', { hasText: 'Cheese' }).click();
  await expect(owner).toHaveURL(new RegExp(`/products/${ids.Cheese}$`));
});

test('a purchase’s Supplier opens what you bought there', async () => {
  await owner.goto(`/products/${ids.Gelato}`);
  await owner.getByRole('region', { name: 'Price history' }).getByRole('link', { name: "Barney's" }).click();
  await expect(owner).toHaveURL(/\/brands\/Barney's$/);
  await expect(owner.locator('.brand-lead')).toHaveText("Everything you bought at Barney's.");
  expect(await brandRows(owner, 2)).toEqual([
    ['Gelato', 'Bought here'],
    ['Brand New', 'Bought here'],
  ]);
  expect(await tiles(owner)).toEqual(['Products 2', 'Average 8.5', 'Spent here £35.00']);
  // Only a brand: no Spent here.
  await owner.goto('/brands/Cookies');
  await expect(owner.locator('.brand-lead')).toHaveText('Everything from Cookies.');
  await expect(owner.locator('.rows .row')).toHaveCount(2);
  expect(await tiles(owner)).toEqual(['Products 2', 'Average 8.5']);
  // A name nobody uses any more.
  await owner.goto('/brands/Old%20Brand');
  await expect(owner.getByRole('heading', { name: 'Nothing from Old Brand' })).toBeVisible();
});

test('the Sources tab: every name as a card with its best product’s photo, to search and sort (D61)', async () => {
  await owner.goto('/');
  await owner.getByRole('link', { name: 'Sources', exact: true }).click();
  await expect(owner).toHaveURL(/\/sources$/);
  await expect(owner.locator('.hdr .title')).toHaveText('Brands & suppliers');
  await expect(owner.locator('.nav .tab[aria-current="page"]')).toHaveText('Sources');
  const names = () => owner.locator('.scard .nm');
  const card = (name: string) => owner.locator('.scard', { has: owner.locator('.nm', { hasText: name }) });
  // Most products first, then A–Z.
  await expect(names()).toHaveText(['Grasshopper', "Barney's", 'Cookies']);
  await expect(card('Grasshopper').locator('.sub')).toHaveText('4 products · best: Amnesia Haze');
  await expect(card('Grasshopper').locator('.role')).toHaveText(['Brand', 'Bought here']);
  await expect(card('Grasshopper').locator('.avg')).toHaveText('Average 7.5');
  await expect(card("Barney's").locator('.sub')).toHaveText('2 products · best: Gelato');
  await expect(card("Barney's").locator('.role')).toHaveText(['Bought here']);
  await expect(card('Cookies').locator('.role')).toHaveText(['Brand']);
  // The best product's photo, or its type's mark without one.
  await expect(card('Grasshopper').locator('.scard-ph img')).toHaveAttribute('src', new RegExp(ids.amnesiaPhoto!));
  await expect(card('Grasshopper').locator('.scard-ph img')).toHaveJSProperty('complete', true);
  await expect(card('Cookies').locator('.scard-ph svg')).toHaveCount(1);
  // Two a row.
  const [a, b] = [(await card('Grasshopper').boundingBox())!, (await card("Barney's").boundingBox())!];
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  expect(b.x).toBeGreaterThan(a.x + a.width);
  await owner.getByRole('button', { name: 'A–Z' }).click();
  await expect(owner.getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
  await expect(names()).toHaveText(["Barney's", 'Cookies', 'Grasshopper']);
  await owner.getByRole('button', { name: 'Best average' }).click();
  await expect(names()).toHaveText(["Barney's", 'Cookies', 'Grasshopper']);
  await owner.getByLabel('Search').fill('coo');
  await expect(names()).toHaveText(['Cookies']);
  await owner.getByLabel('Search').fill('zzz');
  await expect(owner.locator('.scards')).toContainText('No matching names');
  await owner.getByLabel('Search').fill('');
  await owner.getByRole('button', { name: 'Most products' }).click();
  await expect(names()).toHaveText(['Grasshopper', "Barney's", 'Cookies']);
  expect(await axe(owner)).toEqual([]);
  await shot(owner, '162-sources-tab'); // before the contrast check, which hides the text it measures
  expect(await wholeScreenContrastFailures(owner, '/sources', '.scard .nm, .scard .sub, .scard .avg, .scard .role')).toEqual([]);
  // A card opens its page, still under Sources; Back comes home.
  await card('Grasshopper').click();
  await expect(owner).toHaveURL(/\/brands\/Grasshopper$/);
  await expect(owner.locator('.nav .tab[aria-current="page"]')).toHaveText('Sources');
  await owner.getByRole('link', { name: 'Back' }).click();
  await expect(owner).toHaveURL(/\/sources$/);
  // Settings has no Brands & suppliers row any more; the old address still opens the tab.
  await owner.goto('/more');
  await expect(owner.locator('main')).not.toContainText('Brands & suppliers');
  await owner.goto('/more/brands');
  await expect(owner.locator('.nav .tab[aria-current="page"]')).toHaveText('Sources');
});

test("a follower taps your Source: your products from that brand, never where you bought anything", async () => {
  await fan.goto(`/u/${ownerName}/p/${ids['Amnesia Haze']}`);
  await fan.getByRole('region', { name: 'Details' }).getByRole('link', { name: 'Grasshopper' }).click();
  await expect(fan).toHaveURL(new RegExp(`/u/${ownerName}/brands/Grasshopper$`));
  await expect(fan.locator('.brand-lead')).toHaveText(`@${ownerName}’s products from Grasshopper.`);
  // Not Super Lemon Haze (only bought there), not the private or archived ones.
  await expect(fan.locator('.rows .row')).toHaveCount(2);
  expect(await fan.locator('.rows .row .name').allTextContents()).toEqual(['Amnesia Haze', 'Cheese']);
  expect(await tiles(fan)).toEqual(['Products 2', 'Average 8.0']);
  const text = (await fan.locator('main').textContent())!;
  for (const secret of ['Bought here', 'Spent', '£', "Barney's"]) expect(text, secret).not.toContain(secret);
  expect(await axe(fan)).toEqual([]);
  await shot(fan, '163-their-brand');
  // Their own supplier name finds nothing to show a follower.
  await fan.goto(`/u/${ownerName}/brands/Barney's`);
  await expect(fan.getByRole('heading', { name: "Nothing from Barney's" })).toBeVisible();
});

test("with Source not shared, a follower has nothing to tap and the brand's page is empty", async () => {
  const { privacy } = await call(owner, 'GET', '/api/privacy');
  await call(owner, 'PUT', '/api/privacy', { ...privacy, shareSource: false });
  await fan.goto(`/u/${ownerName}/p/${ids['Amnesia Haze']}`);
  await expect(fan.getByRole('region', { name: 'Ratings' })).toBeVisible();
  await expect(fan.locator('.namelink')).toHaveCount(0);
  await fan.goto(`/u/${ownerName}/brands/Grasshopper`);
  await expect(fan.getByRole('heading', { name: 'Nothing from Grasshopper' })).toBeVisible();
  await call(owner, 'PUT', '/api/privacy', privacy);
});

test('your own preview (More → Privacy) opens the brand as followers see it', async () => {
  await owner.goto(`/more/privacy/preview/p/${ids['Amnesia Haze']}`);
  await owner.getByRole('region', { name: 'Details' }).getByRole('link', { name: 'Grasshopper' }).click();
  await expect(owner).toHaveURL(/\/more\/privacy\/preview\/brands\/Grasshopper$/);
  await expect(owner.locator('.rows .row .name')).toHaveText(['Amnesia Haze', 'Cheese']);
});
