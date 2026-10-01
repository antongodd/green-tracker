import { expect, test, type Page } from '@playwright/test';
import { scoreHeat } from '../../shared/domain/heat';
import { contrastFailures, settled, shot, textBoxes } from './helpers';

// D36 (0.29.0): the welcome (sign-in) screen shows the name small at the top, the headline
// "Your stash, ranked.", and an example Leaderboard drawn with the real row styles (rainbow 1st,
// Diamond 2nd, a 3rd in its score's colour), labelled as an example, decorative and not tappable.
// The buttons are unchanged and always fit without scrolling. Sign-up and recovery screens get a
// glowing leaf tile, a glowing current step and the username in a green card.

const fits = (page: Page) =>
  page.evaluate(() => {
    const last = document.querySelector('.actions')!.getBoundingClientRect();
    return { scroll: document.documentElement.scrollHeight - innerHeight, bottom: Math.round(last.bottom), height: innerHeight };
  });

test('the headline and the example Leaderboard, in podium order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Green Tracker' })).toBeVisible();
  await expect(page.locator('.welcome .headline')).toHaveText('Your stash, ranked.');
  await expect(page.getByText('Rate, rank and remember everything you’ve tried.')).toBeVisible();
  const rows = page.locator('.showcase .row');
  await expect(rows).toHaveCount(3);
  expect(await rows.locator('.name').allTextContents()).toEqual(['Wedding Cake', 'Gelato 41', 'Zkittlez']);
  expect(await rows.locator('.score b').allTextContents()).toEqual(['9.4', '9.1', '8.6']);
  await expect(rows.nth(0)).toHaveClass(/\btier p1\b/);
  await expect(rows.nth(1)).toHaveClass(/\btier p2\b/);
  await expect(rows.nth(1).locator('.glint')).toHaveCount(3);
  await expect(rows.nth(2)).toHaveAttribute('data-heat', scoreHeat('overall', 8.6)!);
  await expect(page.locator('.showcase figcaption')).toHaveText('Example Leaderboard');
  await shot(page, '96-welcome');
});

test('the examples are decoration: hidden from screen readers and not tappable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.showcase .fan')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('link', { name: /Wedding Cake/ })).toHaveCount(0);
  const box = (await page.locator('.showcase .row').first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/(signin)?$/);
  await expect(page.locator('.welcome')).toBeVisible();
});

for (const [w, h, name] of [[390, 844, 'iPhone 13–16'], [375, 667, 'iPhone SE']] as const) {
  test(`everything fits without scrolling on an ${name} (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(page.locator('.showcase .row')).toHaveCount(3);
    await settled(page); // the fade-in slides the screen up 6px; measure where it comes to rest
    const f = await fits(page);
    expect(f.scroll).toBeLessThanOrEqual(0);
    expect(f.bottom).toBeLessThanOrEqual(f.height);
    // The examples don't run into the buttons.
    const fan = (await page.locator('.showcase').boundingBox())!;
    const first = (await page.locator('.actions').boundingBox())!;
    expect(fan.y + fan.height).toBeLessThanOrEqual(first.y);
    if (name === 'iPhone SE') await shot(page, '97-welcome-se');
  });
}

test('the buttons still lead where they did', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in with passkey' })).toBeVisible();
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Use a recovery code' }).click();
  await expect(page).toHaveURL(/\/recover$/);
});

test('sign-up and recovery: the glowing leaf tile, a glowing step and the green card', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Choose a username' })).toBeVisible();
  await expect(page.locator('.auth-mark svg')).toBeVisible();
  expect(await page.locator('.steps i.on').evaluate((e) => getComputedStyle(e).boxShadow)).toContain('rgba(88, 224, 140');
  await expect(page.locator('.fgroup').getByLabel('Username')).toBeVisible();
  expect(await page.locator('.fgroup').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
  await page.goto('/recover');
  await expect(page.getByRole('heading', { name: 'Use a recovery code' })).toBeVisible();
  await expect(page.locator('.auth-mark svg')).toBeVisible();
});

test('readable: headline, words and the example rows, through the shimmer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settled(page);
  const boxes = await textBoxes(page, '.welcome .brand h1, .welcome .headline, .welcome .headline em, .welcome .lead, .showcase figcaption, .showcase .name, .showcase .score b, .showcase .score .cap');
  expect(await contrastFailures(page, boxes)).toEqual([]);
});
