import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Choosing the cover photo (D52, 0.44.0). A product's first photo is its cover: a gold ring
// and a star in the grid. From the product page, open a photo and tap Set as cover (saved at
// once; the big photo fades over). In the editor, ⋯ on a photo (Set as cover, Crop, Remove
// background, Remove photo), or press and hold a photo and drag it; Save keeps the order.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
let id: string;
const colours = ['#7d5a36', '#2c3a5a', '#5a2c4a'];

const post = (page: Page, path: string, body?: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(), { path, body });
const getJson = (page: Page, path: string): Promise<any> => page.evaluate(async (p) => (await fetch(p)).json(), path);
/** A photo drawn in the page in one colour, uploaded as a pending set. */
const upload = (page: Page, colour: string) =>
  page.evaluate(async (colour) => {
    const c = document.createElement('canvas');
    [c.width, c.height] = [800, 600];
    const x = c.getContext('2d')!;
    x.fillStyle = colour;
    x.fillRect(0, 0, 800, 600);
    const img = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);
/** The product's photo ids, in order (the first is the cover). */
const order = async (page: Page = owner): Promise<string[]> => (await getJson(page, `/api/products/${id}`)).product.photos.map((p: { id: string }) => p.id);
/** The grid's photos as their ids, in the order shown. */
const shown = (page: Page) => page.locator('.pgrid .pcell img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src.match(/photos\/([^/]+)\//)![1]!));
const viewer = (page: Page) => page.getByRole('dialog', { name: 'Photo viewer' });
const toolbar = (page: Page) => viewer(page).locator('.viewer-bar').getByRole('button');

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'cov'));
  ({ page: fan, name: fanName } = await person(browser, 'fan'));
  const photos = [];
  for (const c of colours) photos.push({ upload: await upload(owner, c), crop: null });
  const input: ProductInput = { ...emptyProductInput(), name: 'Gelato 41', country: 'US', ratings: { look: 9, smell: 9, taste: 9, burn: 9 }, photos };
  id = (await post(owner, '/api/products', input)).product.id;
  await post(fan, `/api/people/u/${ownerName}/follow`);
  await post(owner, `/api/people/requests/${fanName}/approve`);
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

test('the cover is first, with a gold ring and a star; the product page has no buttons on its photos', async () => {
  await owner.goto(`/products/${id}`);
  await expect(owner.locator('.pgrid .pcell')).toHaveCount(3);
  const ids = await order();
  expect(await shown(owner)).toEqual(ids);
  await expect(owner.locator('.pslot').first()).toHaveClass(/\bcover\b/);
  await expect(owner.locator('.pslot.cover')).toHaveCount(1);
  await expect(owner.locator('.pslot.cover .cover-star svg')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Open photo 1, the cover' })).toBeVisible();
  // The old round Crop and Remove background buttons are gone; no ⋯ outside the editor.
  await expect(owner.locator('.pgrid').getByRole('button')).toHaveCount(3);
  // The ring is gold all round, the star gold on its dark disc.
  const ring = await owner.locator('.pslot.cover .pcell').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toContain('rgb(255, 211, 107)');
  await owner.locator('.pgrid').scrollIntoViewIfNeeded();
  await settled(owner);
  await shot(owner, '120-cover-grid');
});

test('the viewer’s bar: Set as cover, Crop, Cut out; the cover itself says so', async () => {
  await owner.getByRole('button', { name: 'Open photo 1, the cover' }).click();
  await expect(toolbar(owner)).toHaveText(['The cover', 'Crop', 'Cut out']);
  await expect(toolbar(owner).first()).toBeDisabled();
  await owner.keyboard.press('ArrowRight');
  await expect(viewer(owner).getByText('2 / 3')).toBeVisible();
  await expect(toolbar(owner)).toHaveText(['Set as cover', 'Crop', 'Cut out']);
  await settled(owner);
  const a11y = await new AxeBuilder({ page: owner }).include('.viewer').analyze();
  expect(a11y.violations.map((v) => v.id)).toEqual([]);
  await shot(owner, '121-cover-viewer');
  await owner.keyboard.press('Escape');
});

test('Set as cover from the product page saves at once: the big photo, the grid and the Leaderboard row follow', async () => {
  const [first, second, third] = await order();
  await owner.getByRole('button', { name: 'Open photo 3' }).click();
  await viewer(owner).getByRole('button', { name: 'Set as cover' }).click();
  await expect(viewer(owner)).toHaveCount(0);
  await expect(owner.getByRole('status').filter({ hasText: 'Cover updated' })).toBeVisible();
  expect(await order()).toEqual([third, first, second]);
  await expect.poll(() => shown(owner)).toEqual([third, first, second]);
  await expect(owner.locator('.hero-photo > img:not(.hero-old)')).toHaveAttribute('src', new RegExp(`/photos/${third}/`));
  // The old cover fades out over the new one, then goes.
  await expect(owner.locator('.hero-old')).toHaveCount(0);
  await owner.reload();
  await expect.poll(() => shown(owner)).toEqual([third, first, second]);
  await owner.getByRole('link', { name: 'Back' }).click();
  await expect(owner.locator('.row', { hasText: 'Gelato 41' }).locator('.thumb img')).toHaveAttribute('src', new RegExp(`/photos/${third}/`));
});

test('in the editor: ⋯ offers Set as cover, Crop, Remove background and Remove photo; Cancel keeps the old cover', async () => {
  const before = await order();
  await owner.goto(`/products/${id}/edit`);
  await expect(owner.getByRole('button', { name: /^Options for photo/ })).toHaveCount(3);
  await owner.getByRole('button', { name: 'Options for photo 2' }).click();
  const sheet = owner.locator('.sheet');
  await expect(sheet.locator('.opt')).toHaveText(['Set as cover', 'Crop', 'Remove background', 'Remove photo', 'Cancel']);
  await settled(owner);
  await shot(owner, '122-cover-menu');
  await sheet.getByRole('button', { name: 'Set as cover' }).click();
  await expect.poll(() => shown(owner)).toEqual([before[1], before[0], before[2]]);
  await expect(owner.locator('.pslot').first()).toHaveClass(/\bcover\b/);
  // The cover's own menu has no Set as cover.
  await owner.getByRole('button', { name: 'Options for photo 1' }).click();
  await expect(sheet.locator('.opt')).toHaveText(['Crop', 'Remove background', 'Remove photo', 'Cancel']);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await owner.getByRole('button', { name: 'Cancel' }).click();
  expect(await order()).toEqual(before);
});

test('in the editor: press and hold a photo, drag it to the front, and Save makes it the cover', async () => {
  const [a, b, c] = await order();
  await owner.goto(`/products/${id}/edit`);
  await expect(owner.locator('.pgrid .pcell')).toHaveCount(3);
  await owner.locator('.pgrid').scrollIntoViewIfNeeded();
  const box = async (n: number) => (await owner.locator('.pslot').nth(n).boundingBox())!;
  const from = await box(2);
  const to = await box(0);
  await owner.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await owner.mouse.down();
  await owner.waitForTimeout(450); // held: it lifts
  await expect(owner.locator('.pslot.lifted')).toHaveCount(1);
  await owner.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await expect.poll(() => shown(owner)).toEqual([c, a, b]);
  await shot(owner, '123-cover-drag');
  await owner.mouse.up();
  await expect(owner.locator('.pslot.lifted')).toHaveCount(0);
  await expect(viewer(owner)).toHaveCount(0); // a drag isn't a tap
  await expect(owner.locator('.pslot').first()).toHaveClass(/\bcover\b/);
  // A quick tap still opens the photo.
  await owner.getByRole('button', { name: 'Open photo 2' }).click();
  await expect(viewer(owner)).toBeVisible();
  await expect(toolbar(owner)).toHaveText(['Set as cover', 'Crop', 'Cut out', 'Remove']);
  await owner.keyboard.press('Escape');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner).not.toHaveURL(/\/edit$/);
  expect(await order()).toEqual([c, a, b]);
});

