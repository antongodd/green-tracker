import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { LIVE_PORT } from '../../playwright.config';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { DEFAULT_PRIVACY } from '../../shared/domain/privacy';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D46 (0.39.0): Smokes is off on the live site until it's re-released. These run on a second
// server with SMOKES off, as on live: four tabs, no Smokes anywhere, no Most used, no Smokes
// switches. What was saved is kept (and comes back with Smokes); everything else is as before.
test.use({ baseURL: `http://localhost:${LIVE_PORT}` });
test.describe.configure({ mode: 'serial' });

let page: Page, fan: Page;
let name = '';
let kushId = '';
let entryId = '';

const post = (p: Page, path: string, body: unknown): Promise<any> =>
  p.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const put = (p: Page, path: string, body: unknown): Promise<number> =>
  p.evaluate(async ({ path, body }) => (await fetch(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, { path, body });
const axe = async (p: Page) => {
  await settled(p);
  const { violations } = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

async function person(browser: Browser, prefix: string) {
  const p = await (await browser.newContext({ baseURL: `http://localhost:${LIVE_PORT}` })).newPage();
  return { page: p, name: await signUp(p, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page, name } = await person(browser, 'off'));
  const { page: f, name: fanName } = await person(browser, 'offf');
  fan = f;
  kushId = (await post(page, '/api/products', { ...emptyProductInput(), name: 'Live Kush', ratings: { look: 8 } })).product.id;
  await post(page, '/api/products', { ...emptyProductInput(), name: 'Live Bud', ratings: { look: 6 } });
  entryId = (await post(page, '/api/log', { ...emptyLogEntryInput(), name: 'Live Entry' })).entry.id;
  // Everything about smokes shared, as someone might have set it at 0.38.0: none of it applies here.
  expect(await put(page, '/api/privacy', { ...DEFAULT_PRIVACY, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true })).toBe(200);
  await fan.evaluate((u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), name);
  await page.evaluate((u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), fanName);
});

test('four tabs, each a quarter of the bar; a Smokes address opens the Leaderboard', async () => {
  await page.goto('/');
  await expect(page.locator('.nav .tab-l')).toHaveText(['Leaderboard', 'Log', 'People', 'More']);
  const widths = await page.locator('.nav .tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  for (const w of widths) expect(w).toBeCloseTo(390 / 4, 0);
  for (const path of ['/smokes', '/smokes/new', `/smokes/new/p/${kushId}`]) {
    await page.goto(path);
    await expect(page.locator('.nav .tab[aria-current="page"]'), path).toHaveText('Leaderboard');
    await expect(page.locator('.row').first(), path).toBeVisible();
  }
  expect(await axe(page)).toEqual([]);
  await shot(page, '160-smokes-off-board');
  await settled(page);
  expect(await contrastFailures(page, await textBoxes(page, '.nav .tab-l'), 1)).toEqual([]);
});

test('no Most used in Rank by; one chosen before shows Overall, and is kept for when Smokes is back', async () => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('gt.view', JSON.stringify({ filter: 'all', rankBy: 'used' })));
  await page.reload();
  await expect(page.locator('.row').first()).toBeVisible();
  const rankBy = page.getByLabel('Rank by', { exact: true });
  await expect(rankBy).toHaveValue('overall');
  expect(await rankBy.locator('option').allTextContents()).not.toContain('Most used');
  await expect(page.locator('.row .score svg.flame')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gt.view')!).rankBy)).toBe('used');
});

test('no Smokes card on a product or a Log entry', async () => {
  await page.goto(`/products/${kushId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Live Kush' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Smokes' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/smoke/i);
  await page.goto(`/log/${entryId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Live Entry' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Smokes' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/smoke/i);
});

test('Privacy keeps its other switches but offers none about smokes; More’s line agrees', async () => {
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /What followers see/ })).toContainText('Followers see: Leaderboard, Source, Country, Photos');
  await expect(page.getByRole('link', { name: /What followers see/ })).not.toContainText(/smoke|Most used/i);
  await page.goto('/more/privacy');
  await expect(page.getByRole('switch', { name: 'Share my Leaderboard', exact: true })).toBeChecked();
  for (const sw of ['Share my Leaderboard', 'Source', 'Country', 'Product photos', 'My profile photo']) await expect(page.getByRole('switch', { name: sw, exact: true }), sw).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Smokes' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/smoke|Most used/i);
  expect(await axe(page)).toEqual([]);
});

test('Export, Restore and Delete account don’t mention smokes', async () => {
  await page.goto('/more/export');
  await expect(page.getByRole('region', { name: 'In the file' }).locator('li.yes')).toHaveText([/^Every product/, 'Your whole Log', /^Every photo/, 'Your privacy and appearance settings']);
  await page.goto('/more/restore');
  await expect(page.locator('main')).toContainText('Replaces your products, Log and photos with an export file.');
  await page.goto('/more/delete');
  await expect(page.getByRole('region', { name: 'What goes' }).locator('li.gone')).toHaveCount(5);
  await expect(page.locator('main')).not.toContainText(/smoke/i);
});

test('a follower sees your board and pages as before, with nothing about smokes', async () => {
  await fan.goto(`/u/${name}`);
  await expect(fan.locator('.row')).toHaveCount(2);
  expect(await fan.getByLabel('Rank by', { exact: true }).locator('option').allTextContents()).not.toContain('Most used');
  await fan.goto(`/u/${name}/p/${kushId}`);
  await expect(fan.getByRole('heading', { level: 1, name: 'Live Kush' })).toBeVisible();
  await expect(fan.getByRole('region', { name: 'Smokes' })).toHaveCount(0);
  await expect(fan.locator('main')).not.toContainText(/smoke/i);
});
