// Fallback deploy for environments where the Workers static-assets upload is
// unavailable (e.g. behind a proxy that rewrites the upload session's auth
// header). Embeds the built client files in the Worker bundle and serves them
// with the same routing as wrangler.jsonc: /api/* → app, otherwise an exact
// file, otherwise index.html (single-page-application). Run after `vite build`.
//
// The normal path is `npm run deploy`; use this only when that fails at
// "workers/assets/upload -> 401".
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const clientDir = join(dist, 'client');
const outDir = join(dist, 'embedded');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// The same security headers as client/public/_headers (its `/*` block).
function securityHeaders() {
  const text = readFileSync(join(root, 'client/public/_headers'), 'utf8');
  const headers = {};
  let inAll = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    if (!/^\s/.test(line)) inAll = line.trim() === '/*';
    else if (inAll) {
      const i = line.indexOf(':');
      headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  if (!headers['content-security-policy']) throw new Error('No CSP found in client/public/_headers');
  return headers;
}

const files = {};
for (const p of walk(clientDir)) {
  const path = '/' + relative(clientDir, p);
  if (path === '/.assetsignore' || path === '/_headers') continue;
  // The background remover (D26, ~57 MB) can't fit in a Worker bundle: this fallback
  // deploy leaves it out, so Remove background can't download there.
  if (path.startsWith('/ai/')) continue;
  const type = TYPES[extname(p)];
  if (!type) throw new Error(`No content type for ${path}; add it to TYPES`);
  files[path] = { type, b64: readFileSync(p).toString('base64') };
}
if (!files['/index.html']) throw new Error('dist/client/index.html missing — run the build first');

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'files.js'), `export const FILES = ${JSON.stringify(files)};\n`);
writeFileSync(
  join(outDir, 'entry.js'),
  `import app from '../green_tracker/index.js';
import { FILES } from './files.js';

const SECURITY = ${JSON.stringify(securityHeaders())};

const decoded = new Map();
function body(path) {
  let b = decoded.get(path);
  if (!b) {
    b = Uint8Array.from(atob(FILES[path].b64), (c) => c.charCodeAt(0));
    decoded.set(path, b);
  }
  return b;
}

function serveStatic(request) {
  const { pathname } = new URL(request.url);
  const path = FILES[pathname] ? pathname : '/index.html';
  const immutable = path.startsWith('/assets/');
  return new Response(request.method === 'HEAD' ? null : body(path), {
    headers: {
      ...SECURITY,
      'content-type': FILES[path].type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  });
}

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const assets = { fetch: (r) => serveStatic(new Request(r)) };
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return app.fetch(request, { ...env, ASSETS: assets }, ctx);
    }
    return serveStatic(request);
  },
};
`,
);

// Same Worker config as the build output, minus the assets upload.
const built = JSON.parse(readFileSync(join(dist, 'green_tracker', 'wrangler.json'), 'utf8'));
const config = {
  name: built.name,
  account_id: built.account_id,
  main: 'entry.js',
  compatibility_date: built.compatibility_date,
  compatibility_flags: built.compatibility_flags,
  d1_databases: built.d1_databases.map((d) => ({ ...d, migrations_dir: '../../migrations' })),
  r2_buckets: built.r2_buckets,
  vars: built.vars,
  observability: built.observability,
};
writeFileSync(join(outDir, 'wrangler.json'), JSON.stringify(config, null, 2));

console.log(`Embedded ${Object.keys(files).length} client files; deploying…`);
execFileSync('npx', ['wrangler', 'deploy', '--config', join(outDir, 'wrangler.json')], {
  stdio: 'inherit',
  cwd: root,
});
