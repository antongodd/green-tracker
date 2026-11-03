import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput, type ProductInput } from '../../shared/domain/product';
import { settled, shot, signUp, wholeScreenContrastFailures } from './helpers';

// You against them (D82), as Anton will try it on GT Dev: Invite a friend on the empty Feed and on
// People (the share sheet with "Follow me on Green Tracker: @name" and the website), "You've had this
// too" on a friend's product page and post, and Compare boards; readable in a dark and a light look.
test.describe.configure({ mode: 'serial' });

let mira: Page, me: Page;
let miraName: string, meName: string;
let gelatoId: string, myGelatoId: string;
const P = (over: Partial<ProductInput>): ProductInput => ({ ...emptyProductInput(), ...over });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return r.json();
    },
    { method, path, body },
  );
const upload = (page: Page, colour: string) =>
  page.evaluate(async (colour) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1f1a';
    ctx.fillRect(0, 0, 480, 480);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(240, 250, 150, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('original', blob, 'original.jpg');
    form.append('cropped', blob, 'cropped.jpg');
    form.append('thumb', blob, 'thumb.jpg');
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  }, colour);

async function person(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  // The iPhone's share sheet, pretended: what was shared is kept for the test to read.
  await context.addInitScript(() => {
    (window as unknown as { shared: unknown[] }).shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: unknown) => void (window as unknown as { shared: unknown[] }).shared.push(data) });
  });
  const page = await context.newPage();
  const name = await signUp(page, `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`);
  return { page, name };
}
const look = (page: Page, look: string) => call(page, 'PUT', '/api/appearance', { look, top: 'strip', preset: 'gems', markFirst: true });

test.beforeAll(async ({ browser }) => {
  ({ page: mira, name: miraName } = await person(browser, 'mira'));
  ({ page: me, name: meName } = await person(browser, 'cme'));
  gelatoId = (await call(mira, 'POST', '/api/products', P({ name: 'Lemon Gelato', strainType: 'hybrid', source: 'Cloud Nine Farms', ratings: { look: 8, smell: 8, taste: 8, burn: 8 }, photos: [{ upload: await upload(mira, '#e6d35a'), crop: null }] }))).product.id;
  await call(mira, 'POST', '/api/products', P({ name: 'Blue Lagoon', source: 'Moonbay', ratings: { look: 9.4, smell: 9.4, taste: 9.4, burn: 9.4 } }));
  await call(mira, 'POST', '/api/products', P({ name: 'Night Owl Gummies', productType: 'edibles', source: 'Moonbay', ratings: { taste: 7.6, high: 7.6 } }));
  myGelatoId = (await call(me, 'POST', '/api/products', P({ name: 'Lemon Gelato', source: 'cloud nine farms', ratings: { look: 9.1, smell: 9.1, taste: 9.1, burn: 9.1 } }))).product.id;
  await call(me, 'POST', '/api/products', P({ name: 'Mango Sunrise', source: 'Northfield', ratings: { look: 9.6, smell: 9.6, taste: 9.6, burn: 9.6 } }));
});

