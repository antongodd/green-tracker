import { expect, test, type CDPSession, type Page } from '@playwright/test';

/** A platform authenticator with Face ID-style user verification (Chromium's virtual authenticator). */
async function addAuthenticator(page: Page): Promise<{ cdp: CDPSession; authenticatorId: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

const shot = (page: Page, name: string) => page.screenshot({ path: `.playwright/screens/${name}.png`, animations: 'disabled' });

test('create an account, sign out and in, recover a lost device, manage passkeys', async ({ page }) => {
  const { cdp, authenticatorId } = await addAuthenticator(page);
  const username = `Anton_${Date.now().toString(36).slice(-6)}`;

  // Signed out → sign-in screen.
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Green Tracker' })).toBeVisible();
  await shot(page, '01-signin');

  // Step 1: username with live availability.
  await page.getByRole('link', { name: 'Create account' }).click();
  const input = page.getByLabel('Username');
  await input.fill('ab');
  await expect(page.getByText('Use at least 3 characters.')).toBeVisible();
  await input.fill('bad name!');
  await expect(page.getByText('Use only letters, numbers and _.')).toBeVisible();
  await input.fill(username);
  await expect(page.getByText('Available')).toBeVisible();
  await shot(page, '02-username');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: passkey.
  await expect(page.getByRole('heading', { name: 'Create your passkey' })).toBeVisible();
  await page.getByRole('button', { name: 'Create passkey' }).click();

  // Step 3: recovery codes, shown once; Continue waits for the tick.
  await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
  const codes = await page.getByRole('list', { name: 'Recovery codes' }).locator('li').allInnerTexts();
  expect(codes).toHaveLength(10);
  await shot(page, '03-codes');
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  await page.getByLabel('I’ve saved these codes somewhere safe').check();
  await cont.click();

  // Signed in: the app shell.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('aria-current', 'page');
  await shot(page, '04-home');

  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  await expect(page.getByRole('link', { name: /Recovery codes\s*10 left/ })).toBeVisible();
  await shot(page, '05-more');

  // Sign out, then back in with the passkey (no username typed).
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('aria-current', 'page');

  // Lose the device: sign out and wipe the authenticator, then use a recovery code.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId });
  await page.getByRole('link', { name: 'Use a recovery code' }).click();
  await page.getByLabel('Username').fill(username.toLowerCase());
  await page.getByLabel('Recovery code').fill(codes[0]!.toLowerCase());
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Nothing else is reachable until a new passkey exists (D4).
  await expect(page.getByRole('heading', { name: 'Add a new passkey' })).toBeVisible();
  await expect(page.getByText('You have 9 recovery codes left.')).toBeVisible();
  await shot(page, '06-new-passkey');
  await page.goto('/more');
  await expect(page.getByRole('heading', { name: 'Add a new passkey' })).toBeVisible();
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  // The used code no longer works.
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /Passkeys\s*2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Recovery codes\s*9 left/ })).toBeVisible();

  // Passkeys: remove the old one behind a confirmation; the last can't be removed.
  await page.getByRole('link', { name: /Passkeys/ }).click();
  const removes = page.getByRole('button', { name: /^Remove passkey/ });
  await expect(removes).toHaveCount(2);
  await removes.first().click();
  await shot(page, '07-remove-sheet');
  await page.getByRole('dialog').getByRole('button', { name: 'Remove passkey' }).click();
  await expect(page.getByText('You need at least one passkey')).toBeVisible();
  await expect(removes).toHaveCount(0);
  await shot(page, '08-passkeys');

  // Sign out everywhere, confirmed.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page).toHaveURL(/\/signin$/);
});

test('a used recovery code is refused', async ({ page }) => {
  await addAuthenticator(page);
  const username = `u${Date.now().toString(36)}`;
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await expect(page.getByText('Available')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create passkey' }).click();
  const code = (await page.getByRole('list', { name: 'Recovery codes' }).locator('li').first().innerText()).trim();
  await page.getByLabel('I’ve saved these codes somewhere safe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();

  for (const expectOk of [true, false]) {
    await page.goto('/recover');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Recovery code').fill(code);
    await page.getByRole('button', { name: 'Sign in' }).click();
    if (expectOk) {
      await expect(page.getByRole('heading', { name: 'Add a new passkey' })).toBeVisible();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/signin$/);
    } else {
      await expect(page.getByRole('alert')).toHaveText('That username and code don’t match. Check both and try again.');
    }
  }
});
