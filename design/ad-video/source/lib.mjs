import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
export const W = new URL('.', import.meta.url).pathname;
export const BASE = 'http://localhost:8790';
export const seed = JSON.parse(readFileSync(W + 'seed.json'));
export const browser = await chromium.launch({ args: ['--lang=en-GB', '--font-render-hinting=none'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
export async function open(who = 'me', scale = 3) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: scale, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => {
    try { document.startViewTransition = undefined; } catch {}
    const set = () => { document.documentElement.style.setProperty('--safe-top', '54px'); document.documentElement.style.setProperty('--safe-bottom', '30px'); };
    if (document.documentElement) set();
    document.addEventListener('DOMContentLoaded', set);
  });
  await ctx.addCookies(Object.entries(seed[who]).map(([name, value]) => ({ name, value, url: BASE })));
  return ctx.newPage();
}
export async function api(who, method, path, body) {
  const cookie = Object.entries(seed[who]).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch(BASE + path, { method, headers: { cookie, origin: BASE, 'cf-connecting-ip': seed.ips[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status >= 300) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
}
export async function settle(page, extra = 500) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(extra);
}
export const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
