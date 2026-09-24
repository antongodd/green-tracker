import { expect, type Page } from '@playwright/test';

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

/** Stats tiles (0.11.0, D17): number and label centred in the tile, inside its
 *  edges (nothing cut off), and the green diagonal wash applied. */
export async function expectTilesCentredAndWashed(page: Page) {
  const tiles = page.locator('.tile');
  await expect(tiles.first()).toBeVisible();
  const report = await tiles.evaluateAll((els) =>
    els.map((el) => {
      const t = el.getBoundingClientRect();
      const mid = t.left + t.width / 2;
      const parts = [el.querySelector('b')!, el.querySelector('.cap')!].map((c) => {
        const r = (c as HTMLElement).getBoundingClientRect();
        // Measure the text itself, not its box (a grid item can stretch).
        const range = document.createRange();
        range.selectNodeContents(c);
        const tr = range.getBoundingClientRect();
        return {
          off: Math.abs(tr.left + tr.width / 2 - mid),
          inside: tr.left >= t.left && tr.right <= t.right && r.right <= t.right,
          clipped: (c as HTMLElement).scrollWidth > Math.ceil(r.width),
        };
      });
      const bg = getComputedStyle(el).backgroundImage;
      return { label: el.textContent, parts, wash: bg.includes('linear-gradient') && bg.includes('88, 224, 140') };
    }),
  );
  for (const t of report) {
    expect(t.wash, `${t.label}: green wash`).toBe(true);
    for (const p of t.parts) {
      expect(p.off, `${t.label}: centred`).toBeLessThanOrEqual(1);
      expect(p.inside && !p.clipped, `${t.label}: fits`).toBe(true);
    }
  }
}
