import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { DEFAULT_PRIVACY } from '../../shared/domain/privacy';
import { settled, shot, signUp, wholeScreenContrastFailures } from './helpers';

// Friends on Strainz (D94, 0.83.0): friends who've tried a strain (a list on the strain's page and a friend's product
// page), a Strainz page on a friend's profile, + Want to try from a friend (note "From @them"), and the new switch
// "My Want to try lists" (off until you turn it on). The Log is never shared.
test.describe.configure({ mode: 'serial' });

let me: Page, sam: Page;
let meName = '', samName = '';
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );
const rated = (n: number) => ({ look: n, smell: n, taste: n, burn: n });
const product = (page: Page, name: string, over: Partial<ProductInput> = {}) => call(page, 'POST', '/api/products', { ...emptyProductInput(), name, ...over });
const axe = async (page: Page) => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: me, name: meName } = await person(browser, 'fsme'));
  ({ page: sam, name: samName } = await person(browser, 'fssam'));
  await call(me, 'POST', `/api/people/u/${samName}/follow`);
  await call(sam, 'POST', `/api/people/requests/${meName}/approve`);
  await product(me, 'Zkittlez', { ratings: rated(8) });
  await product(me, 'Gelato 41', { ratings: rated(9) });
  await product(sam, 'Zkittlez', { ratings: rated(9), source: 'Green Room' });
  await product(sam, 'Gelato 41', { ratings: rated(7.5) });
  await product(sam, 'Runtz', { ratings: rated(8.5) });
  await product(sam, 'Secret Kush', { ratings: rated(9.9), private: true });
  await call(sam, 'POST', '/api/wants', { kind: 'strain', name: 'Permanent Marker', note: 'From Drew, keep it quiet' });
  await call(sam, 'POST', '/api/wants', { kind: 'strain', name: 'Zkittlez' });
  await call(sam, 'POST', '/api/wants', { kind: 'source', name: 'Cloud Nine' });
});

test('your strain’s page lists the friends who’ve tried it, with what they had and their score', async () => {
  await me.goto('/strainz/Zkittlez');
  const list = me.locator('.friends-tried');
  await expect(list.locator('.group-h')).toHaveText(/Friends who’ve tried it\s*1/);
  await expect(list.locator('.ft-n')).toHaveText([`@${samName}`]);
  await expect(list.locator('.ft-m')).toHaveText(['Flower · Green Room']);
  await expect(list.locator('.ft-s')).toHaveText(['9.0']);
  await shot(me, 'friends-tried');
  expect(await axe(me)).toEqual([]);
  expect(await wholeScreenContrastFailures(me, '/strainz/Zkittlez', '.ft-n, .ft-m, .ft-s, .friends-tried .gname')).toEqual([]);
  await me.locator('.ftried a').first().click();
  await expect(me).toHaveURL(new RegExp(`/u/${samName}/p/`));
  await expect(me.getByRole('heading', { level: 1, name: 'Zkittlez' })).toBeVisible();
  // A strain you've had yourself: no add, just "You've tried it".
  await expect(me.locator('.add-want')).toHaveText('You’ve tried it');
});

