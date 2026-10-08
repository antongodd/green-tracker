import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D29 (0.22.0): the Aurora. Two still lights at the top of every screen (green top-left,
// teal top-right) drawn on the screen, so they scroll away with it; a faint green haze at the
// bottom on the fixed background, behind the tab bar. Overlays stay black. Measured from pixels.
test.describe.configure({ mode: 'serial' });
let page: Page;

/** The average colour of a small patch of the screen, [r, g, b]. */
async function colour(x: number, y: number, w = 6, h = 20): Promise<number[]> {
  const png = Buffer.from(await page.screenshot({ clip: { x, y, width: w, height: h } })).toString('base64');
  return page.evaluate(async (png) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    [c.width, c.height] = [img.width, img.height];
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k]! += d[i + k]!;
    return sum.map((v) => v / (d.length / 4));
  }, png);
}
const BG = [5, 8, 7]; // --bg
const settled = () => page.locator('main').evaluate((m) => Promise.all(m.getAnimations().map((a) => a.finished)));

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `aur${Date.now().toString(36).slice(-6)}`);
  for (let i = 0; i < 14; i++) {
    const body = { ...emptyProductInput(), name: `Aurora ${i + 1}`, country: i % 2 ? 'GB' : 'US', ratings: { look: 9 - i / 3 } };
    await page.evaluate(async (b) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), body);
  }
});
test.afterAll(async () => {
  await page.context().close();
});

test('the lights sit at the top of the screen and scroll away with it; the bottom haze stays behind the tab bar', async () => {
  await page.goto('/');
  await expect(page.locator('.row')).toHaveCount(14);
  await settled();
  // The left gutter beside the tiles (plain background): green-tinted at the top…
  const top = await colour(2, 130);
  expect(top[1]! - BG[1]!, `top ${top}`).toBeGreaterThan(6);
  // …teal on the right…
  const right = await colour(382, 130);
  expect(right[2]! - BG[2]!, `right ${right}`).toBeGreaterThan(5);
  // …and the bottom haze just above the tab bar, beside the rows.
  const nav = await page.locator('.nav').evaluate((n) => n.getBoundingClientRect().top);
  const low = await colour(2, nav - 30);
  expect(low[1]! - BG[1]!, `bottom ${low}`).toBeGreaterThan(1);
  // Scrolled down, the lights have gone with the page; the haze has stayed.
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  const topAfter = await colour(2, 130);
  expect(topAfter[1]! - BG[1]!, `top after scrolling ${topAfter}`).toBeLessThan(3);
  const lowAfter = await colour(2, nav - 30);
  expect(Math.abs(lowAfter[1]! - low[1]!), `bottom after scrolling ${lowAfter}`).toBeLessThan(1.5);
});

test('every screen has them, the sign-in screen too; overlays stay black', async () => {
  for (const path of ['/', '/log', '/people', '/more', '/more/archive', '/products/new']) {
    await page.goto(path);
    await expect(page.locator('main.screen')).toBeVisible();
    expect(await page.locator('main.screen').evaluate((m) => getComputedStyle(m).backgroundImage.match(/radial-gradient/g)?.length), path).toBe(2);
  }
  // The country picker covers the editor in plain black.
  await page.getByLabel('Country', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a country' })).toBeVisible();
  const picker = await colour(2, 130);
  expect(Math.max(...picker.map((v, i) => Math.abs(v - BG[i]!))), `picker ${picker}`).toBeLessThan(1.5);
  // Signed out.
  const out = await (await page.context().browser()!.newContext()).newPage();
  await out.goto('/');
  await expect(out.locator('main.fullscreen')).toBeVisible();
  expect(await out.locator('main.fullscreen').evaluate((m) => getComputedStyle(m).backgroundImage.match(/radial-gradient/g)?.length)).toBe(2);
  await out.context().close();
});

test('the Rank / Type row is frosted, not a black band across the lights', async () => {
  await page.goto('/');
  await settled();
  const c = await page.locator('.controls').evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, blur: getComputedStyle(e).backdropFilter }));
  expect(c).toEqual({ bg: 'rgba(5, 8, 7, 0.3)', blur: 'blur(20px) saturate(1.4)' });
  // At the row's left edge the green light still shows through, about as strongly as just below it.
  const row = await page.locator('.controls').evaluate((e) => e.getBoundingClientRect().toJSON());
  const inside = await colour(2, row.top + 2, 6, 10);
  const below = await colour(2, row.bottom + 2, 6, 10);
  expect(inside[1]! - BG[1]!, `inside ${inside}, below ${below}`).toBeGreaterThan((below[1]! - BG[1]!) * 0.6);
  expect(inside[1]! - BG[1]!, `inside ${inside}`).toBeGreaterThan(6);
});

test('text sitting straight on the lights stays readable', async () => {
  for (const [path, sel] of [['/more', '.lh.cap'], ['/log', '.group-h'], ['/', '.controls .pill-text']] as const) {
    // Top and bottom: the More headings run below the fold since the Privacy group (D45).
    const worst = await wholeScreenContrastFailures(page, path, sel);
    expect(worst, `${path}:\n${worst.join('\n')}`).toEqual([]);
  }
});
