import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, HERO_TEXT, heroTextBoxes, shot, signUp } from './helpers';

// The Poster (D27, 0.20.0): the first photo fills the top of a product page edge to edge,
// behind the header, with the details on its bottom over a dark fade. A cut-out or the
// type mark floats above the details. One account; its products (All · Overall):
// Bright 9.9 (1st, a white photo) · Busy 9.5 (Diamond, a busy bright photo) ·
// Floating 9.0 (Gold, a cut-out, long name) · Plain (unrated, white photo) · Nothing (no photo).
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};
const LONG = 'Floating Frosty Gelato Cake Supreme Reserve Edition';

/** Uploads a photo drawn in the page: all white, busy bright stripes, or a cut-out (PNG with a JPEG original). */
const upload = (p: Page, kind: 'white' | 'busy' | 'cut') =>
  p.evaluate(async (kind) => {
    const draw = (w: number, h: number, paint: (x: CanvasRenderingContext2D) => void, type: string) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      paint(c.getContext('2d')!);
      return new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.92));
    };
    const white = (x: CanvasRenderingContext2D) => {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, 1200, 900);
    };
    const busy = (x: CanvasRenderingContext2D) => {
      const colours = ['#ffffff', '#fff27a', '#8ff0ff', '#ffc2e8', '#c9ffb0', '#1b1b1b', '#ff5a36'];
      for (let i = 0; i < 60; i++) {
        x.fillStyle = colours[i % colours.length]!;
        x.fillRect(i * 20, 0, 20, 900);
      }
      for (let i = 0; i < 45; i++) {
        x.fillStyle = colours[(i * 3) % colours.length]!;
        x.fillRect(0, i * 20, 1200, 6);
      }
    };
    const bud = (x: CanvasRenderingContext2D) => {
      const s = x.canvas.width;
      x.fillStyle = '#5f8f3a';
      x.beginPath();
      x.arc(s / 2, s / 2, s / 3, 0, Math.PI * 2);
      x.fill();
    };
    const form = new FormData();
    if (kind === 'cut') {
      form.append('original', await draw(1200, 900, white, 'image/jpeg'), 'original.jpg');
      form.append('cropped', await draw(600, 600, bud, 'image/png'), 'cropped.png');
      form.append('thumb', await draw(320, 320, bud, 'image/png'), 'thumb.png');
      form.append('cutout', '1');
    } else {
      const img = await draw(1200, 900, kind === 'white' ? white : busy, 'image/jpeg');
      for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    }
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    return ((await res.json()) as { upload: string }).upload;
  }, kind);

const create = async (name: string, over: Partial<ProductInput>) => {
  const body: ProductInput = { ...emptyProductInput(), name, ...over };
  ids[name] = await page.evaluate(async (b) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()) as { product: { id: string } }).product.id, body);
};

/** Opens a product page once its podium place is known and the screen's entrance has finished. */
async function open(name: string) {
  await page.goto(`/products/${ids[name]}`);
  await expect(page.locator('main[data-podium]')).toBeVisible();
  await page.locator('main').evaluate((m) => Promise.all(m.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'enter').map((a) => a.finished)));
}

const rect = (sel: string) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `hero${Date.now().toString(36).slice(-6)}`);
  const photo = async (kind: 'white' | 'busy' | 'cut') => [{ upload: await upload(page, kind), crop: null }];
  await create('Bright', { strainType: 'sativa', country: 'US', ratings: { look: 9.9 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }], photos: await photo('white') });
  await create('Busy', { strainType: 'hybrid', country: 'CA', ratings: { look: 9.5 }, purchases: [{ date: '2026-09-01', amount: 1, totalPaid: 12, supplier: null }], photos: await photo('busy') });
  await create(LONG, { strainType: 'indica', country: 'GB', ratings: { look: 9 }, photos: await photo('cut') });
  await create('Plain', { strainType: 'hybrid', country: 'NL', private: true, purchases: [{ date: '2026-09-01', amount: 2, totalPaid: 20, supplier: null }], photos: await photo('white') });
  await create('Nothing', { strainType: 'hybrid' });
});
test.afterAll(async () => {
  await page.context().close();
});

