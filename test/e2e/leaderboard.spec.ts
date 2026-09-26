import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { expectTilesCentredAndWashed, shot, signUp } from './helpers';

// One account for the file (sign-up is rate-limited), seeded through the real API.
// Expected figures are worked by hand from the brief's rules.
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const SEED: ProductInput[] = [
  P({ name: 'Gelato 41', strainType: 'hybrid', country: 'US', source: 'Cookies', dateTried: '2026-09-14', ratings: { look: 9.2, smell: 9, taste: 8.8, burn: 8.6, high: 9.4 }, purchases: [{ date: '2026-09-14', amount: 3.5, totalPaid: 9.5, supplier: null }] }), // 8.9
  P({ name: 'Lemon Cherry Gelato', strainType: 'hybrid', country: 'CA', source: 'Grasshopper Farms Craft Collective', ratings: { look: 8.6, smell: 8.9, taste: 8.7, burn: 8.2 }, purchases: [{ date: '2026-09-01', amount: 7, totalPaid: 17.5, supplier: null }] }), // 8.6
  P({ name: 'Blue Zushi Live Rosin', productType: 'concentrate', concentrateType: 'live_rosin', strainType: 'indica', country: 'US', ratings: { look: 8.4, smell: 8.5, taste: 8.6, burn: 8.2 }, purchases: [{ date: '2026-08-01', amount: 1, totalPaid: 45, supplier: null }] }), // 8.425, no Consistency
  P({ name: 'Peach Rings Gummies', productType: 'edibles', strainType: 'sativa', country: 'CA', source: 'Wana', private: true, ratings: { taste: 7.2, high: 8.7 }, purchases: [{ date: '2026-09-06', amount: 100, totalPaid: 12, supplier: null }] }), // 8.2
  P({ name: 'Camino Midnight Blueberry', productType: 'edibles', country: 'US', source: 'Kiva', ratings: { taste: 8, high: 8.5 }, purchases: [{ date: '2026-09-02', amount: 100, totalPaid: 18, supplier: null }] }), // 8.333
  P({ name: 'Chocolate Brownie', productType: 'edibles', country: 'NL', ratings: { taste: 6, high: 9 }, purchases: [{ date: '2026-09-03', amount: 100, totalPaid: 5, supplier: null }] }), // 8.0
  P({ name: 'Moroccan Hash', productType: 'concentrate', country: 'MA', ratings: { look: 7.6, consistency: 7.8, smell: 7.2, taste: 7.5, burn: 7.4 }, purchases: [{ date: '2026-07-01', amount: 1, totalPaid: 8, supplier: null }] }), // 7.5
  P({ name: 'Mystery Sample', productType: 'other', dateTried: '2026-08-12' }), // unrated
  ...Array.from({ length: 8 }, (_, i) => P({ name: `Filler ${String(i + 1).padStart(2, '0')}`, ratings: { look: 5 + i / 10 } })), // 5.0 … 5.7
];

let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page);
  for (const body of SEED) {
    const status = await page.evaluate(async (b) => (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status, body);
    expect(status).toBe(201);
  }
});
test.afterAll(() => context.close());

const rows = () => page.locator('.row');
const tile = (label: string) => page.locator('.tile', { hasText: label }).locator('b');
const pill = (name: 'Rank by' | 'Type') => page.getByLabel(name, { exact: true });
const pillBox = (name: 'Rank by' | 'Type') => pill(name).locator('..');

test('default: Overall, all types; podium, tiles, unrated last', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);
  await expect(rows().nth(0)).toContainText('Gelato 41');
  // Four tiers (D19): rainbow, gold, silver, bronze; then ordinary rows.
  for (let i = 0; i < 4; i++) await expect(rows().nth(i)).toHaveClass(new RegExp(`\\btier p${i + 1}\\b`));
  await expect(rows().nth(4)).not.toHaveClass(/tier/);
  await expect(rows().nth(15)).toContainText('Mystery Sample');
  await expect(rows().nth(15)).toContainText('Unrated');
  await expect(tile('Products')).toHaveText('16');
  await expect(tile('Average')).toHaveText('6.7'); // 100.758 ÷ 15 rated
  await expect(tile('Total')).toHaveText('12.5g'); // 3.5 + 7 + 1 + 1; no edibles
  await expectTilesCentredAndWashed(page);
  await expect(pillBox('Rank by')).not.toHaveClass(/active/);
  await expect(pillBox('Type')).not.toHaveClass(/active/);
  await shot(page, '20-leaderboard');
});

