import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// Currencies (D66, 0.56.0): a purchase in €, converted into your main currency (£) with the rate
// for its day, saved with it. The rates come from the test server's stand-in (test/fxStub.mjs):
// per euro, GBP 0.85 + day/1000 (20 Oct 2026 → £0.87), working days only; any day in 2001 fails.
// One account; products seeded by the API.
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};
const send = (method: string, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { method, path, body });
const product = async (name: string, over: Partial<ProductInput>) => (ids[name] = (await send('POST', '/api/products', { ...emptyProductInput(), name, ...over })).product.id);

const open = () => page.locator('.pcard.open');
const fxline = () => open().locator('.fxline');

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `fx${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  await page.evaluate(() => localStorage.removeItem('gt.currency.last'));
  await product('Lemon Kush', { ratings: { look: 9 }, purchases: [{ date: '2026-10-01', amount: 3.5, totalPaid: 35, supplier: 'Green Leaf' }] });
});
test.afterAll(() => page.context().close());

test('a purchase in €: pick the currency, the rate for its day comes in, and the £ it came to', async () => {
  await page.goto('/products/new');
  await page.getByLabel('Name').fill('Amnesia Haze');
  await page.getByRole('button', { name: 'Add purchase' }).click();
  // Starts in your main currency: no conversion line.
  await expect(open().locator('.cur-face')).toHaveText('£');
  await expect(fxline()).toHaveCount(0);
  await open().getByLabel('Date').fill('2026-10-20');
  await open().getByLabel('Amount (g)').fill('3.5');
  await open().getByLabel('Total paid').fill('40');
  await open().getByLabel('Currency').selectOption('EUR');
  await expect(open().locator('.cur-face')).toHaveText('€');
  await expect(fxline()).toHaveText(/≈ £34\.80\s*€1 = £0\.87\s*Change/);
  // The row: what you paid, the price per gram in £, and as paid underneath.
  await expect(open().locator('.psum .l > span')).toHaveText('3.5g · €40.00');
  await expect(open().locator('.psum .fx')).toHaveText('€');
  await expect(open().locator('.psum .r')).toHaveText('£9.94/g€11.43/g');
  await expect(open().locator('.pcard-foot span').first()).toHaveText('£9.94/g');
  await settled(page);
  await shot(page, '660-currency-purchase');
  expect((await new AxeBuilder({ page }).include('.pcard.open').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/(?!new$)[^/]+$/);
  ids['Amnesia Haze'] = page.url().split('/').pop()!;
  // The product page: the price per gram in £; the purchase as paid, with the £ it came to.
  await expect(page.locator('.hero-price')).toHaveText('£9.94/g');
  const history = page.locator('.purchase');
  await expect(history.locator('.d')).toHaveText('20 Oct 2026Latest€');
  await expect(history.locator('.u')).toHaveText('£9.94/g');
  await expect(history.locator('.s').first()).toHaveText('3.5g · €40.00 (≈ £34.80)');
});

test('Change: a rate you type is kept, even when the date changes', async () => {
  await page.goto(`/products/${ids['Amnesia Haze']}/edit`);
  await page.locator('.pcard .psum').first().click();
  await expect(fxline()).toContainText('€1 = £0.87');
  await fxline().getByRole('button', { name: 'Change' }).click();
  const box = open().getByLabel('£ for €1');
  await expect(box).toHaveValue('0.87');
  await box.fill('0.9');
  await expect(fxline()).toContainText('≈ £36.00');
  await fxline().getByRole('button', { name: 'Done' }).click();
  await expect(fxline()).toHaveText(/≈ £36\.00\s*€1 = £0\.90\s*Change/);
  await open().getByLabel('Date').fill('2026-10-19');
  await expect(fxline()).toContainText('€1 = £0.90');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.hero-price')).toHaveText('£10.29/g');
  // Undo the typing: back to the day's rate when the currency is picked again.
  await page.goto(`/products/${ids['Amnesia Haze']}/edit`);
  await page.locator('.pcard .psum').first().click();
  await open().getByLabel('Currency').selectOption('GBP');
  await expect(fxline()).toHaveCount(0);
  await open().getByLabel('Currency').selectOption('EUR');
  await expect(fxline()).toContainText('€1 = £0.869'); // 19 Oct: 0.85 + 0.019
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.hero-price')).toHaveText('£9.93/g');
});

test('a new purchase starts in the currency of the last one you added, with today’s rate', async () => {
  await page.goto(`/products/${ids['Lemon Kush']}/edit`);
  await page.getByRole('button', { name: 'Add purchase' }).click();
  await expect(open().locator('.cur-face')).toHaveText('€');
  await expect(fxline()).toContainText(/€1 = £0\.8\d/);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('when the rate can’t be had, the rate box opens; saving without it says what to do', async () => {
  await page.goto(`/products/${ids['Lemon Kush']}/edit`);
  await page.getByRole('button', { name: 'Add purchase' }).click();
  await open().getByLabel('Date').fill('2001-05-02');
  await open().getByLabel('Total paid').fill('20');
  await expect(fxline()).toContainText('Couldn’t get the rate. Type it in.');
  await expect(open().getByLabel('£ for €1')).toHaveValue('');
  await expect(fxline().getByRole('button', { name: 'Done' })).toBeDisabled();
  // Fold it away and save: it opens again and says why.
  await open().locator('.psum').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.savebar .error')).toHaveText('Type the exchange rate for the purchase in €.');
  await expect(open().getByLabel('£ for €1')).toBeVisible();
  await open().getByLabel('£ for €1').fill('0.6');
  await expect(fxline()).toContainText('≈ £12.00');
  // A typed rate stays when the date changes (and 2001 would stop the main currency changing later).
  await open().getByLabel('Date').fill('2026-10-15');
  await expect(fxline()).toContainText('≈ £12.00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${ids['Lemon Kush']}$`));
  await expect(page.locator('.purchase .s', { hasText: '€20.00' })).toHaveText('€20.00 (≈ £12.00)');
});

