import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { ExportFile } from '../../shared/domain/backup';
import { contrastFailures, photoAction, settled, shot, signUp, textBoxes } from './helpers';

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
  await expect(page.locator('main[data-band]')).toBeVisible();
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

  // From the viewer's bar (D52: the grid's own buttons went).
  await photoAction(page, 1, 'Cut out');
  await expect(flow(page)).toBeVisible();
  // Two separate things: the bud and the lighter. Next waits for a choice.
  await expect(flow(page).getByText('Found 2 separate things')).toBeVisible();
  const next = flow(page).getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await settled(page);
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
  // …and on a top row in the top colour of your preset (D48).
  await expect(flow(page).locator('.cut-row')).toHaveClass(/\btier band4 pal-gems\b/);
  await settled(page);
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

  // Shown without a box: the big photo, the grid and the row.
  await expect(page.locator('.hero-photo.cut img')).toBeVisible();
  await expect(page.locator('.pcell.cut')).toHaveCount(1);
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
  await expect(viewer.getByRole('button', { name: 'Cut out' })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Restore background' }).click();
  // Failed once on GitHub (PR #74) and never here: if it fails again, say what the screen showed.
  await expect(page.locator('.hero-photo:not(.cut) img'))
    .toBeVisible()
    .catch(async (e) => {
      const shown = await page.evaluate(() => ({
        url: location.pathname,
        hero: document.querySelector('.hero-photo')?.className ?? 'none',
        notes: [...document.querySelectorAll('.error, .sect .small, [role="dialog"]')].map((el) => `${el.className}: ${el.textContent?.slice(0, 120)}`),
      }));
      throw new Error(`${(e as Error).message}\nOn screen: ${JSON.stringify(shown)}`);
    });
  await expect.poll(async () => (await product(page, id)).photos[0].cutout).toBe(false);
  const restored = (await product(page, id)).photos[0];
  expect(restored.crop).toEqual(before.crop);
  expect((await inspect(page, `/api/photos/${restored.id}/cropped?v=${restored.version}`, [[0.02, 0.02]])).type).toBe('image/jpeg');
  await page.locator('.hero-photo').click();
  await expect(page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Cut out' })).toBeVisible();
});

