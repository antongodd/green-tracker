// Films the real app (the private local copy) frame by frame: every video frame is a real screenshot.
// Writes film/<shot>/NNN.png and film/<shot>.json ([{ f: file, finger: {x,y,down}|null }], one per 1/30s).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const W = new URL('.', import.meta.url).pathname;
const BASE = 'http://localhost:8790';
const seed = JSON.parse(readFileSync(W + 'seed.json'));
const which = process.argv[2];
const SCALE = 3;

const browser = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
async function open(who) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: SCALE, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => {
    const set = () => { document.documentElement.style.setProperty('--safe-top', '50px'); document.documentElement.style.setProperty('--safe-bottom', '30px'); };
    if (document.documentElement) set();
    document.addEventListener('DOMContentLoaded', set);
  });
  await ctx.addCookies(Object.entries(seed[who]).map(([name, value]) => ({ name, value, url: BASE })));
  return ctx.newPage();
}

function recorder(shot, page) {
  const dir = `${W}film/${shot}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let n = 0, last = null;
  return {
    frames,
    // A new real screenshot, held for `hold` frames.
    async snap(finger = null, hold = 1) {
      const f = `${String(n++).padStart(3, '0')}.png`;
      await page.screenshot({ path: `${dir}/${f}` });
      last = f;
      for (let i = 0; i < hold; i++) frames.push({ f: `${shot}/${f}`, finger });
    },
    // Repeat the last screenshot (nothing changed on screen), e.g. while the finger moves.
    hold(finger = null, k = 1) { for (let i = 0; i < k; i++) frames.push({ f: `${shot}/${last}`, finger }); },
    save() { writeFileSync(`${W}film/${shot}.json`, JSON.stringify(frames)); console.log(shot, frames.length, 'frames,', n, 'shots'); },
  };
}
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// The finger glides from a to b over k frames (screen unchanged).
function glide(r, a, b, k) { for (let i = 1; i <= k; i++) { const t = ease(i / k); r.hold({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, down: false }); } }

if (which === 'editor') {
  const page = await open('me');
  await page.goto(BASE + '/products/new');
  await page.getByPlaceholder(/^e\.g\./).first().waitFor();
  await page.evaluate(() => { const i = document.querySelector('input[placeholder^="e.g."]'); i.placeholder = 'e.g. Zombie Kush'; });
  await page.waitForTimeout(1500);
  const r = recorder('editor', page);
  const nameBox = page.getByPlaceholder(/^e\.g\./).first();
  const nameAt = await center(nameBox);
  const rest = { x: 300, y: 700 };
  await r.snap({ ...rest, down: false }, 2);
  glide(r, rest, nameAt, 7);
  await nameBox.focus();
  await r.snap({ ...nameAt, down: true }, 2);
  for (const ch of 'Mega Z Emerald') { await page.keyboard.type(ch); await r.snap(null, 2); }
  // The photo.
  const add = page.getByText('Add photos');
  const addAt = await center(add);
  glide(r, { x: 330, y: 420 }, addAt, 6);
  await r.snap({ ...addAt, down: true }, 2);
  const fc = page.waitForEvent('filechooser');
  await add.click();
  await (await fc).setFiles(W + 'nugs/mega-z-emerald-o.jpg');
  await page.locator('.pslot img').first().waitFor();
  await page.waitForTimeout(150);
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(60); await r.snap(null, 1); }
  // Hybrid.
  const hybrid = page.getByRole('radio', { name: 'Hybrid', exact: true });
  const hyAt = await center(hybrid);
  glide(r, addAt, hyAt, 6);
  await hybrid.click();
  await r.snap({ ...hyAt, down: true }, 2);
  await page.waitForTimeout(250);
  await r.snap(null, 3);
  // Scroll down to the Ratings (real scroll positions, eased).
  const look = page.locator('.rate .slider').first();
  const target = (await look.boundingBox()).y + (await page.evaluate(() => scrollY)) - 300;
  for (let i = 1; i <= 14; i++) { await page.evaluate((y) => scrollTo(0, y), target * ease(i / 14)); await r.snap(null, 1); }
  // Drag the Look slider from where it rests to 9.5.
  const box = await look.boundingBox();
  const at = (v) => ({ x: box.x + 12 + ((v - 1) / 9) * (box.width - 24), y: box.y + box.height / 2 });
  const from = at(1);
  await r.snap({ ...from, down: false }, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await r.snap({ ...from, down: true }, 1);
  const steps = 26;
  for (let i = 1; i <= steps; i++) {
    const p = at(1 + 8.5 * ease(i / steps));
    await page.mouse.move(p.x, p.y);
    await r.snap({ ...p, down: true }, 1);
  }
  await page.mouse.up();
  const end = at(9.5);
  await r.snap({ ...end, down: false }, 10);
  console.log('look value', await page.locator('.rate .slider').first().getAttribute('aria-valuenow'));
  // Press Save (held down, never let go: the real product is added through the API with its cut-out).
  const save = page.getByRole('button', { name: 'Save', exact: true });
  const sAt = await center(save);
  glide(r, end, sAt, 7);
  await page.mouse.move(sAt.x, sAt.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await r.snap({ ...sAt, down: true }, 6);
  r.save();
}

if (which === 'board') {
  const page = await open('me');
  await page.goto(BASE + '/');
  await page.locator('.tier').first().waitFor();
  await page.waitForTimeout(2500);
  const r = recorder('board', page);
  await r.snap(null, 1);
  await page.evaluate(() => document.querySelectorAll('nav.nav, .tabs, .fab').forEach((e) => (e.style.visibility = 'hidden')));
  await page.waitForTimeout(300);
  await page.screenshot({ path: W + 'film/board-notab.png' });
  const rows = await page.locator('a:has(.tier), .tier').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { y: b.top, h: b.height, x: b.left, w: b.width, t: e.textContent.trim().slice(0, 30) }; }));
  writeFileSync(W + 'film/board-rows.json', JSON.stringify(rows));
  console.log(rows.slice(0, 7));
  r.save();
}

if (which === 'friend') {
  const page = await open('me');
  await page.goto(BASE + '/u/mira/p/' + seed.theirs);
  await page.getByText(/had this too/i).first().waitFor();
  await page.waitForTimeout(2500);
  const r = recorder('friend', page);
  await r.snap(null, 6);
  const target = (await page.getByText(/had this too/i).first().boundingBox()).y - 330;
  for (let i = 1; i <= 18; i++) { await page.evaluate((y) => scrollTo(0, y), target * ease(i / 18)); await r.snap(null, 1); }
  await page.waitForTimeout(600);
  await r.snap(null, 1);
  const ring = await page.getByText(/had this too/i).first().evaluate((el) => { let e = el; while (e.getBoundingClientRect().height < 150) e = e.parentElement; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  writeFileSync(W + 'film/friend-ring.json', JSON.stringify(ring));
  console.log(ring);
  r.save();
}
async function api(who, method, path, body) {
  const cookie = Object.entries(seed[who]).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch(BASE + path, { method, headers: { cookie, origin: BASE, 'cf-connecting-ip': who === 'me' ? '10.9.0.1' : '10.9.0.2', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

if (which === 'feed') {
  const page = await open('me');
  await page.goto(BASE + '/feed/new/p/' + seed.mega);
  const cap = page.getByRole('textbox').last();
  await cap.waitFor();
  await page.waitForTimeout(2000);
  const r = recorder('feed', page);
  const rest = { x: 300, y: 650 };
  await r.snap({ ...rest, down: false }, 4);
  await cap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const capAt = await center(cap);
  await r.snap({ ...rest, down: false }, 1);
  glide(r, rest, capAt, 6);
  await cap.focus();
  await r.snap({ ...capAt, down: true }, 2);
  for (const ch of ['n', 'e', 'w', ' ', '#', '1', ' ', '🔥']) { await page.keyboard.insertText(ch); await r.snap(null, 2); }
  await r.snap(null, 3);
  const post = page.getByRole('button', { name: 'Post', exact: true });
  const pAt = await center(post);
  glide(r, capAt, pAt, 6);
  await page.mouse.move(pAt.x, pAt.y);
  await page.mouse.down();
  await r.snap({ ...pAt, down: true }, 3);
  await page.mouse.up();
  await page.waitForURL(/\/feed$/);
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(45); await r.snap(null, 1); }
  await page.locator('article, .post').first().waitFor();
  await page.waitForTimeout(500);
  await r.snap(null, 10);
  // @mira (made up) fires it and comments; the Feed tab tapped again shows it.
  const list = await api('me', 'GET', '/api/posts/feed');
  const id = (list.posts ?? list.items ?? [])[0]?.id;
  console.log('post', id, Object.keys(list));
  await api('friend', 'PUT', `/api/posts/${id}/fire`);
  await api('friend', 'POST', `/api/posts/${id}/comments`, { body: 'need to try this 👀' });
  const tab = page.locator('.tabs a.tab').nth(3);
  await tab.click();
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(60); await r.snap(null, 1); }
  await page.waitForTimeout(800);
  await r.snap(null, 20);
  r.save();
}

if (which === 'sources') {
  const page = await open('me');
  await page.goto(BASE + '/sources');
  const card = page.locator('a', { hasText: 'The Grove' }).first();
  await card.waitFor();
  await page.waitForTimeout(2200);
  const r = recorder('sources', page);
  const rest = { x: 120, y: 700 };
  await r.snap({ ...rest, down: false }, 12);
  const cAt = await center(card);
  glide(r, rest, cAt, 8);
  await page.mouse.move(cAt.x, cAt.y);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await r.snap({ ...cAt, down: true }, 3);
  await page.mouse.up();
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(40); await r.snap(null, 1); }
  await page.waitForTimeout(800);
  await r.snap(null, 40);
  r.save();
}
await browser.close();
