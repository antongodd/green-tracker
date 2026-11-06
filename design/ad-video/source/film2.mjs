// Films only settled screens of the real app (nothing caught mid-animation); the video draws the moves between them.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const W = new URL('.', import.meta.url).pathname;
const BASE = 'http://localhost:8790';
const seed = JSON.parse(readFileSync(W + 'seed.json'));
const which = process.argv[2];
const browser = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8' } });
async function open(who) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Europe/London' });
  await ctx.addInitScript(() => {
    const set = () => { document.documentElement.style.setProperty('--safe-top', '50px'); document.documentElement.style.setProperty('--safe-bottom', '30px'); };
    if (document.documentElement) set();
    document.addEventListener('DOMContentLoaded', set);
  });
  await ctx.addCookies(Object.entries(seed[who]).map(([name, value]) => ({ name, value, url: BASE })));
  return ctx.newPage();
}
async function api(who, method, path, body) {
  const cookie = Object.entries(seed[who]).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch(BASE + path, { method, headers: { cookie, origin: BASE, 'cf-connecting-ip': who === 'me' ? '10.9.0.1' : '10.9.0.2', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
// Waits until nothing on the page is animating, then a beat more.
async function settle(page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
}
function dir(shot) { const d = `${W}film/${shot}`; rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); return d; }

if (which === 'feed') {
  const d = dir('feed2');
  const meta = {};
  const page = await open('me');
  await page.goto(BASE + '/feed/new/p/' + seed.mega);
  const cap = page.getByRole('textbox').last();
  await cap.waitFor();
  await settle(page);
  await cap.scrollIntoViewIfNeeded();
  await settle(page);
  await page.screenshot({ path: `${d}/c0.png` });
  meta.caption = await center(cap);
  await cap.focus();
  await settle(page);
  await page.screenshot({ path: `${d}/c-focus.png` });
  const text = ['n', 'e', 'w', ' ', '#', '1', ' ', '🔥'];
  for (const [i, ch] of text.entries()) { await page.keyboard.insertText(ch); await page.waitForTimeout(120); await page.screenshot({ path: `${d}/c${i + 1}.png` }); }
  meta.chars = text.length;
  const post = page.getByRole('button', { name: 'Post', exact: true });
  meta.post = await center(post);
  await page.mouse.move(meta.post.x, meta.post.y);
  await page.mouse.down();
  await settle(page);
  await page.screenshot({ path: `${d}/c-press.png` });
  await page.mouse.up();
  await page.waitForURL(/\/feed$/);
  await page.locator('article, .post').first().waitFor();
  await settle(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${d}/feed-before.png` });
  const list = await api('me', 'GET', '/api/posts/feed');
  const id = list.posts[0].id;
  await api('friend', 'PUT', `/api/posts/${id}/fire`);
  await api('friend', 'POST', `/api/posts/${id}/comments`, { body: 'need to try this 👀' });
  await page.locator('.tabs a.tab').nth(3).click();
  await page.getByText('need to try this').waitFor();
  await settle(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${d}/feed-after.png` });
  writeFileSync(`${W}film/feed2.json`, JSON.stringify(meta));
  console.log(meta);
}

if (which === 'sources') {
  const d = dir('sources2');
  const meta = {};
  const page = await open('me');
  await page.goto(BASE + '/sources');
  const card = page.locator('a', { hasText: 'The Grove' }).first();
  await card.waitFor();
  await settle(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${d}/sources.png` });
  meta.card = await center(card);
  await page.mouse.move(meta.card.x, meta.card.y);
  await page.mouse.down();
  await settle(page);
  await page.screenshot({ path: `${d}/sources-press.png` });
  await page.mouse.up();
  await page.waitForURL(/\/brands\//);
  await page.getByText('Everything you bought at').waitFor();
  await settle(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${d}/grove.png` });
  meta.stats = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter((e) => /199/.test(e.textContent) && /average/i.test(e.textContent));
    if (!els.length) return { debug: document.body.innerText.slice(0, 300) };
    const e = els.sort((a, b) => a.getBoundingClientRect().height * a.getBoundingClientRect().width - b.getBoundingClientRect().height * b.getBoundingClientRect().width)[0];
    const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  writeFileSync(`${W}film/sources2.json`, JSON.stringify(meta));
  console.log(meta);
}
await browser.close();
