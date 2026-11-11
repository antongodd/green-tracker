import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contrastFailures, settled, shot, textBoxes } from './helpers';

// D36 (0.29.0): the welcome (sign-in) screen shows the name small at the top, the headline
// "Your stash, ranked.", and an example Leaderboard drawn with the real row styles (since D48 the
// colours by score in Aurora since D64: the aurora with the crown and halo, Violet, Lagoon), labelled as an
// example, decorative and not tappable.
// The buttons always fit without scrolling (since D80: Sign in, Create account, Sign in with Face ID). The
// sign-in and sign-up screens get a glowing leaf tile and a glowing current step.

const fits = (page: Page) =>
  page.evaluate(() => {
    const last = document.querySelector('.actions')!.getBoundingClientRect();
    return { scroll: document.documentElement.scrollHeight - innerHeight, bottom: Math.round(last.bottom), height: innerHeight };
  });

test('the headline and the example Leaderboard, in its colours', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Green Tracker' })).toBeVisible();
  await expect(page.locator('.welcome .headline')).toHaveText('Your stash, ranked.');
  await expect(page.getByText('Rate, rank and remember everything you’ve tried.')).toBeVisible();
  const rows = page.locator('.showcase .row');
  await expect(rows).toHaveCount(3);
  expect(await rows.locator('.name').allTextContents()).toEqual(['Wedding Cake', 'Gelato 41', 'Zkittlez']);
  expect(await rows.locator('.score b').allTextContents()).toEqual(['9.7', '9.2', '8.7']);
  await expect(rows.nth(0)).toHaveClass(/\btier band4 pal-aurora first\b/);
  await expect(rows.nth(0).locator('.rank-crown')).toHaveCount(1);
  await expect(rows.nth(1)).toHaveClass(/\btier band3 pal-aurora\b/);
  await expect(rows.nth(2)).toHaveClass(/\btier band2 pal-aurora\b/);
  await expect(rows.nth(2)).not.toHaveAttribute('data-heat');
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

test('the buttons lead where they should (D80)', async ({ page }) => {
  await page.goto('/');
  // Three buttons, in this order; no recovery codes.
  // toHaveText waits for the screen (0.86.0): allTextContents read the list while the app was still loading.
  await expect(page.locator('.welcome .actions .btn')).toHaveText(['Sign in', 'Create account', 'Sign in with Face ID']);
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  // The old address of recovery codes is just the welcome screen now.
  await page.goto('/recover');
  await expect(page).toHaveURL(/\/signin$/);
});

test('sign-in and sign-up: the glowing leaf tile, a glowing step, glass cards', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.locator('.auth-mark svg')).toBeVisible();
  expect(await page.locator('.steps i.on').evaluate((e) => getComputedStyle(e).boxShadow)).toContain('rgba(88, 224, 140');
  await expect(page.locator('.fgroup').getByLabel('Email')).toBeVisible();
  // A glass card since D64 (was D18's green wash).
  expect(await page.locator('.fgroup').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(255, 255, 255, 0.05)');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('.auth-mark svg')).toBeVisible();
});

test('sign-in and sign-up screens: axe finds nothing, and the words are readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/login', '/signup']) {
    await page.goto(path);
    await expect(page.locator('.form-page h1')).toBeVisible();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${path}: ${v.id}`)).toEqual([]);
    const boxes = await textBoxes(page, '.form-page h1, .form-page .lead, .field label, .hint, .btn.text, .pw .show');
    expect(await contrastFailures(page, boxes), path).toEqual([]);
  }
});

test('readable: headline, words and the example rows, through the shimmer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settled(page);
  const boxes = await textBoxes(page, '.welcome .brand h1, .welcome .headline, .welcome .headline em, .welcome .lead, .showcase figcaption, .showcase .name, .showcase .score b, .showcase .score .cap');
  expect(await contrastFailures(page, boxes)).toEqual([]);
});
