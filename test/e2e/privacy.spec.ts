import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// Privacy (D45, 0.38.0; layout B "Preview on top"). More → Privacy → What followers see:
// a live preview of what followers get, switches that save at once (dependent ones
// greyed out with a reason), and the follower's own view following them.
test.describe.configure({ mode: 'serial' });

let owner: Page, fan: Page;
let ownerName = '';
let kushId = '';

const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const toSwitch = (name: string) => owner.getByRole('switch', { name, exact: true });
const preview = () => owner.getByRole('region', { name: 'What followers see' });
const axe = async (page: Page) => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
/** Flips a switch and waits for the save and the fresh preview. */
async function flip(name: string, on: boolean) {
  const sw = toSwitch(name);
  const saved = owner.waitForResponse((r) => r.url().endsWith('/api/privacy') && r.request().method() === 'PUT');
  const previewed = owner.waitForResponse((r) => r.url().endsWith('/api/privacy/preview'));
  await (on ? sw.check() : sw.uncheck());
  await saved;
  await previewed;
  await expect(sw).toBeChecked({ checked: on });
}

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  return { page, name: await signUp(page, `${prefix}${Date.now().toString(36).slice(-6)}`) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: owner, name: ownerName } = await person(browser, 'own'));
  const { page: f, name: fanName } = await person(browser, 'fan');
  fan = f;
  kushId = (await post(owner, '/api/products', { ...emptyProductInput(), name: 'Shared Kush', country: 'MA', source: 'Kind Shop', ratings: { look: 8, smell: 8, taste: 8, burn: 8 } })).product.id;
  await post(owner, '/api/products', { ...emptyProductInput(), name: 'Second Bud', ratings: { look: 6 } });
  for (const [date, time] of [['2026-10-01', '20:00'], ['2026-10-03', '21:30'], ['2026-10-04', '22:10']]) {
    await post(owner, '/api/smokes', { productId: kushId, logEntryId: null, date, time, amount: 0.4, effect: 'Secret effect' });
  }
  await fan.evaluate((u) => fetch(`/api/people/u/${u}/follow`, { method: 'POST' }), ownerName);
  await owner.evaluate((u) => fetch(`/api/people/requests/${u}/approve`, { method: 'POST' }), fanName);
});

test('More has a Privacy group; the screen starts as before, with the preview on top', async () => {
  await owner.goto('/more');
  const row = owner.getByRole('link', { name: /What followers see/ });
  await expect(row).toContainText('Followers see: Leaderboard, Source, Country, Photos');
  await row.click();
  await expect(owner).toHaveURL(/\/more\/privacy$/);
  await expect(preview()).toContainText('Shared Kush');
  await expect(preview()).toContainText('Kind Shop');
  for (const [name, on] of [['Share my Leaderboard', true], ['Source', true], ['Country', true], ['Product photos', true], ['How many times I’ve had each', false], ['Most used on my Leaderboard', false], ['My Smokes: what and when', false], ['My profile photo', true]] as const) {
    await expect(toSwitch(name), name).toBeChecked({ checked: on });
  }
  // Most used needs the counts: greyed out, and it says why in words.
  await expect(toSwitch('Most used on my Leaderboard')).toBeDisabled();
  await expect(owner.locator('.priv-row', { hasText: 'Most used on my Leaderboard' })).toContainText('Needs “How many times I’ve had each” on.');
  await expect(owner.locator('.priv-row', { hasText: 'My Smokes' })).toContainText('Not recommended.');
  // The preview sits above the switches.
  const [pv, first] = [(await preview().boundingBox())!, (await toSwitch('Share my Leaderboard').boundingBox())!];
  expect(pv.y).toBeLessThan(first.y);
  expect(await axe(owner)).toEqual([]);
  await shot(owner, '150-privacy');
});

test('Source off: gone from the preview at once, and from the follower’s board and page', async () => {
  await flip('Source', false);
  await expect(preview()).not.toContainText('Kind Shop');
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row', { hasText: 'Shared Kush' })).toBeVisible();
  await expect(fan.locator('.row', { hasText: 'Shared Kush' })).not.toContainText('Kind Shop');
  await fan.goto(`/u/${ownerName}/p/${kushId}`);
  await expect(fan.getByRole('heading', { level: 1, name: 'Shared Kush' })).toBeVisible();
  await expect(fan.locator('main')).not.toContainText('Kind Shop');
  await flip('Source', true);
});

