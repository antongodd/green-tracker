import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D75: what CI checks (scripts/ci-plan.mjs) and how the browser tests are shared between its machines
// (scripts/e2e-shard.mjs). The scripts are plain JavaScript run by node, so they're loaded untyped here.
const ciPlan: any = await import('../../scripts/ci-plan.mjs' as string);
const shard: any = await import('../../scripts/e2e-shard.mjs' as string);

const facts = (changed: string[], releaseMerge = false) => ({ changedFiles: () => changed, isReleaseMerge: () => releaseMerge });
const mode = (run: object, f = facts(['client/src/main.tsx'])) => ciPlan.plan(run, f)[0];

describe('what CI checks (D75)', () => {
  it('a pull request into dev gets the quick check, into main every test', () => {
    expect(mode({ event: 'pull_request', baseRef: 'dev' })).toBe('core');
    expect(mode({ event: 'pull_request', baseRef: 'main' })).toBe('full');
  });

  it('notes only skip the tests; anything else that changes runs them', () => {
    expect(mode({ event: 'pull_request', baseRef: 'dev' }, facts(['CLAUDE.md', 'SPEC.md', 'design/brief.md']))).toBe('skip');
    expect(mode({ event: 'pull_request', baseRef: 'main' }, facts(['CLAUDE.md']))).toBe('skip');
    expect(mode({ event: 'pull_request', baseRef: 'dev' }, facts(['CLAUDE.md', 'package.json']))).toBe('core');
    expect(mode({ event: 'pull_request', baseRef: 'dev' }, facts(['scripts/ci-plan.mjs']))).toBe('core');
    expect(mode({ event: 'pull_request', baseRef: 'dev' }, facts([]))).toBe('core');
  });

  it('a push is not tested again when its pull request tested that code; anything else on main runs every test', () => {
    expect(mode({ event: 'push', ref: 'refs/heads/dev' })).toBe('skip');
    expect(mode({ event: 'push', ref: 'refs/heads/main' }, facts([], true))).toBe('skip');
    expect(mode({ event: 'push', ref: 'refs/heads/main' }, facts([], false))).toBe('full');
    expect(mode({ event: 'workflow_dispatch', ref: 'refs/heads/main' })).toBe('full');
  });
});

describe('sharing the browser tests between machines (D75)', () => {
  const tests = [
    { file: 'a.spec.ts', title: 'one' },
    { file: 'a.spec.ts', title: 'two' },
    { file: 'looks.spec.ts', title: 'x' },
    { file: 'looks.spec.ts', title: 'y' },
    { file: 'looks.spec.ts', title: 'z' },
    { file: 'new.spec.ts', title: 'not timed yet' },
  ];
  const timings = { 'a.spec.ts › one': 10, 'a.spec.ts › two': 20, 'looks.spec.ts › x': 50, 'looks.spec.ts › y': 40, 'looks.spec.ts › z': 30 };
  const gs = shard.groups(tests, timings, (f: string) => f === 'looks.spec.ts');

  it('a file that shares state stays whole; a parallel file splits test by test; an untimed test still counts', () => {
    expect(gs).toEqual([
      { key: 'a.spec.ts', seconds: 30 },
      { key: 'looks.spec.ts › x', seconds: 50 },
      { key: 'looks.spec.ts › y', seconds: 40 },
      { key: 'looks.spec.ts › z', seconds: 30 },
      { key: 'new.spec.ts', seconds: 15 },
    ]);
  });

  it('every group lands on exactly one machine, balanced, and every machine works out the same split', () => {
    const shares = shard.split(gs, 3);
    expect(shares.flatMap((s: { keys: string[] }) => s.keys).sort()).toEqual(gs.map((g: { key: string }) => g.key).sort());
    expect(shares.map((s: { seconds: number }) => s.seconds)).toEqual([50, 55, 60]);
    expect(shard.split([...gs].reverse(), 3)).toEqual(shares);
  });

  it("a file is split test by test only when its top says mode: 'parallel'", () => {
    expect(shard.isParallelSource("import x from 'y';\ntest.describe.configure({ mode: 'parallel' });")).toBe(true);
    expect(shard.isParallelSource('test.describe.configure({ mode: "parallel" });')).toBe(true);
    expect(shard.isParallelSource("// one account per worker, mode: 'parallel'\ntest('a', () => {});")).toBe(false);
    expect(shard.isParallelSource("test.describe('x', () => {\n  test.describe.configure({ mode: 'parallel' });\n});")).toBe(false);
  });

  it('the core set names spec files that exist', () => {
    const core: string[] = shard.coreFiles();
    expect(core.length).toBeGreaterThan(5);
    for (const f of core) expect(() => readFileSync(new URL(`../e2e/${f}`, import.meta.url))).not.toThrow();
  });
});