test('Invite a friend: on the empty Feed and on People, the share sheet with your @name and the website', async () => {
  await me.goto('/feed');
  await expect(me.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
  await settled(me);
  expect((await new AxeBuilder({ page: me }).analyze()).violations).toEqual([]);
  await shot(me, 'compare-01-invite-feed');
  await me.getByRole('button', { name: 'Invite a friend' }).click();
  await expect.poll(() => me.evaluate(() => (window as unknown as { shared: unknown[] }).shared)).toEqual([{ text: `Follow me on Green Tracker: @${meName}`, url: 'https://green-tracker-site.green-tracker.workers.dev' }]);
  await me.getByRole('link', { name: 'People', exact: true }).click();
  await expect(me).toHaveURL(/\/people$/);
  await me.getByRole('button', { name: 'Invite a friend' }).click();
  await expect.poll(() => me.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(2);
  // Searching hides it, so the results have the room.
  await me.getByPlaceholder('Search usernames').fill(miraName.slice(0, 6));
  await expect(me.getByRole('button', { name: 'Invite a friend' })).toHaveCount(0);
  // Now follow Mira (she approves) for the rest.
  await call(me, 'POST', `/api/people/u/${miraName}/follow`);
  await call(mira, 'POST', `/api/people/requests/${meName}/approve`);
});

test('a friend’s product page: "You’ve had this too" with both photos, @names and scores; it opens yours', async () => {
  await me.goto(`/u/${miraName}/p/${gelatoId}`);
  const card = me.getByRole('region', { name: 'You’ve had this too' });
  await expect(card).toBeVisible();
  await expect(card.locator('.duel-side')).toHaveText([`${meName[0]!.toUpperCase()}@${meName}9.1`, `${miraName[0]!.toUpperCase()}@${miraName}8.0`]);
  await expect(card.locator('.duel')).not.toContainText(/\byou\b|\bthem\b/i);
  await settled(me);
  expect((await new AxeBuilder({ page: me }).analyze()).violations).toEqual([]);
  await shot(me, 'compare-02-product-page');
  await card.getByRole('link', { name: 'Your page ›' }).click();
  await expect(me).toHaveURL(new RegExp(`/products/${myGelatoId}$`));
});

test('a post about it: your photo and your score in the card, only for you', async () => {
  const set = await upload(mira, '#e6d35a');
  await call(mira, 'POST', '/api/posts', { caption: 'Saturday sorted', about: { product: gelatoId }, photo: { upload: set } });
  await me.goto('/feed');
  const card = me.locator('.about.product').first();
  await expect(card.locator('.your-chip')).toHaveText(/^.?9\.1/);
  await expect(card).toContainText('you\'ve had this too');
  await mira.goto('/feed');
  await expect(mira.locator('.about.product').first()).toBeVisible();
  await expect(mira.locator('.your-chip')).toHaveCount(0);
});

test('Compare boards: from their Leaderboard, a card for each subject, nothing empty', async () => {
  await me.goto(`/u/${miraName}`);
  await me.getByRole('link', { name: 'Compare with my board' }).click();
  await expect(me).toHaveURL(new RegExp(`/u/${miraName}/compare$`));
  await expect(me.locator('.hdr h1, .hdr .title').first()).toContainText(`@${meName} vs @${miraName}`);
  const section = (name: string) => me.getByRole('region', { name, exact: true });
  await expect(section('Average')).toContainText('3 products');
  await expect(section('Number 1')).toContainText('Mango Sunrise');
  await expect(section('Number 1')).toContainText('Blue Lagoon');
  await expect(section('You’ve both had')).toContainText('Lemon Gelato');
  await expect(section('Brands you’ve both tried')).toContainText('Cloud Nine Farms');
  await expect(section('Their top picks you haven’t tried')).toContainText('Blue Lagoon');
  await expect(section('Their top picks you haven’t tried')).not.toContainText('Lemon Gelato');
  await settled(me);
  expect((await new AxeBuilder({ page: me }).analyze()).violations).toEqual([]);
  await shot(me, 'compare-03-compare');
  // Source off: no "both had", no brands at all (not an empty box), and a note why.
  await call(mira, 'PUT', '/api/privacy', { shareBoard: true, shareSource: false, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
  try {
    await me.reload();
    await expect(section('Average')).toBeVisible();
    await expect(section('You’ve both had')).toHaveCount(0);
    await expect(section('Brands you’ve both tried')).toHaveCount(0);
    await expect(section('Their top picks')).toContainText('Lemon Gelato');
    await expect(me.getByText('doesn’t share brands')).toBeVisible();
  } finally {
    await call(mira, 'PUT', '/api/privacy', { shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
  }
});

for (const tone of ['aurora', 'daymint'] as const) {
  test(`readable in ${tone}: the product page card, the post card and Compare`, async () => {
    test.slow();
    await look(mira, tone); // her pages are in her look (D74)
    await look(me, tone); // the Feed is in yours
    try {
      expect(await wholeScreenContrastFailures(me, `/u/${miraName}/compare`, '.duel-name, .duel-score, .duel-sub, .sect > .cap, .cmp-name b, .cmp-name span, .your-chip b, .cmp-note')).toEqual([]);
      expect(await wholeScreenContrastFailures(me, `/u/${miraName}/p/${gelatoId}`, '.too .duel-name, .too .duel-score, .too-head a')).toEqual([]);
      expect(await wholeScreenContrastFailures(me, '/feed', '.about .your-chip b')).toEqual([]);
      await me.goto(`/u/${miraName}/compare`);
      await me.locator('.cmp-name span').first().waitFor();
      // Opened straight from an address, her look fades in (D74): judge it once the fade is over.
      await expect(me.locator('html')).not.toHaveClass(/vt-look/);
      await settled(me);
      expect((await new AxeBuilder({ page: me }).analyze()).violations).toEqual([]);
      if (tone === 'daymint') await shot(me, 'compare-04-compare-daymint');
    } finally {
      await look(mira, 'aurora');
      await look(me, 'aurora');
    }
  });
}
