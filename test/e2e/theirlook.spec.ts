import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { LOOK_BG } from '../../shared/domain/gems';
import { settled, shot, signUp } from './helpers';

// Their look on their pages (D74): someone you follow's board, product pages and brand pages show
// in their look, top and Leaderboard colours (D48 showed them in yours). Their look fades in when
// it arrives after the screen (option B of the mockup), is on before anything is drawn when it's
// already known (going between their pages never shows yours), and leaving puts yours back. Someone
// you don't follow stays in yours. Your phone only ever remembers your own look.

let owner: Page;
let fan: Page;
let stranger: Page;
let ownerName: string;
let strangerName: string;
const ids: Record<string, string> = {};

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  // Random as well as the time: repeated runs start several copies in the same millisecond.
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`) };
}

const post = (page: Page, path: string, body: unknown): Promise<{ product: { id: string } }> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const appearance = (page: Page, a: { look: string; top: string; preset: string; markFirst: boolean }) =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, a);
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });

const THEIRS = { look: 'outrun', top: 'tiles', preset: 'metals', markFirst: false };
const MINE = { look: 'aurora', top: 'strip', preset: 'gems', markFirst: true };

/** Every look the page shows from now on, "+fade" while it cross-fades. */
const recordLooks = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { looks: string[]; looksOn?: boolean };
    w.looks = [];
    if (w.looksOn) return;
    w.looksOn = true;
    const root = document.documentElement;
    new MutationObserver(() => w.looks.push(`${root.dataset.look}${root.classList.contains('vt-look') ? '+fade' : ''}`)).observe(root, { attributes: true, attributeFilter: ['data-look', 'class'] });
  });
const looks = (page: Page) => page.evaluate(() => (window as unknown as { looks: string[] }).looks);
const html = (page: Page) => page.locator('html');
/** Opens a path inside the app (no reload), as tapping a link does (router.ts follows history). */
const go = (page: Page, path: string) =>
  page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'look'));
  const f = await person(browser, 'lfan');
  fan = f.page;
  ({ page: stranger, name: strangerName } = await person(browser, 'lstr'));
  for (const [name, over] of [
    ['Alpha', { source: 'Acme', ratings: { look: 9.6 } }],
    ['Bravo', { source: 'Acme', ratings: { look: 8.2 } }],
    ['Charlie', { ratings: { look: 7 } }],
  ] as [string, Partial<ProductInput>][])
    ids[name] = (await post(owner, '/api/products', P({ name, ...over }))).product.id;
  await post(fan, `/api/people/u/${ownerName}/follow`, {});
  await post(owner, `/api/people/requests/${f.name}/approve`, {});
  await post(stranger, '/api/products', P({ name: 'Hidden', ratings: { look: 9.6 } }));
  expect(await appearance(stranger, { look: 'lava', top: 'hero', preset: 'neon', markFirst: true })).toBe(200);
  expect(await appearance(fan, MINE)).toBe(200);
});
test.beforeEach(async () => {
  expect(await appearance(owner, THEIRS)).toBe(200);
});
test.afterAll(async () => {
  for (const p of [owner, fan, stranger]) await p.context().close();
});

test('their board is in their look, top and colours; the key says whose; your phone keeps yours', async () => {
  await fan.goto('/');
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  await go(fan, `/u/${ownerName}`);
  await expect(fan.locator('.row', { hasText: 'Alpha' })).toBeVisible();
  await expect(html(fan)).toHaveAttribute('data-look', 'outrun');
  expect(await fan.locator('meta[name="theme-color"]').getAttribute('content')).toBe(LOOK_BG.outrun);
  // Their top: two tiles (Products and Average), not your slim strip.
  await expect(fan.locator('.tiles.two .tile')).toHaveCount(2);
  await expect(fan.locator('.banner')).toHaveCount(0);
  // Their colours: Metals, and no crown or halo (they turned Mark my #1 off).
  await expect(fan.locator('.row.tier.pal-metals')).toHaveCount(2);
  await expect(fan.locator('.row.tier.pal-gems')).toHaveCount(0);
  await expect(fan.locator('.row.first, .rank-crown')).toHaveCount(0);
  await settled(fan);
  await shot(fan, '96-their-look-board');
  await fan.locator('.pill.key').click();
  const key = fan.locator('.keysheet');
  await expect(key).toContainText(`@${ownerName}’s are Metals.`);
  await expect(key.getByRole('link', { name: 'Change colours' })).toHaveCount(0);
  await expect(key).not.toContainText('Crown and halo');
  await key.getByRole('button', { name: 'Done' }).click();
  // Never remembered: the next launch opens in yours.
  expect(await fan.evaluate(() => localStorage.getItem('gt.look'))).toBe('aurora');
  // Leaving puts yours back: your look, your strip, your colours.
  await fan.locator('.tabs a', { hasText: 'Leaderboard' }).click();
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  expect(await fan.locator('meta[name="theme-color"]').getAttribute('content')).toBe(LOOK_BG.aurora);
});

test('it fades in when it arrives; their product and brand pages keep it, never showing yours in between', async () => {
  await fan.goto('/people');
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  await recordLooks(fan);
  await fan.locator(`a[href="/u/${ownerName}"]`).first().click();
  await expect(fan.locator('.row', { hasText: 'Alpha' })).toBeVisible();
  await expect(html(fan)).toHaveAttribute('data-look', 'outrun');
  // Arriving after the screen: a cross-fade (Chromium has view transitions, like iOS 18+ Safari).
  await expect.poll(() => looks(fan)).toContain('outrun+fade');
  await expect(html(fan)).not.toHaveClass(/vt-look/);

  // From here on it's known: their pages put it on before they're drawn, with no fade.
  await recordLooks(fan);
  await fan.locator('.row', { hasText: 'Alpha' }).click();
  await expect(fan.locator('.gem-badge')).toHaveText('Rainbow · #1 on their Leaderboard');
  await expect(fan.locator('main')).toHaveAttribute('class', /pal-metals/);
  await fan.getByRole('link', { name: 'Acme' }).click();
  await expect(fan.locator('.brand-lead')).toBeVisible();
  await expect(fan.locator('.tiles.two')).toBeVisible();
  await expect(fan.locator('.row.tier.pal-metals')).toHaveCount(2);
  await fan.goBack();
  await expect(fan.locator('.gem-badge')).toBeVisible();
  await fan.goBack();
  await expect(fan.locator('.row', { hasText: 'Alpha' })).toBeVisible();
  // A fresh visit to a product page (as from a link) gets it from the product's own reply too.
  await fan.goto(`/u/${ownerName}/p/${ids.Bravo}`);
  await expect(fan.locator('.gem-badge')).toHaveText('Emerald · #2 on their Leaderboard');
  await expect(html(fan)).toHaveAttribute('data-look', 'outrun');
  await recordLooks(fan);
  await fan.getByRole('link', { name: 'Back' }).click();
  await expect(fan.locator('.row', { hasText: 'Alpha' })).toBeVisible();
  await fan.waitForTimeout(500);
  const seen = await looks(fan);
  expect(seen.filter((l) => !l.startsWith('outrun')), seen.join(' ')).toEqual([]);
  expect(seen.filter((l) => l.endsWith('+fade')), seen.join(' ')).toEqual([]);
  await fan.locator('.tabs a', { hasText: 'People' }).click();
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
});

test('someone you don’t follow stays in your look; so does your own board as followers see it', async () => {
  await fan.goto('/people');
  await go(fan, `/u/${strangerName}`);
  await expect(fan.getByRole('button', { name: 'Follow' })).toBeVisible();
  await fan.waitForTimeout(400);
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  // Their look isn't even sent before you follow (test/api/appearance.test.ts); a request isn't enough either.
  await fan.getByRole('button', { name: 'Follow' }).click();
  await expect(fan.getByRole('button', { name: 'Requested' })).toBeVisible();
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  await fan.getByRole('button', { name: 'Requested' }).click();
  await expect(fan.getByRole('button', { name: 'Follow' })).toBeVisible();

  await owner.goto('/more/privacy/preview');
  await expect(owner.locator('.row', { hasText: 'Alpha' })).toBeVisible();
  await expect(html(owner)).toHaveAttribute('data-look', 'outrun');
  await expect(owner.locator('.tiles.two')).toBeVisible();
});

test('a light look: the iPhone’s own controls follow theirs, then yours come back', async () => {
  expect(await appearance(owner, { look: 'daysky', top: 'hero', preset: 'gems', markFirst: true })).toBe(200);
  await fan.goto('/people');
  await go(fan, `/u/${ownerName}`);
  await expect(fan.locator('.banner.hero')).toBeVisible();
  await expect(html(fan)).toHaveAttribute('data-look', 'daysky');
  await expect(html(fan)).toHaveAttribute('data-tone', 'light');
  expect(await fan.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('light');
  await expect(fan.locator('.row.first')).toHaveCount(1);
  await settled(fan);
  await shot(fan, '97-their-look-light');
  await fan.locator('.tabs a', { hasText: 'People' }).click();
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  await expect(html(fan)).not.toHaveAttribute('data-tone', /./);
  expect(await fan.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('dark');
});

test('leaving while it fades in still lands on yours', async () => {
  await fan.goto('/people');
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await fan.route(`**/api/people/u/${ownerName}/products`, async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await fan.locator(`a[href="/u/${ownerName}"]`).first().click();
  await fan.waitForTimeout(150);
  await recordLooks(fan);
  release();
  await expect.poll(() => looks(fan)).toContain('outrun+fade');
  await fan.goBack();
  await expect(fan.locator(`a[href="/u/${ownerName}"]`).first()).toBeVisible();
  await fan.waitForTimeout(600);
  await expect(html(fan)).toHaveAttribute('data-look', 'aurora');
  await fan.unroute(`**/api/people/u/${ownerName}/products`);
});