test('the Leaderboard compares in £: what you paid follows, smaller', async () => {
  await page.goto('/');
  const row = page.locator('a.row', { hasText: 'Amnesia Haze' });
  await expect(row.locator('.meta .price')).toHaveText('£9.93/g');
  await expect(row.locator('.meta .paid')).toHaveText('€11.43/g');
  // A £ purchase has no second price.
  await expect(page.locator('a.row', { hasText: 'Lemon Kush' }).locator('.meta .paid')).toHaveCount(0);
  await settled(page);
  await shot(page, '662-currency-board');
  expect(await contrastFailures(page, await textBoxes(page, 'a.row .meta .price, a.row .meta .paid'), 4)).toEqual([]);
});

test('readable: the purchase’s currency, conversion line and rate box', async () => {
  await page.goto(`/products/${ids['Amnesia Haze']}/edit`);
  await page.locator('.pcard .psum').first().click();
  await fxline().scrollIntoViewIfNeeded();
  await settled(page);
  expect(await contrastFailures(page, await textBoxes(page, '.pcard.open .fx, .pcard.open .psum .r small, .cur-face b, .fx-sum b, .fx-rate, .fx-btn'), 4)).toEqual([]);
  await page.goto(`/products/${ids['Amnesia Haze']}/edit`);
  await page.locator('.pcard .psum').first().click();
  await fxline().getByRole('button', { name: 'Change' }).click();
  await fxline().scrollIntoViewIfNeeded();
  await settled(page);
  expect((await new AxeBuilder({ page }).include('.pcard.open').analyze()).violations).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.fxline.open label, .fx-sum b, .fx-btn'), 4)).toEqual([]);
});

test('Settings → Main currency: € works every price out again; back to £', async () => {
  await page.goto('/more');
  const row = page.locator('.li', { hasText: 'Main currency' });
  await expect(row.locator('.v')).toHaveText('£ GBP');
  await row.click();
  await expect(page).toHaveURL(/\/more\/currency$/);
  await expect(page.getByRole('radio', { name: /Pound sterling/ })).toBeChecked();
  // Every sign in a tile of one width, so the names line up.
  expect(new Set(await page.locator('.cur-row .cur-sign').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))).size).toBe(1);
  await settled(page);
  await shot(page, '661-main-currency');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('radio', { name: /Euro/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Use € for your prices?' });
  await expect(sheet).toContainText('Every price is worked out again in Euro (EUR), each purchase at the rate for its day.');
  await sheet.getByRole('button', { name: 'Use € EUR' }).click();
  await expect(page.getByRole('radio', { name: /Euro/ })).toBeChecked();
  await page.goto('/');
  // Now the £ purchase is the one converted; the € one is as paid.
  const amnesia = page.locator('a.row', { hasText: 'Amnesia Haze' });
  await expect(amnesia.locator('.meta .price')).toHaveText('€11.43/g');
  await expect(amnesia.locator('.meta .paid')).toHaveCount(0);
  // On a product page the £ purchase is now the one tagged, with the € it came to on its day (1 Oct: £0.851 a euro).
  await page.goto(`/products/${ids['Lemon Kush']}`);
  const pound = page.locator('.purchase', { hasText: '1 Oct 2026' });
  await expect(pound.locator('.fx')).toHaveText('£');
  await expect(pound.locator('.s').first()).toHaveText('3.5g · £35.00 (≈ €41.13)');
  await page.goto('/more/currency');
  await page.getByRole('radio', { name: /Pound sterling/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Use £ GBP' }).click();
  await expect(page.getByRole('radio', { name: /Pound sterling/ })).toBeChecked();
  await expect(page.locator('.error')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('a.row', { hasText: 'Amnesia Haze' }).locator('.meta .price')).toHaveText('£9.93/g');
});

test('readable: Main currency, top to bottom', async () => {
  expect(await wholeScreenContrastFailures(page, '/more/currency', '.cur-row .cur-sign, .cur-row .main > span, .priv-foot, .lh.cap')).toEqual([]);
});
