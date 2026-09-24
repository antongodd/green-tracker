import { expect, test, type Page } from '@playwright/test';
import { shot, signUp } from './helpers';

/** A real touch gesture (touchStart → moves → touchEnd), as a finger on a phone produces. */
async function touchPath(page: Page, points: { x: number; y: number }[]) {
  const cdp = await page.context().newCDPSession(page);
  const [first, ...rest] = points;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first!] });
  for (const p of rest) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** The slider's box, after scrolling it to mid-screen (clear of the header and Save bar). */
async function boxOf(page: Page, name: string) {
  const slider = page.getByRole('slider', { name, exact: true });
  await slider.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  return (await slider.boundingBox())!;
}

/** Points along a horizontal drag from the start of `slider` to `frac` of its width. */
async function dragPoints(page: Page, name: string, frac: number, steps = 12) {
  const box = await boxOf(page, name);
  const y = box.y + box.height / 2;
  const x0 = box.x + 13; // the unrated thumb sits at the start
  const x1 = box.x + 13 + (box.width - 26) * frac;
  return Array.from({ length: steps + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / steps, y }));
}

const valueOf = (page: Page, name: string) => page.getByRole('slider', { name, exact: true }).getAttribute('aria-valuetext');

test.describe('rating sliders', () => {
  // One account for the whole file: sign-up is rate-limited to 10 an hour per address.
  let storageState: Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    await signUp(await context.newPage());
    storageState = await context.storageState();
    await context.close();
  });
  test.use({ storageState: async ({}, use) => use(storageState) });
  test.beforeEach(async ({ page }) => {
    await page.goto('/products/new');
  });

  test('one continuous finger drag from unrated sets the rating (the iPhone bug)', async ({ page }) => {
    expect(await valueOf(page, 'Look')).toBe('Unrated');
    await touchPath(page, await dragPoints(page, 'Look', (8 - 1) / 9));
    // The whole drag counted, not just its first step (the bug stopped at ~1.2).
    expect(await valueOf(page, 'Look')).toBe('8.0');
  });

  test('the bar doesn’t move or resize when it goes from unrated to rated', async ({ page }) => {
    // The original bug: the unrated slider shared a class with the empty-state card,
    // so its margins vanished on the first value and the bar jumped out from under the finger.
    const before = await boxOf(page, 'Look');
    await page.getByRole('slider', { name: 'Look', exact: true }).press('End');
    const after = await boxOf(page, 'Look');
    // Focusing may scroll the page, so compare what matters under a finger: size and horizontal position.
    expect({ x: after.x, width: after.width, height: after.height }).toEqual({ x: before.x, width: before.width, height: before.height });
  });

  test('date fields stay inside their card', async ({ page }) => {
    const card = (await page.getByRole('region', { name: 'Origin' }).boundingBox())!;
    const date = (await page.getByLabel('Date tried').boundingBox())!;
    expect(date.x + date.width).toBeLessThanOrEqual(card.x + card.width - 16);
  });

  test('a tap on the bar jumps to that value', async ({ page }) => {
    const box = await boxOf(page, 'Smell');
    const x = box.x + 13 + (box.width - 26) * 0.5; // halfway: 5.5
    await touchPath(page, [{ x, y: box.y + box.height / 2 }]);
    expect(await valueOf(page, 'Smell')).toBe('5.5');
  });

  test('a vertical swipe starting on a slider scrolls instead of rating', async ({ page }) => {
    const box = await boxOf(page, 'Taste');
    const x = box.x + box.width * 0.7;
    const y = box.y + box.height / 2;
    await touchPath(page, Array.from({ length: 10 }, (_, i) => ({ x, y: y - i * 25 })));
    expect(await valueOf(page, 'Taste')).toBe('Unrated');
  });

  test('mouse drag and keyboard work too', async ({ page }) => {
    const [start, ...rest] = await dragPoints(page, 'Burn', (6.5 - 1) / 9);
    await page.mouse.move(start!.x, start!.y);
    await page.mouse.down();
    for (const p of rest) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
    expect(Number(await valueOf(page, 'Burn'))).toBeCloseTo(6.5, 0);

    const high = page.getByRole('slider', { name: 'High', exact: true });
    await high.focus();
    await high.press('ArrowRight'); // from unrated: 1.0
    await high.press('PageUp'); // +1
    await high.press('ArrowRight'); // +0.1
    expect(await valueOf(page, 'High')).toBe('2.1');
    await page.getByRole('button', { name: 'Clear High' }).click();
    expect(await valueOf(page, 'High')).toBe('Unrated');
  });

  test('hit time moves in 15-minute steps and reads as a duration', async ({ page }) => {
    await page.getByLabel('Product type').selectOption('edibles');
    expect(await valueOf(page, 'Hit time')).toBe('Not set');
    await touchPath(page, await dragPoints(page, 'Hit time', 75 / 180));
    expect(await valueOf(page, 'Hit time')).toBe('1h 15m');
    await page.getByRole('slider', { name: 'Taste', exact: true }).press('End');
    await page.getByRole('slider', { name: 'Taste', exact: true }).press('PageDown');
    await page.getByRole('slider', { name: 'Taste', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await shot(page, '15-sliders');
  });
});