test('a bud lying on a tray: zoom in on it; in the editor it waits for Save', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  const id = await newProduct(page, 'Tray test', await onATray(page));
  await page.getByRole('banner').getByRole('link', { name: 'Edit' }).click();

  // The stand-in AI keeps the tray and the bud as one thing: straight to a preview of both.
  await photoAction(page, 1, 'Cut out');
  await expect(flow(page).getByRole('img', { name: 'The cut-out' })).toBeVisible();
  const whole = await flow(page).getByRole('img', { name: 'The cut-out' }).evaluate((i) => (i as HTMLImageElement).naturalWidth);
  expect(whole).toBeGreaterThan(900); // the tray is in it
  await flow(page).getByRole('button', { name: 'Or tap the bud in your photo' }).click();
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
  await expect(page.locator('main[data-band]')).toBeVisible();
  expect((await product(page, id)).photos[0].cutout).toBe(false);
  await expect(page.locator('.hero-photo.cut')).toHaveCount(0);

  // Again, then Save.
  await page.getByRole('banner').getByRole('link', { name: 'Edit' }).click();
  await photoAction(page, 1, 'Cut out');
  await flow(page).getByRole('button', { name: 'Or tap the bud in your photo' }).click();
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
  await photoAction(page, 1, 'Cut out');
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
  await photoAction(page, 1, 'Cut out');
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
  await expect(page.getByRole('region', { name: 'File contents' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace my data with this file' }).click(); // below the card since D40
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
  await photoAction(page, 1, 'Cut out');
  await expect(flow(page).getByText('Cutting out… about 5 seconds')).toBeVisible();
  expect(await page.locator('.cut-scan.go .cut-line').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(flow(page).getByText('Found 2 separate things')).toBeVisible();
});

test('without Reduce Motion a line sweeps while it works', async ({ page }) => {
  await fakeAi(page, 1500);
  await signUp(page);
  await newProduct(page, 'Sweep cut', await twoThings(page));
  await photoAction(page, 1, 'Cut out');
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

  await photoAction(page, 1, 'Cut out');
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
  await photoAction(page, 1, 'Cut out');
  await expect(flow(page)).toHaveAttribute('data-stage', /^(loading|cutting|pick|preview)$/);
  await expect(page.getByRole('dialog', { name: 'Download the background remover?' })).toHaveCount(0);
  expect(csp).toEqual([]);
});

// Draw round it (D54, 0.46.0): loops drawn round the buds; the AI is shown just that part,
// and anything outside the loops is dropped.

// Two buds touching (one thing to the stand-in AI): green on the left, purple on the right.
const touching = (page: Page) =>
  scene(page, 'touching', 1200, 900, '#efe9dc', [
    { kind: 'circle', x: 0.38, y: 0.5, r: 0.2, colour: '#4f7a2c' },
    { kind: 'circle', x: 0.62, y: 0.5, r: 0.2, colour: '#7a3f8a' },
  ]);
/** The colours (r, g, b, a) of an image URL at points given in fractions. */
const colours = (page: Page, url: string, points: [number, number][]) =>
  page.evaluate(
    async ({ url, points }) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      return points.map(([fx, fy]) => [...x.getImageData(Math.floor(fx * (c.width - 1)), Math.floor(fy * (c.height - 1)), 1, 1).data]);
    },
    { url, points },
  );
/** A loop drawn with the mouse round a point of the photo (fractions), radius in fractions of its width. */
async function loop(page: Page, fx: number, fy: number, r: number, steps = 32) {
  const c = flow(page).locator('.draw-stage canvas').first();
  await expect(c).toBeVisible();
  const b = (await c.boundingBox())!;
  const at = (i: number) => [b.x + (fx + Math.cos((i / steps) * Math.PI * 2) * r) * b.width, b.y + fy * b.height + Math.sin((i / steps) * Math.PI * 2) * r * b.width] as const;
  await page.mouse.move(...at(0));
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(...at(i));
  await page.mouse.up();
}

test('Draw round it: opens on a choice; a loop keeps only the bud inside it, even touching another', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  const id = await newProduct(page, 'Two touching', await touching(page));
  await page.getByRole('button', { name: /^Open photo 1\b/ }).click();
  await page.getByRole('dialog', { name: 'Photo viewer' }).getByRole('button', { name: 'Cut out', exact: true }).click();
  // The choice.
  await expect(flow(page).getByRole('button', { name: 'Find the bud for me' })).toBeVisible();
  await settled(page);
  await shot(page, '140-cutout-choice');
  await flow(page).getByRole('button', { name: 'Draw round it' }).click();
  await expect(flow(page).getByRole('heading', { name: 'Draw round it' })).toBeVisible();
  const cut = flow(page).getByRole('button', { name: 'Cut out' });
  await expect(cut).toBeDisabled();
  await expect(flow(page).getByText('Draw a loop round each bud you want.')).toBeVisible();
  // Round the green bud (x 276–636px of 1200), clear of the purple one (from 564px): 276–540px.
  await loop(page, 0.34, 0.5, 0.11);
  await expect(flow(page).getByText('1 bud marked.')).toBeVisible();
  await expect(cut).toBeEnabled();
  await shot(page, '141-cutout-loop');
  await cut.click();
  await expect(flow(page).getByRole('heading', { name: 'Preview' })).toBeVisible();
  const url = (await flow(page).getByRole('img', { name: 'The cut-out' }).getAttribute('src'))!;
  // In the middle: the green bud. Nothing purple anywhere across the middle row.
  const row = await colours(page, url, Array.from({ length: 21 }, (_, i) => [i / 20, 0.5] as [number, number]));
  const [r, g, b, a] = row[10]!;
  expect(a).toBe(255);
  expect(g).toBeGreaterThan(r!);
  expect(g).toBeGreaterThan(b!);
  for (const [pr, pg, pb, pa] of row) if (pa! > 200) expect(pr! > pg! && pb! > pg!, `purple at ${pr},${pg},${pb}`).toBe(false);
  await expect(flow(page).getByRole('button', { name: 'Not right? Draw again' })).toBeVisible();
  await flow(page).getByRole('button', { name: 'Apply' }).click();
  await expect(flow(page)).toHaveCount(0);
  await expect.poll(async () => (await product(page, id)).photos[0].cutout).toBe(true);
});

test('Draw round it: two loops keep two buds; Undo, Clear and Draw again; a tap isn’t a loop', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  await newProduct(page, 'Two apart', await twoThings(page));
  await photoAction(page, 1, 'Draw');
  const cut = flow(page).getByRole('button', { name: 'Cut out' });
  await tapAt(page, '.draw-stage canvas:not(.draw-over)', 0.5, 0.5);
  await expect(cut).toBeDisabled(); // a tap doesn't count
  await loop(page, 0.68, 0.62, 0.22); // the bud
  await loop(page, 0.21, 0.21, 0.16); // the lighter
  await expect(flow(page).getByText('2 buds marked.')).toBeVisible();
  await flow(page).getByRole('button', { name: 'Undo' }).click();
  await expect(flow(page).getByText('1 bud marked.')).toBeVisible();
  await flow(page).getByRole('button', { name: 'Clear' }).click();
  await expect(cut).toBeDisabled();
  await expect(flow(page).getByRole('button', { name: 'Undo' })).toBeDisabled();
  // Both again: the cut-out is framed round both (wider than the bud alone).
  await loop(page, 0.68, 0.62, 0.22);
  await loop(page, 0.21, 0.21, 0.16);
  await cut.click();
  await expect(flow(page).getByRole('heading', { name: 'Preview' })).toBeVisible();
  const both = await flow(page).getByRole('img', { name: 'The cut-out' }).evaluate((i) => (i as HTMLImageElement).naturalWidth);
  // Draw again keeps the loops; Undo the lighter's and cut again: just the bud, a smaller frame.
  await flow(page).getByRole('button', { name: 'Not right? Draw again' }).click();
  await expect(flow(page).getByText('2 buds marked.')).toBeVisible();
  await flow(page).getByRole('button', { name: 'Undo' }).click();
  await cut.click();
  await expect(flow(page).getByRole('heading', { name: 'Preview' })).toBeVisible();
  const one = await flow(page).getByRole('img', { name: 'The cut-out' }).evaluate((i) => (i as HTMLImageElement).naturalWidth);
  expect(one).toBeLessThan(both * 0.8);
  // Nothing inside a loop: it says so and stays on the drawing.
  await flow(page).getByRole('button', { name: 'Not right? Draw again' }).click();
  await flow(page).getByRole('button', { name: 'Clear' }).click();
  await loop(page, 0.45, 0.85, 0.06); // empty table
  await cut.click();
  await expect(flow(page).getByRole('alert')).toHaveText('No bud found inside your loop. Draw round the bud again.');
  await expect(flow(page).getByRole('heading', { name: 'Draw round it' })).toBeVisible();
});

