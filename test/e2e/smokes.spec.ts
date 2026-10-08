import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { settled, shot, signUp } from './helpers';

// Smokes (D43, 0.36.0; option B "Week strip" and card option 1 of the mockups). A tab, second
// in the bar: a strip of the last 7 days, then every smoke by day. The + opens a picker (Recent,
// Leaderboard, Log, New Log entry), then a form (When, How much, Effect). Product and Log entry
// pages carry a Smokes card: the count ("taken" for edibles), when last, the last three, and Add
// a smoke. Promotion moves an entry's smokes; deleting an entry deletes them. Yours only.
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
/** The browser's own calendar day, `n` days from today. */
const day = (n: number) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, n);
const smokeVia = async (target: string, date: string, time: string, extra: Record<string, unknown> = {}) =>
  (await post('/api/smokes', { productId: target.startsWith('p:') ? target.slice(2) : null, logEntryId: target.startsWith('e:') ? target.slice(2) : null, date, time, amount: null, effect: null, ...extra })).smoke.id as string;

const axe = async () => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
const openTab = async () => {
  await page.goto('/smokes');
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toBeVisible();
};
const card = () => page.getByRole('region', { name: 'Smokes' });
const rowsOf = (dayName: string) => page.getByRole('region', { name: dayName }).locator('.srow');

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `smk${Date.now().toString(36).slice(-6)}`);
  ids.cake = (await post('/api/products', { ...emptyProductInput(), name: 'Wedding Cake', productType: 'flower' })).product.id;
  ids.gummies = (await post('/api/log', { ...emptyLogEntryInput(), name: 'Sour Gummies', productType: 'edibles' })).entry.id;
});

test('empty: the week strip shows seven empty days, today last, and the empty card offers Add a smoke', async () => {
  await openTab();
  await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText('Smokes');
  const days = page.locator('.week .day');
  await expect(days).toHaveCount(7);
  await expect(days.last()).toHaveClass(/today/);
  await expect(days.last().locator('.dl')).toHaveText('Today');
  for (const d of await days.all()) await expect(d).toBeDisabled();
  await expect(page.locator('.week-top')).toHaveText(/0 in the last 7 days\s*0 this month/);
  await expect(page.locator('.empty[data-art="smokes"]')).toContainText('No smokes yet');
  expect(await axe()).toEqual([]);
  await shot(page, '130-smokes-empty');
  await page.locator('.empty').getByRole('link', { name: 'Add a smoke' }).click();
  await expect(page).toHaveURL(/\/smokes\/new$/);
});

