// Runs one CI machine's share of the browser tests (D75): node scripts/e2e-shard.mjs <n> <of> [core|full] (n from 1)
// The shares are balanced by time, from test/e2e/timings.json (seconds per test, measured), instead of Playwright's
// --shard, which splits by count and put every slow Look check on one machine. A file whose tests share state (most
// sign up once in beforeAll and build on each other) stays whole on one machine; a file in `mode: 'parallel'` is
// split test by test. Every machine works out the same split from the same checkout. A test missing from
// timings.json counts as DEFAULT seconds. Refresh the timings with scripts/e2e-timings.mjs. DRY=1 shows the split only.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const testDir = join(root, 'test/e2e');
const DEFAULT = 15;

/** The core set: the spec files named in package.json's test:e2e:core. */
export function coreFiles() {
  const script = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['test:e2e:core'];
  return [...script.matchAll(/test\/e2e\/(\S+\.spec\.ts)/g)].map((m) => m[1]);
}

/** Every test Playwright would run, as { file, title }: file relative to test/e2e, title with any describe names
 * before it, joined by ' › ' as --test-list and timings.json expect. */
function listTests(files) {
  const out = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json', ...files.map((f) => `test/e2e/${f}`)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const tests = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) tests.push({ file: spec.file, title: [...path, spec.title].join(' › ') });
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const file of JSON.parse(out).suites) walk(file, []);
  return tests;
}

/** Groups that must run on the same machine, each with its estimated seconds. */
export function groups(tests, timings, isParallel) {
  const byKey = new Map();
  for (const t of tests) {
    const key = isParallel(t.file) ? `${t.file} › ${t.title}` : t.file;
    const g = byKey.get(key) ?? { key, seconds: 0 };
    g.seconds += timings[`${t.file} › ${t.title}`] ?? DEFAULT;
    byKey.set(key, g);
  }
  return [...byKey.values()];
}

/** Longest first, each onto the machine with the least so far: the same answer on every machine. */
export function split(gs, of) {
  const shares = Array.from({ length: of }, () => ({ seconds: 0, keys: [] }));
  for (const g of [...gs].sort((a, b) => b.seconds - a.seconds || a.key.localeCompare(b.key))) {
    const least = shares.reduce((min, s) => (s.seconds < min.seconds ? s : min));
    least.seconds += g.seconds;
    least.keys.push(g.key);
  }
  return shares;
}

/** A file that runs its tests separately, each on its own: `test.describe.configure({ mode: 'parallel' })` at its top. */
export const isParallelSource = (source) => /^test\.describe\.configure\(\{\s*mode:\s*['"]parallel['"]/m.test(source);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [n, of, mode = 'full'] = process.argv.slice(2);
  const files = mode === 'core' ? coreFiles() : [];
  const timings = JSON.parse(readFileSync(join(testDir, 'timings.json'), 'utf8'));
  const parallel = new Map();
  const isParallel = (file) => {
    if (!parallel.has(file)) parallel.set(file, isParallelSource(readFileSync(join(testDir, file), 'utf8')));
    return parallel.get(file);
  };
  const tests = listTests(files);
  if (!tests.length) throw new Error('No browser tests found: nothing would be checked.');
  const shares = split(groups(tests, timings, isParallel), Number(of));
  shares.forEach((s, i) => console.log(`machine ${i + 1}: about ${Math.round(s.seconds)}s, ${s.keys.length} groups`));
  const mine = shares[Number(n) - 1];
  if (!mine.keys.length) {
    console.log('Nothing for this machine.');
    process.exit(0);
  }
  mkdirSync(join(root, '.playwright'), { recursive: true });
  const list = join(root, '.playwright/test-list.txt');
  writeFileSync(list, mine.keys.join('\n') + '\n');
  console.log(`machine ${n} of ${of} (${mode}):\n  ${mine.keys.join('\n  ')}`);
  if (process.env.DRY) process.exit(0); // DRY=1: show the split, run nothing
  try {
    execFileSync('npx', ['playwright', 'test', '--test-list', list], { cwd: root, stdio: 'inherit' });
  } catch (e) {
    process.exit(e.status ?? 1); // Playwright has said what failed
  }
}
