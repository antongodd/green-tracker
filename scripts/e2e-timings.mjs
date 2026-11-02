// Refreshes test/e2e/timings.json (D75) from a full browser test run's JSON report:
//   PLAYWRIGHT_JSON_OUTPUT_NAME=report.json npx playwright test --reporter=json,line
//   node scripts/e2e-timings.mjs report.json
// Seconds per test (its last try), keyed "file › describe › title"; tests the report didn't run are kept. Only the proportions matter: they balance the CI
// machines (scripts/e2e-shard.mjs).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../test/e2e/timings.json', import.meta.url);
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// Tests the report didn't run keep their old timing, so a partial run can't make the rest look quick.
const timings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
let timed = 0;
const walk = (suite, path) => {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests) {
      const last = t.results.at(-1); // the try that counted: a retry's first failure would double it
      if (!last) continue;
      timings[`${spec.file} › ${[...path, spec.title].join(' › ')}`] = Math.round(last.duration / 100) / 10;
      timed++;
    }
  for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
};
for (const f of report.suites) walk(f, []);
const sorted = Object.fromEntries(Object.entries(timings).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${timed} tests timed, ${Object.keys(sorted).length} in timings.json`);
