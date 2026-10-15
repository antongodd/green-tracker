import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Zooming into a photo (D53, 0.45.0), in the full-screen viewer: pinch (1×–4×), double-tap for 2×
// and back, drag to look around (the photo stops at its edges). Zoomed in, the top and the bar
// slide away; one tap brings them back. Swiping to another photo only when zoomed right out.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
let id: string;
let touch: CDPSession;

const post = (page: Page, path: string, body?: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(), { path, body });
/** A detailed photo drawn in the page (1600×1200, like a real one), uploaded as a pending set. */
const upload = (page: Page, colour: string) =>
  page.evaluate(async (colour) => {
    const c = document.createElement('canvas');
    [c.width, c.height] = [1600, 1200];
    const x = c.getContext('2d')!;
    x.fillStyle = colour;
    x.fillRect(0, 0, 1600, 1200);
    x.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) x.fillRect(i * 40, (i * 97) % 1200, 12, 12);
    const img = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);

const viewer = (page: Page) => page.getByRole('dialog', { name: 'Photo viewer' });
/** The photo on show, and how far it's zoomed (its size on screen ÷ its size at 1×). */
const shownImg = async (page: Page) => page.locator('.viewer-slide img').nth(Number((await page.locator('.viewer-count').textContent())!.split(' / ')[0]) - 1);
const scale = async (page: Page) => (await shownImg(page)).evaluate((el) => (el as HTMLElement).getBoundingClientRect().width / (el as HTMLElement).offsetWidth);
const rect = async (page: Page) => (await shownImg(page)).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
const settle = (page: Page) => page.waitForTimeout(450); // the 0.28s glide back inside the limits

/** Two fingers: from (a, b) apart around a centre to (a2, b2), in steps. */
async function pinch(cx: number, cy: number, from: number, to: number, shift = { x: 0, y: 0 }) {
  const at = (d: number, k: number) => [
    { x: cx - d / 2 + shift.x * k, y: cy + shift.y * k, id: 1 },
    { x: cx + d / 2 + shift.x * k, y: cy + shift.y * k, id: 2 },
  ];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from, 0) });
  for (let i = 1; i <= 10; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from + ((to - from) * i) / 10, i / 10) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 8; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  void page;
}
async function doubleTap(page: Page, x: number, y: number) {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(90);
  await page.touchscreen.tap(x, y);
}
const middle = async (page: Page) => {
  const v = (await page.viewportSize())!;
  return { x: v.width / 2, y: v.height / 2 };
};

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } })).newPage();
  // Random as well as the time: repeated runs start several copies in the same millisecond.
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'zoo'));
  ({ page: fan, name: fanName } = await person(browser, 'zan'));
  const photos = [];
  for (const c of ['#6b4a2a', '#2c3a5a', '#3a5a2c']) photos.push({ upload: await upload(owner, c), crop: null });
  const input: ProductInput = { ...emptyProductInput(), name: 'Zoom Kush', photos };
  id = (await post(owner, '/api/products', input)).product.id;
  await post(fan, `/api/people/u/${ownerName}/follow`);
  await post(owner, `/api/people/requests/${fanName}/approve`);
  touch = await owner.context().newCDPSession(owner);
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

async function open(page: Page, n = 1) {
  await page.goto(`/products/${id}`);
  await page.getByRole('button', { name: new RegExp(`^Open photo ${n}\\b`) }).click();
  await expect(viewer(page)).toBeVisible();
  await expect(page.locator('.viewer-count')).toHaveText(`${n} / 3`);
  await page.waitForTimeout(100);
}

