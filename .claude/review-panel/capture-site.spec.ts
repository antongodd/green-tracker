import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { test, type Page } from '@playwright/test';

// The review panel's screenshots of the website (site/public, D63), served straight from the folder
// under a made-up address as in test/e2e/website.spec.ts: on an iPhone and on a laptop.
const SITE = 'https://site.test';
const DIR = join(process.cwd(), 'site/public');
const OUT = join(process.cwd(), '.playwright/review/site');
mkdirSync(OUT, { recursive: true });
const TYPES: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function open(page: Page, path: string) {
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) return route.abort();
    const file = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
    try {
      return await route.fulfill({ status: 200, headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }, body: readFileSync(join(DIR, file)) });
    } catch {
      return route.fulfill({ status: 404, headers: { 'content-type': 'text/html' }, body: readFileSync(join(DIR, '404.html')) });
    }
  });
  await page.goto(SITE + path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Show every block that rises in as you scroll, so the whole-page photo has them all.
  await page.evaluate(() => { for (const el of document.querySelectorAll('.reveal')) el.classList.remove('reveal', 'play'); });
  await page.waitForTimeout(500);
}

for (const [device, size] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1280, height: 800 }]] as const) {
  test(`website on a ${device}`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page, '/');
    await page.screenshot({ path: join(OUT, `${device}-home.png`), animations: 'disabled' });
    await page.screenshot({ path: join(OUT, `${device}-home-full.png`), fullPage: true, animations: 'disabled' });
    if (device === 'phone') writeFileSync(join(OUT, 'home.txt'), `${await page.evaluate(() => document.body.innerText)}\n`);
    await open(page, '/no-such-page');
    await page.screenshot({ path: join(OUT, `${device}-404.png`), animations: 'disabled' });
    if (device === 'phone') writeFileSync(join(OUT, '404.txt'), `${await page.evaluate(() => document.body.innerText)}\n`);
  });
}

test('the picture shown when the link is shared', async () => {
  writeFileSync(join(OUT, 'share-picture.png'), readFileSync(join(DIR, 'og.png')));
});
