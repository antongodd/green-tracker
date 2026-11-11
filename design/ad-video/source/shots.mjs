// The shots, in the order they must be filmed (the editor saves the star, the post is really posted…).
// node shots.mjs            every shot, on a freshly seeded copy (./reset.sh first)
// node shots.mjs board …    only those (ones that don't change anything can be re-filmed any time)
import { shot, open, api, BASE, seed, ready, browser, center, ease } from './film.mjs';
const want = process.argv.slice(2);
const on = (n) => !want.length || want.includes(n);
const rect = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });

if (on('home')) {
  const page = await open('me');
  await page.goto(BASE + '/');
  await ready(page, '.tier');
  const s = await shot('home', page);
  await s.run(100);
  s.save();
  await page.context().close();
}

if (on('editor')) {
  const page = await open('me');
  await page.goto(BASE + `/products/${seed.star}/edit`);
  await ready(page, '[role=slider]');
  // Dressed as a new product: the draft already holds the cut-out photo (made by the app's own Remove background).
  await page.evaluate(() => {
    const t = document.querySelector('.hdr .title');
    const fix = () => { if (t.textContent !== 'New product') t.textContent = 'New product'; };
    fix(); new MutationObserver(fix).observe(t, { childList: true, characterData: true, subtree: true });
  });
  const name = page.getByRole('textbox').first();
  await name.fill('');
  await name.evaluate((e) => { e.placeholder = 'e.g. Lemon Cherry Gelato'; e.blur(); });
  await page.waitForTimeout(300);
  const s = await shot('editor', page);
  s.finger({ x: 300, y: 640, down: false });
  await s.run(14);
  await s.tap(name, { glide: 9, hold: 2, act: () => name.focus() });
  s.finger(null);
  s.mark('type');
  for (const ch of 'Zkittlez') { await page.keyboard.type(ch); await s.run(3); }
  await s.run(6);
  s.mark('typed');
  await page.evaluate(() => document.activeElement?.blur());
  const sat = page.getByRole('radio', { name: 'Sativa', exact: true });
  s.finger({ x: 250, y: 420, down: false });
  await s.tap(sat, { glide: 9, hold: 3 });
  await s.run(8);
  s.mark('scroll');
  const look = page.getByRole('slider', { name: 'Look', exact: true });
  const y = (await look.boundingBox()).y + (await page.evaluate(() => scrollY)) - 250;
  s.finger(null);
  await s.scroll(y, 22);
  s.mark('rate');
  async function drag(label, v, k) {
    const sl = page.getByRole('slider', { name: label, exact: true });
    const b = await sl.boundingBox();
    const at = (val) => ({ x: b.x + 12 + ((val - 1) / 9) * (b.width - 24), y: b.y + b.height / 2 });
    const a = at(5);
    await s.glide(a, 7);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    s.finger({ ...a, down: true });
    await s.run(2);
    await s.run(k, async (i) => { const p = at(5 + (v - 5) * ease((i + 1) / k)); await page.mouse.move(p.x, p.y); s.finger({ ...p, down: true }); });
    await page.mouse.up();
    let now = Number(await sl.getAttribute('aria-valuenow'));
    await sl.focus();
    for (let n = Math.round((v - now) * 10); n !== 0; n += n > 0 ? -1 : 1) await page.keyboard.press(n > 0 ? 'ArrowRight' : 'ArrowLeft');
    await page.evaluate(() => document.activeElement?.blur());
    s.finger({ ...at(v), down: false });
    await s.run(3);
    console.log(label, now, '->', await sl.getAttribute('aria-valuenow'));
  }
  await drag('Look', 9.5, 26);
  s.mark('rated1');
  await drag('Smell', 10, 13);
  await drag('Taste', 9.5, 12);
  await drag('Burn', 9, 12);
  await drag('High', 10, 12);
  await s.run(10);
  s.mark('save');
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await s.tap(save, { glide: 9, hold: 4, act: async () => { await save.click(); await page.waitForURL(/\/products\/[^/]+$/); await ready(page, '.hero-photo img'); } });
  s.mark('saved');
  s.finger(null);
  await s.run(70);
  s.save();
  await page.context().close();
}

if (on('board')) {
  const page = await open('me');
  await page.goto(BASE + '/');
  await ready(page, '.tier');
  const s = await shot('board', page);
  s.mark('row1', await rect(page.locator('.tier').first()));
  await s.run(80);
  s.mark('scroll');
  await s.scroll(560, 100);
  await s.run(30);
  s.save();
  await page.context().close();
}

