import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { expectStatsFit, shot, signUp } from './helpers';

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

test('default: Overall, all types; colours by score, #1 marked, tiles, unrated last', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);
  await expect(rows().nth(0)).toContainText('Gelato 41');
  // Colours by score in Aurora, where everyone starts (D48, D64): 8.9 and 8.6 Lagoon, 8.4 → 8.0 Jade; below 8 the heat glow (D30).
  const bands = await rows().evaluateAll((els) => els.slice(0, 7).map((e) => [...e.classList].filter((c) => /^(band\d|pal-.+|first)$/.test(c)).join(' ')));
  expect(bands).toEqual(['band2 pal-aurora first', 'band2 pal-aurora', 'band1 pal-aurora', 'band1 pal-aurora', 'band1 pal-aurora', 'band1 pal-aurora', '']);
  await expect(rows().nth(6)).toHaveAttribute('data-heat');
  await expect(rows().nth(0).locator('.rk .rank-crown')).toHaveCount(1);
  await expect(page.locator('.rank-crown')).toHaveCount(1);
  await expect(rows().nth(15)).toContainText('Mystery Sample');
  await expect(rows().nth(15)).toContainText('Unrated');
  await expect(tile('Products')).toHaveText('16');
  await expect(tile('Average')).toHaveText('6.7'); // 100.758 ÷ 15 rated
  await expect(tile('Total')).toHaveText('12.5g'); // 3.5 + 7 + 1 + 1; no edibles
  expect(await expectStatsFit(page)).toBe('hero'); // everyone starts on the glass hero (D64)
  await expect(pillBox('Rank by')).not.toHaveClass(/active/);
  await expect(pillBox('Type')).not.toHaveClass(/active/);
  await shot(page, '20-leaderboard');
});

test('All types ranks by value for money and price, edibles as 20mg for 1g of flower (D67)', async () => {
  await page.goto('/');
  await expect(rows()).toHaveCount(16);
  const read = () => rows().evaluateAll((els) => els.map((e) => [e.querySelector('.name')!.textContent, e.querySelector('.score b')!.textContent]));
  // Overall ÷ price per gram, or per 20mg for edibles: the brownie's 8.0 ÷ £1.00 tops it.
  await pill('Rank by').selectOption('vfm');
  await expect(pillBox('Rank by')).toContainText('Value for money');
  await expect(rows()).toHaveCount(7); // nothing without a price
  expect(await read()).toEqual([
    ['Chocolate Brownie', '8.00'], // 8.0 ÷ (£0.05 × 20)
    ['Lemon Cherry Gelato', '3.44'], // 8.6 ÷ £2.50
    ['Peach Rings Gummies', '3.42'], // 8.2 ÷ (£0.12 × 20)
    ['Gelato 41', '3.28'],
    ['Camino Midnight Blueberry', '2.31'], // 8.333 ÷ (£0.18 × 20)
    ['Moroccan Hash', '0.94'],
    ['Blue Zushi Live Rosin', '0.19'],
  ]);
  await expect(rows().nth(0)).toHaveClass(/\bfirst\b/);
  await expect(page.locator('.row[class*="band"]')).toHaveCount(0);
  // Price: highest first; an edible's is the price of 20mg, said so before its real price per mg.
  await pill('Rank by').selectOption('price');
  await expect(pillBox('Rank by')).toContainText('Price');
  expect(await read()).toEqual([
    ['Blue Zushi Live Rosin', '£45.00'],
    ['Moroccan Hash', '£8.00'],
    ['Camino Midnight Blueberry', '£3.60'],
    ['Gelato 41', '£2.71'],
    ['Lemon Cherry Gelato', '£2.50'],
    ['Peach Rings Gummies', '£2.40'],
    ['Chocolate Brownie', '£1.00'],
  ]);
  await expect(rows().nth(2).locator('.meta')).toHaveText('per 20mg·£0.18/mg·Kiva');
  await expect(rows().nth(3).locator('.meta')).toHaveText('£2.71/g·Cookies');
  await expect(page.locator('.meta .per')).toHaveCount(3);
  // A wide price (£45.00) stays inside its row, clear of the edge, and the name gives way instead.
  const spill = await rows().evaluateAll((els) =>
    els.flatMap((e) => {
      const row = e.getBoundingClientRect();
      const b = e.querySelector('.score b')!.getBoundingClientRect();
      const name = e.querySelector('.name')!.getBoundingClientRect();
      return b.right > row.right - 12 + 0.5 || name.right > b.left ? [`${e.querySelector('.name')!.textContent}: ${b.right} / ${row.right}`] : [];
    }),
  );
  expect(spill).toEqual([]);
  await shot(page, '20b-all-price');
  // The edible's page says how its value for money is worked out, and keeps its real price.
  await rows().nth(6).click();
  await expect(page.locator('.vfm b')).toHaveText('8.00');
  await expect(page.locator('.vfm', { hasText: 'Value for money' })).toContainText('Overall ÷ latest £ per 20mg (the same effect as 1g of flower) · higher is better');
  await expect(page.locator('.purchase .u')).toHaveText('£0.05/mg');
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(rows()).toHaveCount(7);
  await pill('Rank by').selectOption('overall');
  await expect(page.locator('.meta .per')).toHaveCount(0);
});

