import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { ExportFile } from '../../shared/domain/backup';
import { shot, signUp } from './helpers';

// Remove background (D26). Most tests use a quick stand-in for the AI (anything that
// differs from the photo's border colour is a "thing"); the last test runs the real one.

type Shape = { kind: 'circle'; x: number; y: number; r: number; colour: string } | { kind: 'rect'; x: number; y: number; w: number; h: number; colour: string };

/** A JPEG of simple shapes on a plain background, in fractions of its size. */
async function scene(page: Page, name: string, w: number, h: number, bg: string, shapes: Shape[]) {
  const b64 = await page.evaluate(
    ({ w, h, bg, shapes }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      for (const s of shapes) {
        x.fillStyle = s.colour;
        if (s.kind === 'circle') {
          x.beginPath();
          x.arc(s.x * w, s.y * h, s.r * Math.min(w, h), 0, Math.PI * 2);
          x.fill();
        } else x.fillRect(s.x * w, s.y * h, s.w * w, s.h * h);
      }
      return c.toDataURL('image/jpeg', 0.92).split(',')[1]!;
    },
    { w, h, bg, shapes },
  );
  return { name: `${name}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

// A bud (green circle, bottom right) and a lighter (blue, top left) on a table.
const BUD = { kind: 'circle', x: 0.68, y: 0.62, r: 0.19, colour: '#4f7a2c' } as const;
const twoThings = (page: Page) => scene(page, 'two-things', 1200, 900, '#efe9dc', [BUD, { kind: 'rect', x: 0.1, y: 0.12, w: 0.22, h: 0.18, colour: '#2d56c8' }]);
// A bud lying on a tray: one thing to an AI that keeps the tray too.
const onATray = (page: Page) =>
  scene(page, 'on-a-tray', 1200, 900, '#efe9dc', [
    { kind: 'rect', x: 0.08, y: 0.1, w: 0.84, h: 0.8, colour: '#8e9894' },
    { kind: 'circle', x: 0.5, y: 0.5, r: 0.12, colour: '#4f7a2c' },
  ]);

const fakeAi = (page: Page, delay?: number) =>
  page.addInitScript((d) => {
    (window as unknown as { __gtFakeCutout: boolean }).__gtFakeCutout = true;
    if (d) (window as unknown as { __gtFakeCutoutDelay: number }).__gtFakeCutoutDelay = d;
  }, delay);

async function newProduct(page: Page, name: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto('/products/new');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Add photos').setInputFiles([file]);
  await expect(page.getByText('Uploading…')).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main[data-podium]')).toBeVisible();
  return page.url().split('/products/')[1]!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getJson = (page: Page, path: string): Promise<any> => page.evaluate(async (p) => (await fetch(p)).json(), path);
const product = async (page: Page, id: string) => (await getJson(page, `/api/products/${id}`)).product;

/** A served image: its type, size, and the opacity (0–255) at points given in fractions. */
const inspect = (page: Page, url: string, points: [number, number][]) =>
  page.evaluate(
    async ({ url, points }) => {
      const res = await fetch(url);
      const blob = await res.blob();
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      const alpha = points.map(([fx, fy]) => x.getImageData(Math.min(c.width - 1, Math.floor(fx * c.width)), Math.min(c.height - 1, Math.floor(fy * c.height)), 1, 1).data[3]!);
      return { type: res.headers.get('content-type'), w: img.naturalWidth, h: img.naturalHeight, alpha };
    },
    { url, points },
  );

/** Taps a canvas or image at a point given in fractions of the picture. */
async function tapAt(page: Page, selector: string, fx: number, fy: number) {
  const el = page.locator(selector);
  await expect(el).toBeVisible();
  await page.waitForTimeout(100);
  const b = (await el.boundingBox())!;
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
}

const flow = (page: Page) => page.getByRole('dialog', { name: 'Remove background' });

test('remove the background on a product page: tap the bud, apply, then restore it', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  const id = await newProduct(page, 'Cut test', await twoThings(page));
  const before = (await product(page, id)).photos[0];
  expect(before.cutout).toBe(false);

  // The grid's new button, bottom-left of the photo; Crop stays bottom-right.
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await expect(flow(page)).toBeVisible();
  // Two separate things: the bud and the lighter. Next waits for a choice.
  await expect(flow(page).getByText('Found 2 separate things')).toBeVisible();
  const next = flow(page).getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  expect(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  await shot(page, '90-cutout-pick');
  // Tapping the lighter's empty surroundings far from anything picks nothing; the bud keeps it.
  await tapAt(page, 'canvas.cut-tap', 0.02, 0.98);
  await expect(next).toBeDisabled();
  await tapAt(page, 'canvas.cut-tap', BUD.x, BUD.y);
  await expect(flow(page).getByText('1 of 2')).toBeVisible();
  await next.click();

  // Preview, then Apply saves at once (from a product page, like a crop).
  await expect(flow(page).getByRole('img', { name: 'The cut-out' })).toBeVisible();
  expect(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  await shot(page, '91-cutout-preview');
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(flow(page)).toHaveCount(0);

  const after = (await product(page, id)).photos[0];
  expect(after).toMatchObject({ id: before.id, cutout: true, crop: before.crop });
  expect(after.version).not.toBe(before.version);
  // The cut-out: a transparent PNG, square, framed round the bud (clear corners, solid middle).
  const cut = await inspect(page, `/api/photos/${after.id}/cropped?v=${after.version}`, [[0.02, 0.02], [0.98, 0.98], [0.5, 0.5]]);
  expect(cut.type).toBe('image/png');
  expect(cut.w).toBe(cut.h);
  expect(cut.alpha).toEqual([0, 0, 255]);
  // Framed with the lighter gone: the bud (0.38 of 900px across) with a little room, not the whole photo.
  expect(cut.w).toBeGreaterThan(342 * 1.05);
  expect(cut.w).toBeLessThan(342 * 1.3);
  const thumb = await inspect(page, `/api/photos/${after.id}/thumb?v=${after.version}`, [[0.02, 0.02], [0.5, 0.5]]);
  expect(thumb).toMatchObject({ type: 'image/png', w: 320, h: 320, alpha: [0, 255] });
  // The original is untouched.
  const original = await inspect(page, `/api/photos/${after.id}/original?v=${after.version}`, [[0.02, 0.02]]);
  expect(original).toMatchObject({ type: 'image/jpeg', w: 1200, h: 900, alpha: [255] });

  // Shown without a box: the big photo, the grid (no Remove button now) and the row.
  await expect(page.locator('.hero-photo.cut img')).toBeVisible();
  await expect(page.locator('.pcell.cut')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove background from photo 1' })).toHaveCount(0);
  await shot(page, '92-cutout-product');
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('.row .thumb.cut img')).toBeVisible();
  const box = await page.locator('.row .thumb.cut').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, shadow: getComputedStyle(el).boxShadow }));
  expect(box).toEqual({ bg: 'rgba(0, 0, 0, 0)', shadow: 'none' });
  await shot(page, '93-cutout-row');

  // Restore background, from the viewer: back to the photo as it was (same crop, JPEG).
  await page.locator('.row').first().click();
  await page.locator('.hero-photo').click();
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
  await expect(viewer.getByRole('button', { name: 'Remove background' })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Restore background' }).click();
  await expect(page.locator('.hero-photo:not(.cut) img')).toBeVisible();
  await expect.poll(async () => (await product(page, id)).photos[0].cutout).toBe(false);
  const restored = (await product(page, id)).photos[0];
  expect(restored.crop).toEqual(before.crop);
  expect((await inspect(page, `/api/photos/${restored.id}/cropped?v=${restored.version}`, [[0.02, 0.02]])).type).toBe('image/jpeg');
  await page.locator('.hero-photo').click();
  await expect(page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Remove background' })).toBeVisible();
});

test('a bud lying on a tray: zoom in on it; in the editor it waits for Save', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  const id = await newProduct(page, 'Tray test', await onATray(page));
  await page.getByRole('banner').getByRole('link', { name: 'Edit' }).click();

  // The stand-in AI keeps the tray and the bud as one thing: straight to a preview of both.
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await expect(flow(page).getByRole('img', { name: 'The cut-out' })).toBeVisible();
  const whole = await flow(page).getByRole('img', { name: 'The cut-out' }).evaluate((i) => (i as HTMLImageElement).naturalWidth);
  expect(whole).toBeGreaterThan(900); // the tray is in it
  await flow(page).getByRole('button', { name: 'Not right? Tap the bud in your photo' }).click();
  await expect(flow(page).getByRole('img', { name: 'Your photo. Tap the bud to zoom in on it.' })).toBeVisible();
  await tapAt(page, '.cut-tap', 0.5, 0.5);
  await expect(flow(page).getByRole('heading', { name: 'Preview' })).toBeVisible();
  const zoomed = await flow(page).getByRole('img', { name: 'The cut-out' }).evaluate((i) => (i as HTMLImageElement).naturalWidth);
  // Just the bud now: 0.24 of 900px across, with a little room.
  expect(zoomed).toBeGreaterThan(216 * 1.05);
  expect(zoomed).toBeLessThan(216 * 1.3);
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.pcell.cut')).toHaveCount(1);

  // Cancel the edit: nothing saved.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('main[data-podium]')).toBeVisible();
  expect((await product(page, id)).photos[0].cutout).toBe(false);
  await expect(page.locator('.hero-photo.cut')).toHaveCount(0);

  // Again, then Save.
  await page.getByRole('banner').getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await flow(page).getByRole('button', { name: 'Not right? Tap the bud in your photo' }).click();
  await tapAt(page, '.cut-tap', 0.5, 0.5);
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Uploading…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.hero-photo.cut img')).toBeVisible();
  expect((await product(page, id)).photos[0].cutout).toBe(true);
});

test('a Log entry photo can be cut out, and promotion keeps the cut-out', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  await page.goto('/log/new');
  await page.getByLabel('Name').fill('Loose Cut');
  await page.getByLabel('Add photo').setInputFiles([await twoThings(page)]);
  await expect(page.getByText('Uploading…')).toHaveCount(0, { timeout: 15_000 });
  // Cut out before the entry is even saved (its first set holds the original too).
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await tapAt(page, 'canvas.cut-tap', BUD.x, BUD.y);
  await flow(page).getByRole('button', { name: 'Next' }).click();
  // A Log entry isn't on the Leaderboard, so the preview shows no row.
  await expect(flow(page).locator('.cut-row')).toHaveCount(0);
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Uploading…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.lrow .thumb.cut img')).toBeVisible();
  const { entries } = await getJson(page, '/api/log');
  expect(entries[0].photo.cutout).toBe(true);

  // Add to leaderboard: the photo moves across, still a cut-out.
  await page.locator('.lrow', { hasText: 'Loose Cut' }).click();
  await page.getByRole('button', { name: 'Add to leaderboard' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.hero-photo.cut img')).toBeVisible();
  const id = page.url().split('/products/')[1]!;
  expect((await product(page, id)).photos[0].cutout).toBe(true);
});

test('export and restore keep cut-outs', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  const id = await newProduct(page, 'Export cut', await twoThings(page));
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await tapAt(page, 'canvas.cut-tap', BUD.x, BUD.y);
  await flow(page).getByRole('button', { name: 'Next' }).click();
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.hero-photo.cut')).toBeVisible();
  const version = (await product(page, id)).photos[0].version;

  await page.goto('/more/export');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const path = await (await download).path();
  const json = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
  const ph = json.products[0]!.photos[0]!;
  expect(ph.cutout).toBe(true);
  expect(Buffer.from(ph.cropped, 'base64').subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG
  expect(Buffer.from(ph.original, 'base64').subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff])); // JPEG

  await page.goto('/more/restore');
  await page.getByLabel('Choose an export file').setInputFiles(path);
  await page.getByRole('region', { name: 'File contents' }).getByRole('button', { name: 'Replace my data with this file' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my data' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.locator('.row .thumb.cut img')).toBeVisible();
  const { products } = await getJson(page, '/api/products');
  const back = products[0].photos[0];
  expect(back.cutout).toBe(true);
  expect(back.version).not.toBe(version);
  const cut = await inspect(page, `/api/photos/${back.id}/cropped?v=${back.version}`, [[0.02, 0.02], [0.5, 0.5]]);
  expect(cut).toMatchObject({ type: 'image/png', alpha: [0, 255] });
  expect((await inspect(page, `/api/photos/${back.id}/thumb?v=${back.version}`, [[0.02, 0.02]])).alpha).toEqual([0]);
});

test('Reduce Motion: no sweeping line while it works', async ({ page }) => {
  await fakeAi(page, 1500);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signUp(page);
  await newProduct(page, 'Calm cut', await twoThings(page));
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await expect(flow(page).getByText('Cutting out… about 5 seconds')).toBeVisible();
  expect(await page.locator('.cut-scan.go .cut-line').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(flow(page).getByText('Found 2 separate things')).toBeVisible();
});

test('without Reduce Motion a line sweeps while it works', async ({ page }) => {
  await fakeAi(page, 1500);
  await signUp(page);
  await newProduct(page, 'Sweep cut', await twoThings(page));
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await expect(flow(page).getByText('Cutting out… about 5 seconds')).toBeVisible();
  expect(await page.locator('.cut-scan.go .cut-line').evaluate((el) => getComputedStyle(el).animationName)).toBe('cut-sweep');
  await shot(page, '94-cutout-cutting');
});

test('the real AI: asks before downloading, keeps it on the phone, and cuts out a bud', async ({ page }) => {
  test.setTimeout(240_000);
  const csp: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy|wasm/i.test(m.text()) && csp.push(m.text()));
  await signUp(page);
  // A bud-like thing: a textured green clump with a shadow on a wooden table.
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const x = c.getContext('2d')!;
    for (let y = 0; y < 1200; y += 6) {
      x.fillStyle = `hsl(30, 45%, ${58 + 6 * Math.sin(y / 23) + 3 * Math.sin(y / 5)}%)`;
      x.fillRect(0, y, 900, 6);
    }
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.beginPath();
    x.ellipse(470, 700, 230, 290, 0, 0, Math.PI * 2);
    x.fill();
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      const px = 450 + Math.cos(a) * r * 200;
      const py = 660 + Math.sin(a) * r * 270;
      x.fillStyle = `hsl(${85 + rnd() * 30}, ${35 + rnd() * 30}%, ${22 + rnd() * 28}%)`;
      x.beginPath();
      x.arc(px, py, 6 + rnd() * 14, 0, Math.PI * 2);
      x.fill();
      if (i % 9 === 0) {
        x.fillStyle = `hsl(${20 + rnd() * 15}, 70%, 45%)`;
        x.fillRect(px, py, 2, 8 + rnd() * 10);
      }
    }
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  });
  const id = await newProduct(page, 'Real cut', { name: 'bud.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });

  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  // First time on this phone: it asks before downloading.
  const ask = page.getByRole('dialog', { name: 'Download the background remover?' });
  await expect(ask).toBeVisible();
  await shot(page, '95-cutout-ask');
  await ask.getByRole('button', { name: 'Download and continue' }).click();
  await expect(flow(page).getByRole('progressbar', { name: 'Downloading' })).toBeVisible();
  // The screen keeps moving while the AI works in its worker.
  await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[] };
    w.__gaps = [];
    let last = performance.now();
    const tick = (t: number) => {
      w.__gaps.push(t - last);
      last = t;
      if (document.querySelector('.cutflow')) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await expect(flow(page)).toHaveAttribute('data-stage', /^(pick|preview)$/, { timeout: 180_000 });
  const stage = await flow(page).getAttribute('data-stage');
  if (stage === 'pick') {
    await tapAt(page, 'canvas.cut-tap', 0.5, 0.55);
    await flow(page).getByRole('button', { name: 'Next' }).click();
  }
  await expect(flow(page).getByRole('img', { name: 'The cut-out' })).toBeVisible();
  const gaps = await page.evaluate(() => (window as unknown as { __gaps: number[] }).__gaps);
  console.log(`real AI: ${gaps.length} frames, longest pause ${Math.round(Math.max(...gaps))}ms`);
  // Like the other motion tests: the screen is never frozen for more than 0.6s (measured here: up to 0.42s, three at once).
  expect(Math.max(...gaps)).toBeLessThan(600);
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(flow(page)).toHaveCount(0);

  const photo = (await product(page, id)).photos[0];
  expect(photo.cutout).toBe(true);
  const cut = await inspect(page, `/api/photos/${photo.id}/cropped?v=${photo.version}`, [[0.02, 0.02], [0.98, 0.02], [0.5, 0.5]]);
  expect(cut.type).toBe('image/png');
  expect(cut.alpha[0]).toBeLessThan(20);
  expect(cut.alpha[1]).toBeLessThan(20);
  expect(cut.alpha[2]).toBeGreaterThan(200);
  // Framed round the clump (about 400 × 540 of the 900 × 1200 photo), not the whole table.
  expect(cut.w).toBeGreaterThan(450);
  expect(cut.w).toBeLessThan(900);

  // Kept on the phone in its own cache: the next time, no question and no download.
  const kept = await page.evaluate(async () => {
    const names = await caches.keys();
    const ai = names.find((n) => n.startsWith('gt-ai-'));
    return { ai, files: ai ? (await (await caches.open(ai)).keys()).map((r) => new URL(r.url).pathname).sort() : [] };
  });
  expect(kept.ai).toBe('gt-ai-isnet-bud-6045f463');
  expect(kept.files).toEqual([...[0, 1, 2, 3].map((i) => `/ai/isnet-bud-6045f463.part${i}.bin`), '/ai/ort-wasm-simd-1.17.3.wasm']);
  await page.locator('.hero-photo').click();
  await page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Restore background' }).click();
  await expect(page.locator('.hero-photo:not(.cut) img')).toBeVisible();
  await page.getByRole('button', { name: 'Remove background from photo 1' }).click();
  await expect(flow(page)).toHaveAttribute('data-stage', /^(loading|cutting|pick|preview)$/);
  await expect(page.getByRole('dialog', { name: 'Download the background remover?' })).toHaveCount(0);
  expect(csp).toEqual([]);
});
