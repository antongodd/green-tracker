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
const TYPES: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.vtt': 'text/vtt' };
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

/** Waits for everything that arrives once (the phone, its rows and chips, the blocks rising in) to finish arriving:
 * a chip caught half see-through reads as faint words (D85). The lights and the holo colours never finish. */
const arrived = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {})))).then(() => {});

/** Takes away the rise of each block scrolling into view (before scrolling), so a block is never caught mid-rise. */
const noRise = (page: Page) => page.evaluate(() => { for (const el of document.querySelectorAll('.reveal')) el.classList.remove('reveal', 'play'); });

test('loads nothing from anywhere else, breaks no rules of its own, and every sign-up button opens the live app', async ({ page }) => {
  const { elsewhere, problems } = await open(page);
  // At the top the bar offers Open app; once the hero's buttons have scrolled away, Sign up (D85).
  await expect(page.getByRole('link', { name: 'Open app' })).toHaveAttribute('href', `${APP}/`);
  await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toBeHidden();
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toHaveAttribute('href', `${APP}/signup`);
  await expect(page.getByRole('link', { name: 'Open app' })).toBeHidden();
  expect(elsewhere).toEqual([]);
  expect(problems).toEqual([]);
  // The stored fonts are the ones in use (not the fallbacks).
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')).sort())).toEqual(['Manrope', 'Unbounded']);
  const signUps = page.getByRole('link', { name: 'Sign up free' });
  await expect(signUps).toHaveCount(2);
  for (const href of await signUps.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toBe(`${APP}/signup`);
  // A shared link shows the picture and words.
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/\/og\.png$/);
  const png = readFileSync(join(DIR, 'og.png'));
  const size = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect([size.getUint32(16), size.getUint32(20)]).toEqual([1200, 630]);
});

test('no accessibility problems, at the top and after scrolling through', async ({ page }) => {
  await open(page);
  await arrived(page);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  await noRise(page);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(200);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
});

// The words sit over drifting lights (axe can't judge text over moving colour): the lights are
// paused at several moments and the worst pixel behind each piece of text is measured, all the
// way down the page. The little picture of the app and of Safari are pictures, not words to read.
// The bar at the top is judged wherever it is (it floats over everything), but only the button it's
// showing: Open app at the top, Sign up further down (D85).
// Rate the stack (D86): only the top card's words (the ones under it are covered by it). The Looks' names run off
// the side of the screen in their row: their own test judges the ones in sight.
const WORDS = '.brand span, .btn, .eyebrow, h1, h1 em, h2, h3, .lede, .asks, .label, .feat p, .card:last-child .ctop span, .card:last-child .cnm b, .card:last-child .cnm small, .step b, .step p, .step .n, .video figcaption, .other, .foot span';
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
    await page.waitForTimeout(600);
    const nav = await page.locator('.nav').evaluate((n) => n.getBoundingClientRect().bottom);
    const where = await page.locator('body').evaluate((body, sel) => [...body.querySelectorAll(sel)].map((e) => ({ inNav: !!e.closest('.nav'), shown: getComputedStyle(e).visibility === 'visible' })), WORDS);
    const boxes = (await textBoxes(page, WORDS)).map((b, i) => ({ ...b, i }));
    total = boxes.length;
    // Only what's showing, fully on screen and, below the bar, not behind the frosted bar at the top.
    const seen = boxes.filter((b) => where[b.i]!.shown && (where[b.i]!.inNav || b.y >= (y ? nav : 0)) && b.y + b.h <= 844 && b.w > 1);
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

