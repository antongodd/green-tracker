import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { settled, signUp, wholeScreenContrastFailures } from './helpers';

// D56 (0.47.0): sounds and ticks. Sounds can't be heard here, so the app announces each one it
// plays (a `gt-sound` event, "moment:set"); the page collects them in window.sounds. Ticks need
// iOS 18's switch control, which Chromium lacks: the ticks tests pretend to have it.

const name = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

async function open(browser: Browser, opts: { ticks?: boolean } = {}): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript((ticks) => {
    const w = window as unknown as { sounds: string[] };
    w.sounds = [];
    // Safari's sound mode (navigator.audioSession), which Chromium lacks.
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
    addEventListener('gt-sound', (e) => w.sounds.push(`${(e as CustomEvent).detail.moment}:${(e as CustomEvent).detail.set}`));
    if (ticks) {
      Object.defineProperty(HTMLInputElement.prototype, 'switch', {
        configurable: true,
        get() {
          return this.hasAttribute('switch');
        },
        set(v: boolean) {
          if (v) this.setAttribute('switch', '');
          else this.removeAttribute('switch');
        },
      });
    }
  }, !!opts.ticks);
  await signUp(page, name('snd'));
  return page;
}

const heard = (page: Page) => page.evaluate(() => [...(window as unknown as { sounds: string[] }).sounds]);
/** Waits for exactly these sounds (since the last check), then starts counting again. */
async function expectHeard(page: Page, sounds: string[]) {
  await expect.poll(() => heard(page)).toEqual(sounds);
  await page.evaluate(() => (window as unknown as { sounds: string[] }).sounds.splice(0));
}
const post = (page: Page, path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const upload = (page: Page) =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5f7f3d';
    ctx.fillRect(0, 0, 300, 300);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });
const axe = async (page: Page) => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`);
};

async function addProduct(page: Page, product: string, look: string) {
  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await page.locator('.fab').click();
  await page.getByLabel('Name').fill(product);
  await page.getByRole('button', { name: /^Look: .*Tap to type/ }).click();
  await page.getByLabel('Look (1 to 10)').fill(look);
  await page.getByLabel('Look (1 to 10)').press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hero h1')).toHaveText(product);
}

test('each moment plays its sound: a new #1, a save, a switch, the Log, deleting', async ({ browser }) => {
  const page = await open(browser);
  await expect(page.getByRole('heading', { name: 'Nothing ranked yet' })).toBeVisible();

  // The first product rated is your #1; a lower one is a plain save; a higher one takes #1.
  await addProduct(page, 'Alpha', '8');
  await expectHeard(page, ['first:soft']);
  await addProduct(page, 'Beta', '7');
  await expectHeard(page, ['save:soft']);
  await addProduct(page, 'Gamma', '9.5');
  await expectHeard(page, ['first:soft']);
  // Saving the #1 again: it was already #1.
  await page.getByRole('region', { name: 'Actions' }).getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expectHeard(page, ['save:soft']);

  // Flicking a switch.
  await page.getByRole('switch', { name: /Private/ }).click();
  await expect(page.getByRole('switch', { name: /Private/ })).toBeChecked();
  await expectHeard(page, ['switch:soft']);

  // Saving to the Log, then deleting the entry.
  await page.getByRole('link', { name: 'Log' }).click();
  await page.locator('.fab').click();
  await page.getByLabel('Name').fill('Sour Diesel');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page.locator('.lrow', { hasText: 'Sour Diesel' })).toBeVisible();
  await expectHeard(page, ['log:soft']);
  await page.locator('.lrow', { hasText: 'Sour Diesel' }).click();
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete entry' }).click();
  await expect(page.locator('.lrow', { hasText: 'Sour Diesel' })).toHaveCount(0);
  await expectHeard(page, ['delete:soft']);

  // Removing a photo in the editor.
  const made = await post(page, '/api/products', { ...emptyProductInput(), name: 'Delta', photos: [{ upload: await upload(page), crop: null }] });
  await page.goto(`/products/${made.product.id}/edit`);
  await page.getByRole('button', { name: 'Options for photo 1' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByRole('button', { name: /^Options for photo/ })).toHaveCount(0);
  await expectHeard(page, ['delete:soft']);
  await page.context().close();
});

test('More → Sounds and ticks, its own screen (D57): Sounds on to start, Soft or Woody, saved on this phone; off means silence', async ({ browser }) => {
  const page = await open(browser);
  // Leaderboard colours is back to colours only.
  await page.goto('/more/appearance');
  await expect(page.getByRole('switch', { name: 'Mark my #1' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Sounds' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Soft|Woody/ })).toHaveCount(0);

  await page.goto('/more');
  const row = page.getByRole('link', { name: /Sounds and ticks/ });
  await expect(row).toContainText('On');
  await row.click();
  await expect(page).toHaveURL(/\/more\/sounds$/);
  const sounds = page.getByRole('switch', { name: 'Sounds' });
  await expect(sounds).toBeChecked();
  // No ticks on a phone that can't tick.
  await expect(page.getByRole('switch', { name: 'Ticks' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Soft/ })).toBeChecked();
  expect(await axe(page)).toEqual([]);
  const worst = await wholeScreenContrastFailures(page, '/more/sounds', '#ap-sound-set, .sound-set .main > span, .priv-row .main > span, .priv-foot');
  expect(worst, worst.join('\n')).toEqual([]);

  // Tapping a sound plays it, even the one already chosen.
  await page.getByRole('radio', { name: /Woody/ }).click();
  await page.getByRole('radio', { name: /Woody/ }).click();
  await expectHeard(page, ['save:woody', 'save:woody']);
  // Every sound sets the quiet-on-silent mode again (D58): set only once, the Home Screen app played on silent.
  const mode = () => page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type);
  expect(await mode()).toBe('ambient');
  await page.evaluate(() => ((navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback'));
  await page.getByRole('radio', { name: /Woody/ }).click();
  await expectHeard(page, ['save:woody']);
  expect(await mode()).toBe('ambient');
  await page.reload();
  await expect(page.getByRole('radio', { name: /Woody/ })).toBeChecked();

  // Off: the choice of sound hides, and nothing plays (not even the switches).
  await sounds.click();
  await expect(sounds).not.toBeChecked();
  await expect(page.getByRole('radio', { name: /Soft|Woody/ })).toHaveCount(0);
  await expectHeard(page, []);
  await page.getByRole('link', { name: 'Back' }).first().click();
  await expect(page.getByRole('link', { name: /Sounds and ticks/ })).toContainText('Off');
  await page.goto('/more/appearance');
  await page.getByRole('switch', { name: 'Mark my #1' }).click();
  await expect(page.getByRole('switch', { name: 'Mark my #1' })).not.toBeChecked();
  await expectHeard(page, []); // a switch's sound plays as it flips, so there'd be one by now
  await page.goto('/more/sounds');
  await expect(sounds).not.toBeChecked();
  await sounds.click();
  await expectHeard(page, ['switch:woody']);
  await expect(page.getByRole('radio', { name: /Woody/ })).toBeChecked();
  await page.context().close();
});

test('ticks: a label of the hidden switch fills Save and Delete entry, each acts once; the app’s switches tick; Ticks off removes them', async ({ browser }) => {
  const page = await open(browser, { ticks: true });
  const made = await post(page, '/api/products', { ...emptyProductInput(), name: 'Tick Kush', ratings: { look: 8 } });
  const entry = await post(page, '/api/log', { ...emptyLogEntryInput(), name: 'Tick Entry' });
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() !== 'GET') calls.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });

  await page.goto('/more/sounds');
  await expect(page.getByRole('switch', { name: 'Ticks' })).toBeChecked();
  await expect(page.locator('input.switch:not([switch])')).toHaveCount(0);

  // Save: the tick fills the button, and the save happens once.
  await page.goto(`/products/${made.product.id}/edit`);
  const save = page.getByRole('button', { name: 'Save', exact: true });
  // An invisible label of the one hidden switch, outside the button.
  await expect(save.locator('label.tick[for=gt-tick]')).toHaveCount(1);
  await expect(page.locator('input#gt-tick[type=checkbox][switch]')).toHaveCount(1);
  // It fills the button inside its 1px border, so wherever your finger lands, it lands on the label.
  const [b, l] = await Promise.all([save.boundingBox(), save.locator('label.tick').boundingBox()]);
  expect([l!.x - b!.x, l!.y - b!.y, b!.width - l!.width, b!.height - l!.height]).toEqual([1, 1, 2, 2]);
  await expect(page.locator('input.switch[switch]')).toHaveCount(1); // Private
  expect(await axe(page)).toEqual([]);
  await save.click();
  await expect(page).toHaveURL(new RegExp(`/products/${made.product.id}$`));
  await expect(page.locator('#gt-tick')).toBeChecked(); // the tap flipped the hidden switch
  expect(calls.splice(0)).toEqual([`PUT /api/products/${made.product.id}`]);
  await expectHeard(page, ['save:soft']);

  // Delete entry: the sheet's button ticks, and deletes once.
  await page.goto(`/log/${entry.entry.id}`);
  await page.getByRole('button', { name: 'Delete entry' }).click();
  const confirm = page.locator('.sheet').getByRole('button', { name: 'Delete entry' });
  await expect(confirm.locator('label.tick[for=gt-tick]')).toHaveCount(1);
  expect(await axe(page)).toEqual([]);
  await confirm.click();
  await expect(page).toHaveURL(/\/log$/);
  expect(calls.splice(0)).toEqual([`DELETE /api/log/${entry.entry.id}`]);
  await expectHeard(page, ['delete:soft']);

  // Ticks off: no hidden switches, and the app's switches stop ticking.
  await page.goto('/more/sounds');
  await page.getByRole('switch', { name: 'Ticks' }).click();
  await expect(page.getByRole('switch', { name: 'Ticks' })).not.toBeChecked();
  await expect(page.locator('input.switch[switch]')).toHaveCount(0);
  await page.goto(`/products/${made.product.id}/edit`);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(page.locator('label.tick')).toHaveCount(0);
  await expect(page.locator('input.switch[switch]')).toHaveCount(0);
  await page.context().close();
});