test('a friend’s profile has Leaderboard | Posts | Strainz: both tried, only them, their list stays private until shared', async () => {
  await me.goto(`/u/${samName}`);
  await expect(me.getByRole('tab')).toHaveText(['Leaderboard', 'Posts', 'Strainz']);
  await me.getByRole('tab', { name: 'Strainz' }).click();
  await expect(me).toHaveURL(new RegExp(`/u/${samName}/strainz$`));
  await expect(me.locator('table.vs-both tbody tr')).toHaveCount(2);
  const rows = await me.locator('table.vs-both tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => (c.textContent ?? '').trim() + (c.classList.contains('win') ? '*' : ''))));
  expect(rows).toEqual([
    ['Zkittlez', '8.0', '9.0 (higher)*'],
    ['Gelato 41', '9.0 (higher)*', '7.5'],
  ]);
  await expect(me.locator('.vs-foot')).toHaveText(`You rate higher on 1, @${samName} on 1. Your score is on the left; the higher one is green.`);
  await expect(me.getByRole('heading', { name: `Only @${samName} has tried` })).toBeVisible();
  await expect(me.locator('#ts-only ~ .wrap .wr-n, section:has(#ts-only) .wr-n')).toHaveText(['Runtz']);
  await expect(me.getByText('Secret Kush')).toHaveCount(0);
  await expect(me.getByText(`@${samName}’s Want to try list is private.`)).toBeVisible();
  await expect(me.getByText('Permanent Marker')).toHaveCount(0);
  // Your own page keeps two tabs.
  await me.goto(`/u/${meName}`);
  await expect(me.getByRole('tab')).toHaveText(['Leaderboard', 'Posts']);
});

test('the switch: off until turned on in What followers see; then their lists show by name, never the notes', async () => {
  await sam.goto('/more/privacy');
  const sw = sam.getByRole('switch', { name: 'My Want to try lists' });
  await expect(sw).not.toBeChecked();
  await expect(sam.getByText('Your Want to try lists: private.')).toBeVisible();
  // The switch moves at once and saves behind it: wait for the save before asking the server (0.83.1's run read it
  // too early on a busy machine).
  const saved = sam.waitForResponse((r) => r.url().endsWith('/api/privacy') && r.request().method() === 'PUT');
  await sw.click();
  await expect(sw).toBeChecked();
  await expect(sam.getByText('Your Want to try lists: shared, names only.')).toBeVisible();
  expect((await saved).ok()).toBe(true);
  expect((await call(sam, 'GET', '/api/privacy')).privacy.shareWants).toBe(true);
  expect(await axe(sam)).toEqual([]);

  await me.goto(`/u/${samName}/strainz`);
  const want = me.locator('section:has(#ts-want)');
  await expect(want.locator('.wr-n')).toHaveText(['Zkittlez', 'Permanent Marker']);
  await expect(want.locator('.add-want').first()).toHaveText('You’ve tried it');
  await expect(me.locator('section:has(#ts-src) .wr-n')).toHaveText(['Cloud Nine']);
  await expect(me.getByText(/keep it quiet/)).toHaveCount(0);
  await shot(me, 'their-strainz');
  expect(await axe(me)).toEqual([]);
  expect(await wholeScreenContrastFailures(me, `/u/${samName}/strainz`, 'table.vs-both th, table.vs-both td, .vs-foot, .wr-n, .wr-m, .add-want, .their-strainz .gname')).toEqual([]);
});

test('+ Want to try adds a friend’s strain or source to your own list, noted "From @them"; they aren’t told', async () => {
  await me.goto(`/u/${samName}/strainz`);
  await me.getByRole('button', { name: 'Add Permanent Marker to my Want to try' }).click();
  await expect(me.locator('section:has(#ts-want) .add-want.done')).toHaveText('✓ On your Want to try');
  await me.getByRole('button', { name: 'Add Cloud Nine to my Want to try' }).click();
  await me.getByRole('button', { name: 'Add Runtz to my Want to try' }).click();
  await expect(me.locator('.add-want.done')).toHaveCount(3);
  const mine = (await call(me, 'GET', '/api/wants')).wants.map((w: { kind: string; name: string; note: string }) => `${w.kind}:${w.name}:${w.note}`).sort();
  expect(mine).toEqual([`source:Cloud Nine:From @${samName}`, `strain:Permanent Marker:From @${samName}`, `strain:Runtz:From @${samName}`]);
  // Sam's own list is unchanged and nothing tells them.
  expect((await call(sam, 'GET', '/api/wants')).wants).toHaveLength(3);
  // Adding the same again just says it's on your list.
  await me.goto(`/u/${samName}/strainz`);
  await me.getByRole('button', { name: 'Add Runtz to my Want to try' }).click();
  await expect(me.locator('section:has(#ts-only) .add-want')).toHaveText('On your list');
});

test('a friend’s product page: + Add to my Want to try, and who else has tried it', async () => {
  const board = (await call(me, 'GET', `/api/people/u/${samName}/products`)).products as { id: string; name: string }[];
  const runtz = board.find((p) => p.name === 'Runtz')!;
  await call(me, 'DELETE', `/api/wants/${(await call(me, 'GET', '/api/wants')).wants.find((w: { name: string }) => w.name === 'Runtz').id}`);
  await me.goto(`/u/${samName}/p/${runtz.id}`);
  await me.getByRole('button', { name: '+ Add to my Want to try' }).click();
  await expect(me.locator('.add-want.done')).toHaveText('✓ On your Want to try');
  await expect(me.locator('.friends-tried .ft-n')).toHaveText([`@${samName}`]);
  expect(await axe(me)).toEqual([]);
  await call(sam, 'PUT', '/api/privacy', DEFAULT_PRIVACY);
});
