import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyLogEntryInput, type LogEntryInput } from '../../shared/domain/logEntry';
import { contrastFailures, settled, shot, signUp, textBoxes } from './helpers';

// A loose Log entry's page (D41, 0.34.0): tapping an entry in the Log opens a page about it,
// like a product page: the Poster's top with an "In your Log" tag and the name, a Details card
// (with the date it was logged) and an Actions card (Add to leaderboard, Edit, Delete entry).
// Edit, top right or in Actions, opens the form at /log/:id/edit; Cancel and Save come back.
// log.spec.ts covers promotion and the Log's tiles; motion.spec.ts the photo flight.
test.describe.configure({ mode: 'serial' });

let page: Page;
const ids: Record<string, string> = {};
const LOGGED = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
/** A photo drawn in the page: an ordinary JPEG, or a cut-out (PNG with a JPEG original). */
const upload = (kind: 'photo' | 'cut') =>
  page.evaluate(async (kind) => {
    const draw = (w: number, h: number, type: string, clear: boolean) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      if (!clear) {
        x.fillStyle = '#3a2f22';
        x.fillRect(0, 0, w, h);
      }
      x.fillStyle = '#6f9a3f';
      x.beginPath();
      x.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, Math.PI * 2);
      x.fill();
      return new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.9));
    };
    const form = new FormData();
    if (kind === 'cut') {
      form.append('original', await draw(800, 600, 'image/jpeg', false), 'original.jpg');
      form.append('cropped', await draw(600, 600, 'image/png', true), 'cropped.png');
      form.append('thumb', await draw(320, 320, 'image/png', true), 'thumb.png');
      form.append('cutout', '1');
    } else {
      const img = await draw(800, 600, 'image/jpeg', false);
      for (const part of ['original', 'cropped', 'thumb']) form.append(part, img, `${part}.jpg`);
    }
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, kind);
const entry = async (name: string, over: Partial<LogEntryInput>) => (ids[name] = (await post('/api/log', { ...emptyLogEntryInput(), name, ...over })).entry.id);

