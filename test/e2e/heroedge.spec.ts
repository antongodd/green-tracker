import { expect, test, type Page } from '@playwright/test';
import { PRESET_KEYS } from '../../shared/domain/gems';
import { emptyProductInput } from '../../shared/domain/product';
import { settled, signUp } from './helpers';

// 0.81.1 (Anton's screenshot on GT Dev, Sunset): a colour set's effect on a product page is drawn in a box over the
// photo's upper part; a line or band that stopped at the box's bottom edge (Sunset's horizon, Neon's tubes, Ember's
// heat, Aurora's ribbons, Synthwave's grid, Toxic's ooze) drew a hard line across the photo. The effect now fades out
// before that edge: in every set, the strip across the box's bottom edge looks the same with the effect as without it.
let page: Page;
let id = '';

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signUp(page, `edge${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`);
  id = await page.evaluate(async (p) => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 600;
    const x = c.getContext('2d')!;
    x.fillStyle = '#3a2f22';
    x.fillRect(0, 0, 600, 600);
    x.fillStyle = '#7a9a3f';
    x.beginPath();
    x.arc(300, 300, 240, 0, 7);
    x.fill();
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const f = new FormData();
    for (const k of ['original', 'cropped', 'thumb']) f.append(k, blob, `${k}.jpg`);
    const up = (await (await fetch('/api/uploads', { method: 'POST', body: f })).json()).upload;
    const r = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...p, name: 'Edge', ratings: { look: 9.6, smell: 9.5, taste: 9.6, burn: 9.5 }, photos: [{ upload: up, crop: null }] }),
    });
    return (await r.json()).product.id as string;
  }, emptyProductInput());
});
test.afterAll(async () => {
  await page.evaluate(() => fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look: 'aurora', top: 'strip', preset: 'aurora', markFirst: false }) }));
});

/** The biggest difference (0–255) in any colour channel between two screenshots of the same size. */
const biggestDifference = (a: Buffer, b: Buffer) =>
  page.evaluate(async ([a, b]) => {
    const load = async (s: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${s}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const [p, q] = [await load(a), await load(b)];
    let most = 0;
    for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) most = Math.max(most, Math.abs(p[i + k]! - q[i + k]!));
    return most;
  }, [a.toString('base64'), b.toString('base64')] as const);

for (const preset of PRESET_KEYS) {
  test(`${preset}: no line across the photo where the effect's box ends`, async () => {
    await page.evaluate((preset) => fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look: 'aurora', top: 'strip', preset, markFirst: false }) }), preset);
    await page.goto(`/products/${id}`);
    const fx = page.locator('.hero-photo .tfx');
    await expect(fx).toHaveCount(1);
    await settled(page);
    // Hold the lights and every animation still, so the two pictures differ only by the effect.
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const box = (await fx.boundingBox())!;
    const clip = { x: 0, y: box.y + box.height - 8, width: 390, height: 12 };
    const withFx = await page.screenshot({ clip });
    await fx.evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'));
    const without = await page.screenshot({ clip });
    expect(await biggestDifference(withFx, without), 'the effect shows at its box’s bottom edge').toBeLessThanOrEqual(6);
  });
}
