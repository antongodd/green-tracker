import { expect, test, type Page } from '@playwright/test';
import { shot, signUp } from './helpers';

/** Types a rating by tapping its value (brief §6.6). */
async function rate(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}: .*Tap to type`) }).click();
  const input = page.getByLabel(`${label} (1 to 10)`);
  await input.fill(value);
  await input.press('Enter');
}

const hero = (page: Page) => page.locator('.hero');

test('add, rate, price, switch type, make private, archive and restore a product', async ({ page }) => {
  await signUp(page);

  // Empty Leaderboard invites the first product.
  await expect(page.getByRole('heading', { name: 'Nothing ranked yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a product' }).click();
  await expect(page).toHaveURL(/\/products\/new$/);

  // Defaults: Flower, the flower rating set, no date tried.
  await expect(page.getByLabel('Product type')).toHaveValue('flower');
  await expect(page.getByLabel('Date tried')).toHaveValue('');
  for (const l of ['Look', 'Smell', 'Taste', 'Burn', 'High']) await expect(page.getByText(l, { exact: true })).toBeVisible();

  // Name auto-capitalises on blur, only adding capitals.
  await page.getByLabel('Name').fill('gelato 41 OG');
  await page.getByLabel('Source').click();
  await expect(page.getByLabel('Name')).toHaveValue('Gelato 41 OG');
  await page.getByLabel('Source').fill('cookies');
  await page.getByLabel('Strain type').selectOption('hybrid');
  await page.getByLabel('Country', { exact: true }).click();
  await page.keyboard.type('usa');
  await page.getByRole('dialog', { name: 'Choose a country' }).getByRole('button', { name: 'United States' }).click();

  await rate(page, 'Look', '9.2');
  await rate(page, 'Smell', '9');
  await rate(page, 'Taste', '8.8');
  await rate(page, 'Burn', '8.6');
  await rate(page, 'High', '9.4');
  await expect(page.getByText('Rated 5 of 5 · Overall 8.9')).toBeVisible();
  await expect(page.getByText('Overall is the average of Look, Smell, Taste and Burn. High is rated but doesn\'t count. Blank categories are left out.')).toBeVisible();

  // Purchases: date defaults to today; the per-unit price is derived live.
  await page.getByRole('button', { name: 'Add purchase' }).click();
  const purchase = page.getByRole('group', { name: 'Purchase 1' });
  await expect(purchase.getByLabel('Date')).not.toHaveValue('');
  await purchase.getByLabel('Amount (g)').fill('3.5');
  await purchase.getByLabel('Total paid (£)').fill('9.50');
  await expect(purchase.getByText('£2.71/g')).toBeVisible();
  await shot(page, '10-editor');
  await page.getByRole('button', { name: 'Save' }).click();

  // Profile: Overall is the hero, price, VFM on the unrounded price (8.9 ÷ 2.714… = 3.28).
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(hero(page).getByText('8.9')).toBeVisible();
  await expect(hero(page).getByText('£2.71/g')).toBeVisible();
  await expect(page.getByText('Rated 5 of 5 categories')).toBeVisible();
  await expect(page.getByText('Latest', { exact: true })).toBeVisible();
  await expect(page.locator('.vfm b')).toHaveText('3.28');
  await expect(page.getByRole('link', { name: 'Search Leafly' })).toHaveAttribute('href', 'https://www.leafly.com/search?q=Gelato%2041%20OG');
  await shot(page, '11-profile');
  const profileUrl = page.url();

  // Switch to Edibles: Taste and High carry over; Look/Smell/Burn hide; Overall = Taste ⅓ + High ⅔.
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByLabel('Product type').selectOption('edibles');
  await expect(page.getByText('Look', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Rated 2 of 2 · Overall 9.2')).toBeVisible();
  await expect(page.getByText('Hit time', { exact: true })).toBeVisible();
  // The old figure is relabelled in mg, never converted.
  await expect(page.getByLabel('Amount (mg THC)')).toHaveValue('3.5');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(profileUrl);
  await expect(hero(page).getByText('9.2')).toBeVisible();
  await expect(hero(page).getByText('£2.71/mg')).toBeVisible();

  // And back to Flower: every rating is still there.
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByLabel('Product type').selectOption('flower');
  await expect(page.getByText('Rated 5 of 5 · Overall 8.9')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(hero(page).getByText('8.9')).toBeVisible();

  // Cancel needs no prompt and changes nothing.
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await page.getByLabel('Name').fill('Something else');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(profileUrl);
  await expect(page.getByRole('heading', { name: 'Gelato 41 OG' })).toBeVisible();

  // Profile → editor → back returns to the same scroll position (brief §10.3).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  // Record every scroll and page height on the way back, to explain a failure (0.18.1).
  await page.evaluate(() => {
    const w = window as unknown as { gtScrollLog: string[] };
    w.gtScrollLog = [];
    addEventListener('scroll', () => w.gtScrollLog.push(`${Math.round(performance.now())}ms y=${scrollY} h=${document.documentElement.scrollHeight} ${location.pathname}`));
  });
  // Tap it like a finger, at its spot on screen. Playwright's click() sometimes scrolls
  // the page first (116px here), which the app then rightly remembers, so the check
  // compared against a position the test itself had moved away from (0.18.1).
  const edit = await page.locator('.sect').getByRole('link', { name: 'Edit' }).boundingBox();
  expect(edit!.y).toBeGreaterThan(60);
  expect(edit!.y + edit!.height).toBeLessThan(844 - 60);
  await page.mouse.click(edit!.x + edit!.width / 2, edit!.y + edit!.height / 2);
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  try {
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 12);
  } catch (e) {
    const log = await page.evaluate(() => (window as unknown as { gtScrollLog: string[] }).gtScrollLog.join('\n  '));
    throw new Error(`${(e as Error).message}\nbefore=${before}; scrolls on the way back:\n  ${log}`);
  }

  // Private: saved straight from the profile, shown as a lock on your own row.
  await page.getByRole('switch', { name: /Private/ }).check();
  await expect(hero(page).getByText('Private')).toBeVisible();

  // A second, unrated product classified Other: no icon, sorts to the bottom.
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await page.getByRole('button', { name: 'Add a product' }).click();
  await page.getByLabel('Name').fill('mystery sample');
  await page.getByLabel('Product type').selectOption('other');
  await page.getByLabel('Date tried').fill('2026-08-12');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Leaderboard' }).click();

  const rows = page.locator('.row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveClass(/p1/);
  await expect(rows.nth(0)).toContainText('Gelato 41 OG');
  await expect(rows.nth(0).getByRole('img', { name: 'Private' })).toBeVisible();
  await expect(rows.nth(0).locator('.meta')).toHaveText(/^£2\.71\/g\s*·\s*Cookies$/);
  await expect(rows.nth(1)).toContainText('Mystery Sample');
  await expect(rows.nth(1)).toContainText('Unrated');
  await expect(rows.nth(1)).toContainText('12 Aug 2026'); // date-tried fallback
  await shot(page, '12-leaderboard');

  // Archive behind a confirmation, then restore from More → Archive.
  await rows.nth(0).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await shot(page, '13-archive-sheet');
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.row')).toHaveCount(1);
  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: /Archive\s*1/ })).toBeVisible();
  await page.getByRole('link', { name: /Archive/ }).click();
  await expect(page.locator('.row')).toContainText('Gelato 41 OG');
  await shot(page, '14-archive');
  await page.getByRole('button', { name: 'Un-archive' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing archived' })).toBeVisible();
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(page.locator('.row')).toHaveCount(2);
});

test('the editor refuses a product with no name, inline', async ({ page }) => {
  await signUp(page);
  await page.goto('/products/new');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Give the product a name.');
  await expect(page).toHaveURL(/\/products\/new$/);
});