// The holo podium (D19): everything moves, the light cascades 1 → 4, Reduce Motion
// stops it, and the text on every tier stays readable at every moment of the motion
// (measured from real pixels: axe can't judge text over a gradient).
test('podium tiers: motion, Reduce Motion, and readable text throughout', async () => {
  const tiers = page.locator('.row.tier');
  await expect(tiers).toHaveCount(4);
  const motion = () => tiers.evaluateAll((els) => els.map((el) => ({
    row: el.getAnimations().length,
    sheen: el.getAnimations({ subtree: true }).filter((a) => (a as CSSAnimation).animationName === 'tier-sheen').map((a) => String(a.effect!.getTiming().delay)),
    edge: getComputedStyle(el).backgroundImage.includes('linear-gradient'),
  })));
  const moving = await motion();
  expect(moving.every((m) => m.row > 0 && m.edge)).toBe(true);
  expect(moving.map((m) => m.sheen)).toEqual([['0'], ['350'], ['700'], ['1050']]); // cascade, 1st on the beat

  // Readability: pause every animation at a spread of moments, hide the text, photograph
  // the rows, and compare each text colour with the brightest pixel behind it.
  const boxes = await tiers.evaluateAll((els) => els.flatMap((el, i) => [...el.querySelectorAll<HTMLElement>('.name, .meta, .score b, .score .cap')].map((t) => {
    const range = document.createRange();
    range.selectNodeContents(t);
    // The text itself, clipped to its own box (an ellipsised line's range runs past it), 1px in from antialiased edges.
    const tr = range.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    const x0 = Math.max(tr.left, b.left) + 1, x1 = Math.min(tr.right, b.right) - 1, y0 = Math.max(tr.top, b.top) + 1, y1 = Math.min(tr.bottom, b.bottom) - 1;
    const r = { left: x0, top: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
    return { row: i + 1, part: t.className || t.tagName, x: r.left, y: r.top, w: r.width, h: r.height, color: getComputedStyle(t).color, large: parseFloat(getComputedStyle(t).fontSize) >= 18.66 };
  })));
  // (Set through the DOM: the app's CSP rightly refuses an injected <style>.)
  await tiers.evaluateAll((els) => els.forEach((el) => el.querySelectorAll<HTMLElement>('.mid, .score, .rk').forEach((t) => (t.style.visibility = 'hidden'))));
  const worst: string[] = [];
  for (let step = 0; step < 12; step++) {
    await page.evaluate((f) => {
      for (const a of document.getAnimations()) {
        const t = a.effect!.getTiming();
        a.pause();
        a.currentTime = Number(t.delay ?? 0) + f * Number(t.duration);
      }
    }, step / 12);
    const png = Buffer.from(await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 844 } })).toString('base64');
    const found = await page.evaluate(async ({ png, boxes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const k = img.width / 390;
      const lum = (r: number, g: number, b: number) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
      return boxes.map((b) => {
        const d = ctx.getImageData(Math.round(b.x * k), Math.round(b.y * k), Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))).data;
        const [fr = 0, fg = 0, fb = 0, fa = 1] = b.color.match(/[\d.]+/g)!.map(Number);
        let min = Infinity;
        for (let i = 0; i < d.length; i += 4) {
          const [br, bg, bb] = [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0];
          const f = [fr * fa + br * (1 - fa), fg * fa + bg * (1 - fa), fb * fa + bb * (1 - fa)];
          const [a, z] = [lum(f[0]!, f[1]!, f[2]!), lum(br, bg, bb)];
          min = Math.min(min, (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05));
        }
        return { ...b, ratio: min };
      });
    }, { png, boxes });
    for (const f of found) if (f.ratio < (f.large ? 3 : 4.5)) worst.push(`step ${step}: row ${f.row} ${f.part} ${f.ratio.toFixed(2)}`);
  }
  expect(worst, worst.join('\n')).toEqual([]);

  // Reduce Motion: colours stay, nothing moves.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(tiers).toHaveCount(4);
  const still = await motion();
  expect(still.every((m) => m.row === 0 && m.sheen.length === 0 && m.edge)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(tiers).toHaveCount(4);
});

