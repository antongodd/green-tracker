import { expect, test, type Page } from '@playwright/test';
import { shot, signUp } from './helpers';

/** A real JPEG made in the browser: a gradient with a label, so crops are visible in screenshots. */
async function makeJpeg(page: Page, w: number, h: number, colours: [string, string], label: string) {
  const b64 = await page.evaluate(
    ({ w, h, colours, label }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, colours[0]);
      g.addColorStop(1, colours[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(h / 6)}px sans-serif`;
      ctx.fillText(label, w * 0.1, h * 0.55);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1]!;
    },
    { w, h, colours, label },
  );
  return { name: `${label}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

/** Natural size of an image URL, as the browser decodes it. */
const naturalSize = (page: Page, url: string) =>
  page.evaluate(async (u) => {
    const img = new Image();
    img.src = u;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, url);

const photoUrls = (page: Page, variant: string) =>
  page.locator('.pgrid .pcell img').evaluateAll((imgs, v) => imgs.map((i) => (i as HTMLImageElement).src.replace('/thumb?', `/${v}?`)), variant);

test('add, view, crop, reset and remove photos; editor crops wait for Save', async ({ page }) => {
  await signUp(page);
  await page.goto('/products/new');
  await page.getByLabel('Name').fill('Photo test');

  // Add two photos at once.
  const land = await makeJpeg(page, 2000, 1200, ['#2f6b3a', '#b9d36c'], 'LANDSCAPE');
  const port = await makeJpeg(page, 900, 1400, ['#3b2a6b', '#e2b760'], 'PORTRAIT');
  await page.getByLabel('Add photos').setInputFiles([land, port]);
  await expect(page.locator('.pgrid .pcell')).toHaveCount(2);
  await expect(page.getByText('Uploading…')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save' }).click();

  // Profile: hero is the first photo; the grid shows both.
  await expect(page.getByRole('heading', { name: 'Photo Test' })).toBeVisible();
  await expect(page.locator('.hero-photo img')).toBeVisible();
  await expect(page.locator('.pgrid .pcell')).toHaveCount(2);

  // Resized on the way in: 1600px long edge; thumbnails ~320px on the short edge.
  const [orig1, orig2] = await photoUrls(page, 'original');
  expect(await naturalSize(page, orig1!)).toEqual({ w: 1600, h: 960 });
  expect(await naturalSize(page, orig2!)).toEqual({ w: 900, h: 1400 }); // already within 1600
  const [thumb1] = await photoUrls(page, 'thumb');
  const t = await naturalSize(page, thumb1!);
  expect(Math.min(t.w, t.h)).toBe(320);

  // The Leaderboard row uses the first photo's thumbnail.
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('.row .thumb img')).toHaveAttribute('src', /\/thumb\?v=/);
  await page.locator('.row').first().click();

  // Viewer: opens on tap, covers everything, swipes between photos.
  await page.locator('.hero-photo').click();
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
  await expect(viewer.getByText('1 / 2')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(viewer.getByText('2 / 2')).toBeVisible();
  await page.waitForTimeout(500); // let the swipe settle for the screenshot
  await shot(page, '30-viewer');

  // Crop the portrait square from the viewer: saved straight away from the profile.
  await viewer.getByRole('button', { name: 'Crop this photo' }).click();
  const cropper = page.getByRole('dialog', { name: 'Crop photo' });
  await cropper.getByRole('radio', { name: 'Square' }).click();
  await shot(page, '31-cropper');
  await cropper.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Saving crop…')).toHaveCount(0, { timeout: 15_000 });
  const [, cropped2] = await photoUrls(page, 'cropped');
  const c2 = await naturalSize(page, cropped2!);
  expect(c2.w).toBe(c2.h);
  expect(c2.w).toBe(900); // the largest square in a 900×1400 original
  await page.reload();
  await expect(page.locator('.pgrid .pcell')).toHaveCount(2);
  expect(await naturalSize(page, (await photoUrls(page, 'cropped'))[1]!)).toEqual({ w: 900, h: 900 });

  // Reset to original from the profile.
  await page.getByRole('button', { name: 'Crop photo 2' }).click();
  await cropper.getByRole('button', { name: 'Reset to original' }).click();
  await cropper.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Saving crop…')).toHaveCount(0, { timeout: 15_000 });
  expect(await naturalSize(page, (await photoUrls(page, 'cropped'))[1]!)).toEqual({ w: 900, h: 1400 });

  // In the editor, a crop is only a draft: Cancel throws it away.
  const before = await photoUrls(page, 'cropped');
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByRole('button', { name: 'Crop photo 1' }).click();
  await cropper.getByRole('radio', { name: 'Square' }).click();
  await cropper.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Uploading…')).toHaveCount(0, { timeout: 15_000 });
  // Regression: overlay buttons inside the editor's form must not submit it.
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await photoUrls(page, 'cropped')).toEqual(before);
  expect(await naturalSize(page, before[0]!)).toEqual({ w: 1600, h: 960 });

  // …and Save commits it. Remove the second photo in the same edit.
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByRole('button', { name: 'Crop photo 1' }).click();
  await cropper.getByRole('radio', { name: 'Square' }).click();
  await cropper.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Uploading…')).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Open photo 2' }).click();
  await page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.locator('.pgrid .pcell')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await expect(page.locator('.pgrid .pcell')).toHaveCount(1);
  expect(await naturalSize(page, (await photoUrls(page, 'cropped'))[0]!)).toEqual({ w: 960, h: 960 });
  await shot(page, '32-profile-photos');
});