// D68: the steps as a video. The thumbnail shows; the video itself downloads only when someone plays it, and
// it plays only when tapped, with the iPhone's own controls. Captions say what's on screen.
test('the how-to video: its thumbnail shows, nothing downloads until it is played, and it never plays by itself', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  const { elsewhere, problems } = await open(page);
  const video = page.locator('#install video');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeInViewport();
  await page.waitForTimeout(1000);
  expect(await video.evaluate((v: HTMLVideoElement) => ({ controls: v.controls, inline: v.playsInline, preload: v.preload, autoplay: v.autoplay, muted: v.muted, loop: v.loop, paused: v.paused }))).toEqual({ controls: true, inline: true, preload: 'none', autoplay: false, muted: false, loop: false, paused: true });
  // The thumbnail (the phone with the leaf), full size.
  await expect(video).toHaveAttribute('poster', '/media/home-screen.jpg');
  expect(asked).toContain('/media/home-screen.jpg');
  expect(await page.evaluate(async () => { const i = new Image(); i.src = '/media/home-screen.jpg'; await i.decode(); return [i.naturalWidth, i.naturalHeight]; })).toEqual([1280, 720]);
  expect(asked.filter((a) => a.endsWith('.mp4')), 'nothing downloads before play').toEqual([]);
  // The captions load (the security rules allow the site's own media) and cover the whole video.
  const cues = await video.evaluate(async (v: HTMLVideoElement) => {
    const track = v.textTracks[0]!; track.mode = 'hidden';
    for (let i = 0; i < 50 && !track.cues?.length; i++) await new Promise((r) => setTimeout(r, 100));
    return [...(track.cues ?? [])].map((c) => [c.startTime, c.endTime]);
  });
  expect(cues.length).toBe(9);
  expect(cues.at(-1)![1]).toBe(24);
  // Played, it asks this site (and only this site) for the video.
  await video.evaluate((v: HTMLVideoElement) => { v.play().catch(() => {}); });
  await expect.poll(() => asked.filter((a) => a === '/media/home-screen.mp4').length).toBeGreaterThan(0);
  expect(elsewhere).toEqual([]);
  expect(problems).toEqual([]);
  // A small file: an H.264 MP4 that every iPhone plays.
  const mp4 = readFileSync(join(DIR, 'media/home-screen.mp4'));
  expect(mp4.subarray(4, 8).toString()).toBe('ftyp');
  expect(mp4.includes(Buffer.from('avc1'))).toBe(true);
  expect(mp4.length).toBeLessThan(3_000_000);
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
  await expect(page.getByText('This page doesn’t exist. Head back to the start.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Green Tracker' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', `${APP}/`);
  expect(elsewhere).toEqual([]);
});

// 0.69.4 (the website catching up with the app, review panel 2026-11-03): what sign-up asks for (D80), the Feed
// (D77), one time throughout, the real address, and the price chip clear of the scores.
test('the words match today’s app: an email and password, posts for approved friends, one time throughout', async ({ page }) => {
  await open(page);
  const text = await page.locator('body').innerText();
  await expect(page.locator('.hero .asks')).toHaveText('Just an email and password. Your email stays private; Face ID is optional.');
  // Since D80 sign-up asks for both: the page must never say otherwise.
  expect(text).not.toMatch(/no (email|password|phone)/i);
  await expect(page.getByRole('heading', { name: 'See your mates’ picks and posts' })).toBeVisible();
  expect(text).toContain('only friends you approve see it');
  expect(text).not.toMatch(/\bpeep\b/i);
  // One time everywhere: 20 seconds, as the video itself says.
  expect(text.match(/\b\d+ seconds?\b|\bminute\b/gi)).toEqual(['20 seconds', '20 seconds']);
  const vtt = readFileSync(join(DIR, 'media/home-screen.vtt'), 'utf8');
  expect(vtt.match(/\b\d+ seconds?\b|\bminute\b/gi)).toEqual(['20 seconds']);
  expect(vtt.trim().split('\n').slice(-2)[0]).toBe('Get it in 3 steps: open it in Safari, Share → View More → Add to Home Screen, tap Add.');
  // The real address in the Safari drawing, and a way out of WhatsApp's and Instagram's own browsers.
  // (The install sheet draws it too, D86.)
  await expect(page.locator('.safari .url')).toHaveText([new URL(APP).host, new URL(APP).host]);
  await expect(page.locator('#install li').first()).toContainText('Opened this inside WhatsApp or Instagram? Open it in Safari first');
  // The picture of the app: the app's own words, a price called a price, no name cut short.
  await expect(page.locator('.mini-h span')).toHaveText('All · Overall');
  await expect(page.locator('.chip.c2')).toHaveText('£9.50/gprice');
  // Linux draws these names wider than an iPhone does: the names are kept short enough for both.
  for (const name of await page.locator('.mini .nm b').all()) expect(await name.evaluate((b) => b.scrollWidth <= b.clientWidth), await name.innerText()).toBe(true);
});

test('the floating chips never cover a score, on a phone or a laptop', async ({ page }) => {
  for (const [width, height] of [[320, 700], [390, 844], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await open(page);
    // Held still (the chips and the phone float), so the boxes are where they rest.
    await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
    const clash = await page.evaluate(() => {
      const scores = [...document.querySelectorAll('.mini .sc')].map((e) => e.getBoundingClientRect());
      const out: string[] = [];
      for (const chip of document.querySelectorAll('.chip')) {
        const c = chip.getBoundingClientRect();
        for (const s of scores) if (c.left < s.right && s.left < c.right && c.top < s.bottom && s.top < c.bottom) out.push(chip.textContent!);
      }
      return out;
    });
    expect(clash, `${width}px wide`).toEqual([]);
  }
});

test('the buttons at the top are big enough to tap (44 points), at the top and further down', async ({ page }) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    for (const down of [0, 1500]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), down);
      await page.waitForTimeout(600);
      const links = await page.locator('.nav a >> visible=true').all();
      expect(links.length, `${width}px, ${down}px down`).toBe(2);
      for (const link of links) {
        const box = (await link.boundingBox())!;
        expect(Math.min(box.width, box.height), `${await link.innerText()} at ${width}px, ${down}px down`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('on a laptop everything lines up with the hero, and the three steps sit side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await noRise(page);
  const left = (sel: string) => page.locator(sel).first().evaluate((e) => Math.round(e.getBoundingClientRect().left));
  const hero = await left('h1');
  for (const sel of ['#what', '#try', '#get', '.feats', '.rate', '.steps', '.other', '.final']) expect(await left(sel), sel).toBe(hero);
  const steps = await page.locator('#install ol > li').evaluateAll((ls) => ls.map((l) => Math.round(l.getBoundingClientRect().top)));
  expect(new Set(steps).size).toBe(1);
  // Each step's words start right under its title (no gap from stretching to the tallest step).
  for (const step of await page.locator('#install ol > li').all()) {
    const gap = await step.evaluate((l) => l.querySelector('p')!.getBoundingClientRect().top - l.querySelector('b')!.getBoundingClientRect().bottom);
    expect(gap).toBeLessThan(10);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

// D85 (0.74.0): an Apple-style polish. Things arrive once and then hold still; only the lights (the weather)
// and the holo colours a top score earns keep moving. Buttons answer the moment they're pressed.
test('after it arrives, only the lights and the holo colours keep moving', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(3500);
  const looping = await page.evaluate(() => [...new Set(document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).map((a) => (a as CSSAnimation).animationName))].sort());
  expect(looping).toEqual(['drift1', 'drift2', 'holo', 'holo-text']);
  // Nothing else is still running once everything has arrived.
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity && a.playState === 'running').length)).toBe(0);
});

test('a button presses in the moment a finger lands, and the bar at the top gets its edge once the page scrolls under it', async ({ page }) => {
  await open(page);
  const go = page.locator('.hero .btn.go');
  const box = (await go.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => go.evaluate((b) => new DOMMatrix(getComputedStyle(b).transform).a)).toBeCloseTo(0.96, 2);
  // Slid off before letting go: no sign-up, and the button springs back.
  await page.mouse.move(box.x + box.width / 2, box.y - 120);
  await page.mouse.up();
  await expect.poll(() => go.evaluate((b) => new DOMMatrix(getComputedStyle(b).transform).a)).toBe(1);
  expect(page.url()).toBe(`${SITE}/`);
  const nav = page.locator('.nav');
  await expect(nav).not.toHaveClass(/edge/);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
  await expect(nav).toHaveClass(/edge/);
  await expect(nav).not.toHaveClass(/join/);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(nav).toHaveClass(/join/);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(nav).not.toHaveClass(/edge|join/);
});

test('with Reduce Transparency, nothing is frosted; with Increase Contrast, the cards are solid', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await open(page);
  const frosted = () => page.evaluate(() => [...document.querySelectorAll('.nav, .feats, .rate, .step, .chip, .btn.ghost')].filter((e) => { const f = getComputedStyle(e).backdropFilter; return f && f !== 'none'; }).length);
  expect(await frosted()).toBeGreaterThan(0);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  expect(await frosted()).toBe(0);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: 'more' }] });
  await arrived(page);
  expect(await page.locator('.rate').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(11, 18, 16)');
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
});

