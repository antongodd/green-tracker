/// <reference types="node" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// The running version, shown on the About screen: package version + short commit.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
let commit = 'dev';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}
const version = `${pkg.version}+${commit}`;

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [preact(), cloudflare({ configPath: '../wrangler.jsonc' })],
});
