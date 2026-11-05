import { chromium } from 'playwright';
const v = process.argv[2] === 'v';
const times = process.argv.slice(3).map(Number);
const W = new URL('.', import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: v ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8899/compose.html' + (v ? '?v=1' : ''));
await p.evaluate(() => window.ready);
for (const t of times) { await p.evaluate((t) => window.render(t), t); await p.waitForTimeout(50); await p.screenshot({ path: `${W}s-${v ? 'v' : 'h'}-${t}.png` }); }
await b.close();
