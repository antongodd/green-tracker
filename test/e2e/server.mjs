// Serves the built app (dist/) in workerd with a fresh local D1, for the
// end-to-end tests. Passkeys are bound to http://localhost:<port>.
import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const port = process.env.E2E_PORT ?? '8788';
const config = join(root, 'dist/green_tracker/wrangler.json');
const persist = join(root, '.wrangler/e2e');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };

rmSync(persist, { recursive: true, force: true });
execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'green-tracker', '--local', '--persist-to', persist, '--config', config], { cwd: root, env, stdio: 'ignore' });
const child = spawn(
  'npx',
  ['wrangler', 'dev', '--config', config, '--port', port, '--ip', '127.0.0.1', '--persist-to', persist, '--var', 'RP_ID:localhost', '--var', `ORIGIN:http://localhost:${port}`, '--var', 'SIGNUP_LIMIT_PER_HOUR:1000'],
  { cwd: root, env, stdio: 'inherit' },
);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (child.kill(sig), process.exit(0)));
child.on('exit', (code) => process.exit(code ?? 0));
