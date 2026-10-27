import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D70 (0.60.0): eight more looks: Sakura, Fireflies, Deep Sea, Frost, Nebula, Outrun, Lava Lamp, Haze.
// The owner's rule: a look changes only colours and the background behind everything, never fonts,
// sizes or shapes. Each draws its own background (petals, fireflies, rays and plankton, snow, stars,
// a sky and a grid, lava, smoke), moving in small steps, still with Reduce Motion, hidden under the
// viewer and editors; words stay readable over it on every screen. One account per worker.
test.describe.configure({ mode: 'parallel' });
let page: Page;

const NEW = [
  { look: 'sakura', name: 'Sakura', bg: 'rgb(19, 10, 19)', hex: '#130a13' },
  { look: 'fireflies', name: 'Fireflies', bg: 'rgb(4, 11, 11)', hex: '#040b0b' },
  { look: 'deepsea', name: 'Deep Sea', bg: 'rgb(2, 10, 20)', hex: '#020a14' },
  { look: 'frost', name: 'Frost', bg: 'rgb(6, 11, 18)', hex: '#060b12' },
  { look: 'nebula', name: 'Nebula', bg: 'rgb(5, 4, 12)', hex: '#05040c' },
  { look: 'outrun', name: 'Outrun', bg: 'rgb(10, 4, 32)', hex: '#0a0420' },
  { look: 'lava', name: 'Lava Lamp', bg: 'rgb(18, 6, 12)', hex: '#12060c' },
  { look: 'haze', name: 'Haze', bg: 'rgb(12, 11, 16)', hex: '#0c0b10' },
] as const;

const put = (look: string, top = 'hero', preset = 'aurora') =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, { look, top, preset, markFirst: true });
const saved = () => page.evaluate(async () => ((await (await fetch('/api/appearance')).json()) as { appearance: unknown }).appearance);
const axe = async () => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`);
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `sky${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  // One row in each colour band, then rows that glow in their score's colour.
  const scores = [9.7, 9.2, 8.7, 8.2, 7.6, 7.1, 6.4, 5.8, 5.3, 4.8, 6.9, 7.3];
  for (let i = 0; i < scores.length; i++) {
    const body = { ...emptyProductInput(), name: `Sky Kush ${i + 1}`, strainType: 'hybrid', country: i < 7 ? 'NL' : 'GB', source: 'Mediterrane', ratings: { look: scores[i] }, purchases: [{ date: '2026-10-01', amount: 3.5, totalPaid: 35, supplier: null }] };
    await page.evaluate(async (b) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), body);
  }
});
test.afterAll(async () => {
  await put('aurora');
  await page.context().close();
});

test('each new look is chosen in Appearance, marked New, saved, and changes the whole app and the Home Screen bar at once', async () => {
  test.slow(); // eight looks, three screens each
  for (const l of NEW) {
    await page.goto('/more/appearance');
    const radio = page.locator(`input[name="look"][value="${l.look}"]`);
    await expect(page.locator('.ap-card', { has: radio }).locator('.ap-name')).toHaveText(l.name);
    await expect(page.locator('.ap-card', { has: radio }).locator('.new-tag')).toHaveText('New');
    await radio.check();
    await expect.poll(saved).toEqual({ look: l.look, top: 'hero', preset: 'aurora', markFirst: true });
    await expect(page.locator('html')).toHaveAttribute('data-look', l.look);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), l.look).toBe(l.bg);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content'), l.look).toBe(l.hex);
    expect(await page.evaluate(() => localStorage.getItem('gt.look')), l.look).toBe(l.look);
    await page.goto('/more');
    await expect(page.getByRole('link', { name: /^Look/ })).toContainText(l.name);
  }
  // The four from before aren't New.
  await page.goto('/more/appearance');
  for (const look of ['aurora', 'neon', 'pearl', 'forest']) await expect(page.locator('.ap-card', { has: page.locator(`input[name="look"][value="${look}"]`) }).locator('.new-tag')).toHaveCount(0);
  await shot(page, '700-looks-appearance');
  // A phone that remembers one opens in it before the account has loaded.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => [document.documentElement.dataset.look, getComputedStyle(document.body).backgroundColor])).toEqual(['haze', 'rgb(12, 11, 16)']);
  release();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.unroute('**/api/auth/me');
  expect(await put('aurora')).toBe(200);
});

/** Where each thing sits and how its words are set, so two looks can be compared. */
const layout = (sel: string) =>
  page.locator(sel).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), cs.fontFamily, cs.fontSize, cs.fontWeight, cs.letterSpacing, cs.borderRadius, cs.borderTopWidth].join(' ');
    }),
  );
const PARTS = '.hdr .title, .banner.hero, .tile b, .tile .cap, .controls .pill, .row, .row .name, .row .meta, .row .score b, .fab, .nav .tab, .lh, .li, .ap-card, .ap-name, .ap-sub, .new-tag';

