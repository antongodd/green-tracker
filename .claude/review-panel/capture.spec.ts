import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Browser, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { addAuthenticator, settled } from '../../test/e2e/helpers';

// The review panel's screenshots of the app (see README.md here). Not a test: it walks a made-up
// person through every screen and saves, for each, a photo of the first screenful, the whole
// screen when it scrolls, and its words (for the proof-reader).
const OUT = join(process.cwd(), '.playwright/review/app');
mkdirSync(OUT, { recursive: true });
const shots: string[] = [];

async function snap(page: Page, name: string, note = '') {
  try {
    await page.waitForLoadState('networkidle');
    await settled(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `${name}.png`), animations: 'disabled' });
    const tall = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 4);
    if (tall) await page.screenshot({ path: join(OUT, `${name}-full.png`), fullPage: true, animations: 'disabled' });
    const words = await page.evaluate(() => document.body.innerText);
    writeFileSync(join(OUT, `${name}.txt`), `${page.url()}\n${note}\n\n${words}\n`);
    shots.push(`${name}${tall ? ' (+ -full)' : ''}: ${note || new URL(page.url()).pathname}`);
  } catch (e) {
    shots.push(`${name}: FAILED ${(e as Error).message.split('\n')[0]}`);
  }
}

/** Runs one step; a screen that fails is noted and the walk carries on. */
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    shots.push(`${name}: FAILED ${(e as Error).message.split('\n')[0]}`);
  }
}

const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => (await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).json(),
    { method, path, body },
  );

