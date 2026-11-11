import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { settled, signUp } from './helpers';

// D99: a new product lands in its place on the Leaderboard, more of a show band by band, the most at 9.5.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );

/** Everything the landing draws, by class, as it's added (it's all gone once it has landed). */
const RECORD = () => {
  const w = window as unknown as { landingSeen: Set<string>; landingPieces: number };
  w.landingSeen = new Set<string>();
  w.landingPieces = 0;
  new MutationObserver((list) => {
    for (const m of list)
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement) || !n.parentElement?.closest('.landing-fx')) return;
        w.landingPieces++;
        if (n.className) w.landingSeen.add(n.className);
      });
  }).observe(document, { childList: true, subtree: true });
};
type Seen = { landingSeen: Set<string>; landingPieces: number };
const seen = (page: Page) => page.evaluate(() => [...(window as unknown as Seen).landingSeen]);
const pieces = (page: Page) => page.evaluate(() => (window as unknown as Seen).landingPieces);

async function person(page: Page) {
  await page.addInitScript(RECORD);
  await signUp(page);
  for (const [name, score] of [['Purple Punch', 9.8], ['Lemon Haze', 9.1], ['Wedding Cake', 8.6], ['Sour Diesel', 8.1], ['Cherry Pie', 7.4], ['OG Kush', 7.0]] as const) {
    await call(page, 'POST', '/api/products', { ...emptyProductInput(), name, ratings: { look: score } });
  }
  await page.goto('/');
  await expect(page.locator('.rows > a.row')).toHaveCount(6);
}

/** Adds a product through the editor with this Look (its Overall), from the + on the Leaderboard. */
async function add(page: Page, name: string, look: string) {
  await page.locator('.fab').click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: /^Look: .*Tap to type/ }).click();
  const input = page.getByLabel('Look (1 to 10)');
  await input.fill(look);
  await input.press('Enter');
  await page.getByRole('button', { name: 'Save' }).click();
}

const row = (page: Page, name: string) => page.locator('.rows > a.row', { hasText: name });
const landing = (page: Page) => page.locator('html.landing');

test('a 9.5 product lands at its place with the full show, then a note opens it', async ({ page }) => {
  await person(page);
  await add(page, 'Blue Dream', '9.7');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.landing-fx .banner')).toHaveText(/#2 on your Leaderboard/);
  await expect(page.locator('.landing-fx .banner small')).toHaveText('Aurora'); // the band's name in the colour set (D91)
  await settled(page);
  await expect(landing(page)).toHaveCount(0);
  await expect(page.locator('.landing-fx')).toBeEmpty();
  expect(await seen(page)).toEqual(expect.arrayContaining(['flame', 'banner']));
  // It's in its place, and back to itself (no transform or dimming left behind).
  await expect(page.locator('.rows > a.row .name')).toHaveText(['Purple Punch', 'Blue Dream', 'Lemon Haze', 'Wedding Cake', 'Sour Diesel', 'Cherry Pie', 'OG Kush']);
  expect(await page.locator('.rows > a.row').evaluateAll((rows) => rows.flatMap((r) => r.getAnimations().filter((a) => !(a instanceof CSSAnimation))).length)).toBe(0);
  const note = page.getByRole('status').filter({ hasText: 'landed' });
  await expect(note).toHaveText('Blue Dream landed at #2Open');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await note.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Blue Dream' })).toBeVisible();
  // Back is the Leaderboard once (no second copy of it from the +).
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('under 8.0 it only lands; each band up draws more; only 9.5 has the banner', async ({ page }) => {
  await person(page);
  const count: number[] = [];
  for (const [name, look] of [['Low One', '7.6'], ['Band One', '8.2'], ['Mid One', '8.7'], ['High One', '9.2']] as const) {
    await page.evaluate(() => {
      (window as unknown as Seen).landingSeen.clear();
      (window as unknown as Seen).landingPieces = 0;
    });
    await add(page, name, look);
    await expect(row(page, name)).toBeVisible();
    await settled(page);
    expect(await seen(page)).toEqual(['flame']);
    count.push(await pieces(page));
  }
  // The dust, then a glint, then sparks, then a ring and bigger dust.
  for (let i = 1; i < count.length; i++) expect(count[i]).toBeGreaterThan(count[i - 1]!);
});

test('Reduce Motion: nothing flies, it fades in, and the 9.5 banner still shows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await person(page);
  await add(page, 'Calm Dream', '9.6');
  await expect(page.locator('.landing-fx .banner')).toBeVisible();
  await settled(page);
  const s = await seen(page);
  expect(s).toContain('banner');
  expect(s).not.toContain('flame');
  await expect(row(page, 'Calm Dream')).toBeVisible();
});

test('a tap skips it at once', async ({ page }) => {
  await person(page);
  await add(page, 'Quick One', '9.9');
  await expect(page.locator('.landing-fx .flame, .landing-fx .banner').first()).toBeAttached();
  await page.mouse.click(195, 12); // the header: nothing there to open
  await expect(landing(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('.landing-fx')).toBeEmpty();
  await expect(row(page, 'Quick One')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Quick One landed at #1' })).toBeVisible();
});

test('not on the board as you left it (another Type): its page opens as before', async ({ page }) => {
  await person(page);
  await page.getByLabel('Type', { exact: true }).selectOption('edibles');
  await add(page, 'Plain Flower', '9.0');
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(landing(page)).toHaveCount(0);
});
