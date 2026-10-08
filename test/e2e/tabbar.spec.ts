import { expect, test, type Browser, type Page } from '@playwright/test';
import { contrastFailures, shot, signUp, textBoxes } from './helpers';

// D35 (0.28.0): the tab bar's icons (P1's podium, notebook, people, dots; D43's flame for Smokes
// since 0.36.0) are slim outlines; the tab you're on shows its solid icon, in green, glowing, with a
// short glowing green line under its name, in place of D18's green bubble. The People badge is unchanged.
test.describe.configure({ mode: 'serial' });
let page: Page, fan: Page;
let name = '';

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
        line: after.content !== 'none' && after.backgroundColor === 'rgb(88, 224, 140)' ? after.width : null,
        bubble: getComputedStyle(t, '::before').content !== 'none',
        color: getComputedStyle(t).color,
      };
    }),
  );

test.beforeAll(async ({ browser }) => {
  ({ page, name } = await person(browser, 'tab'));
  ({ page: fan } = await person(browser, 'fan'));
});

test('five tabs, Smokes second (D43), each a fifth of the bar', async () => {
  await page.goto('/');
  // Wait for the bar itself: on a busy machine the app is still starting when the page loads (0.36.0 CI).
  await expect(page.locator('.nav .tab-l')).toHaveText(['Leaderboard', 'Smokes', 'Log', 'People', 'More']);
  expect((await tabs()).map((t) => t.label)).toEqual(['Leaderboard', 'Smokes', 'Log', 'People', 'More']);
  const widths = await page.locator('.nav .tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  for (const w of widths) expect(w).toBeCloseTo(390 / 5, 0);
  // Each name fits its tab.
  const clipped = await page.locator('.nav .tab-l').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth || e.getBoundingClientRect().width > 390 / 5).map((e) => e.textContent));
  expect(clipped).toEqual([]);
});

for (const [path, label] of [['/', 'Leaderboard'], ['/smokes', 'Smokes'], ['/log', 'Log'], ['/people', 'People'], ['/more', 'More']] as const) {
  test(`on ${label}: only its tab is solid, glowing and underlined; the others are outlines`, async () => {
    await page.goto(path);
    await expect(page.locator('.nav .tab[aria-current="page"]')).toHaveText(new RegExp(`^${label}`));
    for (const t of await tabs()) {
      expect(t.bubble, t.label).toBe(false);
      if (t.label === label) {
        expect(t, t.label).toMatchObject({ current: true, icon: 'solid', outlined: false, glow: true, line: '18px', color: 'rgb(88, 224, 140)' });
      } else {
        expect(t, t.label).toMatchObject({ current: false, icon: 'outline', outlined: true, glow: false, line: null, color: 'rgba(238, 244, 240, 0.64)' });
      }
    }
    if (label === 'Leaderboard') await shot(page, '95-tabbar');
  });
}

test('the People badge still shows follow requests', async () => {
  await fan.evaluate(async (u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), name);
  await page.goto('/');
  const badge = page.locator('.nav .tab', { hasText: 'People' }).locator('.badge');
  await expect(badge).toHaveText('1');
  expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(47, 184, 106)');
  await page.goto('/people');
  await expect(badge).toHaveText('1');
});

test('tab names are readable, current and not', async () => {
  for (const path of ['/log', '/smokes']) {
    await page.goto(path);
    await page.locator('.nav .tab[aria-current="page"]').waitFor();
    expect(await contrastFailures(page, await textBoxes(page, '.nav .tab-l'), 1), path).toEqual([]);
  }
});