test('removing the cover in the editor makes the next photo the cover', async () => {
  const [a, b, c] = await order();
  await owner.goto(`/products/${id}/edit`);
  await owner.getByRole('button', { name: 'Options for photo 1' }).click();
  await owner.locator('.sheet').getByRole('button', { name: 'Remove photo' }).click();
  await expect(owner.locator('.pgrid .pcell')).toHaveCount(2);
  await expect(owner.getByRole('button', { name: 'Open photo 1, the cover' })).toBeVisible();
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner).not.toHaveURL(/\/edit$/);
  expect(await order()).toEqual([b, c]);
  void a;
});

test('a friend sees the cover marked, and only looks: no ⋯, no bar in the viewer', async () => {
  const [cover] = await order();
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row', { hasText: 'Gelato 41' }).locator('.thumb img')).toHaveAttribute('src', new RegExp(`/photos/${cover}/`));
  await fan.locator('.row', { hasText: 'Gelato 41' }).click();
  await expect(fan.locator('.pgrid .pcell')).toHaveCount(2);
  await expect(fan.locator('.pslot').first()).toHaveClass(/\bcover\b/);
  await expect(fan.getByRole('button', { name: /^Options for photo/ })).toHaveCount(0);
  await fan.getByRole('button', { name: 'Open photo 2' }).click();
  await expect(viewer(fan)).toBeVisible();
  await expect(viewer(fan).locator('.viewer-bar')).toHaveCount(0);
});

test('a Log entry’s photo: ⋯ without Set as cover, and no star', async () => {
  const entry = (await post(owner, '/api/log', { ...emptyLogEntryInput(), name: 'Loose One', photos: [{ upload: await upload(owner, '#3a6a3a'), crop: null }] })).entry;
  await owner.goto(`/log/${entry.id}/edit`);
  await expect(owner.locator('.pslot.cover')).toHaveCount(0);
  await owner.getByRole('button', { name: 'Options for photo 1' }).click();
  await expect(owner.locator('.sheet .opt')).toHaveText(['Crop', 'Remove background', 'Remove photo', 'Cancel']);
  await owner.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await owner.getByRole('button', { name: 'Open photo 1' }).click();
  await expect(toolbar(owner)).toHaveText(['Crop', 'Cut out', 'Remove']);
});

test('readable and accessible: the grid, the menu and the viewer’s bar', async () => {
  await owner.goto(`/products/${id}/edit`);
  await expect(owner.locator('.pgrid .pcell')).toHaveCount(2);
  await owner.locator('.pgrid').scrollIntoViewIfNeeded();
  await settled(owner);
  expect((await new AxeBuilder({ page: owner }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await owner.getByRole('button', { name: 'Options for photo 2' }).click();
  await settled(owner);
  expect((await new AxeBuilder({ page: owner }).analyze()).violations.map((v) => v.id)).toEqual([]);
  expect(await contrastFailures(owner, await textBoxes(owner, '.sheet .opt, .sheet .ttl strong'))).toEqual([]);
  await owner.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await owner.getByRole('button', { name: 'Open photo 2' }).click();
  await settled(owner);
  expect(await contrastFailures(owner, await textBoxes(owner, '.viewer-bar button'))).toEqual([]);
  // Every button in the bar is at least 44 points tall and wide enough to tap.
  for (const b of await toolbar(owner).all()) {
    const r = (await b.boundingBox())!;
    expect(r.height).toBeGreaterThanOrEqual(44);
    expect(r.width).toBeGreaterThanOrEqual(44);
  }
});
