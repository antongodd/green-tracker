import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, heroTextBoxes, shot, signUp, settled } from './helpers';

// D22 (0.16.0), D48 (0.41.0): a product whose row has a colour (earned by its score) carries it
// onto its own page, following the Leaderboard's filter and Rank by; on a friend's board too.
// The badge names the colour and the place ("Amethyst · #3 on your Leaderboard"), a holo card
// like its row; #1 wears the crown. Below 8: an ordinary page. Two people in two browsers.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
const ids: Record<string, string> = {};
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const upload = (page: Page) =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#5f7f3d';
    ctx.beginPath();
    ctx.arc(200, 150, 90, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`);
  return { page, name };
}

// Your board (All · Overall): Secret 9.7 (private) · Alpha 9.5 · Charlie 9.3 (edible) · Bravo 9.0
// · Delta 8.5 · Echo 8.0 · Foxtrot 7.0 · Unrated. Gone 9.9 is archived. Under Flower, Bravo is 3rd.
// A follower never sees Secret, so on their view Alpha is 1st and Bravo 3rd.
test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'Gems'));
  ({ page: fan, name: fanName } = await person(browser, 'fan'));
  const seed: [string, Partial<ProductInput>][] = [
    ['Secret', { private: true, ratings: { look: 9.7 } }],
    ['Alpha', { strainType: 'hybrid', country: 'US', ratings: { look: 9.5 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }], photos: [{ upload: await upload(owner), crop: null }] }],
    ['Bravo', { strainType: 'indica', country: 'CA', ratings: { look: 9 } }],
    ['Charlie', { productType: 'edibles', strainType: 'sativa', country: 'NL', ratings: { taste: 9.3, high: 9.3 } }],
    ['Delta', { strainType: 'hybrid', country: 'GB', ratings: { look: 8, taste: 9 } }],
    ['Echo', { ratings: { look: 8 } }],
    ['Foxtrot', { ratings: { look: 7 } }],
    ['Unrated', {}],
    ['Gone', { ratings: { look: 9.9 } }],
  ];
  for (const [name, over] of seed) ids[name] = (await post(owner, '/api/products', P({ name, ...over }))).product.id;
  await post(owner, `/api/products/${ids.Gone}/archived`, { value: true });
  await post(fan, `/api/people/u/${ownerName}/follow`, {});
  await post(owner, `/api/people/requests/${fanName}/approve`, {});
});
test.afterAll(async () => {
  await owner.context().close();
  await fan.context().close();
});

const appearance = (page: Page, a: { preset: string; markFirst: boolean }) =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, a);

/** What the page shows for its colour. data-band is 1–4, or "none" once the list has arrived. */
const pieces = (page: Page) =>
  page.locator('main').evaluate((main) => {
    const hero = main.querySelector<HTMLElement>('.hero')!;
    const photo = main.querySelector<HTMLElement>('.hero-photo')!;
    const score = main.querySelector<HTMLElement>('.hero-score b')!;
    const haze = getComputedStyle(hero, '::after');
    const anim = (el: Element, name: string, pseudo?: string) =>
      // Pseudo-element animations are only listed with subtree: true.
      el.getAnimations({ subtree: true }).find((a) => (a as CSSAnimation).animationName === name && (a.effect as KeyframeEffect).target === el && ((a.effect as KeyframeEffect).pseudoElement ?? undefined) === pseudo);
    return {
      band: main.getAttribute('data-band'),
      badge: main.querySelector('.gem-badge')?.textContent ?? null,
      crown: !!main.querySelector('.gem-badge svg'),
      // The badge is a holo card like its row: a dark layer over the colours, edge in them too.
      holo: (() => { const b = main.querySelector<HTMLElement>('.gem-badge'); return b ? getComputedStyle(b).backgroundClip === 'padding-box, padding-box, border-box' : null; })(),
      // The colour's haze behind the details (D27), stronger band by band.
      haze: haze.content !== 'none' && haze.backgroundImage.includes('linear-gradient') ? haze.opacity : null,
      hazeMs: Number(anim(hero, 'tier-flow-text', '::after')?.effect?.getTiming().duration ?? 0),
      score: getComputedStyle(score).backgroundClip === 'text',
      sweep: getComputedStyle(photo, '::before').content !== 'none',
      sweepDelay: Number(anim(photo, 'tier-arrive', '::before')?.effect?.getTiming().delay ?? 0),
      glints: main.querySelectorAll('.glint').length,
    };
  });

const open = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator('.hero h1')).toBeVisible();
};

test('each colour carries onto its page: Rainbow, Amethyst, Sapphire, Emerald; #1 wears the crown', async () => {
  const expected = [
    ['Secret', { band: '4', badge: 'Rainbow · #1 on your Leaderboard', crown: true, holo: true, haze: '0.14', hazeMs: 5000, score: true, sweep: true, sweepDelay: 250, glints: 0 }],
    ['Alpha', { band: '4', badge: 'Rainbow · #2 on your Leaderboard', crown: false, holo: true, haze: '0.14', hazeMs: 5000, score: true, sweep: true, sweepDelay: 250, glints: 0 }],
    ['Charlie', { band: '3', badge: 'Amethyst · #3 on your Leaderboard', crown: false, holo: true, haze: '0.12', hazeMs: 5000, score: true, sweep: true, sweepDelay: 250, glints: 0 }],
    ['Delta', { band: '2', badge: 'Sapphire · #5 on your Leaderboard', crown: false, holo: true, haze: '0.09', hazeMs: 5000, score: true, sweep: false, sweepDelay: 0, glints: 0 }],
    ['Echo', { band: '1', badge: 'Emerald · #6 on your Leaderboard', crown: false, holo: true, haze: '0.06', hazeMs: 5000, score: true, sweep: false, sweepDelay: 0, glints: 0 }],
  ] as const;
  for (const [name, want] of expected) {
    await open(owner, `/products/${ids[name]}`);
    // The colour arrives with the list, so wait for the real result, not just the page.
    await expect(owner.locator('main')).toHaveAttribute('data-band', want.band);
    expect(await pieces(owner), name).toEqual(want);
    await shot(owner, `90-colour-page-${want.band}-${name}`);
  }
  // Below 8, unrated or archived: an ordinary page.
  for (const name of ['Foxtrot', 'Unrated', 'Gone']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('main')).toHaveAttribute('data-band', 'none'); // the list has arrived
    const got = await pieces(owner);
    expect({ badge: got.badge, haze: got.haze, glints: got.glints }, name).toEqual({ badge: null, haze: null, glints: 0 });
  }
});

test('in Metals, Diamond twinkles clear of every piece of text; axe finds nothing on the colour pages', async () => {
  expect(await appearance(owner, { preset: 'metals', markFirst: true })).toBe(200);
  await open(owner, `/products/${ids.Charlie}`);
  await expect(owner.locator('main')).toHaveAttribute('data-band', '3');
  await expect(owner.locator('.gem-badge')).toHaveText('Diamond · #3 on your Leaderboard');
  await expect(owner.locator('.glint')).toHaveCount(3);
  const overlaps = await owner.locator('main').evaluate((main) => {
    const texts = [...main.querySelectorAll<HTMLElement>('.hero h1, .hero-score b, .hero-score .cap, .hero-line > *, .hero-price, .gem-badge')].map((t) => t.getBoundingClientRect());
    return [...main.querySelectorAll<HTMLElement>('.glint')].flatMap((g) => {
      const r = g.getBoundingClientRect();
      return texts.filter((t) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top).map(() => g.className);
    });
  });
  expect(overlaps).toEqual([]);
  await open(owner, `/products/${ids.Delta}`);
  await expect(owner.locator('.gem-badge')).toHaveText('Rose gold · #5 on your Leaderboard');
  await expect(owner.locator('.glint')).toHaveCount(0);
  expect(await appearance(owner, { preset: 'gems', markFirst: true })).toBe(200);
  for (const name of ['Secret', 'Charlie', 'Delta', 'Echo']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.gem-badge')).toBeVisible();
    await settled(owner);
    const { violations } = await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => v.id), name).toEqual([]);
  }
});

test('the page follows your Type and Rank by, also when opened from the Log; an uncoloured #1 wears gold', async () => {
  await owner.goto('/');
  await owner.getByLabel('Type', { exact: true }).selectOption('flower');
  await expect(owner.locator('.row.first')).toHaveCount(1);
  // 4th under All, 3rd under Flower.
  await owner.locator('.row', { hasText: 'Bravo' }).click();
  await expect(owner.locator('.gem-badge')).toHaveText('Amethyst · #3 in Flower');
  await expect(owner.locator('main')).toHaveAttribute('data-band', '3');

  // The edible isn't on a Flower board, so its page is ordinary.
  await open(owner, `/products/${ids.Charlie}`);
  await expect(owner.locator('main')).toHaveAttribute('data-band', 'none');
  await expect(owner.locator('.gem-badge')).toHaveCount(0);

  // Flower by Taste: only Delta has a Taste (9), so it tops that list in Amethyst, with the crown — from the Log as well.
  await owner.goto('/');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('taste');
  await expect(owner.locator('.row')).toHaveCount(1);
  await owner.getByRole('link', { name: 'Log', exact: true }).click();
  await owner.locator('.lrow', { hasText: 'Delta' }).click();
  await expect(owner.locator('.gem-badge')).toHaveText('Amethyst · #1 in Flower by Taste');
  await expect(owner.locator('.gem-badge svg')).toHaveCount(1);
  await expect(owner.locator('main')).toHaveAttribute('data-band', '3');

  // Flower by Price: a price isn't a score, so no colour; its #1 still wears the crown, in gold.
  await owner.goto('/');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('price');
  await expect(owner.locator('.row')).toHaveCount(1);
  await expect(owner.locator('.row').first()).toHaveClass(/\bfirst\b/);
  await expect(owner.locator('.row.tier')).toHaveCount(0);
  await owner.locator('.row').first().click();
  await expect(owner.locator('.gem-badge')).toHaveText('#1 in Flower by Price per gram');
  // Opened directly for the readability check, so Photo grows isn't mid-flight (D20).
  await open(owner, `/products/${ids.Alpha}`);
  await expect(owner.locator('.gem-badge')).toHaveText('#1 in Flower by Price per gram');
  await expect(owner.locator('.gem-badge')).toHaveClass(/\bplain\b/);
  await expect(owner.locator('main')).toHaveAttribute('data-band', 'none');
  await settled(owner);
  const worst = await contrastFailures(owner, await heroTextBoxes(owner), 4);
  expect(worst, worst.join('\n')).toEqual([]);

  // Back to All · Overall.
  await owner.goto('/');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('overall');
  await owner.getByLabel('Type', { exact: true }).selectOption('all');
  await expect(owner.locator('.row.tier')).toHaveCount(6);
});

test('#1 unmarked: no crown or halo on the row or the page, the colour stays', async () => {
  expect(await appearance(owner, { preset: 'gems', markFirst: false })).toBe(200);
  await owner.goto('/');
  await expect(owner.locator('.row.tier')).toHaveCount(6);
  await expect(owner.locator('.row.first, .rank-crown')).toHaveCount(0);
  await open(owner, `/products/${ids.Secret}`);
  await expect(owner.locator('.gem-badge')).toHaveText('Rainbow · #1 on your Leaderboard');
  await expect(owner.locator('.gem-badge svg')).toHaveCount(0);
  expect(await appearance(owner, { preset: 'gems', markFirst: true })).toBe(200);
});

test('text stays readable on every colour page throughout the motion', async () => {
  test.slow(); // 48 photographs
  for (const name of ['Secret', 'Alpha', 'Charlie', 'Delta', 'Echo']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.gem-badge')).toBeVisible();
    const boxes = await heroTextBoxes(owner);
    const worst = await contrastFailures(owner, boxes);
    expect(worst, `${name}:\n${worst.join('\n')}`).toEqual([]);
  }
});

test('Reduce Motion keeps the colours but nothing moves, sweeps or twinkles', async () => {
  await owner.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, haze] of [['Secret', '0.14'], ['Charlie', '0.12'], ['Delta', '0.09'], ['Echo', '0.06']] as const) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.gem-badge')).toBeVisible();
    const got = await pieces(owner);
    expect({ haze: got.haze, score: got.score, holo: got.holo, hazeMs: got.hazeMs, sweep: got.sweep }).toEqual({ haze, score: true, holo: true, hazeMs: 0, sweep: false });
    // (The screen's own entrance fade is kept under Reduce Motion; only the colours' motion stops.)
    expect(await owner.locator('main').evaluate((m) => m.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName).filter((n) => /^(tier|first)-/.test(n)))).toEqual([]);
  }
  await owner.emulateMedia({ reducedMotion: 'no-preference' });
});

test('a friend’s product page gets its colour and place on their board, worked out only from what you can see, in your preset', async () => {
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row.tier')).toHaveCount(5);
  await fan.locator('.row', { hasText: 'Alpha' }).click();
  await expect(fan.locator('.gem-badge')).toHaveText('Rainbow · #1 on their Leaderboard');
  await expect(fan.locator('main')).toHaveAttribute('data-band', '4');
  expect(await pieces(fan)).toMatchObject({ crown: true, haze: '0.14', score: true, sweep: true, glints: 0 });
  // The Poster (D27) on their page too, without a price.
  await expect(fan.locator('.poster .hero-photo')).toBeVisible();
  await expect(fan.locator('.hero-price')).toHaveCount(0);
  await shot(fan, '91-colour-friend-page');

  await open(fan, `/u/${ownerName}/p/${ids.Bravo}`);
  await expect(fan.locator('.gem-badge')).toHaveText('Amethyst · #3 on their Leaderboard');
  expect(await pieces(fan)).toMatchObject({ holo: true, haze: '0.12', score: true });
  await open(fan, `/u/${ownerName}/p/${ids.Foxtrot}`);
  await expect(fan.locator('main')).toHaveAttribute('data-band', 'none');
  await expect(fan.locator('.gem-badge')).toHaveCount(0);

  // The fan's own preset, not the owner's.
  expect(await appearance(fan, { preset: 'prism', markFirst: true })).toBe(200);
  await open(fan, `/u/${ownerName}/p/${ids.Delta}`);
  await expect(fan.locator('.gem-badge')).toHaveText('Prism · #4 on their Leaderboard');
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row.tier.pal-prism')).toHaveCount(5);
});