if (on('strainz')) {
  const page = await open('me');
  await page.goto(BASE + '/strainz');
  await ready(page, '.ltitle');
  const s = await shot('strainz', page);
  await s.run(40);
  // Swipe the Most tried shelf sideways.
  const shelf = page.getByRole('list', { name: 'Most tried', exact: true });
  const b = await shelf.boundingBox();
  await shelf.evaluate((el) => { let e = el; while (e && e.scrollWidth <= e.clientWidth + 4) e = e.parentElement; window.__shelf = e; });
  const max = await page.evaluate(() => Math.min(300, window.__shelf.scrollWidth - window.__shelf.clientWidth));
  const y = b.y + 70;
  await s.glide({ x: 320, y }, 10);
  s.finger({ x: 320, y, down: true }); await s.run(2);
  await s.run(22, async (i) => { const t = ease((i + 1) / 22); await page.evaluate((x) => (window.__shelf.scrollLeft = x), max * t); s.finger({ x: 320 - 230 * Math.min(1, t * 1.25), y, down: t < 0.8 }); });
  s.finger(null);
  await s.run(16);
  s.mark('tap');
  const z = page.getByRole('list', { name: 'Your favourites', exact: true }).locator('a').filter({ hasText: 'Zkittlez' }).first();
  s.finger({ x: 200, y: y - 60, down: false });
  await s.tap(z, { glide: 10, hold: 3, act: async () => { await z.click(); await page.waitForURL(/\/strainz\/Zkittlez/); await ready(page, 'text=Friends who’ve tried it'); } });
  s.mark('page');
  s.finger(null);
  await s.run(55);
  s.mark('scroll');
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await s.scroll(end, 50);
  await s.run(50);
  s.save();
  await page.context().close();
}

