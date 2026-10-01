import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D38 (0.31.0): the More screen opens with you (photo or letter, @username, products, followers
// and following; tap → People), then settings rows with small tinted icon tiles (Account · Data ·
// Sign out · Danger zone), and the version in a footer under the leaf.
test.describe.configure({ mode: 'serial' });
let page: Page;
let name = '';

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  name = await signUp(page, `mr${Date.now().toString(36).slice(-6)}`);
  for (const n of ['One', 'Two']) {
    await page.evaluate(async (b) => fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), { ...emptyProductInput(), name: n });
  }
  const friend = await (await browser.newContext()).newPage();
  const friendName = await signUp(friend, `mf${Date.now().toString(36).slice(-6)}`);
  await page.evaluate(async (u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), friendName);
  await friend.evaluate(async (u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), name);
  await friend.context().close();
});

test('you at the top: letter, @username and your counts; tapping opens People', async () => {
  await page.goto('/more');
  const card = page.locator('.more-me');
  await expect(card.locator('b')).toHaveText(`@${name}`);
  await expect(card.locator('.av')).toHaveText(name[0]!.toUpperCase());
  await expect(card.locator('.who span')).toHaveText('2 products · 0 followers · 1 following');
  await expect(page.getByText('Username', { exact: true })).toHaveCount(0);
  await shot(page, '100-more');
  await card.click();
  await expect(page).toHaveURL(/\/people$/);
});

test('every row has its icon tile, in groups, and still goes where it did', async () => {
  await page.goto('/more');
  await expect(page.locator('main .list .li')).toHaveCount(9);
  const rows = await page.locator('main .list .li').evaluateAll((els) =>
    els.map((e) => ({ label: e.querySelector('.main')!.textContent, icon: !!e.querySelector('.li-ic svg'), tint: e.querySelector('.li-ic')?.classList[1] ?? null, href: e.getAttribute('href') })),
  );
  expect(rows).toEqual([
    { label: 'Passkeys', icon: true, tint: 'green', href: '/more/passkeys' },
    { label: 'Recovery codes', icon: true, tint: 'amber', href: '/more/recovery-codes' },
    { label: 'Blocked people', icon: true, tint: 'green', href: '/more/blocked' },
    { label: 'Export', icon: true, tint: 'teal', href: '/more/export' },
    { label: 'Restore', icon: true, tint: 'teal', href: '/more/restore' },
    { label: 'Archive', icon: true, tint: 'green', href: '/more/archive' },
    { label: 'Sign out', icon: true, tint: 'green', href: null },
    { label: 'Sign out everywhere', icon: true, tint: 'green', href: null },
    { label: 'Delete account', icon: true, tint: 'red', href: '/more/delete' },
  ]);
  expect(await page.locator('.lh.cap').allTextContents()).toEqual(['Account', 'Data', 'Danger zone']);
  expect(await page.locator('.li.dng .main').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 107, 107)');
  await page.getByRole('link', { name: /Recovery codes/ }).click();
  await expect(page).toHaveURL(/\/more\/recovery-codes$/);
  await page.goto('/more');
  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page.getByRole('dialog', { name: 'Sign out everywhere?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('the version sits in the footer under the leaf', async () => {
  await page.goto('/more');
  await expect(page.locator('.more-foot span')).toHaveText(/^Green Tracker \d+\.\d+\.\d+/);
  await expect(page.locator('.more-foot svg')).toBeVisible();
  await expect(page.getByText('Version', { exact: true })).toHaveCount(0);
});

test('readable: the card, rows, values, headings and footer', async () => {
  await page.goto('/more');
  await settled(page);
  await page.locator('.more-foot').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await contrastFailures(page, await textBoxes(page, '.more-me b, .more-me .who span, .li .main, .li .v, .lh.cap'), 1)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await contrastFailures(page, await textBoxes(page, '.more-foot span'), 1)).toEqual([]);
});
