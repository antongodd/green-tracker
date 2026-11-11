// Single moments, to check: node stills.mjs v|h <frame> <frame> …  → stills/<v|h>-<frame>.jpg (and a sheet)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const v = process.argv[2] === 'v';
const frames = process.argv.slice(3).map(Number);
const W = new URL('.', import.meta.url).pathname;
mkdirSync(W + 'stills', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: v ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto('http://localhost:8899/compose.html' + (v ? '?v=1' : ''));
await p.evaluate(() => window.ready);
for (const f of frames) { await p.evaluate((t) => window.render(t), f / 30); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await p.screenshot({ path: `${W}stills/${v ? 'v' : 'h'}-${f}.jpg`, type: 'jpeg', quality: 85 }); }
await b.close();
