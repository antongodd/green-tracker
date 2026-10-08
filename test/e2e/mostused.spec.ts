import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Most used (D44, 0.37.0; option C "Flame" with never-smoked left out). Rank by → Most used on
// your own Leaderboard ranks by how many times you've had each product, all time: the Smokes
// flame in amber before the count, TIMES under it; never smoked is left out (a line says how
// many); a tie goes to the higher Overall; the top three get the rainbow, Diamond and Gold; no
// heat colours (a count isn't a score). A friend's board doesn't offer it.
test.describe.configure({ mode: 'serial' });

let page: Page;
let username = '';
const ids: Record<string, string> = {};

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const product = async (name: string, over: Record<string, unknown>) => (ids[name] = (await post('/api/products', { ...emptyProductInput(), name, ...over })).product.id);
const smokes = async (name: string, n: number) => {
  for (let i = 0; i < n; i++) await post('/api/smokes', { productId: ids[name], logEntryId: null, date: '2026-10-01', time: `1${i % 10}:00`, amount: null, effect: null });
};
const rankBy = (value: string) => page.getByLabel('Rank by', { exact: true }).selectOption(value);
const rows = () => page.locator('.rows .row');
const axe = async () => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  username = await signUp(page, `mu${Date.now().toString(36).slice(-6)}`);
  await product('Wedding Cake', { ratings: { look: 9, smell: 9, taste: 9, burn: 9 } });
  await product('Zkittlez', { ratings: { look: 8, smell: 8, taste: 8, burn: 8 } });
  await product('Lemon Haze', { ratings: { look: 7, smell: 7, taste: 7, burn: 7 } });
  await product('Gelato 41', { ratings: { look: 6, smell: 6, taste: 6, burn: 6 } });
  await product('Sour Gummies', { productType: 'edibles', ratings: { taste: 5, high: 5 } });
  await product('Never Tried', { ratings: { look: 10, smell: 10, taste: 10, burn: 10 } });
  await product('Also Never', {});
});

test('nothing smoked yet: Most used says so, with Add a smoke and Rank by Overall', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(7);
  await rankBy('used');
  const empty = page.locator('.empty[data-art="smokes"]');
  await expect(empty).toContainText('Nothing smoked yet');
  await expect(empty.getByRole('link', { name: 'Add a smoke' })).toHaveAttribute('href', '/smokes/new');
  await empty.getByRole('button', { name: 'Rank by Overall' }).click();
  await expect(rows()).toHaveCount(7);
});

test('most first, the flame and TIMES; a tie goes to the higher Overall; never smoked left out', async () => {
  await smokes('Gelato 41', 4); // ties with Lemon Haze at 4: Lemon Haze has the higher Overall
  await smokes('Lemon Haze', 4);
  await smokes('Zkittlez', 9);
  await smokes('Wedding Cake', 23);
  await smokes('Sour Gummies', 2);
  await page.goto('/');
  await rankBy('used');
  await expect(rows()).toHaveCount(5);
  expect(await rows().locator('.name').allTextContents()).toEqual(['Wedding Cake', 'Zkittlez', 'Lemon Haze', 'Gelato 41', 'Sour Gummies']);
  expect(await rows().locator('.score b').allTextContents()).toEqual(['23', '9', '4', '4', '2']);
  await expect(rows().locator('.score .cap').first()).toHaveText('TIMES');
  await expect(page.getByLabel('Rank by', { exact: true })).toHaveValue('used');
  await expect(page.locator('.pill.active').first()).toContainText('Most used');
  await expect(page.locator('.footnote')).toHaveText('2 never smoked, not shown. Ties go to the higher Overall.');

  // The amber flame before every count, beside the number, never flowing with the podium colours.
  for (const row of await rows().all()) {
    const got = await row.locator('.score').evaluate((s) => {
      const f = s.querySelector('svg.flame')!.getBoundingClientRect();
      const b = s.querySelector('b')!.getBoundingClientRect();
      return { colour: getComputedStyle(s.querySelector('svg.flame')!).color, beside: f.right <= b.left + 1 && Math.abs(f.top + f.height / 2 - (b.top + b.height / 2)) < 6 };
    });
    expect(got).toEqual({ colour: 'rgb(240, 169, 59)', beside: true });
  }
  // The top three are the podium; the rest plain: no heat glow on a count.
  for (let i = 0; i < 3; i++) await expect(rows().nth(i)).toHaveClass(new RegExp(`\\btier p${i + 1}\\b`));
  for (let i = 3; i < 5; i++) {
    await expect(rows().nth(i)).not.toHaveClass(/tier/);
    await expect(rows().nth(i)).not.toHaveAttribute('data-heat');
  }
  // The count still fits its column with three digits.
  const fits = await rows().first().locator('.score').evaluate((s) => s.scrollWidth <= s.clientWidth + 1);
  expect(fits).toBe(true);
  expect(await axe()).toEqual([]);
  await shot(page, '140-most-used');
});

