import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContextOptions } from '@playwright/test';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D96 (0.85.0): put it on your Home Screen. Someone followed the website's Share steps and added the website
// itself, so the app now shows the steps: in Safari on an iPhone, in a browser tab, before sign-up (and to anyone
// still using it in a tab), with a quiet "Carry on in Safari". Any other browser on an iPhone gets a stop screen,
// "Open this in Safari", with the link to copy. Android has Chrome's steps. Opened from the Home Screen, or on a
// laptop (every other test file), none of it shows. The test browser is told which phone it is by its name
// (the user agent); Chromium has no Home Screen, so `navigator.standalone` is pretended in.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const UA = {
  safari26: `${IPHONE} Version/26.0 Mobile/15E148 Safari/604.1`,
  safari17: `${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`,
  chromeIos: `${IPHONE} CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1`,
  instagram: `${IPHONE} Mobile/15E148 Instagram 337.0.2.24.92`,
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
};
// Safari's own bars take some of the screen: what's left of an iPhone 15's 844 points is about this tall.
const IN_SAFARI = { width: 390, height: 664 };
const phone = (browser: Browser, userAgent: string, more: BrowserContextOptions = {}) =>
  browser.newContext({ userAgent, viewport: IN_SAFARI, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'], ...more });
const WORDS = '.install .inst-name, .install h1, .install .lead, .inst-steps b, .inst-t, .inst-n, .inst-key, .inst-url, .install .btn, .inst-arrow';
const axe = async (page: import('@playwright/test').Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
/** Where the arrow's words sit (the words themselves, not their full-width line). */
const words = (page: import('@playwright/test').Page) =>
  page.locator('.inst-arrow').evaluate((a) => { const r = document.createRange(); r.selectNodeContents(a); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
const steps = (page: import('@playwright/test').Page) => page.locator('.inst-steps li').evaluateAll((ls) => ls.map((l) => (l as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));

test('in Safari on an iPhone the app first shows the three taps, before sign-up, and they fit the screen', async ({ browser }) => {
  const context = await phone(browser, UA.safari26);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First, put Green Tracker on your Home Screen' })).toBeVisible();
  await settled(page);
  expect(await steps(page)).toEqual([
    '1 Tap ··· below, then Share Share already in the bar? Tap it.',
    '2 Tap View More, then Add to Home Screen View More is the last round button.',
    '3 Tap Add Then open Green Tracker from your Home Screen and make your account there.',
  ]);
  await expect(page.locator('.install .lead').first()).toHaveText('Three taps, then you make your account in the app.');
  // No way into sign-up or sign-in from here except carrying on.
  await expect(page.getByRole('link', { name: 'Create account' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  // The arrow points down at Safari's ⋯, bottom right; everything fits without scrolling.
  const arrow = await words(page);
  expect(arrow.x).toBeGreaterThan(195);
  expect(arrow.y + arrow.h).toBeLessThanOrEqual(IN_SAFARI.height);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(IN_SAFARI.height);
  // With room to spare: other phones draw the words a little bigger.
  expect(await page.locator('.inst-space').evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThan(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(IN_SAFARI.width);
  await shot(page, '200-install-safari');
  expect(await axe(page)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, WORDS))).toEqual([]);
  // The same whatever address they arrived at.
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'First, put Green Tracker on your Home Screen' })).toBeVisible();
  await context.close();
});

test('"Carry on in Safari" goes on to the welcome screen for this visit; the steps are back next time', async ({ browser }) => {
  const context = await phone(browser, UA.safari26);
  const page = await context.newPage();
  await page.goto('/');
  const carryOn = page.getByRole('button', { name: 'Carry on in Safari' });
  expect((await carryOn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await carryOn.click();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  // Still skipped after a reload in the same tab.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await expect(page.locator('.install')).toHaveCount(0);
  // A new tab is a new visit.
  const next = await context.newPage();
  await next.goto('/');
  await expect(next.getByRole('heading', { name: 'First, put Green Tracker on your Home Screen' })).toBeVisible();
  await context.close();
});

test('an older iPhone, where Share is in the bar, gets those words and an arrow to the middle', async ({ browser }) => {
  const context = await phone(browser, UA.safari17);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.install')).toBeVisible();
  await settled(page);
  expect((await steps(page)).slice(0, 2)).toEqual(['1 Tap Share below The square with an arrow pointing up.', '2 Tap Add to Home Screen Scroll down the list to find it.']);
  const arrow = await words(page);
  expect(Math.abs(arrow.x + arrow.w / 2 - 195)).toBeLessThan(2);
  // No Add to Home Screen in the list? Then it isn't Safari itself: the link to carry there.
  await page.getByRole('button', { name: 'Can’t find Add to Home Screen?' }).click();
  await expect(page.getByText('Then this isn’t Safari itself')).toBeVisible();
  await page.getByRole('button', { name: 'Copy the link' }).click();
  await expect(page.getByRole('button', { name: 'Copied. Now open Safari' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(page.url()).origin);
  expect(await axe(page)).toEqual([]);
  await context.close();
});

for (const [name, ua] of [['Chrome', UA.chromeIos], ['Instagram', UA.instagram]] as const) {
  test(`on an iPhone in ${name}, a new person is stopped: Open this in Safari, with the link to copy`, async ({ browser }) => {
    const context = await phone(browser, ua);
    const page = await context.newPage();
    for (const path of ['/', '/signup', '/login']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Open this in Safari' })).toBeVisible();
    }
    await settled(page);
    expect(await steps(page)).toEqual(['1 Copy the link', '2 Open Safari The blue compass on your iPhone.', '3 Paste it in the bar at the bottom and tap Go']);
    // No way past it, and no sign-up underneath.
    await expect(page.getByRole('button', { name: /Carry on/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveCount(0);
    await expect(page.locator('.inst-url')).toHaveText(new URL(page.url()).host);
    await shot(page, `201-install-stop-${name.toLowerCase()}`);
    expect(await axe(page)).toEqual([]);
    expect(await contrastFailures(page, await textBoxes(page, WORDS))).toEqual([]);
    await page.getByRole('button', { name: 'Copy the link' }).click();
    await expect(page.getByRole('button', { name: 'Copied. Now open Safari' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(page.url()).origin);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(IN_SAFARI.width);
    await context.close();
  });
}

test('someone already using the app in a tab sees the steps too, and can always carry on to their own things', async ({ browser }) => {
  const context = await phone(browser, UA.safari26);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Carry on in Safari' }).click();
  const username = await signUp(page, `inst${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  // Next visit, signed in: the same screen, with words for someone who has an account.
  const next = await context.newPage();
  await next.goto('/');
  await expect(next.getByRole('heading', { name: 'First, put Green Tracker on your Home Screen' })).toBeVisible();
  await expect(next.locator('.install .lead').first()).toHaveText('Three taps, and it opens full screen like a proper app.');
  expect((await steps(next))[2]).toBe('3 Tap Add Then open Green Tracker from your Home Screen.');
  await next.getByRole('button', { name: 'Carry on in Safari' }).click();
  await expect(next.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(next.locator('.me-btn')).toHaveAccessibleName(`Settings (@${username})`);
  // The same account in Chrome on the iPhone: told to open Safari, but never locked out of their own things.
  const chrome = await phone(browser, UA.chromeIos, { storageState: await context.storageState() });
  const tab = await chrome.newPage();
  await tab.goto('/');
  await expect(tab.getByRole('heading', { name: 'Open this in Safari' })).toBeVisible();
  await tab.getByRole('button', { name: 'Carry on here' }).click();
  await expect(tab.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await chrome.close();
  await context.close();
});

test('opened from the Home Screen, the app goes straight to the welcome screen', async ({ browser }) => {
  for (const ua of [UA.safari26, UA.android]) {
    const context = await phone(browser, ua);
    const page = await context.newPage();
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
    await expect(page.locator('.install')).toHaveCount(0);
    await context.close();
  }
});

test('Android: Chrome gets its own three taps, another browser is sent to Chrome', async ({ browser }) => {
  const context = await phone(browser, UA.android);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First, put Green Tracker on your Home screen' })).toBeVisible();
  await settled(page);
  expect(await steps(page)).toEqual([
    '1 Tap ⋮ at the top right',
    '2 Tap Add to Home screen It may say Install app.',
    '3 Tap Install or Add Then open Green Tracker from your Home screen and make your account there.',
  ]);
  await expect(page.locator('.inst-arrow')).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, WORDS))).toEqual([]);
  await page.getByRole('button', { name: 'Carry on in Chrome' }).click();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await context.close();
  const other = await phone(browser, UA.samsung);
  const tab = await other.newPage();
  await tab.goto('/');
  await expect(tab.getByRole('heading', { name: 'Open this in Chrome' })).toBeVisible();
  await expect(tab.getByRole('button', { name: /Carry on/ })).toHaveCount(0);
  await tab.getByRole('button', { name: 'Copy the link' }).click();
  await expect(tab.getByRole('button', { name: 'Copied. Now open Chrome' })).toBeVisible();
  await other.close();
});

test('the steps are readable in the light look, and nothing moves with Reduce Motion', async ({ browser }) => {
  // The phone remembers the last Look (look.js); a signed-out screen is drawn in it.
  const context = await phone(browser, UA.safari26, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('gt.look', 'daysky'));
  await page.goto('/');
  await expect(page.locator('.install')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'light');
  await settled(page);
  expect(await axe(page)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, WORDS))).toEqual([]);
  expect(await page.locator('.inst-arrow').evaluate((a) => a.getAnimations().length)).toBe(0);
  await shot(page, '202-install-light');
  await context.close();
});