test('the photo fills the top of the page, behind the header, and the details sit on it; tapping them opens the photo', async () => {
  await open('Busy');
  await expect(page.locator('main')).toHaveAttribute('data-podium', '2');
  const photo = await rect('.hero-photo');
  const header = await rect('.hdr');
  const hero = await rect('.hero');
  const poster = await rect('.poster');
  // Edge to edge, from the very top (behind the glass header).
  expect(Math.abs(photo.left)).toBeLessThan(1);
  expect(Math.abs(photo.width - 390)).toBeLessThan(1);
  expect(Math.abs(photo.top)).toBeLessThan(1);
  expect(header.bottom).toBeGreaterThan(photo.top + 20);
  // The details sit on the bottom of the photo.
  expect(hero.top).toBeLessThan(photo.bottom);
  expect(Math.abs(hero.bottom - poster.bottom)).toBeLessThan(1);
  expect(Math.abs(photo.bottom - poster.bottom)).toBeLessThan(1);
  // Name on the left, score on the right, side by side.
  const [h1, score] = [await rect('.hero h1'), await rect('.hero-score')];
  expect(h1.right).toBeLessThanOrEqual(score.left + 1);
  expect(Math.abs(score.right - 374)).toBeLessThan(1);
  await expect(page.locator('.hero-price')).toHaveText('£12.00/g');
  await shot(page, '95-hero-photo');
  // Taps on the details pass through to the photo, which opens the viewer as before.
  await page.mouse.click(h1.left + h1.width / 2, h1.top + h1.height / 2);
  await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toHaveCount(0);
});

test('a cut-out and the type mark float above the details; a long name wraps and never overflows', async () => {
  await open(LONG);
  await expect(page.locator('main')).toHaveAttribute('data-podium', '3');
  const img = await rect('.hero-photo img');
  // The cut-out and the thumbnail shown under it while it loads share one box, centred
  // (0.20.0 drew the image at its own width from the left edge: two buds, one off to the left).
  const under = await rect('.hero-photo .hero-under');
  for (const k of ['left', 'top', 'width', 'height'] as const) expect(Math.abs(img[k] - under[k]), k).toBeLessThan(1);
  expect(Math.abs(img.left + img.width / 2 - 195)).toBeLessThan(1);
  const textTop = await page.locator('.hero').evaluate((h) => Math.min(...[...h.children].map((c) => c.getBoundingClientRect().top)));
  expect(img.bottom).toBeLessThanOrEqual(textTop);
  expect(img.top).toBeGreaterThanOrEqual((await rect('.hdr')).bottom);
  const [h1, score, hero, poster] = [await rect('.hero h1'), await rect('.hero-score'), await rect('.hero'), await rect('.poster')];
  expect(h1.right).toBeLessThanOrEqual(score.left + 1);
  expect(h1.height).toBeGreaterThan(60); // wrapped onto several lines…
  expect(hero.bottom).toBeLessThanOrEqual(poster.bottom + 1); // …and the poster grew to hold it
  const overflow = await page.locator('.hero').evaluate((h) => [...h.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > 390.5).length);
  expect(overflow).toBe(0);
  await shot(page, '96-hero-cutout');

  await open('Nothing');
  const mark = await rect('.hero-photo svg');
  const top = await page.locator('.hero').evaluate((h) => Math.min(...[...h.children].map((c) => c.getBoundingClientRect().top)));
  expect(mark.bottom).toBeLessThanOrEqual(top);
  expect(mark.top).toBeGreaterThanOrEqual((await rect('.hdr')).bottom);
  await expect(page.locator('.hero-photo img')).toHaveCount(0);
  await shot(page, '97-hero-none');
});

test('the details stay readable over a white photo and a busy one, throughout the podium motion', async () => {
  // Five pages × 12 photographed moments: about 37s alone, so it ran past the 60s limit with 4 workers
  // busy (0.29.0's first full run). Same checks, more time.
  test.slow();
  for (const name of ['Bright', 'Busy', LONG, 'Plain', 'Nothing']) {
    await open(name);
    await expect(page.locator(HERO_TEXT).first()).toBeVisible();
    const worst = await contrastFailures(page, await heroTextBoxes(page));
    expect(worst, `${name}:\n${worst.join('\n')}`).toEqual([]);
  }
});