test('a look changes only colours and the background: every font, size and shape is as in Aurora Glass', async () => {
  test.slow();
  const before: Record<string, string[]> = {};
  expect(await put('aurora')).toBe(200);
  for (const path of ['/', '/more', '/more/appearance']) {
    await page.goto(path);
    await expect(page.locator('main.screen')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await settled(page);
    before[path] = await layout(PARTS);
    expect(before[path]!.length, path).toBeGreaterThan(5);
  }
  expect(before['/']![0], 'titles in Unbounded').toMatch(/Unbounded/);
  for (const l of NEW) {
    expect(await put(l.look)).toBe(200);
    for (const path of ['/', '/more', '/more/appearance']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-look', l.look);
      await expect(page.locator('main.screen')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await settled(page);
      expect(await layout(PARTS), `${l.look} ${path}`).toEqual(before[path]);
    }
  }
  expect(await put('aurora')).toBe(200);
});

test('each background moves in small steps, holds still with Reduce Motion, and hides under the viewer and editors', async ({ browser }) => {
  test.slow();
  const pseudo = () =>
    page.evaluate(() => {
      const layer = document.querySelector('.bg-layer')!;
      return {
        layers: ['::before', '::after'].map((p) => getComputedStyle(layer, p).content !== 'none' && getComputedStyle(layer, p).display !== 'none').filter(Boolean).length,
        // Every animation on the background, and its timing: always in steps, never smooth.
        anims: document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target === layer).map((a) => `${(a as CSSAnimation).animationName} ${(a.effect as KeyframeEffect).pseudoElement ?? ''}`.trim()),
        smooth: document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target === layer && !/steps/.test(String((a.effect as KeyframeEffect).getComputedTiming().easing) + getComputedStyle(layer, (a.effect as KeyframeEffect).pseudoElement).animationTimingFunction)).length,
      };
    });
  const still = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  for (const l of NEW) {
    expect(await put(l.look)).toBe(200);
    await page.goto('/');
    await expect(page.locator('.rows .row').first()).toBeVisible();
    const p = await pseudo();
    expect(p.anims.length, `${l.look} moves: ${p.anims}`).toBeGreaterThan(0);
    expect(p.smooth, `${l.look}: in steps`).toBe(0);
    // The editors' country picker covers everything: the background hides and stops.
    await page.goto('/products/new');
    await page.getByLabel('Country', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Choose a country' })).toBeVisible();
    const under = await page.evaluate(() => {
      const layer = document.querySelector('.bg-layer')!;
      return [getComputedStyle(layer).backgroundImage, getComputedStyle(layer).animationPlayState, getComputedStyle(layer, '::before').display, getComputedStyle(layer, '::after').display];
    });
    expect(under, l.look).toEqual(['none', expect.stringMatching(/paused|running/), 'none', 'none']);
    // With Reduce Motion: drawn, but nothing on the background moves.
    await still.goto('/');
    await still.evaluate((look) => document.documentElement.setAttribute('data-look', look), l.look);
    expect(await still.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target === document.querySelector('.bg-layer')).length), `${l.look} still`).toBe(0);
  }
  await still.context().close();
  expect(await put('aurora')).toBe(200);
});

for (const l of NEW) {
  test(`${l.name} is readable and accessible over its moving background: the Leaderboard, the Log, Settings and Appearance`, async () => {
    test.slow(); // several screens, the Leaderboard photographed through its background's motion
    for (const top of ['hero', 'strip'] as const) {
      expect(await put(l.look, top)).toBe(200);
      await page.goto('/');
      await expect(page.locator('.rows .row')).toHaveCount(12);
      await settled(page);
      if (top === 'hero') {
        expect(await axe(), `${l.look} board`).toEqual([]);
        await shot(page, `701-look-${l.look}`);
      }
      // What's on screen and readable: below the header, above the tab bar, clear of the add button.
      const area = await page.evaluate(() => ({ top: document.querySelector('.hdr')!.getBoundingClientRect().bottom, bottom: document.querySelector('.nav')!.getBoundingClientRect().top, fab: document.querySelector('.fab')!.getBoundingClientRect().toJSON() as DOMRect }));
      const boxes = (await textBoxes(page, '.tile b, .tile .cap, .banner .foot .who, .controls .pill-text, .row .name, .row .meta, .row .score b, .row .score .cap')).filter(
        (b) => b.y >= area.top && b.y + b.h <= area.bottom && !(b.x < area.fab.right && b.x + b.w > area.fab.left && b.y < area.fab.bottom && b.y + b.h > area.fab.top),
      );
      expect(boxes.length, `${l.look} ${top}: rows on screen`).toBeGreaterThan(12);
      const worst = await contrastFailures(page, boxes);
      expect(worst, `${l.look} ${top}:\n${worst.join('\n')}`).toEqual([]);
    }
    for (const [path, sel] of [
      ['/log', '.group-h, .lrow .name, .tile b, .tile .cap'],
      ['/more', '.lh.cap, .li .main, .li .v, .more-me .who b'],
      ['/more/appearance', '.lh, .ap-name, .ap-sub, .preset .pl, .preset .sub, .new-tag, .priv-row .main > span'],
    ] as const) {
      const worst = await wholeScreenContrastFailures(page, path, sel);
      expect(worst, `${l.look} ${path}:\n${worst.join('\n')}`).toEqual([]);
      expect(await axe(), `${l.look} ${path}`).toEqual([]);
    }
    expect(await put('aurora')).toBe(200);
  });
}
