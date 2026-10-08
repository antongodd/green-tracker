import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// The Data screens (D40, 0.33.0): Export, Restore and Delete account open with a glowing icon
// tile, a heading and one sentence; Export ticks off what's in the file, Restore shows the chosen
// file as tiles, Delete crosses off what goes and offers Export first. Export and Restore show a
// progress bar while they work (photos are held back here so it can be seen). What each screen
// does is unchanged: data.spec.ts runs the whole export → restore → delete.
test.describe.configure({ mode: 'serial' });

let page: Page;
let username = '';
let firstPhoto = '';
let exportPath = '';

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const upload = () =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3b8a4a';
    ctx.fillRect(0, 0, 300, 200);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });

/** Holds back every request matching `url` (and `method`), except those `pass` lets through, until released. */
async function hold(url: string, method: string, pass: (u: string) => boolean = () => false) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const handler = async (route: Route) => {
    if (route.request().method() !== method || pass(route.request().url())) return route.fallback();
    await gate;
    return route.fallback();
  };
  await page.route(url, handler);
  return async () => {
    release();
    await page.unroute(url, handler);
  };
}

const bar = () => page.getByRole('progressbar');
const barWidth = () => bar().locator('i').evaluate((i) => Math.round((i.getBoundingClientRect().width / i.parentElement!.getBoundingClientRect().width) * 100));

// One account: Keeper (a photo), Old Favourite (archived) and a Log entry with a photo.
test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  username = await signUp(page, `ds${Date.now().toString(36).slice(-6)}`);
  const keeper = await post('/api/products', { ...emptyProductInput(), name: 'Keeper', ratings: { look: 8 }, photos: [{ upload: await upload(), crop: null }] });
  firstPhoto = keeper.product.photos[0].id;
  const old = await post('/api/products', { ...emptyProductInput(), name: 'Old Favourite', ratings: { look: 6 } });
  await post(`/api/products/${old.product.id}/archived`, { value: true });
  await post('/api/log', { ...emptyLogEntryInput(), name: 'Quick One', amount: 1, photos: [{ upload: await upload(), crop: null }] });
});
test.afterAll(() => page.context().close());

test('Export: a glowing icon, what’s in the file, and a progress bar while photos are added', async () => {
  await page.goto('/more/export');
  await expect(page.getByRole('heading', { level: 1, name: 'Your data, in one file' })).toBeVisible();
  await expect(page.locator('.data-mark.teal svg')).toBeVisible();
  const card = page.getByRole('region', { name: 'In the file' });
  await expect(card.locator('li.yes')).toHaveText([/^Every product/, 'Your whole Log', /^Every smoke/, /^Every photo/]);
  await expect(card.locator('li.not')).toContainText('Not included: who you follow');
  await expect(page.locator('.data-note')).toContainText('Save to Files');

  // The product's photo comes through; the Log entry's waits, so the bar stops halfway.
  const release = await hold('**/api/photos/**', 'GET', (u) => u.includes(firstPhoto));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  await expect(bar()).toHaveAccessibleName('Adding photos: 1 of 2');
  await expect(bar()).toHaveAttribute('aria-valuenow', '1');
  await expect(bar()).toHaveAttribute('aria-valuemax', '2');
  await expect.poll(barWidth).toBe(50);
  await expect(page.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
  await expect(page.locator('.data-note')).toHaveCount(0); // the Save to Files hint makes way
  await shot(page, '63-export-progress');
  await release();
  // Kept under its real name (the browser's own copy has a random one), to choose on Restore.
  const file = await download;
  exportPath = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(exportPath);
  await expect(bar()).toHaveCount(0);
  await expect(page.locator('.data-note.ok')).toHaveText(new RegExp(`^Exported green-tracker-${username}-\\d{4}-\\d{2}-\\d{2}\\.json \\(\\d+ KB\\)\\.$`));
  await expect(page.getByRole('button', { name: 'Export my data' })).toBeEnabled();
});

test('Restore: the file as tiles, a different file, and a progress bar while photos upload', async () => {
  await page.goto('/more/restore');
  await expect(page.getByRole('heading', { level: 1, name: 'Restore from a file' })).toBeVisible();
  await expect(page.locator('.data-mark.teal svg')).toBeVisible();
  await expect(page.getByRole('region', { name: 'File contents' })).toHaveCount(0);
  await page.getByLabel('Choose an export file').setInputFiles(exportPath);

  const contents = page.getByRole('region', { name: 'File contents' });
  // The whole name, wrapped if it must: it matters which file you chose.
  await expect(contents.locator('.file-head b')).toHaveCSS('text-overflow', 'clip');
  await expect(contents.locator('.file-head b')).toHaveText(new RegExp(`^green-tracker-${username}-\\d{4}-\\d{2}-\\d{2}\\.json$`));
  await expect(contents.locator('.file-head .who span')).toContainText(`by @${username}`);
  expect(await contents.locator('.data-tile').evaluateAll((ts) => ts.map((t) => [t.querySelector('b')!.textContent, t.querySelector('span')!.textContent]))).toEqual([['1', 'Products'], ['1', 'Log'], ['2', 'Photos']]);
  await expect(contents.locator('.hint')).toHaveText('+ 1 archived product. No smokes. No profile photo: yours will be removed.');
  // The same picker, now reading "Choose a different file", under the Replace button.
  await expect(page.getByLabel('Choose an export file')).toHaveCount(0);
  await expect(page.getByLabel('Choose a different file')).toHaveCount(1);
  const replace = page.getByRole('button', { name: 'Replace my data with this file' });
  expect(await replace.evaluate((b, other) => !!(b.compareDocumentPosition(document.querySelector(other)!) & Node.DOCUMENT_POSITION_FOLLOWING), 'label.btn')).toBe(true);
  await shot(page, '64-restore-file');

  // Uploads wait: the bar shows 0 of 2 in place of the button, then the Leaderboard opens.
  const release = await hold('**/api/uploads', 'POST');
  await replace.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my data' }).click();
  await expect(bar()).toHaveAccessibleName('Uploading photos: 0 of 2');
  await expect(bar()).toHaveAttribute('aria-valuenow', '0');
  await expect(replace).toHaveCount(0);
  await expect(page.locator('label.btn')).toHaveCSS('opacity', '0.4'); // no other file while it runs
  await shot(page, '65-restore-progress');
  await release();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.locator('.row', { hasText: 'Keeper' })).toBeVisible();
});

