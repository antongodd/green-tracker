// Films the real app (the private local copy) one frame per 1/30 s. Every CSS animation and transition is held
// and stepped by hand, so each frame is exact and the footage is smooth however long a screenshot takes.
import { browser, open, api, BASE, seed, W, center, ease } from './lib.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
export { browser, open, api, BASE, seed, W, center, ease };
export const FPS = 30;

export async function shot(name, page) {
  const dir = `${W}film/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];           // one per frame: finger {x,y,down} or null
  const marks = {};
  let n = 0;
  let finger = null;
  await page.evaluate(() => {
    window.__seen = new Map();
    window.__step = (T) => {
      for (const a of document.getAnimations()) {
        const tm = a.effect?.getComputedTiming?.() ?? {};
        if (!window.__seen.has(a)) { window.__seen.set(a, { t0: T, base: a.currentTime ?? 0 }); }
        const s = window.__seen.get(a);
        const inf = tm.iterations === Infinity;
        try {
          if (a.playState !== 'paused' && a.playState !== 'finished') a.pause();
          const want = inf ? T : s.base + (T - s.t0);
          if (!inf && want >= (tm.endTime ?? 0)) { a.finish(); continue; }
          a.currentTime = want;
        } catch {}
      }
    };
  });
  const s = {
    get n() { return n; },
    mark(k, v = n) { marks[k] = v; },
    finger(f) { finger = f; },
    // k frames: step every animation, then photograph.
    async run(k = 1, each) {
      for (let i = 0; i < k; i++) {
        if (each) await each(i, k);
        await page.evaluate((T) => window.__step(T), (n * 1000) / FPS).catch(async () => { await page.waitForLoadState('domcontentloaded'); });
        await page.screenshot({ path: `${dir}/${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
        frames.push(finger ? { ...finger } : null);
        n++;
      }
    },
    // The finger glides to `to` over k frames (lifted).
    async glide(to, k = 10) {
      const a = finger ?? { x: to.x + 60, y: to.y + 140 };
      await s.run(k, (i) => { const t = ease((i + 1) / k); finger = { x: a.x + (to.x - a.x) * t, y: a.y + (to.y - a.y) * t, down: false }; });
    },
    // Glide to a locator, press for `hold` frames, do the action, lift.
    async tap(loc, { glide = 10, hold = 3, act, after = 0 } = {}) {
      const c = await center(loc);
      await s.glide(c, glide);
      finger = { ...c, down: true };
      await s.run(hold);
      if (act) await act(); else await loc.click();
      await reinstall();
      finger = { ...c, down: false };
      if (after) await s.run(after);
    },
    async scroll(toY, k = 20, sel = null) {
      const from = await page.evaluate((sel) => (sel ? document.querySelector(sel).scrollTop : scrollY), sel);
      await s.run(k, async (i) => { const y = from + (toY - from) * ease((i + 1) / k); await page.evaluate(([sel, y]) => (sel ? (document.querySelector(sel).scrollTop = y) : scrollTo(0, y)), [sel, y]); });
    },
    save() { writeFileSync(`${W}film/${name}.json`, JSON.stringify({ n, marks, frames })); console.log(name, n, 'frames', (n / FPS).toFixed(2) + 's', marks); },
  };
  async function reinstall() { await page.evaluate(() => { if (!window.__seen) window.__seen = new Map(); }).catch(() => {}); }
  return s;
}
// Loaded, entrance animations over, fonts and pictures in.
export async function ready(page, sel) {
  if (sel) await page.locator(sel).first().waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every((i) => i.complete));
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}
