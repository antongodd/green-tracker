// Renders the app icons (design brief §2: "opaque version on a dark green field";
// 180, 192, 512 and maskable 512) from the brief's leaf geometry, with Chromium.
// Run: PW_CHROMIUM=/path/to/chrome node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const LEAF =
  'M12 18.35C8.95 19.21 5.61 18.16 4.12 16.96C5.93 16.35 9.42 16.51 12 18.35Z M12 18.35C14.58 16.51 18.07 16.35 19.88 16.96C18.39 18.16 15.05 19.21 12 18.35Z M12 18.35C7.69 16.49 4.83 12.17 4.22 9.4C6.87 10.39 10.76 13.82 12 18.35Z M12 18.35C13.24 13.82 17.13 10.39 19.78 9.4C19.17 12.17 16.31 16.49 12 18.35Z M12 18.35C9.46 13.06 10.31 6.64 12 3.53C13.69 6.64 14.54 13.06 12 18.35Z M11.45 18.35H12.55V21.46H11.45Z';

/** `leafScale`: share of the square the 24-unit leaf box fills (smaller for maskable safe zone). */
const svg = (leafScale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#14532f"/><stop offset="1" stop-color="#06200f"/></radialGradient>
    <linearGradient id="leaf" x1="0" y1="3" x2="0" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b6ffd4"/><stop offset="0.55" stop-color="#58e08c"/><stop offset="1" stop-color="#2fb86a"/></linearGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  <g transform="translate(256 ${256 + 12 * leafScale * 512 / 24 * 0.04}) scale(${(leafScale * 512) / 24}) translate(-12 -12.5)"><path fill="url(#leaf)" d="${LEAF}"/></g>
</svg>`;

const targets = [
  { file: 'apple-touch-icon.png', size: 180, scale: 0.78 },
  { file: 'icon-192.png', size: 192, scale: 0.78 },
  { file: 'icon-512.png', size: 512, scale: 0.78 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.6 }, // leaf inside the 80% safe zone
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<style>html,body{margin:0;background:#06200f}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg(t.scale, false)}`);
  await page.screenshot({ path: `client/public/icons/${t.file}`, omitBackground: false });
}
await browser.close();
// A scalable favicon for browsers (rounded, same artwork).
writeFileSync('client/public/icons/favicon.svg', svg(0.78, true));
console.log('icons written');
