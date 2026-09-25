import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { emptyLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput } from '../../shared/domain/product';
import { shot, signUp } from './helpers';

// D20 (0.14.0): "Lift" press feedback on everything you can tap, and "Photo grows"
// when a product is opened from a list (and on Back). One account for the file.
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const upload = () =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#5f7f3d';
    ctx.beginPath();
    ctx.arc(200, 150, 90, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    for (const part of ['original', 'cropped', 'thumb']) form.append(part, blob, `${part}.jpg`);
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });

/** Records every view transition the page starts, and which parts animate in it. */
const recordTransitions = () =>
  page.evaluate(() => {
    const w = window as unknown as { __vt: string[][]; __vtMs: number[]; __enter: string[]; __vtDone: number };
    w.__vt = [];
    w.__vtMs = [];
    w.__enter = [];
    // Every start of the screen entrance fade (the flash the owner saw), in any element.
    document.addEventListener('animationstart', (e) => e.animationName === 'enter' && w.__enter.push((e.target as Element).className), true);
    const doc = document as Document & { startViewTransition: (cb: () => Promise<void>) => { ready: Promise<void> } };
    const original = doc.startViewTransition.bind(doc);
    doc.startViewTransition = (cb) => {
      const started = performance.now();
      w.__enter = [];
      const t = original(cb);
      const entry: string[] = [];
      w.__vt.push(entry);
      t.ready.then(() => w.__vtMs.push(performance.now() - started));
      t.finished.then(() => (w.__vtDone = Number(document.timeline.currentTime)));
      t.ready.then(() => entry.push(...document.getAnimations().map((a) => (a.effect as KeyframeEffect).pseudoElement ?? '').filter(Boolean))).catch((err) => entry.push(`skipped: ${err}`));
      return t;
    };
  });
const transitions = () => page.evaluate(() => (window as unknown as { __vt: string[][] }).__vt);
/** Entrance fades that started since the last transition began (should be none). */
const entrances = () => page.evaluate(() => (window as unknown as { __enter: string[] }).__enter);
/** How long each transition kept the old screen frozen before animating (the app allows 400ms). */
const frozenMs = () => page.evaluate(() => (window as unknown as { __vtMs: number[] }).__vtMs);

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page);
  await post('/api/products', { ...emptyProductInput(), name: 'Photo Kush', strainType: 'hybrid', country: 'US', ratings: { look: 9, smell: 9, taste: 9, burn: 9 }, photos: [{ upload: await upload(), crop: null }] });
  for (let i = 0; i < 7; i++) await post('/api/products', { ...emptyProductInput(), name: `Row ${i + 1}`, ratings: { look: 8 - i / 2 } });
  await post('/api/log', { ...emptyLogEntryInput(), name: 'Loose One', country: 'US', amount: 1 });
});
test.afterAll(() => context.close());

const row = (name: string) => page.locator('.row', { hasText: name });

test('holding a row lifts it after a moment; a quick tap still flashes; moving never lifts', async () => {
  await page.goto('/');
  const target = row('Row 5');
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Hold: nothing for the first instant (it might be a scroll), then the lift. The delay
  // is measured inside the page, so a slow test machine can't make this flaky.
  await target.evaluate((el) => {
    const w = window as unknown as { __down: number; __lift: number };
    document.addEventListener('pointerdown', () => (w.__down = performance.now()), { capture: true, once: true });
    const watch = new MutationObserver(() => {
      if (!el.classList.contains('is-pressed')) return;
      w.__lift = performance.now();
      watch.disconnect();
    });
    watch.observe(el, { attributes: true });
  });
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await expect(target).toHaveClass(/is-pressed/);
  expect(await page.evaluate(() => { const w = window as unknown as { __down: number; __lift: number }; return w.__lift - w.__down; })).toBeGreaterThanOrEqual(50);
  await expect.poll(() => target.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(1.03, 2);
  // Slide the finger away (like starting a scroll) and let go elsewhere: no lift, no open.
  await page.mouse.move(cx, cy + box.height + 12, { steps: 4 });
  await expect(target).not.toHaveClass(/is-pressed/);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);

  // Moving straight away (a scroll) never lifts anything.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 30, { steps: 2 });
  await page.waitForTimeout(150);
  expect(await page.locator('.is-pressed').count()).toBe(0);
  await page.mouse.up();

  // A quick tap on a button still shows the press briefly.
  const seen = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const fab = document.querySelector('.fab')!;
        new MutationObserver(() => fab.classList.contains('is-pressed') && resolve(true)).observe(fab, { attributes: true });
        setTimeout(() => resolve(false), 2000);
      }),
  );
  await page.locator('.fab').click();
  expect(await seen).toBe(true);
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.locator('.is-pressed')).toHaveCount(0);
});

