import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// D47 (0.40.0): the dev site shows an orange DEV label after the title on every screen, so it's
// never mistaken for the live app. The server says which site it is (`site` in /api/auth/me);
// here the reply is changed to "dev", as the dev site's server sends it.
test.describe.configure({ mode: 'serial' });
let page: Page;
let id = '';

const asDev = (p: Page) =>
  p.route('**/api/auth/me', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), site: 'dev' } });
  });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `dv${Date.now().toString(36).slice(-6)}`);
  id = (
    await page.evaluate<{ product: { id: string } }, ReturnType<typeof emptyProductInput> & { name: string; ratings: { look: number } }>(
      async (b) => (await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json(),
      { ...emptyProductInput(), name: 'A Rather Long Product Name For The Header', ratings: { look: 7 } },
    )
  ).product.id;
});

test('the live site has no DEV label', async () => {
  await page.goto('/');
  await expect(page.locator('.row').first()).toBeVisible();
  await expect(page.locator('.dev-badge')).toHaveCount(0);
});

test('the dev site: DEV after the title on every screen, readable, and the title still fits', async () => {
  await asDev(page);
  for (const path of ['/', '/log', '/people', '/more', `/products/${id}`]) {
    await page.goto(path);
    const badge = page.locator('.hdr .dev-badge');
    await expect(badge, path).toHaveText('DEV');
    // Inside the header bar, clear of the side slots.
    const [bar, b] = [(await page.locator('.hdr .bar').boundingBox())!, (await badge.boundingBox())!];
    expect(b.x + b.width, path).toBeLessThanOrEqual(bar.x + bar.width - 88);
  }
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  expect(await contrastFailures(page, await textBoxes(page, '.hdr .dev-badge'), 1)).toEqual([]);
  await page.goto('/');
  await expect(page.locator('.row').first()).toBeVisible();
  await shot(page, '170-dev-badge');
});

test('signed out too: the sign-in screen says DEV', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await asDev(p);
  await p.goto('/');
  await expect(p.locator('.dev-badge')).toHaveText('DEV');
});
