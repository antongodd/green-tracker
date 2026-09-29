import { expect, test, type Browser, type Page } from '@playwright/test';
import { scoreHeat } from '../../shared/domain/heat';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, signUp, textBoxes } from './helpers';

// D32 (0.25.0): on a product page each counting rating's bar and number take its score's
// colour (the Leaderboard's amber → mint, D30). High where it doesn't count stays grey;
// unrated stays plain. Your pages and a friend's. Two people in two browsers.
test.describe.configure({ mode: 'serial' });
let owner: Page, fan: Page;
let ownerName = '';
const ids: Record<string, string> = {};

const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}
/** Each bar: its label, heat colour (or null), number colour and whether it's the grey High. */
const bars = (page: Page) =>
  page.locator('.rbar').evaluateAll((els) =>
    els.map((e) => ({ label: e.querySelector('span')!.textContent, heat: e.getAttribute('data-heat'), muted: e.classList.contains('muted'), v: getComputedStyle(e.querySelector('.v')!).color, fill: e.querySelector<HTMLElement>('.fill') ? getComputedStyle(e.querySelector('.fill')!).backgroundImage : null })),
  );
const open = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator('.rbar').first()).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  let fanName: string;
  ({ page: owner, name: ownerName } = await person(browser, 'bars'));
  ({ page: fan, name: fanName } = await person(browser, 'bfan'));
  const seed: [string, Partial<ProductInput>][] = [
    ['Mixed', { ratings: { look: 7.8, smell: 6.4, taste: 5.1, burn: 3.6, high: 7.2 } }],
    ['Edible', { productType: 'edibles', ratings: { taste: 6, high: 9 } }],
    ['Partial', { ratings: { look: 7.9 } }],
  ];
  for (const [name, over] of seed) ids[name] = (await post(owner, '/api/products', { ...emptyProductInput(), name, ...over })).product.id;
  await post(fan, `/api/people/u/${ownerName}/follow`, {});
  await post(owner, `/api/people/requests/${fanName}/approve`, {});
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

const MIXED = [
  { label: 'Look', heat: scoreHeat('look', 7.8), muted: false },
  { label: 'Smell', heat: scoreHeat('smell', 6.4), muted: false },
  { label: 'Taste', heat: scoreHeat('taste', 5.1), muted: false },
  { label: 'Burn', heat: scoreHeat('burn', 3.6), muted: false },
  { label: 'High', heat: null, muted: true },
];

test('each counting bar and its number take the score’s colour; High that doesn’t count stays grey', async () => {
  await open(owner, `/products/${ids.Mixed}`);
  const got = await bars(owner);
  expect(got.map(({ label, heat, muted }) => ({ label, heat, muted }))).toEqual(MIXED);
  for (const b of got.filter((x) => x.heat)) {
    expect(b.v, b.label!).toBe(b.heat);
    expect(b.fill, b.label!).toContain(b.heat!.replace(/\s/g, ' '));
  }
  // The grey High keeps today's look.
  expect(got[4]!.fill).toBe('none');
  expect(got[4]!.v).not.toBe(scoreHeat('high', 7.2));
});

test('on an edible High counts, so it’s coloured too; unrated categories stay plain', async () => {
  await open(owner, `/products/${ids.Edible}`);
  expect((await bars(owner)).map(({ label, heat }) => ({ label, heat }))).toEqual([
    { label: 'Taste', heat: scoreHeat('taste', 6) },
    { label: 'High', heat: scoreHeat('high', 9) },
  ]);
  await open(owner, `/products/${ids.Partial}`);
  const got = await bars(owner);
  expect(got.map(({ label, heat }) => ({ label, heat }))).toEqual([
    { label: 'Look', heat: scoreHeat('look', 7.9) },
    { label: 'Smell', heat: null },
    { label: 'Taste', heat: null },
    { label: 'Burn', heat: null },
    { label: 'High', heat: null },
  ]);
  await expect(owner.locator('.rbar .v.none')).toHaveCount(4);
});

test('a friend’s product page gets the same colours', async () => {
  await open(fan, `/u/${ownerName}/p/${ids.Mixed}`);
  expect((await bars(fan)).map(({ label, heat, muted }) => ({ label, heat, muted }))).toEqual(MIXED);
});

test('the coloured numbers stay readable, from amber to mint', async () => {
  await open(owner, `/products/${ids.Mixed}`);
  await owner.locator('main').evaluate((m) => Promise.all(m.getAnimations().map((a) => a.finished)));
  await owner.locator('.rbar').first().evaluate((e) => scrollTo(0, e.getBoundingClientRect().top + scrollY - 200));
  const worst = await contrastFailures(owner, await textBoxes(owner, '.rbar[data-heat] .v'), 1);
  expect(worst, worst.join('\n')).toEqual([]);
  await open(owner, `/products/${ids.Edible}`);
  await owner.locator('.rbar').first().evaluate((e) => scrollTo(0, e.getBoundingClientRect().top + scrollY - 200));
  const worst2 = await contrastFailures(owner, await textBoxes(owner, '.rbar[data-heat] .v'), 1);
  expect(worst2, worst2.join('\n')).toEqual([]);
});
