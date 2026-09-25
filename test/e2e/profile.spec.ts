import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { ExportFile } from '../../shared/domain/backup';
import { shot, signUp } from './helpers';

// Profile photos (D23) and People opening on Following (D24), with three people in
// three browsers: the owner, a follower and a stranger.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page, stranger: Page;
let ownerName: string, fanName: string;

const post = (page: Page, path: string, body: unknown = {}) =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const me = (page: Page) => page.evaluate(async () => ((await (await fetch('/api/auth/me')).json()) as { user: unknown }).user as { username: string; photo?: { version: string; crop: { x: number; y: number; w: number; h: number } } });
const bytes = (page: Page, url: string) => page.evaluate(async (u) => [...new Uint8Array(await (await fetch(u)).arrayBuffer())].join(','), url);

/** A 1200 × 800 JPEG: the left half red, the right half blue, so the framing shows in the result. */
async function halves(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d23c3c';
    ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#3c5ad2';
    ctx.fillRect(600, 0, 600, 800);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1]!;
  });
  return { name: 'halves.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

/** Sets a profile photo straight through the API (a plain green square). */
const apiPhoto = (page: Page, colour: string) =>
  page.evaluate(async (colour) => {
    const c = document.createElement('canvas');
    c.width = c.height = 400;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 400, 400);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    const { upload } = (await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string };
    await fetch('/api/profile/photo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upload, crop: { x: 0, y: 0, w: 1, h: 1, square: true } }) });
    return upload as string;
  }, colour);

/** The avatar image inside `scope`, once it has really loaded. */
async function expectPhoto(scope: ReturnType<Page['locator']>) {
  const img = scope.locator('.av img');
  await expect(img).toHaveCount(1);
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
}
const expectLetter = async (scope: ReturnType<Page['locator']>, letter: string) => {
  await expect(scope.locator('.av img')).toHaveCount(0);
  await expect(scope.locator('.av')).toHaveText(letter);
};

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`);
  return { page, name };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'Olive'));
  ({ page: fan, name: fanName } = await person(browser, 'fern'));
  ({ page: stranger } = await person(browser, 'sid'));
});

test('People opens on Following, with your card at the top inviting a photo (D23, D24)', async () => {
  await owner.getByRole('link', { name: 'People' }).click();
  await expect(owner.getByRole('tab')).toHaveText([/^Following/, /^Followers/, /^Requests/]);
  await expect(owner.getByRole('tab', { name: /Following/ })).toHaveAttribute('aria-selected', 'true');
  const card = owner.locator('.me-card');
  await expect(card.locator('.me-name')).toHaveText(`@${ownerName}`);
  await expect(card).toContainText('0 followers · 0 following');
  await expectLetter(card, 'O');
  await expect(card.getByRole('button', { name: 'Add a photo' })).toBeVisible();
});

test('add a photo: choose it, move and zoom it into the circle, apply', async () => {
  const chooser = owner.waitForEvent('filechooser');
  await owner.getByRole('button', { name: 'Add a profile photo' }).click();
  await (await chooser).setFiles(await halves(owner));

  const dialog = owner.getByRole('dialog', { name: 'Move and zoom' });
  await expect(dialog).toBeVisible();
  const stage = dialog.getByRole('group', { name: 'Photo framing' });
  await expect(stage).toHaveAttribute('data-frame', /.+/);
  const frame = async () => JSON.parse((await stage.getAttribute('data-frame'))!) as { x: number; y: number; w: number; h: number };
  // Starts centred: the short edge (800) fills the circle.
  expect((await frame()).x).toBeCloseTo(200 / 1200, 3);
  await shot(owner, '70-move-and-zoom');
  const { violations } = await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Drag the photo right as far as it goes: the circle now shows its left (red) side.
  const box = (await stage.boundingBox())!;
  await owner.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await owner.mouse.down();
  await owner.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 6 });
  await owner.mouse.up();
  await expect.poll(async () => (await frame()).x).toBe(0);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toHaveCount(0);

  const card = owner.locator('.me-card');
  await expectPhoto(card);
  await expect(card.getByRole('button', { name: 'Change photo' })).toBeVisible();
  // The saved crop is a square in pixels, at the left edge.
  const photo = (await me(owner)).photo!;
  expect(photo.crop.x).toBe(0);
  expect(photo.crop.w * 1200).toBeCloseTo(photo.crop.h * 800, 3);
  // The thumbnail is 320px square and red in the middle (the left of the photo).
  const centre = await card.locator('.av img').evaluate((img: HTMLImageElement) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return { w: img.naturalWidth, h: img.naturalHeight, px: [...ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data] };
  });
  expect([centre.w, centre.h]).toEqual([320, 320]);
  expect(centre.px[0]).toBeGreaterThan(150);
  expect(centre.px[2]).toBeLessThan(100);
  await shot(owner, '71-people-with-photo');
});

test('a follower sees it in their lists and on your Leaderboard; a stranger sees only your letter', async () => {
  await post(fan, `/api/people/u/${ownerName}/follow`);
  await post(owner, `/api/people/requests/${fanName}/approve`);
  await fan.goto('/people');
  await expectPhoto(fan.locator('.prow', { hasText: `@${ownerName}` }));
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.hdr .title')).toContainText(`@${ownerName}`);
  await expectPhoto(fan.locator('.hdr .title'));
  await shot(fan, '72-their-leaderboard-photo');

  await stranger.goto('/people');
  await stranger.getByPlaceholder('Search usernames').fill(ownerName.slice(0, 6).toLowerCase());
  const row = stranger.locator('.prow', { hasText: `@${ownerName}` });
  await expect(row).toBeVisible();
  await expectLetter(row, 'O');
  await row.getByRole('link').click();
  await expect(stranger.getByText('Follow to see their leaderboard.')).toBeVisible();
  await expectLetter(stranger.locator('.stranger'), 'O');
  // Asking to follow reveals nothing until approved.
  await stranger.getByRole('button', { name: 'Follow' }).click();
  await expect(stranger.getByText(/Waiting for/)).toBeVisible();
  await expectLetter(stranger.locator('.stranger'), 'O');
  const status = await stranger.evaluate(async (u) => (await fetch(`/api/people/u/${u}/photo/thumb`)).status, ownerName);
  expect(status).toBe(403);
});

test('Move and zoom again keeps the original; removing asks first', async () => {
  const before = (await me(owner)).photo!;
  const original = await bytes(owner, '/api/profile/photo/original');
  await owner.locator('.me-card').getByRole('button', { name: 'Change your profile photo' }).click();
  const sheet = owner.getByRole('dialog', { name: 'Profile photo' });
  await expect(sheet.getByRole('button')).toHaveText(['Choose a new photo', 'Move and zoom', 'Remove photo', 'Cancel']);
  await sheet.getByRole('button', { name: 'Move and zoom' }).click();

  const dialog = owner.getByRole('dialog', { name: 'Move and zoom' });
  const stage = dialog.getByRole('group', { name: 'Photo framing' });
  // Reopens where it was left.
  await expect.poll(async () => JSON.parse((await stage.getAttribute('data-frame')) ?? '{"x":-1}').x).toBe(0);
  // Pinch out with two fingers: zooms in.
  const zoom = dialog.getByRole('slider', { name: 'Zoom' });
  expect(Number(await zoom.inputValue())).toBeCloseTo(1, 2);
  await stage.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    const ev = (type: string, id: number, px: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: px, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 1, x - 50);
    ev('pointerdown', 2, x + 50);
    ev('pointermove', 2, x + 100);
    ev('pointerup', 1, x - 50);
    ev('pointerup', 2, x + 100);
  });
  expect(Number(await zoom.inputValue())).toBeCloseTo(1.5, 2);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toHaveCount(0);
  const after = (await me(owner)).photo!;
  expect(after.version).not.toBe(before.version);
  expect(after.crop.w).toBeCloseTo(before.crop.w / 1.5, 3);
  expect(await bytes(owner, '/api/profile/photo/original')).toBe(original);
  await expectPhoto(owner.locator('.me-card'));

  await owner.locator('.me-card').getByRole('button', { name: 'Change photo' }).click();
  await owner.getByRole('dialog', { name: 'Profile photo' }).getByRole('button', { name: 'Remove photo' }).click();
  const confirm = owner.getByRole('dialog', { name: 'Remove your profile photo?' });
  await expect(confirm).toContainText('People will see your letter instead.');
  await confirm.getByRole('button', { name: 'Remove photo' }).click();
  await expectLetter(owner.locator('.me-card'), 'O');
  expect((await me(owner)).photo).toBeUndefined();
  await fan.goto('/people');
  await expectLetter(fan.locator('.prow', { hasText: `@${ownerName}` }), 'O');
});

test('within a visit People remembers your last list; a relaunch opens on Following again', async () => {
  await owner.goto('/people');
  await owner.getByRole('tab', { name: /Requests/ }).click();
  await expect(owner.locator('.prow', { hasText: 'sid' })).toBeVisible(); // the stranger's request, with their letter
  await owner.getByRole('link', { name: 'More' }).click();
  await owner.getByRole('link', { name: /People/ }).click();
  await expect(owner.getByRole('tab', { name: /Requests/ })).toHaveAttribute('aria-selected', 'true');
  await owner.reload();
  await expect(owner.getByRole('tab', { name: /Following/ })).toHaveAttribute('aria-selected', 'true');
});

test('export includes the photo; restoring an older file keeps yours, a newer one puts its photo back', async () => {
  const first = await apiPhoto(owner, '#2fb86a');
  await owner.goto('/more/export');
  const download = owner.waitForEvent('download');
  await owner.getByRole('button', { name: 'Export my data' }).click();
  const path = await (await download).path();
  const file = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
  expect(file.profilePhoto!.crop).toEqual({ x: 0, y: 0, w: 1, h: 1, square: true });
  expect(Buffer.from(file.profilePhoto!.original, 'base64').subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

  // A file from before 0.17.0 (no profilePhoto at all) leaves the current photo alone.
  const second = await apiPhoto(owner, '#8a3b6b');
  const older = path.replace(/\.json$|$/, '-old.json');
  const { profilePhoto: _, ...rest } = file;
  writeFileSync(older, JSON.stringify(rest));
  const restore = async (p: string, says: string) => {
    await owner.goto('/more/restore');
    await owner.getByLabel('Choose an export file').setInputFiles(p);
    const contents = owner.getByRole('region', { name: 'File contents' });
    await expect(contents).toContainText(says);
    await contents.getByRole('button', { name: 'Replace my data with this file' }).click();
    await owner.getByRole('dialog').getByRole('button', { name: 'Replace my data' }).click();
    await expect(owner).toHaveURL(/\/$/, { timeout: 20_000 });
  };
  await restore(older, 'Not in this file (yours stays)');
  expect((await me(owner)).photo!.version).toBe(second);

  await restore(path, 'Included');
  const restored = (await me(owner)).photo!;
  expect(restored.version).not.toBe(first); // a fresh copy
  expect(Buffer.from((await bytes(owner, '/api/profile/photo/original')).split(',').map(Number)).toString('base64')).toBe(file.profilePhoto!.original);
  await owner.goto('/people');
  await expectPhoto(owner.locator('.me-card'));
});
