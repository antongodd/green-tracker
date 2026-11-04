import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { settled, shot, signUp } from './helpers';

// A row's photo opens it full screen (D79, Anton: "if the user clicks on the area of the photo it should
// take them straight into viewing the photo"). Your Leaderboard, Archive and Log: the product's photos from
// its cover, with the product page's bar; a Log entry's own photo with none. A friend's board: their shared
// photos, no bar. Anywhere else on a row, and a row with no photo, opens its page as before.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
let id: string, plainId: string, entryId: string;
const colours = ['#7d5a36', '#2c3a5a', '#5a2c4a'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );
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
const order = async (): Promise<string[]> => (await call(owner, 'GET', `/api/products/${id}`)).product.photos.map((p: { id: string }) => p.id);
const viewer = (page: Page) => page.getByRole('dialog', { name: 'Photo viewer' });
const toolbar = (page: Page) => viewer(page).locator('.viewer-bar').getByRole('button');
const row = (page: Page, name: string) => page.locator('a.row', { hasText: name });
const lrow = (page: Page, name: string) => page.locator('a.lrow', { hasText: name });
/** Taps a row's photo where a thumb would land on it: its middle. */
const tapPhoto = async (r: ReturnType<Page['locator']>) => {
  await r.locator('.thumb').scrollIntoViewIfNeeded();
  await r.locator('.thumb').click();
};

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  // Random as well as the time: repeated runs start several copies in the same millisecond.
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'rph'));
  ({ page: fan, name: fanName } = await person(browser, 'rfan'));
  const photos = [];
  for (const c of colours) photos.push({ upload: await upload(owner, c), crop: null });
  const input: ProductInput = { ...emptyProductInput(), name: 'Gelato 41', country: 'US', ratings: { look: 9, smell: 9, taste: 9, burn: 9 }, photos };
  id = (await call(owner, 'POST', '/api/products', input)).product.id;
  plainId = (await call(owner, 'POST', '/api/products', { ...emptyProductInput(), name: 'Bare Kush', country: 'US', ratings: { look: 7 } })).product.id;
  entryId = (await call(owner, 'POST', '/api/log', { ...emptyLogEntryInput(), name: 'Loose One', photos: [{ upload: await upload(owner, '#3a6a3a'), crop: null }] })).entry.id;
  await call(fan, 'POST', `/api/people/u/${ownerName}/follow`);
  await call(owner, 'POST', `/api/people/requests/${fanName}/approve`);
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

test('Leaderboard: the photo opens the viewer on the cover, with every photo and the product page’s bar', async () => {
  await owner.goto('/');
  await expect(row(owner, 'Gelato 41').locator('.thumb img')).toBeVisible();
  await tapPhoto(row(owner, 'Gelato 41'));
  await expect(viewer(owner)).toBeVisible();
  await expect(owner).toHaveURL(/\/$/);
  await expect(viewer(owner).getByText('1 / 3')).toBeVisible();
  await expect(toolbar(owner)).toHaveText(['The cover', 'Crop', 'Cut out']);
  await owner.keyboard.press('ArrowRight');
  await owner.keyboard.press('ArrowRight');
  await expect(viewer(owner).getByText('3 / 3')).toBeVisible();
  await settled(owner);
  await shot(owner, '190-rowphotos-viewer');
  await viewer(owner).getByRole('button', { name: 'Close' }).click();
  await expect(viewer(owner)).toHaveCount(0);
  await expect(owner).toHaveURL(/\/$/);
});

test('Leaderboard: Set as cover from the row saves at once, and the row shows the new cover', async () => {
  const [a, b, c] = await order();
  await tapPhoto(row(owner, 'Gelato 41'));
  await owner.keyboard.press('ArrowRight');
  await expect(viewer(owner).getByText('2 / 3')).toBeVisible();
  await viewer(owner).getByRole('button', { name: 'Set as cover' }).click();
  await expect(viewer(owner)).toHaveCount(0);
  await expect(owner.getByRole('status').filter({ hasText: 'Cover updated' })).toBeVisible();
  expect(await order()).toEqual([b, a, c]);
  await expect(row(owner, 'Gelato 41').locator('.thumb img')).toHaveAttribute('src', new RegExp(`/photos/${b}/`));
  // The note goes; the list is still the list.
  await expect(owner.getByRole('status').filter({ hasText: 'Cover updated' })).toHaveCount(0);
  await expect(owner).toHaveURL(/\/$/);
});

test('Leaderboard: Crop from the row opens the cropper; Cancel goes back to the list', async () => {
  await tapPhoto(row(owner, 'Gelato 41'));
  await viewer(owner).getByRole('button', { name: 'Crop' }).click();
  const cropper = owner.getByRole('dialog', { name: 'Crop photo' });
  await expect(cropper).toBeVisible();
  await cropper.getByRole('button', { name: 'Cancel' }).click();
  await expect(cropper).toHaveCount(0);
  await expect(viewer(owner)).toHaveCount(0);
  await expect(owner).toHaveURL(/\/$/);
});