test('pinch zooms in around the fingers, up to 4×; the buttons slide away and the scale shows', async () => {
  await open(owner);
  const m = await middle(owner);
  expect(await scale(owner)).toBeCloseTo(1, 2);
  await pinch(m.x, m.y, 100, 250);
  await expect(owner.locator('.viewer-scale')).toHaveText(/^2\.\d×$/);
  await settle(owner);
  const s = await scale(owner);
  expect(s).toBeGreaterThan(2.3);
  expect(s).toBeLessThan(2.7);
  // The spot between the fingers stayed there: the photo's centre is still the screen's centre.
  const r = await rect(owner);
  expect(Math.abs(r.x + r.width / 2 - m.x)).toBeLessThan(4);
  await expect(viewer(owner)).toHaveClass(/\bclear\b/);
  await expect(owner.locator('.viewer-top')).toHaveCSS('opacity', '0');
  await expect(owner.locator('.viewer-bar')).toHaveCSS('opacity', '0');
  await shot(owner, '130-zoomed');
  // Pinching far past 4× settles back to 4×.
  await pinch(m.x, m.y, 60, 360);
  await settle(owner);
  expect(await scale(owner)).toBeCloseTo(4, 1);
  // Pinching right out returns to 1×, and the buttons come back.
  await pinch(m.x, m.y, 360, 40);
  await settle(owner);
  expect(await scale(owner)).toBeCloseTo(1, 2);
  await expect(viewer(owner)).not.toHaveClass(/\bclear\b/);
  await expect(owner.locator('.viewer-bar')).toHaveCSS('opacity', '1');
});

test('double-tap zooms to 2× where you tap, and back', async () => {
  await open(owner);
  const r0 = await rect(owner);
  const spot = { x: r0.x + r0.width * 0.75, y: r0.y + r0.height * 0.5 };
  await doubleTap(owner, spot.x, spot.y);
  await settle(owner);
  expect(await scale(owner)).toBeCloseTo(2, 2);
  // The tapped spot stays under the finger (as in the iPhone's Photos).
  const r = await rect(owner);
  expect(Math.abs(r.x + r.width * 0.75 - spot.x)).toBeLessThan(2);
  expect(r.x).toBeLessThan(r0.x - 50); // zoomed in towards the right
  await expect(viewer(owner)).toHaveClass(/\bclear\b/);
  await doubleTap(owner, spot.x, spot.y);
  await settle(owner);
  expect(await scale(owner)).toBeCloseTo(1, 2);
  await expect(viewer(owner)).not.toHaveClass(/\bclear\b/);
});

test('drag looks around while zoomed, and the photo stops at its edges', async () => {
  await open(owner);
  const m = await middle(owner);
  const v = (await owner.viewportSize())!;
  await doubleTap(owner, m.x, m.y);
  await settle(owner);
  await drag(owner, { x: m.x, y: m.y }, { x: m.x + 150, y: m.y });
  await owner.waitForTimeout(100);
  let r = await rect(owner);
  expect(r.x).toBeGreaterThan(-v.width / 2 - 10); // moved right
  // Far past the left edge: the photo's left edge stops at the screen's.
  await drag(owner, { x: 40, y: m.y }, { x: v.width - 10, y: m.y });
  await drag(owner, { x: 40, y: m.y }, { x: v.width - 10, y: m.y });
  await owner.waitForTimeout(100);
  r = await rect(owner);
  expect(Math.abs(r.x)).toBeLessThan(1.5);
  // And the right edge, the other way.
  await drag(owner, { x: v.width - 20, y: m.y }, { x: 10, y: m.y });
  await drag(owner, { x: v.width - 20, y: m.y }, { x: 10, y: m.y });
  await drag(owner, { x: v.width - 20, y: m.y }, { x: 10, y: m.y });
  await owner.waitForTimeout(100);
  r = await rect(owner);
  expect(Math.abs(r.x + r.width - v.width)).toBeLessThan(1.5);
  // Still the first photo: dragging while zoomed never changes photo.
  await expect(owner.locator('.viewer-count')).toHaveText('1 / 3');
});