// D86 (0.75.0): new things to play with, each from the apple-design skill. A pointer drag in these tests is a mouse
// moved in small steps (Chromium sends pointer events for it), as a finger would.
async function drag(page: Page, from: { x: number; y: number }, dx: number, steps = 12, gap = 16) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (dx * i) / steps, from.y); await page.waitForTimeout(gap); }
  await page.mouse.up();
}
const centre = async (page: Page, sel: string) => { const b = (await page.locator(sel).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test('Rate the stack: the buttons rate all five, and your top shelf builds itself in score order', async ({ page }) => {
  await open(page);
  await page.locator('#stack').scrollIntoViewIfNeeded();
  const now = page.locator('#rate-now');
  const cards = page.locator('#stack .card');
  await expect(cards).toHaveCount(5);
  // One at a time: the next card is ready once the last has flown off.
  const rate = async (name: 'Fire' | 'Mids') => { const n = await cards.count(); await page.getByRole('button', { name, exact: true }).click(); await expect(cards).toHaveCount(n - 1); };
  await rate('Fire');
  await expect(now).toHaveText('Lemon Gelato: 9.3. Fire.');
  await rate('Mids');
  await expect(now).toHaveText('Blue Zushi: 3.1. Mids. Straight to the bottom.');
  for (const name of ['Fire', 'Mids', 'Fire'] as const) await rate(name);
  // Your top shelf: the three fires first, then the mids, in the app's colours.
  await expect(now).toHaveText('Your top shelf: Lemon Gelato first, with 9.3.');
  const rows = page.locator('.board .lr');
  await expect(rows).toHaveCount(5);
  expect(await rows.locator('.nm b').allTextContents()).toEqual(['Lemon Gelato', 'Gushers Rosin', 'Purple Punch', 'Blue Zushi', 'Melon Gummies']);
  await expect(rows.first()).toHaveClass('lr holo b3');
  // Below 8 the score glows amber to mint, like the app's heat (D30): 3.1 is amber.
  expect(await rows.last().locator('.sc').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(240, 169, 59)');
  await expect(page.getByRole('button', { name: 'Fire', exact: true })).toBeHidden();
  await arrived(page);
  expect((await new AxeBuilder({ page }).include('.rate').analyze()).violations.map((v) => v.id)).toEqual([]);
  // The words under the cards and on your top shelf are readable.
  expect(await contrastFailures(page, await textBoxes(page, '.now, .board .label, .board .nm b, .board .nm small, .board .rk, .rate-btns .btn:not([hidden])'), 3)).toEqual([]);
  // And again: the five cards are back.
  await open(page);
  await page.locator('#stack').scrollIntoViewIfNeeded();
  for (let i = 0; i < 5; i++) await rate('Fire');
  await page.getByRole('button', { name: 'Rate them again' }).click();
  await expect(page.locator('#stack .card')).toHaveCount(5);
  await expect(now).toHaveText('Rating 1 of 5: Lemon Gelato.');
});

test('Rate the stack: a card follows the finger, scores as it goes, springs back if let go early, and flies off when thrown', async ({ page }) => {
  await open(page);
  await page.locator('#stack').scrollIntoViewIfNeeded();
  const top = page.locator('#stack .card:last-child');
  const at = await centre(page, '#stack .card:last-child');
  const width = (await top.boundingBox())!.width;
  // Held at 40% of the card's width to the right: 9.1, the holo of a 9 (b3), the Fire stamp showing.
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(at.x + (width * 0.4 * i) / 10, at.y); await page.waitForTimeout(16); }
  await expect(top.locator('.cscore')).toHaveText('9.1');
  await expect(top).toHaveClass(/holo b3/);
  expect(Number(await top.locator('.fire').evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
  // It moved with the finger: 40% of its width, give or take a pixel.
  expect(await top.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41)).toBeCloseTo(width * 0.4, 0);
  // Brought back and let go slowly near the middle: it springs back and nothing is rated.
  for (let i = 9; i >= 0; i--) { await page.mouse.move(at.x + (width * 0.04 * i), at.y); await page.waitForTimeout(40); }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect.poll(() => top.evaluate((e) => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m41))).toBeLessThan(0.5);
  await expect(page.locator('#rate-now')).toHaveText('');
  // Thrown left: it flies off and is rated low, and the next card comes up.
  await drag(page, at, -width * 0.3, 6, 12);
  await expect(page.locator('#rate-now')).toHaveText(/^Lemon Gelato: [1-4]\.\d\. Mids\. Straight to the bottom\.$/);
  await expect(page.locator('#stack .card')).toHaveCount(4);
  await expect(page.locator('#stack .card:last-child .cnm b')).toHaveText('Blue Zushi');
});

test('Make it yours: a Look tapped or swiped to changes the page’s lights and the little phone', async ({ page }) => {
  await open(page);
  const row = page.locator('.looks');
  await row.scrollIntoViewIfNeeded();
  await expect(row.getByRole('button')).toHaveCount(15);
  await expect(row.getByRole('button', { name: 'Aurora Glass' })).toHaveAttribute('aria-pressed', 'true');
  const light = () => page.locator('.l1').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await light()).toBe('rgb(88, 224, 140)');
  // Tapped: Sakura's pink, slowly (no jump), and its words.
  await row.getByRole('button', { name: 'Sakura' }).click();
  await expect(row.getByRole('button', { name: 'Sakura' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row.getByRole('button', { name: 'Aurora Glass' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#look-about')).toHaveText('Sakura: dusk pink with drifting blossom.');
  expect(await light()).not.toBe('rgb(245, 140, 186)');
  await expect.poll(light, { timeout: 4000 }).toBe('rgb(245, 140, 186)');
  // Swiped along to the end: the last one, a light Look, shows on the little phone (light), the page stays dark.
  await row.evaluate((r) => r.scrollTo({ left: r.scrollWidth, behavior: 'instant' }));
  await expect(row.getByRole('button', { name: 'Daylight Sky' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('.pmini .scr').evaluate((e) => getComputedStyle(e).backgroundColor), { timeout: 4000 }).toBe('rgb(238, 243, 250)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(3, 7, 10)');
  expect((await new AxeBuilder({ page }).include('.looks').analyze()).violations.map((v) => v.id)).toEqual([]);
  // The names in sight are readable, at the start of the row and at its end.
  for (const left of [0, 1e5]) {
    await open(page);
    await noRise(page);
    await page.locator('.looks').evaluate((r, left) => { r.scrollIntoView({ block: 'center', behavior: 'instant' }); r.scrollTo({ left, behavior: 'instant' }); }, left);
    await page.waitForTimeout(300);
    const width = page.viewportSize()!.width;
    const names = (await textBoxes(page, '.lkn')).filter((b) => b.x >= 0 && b.x + b.w <= width && b.y >= 0 && b.y + b.h <= 844);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(await contrastFailures(page, names, 2)).toEqual([]);
  }
});

// Whatever Look is picked, every word stays readable over its lights: for each Look, the lights near the top of the
// page and those further down (.l1–.l5), judged at three moments.
test('every word is readable over the lights of every Look', async ({ page }) => {
  test.setTimeout(420_000);
  const looks = await (await open(page), page.locator('.lk').evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.look!)));
  const failures: string[] = [];
  for (const look of looks) {
    for (const y of [0, 1500, 2400]) {
      await open(page);
      await noRise(page);
      await page.locator(`.lk[data-look="${look}"]`).evaluate((b) => (b as HTMLElement).click());
      // Wait for the lights to finish changing colour.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))));
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
      await page.waitForTimeout(600);
      const nav = await page.locator('.nav').evaluate((n) => n.getBoundingClientRect().bottom);
      const boxes = (await textBoxes(page, WORDS)).filter((b) => b.y >= (y ? nav : 0) && b.y + b.h <= 844 && b.w > 1 && b.x >= 0 && b.x + b.w <= 390);
      failures.push(...(await contrastFailures(page, boxes, 3)).map((f) => `${look} at ${y}px: ${f}`));
    }
  }
  expect(failures).toEqual([]);
});

test('the scroll story: the phone stays beside the words and shows each feature as you reach it, and back again', async ({ page }) => {
  await open(page);
  await noRise(page);
  const story = page.locator('.story');
  const pin = page.locator('.story .pin');
  const reach = async (n: number) => {
    await page.locator(`.story .feat[data-screen="${n}"]`).evaluate((f) => { const r = f.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' }); });
    await expect(story).toHaveAttribute('data-on', String(n));
    await expect(page.locator('.story .s').nth(n)).toHaveClass(/\bon\b/);
  };
  for (const n of [0, 1, 2, 3]) await reach(n);
  // Held still while the words went by: it sits at the same place on the screen for the last two.
  const at3 = await pin.evaluate((p) => Math.round(p.getBoundingClientRect().top));
  await reach(2);
  expect(await pin.evaluate((p) => Math.round(p.getBoundingClientRect().top))).toBe(at3);
  await reach(0);
  await expect(page.locator('.story .s.on')).toHaveCount(1);
  // The words never pass behind the phone.
  for (const f of await page.locator('.story .feat').all()) {
    const [a, b] = await Promise.all([f.boundingBox(), pin.boundingBox()]);
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
  }
});

test('the phone at the top turns with a finger, resists past its limit, and swings back when let go', async ({ page }) => {
  await open(page);
  await arrived(page);
  const mini = page.locator('.mini');
  const turn = () => mini.evaluate((m) => parseFloat(m.style.getPropertyValue('--ty') || '0'));
  await mini.evaluate((m) => m.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const at = await centre(page, '.mini');
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(at.x + i * 10, at.y); await page.waitForTimeout(16); }
  // 1:1: 80px across is a 20° turn (4px of finger a degree).
  expect(await turn()).toBeCloseTo(20, 0);
  for (let i = 9; i <= 30; i++) { await page.mouse.move(at.x + i * 10, at.y); await page.waitForTimeout(16); }
  // 300px would be 75°: past 28° it gives less and less.
  const far = await turn();
  expect(far).toBeGreaterThan(28);
  expect(far).toBeLessThan(45);
  await page.mouse.up();
  await expect.poll(turn).toBe(0);
  // A plain scroll over it is still a scroll (the page isn't held).
  await expect(page.locator('.stage')).not.toHaveClass(/held/);
});

test('"Put it on my iPhone" slides up a sheet with the three steps; Done, Escape or a flick down closes it', async ({ page }) => {
  await open(page);
  await arrived(page);
  const opener = page.getByRole('link', { name: 'Put it on my iPhone' });
  const sheet = page.getByRole('dialog', { name: 'On your iPhone in 20 seconds.' });
  await expect(sheet).toBeHidden();
  await opener.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.pg')).toHaveCount(3);
  // It slides all the way up, the page behind it is out of reach, and the page itself didn't jump.
  await expect.poll(() => sheet.evaluate((s) => new DOMMatrix(getComputedStyle(s).transform).m42)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.locator('main').evaluate((m) => (m as HTMLElement).inert)).toBe(true);
  await expect(sheet).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.sheet-title, .sheet-sub, .sheet-done, .pg:first-child .pt, .pg:first-child .px, .sheet-more'), 1)).toEqual([]);
  // Swiped to the next step: the dots follow.
  await page.locator('#pages').evaluate((p) => p.scrollTo({ left: p.clientWidth, behavior: 'instant' }));
  await expect(page.locator('.pdots i').nth(1)).toHaveClass('on');
  // Done: it slides away, and the button you came from has the focus again.
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.locator('main').evaluate((m) => (m as HTMLElement).inert)).toBe(false);
  // Escape.
  await opener.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  // A flick down on the sheet.
  await opener.click();
  await expect.poll(() => sheet.evaluate((s) => new DOMMatrix(getComputedStyle(s).transform).m42)).toBe(0);
  const g = await centre(page, '.sheet .grab');
  await page.mouse.move(g.x, g.y + 4);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) { await page.mouse.move(g.x, g.y + 4 + i * 30); await page.waitForTimeout(12); }
  await page.mouse.up();
  await expect(sheet).toBeHidden();
  // The full steps and the video: closes the sheet and goes to them.
  await opener.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: 'The video and the full steps' }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => page.locator('#install h2').evaluate((h) => h.getBoundingClientRect().top)).toBeLessThan(200);
});