// Cool metals (D21, 0.15.0): Diamond (ice blue), Platinum, Pewter under the rainbow;
// no gold or bronze anywhere; the shine drops tier by tier; only Diamond twinkles,
// and its glints never touch any text.
test('cool podium: Diamond, Platinum, Pewter; descending shine; glints clear of text', async () => {
  await page.goto('/');
  const tiers = page.locator('.row.tier');
  await expect(tiers).toHaveCount(4);
  const info = await tiers.evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const edge = el.getAnimations().find((a) => (a as CSSAnimation).animationName.startsWith('tier-flow'));
    return { cls: el.className, bg: cs.backgroundImage, wash: parseFloat(cs.getPropertyValue('--wash')), sheen: parseFloat(cs.getPropertyValue('--sheen')), edgeMs: Number(edge?.effect?.getTiming().duration), glints: el.querySelectorAll('.glint').length };
  }));
  expect(info.map((i) => i.cls.match(/p\d/)![0])).toEqual(['p1', 'p2', 'p3', 'p4']);
  expect(info[1]!.bg).toContain('rgb(158, 220, 255)'); // Diamond, ice blue #9edcff
  expect(info[2]!.bg).toContain('rgb(207, 215, 226)'); // Platinum #cfd7e2
  expect(info[3]!.bg).toContain('rgb(135, 146, 160)'); // Pewter #8792a0
  // No gold or bronze left, on the rows or anywhere in the styles.
  const warm = /rgb\(226, 183, 96\)|rgb\(198, 130, 84\)|rgba\(226, 183, 96|rgba\(198, 130, 84|e2b760|c68254/i;
  for (const i of info) expect(i.bg).not.toMatch(warm);
  expect(await page.evaluate(() => [...document.styleSheets].flatMap((sh) => [...sh.cssRules].map((r) => r.cssText)).join('\n'))).not.toMatch(warm);
  // Descending shine: each metal's wash and shimmer weaker than the one above; Pewter's edge flows at half speed.
  expect(info[1]!.wash).toBeGreaterThan(info[2]!.wash);
  expect(info[2]!.wash).toBeGreaterThan(info[3]!.wash);
  expect(info[1]!.sheen).toBeGreaterThan(info[2]!.sheen);
  expect(info[2]!.sheen).toBeGreaterThan(info[3]!.sheen);
  expect(info[3]!.edgeMs).toBe(2 * info[2]!.edgeMs);
  // Only Diamond twinkles, and every glint stays clear of every piece of text in its row.
  expect(info.map((i) => i.glints)).toEqual([0, 3, 0, 0]);
  expect(await page.locator('.glint').count()).toBe(3);
  const overlaps = await tiers.nth(1).evaluate((row) => {
    const boxes = [...row.querySelectorAll<HTMLElement>('.rk, .name, .cluster > *, .meta, .score b, .score .cap')].map((t) => {
      const range = document.createRange();
      range.selectNodeContents(t);
      return { what: t.className || t.tagName, r: range.getBoundingClientRect() };
    });
    return [...row.querySelectorAll<HTMLElement>('.glint')].flatMap((g) => {
      const a = g.getBoundingClientRect();
      return boxes.filter(({ r }) => r.width > 0 && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top).map(({ what }) => `${g.className} × ${what}`);
    });
  });
  expect(overlaps).toEqual([]);
  // The glints really twinkle (their own rhythms), and Reduce Motion hides them.
  expect(await page.locator('.glint').evaluateAll((gs) => gs.map((g) => Number(g.getAnimations()[0]?.effect?.getTiming().duration)))).toEqual([2900, 3700, 4300]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.glint').first()).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await shot(page, '23-cool-podium');
});

test('filter to Edibles: ranks renumber, podium follows, tiles recalculate, TOTAL 0g', async () => {
  await pill('Type').selectOption('edibles');
  await expect(pillBox('Type')).toHaveClass(/active/);
  await expect(pillBox('Type')).toContainText('Type: Edibles');
  await expect(rows()).toHaveCount(3);
  await expect(rows().nth(0)).toContainText('Camino Midnight Blueberry');
  await expect(rows().nth(0).locator('.rk')).toHaveText('1');
  await expect(rows().nth(0)).toHaveClass(/p1/);
  await expect(tile('Products')).toHaveText('3');
  await expect(tile('Average')).toHaveText('8.2');
  await expect(tile('Total')).toHaveText('0g');
});

test('Rank by Price per mg: highest first, relabelled score, price also on the metadata line', async () => {
  await pill('Rank by').selectOption('price');
  await expect(pillBox('Rank by')).toHaveClass(/active/);
  await expect(rows().nth(0).locator('.score')).toHaveText(/£0\.18\s*Price/i);
  await expect(rows().nth(1).locator('.score')).toHaveText(/£0\.12\s*Price/i);
  await expect(rows().nth(2).locator('.score')).toHaveText(/£0\.05\s*Price/i);
  await expect(rows().nth(0).locator('.meta')).toContainText('£0.18/mg');
  await shot(page, '21-edibles-price');
});

test('the view is remembered on this device', async () => {
  await page.reload();
  await expect(pillBox('Type')).toContainText('Edibles');
  await expect(pillBox('Rank by')).toContainText(/Price/);
  await expect(rows()).toHaveCount(3);
});

test('Rank by Consistency under Concentrate hides concentrates without it', async () => {
  await pill('Type').selectOption('concentrate');
  await pill('Rank by').selectOption('consistency');
  await expect(rows()).toHaveCount(1);
  await expect(rows().nth(0)).toContainText('Moroccan Hash');
  await expect(rows().nth(0).locator('.score')).toHaveText(/7\.8\s*Consistency/i);
  await expect(tile('Products')).toHaveText('1');
});

test('a Rank by that the new filter lacks falls back to Overall and overwrites the stored setting', async () => {
  await pill('Type').selectOption('all');
  await pill('Rank by').selectOption('look');
  await pill('Type').selectOption('edibles');
  await expect(pill('Rank by')).toHaveValue('overall');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gt.view')!))).toEqual({ filter: 'edibles', rankBy: 'overall' });
});

test('empty states: filtered, and ranking (which wins when both apply)', async () => {
  await pill('Type').selectOption('pre_roll');
  await expect(page.getByRole('heading', { name: 'No Pre roll yet' })).toBeVisible();
  await expect(page.getByText('You have 16 products, but none are Pre roll.')).toBeVisible();
  await expect(tile('Products')).toHaveText('0');
  await shot(page, '22-filtered-empty');

  await pill('Rank by').selectOption('smell');
  await expect(page.getByRole('heading', { name: 'Nothing rated on Smell' })).toBeVisible();
  await expect(page.getByText('None of your Pre roll products has a Smell rating yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Rank by Overall' }).click();
  await expect(pill('Rank by')).toHaveValue('overall');
  await expect(page.getByRole('heading', { name: 'No Pre roll yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all types' }).click();
  await expect(rows()).toHaveCount(16);
});

test('labels fit at 375px for every filter × Rank by combination; short forms only where measured', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  const compacted: string[] = [];
  const types = await pill('Type').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  for (const t of types) {
    await pill('Type').selectOption(t);
    const ranks = await pill('Rank by').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    for (const r of ranks) {
      await pill('Rank by').selectOption(r);
      const m = await page.locator('.controls').evaluate((el) => ({ overflow: el.scrollWidth > el.clientWidth + 1, text: el.textContent }));
      expect(m.overflow, `${t} × ${r}`).toBe(false);
      // Tiers go to the first four rated rows of whatever is shown, never an unrated one.
      const got = await rows().evaluateAll((els) => els.map((e) => ({ tier: [...e.classList].find((c) => /^p[1-4]$/.test(c)) ?? null, unrated: !!e.querySelector('.score.unrated') })));
      const rated = got.filter((g) => !g.unrated).length;
      expect(got.map((g) => g.tier), `${t} × ${r}`).toEqual(got.map((_, i) => (i < Math.min(4, rated) ? `p${i + 1}` : null)));
      if (/VFM|Consis\.|Price\/|Conc\./.test(m.text ?? '')) compacted.push(`${t} × ${r}: ${m.text}`);
    }
  }
  console.log(`Abbreviated at 375px (${compacted.length}):\n${compacted.join('\n')}`);
  // At the design width (390px) and above, every combination the brief expects to be
  // tight still gets full labels unless measured otherwise — recorded in SPEC.
  await page.setViewportSize({ width: 390, height: 844 });
  await pill('Type').selectOption('all');
  await pill('Rank by').selectOption('overall');
});

test('coming back from a product lands on the tapped row; tab switches start at the top', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);

  // A row already visible at the top: the page stays at the top. Tap it where it is
  // (Playwright's click may scroll the page first, and then that's where you were).
  const first = (await rows().nth(1).boundingBox())!;
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
  await expect(page.locator('main')).toHaveAttribute('data-podium', /.+/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(rows()).toHaveCount(16);
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Scrolled a little, with the row still on screen: back lands exactly where you were
  // (the same place the list's own history entry restores, router.ts).
  await page.evaluate(() => window.scrollTo(0, 150));
  const third = (await rows().nth(3).boundingBox())!;
  await page.mouse.click(third.x + third.width / 2, third.y + third.height / 2);
  await expect(page.locator('main')).toHaveAttribute('data-podium', /.+/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(rows()).toHaveCount(16);
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(150);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  // A row further down: back puts it at roughly the same screen position.
  const target = rows().nth(12);
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(100);
  const before = (await target.boundingBox())!.y;
  const name = (await target.locator('.name').textContent())!;
  // Tap it where it is (Playwright's click would scroll it first).
  await target.evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  const row = page.locator('.row', { hasText: name });
  await expect.poll(async () => Math.abs((await row.boundingBox())!.y - before)).toBeLessThan(12);

  // Tab switches start at the top.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(rows()).toHaveCount(16);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // A row that's gone (archived) → top.
  const last = rows().nth(14);
  await last.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await last.click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(rows()).toHaveCount(15);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('§17: re-rate a product from 8th to 2nd, come back → it is on screen at its new position', async () => {
  await page.setViewportSize({ width: 390, height: 560 }); // short, so 2nd is off screen where 8th was
  await page.goto('/');
  const eighth = rows().nth(7);
  await expect(eighth.locator('.rk')).toHaveText('8');
  const name = (await eighth.locator('.name').textContent())!;
  await eighth.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const listScroll = await page.evaluate(() => window.scrollY);
  expect(listScroll).toBeGreaterThan(0);
  await eighth.evaluate((el: HTMLElement) => el.click());
  await page.getByRole('link', { name: 'Edit' }).first().click();
  // 8.7 puts it second, behind Gelato 41's 8.9.
  await page.getByRole('button', { name: /^Look: .*Tap to type/ }).click();
  await page.getByLabel('Look (1 to 10)').fill('8.7');
  await page.getByLabel('Look (1 to 10)').press('Enter');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // The list's history entry restores its own scroll (router.ts), and on a fast machine
  // that can land after the app has put the row on screen: make it land late on purpose.
  // (During the Back flight it can't matter: the flight ends by scrolling where the app says.)
  await page.evaluate((y) =>
    addEventListener('popstate', () => {
      const late = () => (document.documentElement.classList.contains('vt-photo') ? setTimeout(late, 10) : setTimeout(() => window.scrollTo(0, y), 30));
      setTimeout(late, 10);
    }, { once: true }), listScroll);
  await page.getByRole('link', { name: 'Back' }).click();

  const row = page.locator('.row', { hasText: name });
  await expect(row.locator('.rk')).toHaveText('2');
  await page.waitForTimeout(1000); // past the late restore, and the app undoing it
  await expect(row).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
});