test('+ → pick a product → When, How much, Effect → Add smoke: it shows under Today', async () => {
  await openTab();
  await page.getByRole('button', { name: 'Add a smoke' }).click();
  await expect(page).toHaveURL(/\/smokes\/new$/);
  await expect(page.getByRole('region', { name: 'Leaderboard' })).toContainText('Wedding Cake');
  await expect(page.getByRole('region', { name: 'Log' })).toContainText('Sour Gummies');
  await expect(page.getByRole('region', { name: 'Recent' })).toHaveCount(0);
  expect(await axe()).toEqual([]);
  await shot(page, '131-smokes-picker');
  await page.getByRole('button', { name: /Wedding Cake/ }).click();

  await expect(page).toHaveURL(new RegExp(`/smokes/new/p/${ids.cake}$`));
  await expect(page.getByLabel('Date')).toHaveValue(await day(0));
  await expect(page.getByLabel('Time')).toHaveValue(/^\d{2}:\d{2}$/);
  await expect(page.getByLabel('Amount (g)')).toHaveValue('');
  await expect(page.getByRole('region', { name: 'What you had' })).toContainText('Not smoked yet');
  await page.getByRole('button', { name: '0.3 g' }).click();
  await expect(page.getByLabel('Amount (g)')).toHaveValue('0.3');
  await expect(page.getByRole('button', { name: '0.3 g' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Time').fill('13:10');
  await page.getByRole('textbox', { name: 'Effect' }).fill('Lifted, chatty');
  expect(await axe()).toEqual([]);
  await shot(page, '132-smokes-form');
  await page.getByRole('button', { name: 'Add smoke' }).click();

  await expect(page).toHaveURL(/\/smokes$/);
  const row = rowsOf('Today').first();
  await expect(row).toContainText('Wedding Cake');
  await expect(row.locator('.sub')).toHaveText('0.3 g · Lifted, chatty');
  await expect(row.locator('.tm')).toHaveText('13:10');
  await expect(page.locator('.week .day').last().locator('.dn')).toHaveText('1');
  await expect(page.locator('.week-top')).toHaveText(/1 in the last 7 days/);
});

test('Recent comes first; search filters; an edible is in mg and "taken"', async () => {
  await page.goto('/smokes/new');
  await expect(page.getByRole('region', { name: 'Recent' }).locator('.lrow')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Recent' })).toContainText('Wedding Cake');
  await expect(page.getByRole('region', { name: 'Recent' }).locator('.cnt')).toHaveText('1×');
  await expect(page.getByRole('region', { name: 'Leaderboard' })).toHaveCount(0); // its only product is in Recent
  await page.getByLabel('Search your Leaderboard and Log').fill('gumm');
  await expect(page.locator('.lrow.pick:not(.newlog)')).toHaveCount(1);
  await page.getByRole('button', { name: /Sour Gummies/ }).click();
  await expect(page.getByLabel('Amount (mg THC)')).toBeVisible();
  await expect(page.getByRole('button', { name: '10 mg' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'What you had' })).toContainText('Not taken yet');
  await expect(page.getByRole('region', { name: 'What you had' }).locator('.log-chip')).toHaveText('Log');
  await page.getByRole('button', { name: '10 mg' }).click();
  await page.getByRole('button', { name: 'Add smoke' }).click();
  await expect(rowsOf('Today')).toHaveCount(2);
  await expect(rowsOf('Today').filter({ hasText: 'Sour Gummies' }).locator('.sub')).toHaveText('10 mg');

  await page.goto(`/log/${ids.gummies}`);
  await expect(card().locator('.smk-count')).toHaveText(/^1\s*time taken$/);
  await expect(card().locator('.smk-last')).toContainText('Last taken');
  await page.goto(`/products/${ids.cake}`);
  await expect(card().locator('.smk-count')).toHaveText(/^1\s*time smoked$/);
  await expect(card().locator('.smk-last')).toHaveText(/Last smoked\s*Today, 13:10/);
});

test('Add a smoke on a product page starts with the last amount, and comes back to the page', async () => {
  await page.goto(`/products/${ids.cake}`);
  await card().getByRole('link', { name: 'Add a smoke' }).click();
  await expect(page).toHaveURL(new RegExp(`/smokes/new/p/${ids.cake}$`));
  await expect(page.getByRole('region', { name: 'What you had' })).toContainText('Smoked once');
  await expect(page.getByLabel('Amount (g)')).toHaveValue('0.3');
  await expect(page.getByRole('button', { name: 'Change' })).toHaveCount(0); // only from the picker
  await page.getByLabel('Date').fill(await day(-1));
  await page.getByLabel('Time').fill('22:40');
  await page.getByRole('textbox', { name: 'Effect' }).fill('Very relaxed, slept well');
  await page.getByRole('button', { name: 'Add smoke' }).click();

  await expect(page).toHaveURL(new RegExp(`/products/${ids.cake}$`));
  await expect(card().locator('.smk-count')).toHaveText(/^2\s*times smoked$/);
  await expect(card().locator('.smk-row')).toHaveCount(2);
  await expect(card().locator('.smk-row').nth(0)).toHaveText(/Today · 0\.3 g · Lifted, chatty\s*13:10/);
  await expect(card().locator('.smk-row').nth(1)).toHaveText(/Yesterday · 0\.3 g · Very relaxed, slept well\s*22:40/);
  await card().scrollIntoViewIfNeeded();
  expect(await axe()).toEqual([]);
  await shot(page, '133-smokes-card');
});

test('a future date is refused', async () => {
  await page.goto(`/smokes/new/p/${ids.cake}`);
  await page.getByLabel('Date').fill(await day(1));
  await page.getByRole('button', { name: 'Add smoke' }).click();
  await expect(page.getByRole('alert')).toHaveText('The date can’t be in the future.');
  await expect(page).toHaveURL(/\/smokes\/new\/p\//);
});

test('tap a smoke to change it; Delete smoke asks first', async () => {
  await openTab();
  await rowsOf('Yesterday').first().click();
  await expect(page).toHaveURL(/\/smokes\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Effect' })).toHaveValue('Very relaxed, slept well');
  await page.getByRole('textbox', { name: 'Effect' }).fill('Sleepy');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/smokes$/);
  await expect(rowsOf('Yesterday').first().locator('.sub')).toHaveText('0.3 g · Sleepy');

  await rowsOf('Yesterday').first().click();
  const gone = page.url();
  await page.getByRole('button', { name: 'Delete smoke' }).click();
  const sheet = page.getByRole('dialog', { name: 'Delete this smoke?' });
  await expect(sheet).toContainText('Wedding Cake, Yesterday, 22:40.');
  await sheet.getByRole('button', { name: 'Delete smoke' }).click();
  await expect(page).toHaveURL(/\/smokes$/);
  await expect(page.getByRole('region', { name: 'Yesterday' })).toHaveCount(0);
  // An old link to it lands on the tab.
  await page.goto(gone);
  await expect(page).toHaveURL(/\/smokes$/);
});

test('New Log entry from the picker adds it to your Log, then carries on', async () => {
  await page.goto('/smokes/new');
  await page.getByLabel('Search your Leaderboard and Log').fill('orange bud');
  await expect(page.getByText('Nothing called “orange bud” yet.')).toBeVisible();
  await page.getByRole('button', { name: /New Log entry/ }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Orange Bud');
  await page.getByLabel('Product type').selectOption('flower');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/smokes\/new\/e\//);
  await expect(page.getByRole('region', { name: 'What you had' })).toContainText('Orange Bud');
  // Change goes back to the picker, where it's now in the Log.
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(page.getByRole('region', { name: 'Log' })).toContainText('Orange Bud');
  await page.getByRole('button', { name: /Orange Bud/ }).click();
  await page.getByRole('button', { name: 'Add smoke' }).click();
  await expect(page).toHaveURL(/\/smokes$/);
  await expect(rowsOf('Today').filter({ hasText: 'Orange Bud' }).locator('.log-chip')).toHaveText('Log');
  // Cancel from the form goes back to the tab, not the picker.
  await page.getByRole('button', { name: 'Add a smoke' }).click();
  await page.getByRole('button', { name: /Wedding Cake/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/smokes$/);
  await page.goto('/log');
  await expect(page.locator('.lrow', { hasText: 'Orange Bud' })).toBeVisible();
});

test('tapping a day in the strip scrolls to it; days are grouped newest first with a count', async () => {
  const three = await day(-3);
  for (const t of ['09:00', '21:15']) await smokeVia(`p:${ids.cake}`, three, t, { amount: 0.4 });
  for (let i = 0; i < 6; i++) await smokeVia(`p:${ids.cake}`, await day(-4), `1${i}:00`);
  // Older days below, so the page can scroll Sun's heading to the top.
  for (let i = 0; i < 5; i++) await smokeVia(`p:${ids.cake}`, await day(-6 - i), '20:00');
  await openTab();
  const strip = page.locator('.week .day');
  await expect(strip.nth(3).locator('.dn')).toHaveText('2');
  await expect(strip.nth(2).locator('.bars i')).toHaveCount(5); // six smokes: five bars, the number says 6
  await expect(strip.nth(2).locator('.dn')).toHaveText('6');
  const headings = await page.locator('.sday-h .gname').allTextContents();
  expect(headings[0]).toBe('Today');
  expect(headings).toHaveLength(8);
  await expect(page.locator('.sday-h').nth(1).locator('.n')).toHaveText('2 smokes');
  await expect(page.locator('.sday').nth(1).locator('.srow').first().locator('.tm')).toHaveText('21:15');
  await strip.nth(2).click();
  const h = page.locator(`#day-${await day(-4)}`);
  await expect.poll(async () => Math.round((await h.boundingBox())!.y)).toBeLessThanOrEqual(50);
  expect(await axe()).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '134-smokes-tab');
});

test('Add to leaderboard moves an entry’s smokes to the new product', async () => {
  await page.goto(`/log/${ids.gummies}`);
  await expect(card().locator('.smk-count b')).toHaveText('1');
  await page.getByRole('button', { name: 'Add to leaderboard' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(card().locator('.smk-count')).toHaveText(/^1\s*time taken$/);
  await openTab();
  await expect(rowsOf('Today').filter({ hasText: 'Sour Gummies' }).locator('.log-chip')).toHaveCount(0);
});

test('deleting a Log entry says how many smokes go, and they go', async () => {
  const bud = (await (await page.evaluate(async () => (await fetch('/api/log')).json())) as { entries: { id: string; name: string }[] }).entries.find((e) => e.name === 'Orange Bud')!;
  await smokeVia(`e:${bud.id}`, await day(-1), '08:00');
  await page.goto(`/log/${bud.id}`);
  await expect(card().locator('.smk-count b')).toHaveText('2');
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await expect(page.getByRole('dialog')).toContainText('This removes the entry and its 2 smokes for good.');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
  await expect(page).not.toHaveURL(/\/log\/.+/);
  await openTab();
  await expect(page.locator('.srow', { hasText: 'Orange Bud' })).toHaveCount(0);
});

test('an archived product keeps its smokes and count, but the picker leaves it out', async () => {
  await post(`/api/products/${ids.cake}/archived`, { value: true });
  await page.goto(`/products/${ids.cake}`);
  await expect(card().locator('.smk-count b')).toHaveText('14');
  await expect(card().getByRole('link', { name: 'Add a smoke' })).toHaveCount(0);
  await openTab();
  await expect(rowsOf('Today').filter({ hasText: 'Wedding Cake' })).toHaveCount(1);
  await page.goto('/smokes/new');
  await expect(page.getByRole('region', { name: 'Recent' })).toContainText('Sour Gummies');
  await expect(page.getByRole('button', { name: /Wedding Cake/ })).toHaveCount(0);
  await post(`/api/products/${ids.cake}/archived`, { value: false });
});

test('nothing about smokes reaches a follower', async ({ browser }) => {
  const fan = await (await browser.newContext()).newPage();
  const fanName = await signUp(fan, `fan${Date.now().toString(36).slice(-6)}`);
  const me = (await page.evaluate(async () => (await fetch('/api/auth/me')).json())) as { user: { username: string } };
  await fan.evaluate((u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), me.user.username);
  await page.evaluate((u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), fanName);
  const raw = await fan.evaluate(async ({ u, id }) => {
    const list = await (await fetch(`/api/people/u/${u}/products`)).text();
    const one = await (await fetch(`/api/people/u/${u}/products/${id}`)).text();
    return { list, one, smokes: (await fetch('/api/smokes')).status === 200 ? await (await fetch('/api/smokes')).text() : '' };
  }, { u: me.user.username, id: ids.cake });
  expect(raw.list).toContain('Wedding Cake');
  for (const body of [raw.list, raw.one]) expect(body.toLowerCase()).not.toMatch(/smoke|lifted|13:10/);
  expect(raw.smokes).toBe('{"smokes":[]}'); // the follower's own (empty) list, never yours
  await fan.goto(`/u/${me.user.username}/p/${ids.cake}`);
  await expect(fan.getByRole('heading', { level: 1, name: 'Wedding Cake' })).toBeVisible();
  await expect(fan.getByRole('region', { name: 'Smokes' })).toHaveCount(0);
  await fan.close();
});
