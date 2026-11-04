import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, expectStatsFit, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D64 (0.54.0): the new look. Everyone starts on Aurora Glass, the glass hero and Aurora colours;
// Settings → Appearance chooses the look (all four since D65: Aurora Glass, Neon Night, Holo Pearl, Deep Forest),
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

test('a new account starts on Aurora Glass, Compact (the slim strip) and Aurora (D91); Showcase and Summary (D87)', async () => {
  expect(await saved()).toEqual({ look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
  await page.goto('/');
  await expect(page.locator('.rows .row')).toHaveCount(12);
  await expect(page.locator('html')).toHaveAttribute('data-look', 'aurora');
  await expect(page.locator('.rows .row').first()).toHaveClass(/\bpal-aurora\b/);
  await expect(page.locator('.banner.strip .tile')).toHaveCount(3);
  await expect(page.locator('.board-showcase')).toHaveCount(0);
  // The rest of this file starts from Showcase (the glass hero's saved name) and Aurora colours.
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toHaveClass(/\bpal-aurora\b/);
  // Showcase: the Compact line, then your top three as photo cards, #1 first.
  await expect(page.locator('.banner.strip .tile b')).toHaveText(['12', '9.5', '999.5g']);
  await expect(page.locator('.board-showcase .sc-card')).toHaveCount(3);
  await expect(page.locator('.board-showcase .sc-pos')).toHaveText(['#1', '#2', '#3']);
  await expect(page.locator('.board-showcase .sc-n').first()).toHaveText('Glass Kush 1');
  await shot(page, '640-showcase');
  // Summary: the average big, products and total beside it, the spread of scores, your #1 underneath; on glass.
  expect(await put({ look: 'aurora', top: 'tiles', preset: 'aurora', markFirst: true })).toBe(200);
  await page.goto('/');
  const summary = page.locator('.banner.summary');
  await expect(summary.locator('.tile.lead b')).toHaveText('9.5');
  await expect(summary.locator('.tile:not(.lead) b')).toHaveText(['12', '999.5g']);
  await expect(summary.locator('.spread-bar i').first()).toBeVisible();
  await expect(summary.locator('.foot')).toHaveText('Your #1 · Glass Kush 1');
  expect(await expectStatsFit(page)).toBe('tiles');
  await shot(page, '640-summary');
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('Settings shows the look, the top and the colours, each opening its own page (D71) where it is chosen and saved at once', async () => {
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /^Look/ })).toContainText('Aurora Glass');
  await expect(page.getByRole('link', { name: /Leaderboard top/ })).toContainText('Showcase');
  await expect(page.getByRole('link', { name: /Leaderboard colours/ })).toContainText('Aurora');
  await page.getByRole('link', { name: /^Look/ }).click();
  await expect(page).toHaveURL(/\/more\/look$/);
  await expect(page.locator('.hdr .title')).toHaveText('Look');
  // The looks: Aurora Glass chosen, first, then A to Z (D71); all can be chosen, none "Coming next"; only looks here.
  // D73: two sections, Dark mode (with its moon) and Light mode (with its sun) at the end, the Daylights there.
  await expect(page.locator('input[name="look"][value="aurora"]')).toBeChecked();
  await expect(page.locator('h2.ap-mode')).toHaveText(['Dark mode', 'Light mode']);
  await expect(page.locator('h2.ap-mode svg')).toHaveCount(2);
  // D90: Holo Pearl and Haze went; Daylight is the one light look.
  await expect(page.getByRole('radiogroup', { name: 'Dark mode' }).locator('.ap-name')).toHaveText(['Aurora Glass', 'Deep Forest', 'Deep Sea', 'Fireflies', 'Frost', 'Lava Lamp', 'Nebula', 'Neon Night', 'Outrun', 'Sakura']);
  await expect(page.getByRole('radiogroup', { name: 'Light mode' }).locator('.ap-name')).toHaveText(['Daylight']);
  await expect(page.locator('.ap-card .ap-name').last()).toHaveText('Daylight');
  for (const name of ['Neon Night', 'Deep Forest']) await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeEnabled();
  await expect(page.getByText('Coming next')).toHaveCount(0);
  await expect(page.locator('input[name="top"], input[name="preset"], .ap-preview')).toHaveCount(0);
  await shot(page, '641-appearance-look');
  expect(await axe()).toEqual([]);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole('link', { name: /Leaderboard top/ }).click();
  await expect(page).toHaveURL(/\/more\/top$/);
  await expect(page.locator('.hdr .title')).toHaveText('Leaderboard top');
  // The tops, the default first (D71), with the preview; nothing else.
  await expect(page.locator('.tops .ap-name')).toHaveText(['Compact', 'Showcase', 'Summary']);
  await expect(page.getByRole('radio', { name: /Showcase/ })).toBeChecked();
  await expect(page.locator('input[name="look"], input[name="preset"]')).toHaveCount(0);
  await shot(page, '641-appearance-top');
  expect(await axe()).toEqual([]);

  // Summary: the preview changes at once, it's saved, and the Leaderboard follows.
  await page.getByRole('radio', { name: /Summary/ }).check();
  await expect(page.locator('.ap-preview .banner.summary .tile')).toHaveCount(3);
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'tiles', preset: 'aurora', markFirst: true });
  await page.getByRole('radio', { name: /Compact/ }).check();
  await expect(page.locator('.ap-preview .banner.strip .tile')).toHaveCount(3);
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
  await page.goto('/more/colours');
  await expect(page.locator('.hdr .title')).toHaveText('Leaderboard colours');
  await page.locator('input[name="preset"][value="neon"]').check();
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'strip', preset: 'neon', markFirst: true });
  await expect(page.locator('.ap-rows .row').first()).toHaveClass(/\bpal-neon\b/);
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click();
  await expect(page.locator('.banner.strip .tile')).toHaveCount(3);
  await expect(page.locator('.rows .row').first()).toHaveClass(/\bpal-neon\b/);
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /Leaderboard top/ })).toContainText('Compact');
  await expect(page.getByRole('link', { name: /Leaderboard colours/ })).toContainText('Neon');
  // The one Appearance page's old address opens Settings.
  await page.goto('/more/appearance');
  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole('link', { name: /^Look/ })).toBeVisible();
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('the Rank, colours and Type buttons stay above the top, whichever top, on the Leaderboard and the Log (D71)', async () => {
  for (const top of ['strip', 'hero', 'tiles'] as const) {
    expect(await put({ look: 'aurora', top, preset: 'aurora', markFirst: true })).toBe(200);
    for (const path of ['/', '/log']) {
      await page.goto(path);
      const stats = page.locator('.banner');
      await expect(stats).toBeVisible();
      // 0.63.3: measured mid-way through the page's slide-in (6px), the two boxes, read one after the other, were
      // caught at different moments and the buttons seemed to overlap the top by 5px (CI). Wait for it to finish.
      await settled(page);
      const [controls, box] = [await page.locator('.controls').boundingBox(), await stats.boundingBox()];
      expect(controls!.y + controls!.height, `${top} ${path}`).toBeLessThanOrEqual(box!.y + 1);
    }
  }
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('the Log, a name’s page and the Leaderboard follow your top; the Log’s Summary names where most came from', async () => {
  expect(await put({ look: 'aurora', top: 'tiles', preset: 'aurora', markFirst: true })).toBe(200);
  await page.goto('/log');
  const summary = page.locator('.banner.summary');
  await expect(summary.locator('.tile.lead b')).toHaveText('12');
  await expect(summary.locator('.tile:not(.lead) b')).toHaveText(['2', '999.5g']);
  await expect(summary.locator('.foot')).toHaveText('Most from · 🇳🇱 Netherlands7');
  await page.goto('/brands/Mediterrane');
  await expect(page.locator('.banner.summary .tile.lead b')).toHaveText('9.5');
  await expect(page.locator('.banner.summary .tile .cap')).toHaveText(['Products', 'Average', 'Spent']);
  // Showcase: the Leaderboard has its cards; the Log and a name's page, with no top three of their own, the line.
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
  for (const path of ['/', '/log', '/brands/Mediterrane']) {
    await page.goto(path);
    await expect(page.locator('.banner.strip .tile'), path).toHaveCount(3);
    await expect(page.locator('.board-showcase'), path).toHaveCount(path === '/' ? 1 : 0);
  }
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
        // D87: Showcase's cards are the Leaderboard's own; elsewhere it's the Compact line.
        expect(await expectStatsFit(page), `${top} ${width} ${path}`).toBe(top === 'hero' && path !== '/' ? 'strip' : top);
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

test('a look that doesn’t exist is refused', async () => {
  expect(await put({ look: 'sepia', top: 'hero', preset: 'aurora', markFirst: true })).toBe(400);
  expect(await saved()).toEqual({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });
});

test('quick taps in Appearance: each choice stays chosen, and the last one is what’s saved (0.55.0)', async () => {
  await page.goto('/more/colours');
  await expect(page.locator('input[name="preset"][value="aurora"]')).toBeChecked();
  // The first save is slow to come back; the second tap lands while it's on its way.
  let first = true;
  await page.route('**/api/appearance', async (route) => {
    if (route.request().method() === 'PUT' && first) {
      first = false;
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.fallback();
  });
  await page.locator('input[name="preset"][value="neon"]').check();
  await page.getByRole('switch', { name: 'Mark my #1' }).uncheck();
  // Through the first save's answer and after: the newest choices stay shown.
  for (let i = 0; i < 12; i++) {
    expect(await page.locator('input[name="preset"][value="neon"]').isChecked(), `still Neon after ${i * 250}ms`).toBe(true);
    expect(await page.getByRole('switch', { name: 'Mark my #1' }).isChecked(), `still unmarked after ${i * 250}ms`).toBe(false);
    await page.waitForTimeout(250);
  }
  await expect.poll(saved).toEqual({ look: 'aurora', top: 'hero', preset: 'neon', markFirst: false });
  await page.unroute('**/api/appearance');
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

// D65 (0.55.0): the other looks of then (Holo Pearl went in D90).
const LOOKS = [
  // D87: every look in Apple's own fonts (D65 gave these three their own titles before).
  { look: 'neon', name: 'Neon Night', bg: 'rgb(6, 4, 26)', hex: '#06041a', display: /^-apple-system/ },
  { look: 'forest', name: 'Deep Forest', bg: 'rgb(5, 8, 7)', hex: '#050807', display: /^-apple-system/ },
] as const;

test('choosing a look in Appearance changes the whole app at once, its title font and the Home Screen bar, and saves it', async () => {
  for (const l of LOOKS) {
    await page.goto('/more/look');
    await page.getByRole('radio', { name: new RegExp(l.name) }).check();
    await expect.poll(saved).toEqual({ look: l.look, top: 'hero', preset: 'aurora', markFirst: true });
    await expect(page.locator('html')).toHaveAttribute('data-look', l.look);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), l.look).toBe(l.bg);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe(l.hex);
    expect(await page.locator('.hdr .title').evaluate((e) => getComputedStyle(e).fontFamily), l.look).toMatch(l.display);
    // Numbers stay SF Pro Rounded in every look (D87).
    await page.goto('/');
    await expect(page.locator('.banner.strip .tile', { hasText: 'average' }).locator('b')).toHaveText('9.5');
    expect(await page.locator('.banner.strip .tile b').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^ui-rounded/);
    await page.goto('/more');
    await expect(page.getByRole('link', { name: /^Look/ })).toContainText(l.name);
    await shot(page, `642-look-${l.look}`);
  }
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

test('the phone remembers your look, so the app opens in it before your account has loaded (no flash of Aurora Glass)', async () => {
  expect(await put({ look: 'neon', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'neon');
  // Next launch: hold your account back; the page is already in Neon Night.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => [document.documentElement.dataset.look, getComputedStyle(document.body).backgroundColor, document.querySelector('meta[name="theme-color"]')!.getAttribute('content')])).toEqual(['neon', 'rgb(6, 4, 26)', '#06041a']);
  release();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.unroute('**/api/auth/me');
  // Another phone (nothing remembered) opens in Aurora Glass until it knows.
  const fresh = await (await page.context().browser()!.newContext()).newPage();
  await fresh.goto('/');
  await expect(fresh.locator('main.fullscreen')).toBeVisible();
  expect(await fresh.evaluate(() => document.documentElement.dataset.look ?? 'none')).toBe('none');
  expect(await fresh.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(3, 7, 10)');
  await fresh.context().close();
  expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
});

for (const l of LOOKS) {
  test(`${l.name} is readable and accessible: the Leaderboard, the Log, Settings and Appearance`, async () => {
    test.slow(); // several screens, the Leaderboard throughout the lights' and colours' motion
    for (const top of ['hero', 'strip'] as const) {
      expect(await put({ look: l.look, top, preset: 'aurora', markFirst: true })).toBe(200);
      await page.goto('/');
      await expect(page.locator('.rows .row')).toHaveCount(12);
      await settled(page);
      if (top === 'hero') expect(await axe(), `${l.look} board`).toEqual([]);
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
    expect(await put({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true })).toBe(200);
  });
}