test('rows inside a card light up instead of growing past its edge', async () => {
  await page.goto('/more');
  const item = page.locator('.li.link').first();
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await expect(item).toHaveClass(/is-pressed/);
  await expect.poll(() => item.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(88, 224, 140, 0.12)');
  expect(await item.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThanOrEqual(1.02);
  await page.mouse.move(box.x + 40, box.y - 60, { steps: 3 });
  await page.mouse.up();
  await expect(item).not.toHaveClass(/is-pressed/);
});

test('opening a product flies the row’s photo into the big photo, and Back flies it home', async () => {
  await page.goto('/');
  await expect(row('Photo Kush')).toBeVisible();
  await recordTransitions();
  await row('Photo Kush').click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.locator('.hero-photo img')).toBeVisible();
  await expect.poll(transitions).toEqual([expect.arrayContaining(['::view-transition-group(gt-photo)', '::view-transition-new(root)'])]);
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/); // cleaned up afterwards
  // Photo Kush is 1st, so its page is a podium page (D22): its one sweep across the photo
  // waits for the flight to land instead of running underneath it.
  await expect(page.locator('main')).toHaveAttribute('data-podium', '1');
  const sweep = await page.evaluate(() => {
    const a = document.getAnimations().find((x) => (x as CSSAnimation).animationName === 'podium-arrive')!;
    return { started: Number(a.startTime), landed: (window as unknown as { __vtDone: number }).__vtDone };
  });
  expect(sweep.started).toBeGreaterThanOrEqual(sweep.landed - 20);
  // …and nothing replays once the photo lands: in 0.14.0 the screen's own entrance fade
  // restarted there, so the page dipped dark and faded in again (owner's recording).
  await page.waitForTimeout(400);
  expect(await entrances()).toEqual([]);
  await shot(page, '70-photo-grown');

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(row('Photo Kush')).toBeVisible();
  await expect.poll(transitions).toEqual([expect.anything(), expect.arrayContaining(['::view-transition-group(gt-photo)'])]);
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/);
  await page.waitForTimeout(400);
  expect(await entrances()).toEqual([]);
  await expect(page.locator('[style*="view-transition-name"]')).toHaveCount(0);
  // Never a long freeze: each one starts animating well within half a second.
  for (const ms of await frozenMs()) expect(ms).toBeLessThan(600);
});

test('a product without a photo flies its placeholder; the Log does it too, loose entries don’t', async () => {
  await page.goto('/');
  await recordTransitions();
  await row('Row 1').click();
  await expect(page.getByRole('heading', { name: 'Row 1' })).toBeVisible();
  await expect.poll(transitions).toEqual([expect.arrayContaining(['::view-transition-group(gt-photo)'])]);

  await page.goto('/log');
  await recordTransitions();
  await page.locator('.lrow', { hasText: 'Photo Kush' }).click();
  await expect(page.locator('.hero-photo img')).toBeVisible();
  await expect.poll(transitions).toEqual([expect.arrayContaining(['::view-transition-group(gt-photo)'])]);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect.poll(async () => (await transitions()).length).toBe(2);

  await page.locator('.lrow', { hasText: 'Loose One' }).click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  await page.waitForTimeout(300);
  expect((await transitions()).length).toBe(2); // the entry editor opens as before
});