/** A made-up photo of a bud on a tray, drawn in the page and uploaded as a pending set. */
const budPhoto = (page: Page, hue: number, seed: number): Promise<string> =>
  page.evaluate(async ({ hue, seed }) => {
    let s = seed;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 1200;
    const x = c.getContext('2d')!;
    const bg = x.createLinearGradient(0, 0, 1200, 1200);
    bg.addColorStop(0, '#2b2622');
    bg.addColorStop(1, '#14110f');
    x.fillStyle = bg;
    x.fillRect(0, 0, 1200, 1200);
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = r() * 300;
      x.fillStyle = `hsl(${hue + r() * 30 - 15} ${35 + r() * 25}% ${22 + r() * 25}%)`;
      x.beginPath();
      x.ellipse(600 + Math.cos(a) * d * 0.8, 620 + Math.sin(a) * d, 60 + r() * 70, 50 + r() * 60, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 260; i++) {
      x.fillStyle = r() > 0.4 ? `hsl(${25 + r() * 15} 80% ${45 + r() * 15}%)` : 'rgba(245,245,235,0.85)';
      const a = r() * Math.PI * 2, d = r() * 330;
      x.fillRect(600 + Math.cos(a) * d * 0.8, 620 + Math.sin(a) * d, 3 + r() * 5, 3 + r() * 5);
    }
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, { hue, seed });

const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
const buy = (date: string, amount: number, totalPaid: number, supplier: string | null) => ({ date, amount, totalPaid, supplier });

// A UK daily smoker's stash: mostly flower, a few others, one unrated.
const STASH: Array<ProductInput & { hue?: number }> = [
  { ...P({ name: 'Wedding Cake', strainType: 'indica', country: 'US', source: 'Jungle Boys', dateTried: '2026-10-02', hitTimeMinutes: 15, notes: 'Dense, sticky, sweet vanilla smell. Best of the month.', ratings: { look: 9.2, smell: 9.4, taste: 9, burn: 8.8, high: 9.3 }, purchases: [buy('2026-10-01', 3.5, 45, 'Greenleaf Club'), buy('2026-10-15', 7, 80, 'Greenleaf Club')] }), hue: 100 },
  { ...P({ name: 'Gelato 41', strainType: 'hybrid', country: 'US', source: 'Cookies', dateTried: '2026-09-14', ratings: { look: 9, smell: 8.8, taste: 8.9, burn: 8.5, high: 8.7 }, purchases: [buy('2026-09-14', 3.5, 40, 'Greenleaf Club')] }), hue: 280 },
  { ...P({ name: 'Lemon Cherry Gelato', strainType: 'hybrid', country: 'CA', source: 'Backpack Boyz', ratings: { look: 8.6, smell: 9, taste: 8.4, burn: 8, high: 8.2 }, purchases: [buy('2026-09-01', 7, 70, 'Mo’s')] }), hue: 85 },
  { ...P({ name: 'Zkittlez', strainType: 'indica', country: 'US', source: '3rd Gen Family', ratings: { look: 8, smell: 8.6, taste: 8.8, burn: 7.6, high: 7.9 }, purchases: [buy('2026-08-20', 3.5, 30, 'Mo’s')] }), hue: 120 },
  { ...P({ name: 'Amnesia Haze', strainType: 'sativa', country: 'NL', source: 'Mediterrane', ratings: { look: 7.2, smell: 7.8, taste: 7.4, burn: 8.2, high: 8 }, purchases: [buy('2026-08-02', 10, 60, 'Local')] }), hue: 70 },
  { ...P({ name: 'Blue Dream', strainType: 'sativa', country: 'ES', ratings: { look: 7, smell: 6.8, taste: 7.1, burn: 6.5, high: 7.2 }, purchases: [buy('2026-07-12', 7, 40, 'Local')] }), hue: 200 },
  { ...P({ name: 'Moroccan Hash', productType: 'concentrate', country: 'MA', ratings: { look: 7.6, consistency: 7.8, smell: 7.2, taste: 7.5, burn: 7.4 }, purchases: [buy('2026-07-01', 5, 35, 'Local')] }), hue: 30 },
  { ...P({ name: 'Peach Rings Gummies', productType: 'edibles', strainType: 'sativa', country: 'US', source: 'Wana', ratings: { taste: 8, high: 8.5 }, purchases: [buy('2026-09-06', 100, 25, 'Greenleaf Club')] }), hue: 20 },
  { ...P({ name: 'Purple Punch', strainType: 'indica', country: 'GB', ratings: { look: 6.2, smell: 6, taste: 5.8, burn: 6.4, high: 6 }, purchases: [buy('2026-06-10', 3.5, 25, 'Local')] }), hue: 290 },
  { ...P({ name: 'Mystery Bag', dateTried: '2026-10-20' }) },
];

async function person(browser: Browser, username: string) {
  const page = await (await browser.newContext()).newPage();
  await addAuthenticator(page);
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByText('Available').waitFor();
  return page;
}
const finishSignUp = async (page: Page, snaps = false) => {
  await page.getByRole('button', { name: 'Continue' }).click();
  if (snaps) await snap(page, '03-signup-passkey', 'Sign-up step 2');
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.getByLabel('I’ve saved these codes somewhere safe').waitFor();
  if (snaps) await snap(page, '04-signup-recovery-codes', 'Sign-up step 3');
  await page.getByLabel('I’ve saved these codes somewhere safe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('navigation', { name: 'Main' }).waitFor();
};

test('walk every screen', async ({ browser }) => {
  test.slow();
  const tag = Date.now().toString(36).slice(-4);
  const me = `sam${tag}`, friend = `jess${tag}`;

  // Signed out.
  const welcome = await (await browser.newContext()).newPage();
  await welcome.goto('/');
  await snap(welcome, '01-welcome', 'First screen for someone new (signed out)');
  await welcome.goto('/recover');
  await snap(welcome, '01b-recover', 'Lost your passkey: sign in with a recovery code');

  const page = await person(browser, me);
  await snap(page, '02-signup-username', 'Sign-up step 1');
  await finishSignUp(page, true);
  await snap(page, '05-empty-leaderboard', 'A brand-new account: the Leaderboard before any products');
  await page.goto('/log');
  await snap(page, '05b-empty-log', 'A brand-new account: Log');
  await page.goto('/sources');
  await snap(page, '05c-empty-sources', 'A brand-new account: Sources');
  await page.goto('/people');
  await snap(page, '05d-empty-people', 'A brand-new account: People');

  // Adding a product, as a person would.
  await step('06-add-product', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: /Add/ }).first().click().catch(() => page.goto('/products/new'));
    await snap(page, '06-add-product-empty', 'The add-a-product screen, empty');
    await page.getByLabel('Name', { exact: false }).first().fill('Wed');
    await page.waitForTimeout(500);
    await snap(page, '06b-add-product-typing', 'Typing a name');
  });

  // The stash.
  const ids: Record<string, string> = {};
  for (const [i, { hue, ...body }] of STASH.entries()) {
    const photos = hue === undefined ? [] : [{ upload: await budPhoto(page, hue, i + 1), crop: null }, ...(i === 0 ? [{ upload: await budPhoto(page, hue + 10, 77), crop: null }] : [])];
    const res = await call(page, 'POST', '/api/products', { ...body, photos });
    if (!res.product) throw new Error(`${body.name}: ${JSON.stringify(res)}`);
    ids[body.name] = res.product.id;
  }
  await call(page, 'POST', '/api/log', { ...emptyLogEntryInput(), name: 'Runtz', country: 'US', amount: 3.5, photos: [{ upload: await budPhoto(page, 310, 9), crop: null }] });
  await call(page, 'POST', '/api/log', { ...emptyLogEntryInput(), name: 'Friend’s homegrow', amount: 1 });

  await page.goto('/');
  await snap(page, '10-leaderboard', 'Leaderboard with a real-looking stash (Aurora look)');
  // Rank by and Type are the phone's own pickers (not drawn by the app), so the result is shown instead.
  await step('11-rank-by', async () => {
    await page.getByLabel('Rank by', { exact: true }).selectOption('vfm');
    await snap(page, '11-rank-by-vfm', 'Ranked by Value for money (Rank by uses the iPhone’s own picker)');
    await page.getByLabel('Rank by', { exact: true }).selectOption('overall');
    await page.getByLabel('Type', { exact: true }).selectOption('flower');
    await snap(page, '11b-type-flower', 'Only flower (Type uses the iPhone’s own picker)');
    await page.getByLabel('Type', { exact: true }).selectOption('all');
  });

  await page.goto(`/products/${ids['Wedding Cake']}`);
  await snap(page, '12-product', 'Product page: the top product');
  await page.goto(`/products/${ids['Peach Rings Gummies']}`);
  await snap(page, '12b-product-edible', 'Product page: an edible');
  await page.goto(`/products/${ids['Mystery Bag']}`);
  await snap(page, '12c-product-unrated', 'Product page: not rated yet');
  await page.goto(`/products/${ids['Wedding Cake']}/edit`);
  await snap(page, '13-edit-product', 'Editing a product');

  await page.goto('/log');
  await snap(page, '14-log', 'Log: quick entries not yet rated');
  await page.goto('/log/new');
  await snap(page, '14b-log-new', 'Adding a quick Log entry');
  await step('14c-log-entry', async () => {
    await page.goto('/log');
    await page.locator('a[href^="/log/"]').first().click();
    await snap(page, '14c-log-entry', 'One Log entry');
  });

  await page.goto('/sources');
  await snap(page, '15-sources', 'Sources tab (brands and suppliers)');
  await page.goto(`/brands/${encodeURIComponent('Jungle Boys')}`);
  await snap(page, '15b-brand', 'A brand page');

  // A friend who follows each other.
  const other = await person(browser, friend);
  await finishSignUp(other);
  for (const [i, body] of [P({ name: 'Runtz', strainType: 'hybrid', country: 'US', ratings: { look: 9.4, smell: 9.1, taste: 9.2, burn: 8.9, high: 9 }, purchases: [buy('2026-10-10', 3.5, 50, 'Greenleaf Club')] }), P({ name: 'Wedding Cake', strainType: 'indica', country: 'US', ratings: { look: 8, smell: 8.2, taste: 8, burn: 7.8, high: 8.4 } }), P({ name: 'Cheese', strainType: 'hybrid', country: 'GB', ratings: { look: 6.5, smell: 8, taste: 7, burn: 6, high: 6.8 } })].entries())
    await call(other, 'POST', '/api/products', { ...body, photos: [{ upload: await budPhoto(other, [140, 100, 60][i]!, 40 + i), crop: null }] });
  await step('16-people', async () => {
    await other.goto('/people');
    await other.getByPlaceholder('Search usernames').fill(me.slice(0, 5));
    await snap(other, '16-people-search', 'People: searching for a friend');
    await other.locator('.prow', { hasText: `@${me}` }).getByRole('button', { name: 'Follow' }).click();
    await page.goto('/people');
    await page.getByRole('tab', { name: /Requests/ }).click();
    await snap(page, '16b-people-requests', 'People: a follow request waiting');
    await page.locator('.prow', { hasText: `@${friend}` }).getByRole('button', { name: 'Approve' }).click();
    await page.goto('/people');
    await page.getByPlaceholder('Search usernames').fill(friend.slice(0, 5));
    await page.locator('.prow', { hasText: `@${friend}` }).getByRole('button', { name: 'Follow' }).click();
    await other.goto('/people');
    await other.getByRole('tab', { name: /Requests/ }).click();
    await other.locator('.prow', { hasText: `@${me}` }).getByRole('button', { name: 'Approve' }).click();
    await page.goto('/people');
    await snap(page, '16c-people-following', 'People: following a friend');
    await page.goto(`/u/${friend}`);
    await snap(page, '17-friend', 'A friend’s Leaderboard');
    await page.locator('a[href*="/p/"]').first().click();
    await snap(page, '17b-friend-product', 'A friend’s product');
  });

  await page.goto('/more');
  await snap(page, '20-settings', 'Settings tab');
  for (const [n, path, note] of [
    ['21-appearance', '/more/appearance', 'Settings → Appearance'],
    ['22-sounds', '/more/sounds', 'Settings → Sounds'],
    ['23-currency', '/more/currency', 'Settings → Money'],
    ['24-privacy', '/more/privacy', 'Settings → Privacy'],
    ['24b-privacy-preview', '/more/privacy/preview', 'Privacy: what followers see'],
    ['25-passkeys', '/more/passkeys', 'Settings → Passkeys'],
    ['26-recovery-codes', '/more/recovery-codes', 'Settings → Recovery codes'],
    ['27-export', '/more/export', 'Settings → Export'],
    ['28-restore', '/more/restore', 'Settings → Restore'],
    ['29-archive', '/more/archive', 'Settings → Archive'],
    ['30-blocked', '/more/blocked', 'Settings → Blocked people'],
    ['31-delete', '/more/delete', 'Settings → Delete account'],
  ] as const) {
    await page.goto(path);
    await snap(page, n, note);
  }

  // The other looks and stats layouts.
  for (const look of ['neon', 'pearl', 'forest'] as const) {
    await call(page, 'PUT', '/api/appearance', { look, top: 'hero', preset: look === 'neon' ? 'neon' : 'gems', markFirst: true });
    await page.goto('/');
    await snap(page, `40-look-${look}`, `Leaderboard in the ${look} look`);
    await page.goto(`/products/${ids['Wedding Cake']}`);
    await snap(page, `40-look-${look}-product`, `Product page in the ${look} look`);
  }
  for (const top of ['tiles', 'strip'] as const) {
    await call(page, 'PUT', '/api/appearance', { look: 'aurora', top, preset: 'aurora', markFirst: true });
    await page.goto('/');
    await snap(page, `41-top-${top}`, `Leaderboard with the stats as ${top}`);
  }
  await call(page, 'PUT', '/api/appearance', { look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });

  writeFileSync(join(OUT, 'INDEX.txt'), `${shots.join('\n')}\n`);
});