test('swiping changes photo only when zoomed out; each photo starts at 1×', async () => {
  await open(owner);
  const m = await middle(owner);
  await drag(owner, { x: m.x + 120, y: m.y }, { x: m.x - 120, y: m.y });
  await expect(owner.locator('.viewer-count')).toHaveText('2 / 3');
  await owner.waitForTimeout(400);
  await doubleTap(owner, m.x, m.y);
  await settle(owner);
  expect(await scale(owner)).toBeCloseTo(2, 2);
  // The arrow keys still change photo, and the next one is at 1×.
  await owner.keyboard.press('ArrowRight');
  await expect(owner.locator('.viewer-count')).toHaveText('3 / 3');
  await owner.waitForTimeout(400);
  expect(await scale(owner)).toBeCloseTo(1, 2);
  await expect(viewer(owner)).not.toHaveClass(/\bclear\b/);
  // Back on photo 2, it's at 1× again.
  await owner.keyboard.press('ArrowLeft');
  await expect(owner.locator('.viewer-count')).toHaveText('2 / 3');
  expect(await scale(owner)).toBeCloseTo(1, 2);
  // Past the last photo, a swipe springs back.
  await owner.keyboard.press('ArrowRight');
  await owner.waitForTimeout(400);
  await drag(owner, { x: m.x + 120, y: m.y }, { x: m.x - 120, y: m.y });
  await owner.waitForTimeout(400);
  await expect(owner.locator('.viewer-count')).toHaveText('3 / 3');
});

test('one tap while zoomed brings the buttons back; Set as cover still works', async () => {
  await open(owner, 2);
  const m = await middle(owner);
  await doubleTap(owner, m.x, m.y);
  await settle(owner);
  await expect(viewer(owner)).toHaveClass(/\bclear\b/);
  // Hidden buttons can't be reached (by tap, keyboard or screen reader).
  await expect(owner.locator('.viewer-bar')).toHaveAttribute('inert', '');
  await owner.touchscreen.tap(m.x, m.y);
  await expect(viewer(owner)).not.toHaveClass(/\bclear\b/);
  await expect(owner.locator('.viewer-bar')).not.toHaveAttribute('inert', '');
  expect(await scale(owner)).toBeCloseTo(2, 2); // still zoomed
  await settled(owner);
  await shot(owner, '131-zoomed-buttons');
  // (textBoxes hides the text it measures, so this comes after the screenshot.)
  expect(await contrastFailures(owner, await textBoxes(owner, '.viewer-bar button, .viewer-count'))).toEqual([]);
  await viewer(owner).getByRole('button', { name: 'Set as cover' }).click();
  await expect(viewer(owner)).toHaveCount(0);
  await expect(owner.getByRole('status').filter({ hasText: 'Cover updated' })).toBeVisible();
  // Reopened, it starts at 1×.
  await owner.getByRole('button', { name: /^Open photo 1\b/ }).click();
  expect(await scale(owner)).toBeCloseTo(1, 2);
});

test('a friend’s photos zoom too', async () => {
  await fan.goto(`/u/${ownerName}`);
  await fan.locator('.row', { hasText: 'Zoom Kush' }).click();
  await fan.getByRole('button', { name: /^Open photo 2\b/ }).click();
  await expect(viewer(fan)).toBeVisible();
  const m = await middle(fan);
  await doubleTap(fan, m.x, m.y);
  await settle(fan);
  expect(await scale(fan)).toBeCloseTo(2, 2);
  await expect(viewer(fan)).toHaveClass(/\bclear\b/);
});

test('accessible, zoomed in and out', async () => {
  await open(owner);
  await settled(owner);
  expect((await new AxeBuilder({ page: owner }).include('.viewer').analyze()).violations.map((v) => v.id)).toEqual([]);
  const m = await middle(owner);
  await doubleTap(owner, m.x, m.y);
  await settle(owner);
  expect((await new AxeBuilder({ page: owner }).include('.viewer').analyze()).violations.map((v) => v.id)).toEqual([]);
  // Escape still closes it.
  await owner.keyboard.press('Escape');
  await expect(viewer(owner)).toHaveCount(0);
});
