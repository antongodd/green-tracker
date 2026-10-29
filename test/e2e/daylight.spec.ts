import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, heroTextBoxes, settled, shot, signUp, textBoxes } from './helpers';

// D72 (0.62.0): three light looks, the Daylights (Mint, Pearl, Sky). A look changes only colours (D70's
// rule; looks.spec.ts checks them like every look); on top of that a light look takes the light tone:
// the iPhone's own controls and status bar in their light style, and light cards for the colour sets.
// Everyone starts dark: a light look is only ever chosen. One account per worker.
test.describe.configure({ mode: 'parallel' });
let page: Page;
const ids: Record<string, string> = {};

const DAYLIGHTS = [
  { look: 'daymint', name: 'Daylight Mint', bg: 'rgb(238, 244, 240)' },
  { look: 'daypearl', name: 'Daylight Pearl', bg: 'rgb(245, 244, 248)' },
  { look: 'daysky', name: 'Daylight Sky', bg: 'rgb(238, 243, 250)' },
] as const;
const PRESETS = ['gems', 'aurora', 'cosmos', 'deepsea', 'ember', 'metals', 'neon', 'prism', 'sunset', 'synthwave'] as const;

const put = (look: string, preset = 'gems', top = 'strip') =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, { look, top, preset, markFirst: true });
const axe = async () => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`);
};
/** The page's tone, as the iPhone sees it. */
const tone = () =>
  page.evaluate(() => ({
    tone: document.documentElement.dataset.tone ?? 'dark',
    scheme: getComputedStyle(document.documentElement).colorScheme,
    meta: document.querySelector('meta[name="color-scheme"]')!.getAttribute('content'),
    bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')!.getAttribute('content'),
  }));

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `day${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  // One row in each colour band, then two that glow in their score's colour.
  for (const [name, score, strain] of [['Peak', 9.7, 'hybrid'], ['High', 9.2, 'indica'], ['Good', 8.7, 'sativa'], ['Fine', 8.2, 'hybrid'], ['Okay', 7.6, 'indica'], ['Meh', 6.1, 'sativa']] as const) {
    const body = { ...emptyProductInput(), name, strainType: strain, country: 'US', source: 'Shop', ratings: { look: score, smell: score }, purchases: [{ date: '2026-10-01', amount: 3.5, totalPaid: 35, supplier: null }] };
    const r = await page.evaluate(async (b) => (await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }, body);
    ids[name] = r.product.id;
  }
});
test.afterAll(async () => {
  await put('aurora');
  await page.context().close();
});

test('the app starts dark; choosing a Daylight makes it light, the iPhone’s own controls and status bar too, and the phone remembers it', async () => {
  // A new account is dark: Aurora Glass, no light tone, the dark status bar.
  await page.goto('/');
  await expect(page.locator('.rows .row')).toHaveCount(6);
  expect(await tone()).toEqual({ tone: 'dark', scheme: 'dark', meta: 'dark', bar: 'black-translucent' });
  for (const d of DAYLIGHTS) {
    await page.goto('/more/look');
    await page.locator(`input[name="look"][value="${d.look}"]`).check();
    await expect(page.locator('html')).toHaveAttribute('data-look', d.look);
    await expect(page.locator('html')).toHaveAttribute('data-tone', 'light');
    expect(await tone(), d.look).toEqual({ tone: 'light', scheme: 'light', meta: 'light', bar: 'default' });
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), d.look).toBe(d.bg);
  }
  // The phone remembers it: the next launch is light before the account has loaded.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await tone()).toEqual({ tone: 'light', scheme: 'light', meta: 'light', bar: 'default' });
  release();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.unroute('**/api/auth/me');
  // Back to a dark look: everything dark again, at once.
  await page.goto('/more/look');
  await page.locator('input[name="look"][value="neon"]').check();
  await expect(page.locator('html')).not.toHaveAttribute('data-tone', 'light');
  expect(await tone()).toEqual({ tone: 'dark', scheme: 'dark', meta: 'dark', bar: 'black-translucent' });
  expect(await put('aurora')).toBe(200);
});

test('light cards in every colour set: a white card with the colours at its edge, and every word on it readable', async () => {
  test.slow(); // ten sets, each photographed through its motion
  for (const preset of PRESETS) {
    expect(await put('daymint', preset)).toBe(200);
    await page.goto('/');
    await expect(page.locator('.rows .row.tier')).toHaveCount(4);
    // The card's layer is white, not dark (the dark looks keep their dark cards: looks.spec.ts, appearance.spec.ts).
    expect(await page.locator('.rows .row.tier').first().evaluate((e) => getComputedStyle(e).backgroundImage), preset).toMatch(/^linear-gradient\(115deg, rgba\(255, 255, 255/);
    const boxes = await textBoxes(page, '.row .name, .row .meta, .row .score b, .row .score .cap, .row .rk');
    const worst = await contrastFailures(page, boxes, 6);
    expect(worst, `${preset}:\n${worst.join('\n')}`).toEqual([]);
    if (preset === 'gems' || preset === 'synthwave') await shot(page, `720-daylight-cards-${preset}`);
  }
  expect(await put('aurora')).toBe(200);
});

for (const d of DAYLIGHTS) {
  test(`${d.name}: product pages readable (in colour and plain) and every main screen accessible`, async () => {
    test.slow(); // many screens
    expect(await put(d.look)).toBe(200);
    for (const name of ['Peak', 'Okay']) {
      await page.goto(`/products/${ids[name]}`);
      await expect(page.locator('.hero h1')).toHaveText(name);
      await settled(page);
      if (name === 'Peak') await shot(page, `721-daylight-product-${d.look}`);
      const worst = await contrastFailures(page, await heroTextBoxes(page), 4);
      expect(worst, `${d.look} ${name}:\n${worst.join('\n')}`).toEqual([]);
      expect(await axe(), `${d.look} ${name}`).toEqual([]);
    }
    for (const path of ['/', '/log', '/sources', '/people', '/more', '/more/look', '/more/top', '/more/colours', '/more/sounds', '/more/currency', '/more/privacy', '/more/passkeys', '/more/archive', '/products/new']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await axe(), `${d.look} ${path}`).toEqual([]);
    }
    // A sheet: the Colours key, light cards and all.
    await page.goto('/');
    await page.getByRole('button', { name: 'What the colours mean' }).click();
    await expect(page.locator('.key-list li')).not.toHaveCount(0);
    expect(await axe(), `${d.look} the Colours key`).toEqual([]);
    expect(await put('aurora')).toBe(200);
  });
}
