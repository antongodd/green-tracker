import { expect, test, type Browser, type Page } from '@playwright/test';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D35 (0.28.0): the tab bar's icons are slim outlines; the tab you're on shows its solid icon, in green. D87: four tabs
// (Settings is your photo, top right) in a floating glass bar, the tab you're on on a soft pill (no glow or line any
// more), the screen's + a round button beside the bar. The follow requests number is on the Feed tab since D77.
test.describe.configure({ mode: 'serial' });
let page: Page, fan: Page;
let name = '';
let fanName = '';

async function person(browser: Browser, prefix: string) {
  const p = await (await browser.newContext()).newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  return { page: p, name: await signUp(p, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}

/** Each tab: its name, whether it's current, its icon (solid or outline), glow, line and colour. */
const tabs = () =>
  page.locator('.nav .tab').evaluateAll((els) =>
    els.map((t) => {
      const svg = t.querySelector('svg')!;
      const after = getComputedStyle(t, '::after');
      return {
        label: t.querySelector('.tab-l')!.textContent,
        current: t.getAttribute('aria-current') === 'page',
        icon: svg.classList.contains('tab-on') ? 'solid' : svg.classList.contains('tab-off') ? 'outline' : '?',
        outlined: [...svg.querySelectorAll('path')].some((d) => d.getAttribute('stroke') === 'currentColor'),
        glow: getComputedStyle(svg).filter.includes('drop-shadow'),
        line: after.content !== 'none' && after.display !== 'none' ? after.width : null,
        pill: getComputedStyle(t).backgroundColor.replace(/\s/g, '') !== 'rgba(0,0,0,0)',
        color: getComputedStyle(t).color,
      };
    }),
  );

test.beforeAll(async ({ browser }) => {
  ({ page, name } = await person(browser, 'tab'));
  ({ page: fan, name: fanName } = await person(browser, 'fan'));
});

test('four tabs in a floating bar (D87): Sources third, Feed last, each a quarter of it; the + beside it', async () => {
  await page.goto('/');
  // Wait for the bar itself: on a busy machine the app is still starting when the page loads (0.36.0 CI).
  await expect(page.locator('.nav .tab-l')).toHaveText(['Leaderboard', 'Log', 'Sources', 'Feed']);
  const bar = (await page.locator('.nav').boundingBox())!;
  const fab = (await page.getByRole('button', { name: 'Add a product' }).boundingBox())!;
  expect(bar.x, 'off the left edge').toBeGreaterThanOrEqual(10);
  expect(844 - (bar.y + bar.height), 'off the bottom edge').toBeGreaterThanOrEqual(8);
  expect(fab.x, 'the + is beside the bar').toBeGreaterThan(bar.x + bar.width);
  expect(Math.abs(fab.y + fab.height / 2 - (bar.y + bar.height / 2)), 'level with it').toBeLessThanOrEqual(1);
  const widths = await page.locator('.nav .tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  for (const w of widths) expect(w).toBeCloseTo(widths[0]!, 0);
  // Each name fits its tab.
  const clipped = await page.locator('.nav .tab-l').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth || e.getBoundingClientRect().width > e.parentElement!.getBoundingClientRect().width).map((e) => e.textContent));
  expect(clipped).toEqual([]);
  // Without a + (Sources), the bar takes the width.
  await page.goto('/sources');
  await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText(/^Sources/);
  const wide = (await page.locator('.nav').boundingBox())!;
  expect(wide.width).toBeGreaterThan(bar.width + 60);
});

test('the old Smokes addresses open the Leaderboard', async () => {
  for (const path of ['/smokes', '/smokes/new']) {
    await page.goto(path);
    await expect(page.locator('.nav .tab[aria-current="page"]'), path).toHaveText(/^Leaderboard/);
  }
});

for (const [path, label] of [['/', 'Leaderboard'], ['/log', 'Log'], ['/sources', 'Sources'], ['/feed', 'Feed']] as const) {
  test(`on ${label}: only its tab is solid, green and on a pill; the others are outlines`, async () => {
    await page.goto(path);
    await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText(new RegExp(`^${label}`));
    for (const t of await tabs()) {
      if (t.label === label) {
        expect(t, t.label).toMatchObject({ current: true, icon: 'solid', outlined: false, glow: false, line: null, pill: true, color: 'rgb(111, 233, 164)' });
      } else {
        expect(t, t.label).toMatchObject({ current: false, icon: 'outline', outlined: true, glow: false, line: null, pill: false, color: 'rgba(241, 246, 243, 0.7)' });
      }
    }
    if (label === 'Leaderboard') await shot(page, '95-tabbar');
  });
}

test('the follow requests number moved to the Feed tab (D77)', async () => {
  await fan.evaluate(async (u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), name);
  await page.goto('/');
  const badge = page.locator('.nav .tab', { hasText: 'Feed' }).locator('.badge');
  await expect(badge).toHaveText('1');
  expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(69, 212, 131)');
  await page.goto('/people');
  await expect(badge).toHaveText('1');
});

test('the Feed tab’s dot: something new, only when there are no requests to number (D77)', async () => {
  // A request is waiting from the test above: the number wins, never two marks.
  await fan.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg'));
    const form = new FormData();
    form.append('cropped', blob, 'c.jpg');
    form.append('thumb', blob, 't.jpg');
    const { upload } = (await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string };
    await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caption: 'hello', about: null, photo: { upload } }) });
  });
  await page.evaluate(async (u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), fanName);
  await page.evaluate(async (u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), fanName);
  await fan.evaluate(async (u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), name);
  await page.goto('/');
  const feedTab = page.locator('.nav .tab', { hasText: 'Feed' });
  await expect(feedTab.locator('.badge')).toHaveCount(1);
  await expect(feedTab.locator('.badge.dot')).toHaveAttribute('aria-label', 'Something new');
  await feedTab.click();
  await expect(page.locator('.post').first()).toBeVisible();
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(feedTab.locator('.badge')).toHaveCount(0);
});

test('tab names are readable, current and not', async () => {
  for (const path of ['/log', '/feed']) {
    await page.goto(path);
    await page.locator('.nav .tab[aria-current="page"]').waitFor();
    await settled(page);
    expect(await contrastFailures(page, await textBoxes(page, '.nav .tab-l'), 1), path).toEqual([]);
  }
});
