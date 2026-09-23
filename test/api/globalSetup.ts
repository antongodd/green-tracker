// Starts the Worker in workerd (wrangler dev) with a fresh local D1, for the API tests.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

const root = new URL('../..', import.meta.url).pathname;
const config = join(root, 'test/api/wrangler.test.jsonc');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };

let child: ChildProcess | undefined;
let persist: string | undefined;

export async function setup(project: TestProject) {
  persist = mkdtempSync(join(tmpdir(), 'gt-api-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'green-tracker', '--local', '--persist-to', persist, '--config', config], {
    cwd: root,
    env,
    stdio: 'pipe',
  });
  const port = 18_000 + Math.floor(Math.random() * 2000);
  child = spawn('npx', ['wrangler', 'dev', '--config', config, '--port', String(port), '--ip', '127.0.0.1', '--persist-to', persist, '--log-level', 'error'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
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
  project.provide('apiBase', base);
}

export async function teardown() {
  if (child?.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  if (persist) rmSync(persist, { recursive: true, force: true });
}

declare module 'vitest' {
  export interface ProvidedContext {
    apiBase: string;
  }
}
