import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D70 (0.60.0): eight more looks; D90 (0.79.0): eleven looks, each with a scene of its own behind every screen
// (components/Backdrop.tsx): petals, stars, curtains of light, pines and fog, bubbles and a jellyfish, snow, fireflies,
// lava, a city in the rain, a sunset and a grid, clouds. The owner's rule: a look changes only colours and the background
// behind everything, never fonts, sizes or shapes. Since D90 the backgrounds glide smoothly (in small steps before);
// still with Reduce Motion, hidden under the viewer and editors; words stay readable over them on every screen.
// One account per worker.
test.describe.configure({ mode: 'parallel' });
let page: Page;

const NEW = [
  { look: 'aurora', name: 'Aurora Glass', bg: 'rgb(3, 7, 10)', hex: '#03070a' },
  { look: 'forest', name: 'Deep Forest', bg: 'rgb(5, 8, 7)', hex: '#050807' },
  { look: 'neon', name: 'Neon Night', bg: 'rgb(6, 4, 26)', hex: '#06041a' },
  // D72: the light look (one since D90), through every check the dark ones have (its own extras: daylight.spec.ts).
  { look: 'daysky', name: 'Daylight', bg: 'rgb(238, 243, 250)', hex: '#eef3fa' },
  { look: 'sakura', name: 'Sakura', bg: 'rgb(19, 10, 19)', hex: '#130a13' },
  { look: 'fireflies', name: 'Fireflies', bg: 'rgb(4, 11, 11)', hex: '#040b0b' },
  { look: 'deepsea', name: 'Deep Sea', bg: 'rgb(2, 10, 20)', hex: '#020a14' },
  { look: 'frost', name: 'Frost', bg: 'rgb(6, 11, 18)', hex: '#060b12' },
  { look: 'nebula', name: 'Nebula', bg: 'rgb(5, 4, 12)', hex: '#05040c' },
  { look: 'outrun', name: 'Outrun', bg: 'rgb(10, 4, 32)', hex: '#0a0420' },
  { look: 'lava', name: 'Lava Lamp', bg: 'rgb(18, 6, 12)', hex: '#12060c' },
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

test('each look is chosen in Appearance, saved, and changes the whole app and the Home Screen bar at once; only Daylight is New', async () => {
  test.slow(); // eleven looks, three screens each
  for (const l of NEW) {
    await page.goto('/more/look');
    const radio = page.locator(`input[name="look"][value="${l.look}"]`);
    await expect(page.locator('.ap-card', { has: radio }).locator('.ap-name')).toHaveText(l.name);
    await expect(page.locator('.ap-card', { has: radio }).locator('.new-tag')).toHaveCount(l.look === 'daysky' ? 1 : 0);
    await radio.check();
    await expect.poll(async () => ((await saved()) as { look: string }).look).toBe(l.look);
    await expect(page.locator('html')).toHaveAttribute('data-look', l.look);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), l.look).toBe(l.bg);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content'), l.look).toBe(l.hex);
    expect(await page.evaluate(() => localStorage.getItem('gt.look')), l.look).toBe(l.look);
    await page.goto('/more');
    await expect(page.getByRole('link', { name: /^Look/ })).toContainText(l.name);
  }
  // The four that went (D90) aren't offered.
  await page.goto('/more/look');
  await expect(page.locator('input[name="look"]')).toHaveCount(11);
  for (const look of ['pearl', 'haze', 'daymint', 'daypearl']) await expect(page.locator(`input[name="look"][value="${look}"]`)).toHaveCount(0);
  await shot(page, '700-looks-appearance');
  // A phone that remembers one opens in it before the account has loaded.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => [document.documentElement.dataset.look, getComputedStyle(document.body).backgroundColor])).toEqual(['lava', 'rgb(18, 6, 12)']);
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
  for (const path of ['/', '/log', '/more', '/more/look', '/more/top', '/more/colours']) {
    await page.goto(path);
    await expect(page.locator('main.screen')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await settled(page);
    before[path] = await layout(PARTS);
    expect(before[path]!.length, path).toBeGreaterThan(5);
  }
  expect(before['/']![0], 'titles in SF Pro (D87)').toMatch(/apple-system/);
  for (const l of NEW) {
    expect(await put(l.look)).toBe(200);
    for (const path of ['/', '/log', '/more', '/more/look', '/more/top', '/more/colours']) {
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

test('each look has its own scene, gliding smoothly (D90); still with Reduce Motion; hidden under the viewer and editors', async ({ browser }) => {
  test.slow();
  const scene = () =>
    page.evaluate(() => {
      const el = document.querySelector('.scene');
      const mine = document.getAnimations().filter((a) => {
        const t = (a.effect as KeyframeEffect).target as Element | null;
        return !!t && (t === el || !!el?.contains(t));
      });
      return {
        cls: el?.className ?? null,
        parts: el?.querySelectorAll('*').length ?? 0,
        anims: mine.length,
        // Smooth: eased or linear, not in steps (only Neon Night's windows flick on and off, in one step).
        smooth: mine.filter((a) => !/steps/.test(String((a.effect as KeyframeEffect).getComputedTiming().easing) + getComputedStyle((a.effect as KeyframeEffect).target as Element).animationTimingFunction)).length,
        lights: getComputedStyle(document.querySelector('.bg-layer')!).animationTimingFunction,
      };
    });
  const still = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  for (const l of NEW) {
    expect(await put(l.look)).toBe(200);
    await page.goto('/');
    await expect(page.locator('.rows .row').first()).toBeVisible();
    await expect(page.locator(`.scene.scene-${l.look}`)).toHaveCount(1);
    const p = await scene();
    expect(p.parts, `${l.look}: its scene has its pieces`).toBeGreaterThan(2);
    expect(p.smooth, `${l.look}: moves smoothly`).toBeGreaterThan(0);
    expect(p.lights, `${l.look}: the lights glide`).not.toMatch(/steps/);
    // Under the viewer (or a cropper) the scene is gone.
    await page.evaluate(() => document.body.appendChild(Object.assign(document.createElement('div'), { className: 'viewer' })));
    await expect(page.locator('.scene')).toBeHidden();
    await page.evaluate(() => document.querySelector('body > .viewer')!.remove());
    // With Reduce Motion: drawn, but nothing behind moves.
    await still.goto('/');
    await still.evaluate((look) => document.documentElement.setAttribute('data-look', look), l.look);
    await expect(still.locator(`.scene.scene-${l.look}`)).toHaveCount(1);
    expect(await still.evaluate(() => document.getAnimations().filter((a) => { const t = (a.effect as KeyframeEffect).target as Element | null; return !!t && (t.matches('.bg-layer') || !!t.closest('.scene')); }).length), `${l.look} still`).toBe(0);
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
      ['/more/look', '.lh, .ap-name, .ap-sub, .new-tag'],
      ['/more/colours', '.lh, .ap-preview .tile b, .ap-preview .tile .cap, .preset .pl, .preset .sub, .new-tag, .priv-row .main > span'],
    ] as const) {
      const worst = await wholeScreenContrastFailures(page, path, sel);
      expect(worst, `${l.look} ${path}:\n${worst.join('\n')}`).toEqual([]);
      expect(await axe(), `${l.look} ${path}`).toEqual([]);
    }
    expect(await put('aurora')).toBe(200);
  });
}
