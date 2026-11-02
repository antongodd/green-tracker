// Refreshes test/e2e/timings.json (D75) from a full browser test run's JSON report:
//   PLAYWRIGHT_JSON_OUTPUT_NAME=report.json npx playwright test --reporter=json,line
//   node scripts/e2e-timings.mjs report.json
// Seconds per test (all tries added up), keyed "file › title". Only the proportions matter: they balance the CI
// machines (scripts/e2e-shard.mjs).
import { readFileSync, writeFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const timings = {};
const walk = (suite) => {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests) timings[`${spec.file} › ${spec.title}`] = Math.round(t.results.reduce((s, r) => s + r.duration, 0) / 100) / 10;
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of report.suites) walk(suite);
const sorted = Object.fromEntries(Object.entries(timings).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('../test/e2e/timings.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} tests timed`);