test('counts, Most used and smokes: the follower sees each only once it’s on; never the effect', async () => {
  await flip('How many times I’ve had each', true);
  await expect(preview()).toContainText('Smoked 3 times');
  await expect(toSwitch('Most used on my Leaderboard')).toBeEnabled();
  await flip('Most used on my Leaderboard', true);
  await expect(preview()).toContainText('They can rank your board by Most used.');

  await fan.goto(`/u/${ownerName}/p/${kushId}`);
  const card = fan.getByRole('region', { name: 'Smokes' });
  await expect(card.locator('.smk-count')).toHaveText(/3\s*times smoked/);
  await expect(card.locator('.smk-row')).toHaveCount(0);
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row').first()).toBeVisible();
  await fan.getByLabel('Rank by', { exact: true }).selectOption('used');
  await expect(fan.locator('.row')).toHaveCount(1); // Second Bud has never been smoked
  await expect(fan.locator('.row .score b')).toHaveText('3');
  await expect(fan.locator('.row .score svg.flame')).toBeVisible();

  await flip('My Smokes: what and when', true);
  await expect(preview()).toContainText('with each day, time and amount');
  await fan.goto(`/u/${ownerName}/p/${kushId}`);
  await expect(card.locator('.smk-row')).toHaveCount(3);
  await expect(card.locator('.smk-row').first()).toContainText('0.4 g');
  await expect(card.locator('.smk-row').first()).toContainText('22:10');
  await expect(fan.locator('main')).not.toContainText('Secret effect');
  expect(await axe(fan)).toEqual([]);
  await shot(fan, '151-follower-smokes');

  // Counts off: Most used goes with them, on the board and the switch.
  await flip('How many times I’ve had each', false);
  await expect(toSwitch('Most used on my Leaderboard')).toBeDisabled();
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.row').first()).toBeVisible();
  expect(await fan.getByLabel('Rank by', { exact: true }).locator('option').allTextContents()).not.toContain('Most used');
  await flip('My Smokes: what and when', false);
});

test('Share my Leaderboard off: followers see nothing shared; the other switches grey out', async () => {
  await flip('Share my Leaderboard', false);
  await expect(preview()).toContainText('Only your name. No Leaderboard, no products.');
  for (const name of ['Source', 'Country', 'Product photos', 'How many times I’ve had each', 'My Smokes: what and when']) await expect(toSwitch(name), name).toBeDisabled();
  await expect(toSwitch('My profile photo')).toBeEnabled();
  await owner.goto('/more');
  await expect(owner.getByRole('link', { name: /What followers see/ })).toContainText('Followers see only your name');
  await fan.goto(`/u/${ownerName}`);
  await expect(fan.locator('.empty')).toContainText('hasn’t shared any products');
  await expect(fan.locator('.row')).toHaveCount(0);
  await owner.goto('/more/privacy');
  await expect(preview()).toBeVisible();
  await flip('Share my Leaderboard', true);
});

test('Open their view: your own board and pages as followers get them', async () => {
  await flip('Country', false);
  await preview().getByRole('link', { name: /Open their view/ }).click();
  await expect(owner).toHaveURL(/\/more\/privacy\/preview$/);
  await expect(owner.locator('.pv-note')).toContainText('This is what your followers see now.');
  await expect(owner.locator('.row')).toHaveCount(2);
  await owner.locator('.row', { hasText: 'Shared Kush' }).click();
  await expect(owner).toHaveURL(new RegExp(`/more/privacy/preview/p/${kushId}$`));
  await expect(owner.getByRole('heading', { level: 1, name: 'Shared Kush' })).toBeVisible();
  await expect(owner.locator('main')).not.toContainText('Morocco');
  await expect(owner.locator('.nav .tab[aria-current="page"]')).toHaveText('More');
  expect(await axe(owner)).toEqual([]);
  await owner.goto('/more/privacy');
  await flip('Country', true);
});

test('the preview and switch notes are readable', async () => {
  await owner.goto('/more/privacy');
  await expect(preview()).toContainText('Shared Kush');
  await settled(owner);
  expect(await contrastFailures(owner, await textBoxes(owner, '.pv-cap > span, .pv-line, .pv-mid span, .priv-row .sub'), 1)).toEqual([]);
});
