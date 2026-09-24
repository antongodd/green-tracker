import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { expectTilesCentredAndWashed, shot, signUp } from './helpers';

// Two real people in two browsers: an owner with products, and a fan.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName: string, fanName: string;
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`);
  return { page, name };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'Bella'));
  ({ page: fan, name: fanName } = await person(browser, 'fran'));
  await post(owner, '/api/products', P({ name: 'Wedding Cake', strainType: 'hybrid', country: 'US', source: 'Jungle Boys', ratings: { look: 9, smell: 9.2, taste: 9, burn: 9.2 }, purchases: [{ date: '2026-09-01', amount: 3.5, totalPaid: 35, supplier: 'Secret Shop' }], notes: 'Private notes', leaflyLink: 'leafly.com/x' }));
  await post(owner, '/api/products', P({ name: 'Hash Rosin', productType: 'concentrate', strainType: 'indica', country: 'GB', ratings: { look: 8.8, consistency: 8.8, smell: 8.8, taste: 8.8, burn: 8.8 } }));
  await post(owner, '/api/products', P({ name: 'Hidden Haze', private: true, ratings: { look: 9.9 } }));
});

test('find someone and request to follow', async () => {
  await fan.getByRole('link', { name: 'People' }).click();
  await fan.getByPlaceholder('Search usernames').fill(ownerName.slice(0, 6).toLowerCase());
  const row = fan.locator('.prow', { hasText: `@${ownerName}` });
  await row.getByRole('button', { name: 'Follow' }).click();
  await expect(row.getByRole('button', { name: /Requested/ })).toBeVisible();
  // Before approval: username and a Follow state only.
  await row.getByRole('link').click();
  await expect(fan.getByText('Waiting for')).toBeVisible();
  await expect(fan.locator('.row')).toHaveCount(0);
  await shot(fan, '50-requested');
});

test('the owner sees the request as a badge and approves it', async () => {
  await owner.reload();
  const badge = owner.getByRole('link', { name: /People/ }).locator('.badge');
  await expect(badge).toHaveText('1');
  await owner.getByRole('link', { name: /People/ }).click();
  await expect(owner.getByRole('tab', { name: /Requests/ })).toHaveAttribute('aria-selected', 'true');
  await expect(owner.locator('.prow', { hasText: `@${fanName}` })).toBeVisible();
  await shot(owner, '51-requests');
  await owner.locator('.prow', { hasText: `@${fanName}` }).getByRole('button', { name: 'Approve' }).click();
  await expect(badge).toHaveCount(0);
  await owner.getByRole('tab', { name: /Followers/ }).click();
  await expect(owner.locator('.prow', { hasText: `@${fanName}` })).toBeVisible();
});

test('the fan sees a read-only leaderboard: @username header, two tiles, Source only, no private product', async () => {
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.hdr .title')).toHaveText(`@${ownerName}`);
  await expect(fan.locator('.row')).toHaveCount(2);
  await expect(fan.locator('.row', { hasText: 'Hidden Haze' })).toHaveCount(0);
  await expect(fan.locator('.tile')).toHaveCount(2);
  await expect(fan.locator('.tile', { hasText: 'Total' })).toHaveCount(0);
  await expectTilesCentredAndWashed(fan);
  await expect(fan.locator('.row', { hasText: 'Wedding Cake' }).locator('.meta')).toHaveText('Jungle Boys');
  await expect(fan.locator('.row', { hasText: 'Hash Rosin' }).locator('.meta')).toHaveCount(0);
  await expect(fan.getByRole('button', { name: 'Add a product' })).toHaveCount(0);
  await expect(fan.getByRole('img', { name: 'Private' })).toHaveCount(0);
  await expect(fan.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  // Rank by never offers Price or Value for money.
  await fan.getByLabel('Type', { exact: true }).selectOption('flower');
  const options = await fan.getByLabel('Rank by').locator('option').allTextContents();
  expect(options).not.toContain('Price per gram');
  expect(options).not.toContain('Value for money');
  await fan.getByLabel('Type', { exact: true }).selectOption('all');
  await shot(fan, '52-their-leaderboard');
});

test('their profile shows identity, ratings and details only — no price, notes, Leafly or actions', async () => {
  await fan.locator('.row', { hasText: 'Wedding Cake' }).click();
  await expect(fan.locator('.hdr .title')).toContainText(`@${ownerName} / Wedding Cake`);
  await expect(fan.locator('.hero-score b')).toHaveText('9.1');
  await expect(fan.getByText('Jungle Boys')).toBeVisible();
  for (const hidden of ['Price history', 'Value for money', 'Private notes', 'Leafly', 'Secret Shop', '£']) {
    await expect(fan.getByText(hidden)).toHaveCount(0);
  }
  for (const action of ['Edit', 'Archive', 'Private']) await expect(fan.getByRole('button', { name: action })).toHaveCount(0);
  await expect(fan.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await shot(fan, '53-their-profile');
  await fan.getByRole('link', { name: 'Back' }).click();
});

test('removing a follower ends access at once', async () => {
  await owner.locator('.prow', { hasText: `@${fanName}` }).getByRole('button', { name: /Actions for/ }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Remove follower' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Remove follower' }).click();
  await expect(owner.getByText('No followers yet.')).toBeVisible();
  await fan.reload();
  await expect(fan.getByText('Follow to see their leaderboard.')).toBeVisible();
  await expect(fan.locator('.row')).toHaveCount(0);
  await shot(fan, '54-stranger');
});

test('blocking hides the blocker; unblocking from More', async () => {
  await fan.getByRole('button', { name: 'Follow' }).click();
  await owner.reload();
  await owner.getByRole('tab', { name: /Requests/ }).click();
  await owner.locator('.prow', { hasText: `@${fanName}` }).getByRole('button', { name: 'Approve' }).click();
  await owner.getByRole('tab', { name: /Followers/ }).click();
  await owner.locator('.prow', { hasText: `@${fanName}` }).getByRole('button', { name: /Actions for/ }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Block' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Block' }).click();

  await fan.reload();
  await expect(fan.getByRole('heading', { name: 'No one found' })).toBeVisible();
  await fan.goto('/people');
  await fan.getByPlaceholder('Search usernames').fill(ownerName.slice(0, 6).toLowerCase());
  await expect(fan.getByText(/No one found for/)).toBeVisible();

  await owner.getByRole('link', { name: 'More' }).click();
  await owner.getByRole('link', { name: /Blocked people/ }).click();
  await owner.locator('.prow', { hasText: `@${fanName}` }).getByRole('button', { name: 'Unblock' }).click();
  await expect(owner.getByText('You haven’t blocked anyone.')).toBeVisible();
  await fan.getByPlaceholder('Search usernames').fill(ownerName.slice(0, 5).toLowerCase());
  await expect(fan.locator('.prow', { hasText: `@${ownerName}` })).toBeVisible();
});
