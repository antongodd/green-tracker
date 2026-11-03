import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { CONTACT_EMAIL, PHOTO_LIMIT } from '../../shared/domain/trust';
import { addAuthenticator, emailOf, PASSWORD, settled, shot, signUp, wholeScreenContrastFailures } from './helpers';

// Trust basics for strangers (D84), as Anton will try it on GT Dev: the 18+ tick at sign-up (and once for an older
// account), the privacy page and house rules from sign-up and Settings, Report on a post, a comment and a person,
// and the photo limit's message. Readable and clean for axe.
test.describe.configure({ mode: 'serial' });

let mira: Page, me: Page;
let miraName: string, meName: string;
let postId: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (page: Page, method: string, path: string, body?: unknown): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, ...((await r.json()) as object) };
    },
    { method, path, body },
  );
const postSet = (page: Page) =>
  page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1f1a';
    ctx.fillRect(0, 0, 480, 480);
    ctx.fillStyle = '#6fbf5a';
    ctx.beginPath();
    ctx.arc(240, 250, 150, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('cropped', blob, 'cropped.jpg');
    form.append('thumb', blob, 'thumb.jpg');
    return ((await (await fetch('/api/uploads', { method: 'POST', body: form })).json()) as { upload: string }).upload;
  });
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
const name = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

async function person(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  return { page, name: await signUp(page, name(prefix)) };
}

test.beforeAll(async ({ browser }) => {
  ({ page: mira, name: miraName } = await person(browser, 'tmira'));
  ({ page: me, name: meName } = await person(browser, 'tme'));
  await call(me, 'POST', `/api/people/u/${miraName}/follow`);
  expect((await call(mira, 'POST', `/api/people/requests/${meName}/approve`)).status).toBe(200);
  const r = await call(mira, 'POST', '/api/posts', { caption: 'Sunday’s pick. Proper gassy', about: null, photo: { upload: await postSet(mira) } });
  expect(r.status).toBe(201);
  postId = r.post.id;
});

test('sign-up: Continue waits for the 18+ tick; the house rules and privacy open over it and keep what you typed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addAuthenticator(page);
  await page.goto('/signup');
  await page.getByLabel('Email').fill(emailOf('somebody'));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  await settled(page);
  expect(await axe(page)).toEqual([]);
  await shot(page, 'trust-01-signup');

  await page.getByRole('button', { name: 'House rules' }).click();
  const rules = page.getByRole('dialog', { name: 'House rules' });
  await expect(rules.getByText('No selling or supplying')).toBeVisible();
  await expect(rules.getByText(CONTACT_EMAIL)).toBeVisible();
  await settled(page);
  expect(await axe(page)).toEqual([]);
  await rules.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Privacy' }).click();
  const privacy = page.getByRole('dialog', { name: 'Privacy' });
  await expect(privacy.getByRole('heading', { name: 'What’s kept' })).toBeVisible();
  await expect(privacy.getByText('Western Europe')).toBeVisible();
  await expect(privacy.getByText('30 days')).toBeVisible();
  await settled(page);
  expect(await axe(page)).toEqual([]);
  await privacy.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByLabel('Email')).toHaveValue(emailOf('somebody'));
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(PASSWORD);

  await page.getByRole('checkbox', { name: /I’m 18 or over/ }).check();
  await expect(cont).toBeEnabled();
  await page.getByRole('checkbox', { name: /I’m 18 or over/ }).uncheck();
  await expect(cont).toBeDisabled();
});

test('an older account is asked once, before anything else, and never again', async ({ browser }) => {
  const { page, name: older } = await person(browser, 'told');
  expect((await call(page, 'POST', '/api/test/not-adult', { username: older })).status).toBe(200);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'One quick thing' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  await settled(page);
  expect(await axe(page)).toEqual([]);
  await shot(page, 'trust-02-once');
  await page.getByRole('checkbox', { name: /I’m 18 or over/ }).check();
  await cont.click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One quick thing' })).toHaveCount(0);
  await page.context().close();
});

test('Settings → About: Privacy, House rules and Contact; readable, clean for axe', async () => {
  await me.setViewportSize({ width: 390, height: 844 });
  await me.goto('/more');
  await expect(me.getByText('About', { exact: true })).toBeVisible();
  await me.getByRole('link', { name: /^Privacy/ }).click();
  await expect(me).toHaveURL(/\/more\/about\/privacy$/);
  await expect(me.getByRole('heading', { name: 'Who sees what' })).toBeVisible();
  await settled(me);
  expect(await axe(me)).toEqual([]);
  await shot(me, 'trust-03-privacy');
  expect(await wholeScreenContrastFailures(me, '/more/about/privacy', '.about .intro, .about h2, .about li, .about p, .about dt, .about dd')).toEqual([]);
  await me.goto('/more/about/rules');
  await expect(me.getByText('No faces without a yes')).toBeVisible();
  await settled(me);
  expect(await axe(me)).toEqual([]);
  await shot(me, 'trust-04-rules');
  expect(await wholeScreenContrastFailures(me, '/more/about/rules', '.about .intro, .about h2, .about .rules b, .about .rules li > span:last-child, .about p')).toEqual([]);
  await me.goto('/more');
  await expect(me.getByRole('button', { name: new RegExp(`Contact.*${CONTACT_EMAIL.replace('.', '\\.')}`) })).toBeVisible();
});

