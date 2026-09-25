// Remove background (D26): the AI, run in a worker (worker.ts), and kept on the phone
// in its own cache after the first download (the service worker never deletes it).
import { CUTOUT_MODEL, cutoutPartUrl } from '../../../shared/domain/cutout';

/** The engine's file, copied from onnxruntime-web at build time (scripts/copy-ai-engine.mjs). */
export const ENGINE_URL = '/ai/ort-wasm-simd-1.17.3.wasm';
/** One cache per model: a new model is a new cache, and the old one is deleted once it works. */
export const AI_CACHE = `gt-ai-${CUTOUT_MODEL.name}`;
const partUrls = Array.from({ length: CUTOUT_MODEL.parts }, (_, i) => cutoutPartUrl(i));

/**
 * Tests replace the AI with a quick stand-in (set before the app loads): anything that
 * differs clearly from the photo's border colour counts as a thing. The real AI is
 * tested separately (test/e2e/cutout.spec.ts).
 */
const fake = () => typeof window !== 'undefined' && (window as unknown as { __gtFakeCutout?: boolean }).__gtFakeCutout === true;

/** Is the AI already on this phone (so no download is needed)? */
export async function aiOnDevice(): Promise<boolean> {
  if (fake()) return true;
  try {
    const cache = await caches.open(AI_CACHE);
    for (const url of [ENGINE_URL, ...partUrls]) if (!(await cache.match(url))) return false;
    return true;
  } catch {
    return false;
  }
}

export interface Engine {
  /** Downloads (if needed) and starts the AI. */
  load(progress: (got: number, total: number) => void): Promise<void>;
  /** RGBA pixels of a size × size image → the AI's raw mask (size × size). */
  run(pixels: Uint8ClampedArray, size: number): Promise<Float32Array>;
  /** Ends the worker, handing all its memory back. */
  close(): void;
}

export function createEngine(): Engine {
  return fake() ? fakeEngine() : workerEngine();
}

function workerEngine(): Engine {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  let pending: { resolve: (v: unknown) => void; reject: (e: Error) => void; progress?: (g: number, t: number) => void } | null = null;
  const ask = (msg: unknown, transfer: Transferable[] = [], progress?: (g: number, t: number) => void) =>
    new Promise<unknown>((resolve, reject) => {
      pending = { resolve, reject, progress };
      worker.postMessage(msg, transfer);
    });
  worker.onmessage = (e: MessageEvent<{ type: string; got?: number; total?: number; raw?: Float32Array; message?: string }>) => {
    const d = e.data;
    if (d.type === 'progress') return pending?.progress?.(d.got!, d.total!);
    const p = pending;
    pending = null;
    if (d.type === 'error') p?.reject(new Error(d.message));
    else p?.resolve(d.type === 'mask' ? d.raw : undefined);
  };
  worker.onerror = (e) => {
    const p = pending;
    pending = null;
    p?.reject(new Error(e.message || 'the background remover stopped'));
  };
  return {
    async load(progress) {
      await ask({ type: 'load', wasm: ENGINE_URL, parts: partUrls, bytes: CUTOUT_MODEL.bytes, cache: AI_CACHE }, [], progress);
      // It works: older models' caches can go.
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gt-ai-') && k !== AI_CACHE).map((k) => caches.delete(k))))
        .catch(() => {});
    },
    run: (pixels, size) => ask({ type: 'run', pixels, size }, [pixels.buffer]) as Promise<Float32Array>,
    close: () => worker.terminate(),
  };
}

function fakeEngine(): Engine {
  return {
    async load(progress) {
      progress(CUTOUT_MODEL.bytes, CUTOUT_MODEL.bytes);
    },
    async run(px, size) {
      // The border's average colour is "background".
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let k = 0; k < size; k++) {
        for (const i of [k, (size - 1) * size + k, k * size, k * size + size - 1]) {
          r += px[i * 4]!;
          g += px[i * 4 + 1]!;
          b += px[i * 4 + 2]!;
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      const out = new Float32Array(size * size);
      for (let i = 0; i < out.length; i++) {
        const d = Math.abs(px[i * 4]! - r) + Math.abs(px[i * 4 + 1]! - g) + Math.abs(px[i * 4 + 2]! - b);
        out[i] = d > 90 ? 1 : 0;
      }
      await new Promise((res) => setTimeout(res, (window as unknown as { __gtFakeCutoutDelay?: number }).__gtFakeCutoutDelay ?? 150));
      return out;
    },
    close() {},
  };
}
