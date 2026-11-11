import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Getting started (D97): a new person's first minutes, as Anton tried them in the mockups. One welcome screen;
// a list on the Leaderboard whose five steps tick themselves off as you really do them, that folds to one line
// and can be hidden; each screen's own step; a hint the first time you reach each screen; and Show me round
// again in Settings. An account from before it sees none of it.
test.describe.configure({ mode: 'serial' });

// A real new account: no `x-gt-tour: off` (playwright.config.ts sends it for every other spec).
const fresh = (browser: Browser) => browser.newContext({ extraHTTPHeaders: {} });
const person = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return r.json();
    },
    { method, path, body },
  );
const upload = (page: Page) =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1f1a';
    ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = '#7cbf5a';
    ctx.beginPath();
    ctx.arc(320, 330, 190, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const k of ['original', 'cropped', 'thumb']) form.append(k, blob, `${k}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });

const WORDS = '.gs-t h2, .gs-t p, .gs-st b, .gs-st span, .gs-small b, .gs-n, .gs-hide, .tour-hint p, .th-row .btn';
const list = (page: Page) => page.getByRole('region', { name: /Getting started|You’re all set/ });
// A hint: in the page (a note), or floating above the tab bar (its own landmark, outside the screen's <main>).
const hint = (page: Page) => page.locator('.tour-hint');
const toast = (page: Page) => page.locator('.tour-toast');
/** Where a hint's arrow points, against the middle of what it's about. */
const arrowOff = (page: Page, target: string) =>
  page.evaluate((target) => {
    const h = document.querySelector<HTMLElement>('.tour-hint')!;
    const t = document.querySelector(target)!.getBoundingClientRect();
    return Math.abs(h.getBoundingClientRect().left + parseFloat(h.style.getPropertyValue('--ax')) + 8 - (t.left + t.width / 2));
  }, target);
const readable = async (page: Page) => {
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, WORDS))).toEqual([]);
};

let page: Page;
let name: string;
let productId: string;

test.beforeAll(async ({ browser }) => {
  const context = await fresh(browser);
  // The iPhone's share sheet, pretended (Invite a friend).
  await context.addInitScript(() => {
    (window as unknown as { shared: unknown[] }).shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: unknown) => void (window as unknown as { shared: unknown[] }).shared.push(data) });
  });
  page = await context.newPage();
  name = await signUp(page, person('newbie'), { tour: true });
});

test('a new account is welcomed once, then finds the list and the first hint on its Leaderboard', async () => {
  await expect(page.getByRole('heading', { name: `Welcome, @${name}` })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  for (const line of ['Rate what you try', 'Know your strains and your plug', 'Share with friends you approve']) await expect(page.getByText(line)).toBeVisible();
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot(page, 'onboarding-01-welcome');
  expect(await contrastFailures(page, await textBoxes(page, '.tour-welcome h1, .tw-kicker, .tw-points b, .tw-points span, .tour-welcome .btn'))).toEqual([]);
  await page.getByRole('button', { name: 'Let’s go' }).click();

  await expect(list(page)).toBeVisible();
  await expect(list(page).getByRole('link')).toHaveText([/Add your first product/, /Look at Strainz and Sources/, /Find a friend/, /Post to the Feed/, /Pick your Look/]);
  await expect(list(page).locator('.gs-ring')).toHaveText('0/5');
  await expect(hint(page)).toContainText('Start here. Tap + to add something you’ve tried');
  expect(await arrowOff(page, '.fab')).toBeLessThan(4);
  // The hint doesn't lock the screen: the list and the + still work under it.
  const box = (await hint(page).boundingBox())!;
  const fab = (await page.locator('.fab').boundingBox())!;
  expect(box.y + box.height).toBeLessThan(fab.y);
  await settled(page);
  await shot(page, 'onboarding-02-list'); // before the words are measured: measuring hides them
  await readable(page);

  // Seen once: after a reload the welcome doesn't come back, and the list is where it was.
  await page.reload();
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Welcome/ })).toHaveCount(0);
  await hint(page).getByRole('button', { name: 'Got it' }).click();
  await expect(hint(page)).toHaveCount(0);
  await page.reload();
  await expect(list(page)).toBeVisible();
  await expect(hint(page)).toHaveCount(0); // Got it is kept too
});

test('saving a first product ticks the first step by itself', async () => {
  await page.getByRole('button', { name: 'Add a product' }).click();
  await page.getByLabel('Name').fill('Zkittlez');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText('First one ranked. 1 of 5 done');
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  productId = page.url().split('/').pop()!;
  await page.goto('/');
  await expect(list(page).locator('.gs-ring')).toHaveText('1/5');
  const first = list(page).getByRole('link', { name: /Add your first product/ });
  await expect(first).toHaveClass(/\bdone\b/);
  await expect(first).toContainText('Done');
  await expect(hint(page)).toHaveCount(0);
});

test('the list folds to one line and opens again, and stays as you left it', async () => {
  await page.getByRole('button', { name: 'Make Getting started smaller' }).click();
  const line = page.getByRole('button', { name: 'Getting started, 1 of 5 done. Show the steps' });
  await expect(line).toBeVisible();
  await expect(line).toContainText('1 of 5');
  await expect(list(page)).toHaveCount(0);
  expect(await line.locator('.gs-bar i').evaluate((i) => Math.round((i.getBoundingClientRect().width / i.parentElement!.getBoundingClientRect().width) * 100))).toBe(20);
  await settled(page);
  await shot(page, 'onboarding-03-one-line'); // before the words are measured: measuring hides them
  await readable(page);
  await page.reload();
  await expect(line).toBeVisible();
  await line.click();
  await expect(list(page).getByRole('link')).toHaveCount(5);
});

test('Strainz and Sources each show the step and a hint; opening both ticks it', async () => {
  await page.getByRole('link', { name: 'Strainz', exact: true }).click();
  await expect(page.locator('.tour-line')).toContainText('Look at Strainz and Sources');
  await expect(page.locator('.tour-line')).toContainText('Have a look, then open Sources');
  await expect(page.locator('.tour-line')).toContainText('Step 2 of 5');
  await expect(hint(page)).toContainText('Strainz. Every strain you rate gets its own page');
  expect(await arrowOff(page, '.nav .tab[aria-current="page"]')).toBeLessThan(4);
  await settled(page);
  await shot(page, 'onboarding-04-strainz'); // before the words are measured: measuring hides them
  await readable(page);
  await hint(page).getByRole('button', { name: 'Got it' }).click();

  await page.getByRole('link', { name: 'Sources', exact: true }).click();
  await expect(toast(page)).toHaveText('Strainz and Sources seen. 2 of 5 done');
  await expect(hint(page)).toContainText('Sources. Who you buy from');
  expect(await arrowOff(page, '.nav .tab[aria-current="page"]')).toBeLessThan(4);
  // Its own step is now a tick and a way on to the next one.
  const next = page.getByRole('link', { name: /Done\. Next: Find a friend/ });
  await expect(next).toBeVisible();
  await hint(page).getByRole('button', { name: 'Got it' }).click();
  await next.click();
  await expect(page).toHaveURL(/\/feed$/);
});

test('the Feed: find a friend (an invite counts), then post', async () => {
  await expect(page.locator('.tour-line')).toContainText('Find a friend');
  await expect(hint(page)).toContainText('Find your friends. Tap People, top left');
  await settled(page);
  await shot(page, 'onboarding-05-feed'); // before the words are measured: measuring hides them
  await readable(page);
  await hint(page).getByRole('button', { name: 'Invite a friend' }).click();
  await expect(toast(page)).toHaveText('Friend step done. 3 of 5 done');
  expect(await page.evaluate(() => (window as unknown as { shared: { text: string }[] }).shared[0]!.text)).toBe(`Follow me on Green Tracker: @${name}`);

  // The next step takes its place on the same screen, with its own hint at the +.
  await expect(page.locator('.tour-line')).toContainText('Post to the Feed');
  await expect(page.locator('.tour-line')).toContainText('Step 4 of 5');
  await expect(hint(page)).toContainText('Your turn. Tap + to post a photo');
  expect(await arrowOff(page, '.fab')).toBeLessThan(4);
  // A fresh page before measuring words again: a second reading on one page finds them hidden (CLAUDE.md, D96).
  await page.reload();
  await expect(hint(page)).toContainText('Your turn.');
  await readable(page);

  // A photo for the product (through the API: the editor's photo tools have their own tests), then a real post.
  const input = { ...emptyProductInput(), name: 'Zkittlez', photos: [{ upload: await upload(page), crop: null }] };
  expect((await call(page, 'PUT', `/api/products/${productId}`, input)).product.photos).toHaveLength(1);
  await page.goto(`/feed/new/p/${productId}`);
  await page.getByLabel('Caption').fill('First one on the board.');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(toast(page)).toHaveText('Posted. 4 of 5 done');
  await expect(hint(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Done\. Next: Pick your Look/ })).toBeVisible();
});

test('picking a Look is the last step; the light look keeps every word readable; Done puts the list away', async () => {
  await page.getByRole('link', { name: /Done\. Next: Pick your Look/ }).click();
  await expect(page).toHaveURL(/\/more\/look$/);
  await expect(page.locator('.tour-line')).toContainText('Step 5 of 5');
  await expect(hint(page)).toContainText('Make it yours.');
  await readable(page);
  await page.getByRole('radio', { name: /Daylight/ }).check();
  await expect(toast(page)).toHaveText('Look chosen. 5 of 5 done');
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'light');
  await expect(page.locator('.tour-line')).toHaveCount(0); // nothing left to point at

  await page.goto('/');
  await expect(list(page).getByRole('heading', { name: 'You’re all set' })).toBeVisible();
  await settled(page);
  await shot(page, 'onboarding-06-all-set-daylight'); // before the words are measured: measuring hides them
  await readable(page);
  await list(page).getByRole('button', { name: 'Done' }).click();
  await expect(list(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: /Zkittlez/ }).first()).toBeVisible();
  await expect(list(page)).toHaveCount(0);
});

test('Show me round again brings the list and hints back without the welcome; Hide this list puts them away', async () => {
  await page.goto('/more');
  await page.getByRole('button', { name: /Show me round again/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Welcome/ })).toHaveCount(0);
  await expect(list(page).locator('.gs-ring')).toHaveText('0/5');
  await expect(list(page).getByRole('link', { name: /Add your first product/ })).not.toHaveClass(/\bdone\b/);
  // In the light look the open list reads too.
  await readable(page);
  await page.getByRole('link', { name: 'Strainz', exact: true }).click();
  await expect(hint(page)).toContainText('Strainz.'); // the hints start again as well
  await page.goto('/');

  await list(page).getByRole('button', { name: 'Hide this list' }).click();
  await expect(list(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: /Zkittlez/ }).first()).toBeVisible();
  await expect(list(page)).toHaveCount(0);
  // Hidden means all of it: no step line and no hint on the other screens.
  await page.getByRole('link', { name: 'Sources', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sources', level: 1 })).toBeVisible();
  await expect(page.locator('.tour-line')).toHaveCount(0);
  await expect(hint(page)).toHaveCount(0);
});

test('Skip on the welcome leaves the list as one line', async ({ browser }) => {
  const other = await (await fresh(browser)).newPage();
  await signUp(other, person('skipper'), { tour: true });
  await other.getByRole('button', { name: 'Skip' }).click();
  await expect(other.getByRole('button', { name: 'Getting started, 0 of 5 done. Show the steps' })).toBeVisible();
  await expect(list(other)).toHaveCount(0);
  await other.context().close();
});

test('an account from before Getting started sees none of it until it asks', async ({ page: old }) => {
  await signUp(old, person('before'));
  await expect(old.getByRole('heading', { name: 'Nothing ranked yet' })).toBeVisible();
  await expect(list(old)).toHaveCount(0);
  await expect(hint(old)).toHaveCount(0);
  await old.getByRole('link', { name: 'Strainz', exact: true }).click();
  await expect(old.getByRole('heading', { name: 'No strains yet' })).toBeVisible();
  await expect(old.locator('.tour-line')).toHaveCount(0);
  await expect(hint(old)).toHaveCount(0);
  await old.goto('/more');
  await old.getByRole('button', { name: /Show me round again/ }).click();
  await expect(list(old).locator('.gs-ring')).toHaveText('0/5');
  await expect(hint(old)).toContainText('Start here.');
});

test.afterAll(async () => {
  await call(page, 'PUT', '/api/appearance', { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
});