if (on('sources')) {
  const page = await open('me');
  await page.goto(BASE + '/sources');
  await ready(page, '.ltitle');
  const s = await shot('sources', page);
  await s.run(40);
  const card = page.locator('a', { hasText: 'The Grove' }).first();
  const y = (await card.boundingBox()).y - 330;
  await s.scroll(y, 34);
  await s.run(14);
  s.mark('tap');
  s.finger({ x: 300, y: 560, down: false });
  await s.tap(card, { glide: 10, hold: 3, act: async () => { await card.click(); await page.waitForURL(/\/brands\//); await ready(page, '.tier'); } });
  s.mark('page');
  s.finger(null);
  s.mark('stats', await rect(page.getByText('spent').first()));
  await s.run(90);
  s.save();
  await page.context().close();
}

if (on('post')) {
  const page = await open('me');
  await page.goto(BASE + '/feed/new/p/' + seed.star);
  const cap = page.getByRole('textbox').last();
  await ready(page, 'textarea, [role=textbox]');
  const s = await shot('post', page);
  await s.run(24);
  const y = (await cap.boundingBox()).y - 300;
  if (y > 0) await s.scroll(y, 18);
  s.finger({ x: 300, y: 600, down: false });
  await s.tap(cap, { glide: 9, hold: 2, act: () => cap.focus() });
  s.finger(null);
  s.mark('type');
  for (const ch of [...'last week’s winner ', '🔥']) { await page.keyboard.insertText(ch); await s.run(2); }
  await s.run(10);
  s.mark('typed');
  await page.evaluate(() => document.activeElement?.blur());
  const post = page.getByRole('button', { name: 'Post', exact: true });
  s.finger({ x: 280, y: 520, down: false });
  await s.tap(post, { glide: 9, hold: 4, act: async () => { await post.click(); await page.waitForURL(/\/feed$/); await ready(page, '.post img'); } });
  s.mark('feed');
  s.finger(null);
  await s.run(36);
  // The (made-up) friends react; tapping the Feed tab again brings it in, as it does on the phone.
  const id = (await api('me', 'GET', '/api/posts/feed')).posts[0].id;
  for (const w of ['jay', 'mira', 'kofi']) await api(w, 'PUT', `/api/posts/${id}/fire`);
  await api('jay', 'POST', `/api/posts/${id}/comments`, { body: 'THAT’S the one from mine 😮‍💨' });
  await api('mira', 'POST', `/api/posts/${id}/comments`, { body: 'need to try this 👀' });
  await page.locator('.tabs a.tab').nth(3).click();
  await page.getByText('need to try this').waitFor();
  await ready(page, '.post img');
  s.mark('react');
  await s.run(16);
  const pb = await page.locator('.post').first().boundingBox();
  await s.scroll(Math.max(0, pb.y + pb.height - 700 + (await page.evaluate(() => scrollY))), 30);
  await s.run(60);
  s.save();
  await page.context().close();
}

if (on('mates')) {
  // "You've had this too" needs the same name, Source and type on both: give both the same (made-up) grower now,
  // after the Leaderboard was filmed with the plain new product.
  for (const [who, id] of [['me', seed.star], ['jay', seed.fr.jay.Zkittlez]]) {
    const p = (await api(who, 'GET', '/api/products')).products.find((x) => x.id === id);
    await api(who, 'PUT', `/api/products/${id}`, { ...p, source: 'Rainbow Farm', photos: p.photos.map((ph) => ({ id: ph.id })) });
  }
  const page = await open('me');
  await page.goto(BASE + `/u/jay/p/${seed.fr.jay.Zkittlez}`);
  await ready(page, '.hero-photo img');
  await page.waitForFunction(() => !document.documentElement.classList.contains('vt-look'));
  await page.waitForTimeout(600);
  let s = await shot('mates1', page);
  await s.run(40);
  const had = page.getByText(/had this too/i).first();
  const y = (await had.boundingBox()).y - 190;
  s.mark('scroll');
  await s.scroll(y, 34);
  s.mark('duel', await rect(had));
  await s.run(80);
  s.save();
  await page.goto(BASE + '/u/jay');
  await page.locator('.page-tabs').getByRole('tab', { name: 'Strainz' }).click();
  await ready(page, 'text=You’ve both tried');
  await page.waitForFunction(() => !document.documentElement.classList.contains('vt-look'));
  await page.waitForTimeout(600);
  s = await shot('mates2', page);
  await s.run(90);
  s.save();
  await page.context().close();
}

if (on('private') || on('private2')) {
  const page = await open('me');
  let s;
  if (!want.includes('private2')) {
  await page.goto(BASE + '/people');
  await page.getByText('Requests').first().click();
  await ready(page, 'text=Approve');
  s = await shot('private1', page);
  s.finger({ x: 250, y: 620, down: false });
  await s.run(16);
  const ok = page.getByRole('button', { name: /Approve/ }).first();
  await s.tap(ok, { glide: 10, hold: 3, act: async () => { await ok.click(); await page.waitForTimeout(700); } });
  s.mark('done');
  s.finger(null);
  await s.run(50);
  s.save();
  }
  await page.goto(BASE + `/products/${seed.ids['Peanut Butter']}`);
  await ready(page, '.acts');
  const sw = page.locator('.acts').getByRole('switch').first();
  if (await sw.isChecked()) { await sw.click({ force: true }); await page.waitForTimeout(600); }
  await page.evaluate(() => scrollTo(0, document.querySelector('.acts').getBoundingClientRect().top + scrollY - 330));
  await page.waitForTimeout(400);
  s = await shot('private2', page);
  s.mark('row', await rect(page.locator('.acts > *').first()));
  s.finger({ x: 200, y: 640, down: false });
  await s.run(14);
  const rb = await page.locator('.acts > *').first().boundingBox();
  const at = { x: rb.x + rb.width - 42, y: rb.y + rb.height / 2 };
  await s.glide(at, 10);
  s.finger({ ...at, down: true }); await s.run(3);
  await sw.click({ force: true }); await page.waitForTimeout(100);
  s.finger({ ...at, down: false });
  s.mark('done');
  await s.run(8);
  s.finger(null);
  await s.run(45);
  s.save();
  await page.context().close();
}

if (on('looks') || want.includes('daysky')) {
  for (const [look, preset] of (want.includes('daysky') ? [['daysky', 'prism'], ['aurora', 'aurora']] : [['sakura', 'candy'], ['deepsea', 'deepsea'], ['lava', 'ember'], ['nebula', 'cosmos'], ['outrun', 'synthwave'], ['daysky', 'prism'], ['aurora', 'aurora']])) {
    await api('me', 'PUT', '/api/appearance', { look, top: 'strip', preset, markFirst: true });
    const page = await open('me');
    await page.goto(BASE + '/');
    await ready(page, '.tier');
    await page.waitForTimeout(500);
    const s = await shot('look-' + look, page);
    await s.run(look === 'aurora' ? 4 : 50);
    s.save();
    await page.context().close();
  }
}
await browser.close();
