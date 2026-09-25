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

export interface TextBox { label: string; x: number; y: number; w: number; h: number; color: string; large: boolean }

/**
 * Readability over moving colour (axe can't judge text over a gradient): pauses every
 * animation at `steps` moments, photographs the screen with the text hidden (the
 * caller hides it), and returns each text box whose contrast with the worst pixel
 * behind it falls below 4.5:1 (3:1 for large text).
 */
export async function contrastFailures(page: Page, boxes: TextBox[], steps = 12): Promise<string[]> {
  const worst: string[] = [];
  for (let step = 0; step < steps; step++) {
    await page.evaluate((f) => {
      for (const a of document.getAnimations()) {
        const t = a.effect!.getTiming();
        a.pause();
        a.currentTime = Number(t.delay ?? 0) + f * Number(t.duration);
      }
    }, step / steps);
    const png = Buffer.from(await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 844 } })).toString('base64');
    const found = await page.evaluate(async ({ png, boxes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const k = img.width / 390;
      const lum = (r: number, g: number, b: number) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
      return boxes.map((b) => {
        const d = ctx.getImageData(Math.round(b.x * k), Math.round(b.y * k), Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))).data;
        const [fr = 0, fg = 0, fb = 0, fa = 1] = b.color.match(/[\d.]+/g)!.map(Number);
        let min = Infinity;
        for (let i = 0; i < d.length; i += 4) {
          const [br, bg, bb] = [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0];
          const f = [fr * fa + br * (1 - fa), fg * fa + bg * (1 - fa), fb * fa + bb * (1 - fa)];
          const [a, z] = [lum(f[0]!, f[1]!, f[2]!), lum(br, bg, bb)];
          min = Math.min(min, (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05));
        }
        return { ...b, ratio: min };
      });
    }, { png, boxes });
    for (const f of found) if (f.ratio < (f.large ? 3 : 4.5)) worst.push(`step ${step}: ${f.label} ${f.ratio.toFixed(2)}`);
  }
  return worst;
}
