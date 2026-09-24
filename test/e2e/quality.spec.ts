import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { signUp } from './helpers';

// Release checks (Phase 9): accessibility (WCAG 2.1 AA via axe), the Content
// Security Policy blocking nothing the app needs, security headers, the install
// files, and the offline behaviour of the service worker.
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let productId: string;
let entryId: string;
const csp: string[] = [];
let lastReload: unknown = null; // for the failure report

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const upload = () =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5f7f3d';
    ctx.fillRect(0, 0, 300, 300);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  // Any CSP violation, from the page or the console, fails the run.
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
  page.on('console', (m) => {
    if (/Content Security Policy|CSP violation/i.test(m.text())) csp.push(m.text());
  });
  await signUp(page);
  const p = await post('/api/products', {
    ...emptyProductInput(),
    name: 'Gelato 41',
    strainType: 'hybrid',
    country: 'US',
    source: 'Cookies',
    ratings: { look: 9, smell: 8.5, taste: 9, burn: 8, high: 9 },
    purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 10, supplier: 'Shop' }],
    photos: [{ upload: await upload(), crop: null }],
  });
  productId = p.product.id;
  await post('/api/products', { ...emptyProductInput(), name: 'Mystery Sample', productType: 'other' });
  await post('/api/products', { ...emptyProductInput(), name: 'Peach Rings', productType: 'edibles', private: true, ratings: { taste: 7, high: 8 } });
  entryId = (await post('/api/log', { ...emptyLogEntryInput(), name: 'Gary Payton', country: 'US', amount: 3.5 })).entry.id;
});
test.afterAll(() => context.close());
// This file's page is shared, so Playwright's own failure capture doesn't cover it.
test.afterEach(async ({}, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' }).catch(() => {});
  const state = await page
    .evaluate(async (lastReload) => ({
      url: location.href,
      lastReload,
      onLine: navigator.onLine,
      controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
      caches: await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => r.url)])),
      html: document.documentElement.outerHTML.slice(0, 4000),
    }), lastReload)
    .catch((e) => ({ error: String(e) }));
  await info.attach('page-state', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
  console.error(`page state after failure:\n${JSON.stringify(state, null, 2)}`); // readable in CI logs
});

async function axe(path: string, setup?: () => Promise<void>) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (setup) await setup();
  await page.waitForTimeout(250); // entry animation
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${path}: ${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
}

test('every main screen passes WCAG 2.1 AA checks', async () => {
  const found: string[] = [];
  for (const path of ['/', '/log', '/people', '/more', `/products/${productId}`, `/products/${productId}/edit`, '/products/new', `/log/${entryId}`, '/log/new', '/more/passkeys', '/more/recovery-codes', '/more/archive', '/more/export', '/more/restore', '/more/delete', '/more/blocked']) {
    found.push(...(await axe(path)));
  }
  found.push(...(await axe(`/products/${productId}`, async () => void (await page.locator('.hero-photo').click()))));
  found.push(...(await axe(`/products/${productId}`, async () => void (await page.getByRole('button', { name: 'Crop photo 1' }).click()))));
  found.push(...(await axe('/', async () => void (await page.getByLabel('Type', { exact: true }).selectOption('pre_roll')))));
  await page.getByLabel('Type', { exact: true }).selectOption('all');
  expect(found, found.join('\n')).toEqual([]);
});

test('the signed-out screens pass too', async ({ browser }) => {
  const fresh = await (await browser.newContext()).newPage();
  const found: string[] = [];
  for (const path of ['/signin', '/signup', '/recover']) {
    await fresh.goto(path);
    await fresh.waitForTimeout(250);
    const { violations } = await new AxeBuilder({ page: fresh }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    found.push(...violations.map((v) => `${path}: ${v.id} — ${v.help} ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`));
  }
  expect(found, found.join('\n')).toEqual([]);
});

test('the Content Security Policy blocked nothing the app uses', () => {
  expect(csp, csp.join('\n')).toEqual([]);
});

test('security headers are sent with pages and the API', async () => {
  const pageRes = await page.request.get('/');
  const h = pageRes.headers();
  expect(h['content-security-policy']).toContain("default-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('no-referrer');
  const api = (await page.request.get('/api/auth/me')).headers();
  expect(api['x-content-type-options']).toBe('nosniff');
  expect(api['cache-control']).toBe('no-store');
});

test('the app can be installed: manifest and icons', async () => {
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as { icons: { src: string }[] };
  expect(manifest).toMatchObject({ name: 'Green Tracker', display: 'standalone', start_url: '/', theme_color: '#050807', background_color: '#050807' });
  for (const icon of [...manifest.icons.map((i: { src: string }) => i.src), '/icons/apple-touch-icon.png', '/icons/favicon.svg']) {
    const res = await page.request.get(icon);
    expect(res.status(), icon).toBe(200);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
});

/**
 * The offline scenario, for one signed-in page with a product to edit: the app opens
 * from the service worker, says it's offline, can't save, and recovers.
 */
async function offlineScenario(ctx: BrowserContext, pg: Page, product: string) {
  await pg.goto('/');
  // One cache, named for this build: old builds' caches are gone.
  const version = await pg.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return ((await (await fetch('/api/version')).json()) as { version: string }).version;
  });
  await expect.poll(() => pg.evaluate(() => caches.keys())).toEqual([`gt-shell-${version}`]);
  // The worker has taken control of the page (it claims clients just after activating).
  await expect.poll(() => pg.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const banner = pg.getByRole('status').filter({ hasText: 'You’re offline — changes can’t be saved' });
  await ctx.setOffline(true);
  const reloaded = await pg.reload();
  lastReload = { status: reloaded?.status() ?? null, fromServiceWorker: reloaded?.fromServiceWorker() ?? null };
  await expect(banner).toBeVisible();
  await expect(pg.getByRole('heading', { name: 'Can’t reach Green Tracker' })).toBeVisible();
  await ctx.setOffline(false);
  await pg.getByRole('button', { name: 'Try again' }).click();
  await expect(pg.locator('.row').first()).toBeVisible();
  await expect(banner).toHaveCount(0);

  // Going offline while editing disables Save. A browser that notices at once
  // disables it straight away; otherwise the app finds out when Save can't get through.
  await pg.goto(`/products/${product}/edit`);
  const save = pg.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await ctx.setOffline(true);
  if (await save.isEnabled()) await save.click();
  await expect(save).toBeDisabled();
  await expect(banner).toBeVisible();
  // Back online, the app notices by itself (browser event or its own check) and Save returns.
  await ctx.setOffline(false);
  await expect(save).toBeEnabled({ timeout: 10_000 });
  await expect(banner).toHaveCount(0);
}

test('offline: the app still opens, says it is offline, and can’t save; back online it recovers', async () => {
  await offlineScenario(context, page, productId);
});

test('offline is noticed even when the browser still claims to be online (Wi-Fi without internet)', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    // The browser never reports going offline: onLine stays true and no events fire.
    await ctx.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true });
      for (const type of ['online', 'offline']) window.addEventListener(type, (e) => e.stopImmediatePropagation(), { capture: true });
    });
    const pg = await ctx.newPage();
    await signUp(pg);
    const made = await pg.evaluate(async (body) => (await (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()) as { product: { id: string } }, { ...emptyProductInput(), name: 'Wifi Test' });
    await offlineScenario(ctx, pg, made.product.id);
  } finally {
    await ctx.close();
  }
});