test('filter to Edibles: ranks renumber, the #1 mark follows, tiles recalculate, TOTAL 0g', async () => {
  await pill('Type').selectOption('edibles');
  await expect(pillBox('Type')).toHaveClass(/active/);
  await expect(pillBox('Type')).toContainText('Type: Edibles');
  await expect(rows()).toHaveCount(3);
  await expect(rows().nth(0)).toContainText('Camino Midnight Blueberry');
  await expect(rows().nth(0).locator('.rk')).toHaveText('1');
  await expect(rows().nth(0)).toHaveClass(/\bfirst\b/);
  await expect(rows().nth(0)).toHaveClass(/\bband1\b/); // 8.3
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
  await expect(page.locator('.meta .per')).toHaveCount(0); // one type: its own unit, no note (D67)
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
      // The Colours key (D48) sits beside Rank by only when ranking by a score.
      await expect(page.locator('.controls .pill.key'), `${t} × ${r}`).toHaveCount(['price', 'vfm'].includes(r) ? 0 : 1);
      // Colours follow the score as shown, only for scores out of 10 (D48); the #1 mark goes on the top row when it has a value.
      const got = await rows().evaluateAll((els) => els.map((e) => ({ band: [...e.classList].find((c) => /^band\d$/.test(c)) ?? null, first: e.classList.contains('first'), score: e.querySelector('.score b')!.textContent!, unrated: !!e.querySelector('.score.unrated') })));
      const scored = !['price', 'vfm'].includes(r);
      const want = (g: (typeof got)[number]) => {
        const v = Number(g.score);
        if (!scored || g.unrated || v < 8) return null;
        return `band${v >= 9.5 ? 4 : v >= 9 ? 3 : v >= 8.5 ? 2 : 1}`;
      };
      expect(got.map((g) => g.band), `${t} × ${r}`).toEqual(got.map(want));
      expect(got.map((g) => g.first), `${t} × ${r}`).toEqual(got.map((g, i) => i === 0 && !g.unrated));
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
  await expect(page.locator('main')).toHaveAttribute('data-band', /.+/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(rows()).toHaveCount(16);
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Scrolled a little, with the row still on screen: back lands exactly where you were
  // (the same place the list's own history entry restores, router.ts).
  await page.evaluate(() => window.scrollTo(0, 150));
  const third = (await rows().nth(3).boundingBox())!;
  await page.mouse.click(third.x + third.width / 2, third.y + third.height / 2);
  await expect(page.locator('main')).toHaveAttribute('data-band', /.+/);
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
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click();
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

/**
 * §17: re-rates the product at `place` (a Filler: only Look) to `look`, enough for 2nd, then comes back. `slow` plays every
 * animation at a fifth of its speed, as a busy phone might: the Back flight then outlasts the
 * app's first second of undoing the list's own late scroll restore (0.50.0: once on a 4-worker run).
 */
async function rerate(place: number, look: string, slow: boolean) {
  await page.setViewportSize({ width: 390, height: 560 }); // short, so 2nd is off screen where 8th was
  await page.goto('/');
  const eighth = rows().nth(place - 1);
  await expect(eighth.locator('.rk')).toHaveText(String(place));
  await expect(eighth.locator('.name')).toHaveText(/^Filler/);
  const name = (await eighth.locator('.name').textContent())!;
  await eighth.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const listScroll = await page.evaluate(() => window.scrollY);
  expect(listScroll).toBeGreaterThan(0);
  await eighth.evaluate((el: HTMLElement) => el.click());
  await page.getByRole('link', { name: 'Edit' }).first().click();
  // 8.7 puts it second, behind Gelato 41's 8.9.
  await page.getByRole('button', { name: /^Look: .*Tap to type/ }).click();
  await page.getByLabel('Look (1 to 10)').fill(look);
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
  const cdp = slow ? await page.context().newCDPSession(page) : null;
  if (cdp) {
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.2 });
  }
  await page.getByRole('link', { name: 'Back' }).click();

  const row = page.locator('.row', { hasText: name });
  await expect(row.locator('.rk')).toHaveText('2');
  if (cdp) await expect(page.locator('html.vt-photo')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(1000); // past the late restore, and the app undoing it
  await expect(row).toBeInViewport();
  if (cdp) {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    await cdp.detach();
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

test('§17: re-rate a product from 8th to 2nd, come back → it is on screen at its new position', () => rerate(8, '8.7', false));
// The first one's Filler is now 2nd, so the 9th is the next Filler; 8.8 puts it 2nd in turn.
test('§17, slowly: the same with a slow Back flight (a busy phone)', () => rerate(9, '8.8', true));