/** The Details card as [label, value] pairs. */
const details = () => page.getByRole('region', { name: 'Details' }).locator('dt, dd').allTextContents().then((t) => t.reduce<string[][]>((rows, v, i) => (i % 2 ? rows[rows.length - 1]!.push(v) : rows.push([v]), rows), []));
const actions = () => page.getByRole('region', { name: 'Actions' });
const open = async (name: string) => {
  await page.goto(`/log/${ids[name]}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `le${Date.now().toString(36).slice(-6)}`);
  await entry('Lemon Haze', { productType: 'flower', country: 'US', amount: 3.5, photos: [{ upload: await upload('photo'), crop: null }] });
  await entry('Plain Jane', { productType: 'edibles', amount: 50 });
  await entry('Cut Out', { productType: 'concentrate', concentrateType: 'live_rosin', country: 'CA', photos: [{ upload: await upload('cut'), crop: null }] });
  await entry('Short Lived', { productType: 'flower' });
});
test.afterAll(() => page.context().close());

test('tapping an entry opens its page: its photo on top, the tag and name, Details with the date, and Actions', async () => {
  await page.goto('/log');
  await page.locator('.lrow', { hasText: 'Lemon Haze' }).click();
  await expect(page).toHaveURL(new RegExp(`/log/${ids['Lemon Haze']}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Lemon Haze' })).toBeVisible();
  await expect(page.locator('.poster')).not.toHaveClass(/\b(plain|cut)\b/);
  await expect(page.locator('.hero-photo img')).toBeVisible();
  await expect(page.locator('.log-tag')).toHaveText('In your Log');
  const rows = await details();
  expect(rows.slice(0, 3)).toEqual([['Type', 'Flower'], ['Country', '🇺🇸 United States'], ['Amount', '3.5g']]);
  expect(rows[3]![0]).toBe('Logged');
  expect(rows[3]![1]).toMatch(LOGGED);
  await expect(actions().locator('.btn')).toHaveText(['Add to leaderboard', 'Edit', 'Delete entry']);
  await expect(actions().locator('.btn svg')).toHaveCount(3);
  await expect(page.getByText(/Rate it/)).toHaveCount(0); // no line under Add to leaderboard
  await expect(page.locator('.hdr').getByRole('link', { name: 'Edit' })).toBeVisible();
  await expect(page.locator('nav').getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');
  // The photo flew in from the row (D20): the name fades in once it has landed (D27).
  await expect(page.locator('html')).not.toHaveClass(/vt-/);
  await expect(page.locator('.poster .hero')).toHaveCSS('opacity', '1');
  await shot(page, '43-log-entry');
});

test('without a photo the type’s mark glows in its place; a cut-out floats; empty rows are left out', async () => {
  await open('Plain Jane');
  await expect(page.locator('.poster')).toHaveClass(/\bplain\b/);
  await expect(page.locator('.hero-photo svg')).toBeVisible();
  const rows = await details();
  expect(rows.map(([k]) => k)).toEqual(['Type', 'Amount', 'Logged']); // no country set
  expect(rows.slice(0, 2)).toEqual([['Type', 'Edibles'], ['Amount', '50mg']]);
  await shot(page, '44-log-entry-plain');

  await open('Cut Out');
  await expect(page.locator('.poster')).toHaveClass(/\bcut\b/);
  await expect(page.locator('.hero-photo.cut img')).toBeVisible();
  expect((await details()).slice(0, 3)).toEqual([['Type', 'Concentrate'], ['Concentrate type', 'Live Rosin'], ['Country', '🇨🇦 Canada']]);
});

test('Edit, top right or in Actions, opens the form; Cancel and Save to log come back to the page', async () => {
  await open('Lemon Haze');
  const form = `/log/${ids['Lemon Haze']}/edit`;
  await expect(page.locator('.hdr').getByRole('link', { name: 'Edit' })).toHaveAttribute('href', form);
  await expect(actions().getByRole('link', { name: 'Edit' })).toHaveAttribute('href', form);

  await page.locator('.hdr').getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(new RegExp(`${form}$`));
  await expect(page.getByLabel('Name')).toHaveValue('Lemon Haze');
  // The form only edits: Add to leaderboard and Delete entry are on the page.
  await expect(page.getByRole('button', { name: 'Add to leaderboard' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete entry' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(new RegExp(`/log/${ids['Lemon Haze']}$`));

  await actions().getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('Lemon Haze Reserve');
  await page.getByLabel('Amount (g)').fill('7');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page).toHaveURL(new RegExp(`/log/${ids['Lemon Haze']}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Lemon Haze Reserve' })).toBeVisible();
  expect((await details())[2]).toEqual(['Amount', '7g']);
  ids['Lemon Haze Reserve'] = ids['Lemon Haze']!;
});

test('tapping the photo opens it full screen', async () => {
  await open('Lemon Haze Reserve');
  await page.locator('.hero-photo').click();
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'Close' }).click();
  await expect(viewer).toHaveCount(0);
});

test('Delete entry asks first, then the entry is gone from the Log', async () => {
  await page.goto('/log');
  await page.locator('.lrow', { hasText: 'Short Lived' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Short Lived' })).toBeVisible();
  await actions().getByRole('button', { name: 'Delete entry' }).click();
  const sheet = page.getByRole('dialog', { name: 'Delete “Short Lived”?' });
  await expect(sheet).toContainText('This removes the entry for good.');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Short Lived' })).toBeVisible();
  await actions().getByRole('button', { name: 'Delete entry' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('.lrow', { hasText: 'Lemon Haze Reserve' })).toBeVisible();
  await expect(page.locator('.lrow', { hasText: 'Short Lived' })).toHaveCount(0);
  // Reached again (an old link, or Back through history), it goes to the Log.
  await page.goto(`/log/${ids['Short Lived']}`);
  await expect(page).toHaveURL(/\/log$/);
});

test('offline, Add to leaderboard and Delete entry wait for the connection; Edit still opens', async () => {
  await open('Plain Jane');
  await page.context().setOffline(true);
  await expect(actions().getByRole('button', { name: 'Add to leaderboard' })).toBeDisabled();
  await expect(actions().getByRole('button', { name: 'Delete entry' })).toBeDisabled();
  await expect(actions().getByRole('link', { name: 'Edit' })).toBeVisible();
  await page.context().setOffline(false);
  await expect(actions().getByRole('button', { name: 'Add to leaderboard' })).toBeEnabled();
});

test('readable and accessible, with and without a photo', async () => {
  for (const name of ['Lemon Haze Reserve', 'Plain Jane', 'Cut Out']) {
    await open(name);
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`), name).toEqual([]);
    // The tag and the name sit on the photo: measured from pixels (axe can't judge text over a photo).
    const worst = await contrastFailures(page, await textBoxes(page, '.log-tag, .hero h1'), 1);
    expect(worst, `${name}:\n${worst.join('\n')}`).toEqual([]);
  }
});
