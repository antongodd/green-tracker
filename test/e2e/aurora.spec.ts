import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D29 (0.22.0), D64 (0.54.0): the lights. Since the new look they're on the fixed background
// behind every screen (green top left, teal top right, violet low down), drifting slowly; they
// stay put as you scroll, stop with Reduce Motion, and overlays cover them. Measured from pixels.
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
const BG = [3, 7, 10]; // --bg
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

/** Holds every light still at the same moment, so two photos can be compared. */
const holdLights = (at: number) =>
  page.evaluate((at) => {
    for (const a of document.getAnimations()) if (/^lights$/.test((a as CSSAnimation).animationName)) (a.pause(), (a.currentTime = at));
  }, at);

test('the lights are behind every screen, drifting, and stay put as you scroll', async () => {
  await page.goto('/');
  await expect(page.locator('.row')).toHaveCount(14);
  await settled();
  // Three lights painted on the fixed background, drifting on one slow loop in small steps.
  const layer = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.bg-layer')!);
    return { lights: cs.backgroundImage.match(/radial-gradient/g)?.length ?? 0, anim: cs.animationName, timing: cs.animationTimingFunction };
  });
  expect(layer).toEqual({ lights: 3, anim: 'lights', timing: 'steps(48)' });
  await holdLights(0);
  // The left gutter beside the stats: green-tinted at the top…
  const top = await colour(2, 130);
  expect(top[1]! - BG[1]!, `top ${top}`).toBeGreaterThan(6);
  // …teal on the right…
  const right = await colour(382, 200);
  expect(right[2]! - BG[2]!, `right ${right}`).toBeGreaterThan(5);
  // They move: from one end of their loop to the other, the gutters beside the content change colour.
  const gutters = [[2, 230], [2, 500], [386, 120], [386, 420], [386, 700]] as const;
  const photos = async () => {
    const out: number[][] = [];
    for (const [x, y] of gutters) out.push(await colour(x, y));
    return out;
  };
  const atStart = await photos();
  await holdLights(24000);
  const atEnd = await photos();
  const moved = Math.max(...atEnd.flatMap((c, k) => c.map((v, i) => Math.abs(v - atStart[k]![i]!))));
  expect(moved, `drift ${JSON.stringify(atStart)} → ${JSON.stringify(atEnd)}`).toBeGreaterThan(2);
  const later = await colour(2, 230);
  // Scrolled down, the lights haven't gone anywhere: the same colour at the same moment.
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  await holdLights(24000);
  const after = await colour(2, 230);
  expect(Math.max(...after.map((v, i) => Math.abs(v - later[i]!))), `after scrolling ${after}`).toBeLessThan(1.5);
  // Violet low down: seen on a screen with room to spare (the archive, empty).
  await page.goto('/more/archive');
  await expect(page.locator('main.screen')).toBeVisible();
  await settled();
  await holdLights(0);
  const low = await colour(180, 700, 30, 20);
  expect(low[2]! - BG[2]!, `low ${low}`).toBeGreaterThan(4);
  expect(low[2]!, `violet, not green ${low}`).toBeGreaterThan(low[1]!);
});

test('the screens carry no lights of their own; overlays cover the lights', async () => {
  for (const path of ['/', '/log', '/people', '/more', '/more/archive', '/products/new']) {
    await page.goto(path);
    await expect(page.locator('main.screen')).toBeVisible();
    expect(await page.locator('main.screen').evaluate((m) => getComputedStyle(m).backgroundImage), path).toBe('none');
  }
  // The country picker covers the editor in the plain background.
  await page.getByLabel('Country', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a country' })).toBeVisible();
  const picker = await colour(2, 130);
  expect(Math.max(...picker.map((v, i) => Math.abs(v - BG[i]!))), `picker ${picker}`).toBeLessThan(1.5);
  // Under it the lights are hidden and still, so the phone does no work for them (D64).
  expect(await page.evaluate(() => [getComputedStyle(document.querySelector('.bg-layer')!)].map((cs) => [cs.backgroundImage, cs.animationPlayState])[0])).toEqual(['none', 'paused']);
  // Signed out: the lights are there too.
  const out = await (await page.context().browser()!.newContext()).newPage();
  await out.goto('/');
  await expect(out.locator('main.fullscreen')).toBeVisible();
  expect(await out.evaluate(() => getComputedStyle(document.querySelector('.bg-layer')!).backgroundImage.match(/radial-gradient/g)?.length)).toBe(3);
  await out.context().close();
});

test('with Reduce Motion the lights are still', async ({ browser }) => {
  const still = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  await still.goto('/');
  await expect(still.locator('main.fullscreen')).toBeVisible();
  expect(await still.evaluate(() => document.getAnimations().filter((a) => /^lights$/.test((a as CSSAnimation).animationName)).length)).toBe(0);
  await still.context().close();
});

test('the Rank / Type row is frosted, not a black band across the lights', async () => {
  await page.goto('/');
  await settled();
  await holdLights(0);
  const c = await page.locator('.controls').evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, blur: getComputedStyle(e).backdropFilter }));
  expect(c).toEqual({ bg: 'rgba(3, 7, 10, 0.3)', blur: 'blur(20px) saturate(1.4)' });
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
