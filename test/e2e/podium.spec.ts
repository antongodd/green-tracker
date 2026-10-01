import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { contrastFailures, heroTextBoxes, shot, signUp, settled } from './helpers';

// D22 (0.16.0): a product on the podium carries its row's tier onto its own page,
// following the Leaderboard's filter and Rank by; on a friend's board too. Since D39
// (0.32.0) the podium is three places (rainbow, Diamond, Gold), each page's badge a holo
// card like its row; 4th is an ordinary page. Two people in two browsers.
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
// · Delta 8.5 · Echo 8.0 · Unrated. Gone 9.9 is archived. Under Flower, Bravo moves up to 3rd.
// A follower never sees Secret, so on their view Alpha is 1st and Bravo 3rd.
test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'Podi'));
  ({ page: fan, name: fanName } = await person(browser, 'fan'));
  const seed: [string, Partial<ProductInput>][] = [
    ['Secret', { private: true, ratings: { look: 9.7 } }],
    ['Alpha', { strainType: 'hybrid', country: 'US', ratings: { look: 9.5 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: null }], photos: [{ upload: await upload(owner), crop: null }] }],
    ['Bravo', { strainType: 'indica', country: 'CA', ratings: { look: 9 } }],
    ['Charlie', { productType: 'edibles', strainType: 'sativa', country: 'NL', ratings: { taste: 9.3, high: 9.3 } }],
    ['Delta', { strainType: 'hybrid', country: 'GB', ratings: { look: 8, taste: 9 } }],
    ['Echo', { ratings: { look: 8 } }],
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

/** What the page shows for its podium place. data-podium is 1–3, or "none" once the list has arrived. */
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
      podium: main.getAttribute('data-podium'),
      badge: main.querySelector('.podium-badge')?.textContent ?? null,
      crown: !!main.querySelector('.podium-badge svg'),
      // The badge is a holo card like its row (D39): a dark layer over the tier's colours, edge in them too.
      holo: (() => { const b = main.querySelector<HTMLElement>('.podium-badge'); return b ? getComputedStyle(b).backgroundClip === 'padding-box, padding-box, border-box' : null; })(),
      // The tier haze behind the details (D27).
      haze: haze.content !== 'none' && haze.backgroundImage.includes('linear-gradient') ? haze.opacity : null,
      hazeMs: Number(anim(hero, 'tier-flow-text', '::after')?.effect?.getTiming().duration ?? 0),
      score: getComputedStyle(score).backgroundClip === 'text',
      sweep: getComputedStyle(photo, '::before').content !== 'none',
      sweepDelay: Number(anim(photo, 'podium-arrive', '::before')?.effect?.getTiming().delay ?? 0),
      glints: main.querySelectorAll('.glint').length,
    };
  });

const open = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator('.hero h1')).toBeVisible();
};

test('each podium place carries its tier onto its page: rainbow, Diamond, Gold', async () => {
  const expected = [
    ['Secret', { podium: '1', badge: '#1 on your Leaderboard', crown: true, holo: true, haze: '0.14', hazeMs: 5000, score: true, sweep: true, sweepDelay: 250, glints: 0 }],
    ['Alpha', { podium: '2', badge: '#2 on your Leaderboard', crown: false, holo: true, haze: '0.14', hazeMs: 5000, score: true, sweep: true, sweepDelay: 250, glints: 3 }],
    ['Charlie', { podium: '3', badge: '#3 on your Leaderboard', crown: false, holo: true, haze: '0.12', hazeMs: 5000, score: true, sweep: false, sweepDelay: 0, glints: 0 }],
  ] as const;
  for (const [name, want] of expected) {
    await open(owner, `/products/${ids[name]}`);
    // The place arrives with the list, so wait for the real result, not just the page.
    await expect(owner.locator('main')).toHaveAttribute('data-podium', want.podium);
    expect(await pieces(owner), name).toEqual(want);
    await shot(owner, `90-podium-page-${want.podium}`);
  }
  // Outside the top three (4th included, D39), unrated or archived: an ordinary page.
  for (const name of ['Bravo', 'Delta', 'Echo', 'Unrated', 'Gone']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('main')).toHaveAttribute('data-podium', 'none'); // the list has arrived
    const got = await pieces(owner);
    expect({ badge: got.badge, haze: got.haze, glints: got.glints }, name).toEqual({ badge: null, haze: null, glints: 0 });
  }
});

test('Diamond’s glints stay clear of every piece of text; axe finds nothing on 1st and 2nd', async () => {
  await open(owner, `/products/${ids.Alpha}`);
  await expect(owner.locator('main')).toHaveAttribute('data-podium', '2');
  const overlaps = await owner.locator('main').evaluate((main) => {
    const texts = [...main.querySelectorAll<HTMLElement>('.hero h1, .hero-score b, .hero-score .cap, .hero-line > *, .hero-price, .podium-badge')].map((t) => t.getBoundingClientRect());
    return [...main.querySelectorAll<HTMLElement>('.glint')].flatMap((g) => {
      const r = g.getBoundingClientRect();
      return texts.filter((t) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top).map(() => g.className);
    });
  });
  expect(overlaps).toEqual([]);
  for (const name of ['Secret', 'Alpha']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.podium-badge')).toBeVisible();
    await settled(owner);
    const { violations } = await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  }
});