test('the counts stay readable on the podium through the motion', async () => {
  await page.goto('/');
  await expect(page.getByLabel('Rank by', { exact: true })).toHaveValue('used');
  await expect(rows().first()).toHaveClass(/tier p1/);
  const worst = await contrastFailures(page, await textBoxes(page, '.row.tier .score b, .row.tier .score .cap'));
  expect(worst, worst.join('\n')).toEqual([]);
});

test('the Type filter applies; the product page wears its place and badge', async () => {
  await page.goto('/');
  await page.getByLabel('Type', { exact: true }).selectOption('edibles');
  await expect(rows()).toHaveCount(1);
  await expect(rows().first()).toContainText('Sour Gummies');
  await expect(page.getByLabel('Rank by', { exact: true })).toHaveValue('used');
  await page.getByLabel('Type', { exact: true }).selectOption('all');

  await page.goto(`/products/${ids['Wedding Cake']}`);
  await expect(page.locator('main')).toHaveAttribute('data-podium', '1');
  await expect(page.locator('.podium-badge')).toHaveText('#1 by Most used');
  await page.goto(`/products/${ids['Lemon Haze']}`);
  await expect(page.locator('main')).toHaveAttribute('data-podium', '3');
  await page.goto(`/products/${ids['Never Tried']}`);
  await expect(page.locator('main')).toHaveAttribute('data-podium', 'none');

  // A new smoke moves the order straight away.
  await smokes('Gelato 41', 1);
  await page.goto('/');
  await expect(rows()).toHaveCount(5);
  expect(await rows().locator('.name').allTextContents()).toEqual(['Wedding Cake', 'Zkittlez', 'Gelato 41', 'Lemon Haze', 'Sour Gummies']);
});

test('a friend’s board doesn’t offer Most used, and your choice stays yours', async ({ browser }) => {
  const fan = await (await browser.newContext()).newPage();
  const fanName = await signUp(fan, `muf${Date.now().toString(36).slice(-6)}`);
  await fan.evaluate(async (body) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { ...emptyProductInput(), name: 'Fan Pick', ratings: { look: 7 } });
  await fan.evaluate((u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), username);
  await page.evaluate((u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), fanName);
  // The owner follows back, so the owner can look at a board that isn't theirs too.
  await page.evaluate((u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), fanName);
  await fan.evaluate((u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), username);

  await fan.goto(`/u/${username}`);
  await expect(fan.locator('.row').first()).toBeVisible();
  const options = await fan.getByLabel('Rank by', { exact: true }).locator('option').allTextContents();
  expect(options).toContain('Overall');
  expect(options).not.toContain('Most used');

  await page.goto(`/u/${fanName}`);
  await expect(page.getByLabel('Rank by', { exact: true })).toHaveValue('overall');
  expect(await page.getByLabel('Rank by', { exact: true }).locator('option').allTextContents()).not.toContain('Most used');
  await page.goto('/');
  await expect(page.getByLabel('Rank by', { exact: true })).toHaveValue('used');
  await fan.close();
});
