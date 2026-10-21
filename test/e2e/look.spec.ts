import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, expectStatsFit, settled, shot, signUp, textBoxes } from './helpers';

// D64 (0.54.0): the new look. Everyone starts on Aurora Glass, the glass hero and Aurora colours;
// Settings → Appearance chooses the look (only Aurora Glass so far: the others say "Coming next"),
// the top of the Leaderboard (glass hero, three tiles, slim strip; the Log, a friend's board and a
// name's page follow it) and the colours, each saved to your account at once. One account, with
// big numbers so the stats are as wide as they get: 12 products, 999.5g (the widest weight before it shows kg), a 9.5 average.
test.describe.configure({ mode: 'serial' });
let page: Page;

const put = (a: object) =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, a);
const saved = () => page.evaluate(async () => ((await (await fetch('/api/appearance')).json()) as { appearance: unknown }).appearance);
const axe = async () => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`);
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `glass${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`);
  for (let i = 0; i < 12; i++) {
    const body = { ...emptyProductInput(), name: `Glass Kush ${i + 1}`, strainType: 'hybrid', country: i < 7 ? 'NL' : 'GB', source: 'Mediterrane', ratings: { look: 9.5 }, purchases: [{ date: '2026-10-01', amount: i ? 90 : 9.5, totalPaid: 900, supplier: null }] };
    await page.evaluate(async (b) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), body);
  }
});
test.afterAll(() => page.context().close());

test('everyone starts on Aurora Glass, the glass hero and Aurora colours', async () => {
  expect(await saved()).toEqual({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });
  await page.goto('/');
  await expect(page.locator('.rows .row')).toHaveCount(12);
  await expect(page.locator('html')).toHaveAttribute('data-look', 'aurora');
  await expect(page.locator('.rows .row').first()).toHaveClass(/\bpal-aurora\b/);
  // The glass hero: the average big, products and total beside it, your #1 underneath.
  const hero = page.locator('.banner.hero');
  await expect(hero.locator('.tile.lead b')).toHaveText('9.5');
  await expect(hero.locator('.tile:not(.lead) b')).toHaveText(['12', '999.5g']);
  await expect(hero.locator('.foot')).toHaveText('Your #1 · Glass Kush 1');
  await shot(page, '640-glass-hero');
});

test('Settings shows the look, the top and the colours; Appearance chooses them, each saved at once', async () => {
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /^Look/ })).toContainText('Aurora Glass');
  await expect(page.getByRole('link', { name: /Leaderboard top/ })).toContainText('Glass hero');
  await expect(page.getByRole('link', { name: /Leaderboard colours/ })).toContainText('Aurora');
  await page.getByRole('link', { name: /^Look/ }).click();
  await expect(page).toHaveURL(/\/more\/appearance$/);
  // The looks: Aurora Glass chosen; the other three are coming next and can't be chosen yet.
  await expect(page.getByRole('radio', { name: /Aurora Glass/ })).toBeChecked();
  for (const name of ['Neon Night', 'Holo Pearl', 'Deep Forest']) {
    const r = page.getByRole('radio', { name: new RegExp(name) });
    await expect(r).toBeDisabled();
    await expect(page.locator('.ap-card', { has: r })).toContainText('Coming next');
  }
  await expect(page.getByRole('radio', { name: /Glass hero/ })).toBeChecked();
  await shot(page, '641-appearance');
  expect(await axe()).toEqual([]);

  // Three tiles: the preview changes at once, it's saved, and the Leaderboard follows.
  await page.getByRole('radio', { name: /Three tiles/ }).check();
  await expect(page.locator('.ap-preview .tiles .tile')).toHaveCount(3);
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'tiles', preset: 'aurora', markFirst: true });
  await page.getByRole('radio', { name: /Slim strip/ }).check();
  await expect(page.locator('.ap-preview .banner.strip .tile')).toHaveCount(3);
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
  await page.locator('input[name="preset"][value="neon"]').check();
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'strip', preset: 'neon', markFirst: true });
  await expect(page.locator('.ap-rows .row').first()).toHaveClass(/\bpal-neon\b/);
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click();
  await expect(page.locator('.banner.strip .tile')).toHaveCount(3);
  await expect(page.locator('.rows .row').first()).toHaveClass(/\bpal-neon\b/);
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /Leaderboard top/ })).toContainText('Slim strip');
  await expect(page.getByRole('link', { name: /Leaderboard colours/ })).toContainText('Neon');
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('the Log, a name’s page and the Leaderboard follow your top; the Log’s hero names where most came from', async () => {
  await page.goto('/log');
  const hero = page.locator('.banner.hero');
  await expect(hero.locator('.tile.lead b')).toHaveText('12');
  await expect(hero.locator('.tile:not(.lead) b')).toHaveText(['2', '999.5g']);
  await expect(hero.locator('.foot')).toHaveText('Most from · 🇳🇱 Netherlands7');
  await page.goto('/brands/Mediterrane');
  await expect(page.locator('.banner.hero .tile.lead b')).toHaveText('9.5');
  await expect(page.locator('.banner.hero .tile .cap')).toHaveText(['Products', 'Average', 'Spent']);
  expect(await put({ look: 'aurora', top: 'tiles', preset: 'aurora', markFirst: true })).toBe(200);
  for (const path of ['/', '/log', '/brands/Mediterrane']) {
    await page.goto(path);
    await expect(page.locator('.tiles .tile'), path).toHaveCount(3);
  }
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('every top fits, numbers and words inside their boxes, at 375 and 390 wide', async () => {
  test.slow(); // 3 tops × 2 widths × 3 screens
  for (const top of ['hero', 'tiles', 'strip'] as const) {
    expect(await put({ look: 'aurora', top, preset: 'aurora', markFirst: true })).toBe(200);
    for (const width of [375, 390]) {
      await page.setViewportSize({ width, height: 812 });
      for (const path of ['/', '/log', '/brands/Mediterrane']) {
        await page.goto(path);
        await expect(page.locator('.tile').first()).toBeVisible();
        expect(await expectStatsFit(page), `${top} ${width} ${path}`).toBe(top);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${top} ${width} ${path}: nothing spills sideways`).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('the stats stay readable over the drifting lights, in every top', async () => {
  test.slow(); // 3 tops × 12 photographed moments
  for (const top of ['hero', 'tiles', 'strip'] as const) {
    expect(await put({ look: 'aurora', top, preset: 'aurora', markFirst: true })).toBe(200);
    await page.goto('/');
    await expect(page.locator('.rows .row')).toHaveCount(12);
    await settled(page);
    const boxes = await textBoxes(page, '.tile b, .tile .cap, .banner .foot .who, .controls .pill-text');
    const worst = await contrastFailures(page, boxes);
    expect(worst, `${top}:\n${worst.join('\n')}`).toEqual([]);
  }
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('a look that isn’t built yet is refused', async () => {
  expect(await put({ look: 'neon', top: 'hero', preset: 'aurora', markFirst: true })).toBe(400);
  expect(await saved()).toEqual({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });
});
