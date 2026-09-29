import { expect, test, type Browser, type Page } from '@playwright/test';
import { scoreHeat } from '../../shared/domain/heat';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, signUp, textBoxes } from './helpers';

// D30 (0.23.0): below the podium, a row glows in its score's colour (amber → yellow-green →
// mint). Never the podium rows, price or value for money rankings, or unrated rows. On your
// board, a friend's, and the Archive. Two people in two browsers.
test.describe.configure({ mode: 'serial' });
let owner: Page, fan: Page;
let ownerName = '';
const ids: Record<string, string> = {};

const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const buy = (paid: number) => [{ date: '2026-09-01', amount: 1, totalPaid: paid, supplier: null }];

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}

/** Each row's name, its heat colour (or null) and the colour of its score. */
const rows = (page: Page) =>
  page.locator('.row').evaluateAll((els) =>
    els.map((e) => ({ name: e.querySelector('.name')!.textContent, heat: e.getAttribute('data-heat'), score: getComputedStyle(e.querySelector('.score b')!).color })),
  );

test.beforeAll(async ({ browser }) => {
  let fanName: string;
  ({ page: owner, name: ownerName } = await person(browser, 'heat'));
  ({ page: fan, name: fanName } = await person(browser, 'hfan'));
  const seed: [string, number | null][] = [['Top A', 9.9], ['Top B', 9.8], ['Top C', 9.7], ['Top D', 9.6], ['Minty', 9.2], ['Middle', 6.8], ['Lower', 5.5], ['Lowest', 3], ['Blank', null], ['Shelved', 7.4]];
  for (const [name, look] of seed) {
    const body: ProductInput = { ...emptyProductInput(), name, ratings: look === null ? {} : { look }, purchases: buy(10 + (look ?? 0)) };
    ids[name] = (await post(owner, '/api/products', body)).product.id;
  }
  await post(owner, `/api/products/${ids.Shelved}/archived`, { value: true });
  await post(fan, `/api/people/u/${ownerName}/follow`, {});
  await post(owner, `/api/people/requests/${fanName}/approve`, {});
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

const expected = [
  { name: 'Top A', heat: null }, { name: 'Top B', heat: null }, { name: 'Top C', heat: null }, { name: 'Top D', heat: null },
  { name: 'Minty', heat: scoreHeat('overall', 9.2) }, { name: 'Middle', heat: scoreHeat('overall', 6.8) },
  { name: 'Lower', heat: scoreHeat('overall', 5.5) }, { name: 'Lowest', heat: scoreHeat('overall', 3) }, { name: 'Blank', heat: null },
];

test('rows below the podium glow in their score’s colour; the podium and unrated rows don’t', async () => {
  await owner.goto('/');
  await expect(owner.locator('.row')).toHaveCount(9);
  const got = await rows(owner);
  expect(got.map(({ name, heat }) => ({ name, heat }))).toEqual(expected);
  // The score takes the colour; the glow's edge matches.
  for (const r of got) if (r.heat) expect(r.score, r.name!).toBe(r.heat);
  expect(await owner.locator('.row[data-heat]').first().evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
  expect(scoreHeat('overall', 3)).toBe('rgb(224, 163, 92)'); // amber at the bottom
  expect(scoreHeat('overall', 9.2)).toBe('rgb(141, 243, 182)'); // mint at the top
});

test('ranking by price turns it off; ranking by a rating follows that rating', async () => {
  await owner.goto('/');
  await owner.getByLabel('Type', { exact: true }).selectOption('flower');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('price');
  await expect(owner.locator('.row')).toHaveCount(9);
  await expect(owner.locator('.row .score .cap').first()).toHaveText(/price/i);
  await expect(owner.locator('.row[data-heat]')).toHaveCount(0);
  await owner.getByLabel('Rank by', { exact: true }).selectOption('look');
  await expect(owner.locator('.row')).toHaveCount(8); // Blank has no Look
  await expect(owner.locator('.row[data-heat]')).toHaveCount(4);
  await owner.getByLabel('Type', { exact: true }).selectOption('all');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('overall');
});

test('a friend’s board and the Archive glow too', async () => {
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row')).toHaveCount(9);
  expect((await rows(fan)).map(({ name, heat }) => ({ name, heat }))).toEqual(expected);
  await owner.goto('/more/archive');
  await expect(owner.locator('.row')).toHaveCount(1);
  await expect(owner.locator('.row')).toHaveAttribute('data-heat', scoreHeat('overall', 7.4)!);
});

test('the coloured scores and the text on the glow stay readable, from amber to mint', async () => {
  await owner.goto('/');
  await expect(owner.locator('.row[data-heat]')).toHaveCount(4);
  await owner.locator('main').evaluate((m) => Promise.all(m.getAnimations().map((a) => a.finished)));
  // Bring the glowing rows into view below the sticky controls.
  await owner.evaluate(() => {
    const first = document.querySelector<HTMLElement>('.row[data-heat]')!;
    scrollTo(0, first.getBoundingClientRect().top + scrollY - 200);
  });
  await expect.poll(() => owner.locator('.row[data-heat]').last().evaluate((e) => e.getBoundingClientRect().bottom)).toBeLessThan(760);
  const worst = await contrastFailures(owner, await textBoxes(owner, '.row[data-heat] .score b, .row[data-heat] .score .cap, .row[data-heat] .name, .row[data-heat] .meta span'), 1);
  expect(worst, worst.join('\n')).toEqual([]);
});