test('opening from a scrolled list: the history entry comes first, and nothing scrolls during the flight', async () => {
  // 0.19.1, owner's recording: with the list scrolled, tapping a row jumped the whole screen
  // down by the distance scrolled (Safari moves the frozen old screen when the page scrolls
  // mid-transition), and swiping back later showed black (the phone's picture of the list
  // was taken mid-flight). Chromium shows neither, so this checks the causes are gone.
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto('/');
  await expect(row('Row 7')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(100);
  await page.evaluate(() => {
    const w = window as unknown as { __pathAtStart: string[]; __yAtStart: number[]; __during: { y: number; hero: number | null }[] };
    w.__pathAtStart = [];
    w.__yAtStart = [];
    w.__during = [];
    const doc = document as Document & { startViewTransition: (cb: () => Promise<void>) => unknown };
    const original = doc.startViewTransition.bind(doc);
    doc.startViewTransition = (cb) => {
      w.__pathAtStart.push(location.pathname);
      w.__yAtStart.push(window.scrollY);
      return original(cb);
    };
    // Timers keep running while a transition prepares the new screen (frames don't).
    setInterval(() => {
      if (!document.documentElement.classList.contains('vt-photo')) return;
      const hero = document.querySelector('.hero-photo');
      w.__during.push({ y: window.scrollY, hero: hero ? Math.round(hero.getBoundingClientRect().top) : null });
    }, 4);
  });
  // Tap where the row is, as a finger does (click() may scroll the page first).
  const box = (await row('Row 6').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('heading', { name: 'Row 6' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/vt-photo|vt-hold/);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __pathAtStart: string[]; __yAtStart: number[]; __during: { y: number; hero: number | null }[] };
    return {
      pathAtStart: w.__pathAtStart,
      yAtStart: w.__yAtStart,
      during: w.__during,
      y: window.scrollY,
      hero: Math.round(document.querySelector('.hero-photo')!.getBoundingClientRect().top),
      hold: document.documentElement.style.getPropertyValue('--vt-hold'),
      margin: getComputedStyle(document.querySelector('main')!).marginTop,
    };
  });
  expect(r.pathAtStart).toEqual([expect.stringMatching(/^\/products\/[^/]+$/)]); // the entry existed before the flight
  expect(r.during.length).toBeGreaterThan(3);
  expect(r.yAtStart[0]).toBeGreaterThan(100);
  expect(new Set(r.during.map((d) => d.y))).toEqual(new Set(r.yAtStart)); // never scrolled mid-flight
  // The product sat exactly where it ends up, so the scroll afterwards can't be seen.
  for (const d of r.during) if (d.hero !== null) expect(Math.abs(d.hero - r.hero)).toBeLessThanOrEqual(1);
  expect(r.during.some((d) => d.hero !== null)).toBe(true);
  expect(r).toMatchObject({ y: 0, hold: '', margin: '0px' });

  // Back still returns to the row, where it was.
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => Math.round((await row('Row 6').boundingBox())!.y)).toBe(Math.round(box.y));
  await page.setViewportSize({ width: 390, height: 844 });
});

test('swiping back (the browser’s Back) shows the list without its entrance fade; other changes keep it', async () => {
  await page.goto('/');
  await expect(row('Photo Kush')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __fades: string[] };
    w.__fades = [];
    document.addEventListener('animationstart', (e) => e.animationName === 'enter' && w.__fades.push(location.pathname), true);
  });
  const fades = () => page.evaluate(() => (window as unknown as { __fades: string[] }).__fades);
  await row('Row 2').click();
  await expect(page.getByRole('heading', { name: 'Row 2' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/vt-photo/);
  await page.waitForTimeout(300);
  expect(await fades()).toEqual([]); // the flight replaces the fade, as before

  await page.goBack(); // what a swipe from the edge does
  await expect(row('Row 2')).toBeVisible();
  await page.waitForTimeout(400);
  expect(await fades()).toEqual([]);
  expect(await page.locator('main.screen').evaluate((el) => el.getAnimations().length)).toBe(0);

  // The next change of screen fades in as usual, and the list it leaves doesn't replay.
  await page.locator('.nav a', { hasText: 'Log' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect.poll(fades).toEqual(['/log']);
  await page.waitForTimeout(300);
  expect(await fades()).toEqual(['/log']);

  // The app's own Back (no photo to fly here) keeps its fade too.
  await page.locator('.nav a', { hasText: 'More' }).click();
  await page.getByRole('link', { name: /Passkeys/ }).click();
  await expect(page).toHaveURL(/passkeys/);
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/more$/);
  await expect.poll(async () => (await fades()).at(-1)).toBe('/more');
});

test('Reduce Motion: presses light up without growing, and products open without the animation', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const target = row('Row 3');
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(target).toHaveClass(/is-pressed/);
  expect(await target.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 3 });
  await page.mouse.up();

  await recordTransitions();
  await row('Photo Kush').click();
  await expect(page.locator('.hero-photo img')).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(row('Photo Kush')).toBeVisible();
  expect(await transitions()).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});
