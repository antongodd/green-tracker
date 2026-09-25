// Copies the background remover's engine (D26) from onnxruntime-web into the app's
// public files before every build and dev run, under a name with its version, so a
// new engine is a new URL. Not committed: it comes from node_modules (package-lock).
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('node_modules/onnxruntime-web/package.json', root), 'utf8'));
const expected = '1.17.3'; // client/src/cutout/engine.ts ENGINE_URL
if (version !== expected) throw new Error(`onnxruntime-web is ${version}; update ENGINE_URL (and this check) to match`);
mkdirSync(new URL('client/public/ai/', root), { recursive: true });
copyFileSync(new URL('node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', root), new URL(`client/public/ai/ort-wasm-simd-${version}.wasm`, root));
