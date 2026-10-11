// Starts the Worker in workerd (wrangler dev) with a fresh local D1, for the API tests:
// one with Smokes on (as on the dev site) and one with it off (as on live), D46.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

const root = new URL('../..', import.meta.url).pathname;
const config = join(root, 'test/api/wrangler.test.jsonc');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };

let children: ChildProcess[] = [];
let dirs: string[] = [];

/** One Worker on a fresh local D1/R2; `vars` override the config's (e.g. SMOKES off, as on the live site). */
async function start(vars: Record<string, string> = {}): Promise<{ base: string; persist: string }> {
  const persist = mkdtempSync(join(tmpdir(), 'gt-api-'));
  dirs.push(persist);
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'green-tracker', '--local', '--persist-to', persist, '--config', config], {
    cwd: root,
    env,
    stdio: 'pipe',
  });
  const port = 18_000 + Math.floor(Math.random() * 2000);
  const varArgs = Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]);
  const child = spawn('npx', ['wrangler', 'dev', '--config', config, '--port', String(port), '--ip', '127.0.0.1', '--persist-to', persist, '--log-level', 'error', ...varArgs], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  children.push(child);
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`wrangler dev did not start:\n${output}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  return { base, persist };
}

export async function setup(project: TestProject) {
  // The two can't share a port pick: start one after the other.
  const main = await start();
  const live = await start({ SMOKES: 'off', SITE: 'live' });
  project.provide('apiBase', main.base);
  project.provide('persistDir', main.persist);
  project.provide('liveApiBase', live.base);
}

export async function teardown() {
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
  }
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

declare module 'vitest' {
  export interface ProvidedContext {
    apiBase: string;
    /** Local D1 / R2 storage, for tests that check what's really stored. */
    persistDir: string;
    /** A second Worker with Smokes off, as on the live site (D46). */
    liveApiBase: string;
  }
}