test('the page follows your Type and Rank by, also when opened from the Log', async () => {
  await owner.goto('/');
  await owner.getByLabel('Type', { exact: true }).selectOption('flower');
  await expect(owner.locator('.row.tier')).toHaveCount(3);
  // 4th under All, 3rd under Flower: Gold.
  await owner.locator('.row', { hasText: 'Bravo' }).click();
  await expect(owner.locator('.podium-badge')).toHaveText('#3 in Flower');
  await expect(owner.locator('main')).toHaveAttribute('data-podium', '3');
  // 4th under Flower: ordinary.
  await open(owner, `/products/${ids.Delta}`);
  await expect(owner.locator('main')).toHaveAttribute('data-podium', 'none');

  // The edible isn't on a Flower board, so its page is ordinary.
  await open(owner, `/products/${ids.Charlie}`);
  await expect(owner.locator('main')).toHaveAttribute('data-podium', 'none');
  await expect(owner.locator('.podium-badge')).toHaveCount(0);

  // Flower by Taste: only Delta has a Taste, so it tops that list — from the Log as well.
  await owner.goto('/');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('taste');
  await expect(owner.locator('.row')).toHaveCount(1);
  await owner.getByRole('link', { name: 'Log' }).click();
  await owner.locator('.lrow', { hasText: 'Delta' }).click();
  await expect(owner.locator('.podium-badge')).toHaveText('#1 in Flower by Taste');
  await expect(owner.locator('main')).toHaveAttribute('data-podium', '1');

  // Back to All · Overall.
  await owner.goto('/');
  await owner.getByLabel('Type', { exact: true }).selectOption('all');
  await owner.getByLabel('Rank by', { exact: true }).selectOption('overall');
  await expect(owner.locator('.row.tier')).toHaveCount(3);
});

test('text stays readable on every podium page throughout the motion', async () => {
  for (const name of ['Secret', 'Alpha', 'Charlie']) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.podium-badge')).toBeVisible();
    const boxes = await heroTextBoxes(owner);
    const worst = await contrastFailures(owner, boxes);
    expect(worst, `${name}:\n${worst.join('\n')}`).toEqual([]);
  }
});

test('Reduce Motion keeps the colours but nothing moves, sweeps or twinkles', async () => {
  await owner.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, haze] of [['Secret', '0.14'], ['Alpha', '0.14'], ['Charlie', '0.12']] as const) {
    await open(owner, `/products/${ids[name]}`);
    await expect(owner.locator('.podium-badge')).toBeVisible();
    const got = await pieces(owner);
    expect({ haze: got.haze, score: got.score, holo: got.holo, hazeMs: got.hazeMs, sweep: got.sweep }).toEqual({ haze, score: true, holo: true, hazeMs: 0, sweep: false });
    // (The screen's own entrance fade is kept under Reduce Motion; only the podium's motion stops.)
    expect(await owner.locator('main').evaluate((m) => m.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName).filter((n) => /^(tier|podium)-/.test(n)))).toEqual([]);
    if (name === 'Alpha') await expect(owner.locator('.glint').first()).toBeHidden();
  }
  await owner.emulateMedia({ reducedMotion: 'no-preference' });
});

test('a friend’s product page gets its place on their board, worked out only from what you can see', async () => {
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row.tier')).toHaveCount(3);
  await fan.locator('.row', { hasText: 'Alpha' }).click();
  await expect(fan.locator('.podium-badge')).toHaveText('#1 on their Leaderboard');
  await expect(fan.locator('main')).toHaveAttribute('data-podium', '1');
  expect(await pieces(fan)).toMatchObject({ crown: true, haze: '0.14', score: true, sweep: true, glints: 0 });
  // The Poster (D27) on their page too, without a price.
  await expect(fan.locator('.poster .hero-photo')).toBeVisible();
  await expect(fan.locator('.hero-price')).toHaveCount(0);
  await shot(fan, '91-podium-friend-page');

  await open(fan, `/u/${ownerName}/p/${ids.Bravo}`);
  await expect(fan.locator('.podium-badge')).toHaveText('#3 on their Leaderboard');
  expect(await pieces(fan)).toMatchObject({ holo: true, haze: '0.12', score: true });
  for (const name of ['Delta', 'Echo']) {
    await open(fan, `/u/${ownerName}/p/${ids[name]}`);
    await expect(fan.locator('main')).toHaveAttribute('data-podium', 'none');
    await expect(fan.locator('.podium-badge')).toHaveCount(0);
  }
});
