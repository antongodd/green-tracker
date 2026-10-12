/// <reference types="node" />
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// The running version, shown on the About screen: package version + short commit.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
let commit = 'dev';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}
const version = `${pkg.version}+${commit}`;

/**
 * The dev site (D47, built with CLOUDFLARE_ENV=dev) is called "GT Dev" on the Home Screen and in
 * the tab title, so it's never mistaken for the live app; the live build is untouched.
 */
const devSite = process.env.CLOUDFLARE_ENV === 'dev';
const DEV_NAME = 'GT Dev';
function siteName(): Plugin {
  return {
    name: 'gt-site-name',
    transformIndexHtml: (html) =>
      devSite ? html.replace('<title>Green Tracker</title>', `<title>${DEV_NAME}</title>`).replace('content="Green Tracker"', `content="${DEV_NAME}"`) : html,
    closeBundle() {
      const file = new URL('./dist/client/manifest.webmanifest', import.meta.url);
      if (!devSite || !existsSync(file)) return;
      const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      writeFileSync(file, JSON.stringify({ ...manifest, name: DEV_NAME, short_name: DEV_NAME }, null, 2));
    },
  };
}

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [preact(), siteName(), cloudflare({ configPath: '../wrangler.jsonc' })],
});