test('Delete account: red throughout, what goes, Export first, and the username arms the button', async () => {
  await page.goto('/more/delete');
  await expect(page.getByRole('heading', { level: 1, name: `Delete @${username}` })).toBeVisible();
  await expect(page.locator('.data-mark.red svg')).toBeVisible();
  await expect(page.locator('.data-hero p')).toContainText('It can’t be undone.');
  await expect(page.getByRole('region', { name: 'What goes' }).locator('li.gone')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'What goes' }).locator('li.gone').nth(2)).toHaveText('Every smoke');

  const input = page.getByLabel('Type your username to confirm');
  const button = page.getByRole('button', { name: 'Delete my account' });
  await expect(button).toBeDisabled();
  await expect(button.locator('svg')).toBeVisible(); // Face ID
  await input.fill('wrong');
  await expect(input).not.toHaveClass(/armed/);
  await input.fill(username.toUpperCase());
  await expect(input).toHaveClass(/armed/);
  await expect(button).toBeEnabled();
  await shot(page, '66-delete');

  await page.getByRole('link', { name: /Keep a copy\? Export first\./ }).click();
  await expect(page).toHaveURL(/\/more\/export$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your data, in one file' })).toBeVisible();
});

// Text on the glow and the tinted cards, measured from pixels (axe can't judge text over a
// gradient), in two halves: contrastFailures photographs the top 390×844, so the lower half is
// scrolled into view on a fresh load. Buttons are flat colours, which axe judges (their icons
// would read as "background" to the pixel check).
const DATA_TEXT = '.data-hero h1, .data-hero p, .data-card > .cap, .checks span, .data-note, .data-link .main, .data-link .go, .file-head b, .file-head .who span, .data-tile b, .data-tile span, .data-card > .hint';
async function readable(open: () => Promise<void>) {
  const worst: string[] = [];
  for (const half of ['top', 'bottom'] as const) {
    await open();
    await settled(page);
    if (half === 'bottom') await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const boxes = (await textBoxes(page, DATA_TEXT)).filter((b) => b.y >= 50 && b.y + b.h <= 844 - 60);
    expect(boxes.length).toBeGreaterThan(0);
    worst.push(...(await contrastFailures(page, boxes, 1)).map((w) => `${half}: ${w}`));
  }
  return worst;
}

test('all three screens are readable and pass axe', async () => {
  const screens: [string, () => Promise<void>][] = [
    // Each waits for its screen: settled() only waits for a fade that has begun, so measured
    // while the session still loaded it saw nothing yet, then a half-faded button (4 workers).
    ['Export', async () => {
      await page.goto('/more/export');
      await expect(page.getByRole('heading', { level: 1, name: 'Your data, in one file' })).toBeVisible();
    }],
    ['Restore', async () => {
      await page.goto('/more/restore');
      await page.getByLabel('Choose an export file').setInputFiles(exportPath);
      await expect(page.locator('.data-tile')).toHaveCount(3);
    }],
    ['Delete account', async () => {
      await page.goto('/more/delete');
      await page.getByLabel('Type your username to confirm').fill(username);
    }],
  ];
  for (const [name, open] of screens) {
    await open();
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`), name).toEqual([]);
    const worst = await readable(open);
    expect(worst, `${name}:\n${worst.join('\n')}`).toEqual([]);
  }
});