test('Report a post: why, in one tap; hidden for you only; Show it brings it back', async () => {
  await me.goto('/feed');
  const card = me.locator(`[data-post="${postId}"]`);
  await card.getByRole('button', { name: `Actions for @${miraName}’s post` }).click();
  await me.getByRole('button', { name: 'Report post' }).click();
  const sheet = me.getByRole('dialog', { name: 'Why are you reporting this post?' });
  await expect(sheet).toBeVisible();
  await settled(me);
  expect(await axe(me)).toEqual([]);
  await shot(me, 'trust-05-report');
  await sheet.getByRole('button', { name: 'Selling or offering to supply' }).click();
  await expect(card.getByText('You reported this post. It’s hidden for you.')).toBeVisible();
  await expect(card.getByText('Sunday’s pick')).toHaveCount(0);
  await expect(me.getByRole('status')).toHaveText('Thanks. Reported, and hidden for you.');
  // Still hidden after a reload; Mira sees her post as ever.
  await me.reload();
  await expect(me.locator(`[data-post="${postId}"]`).getByText('You reported this post.')).toBeVisible();
  await mira.goto('/feed');
  await expect(mira.locator(`[data-post="${postId}"]`).getByText('Sunday’s pick')).toBeVisible();
  await me.locator(`[data-post="${postId}"]`).getByRole('button', { name: 'Show it' }).click();
  await expect(me.locator(`[data-post="${postId}"]`).getByText('Sunday’s pick')).toBeVisible();
});

test('Report a comment: on someone else’s comment only; hidden for you', async () => {
  expect((await call(mira, 'POST', `/api/posts/${postId}/comments`, { body: 'Message me if you want some' })).status).toBe(201);
  expect((await call(me, 'POST', `/api/posts/${postId}/comments`, { body: 'Need to try this' })).status).toBe(201);
  await me.goto(`/posts/${postId}`);
  await expect(me.getByText('Need to try this')).toBeVisible();
  // Your own comment: Delete only.
  await me.getByRole('button', { name: `Actions for @${meName}’s comment` }).click();
  await expect(me.getByRole('button', { name: 'Delete comment' })).toBeVisible();
  await expect(me.getByRole('button', { name: 'Report comment' })).toHaveCount(0);
  await me.getByRole('button', { name: 'Cancel' }).click();
  await me.getByRole('button', { name: `Actions for @${miraName}’s comment` }).click();
  await expect(me.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);
  await me.getByRole('button', { name: 'Report comment' }).click();
  await me.getByRole('dialog', { name: 'Why are you reporting this comment?' }).getByRole('button', { name: 'Selling or offering to supply' }).click();
  await expect(me.getByText('You reported this comment. It’s hidden for you.')).toBeVisible();
  await expect(me.getByText('Message me if you want some')).toHaveCount(0);
  await settled(me);
  expect(await axe(me)).toEqual([]);
});

test('Report a person: Also block starts ticked; untick it to report without blocking', async () => {
  await me.goto(`/u/${miraName}`);
  await me.getByRole('button', { name: `Actions for @${miraName}` }).click();
  await me.getByRole('button', { name: 'Report', exact: true }).click();
  const sheet = me.getByRole('dialog', { name: 'Why are you reporting this person?' });
  const block = sheet.getByRole('checkbox', { name: `Also block @${miraName}` });
  await expect(block).toHaveAttribute('aria-checked', 'true');
  await settled(me);
  expect(await axe(me)).toEqual([]);
  await shot(me, 'trust-06-report-person');
  await block.click();
  await expect(block).toHaveAttribute('aria-checked', 'false');
  await sheet.getByRole('button', { name: 'Something else' }).click();
  await expect(me.getByRole('status')).toHaveText('Thanks. Reported.');
  // Not blocked: her Leaderboard is still there.
  await expect(me.getByRole('button', { name: `Actions for @${miraName}` })).toBeVisible();
  expect((await call(me, 'GET', `/api/people/u/${miraName}`)).person.relation).toBe('following');
});

test('the photo limit: near it the editors say how many are left; at it, that it’s full', async ({ browser }) => {
  const { page, name: who } = await person(browser, 'tpics');
  const filler = (await call(page, 'POST', '/api/products', { ...emptyProductInput(), name: 'Lots of photos' })).product.id;
  expect((await call(page, 'POST', '/api/test/fill-photos', { username: who, product: filler, count: PHOTO_LIMIT - 42 })).status).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/new');
  await expect(page.getByRole('status').filter({ hasText: 'room for 42 more' })).toHaveText(`You’ve got ${(PHOTO_LIMIT - 42).toLocaleString('en-GB')} photos. An account can have ${PHOTO_LIMIT.toLocaleString('en-GB')}, so there’s room for 42 more.`);
  await settled(page);
  expect(await axe(page)).toEqual([]);
  await shot(page, 'trust-07-room');
  expect((await call(page, 'POST', '/api/test/fill-photos', { username: who, product: filler, count: 42 })).status).toBe(200);
  await page.goto('/products/new');
  await expect(page.locator('.room.full')).toHaveText(/You’ve reached 3,000 photos, the most an account can have\./);
  await page.context().close();
});
