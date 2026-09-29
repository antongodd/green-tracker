import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, shot, signUp, textBoxes } from './helpers';

// D33 (0.26.0): every empty screen has its own green line drawing in place of the faint leaf,
// a title, and (where there's something to add) a green "+" button. The People lists and
// Blocked, plain lines before, get a smaller card. Error cards stay plain (no drawing).
test.describe.configure({ mode: 'serial' });

let me: Page, sam: Page;
let meName: string, samName: string;
const call = (page: Page, method: string, path: string, body?: unknown) =>
  page.evaluate(async ({ method, path, body }) => (await fetch(`/api${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(), { method, path, body });

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`);
  return { page, name };
}

test.beforeAll(async ({ browser }) => {
  ({ page: me, name: meName } = await person(browser, 'emp'));
  ({ page: sam, name: samName } = await person(browser, 'sam'));
});

/** The one empty card on screen: its drawing is a real, visible, green line drawing. */
async function card(page: Page, art: string, title: string): Promise<Locator> {
  const c = page.locator(`.empty[data-art="${art}"]`);
  await expect(c).toHaveCount(1);
  await expect(c.getByRole('heading', { name: title })).toBeVisible();
  // Titles in full white; the text under them in the usual grey.
  expect(await c.locator('h2').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(238, 244, 240)');
  const svg = c.locator('svg.empty-art');
  await expect(svg).toBeVisible();
  expect(await svg.evaluate((s) => s.childElementCount)).toBeGreaterThan(1);
  expect(await svg.evaluate((s) => getComputedStyle(s).color)).toBe('rgb(88, 224, 140)');
  const box = (await svg.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(120);
  return c;
}

/** "Add" buttons are the green primary button with a +; everything else stays grey. */
async function greenAdd(c: Locator, name: string) {
  const b = c.getByRole('link', { name });
  await expect(b).toHaveClass(/\bprimary\b/);
  expect(await b.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(47, 184, 106)');
  await expect(b.locator('svg')).toHaveCount(1);
}

async function readable(page: Page) {
  expect(await contrastFailures(page, await textBoxes(page, '.empty h2, .empty p, .empty .btn'), 1)).toEqual([]);
}

test('a new Leaderboard: the podium drawing and a green Add a product', async () => {
  await me.goto('/');
  const c = await card(me, 'podium', 'Nothing ranked yet');
  await greenAdd(c, 'Add a product');
  await shot(me, '80-empty-board');
  await readable(me);
});

test('an empty Log: the notebook and a green Add a log entry', async () => {
  await me.goto('/log');
  const c = await card(me, 'log', 'Your Log is empty');
  await greenAdd(c, 'Add a log entry');
  await shot(me, '81-empty-log');
});

test('the Archive: the box, no button', async () => {
  await me.goto('/more/archive');
  const c = await card(me, 'archive', 'Nothing archived');
  await expect(c.locator('.btn')).toHaveCount(0);
});

test('a filter with nothing in it: the funnel; a rating nothing has: the bars; both buttons stay grey', async () => {
  await call(me, 'POST', '/products', { ...emptyProductInput(), name: 'Only Flower', ratings: { look: 7 } });
  await me.goto('/');
  await me.getByLabel('Type', { exact: true }).selectOption('edibles');
  let c = await card(me, 'filter', 'No Edibles yet');
  await expect(c.getByRole('button', { name: 'Show all types' })).toHaveClass(/\bsecondary\b/);
  await shot(me, '82-empty-filter');
  await me.getByLabel('Type', { exact: true }).selectOption('all');
  await me.getByLabel('Rank by', { exact: true }).selectOption('burn');
  c = await card(me, 'unrated', 'Nothing rated on Burn');
  await shot(me, '85-empty-unrated');
  await expect(c.getByRole('button', { name: 'Rank by Overall' })).toHaveClass(/\bsecondary\b/);
  await readable(me);
  await me.goto('/');
  await me.getByLabel('Rank by', { exact: true }).selectOption('overall');
});

test('the Log filtered to nothing: the funnel', async () => {
  await call(me, 'POST', '/log', { ...emptyLogEntryInput(), name: 'Loose Leaf', country: 'US' });
  await me.goto('/log');
  await me.getByLabel('Type', { exact: true }).selectOption('edibles');
  await card(me, 'filter', 'No Edibles in your Log');
  await me.getByLabel('Type', { exact: true }).selectOption('all');
});

test('People: Following, Followers and Requests each get their own small card', async () => {
  await me.goto('/people');
  await me.getByRole('tab', { name: /Following/ }).click();
  const c = await card(me, 'following', 'Not following anyone');
  await expect(c).toHaveClass(/\bcompact\b/);
  await expect(c.getByText('You’re not following anyone yet. Search for a username above.')).toBeVisible();
  await shot(me, '83-empty-following');
  await readable(me);
  await me.goto('/people');
  await me.getByRole('tab', { name: /Followers/ }).click();
  await card(me, 'followers', 'No followers yet');
  await shot(me, '87-empty-followers');
  await me.getByRole('tab', { name: /Requests/ }).click();
  await card(me, 'requests', 'No requests');
  await shot(me, '86-empty-requests');
});

test('Blocked: the blocked drawing', async () => {
  await me.goto('/more/blocked');
  const c = await card(me, 'blocked', 'No one blocked');
  await expect(c.getByText('You haven’t blocked anyone.')).toBeVisible();
  await shot(me, '88-empty-blocked');
});

test('a friend who has shared nothing: the dashed podium, no button', async () => {
  await call(me, 'POST', `/people/u/${samName}/follow`);
  await call(sam, 'POST', `/people/requests/${meName}/approve`);
  await me.goto(`/u/${samName}`);
  const c = await card(me, 'shared', 'Nothing to see yet');
  await expect(c.locator('.btn')).toHaveCount(0);
  await expect(me.getByRole('link', { name: 'Add a product' })).toHaveCount(0);
  await shot(me, '84-empty-friend');
});

test('a friend’s board filtered to nothing or ranked by a rating they lack', async () => {
  await call(sam, 'POST', '/products', { ...emptyProductInput(), name: 'Sam Flower', ratings: { look: 8 } });
  await me.goto(`/u/${samName}`);
  await expect(me.locator('.row', { hasText: 'Sam Flower' })).toBeVisible();
  await me.getByLabel('Type', { exact: true }).selectOption('edibles');
  await card(me, 'filter', 'No Edibles');
  await me.getByLabel('Type', { exact: true }).selectOption('all');
  await me.getByLabel('Rank by', { exact: true }).selectOption('burn');
  await card(me, 'unrated', 'Nothing rated on that');
});

test('error cards stay plain: no drawing', async () => {
  await me.goto('/u/nobody-here-zz');
  await expect(me.getByRole('heading', { name: 'No one found' })).toBeVisible();
  await expect(me.locator('.empty svg')).toHaveCount(0);
});
