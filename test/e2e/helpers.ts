import type { Page } from '@playwright/test';

/** A platform authenticator with Face ID-style user verification (Chromium's virtual authenticator). */
export async function addAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

/** Creates an account through the real sign-up screens and lands on the Leaderboard. */
export async function signUp(page: Page, username = `u${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`) {
  await addAuthenticator(page);
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByText('Available').waitFor();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.getByLabel('I’ve saved these codes somewhere safe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('navigation', { name: 'Main' }).waitFor();
  return username;
}

export const shot = (page: Page, name: string) => page.screenshot({ path: `.playwright/screens/${name}.png`, animations: 'disabled' });