test('Draw round it after the AI’s own try, and two fingers zoom while drawing', async ({ page }) => {
  await fakeAi(page);
  const context = page.context();
  await signUp(page);
  await newProduct(page, 'After the AI', await twoThings(page));
  await photoAction(page, 1, 'Cut out');
  await expect(flow(page).getByRole('heading', { name: 'Tap the bud' })).toBeVisible();
  await flow(page).getByRole('button', { name: 'Not right? Draw round it' }).click();
  await expect(flow(page).getByRole('heading', { name: 'Draw round it' })).toBeVisible();
  // Two fingers: the photo zooms (and nothing is drawn).
  const stage = (await flow(page).locator('.draw-stage').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const [cx, cy] = [stage.x + stage.width / 2, stage.y + stage.height / 2];
  const two = (d: number) => [
    { x: cx - d / 2, y: cy, id: 1 },
    { x: cx + d / 2, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: two(60) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: two(60 + i * 15) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const scale = await flow(page).locator('.draw-stage canvas').first().evaluate((c) => c.getBoundingClientRect().width / (c as HTMLElement).offsetWidth);
  expect(scale).toBeGreaterThan(2.5);
  await expect(flow(page).getByRole('button', { name: 'Cut out' })).toBeDisabled();
  // Zoomed in, a loop still lands where it's drawn on the photo: round the bud, which is cut out.
  const c = (await flow(page).locator('.draw-stage canvas').first().boundingBox())!;
  const bud = { x: c.x + 0.68 * c.width, y: c.y + 0.62 * c.height };
  // The bud may be partly off screen at this zoom: a small loop round its visible middle part is enough.
  const vis = { x: Math.min(Math.max(bud.x, stage.x + 60), stage.x + stage.width - 60), y: Math.min(Math.max(bud.y, stage.y + 60), stage.y + stage.height - 60) };
  await page.mouse.move(vis.x + 40, vis.y);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(vis.x + Math.cos((i / 24) * Math.PI * 2) * 40, vis.y + Math.sin((i / 24) * Math.PI * 2) * 40);
  await page.mouse.up();
  await expect(flow(page).getByText('1 bud marked.')).toBeVisible();
});

test('Remove background stays clear of the iPhone’s notch and home bar; drawing is readable and accessible', async ({ page }) => {
  await fakeAi(page);
  await signUp(page);
  await newProduct(page, 'Notch', await twoThings(page));
  // A phone with a notch: the safe areas the app reads (Chromium has none of its own).
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-top', '47px');
    document.documentElement.style.setProperty('--safe-bottom', '34px');
  });
  await photoAction(page, 1, 'Draw');
  const box = await flow(page).evaluate((el) => ({ pt: getComputedStyle(el).paddingTop, pb: getComputedStyle(el).paddingBottom, display: getComputedStyle(el).display }));
  expect(box).toEqual({ pt: '47px', pb: '34px', display: 'flex' });
  // The bottom buttons sit at the bottom of the screen, above the home bar.
  const bottom = (await flow(page).locator('.cut-bottom').boundingBox())!;
  expect(Math.abs(bottom.y + bottom.height - (844 - 34))).toBeLessThan(2);
  await loop(page, 0.68, 0.62, 0.22);
  await settled(page);
  expect((await new AxeBuilder({ page }).include('.cutflow').analyze()).violations.map((v) => v.id)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.cutflow .cut-hint, .cutflow .cut-title, .cutflow .cut-tools .btn'))).toEqual([]);
});
