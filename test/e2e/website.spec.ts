import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contrastFailures, textBoxes } from './helpers';

// D63 (0.53.0): the website (site/public), a page for people who haven't got the app yet.
// Files only, so it's served here straight from the folder, under a made-up address, with the
// security headers from its own _headers file. Anything asked of another address is noted
// and refused: the site must load nothing from anywhere else.
const SITE = 'https://site.test';
const DIR = join(process.cwd(), 'site/public');
const APP = 'https://green-tracker.green-tracker.workers.dev';
const TYPES: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const headers = Object.fromEntries(
  readFileSync(join(DIR, '_headers'), 'utf8').split('\n').filter((l) => /^\s+\S+:/.test(l)).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const watched = new WeakMap<Page, { elsewhere: string[]; problems: string[] }>();
async function open(page: Page, path = '/') {
  let seen = watched.get(page);
  if (!seen) await serve(page, (seen = { elsewhere: [], problems: [] }));
  watched.set(page, seen);
  await page.goto(SITE + path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return seen;
}
async function serve(page: Page, { elsewhere, problems }: { elsewhere: string[]; problems: string[] }) {
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { elsewhere.push(url.href); return route.abort(); }
    const file = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
    try {
      return await route.fulfill({ status: 200, headers: { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }, body: readFileSync(join(DIR, file)) });
    } catch {
      return route.fulfill({ status: 404, headers: { ...headers, 'content-type': 'text/html' }, body: readFileSync(join(DIR, '404.html')) });
    }
  });
}

/** Takes away the rise of each block scrolling into view (before scrolling), so a block is never caught mid-rise. */
const noRise = (page: Page) => page.evaluate(() => { for (const el of document.querySelectorAll('.reveal')) el.classList.remove('reveal', 'play'); });

test('loads nothing from anywhere else, breaks no rules of its own, and every sign-up button opens the live app', async ({ page }) => {
  const { elsewhere, problems } = await open(page);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(300);
  expect(elsewhere).toEqual([]);
  expect(problems).toEqual([]);
  // The stored fonts are the ones in use (not the fallbacks).
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')).sort())).toEqual(['Manrope', 'Unbounded']);
  const signUps = page.getByRole('link', { name: 'Sign up free' });
  await expect(signUps).toHaveCount(2);
  for (const href of await signUps.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toBe(`${APP}/signup`);
  await expect(page.getByRole('link', { name: 'Open app' })).toHaveAttribute('href', `${APP}/`);
  // A shared link shows the picture and words.
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/\/og\.png$/);
  const png = readFileSync(join(DIR, 'og.png'));
  const size = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect([size.getUint32(16), size.getUint32(20)]).toEqual([1200, 630]);
});

test('no accessibility problems, at the top and after scrolling through', async ({ page }) => {
  await open(page);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  await noRise(page);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(200);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
});

// The words sit over drifting lights (axe can't judge text over moving colour): the lights are
// paused at several moments and the worst pixel behind each piece of text is measured, all the
// way down the page. The little picture of the app and of Safari are pictures, not words to read.
const WORDS = '.brand span, .btn, .eyebrow, h1, h1 em, h2, h3, .lede, .label, .feat p, .verdict, .rate .nm b, .rate .nm small, .rate .sc, .scale span, .step b, .step p, .step .n, .other, .foot span';
test('every word is readable over the moving lights, all the way down', async ({ page }) => {
  test.slow();
  await open(page);
  const height = await page.evaluate(() => document.body.scrollHeight);
  const judged = new Set<string>();
  let total = 0;
  const failures: string[] = [];
  for (let y = 0; y < height; y += 600) {
    if (y) await open(page);
    await noRise(page);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(250);
    const nav = await page.locator('.nav').evaluate((n) => n.getBoundingClientRect().bottom);
    const boxes = (await textBoxes(page, WORDS)).map((b, i) => ({ ...b, i }));
    total = boxes.length;
    // Only what's fully on screen and not behind the frosted bar at the top.
    const seen = boxes.filter((b) => b.y >= (y ? nav : 0) && b.y + b.h <= 844 && b.w > 1);
    for (const b of seen) judged.add(`${b.i}`);
    failures.push(...(await contrastFailures(page, seen, 6)).map((f) => `at ${y}px: ${f}`));
  }
  expect(failures).toEqual([]);
  expect(judged.size, 'every piece of text was judged somewhere').toBe(total);
});

test('fits a phone: nothing spills sideways, from the smallest iPhone up', async ({ page }) => {
  await open(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px wide`).toBe(width);
  }
});

test('Go on, rate it: the slider gives the score the colours it earns in the app', async ({ page }) => {
  await open(page);
  const slider = page.getByRole('slider', { name: /fire|talking|bad|mids|top shelf/i });
  const row = page.locator('#rate-row');
  await slider.fill('9.7');
  await expect(page.locator('#rate-score')).toHaveText('9.7');
  await expect(page.locator('#rate-verdict')).toHaveText('Top shelf. Holo unlocked.');
  await expect(row).toHaveClass('lr holo b4');
  await slider.fill('8.6');
  await expect(row).toHaveClass('lr holo b2');
  await expect(page.locator('#rate-verdict')).toHaveText('Now we’re talking.');
  await slider.fill('5');
  await expect(row).toHaveClass('lr heat');
  await expect(page.locator('#rate-verdict')).toHaveText('Mids. Straight to the bottom.');
  await expect(slider).toHaveAttribute('aria-valuetext', '5.0 out of 10: Mids. Straight to the bottom.');
  // Below 8 the score glows amber to mint, like the app's heat (D30): amber here.
  expect(await page.locator('#rate-score').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(210, 184, 82)');
});

test('"Put it on my iPhone" goes to the steps', async ({ page }) => {
  await open(page);
  await page.getByRole('link', { name: 'Put it on my iPhone' }).click();
  await expect.poll(() => page.locator('#install h2').evaluate((h) => h.getBoundingClientRect().top)).toBeLessThan(200);
  await expect(page.locator('#install ol > li')).toHaveCount(3);
});

test('with Reduce Motion on, nothing moves', async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })).newPage();
  await open(page);
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.context().close();
});

test('an address that does not exist gets the lost page, with a way back', async ({ page }) => {
  const { elsewhere } = await open(page, '/nope');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lost the lighter?');
  await expect(page.getByRole('link', { name: 'Back to Green Tracker' })).toHaveAttribute('href', '/');
  expect(elsewhere).toEqual([]);
});