test('Leaderboard: the rest of the row opens the page; a row with no photo opens the page from its picture too', async () => {
  await row(owner, 'Gelato 41').locator('.name').click();
  await expect(owner).toHaveURL(new RegExp(`/products/${id}$`));
  await owner.goto('/');
  await tapPhoto(row(owner, 'Bare Kush'));
  await expect(owner).toHaveURL(new RegExp(`/products/${plainId}$`));
  await expect(viewer(owner)).toHaveCount(0);
});

test('Leaderboard: rows sit as before (8px apart), VoiceOver gets "Photos of …", and axe finds nothing', async () => {
  await owner.goto('/');
  await expect(row(owner, 'Bare Kush')).toBeVisible();
  const boxes = await owner.locator('.rows > a.row').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })));
  expect(boxes.length).toBe(2);
  expect(Math.round(boxes[1]!.top - boxes[0]!.bottom)).toBe(10); // 10 since D87
  // One hidden button for the row with photos, none for the row without.
  await expect(owner.getByRole('button', { name: 'Photos of Gelato 41' })).toHaveCount(1);
  await expect(owner.getByRole('button', { name: 'Photos of Bare Kush' })).toHaveCount(0);
  // Hidden from sight, so pressed as VoiceOver and a keyboard would.
  await owner.getByRole('button', { name: 'Photos of Gelato 41' }).focus();
  await owner.keyboard.press('Enter');
  await expect(viewer(owner)).toBeVisible();
  await viewer(owner).getByRole('button', { name: 'Close' }).click();
  await settled(owner);
  const a11y = await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a11y.violations.map((v) => v.id)).toEqual([]);
});

test('Log: a product’s photo opens its photos with the bar; a Log entry’s opens its one photo with none', async () => {
  await owner.goto('/log');
  await tapPhoto(lrow(owner, 'Gelato 41'));
  await expect(viewer(owner).getByText('1 / 3')).toBeVisible();
  await expect(toolbar(owner)).toHaveText(['The cover', 'Crop', 'Cut out']);
  await viewer(owner).getByRole('button', { name: 'Close' }).click();
  await tapPhoto(lrow(owner, 'Loose One'));
  await expect(viewer(owner)).toBeVisible();
  await expect(viewer(owner).locator('.viewer-bar')).toHaveCount(0);
  await expect(viewer(owner).getByText('1 / 1')).toHaveCount(0);
  await expect(owner).toHaveURL(/\/log$/);
  await viewer(owner).getByRole('button', { name: 'Close' }).click();
  // The rest of the row still opens the entry; a product with no photo opens from its picture.
  await lrow(owner, 'Loose One').locator('.name').click();
  await expect(owner).toHaveURL(new RegExp(`/log/${entryId}$`));
  await owner.goto('/log');
  await tapPhoto(lrow(owner, 'Bare Kush'));
  await expect(owner).toHaveURL(new RegExp(`/products/${plainId}$`));
  await owner.goto('/log');
  await expect(lrow(owner, 'Bare Kush')).toBeVisible();
  await settled(owner);
  const a11y = await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a11y.violations.map((v) => v.id)).toEqual([]);
});

test('A friend’s board: their shared photos, no bar; with Photos off, the row opens their page', async () => {
  await fan.goto(`/u/${ownerName}`);
  await tapPhoto(row(fan, 'Gelato 41'));
  await expect(viewer(fan).getByText('1 / 3')).toBeVisible();
  await expect(viewer(fan).locator('.viewer-bar')).toHaveCount(0);
  await expect(fan).toHaveURL(new RegExp(`/u/${ownerName}$`));
  await settled(fan);
  await shot(fan, '191-rowphotos-friend');
  await viewer(fan).getByRole('button', { name: 'Close' }).click();
  // Their Privacy stops sharing photos: no photo on the row, and its picture opens the page.
  const { privacy } = await call(owner, 'GET', '/api/privacy');
  await call(owner, 'PUT', '/api/privacy', { ...privacy, sharePhotos: false });
  await fan.reload();
  await expect(row(fan, 'Gelato 41')).toBeVisible();
  await expect(row(fan, 'Gelato 41').locator('.thumb img')).toHaveCount(0);
  await expect(fan.getByRole('button', { name: /^Photos of/ })).toHaveCount(0);
  await tapPhoto(row(fan, 'Gelato 41'));
  await expect(fan).toHaveURL(new RegExp(`/u/${ownerName}/p/${id}$`));
  await call(owner, 'PUT', '/api/privacy', { ...privacy, sharePhotos: true });
});

test('Archive: the photo opens the viewer with the bar, as on the Leaderboard', async () => {
  await call(owner, 'POST', `/api/products/${id}/archived`, { value: true });
  await owner.goto('/more/archive');
  await tapPhoto(row(owner, 'Gelato 41'));
  await expect(viewer(owner).getByText('1 / 3')).toBeVisible();
  await expect(toolbar(owner)).toHaveText(['The cover', 'Crop', 'Cut out']);
  await viewer(owner).getByRole('button', { name: 'Close' }).click();
  await expect(owner).toHaveURL(/\/more\/archive$/);
  await call(owner, 'POST', `/api/products/${id}/archived`, { value: false });
});
