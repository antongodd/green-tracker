import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { PASSWORD, addAuthenticator, emailOf } from './helpers';

// D80: accounts sign in with an email and a password; Face ID (a passkey) is optional; recovery codes are gone.

const shot = (page: Page, name: string) => page.screenshot({ path: `.playwright/screens/${name}.png`, animations: 'disabled' });

test('create an account with email and password, Face ID once, sign out and in both ways, manage passkeys', async ({ page }) => {
  const { cdp, authenticatorId } = await addAuthenticator(page);
  const username = `Anton_${Date.now().toString(36).slice(-6)}`;
  const email = emailOf(username);

  // Signed out → the welcome screen: Sign in, Create account, Sign in with Face ID.
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Green Tracker' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Face ID' })).toBeVisible();
  await shot(page, '01-signin');

  // Step 1 of 2: email and password. The password's rule turns green; Continue waits for both.
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Step 1 of 2' })).toBeVisible();
  await expect(page.locator('.lead')).toHaveText('Your email is private: only you see it. We use it only to sign you in.');
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  await page.getByLabel('Email').fill('not-an-email');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('short');
  await expect(page.locator('.hint', { hasText: 'At least 8 characters' })).not.toHaveClass(/\bok\b/);
  await expect(cont).toBeDisabled();
  await password.fill(PASSWORD);
  await expect(page.locator('.hint', { hasText: 'At least 8 characters' })).toHaveClass(/\bok\b/);
  // 0.69.1: a line saying there's no email reset; the email is the iPhone's "username" for its password store.
  await expect(page.locator('.hint', { hasText: 'Pick one you’ll remember: we can’t reset it by email yet.' })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username');
  await cont.click();
  await expect(page.getByRole('alert')).toHaveText(/That doesn’t look like an email address\./);
  await page.getByLabel('Email').fill(email);
  // Show lets you check what you typed.
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await shot(page, '02-email');
  await cont.click();

  // Step 2 of 2: the @name, with live availability.
  await expect(page.getByRole('heading', { name: 'Pick your @name' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Step 2 of 2' })).toBeVisible();
  const input = page.getByLabel('Username');
  await input.fill('ab');
  await expect(page.getByText('Use at least 3 characters.')).toBeVisible();
  await input.fill('bad name!');
  await expect(page.getByText('Use only letters, numbers and _.')).toBeVisible();
  // Step 1's email and password ride along, hidden, so iCloud Keychain saves them under the email (0.69.1).
  const form = page.locator('form.form-page');
  await expect(form.locator('input[autocomplete="username"]')).toHaveValue(email);
  await expect(form.locator('input[autocomplete="username"]')).toBeHidden();
  await expect(form.locator('input[autocomplete="new-password"]')).toHaveValue(PASSWORD);
  await expect(form.locator('input[autocomplete="new-password"]')).toBeHidden();
  await input.fill(username);
  await expect(page.getByText('Available')).toBeVisible();
  await shot(page, '03-username');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Then, once: Face ID next time?
  await expect(page.getByRole('heading', { name: 'Use Face ID next time?' })).toBeVisible();
  await expect(page.getByText('It’s also your way back in if you forget your password.')).toBeVisible();
  await shot(page, '04-faceid');
  await page.getByRole('button', { name: 'Use Face ID' }).click();

  // Signed in: the app shell. No recovery codes anywhere.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`Email\\s*${email.replace('.', '\\.')}`) })).toBeVisible();
  await expect(page.getByRole('link', { name: /Face ID \(passkeys\)\s*1/ })).toBeVisible();
  await expect(page.getByText(/recovery code/i)).toHaveCount(0);
  await shot(page, '05-more');

  // Sign out, then in with Face ID (nothing typed).
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByRole('button', { name: 'Sign in with Face ID' }).click();
  await expect(page.getByRole('link', { name: 'Leaderboard', exact: true })).toHaveAttribute('aria-current', 'page');

  // Lose the phone: sign out and wipe the authenticator; the email and password still get you in.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId });
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  // Forgot password? Honest words, shown on a tap (0.69.1).
  const help = page.getByText('We can’t reset passwords by email yet. If you set up Face ID, sign in with that instead.');
  await expect(help).toBeHidden();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(help).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('Email').fill(email.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('That email and password don’t match.');
  await shot(page, '06-wrong-password');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  // Face ID: add one on this device, then remove every passkey, the last too (D80: the password always works).
  await page.goto('/more/passkeys');
  await page.getByRole('button', { name: 'Add a passkey on this device' }).click();
  const removes = page.getByRole('button', { name: /^Remove passkey/ });
  await expect(removes).toHaveCount(2);
  await removes.first().click();
  await shot(page, '07-remove-sheet');
  await page.getByRole('dialog').getByRole('button', { name: 'Remove passkey' }).click();
  await expect(removes).toHaveCount(1);
  await removes.first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove passkey' }).click();
  await expect(removes).toHaveCount(0);
  await shot(page, '08-passkeys');

  // Sign out everywhere, confirmed.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page).toHaveURL(/\/signin$/);
});

test('too many tries: the message points to Face ID', async ({ page }) => {
  // The limits themselves (D80) are tested in the API tests; here the server's answer is pretended.
  await page.route('**/api/auth/signin', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' }) }),
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill('someone@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Too many tries. Wait a few minutes and try again, or sign in with Face ID if you set it up.');
});

test('a taken email sends you back to step 1 with the reason', async ({ page, browser }) => {
  const first = await (await browser.newContext()).newPage();
  const taken = `t${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await first.goto('/');
  expect((await first.evaluate(async (b) => (await fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status, { email: emailOf(taken), password: PASSWORD, username: taken }))).toBe(200);
  await first.context().close();

  await page.goto('/signup');
  await page.getByLabel('Email').fill(emailOf(taken));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Username').fill(`n${taken}`.slice(0, 20));
  await expect(page.getByText('Available')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(/There’s already an account with that email\. Sign in instead\./);
});

test('Not now: no passkey, and the password signs you in', async ({ page }) => {
  await addAuthenticator(page);
  const username = `nn${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(emailOf(username));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Username').fill(username);
  await expect(page.getByText('Available')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('link', { name: /Face ID \(passkeys\)\s*0/ })).toBeVisible();
});

test('Settings: change your email and your password', async ({ page }) => {
  await addAuthenticator(page);
  const username = `cp${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/');
  await page.evaluate(async (b) => fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), { email: emailOf(username), password: PASSWORD, username });
  await page.goto('/more');
  await page.getByRole('link', { name: /^Email/ }).click();
  await expect(page).toHaveURL(/\/more\/email$/);
  const fresh = emailOf(`new${username}`);
  await page.getByLabel('Email').fill(fresh);
  await page.getByLabel('Current password').fill('wrong password');
  await page.getByRole('button', { name: 'Save email' }).click();
  await expect(page.getByRole('alert')).toHaveText('That password isn’t right.');
  await page.getByLabel('Current password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Save email' }).click();
  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole('link', { name: /^Email/ })).toContainText(fresh);

  await page.getByRole('link', { name: /^Password/ }).click();
  await page.getByLabel('Current password').fill(PASSWORD);
  await page.getByLabel('New password').fill('a brand new one');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Password changed.');
  // Still signed in here; the new one works elsewhere.
  const ok = await page.evaluate(async (b) => (await fetch('/api/auth/signin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b), credentials: 'omit' })).status, { email: fresh, password: 'a brand new one' });
  expect(ok).toBe(200);
});

test('an account from before email and password: one screen asks for both, then everything is as it was', async ({ page }) => {
  await addAuthenticator(page);
  const username = `old${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/');
  const call = (path: string, body: unknown) =>
    page.evaluate(async ([p, b]) => (await fetch(p as string, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status, [path, body] as const);
  expect(await call('/api/auth/signup', { email: emailOf(username), password: PASSWORD, username })).toBe(200);
  await call('/api/products', { ...emptyProductInput(), name: 'Kept Through It' });
  expect(await call('/api/test/old-account', { username })).toBe(200); // as every account was when 0019 ran

  // Nothing else opens, whatever the address.
  for (const path of ['/', '/more', '/log']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Add an email and password' })).toBeVisible();
  }
  await expect(page.getByText('Recovery codes are gone')).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await shot(page, '09-add-login');
  const save = page.getByRole('button', { name: 'Save and continue' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Email').fill(emailOf(username));
  await page.getByLabel('New password').fill(PASSWORD);
  await save.click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.row', { hasText: 'Kept Through It' })).toBeVisible();
});
