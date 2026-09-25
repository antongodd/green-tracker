import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { shot, signUp } from './helpers';

// You in the header (D25): top right on the four main tabs only — your photo, or your
// letter until you add one. Tapping it opens People at your card.
test.describe.configure({ mode: 'serial' });

let page: Page;
let username: string;
let productId: string;
const MAIN = ['/', '/log', '/people', '/more'];

const me = () => page.locator('.hdr .me-btn');
const tabBar = () => page.getByRole('navigation', { name: 'Main' });

/** Sets a profile photo straight through the API: a plain square in `colour`. */
const apiPhoto = (colour: string) =>
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
    const res = await fetch('/api/profile/photo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upload, crop: { x: 0, y: 0, w: 1, h: 1, square: true } }) });
    return res.status;
  }, colour);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  username = await signUp(page, `Hal${Date.now().toString(36).slice(-6)}`);
  productId = await page.evaluate(
    async (body) => ((await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()) as { product: { id: string } }).product.id,
    { ...emptyProductInput(), name: 'Header Test' },
  );
});

test('your letter sits top right on the four main tabs, with the title still centred, and nowhere else', async () => {
  for (const path of MAIN) {
    await page.goto(path);
    await expect(me(), path).toHaveCount(1);
    await expect(me().locator('.av'), path).toHaveText('H');
    await expect(me().locator('.av img'), path).toHaveCount(0);
    await expect(me(), path).toHaveAccessibleName(`Your profile (@${username})`);
    const [title, button] = [(await page.locator('.hdr .title').boundingBox())!, (await me().boundingBox())!];
    expect(Math.abs(title.x + title.width / 2 - 195), `${path} title centred`).toBeLessThanOrEqual(1);
    expect(button.x + button.width, `${path} in the right corner`).toBeGreaterThan(360);
    expect(button.width, `${path} tap target`).toBeGreaterThanOrEqual(44);
    expect(button.height, `${path} tap target`).toBeGreaterThanOrEqual(44);
  }
  // Screens further in keep their corners for Back, Edit and ⋯.
  for (const path of [`/products/${productId}`, `/products/${productId}/edit`, '/products/new', '/log/new', '/more/archive', '/more/passkeys', '/more/blocked']) {
    await page.goto(path);
    await expect(page.locator('.hdr')).toBeVisible();
    await expect(me(), path).toHaveCount(0);
  }
  await page.goto('/');
  await expect(me().locator('.av')).toHaveText('H');
  await shot(page, '75-header-letter');
});

test('with a photo it shows on the first frame of every tab switch, never flashing the letter', async () => {
  expect(await apiPhoto('#2fb86a')).toBe(200);
  await page.goto('/');
  await expect.poll(() => me().locator('.av img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await me().locator('.av img').getAttribute('src')).toMatch(/^blob:/);

  // Watch every header the app builds: its photo must already be there and decoded.
  await page.evaluate(() => {
    const w = window as unknown as { gtHeaderLog: string[] };
    w.gtHeaderLog = [];
    const check = (el: Element, when: string) => {
      const img = el.querySelector<HTMLImageElement>('.av img');
      w.gtHeaderLog.push(`${when}:${img ? (img.complete && img.naturalWidth > 0 ? 'photo' : 'loading') : 'letter'}`);
    };
    new MutationObserver((records) => {
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          const btn = n.matches('.me-btn') ? n : n.querySelector('.me-btn');
          if (!btn) return;
          check(btn, 'added');
          requestAnimationFrame(() => check(btn, 'frame'));
        });
    }).observe(document.body, { childList: true, subtree: true });
  });
  for (const tab of ['Log', 'People', 'More', 'Leaderboard', 'Log', 'Leaderboard']) {
    await tabBar().getByRole('link', { name: new RegExp(tab) }).click();
    await expect(tabBar().getByRole('link', { name: new RegExp(tab) })).toHaveAttribute('aria-current', 'page');
    await expect(me().locator('.av img')).toHaveCount(1);
  }
  const log = await page.evaluate(() => (window as unknown as { gtHeaderLog: string[] }).gtHeaderLog);
  expect(log.length).toBeGreaterThanOrEqual(12);
  expect(log.filter((l) => !l.endsWith(':photo')), log.join(' ')).toEqual([]);
  await shot(page, '76-header-photo');
});

test('a new photo replaces it; removing it brings the letter back', async () => {
  const before = await me().locator('.av img').getAttribute('src');
  expect(await apiPhoto('#8a3b6b')).toBe(200);
  await page.reload();
  await expect.poll(() => me().locator('.av img').getAttribute('src')).not.toBe(before);
  const centre = await me().locator('.av img').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data];
  });
  expect(centre[0]).toBeGreaterThan(centre[1]!); // the new purple, not the old green

  await page.evaluate(() => fetch('/api/profile/photo', { method: 'DELETE' }));
  await page.reload();
  await expect(me().locator('.av')).toHaveText('H');
  await expect(me().locator('.av img')).toHaveCount(0);
});

test('tapping it opens People at your card; on People it goes back to the top and clears the search', async () => {
  await page.goto('/log');
  await me().click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(tabBar().getByRole('link', { name: /People/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.me-card')).toBeInViewport();

  await page.getByPlaceholder('Search usernames').fill('zz');
  await expect(page.locator('.me-card')).toHaveCount(0);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('main')!.style.paddingBottom = '2000px';
    window.scrollTo(0, 600);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await me().click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByPlaceholder('Search usernames')).toHaveValue('');
  await expect(page.locator('.me-card')).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
