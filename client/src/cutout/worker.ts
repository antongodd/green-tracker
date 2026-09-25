// Remove background (D26): the AI runs here, in its own worker, so the screen keeps
// moving while it works, and all of its memory (a few hundred MB while cutting out) is
// handed back the moment the flow closes and the worker is ended.
//
// Messages in:  { type: 'load', wasm, parts, bytes, cache }  then  { type: 'run', pixels, size }
// Messages out: { type: 'progress', got, total }, { type: 'ready' }, { type: 'mask', raw }, { type: 'error', message }
import * as ort from 'onnxruntime-web/wasm';

type In = { type: 'load'; wasm: string; parts: string[]; bytes: number; cache: string } | { type: 'run'; pixels: Uint8ClampedArray; size: number };

const ctx = self as unknown as { postMessage(m: unknown, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<In>) => void) | null };
let session: ort.InferenceSession | null = null;

/** A file from the phone's AI cache, else downloaded (and kept there), reporting bytes as they arrive. */
async function fetchKept(url: string, cache: Cache | null, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const hit = await cache?.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    onBytes(buf.byteLength);
    return buf;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const keep = cache?.put(url, res.clone()).catch(() => {});
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(value.length);
  }
  await keep;
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

async function load(m: Extract<In, { type: 'load' }>) {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(m.cache);
  } catch {
    // No Cache Storage (e.g. a private window): download each time.
  }
  let got = 0;
  const bump = (n: number) => {
    got += n;
    ctx.postMessage({ type: 'progress', got: Math.min(got, m.bytes), total: m.bytes });
  };
  // The engine's own file first: kept in the same cache, from which the service worker serves it.
  await fetchKept(m.wasm, cache, () => {});
  const model = new Uint8Array(m.bytes);
  let at = 0;
  for (const part of m.parts) {
    const buf = new Uint8Array(await fetchKept(part, cache, bump));
    if (at + buf.length > m.bytes) throw new Error('the download was the wrong size');
    model.set(buf, at);
    at += buf.length;
  }
  if (at !== m.bytes) throw new Error('the download was incomplete');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': new URL(m.wasm, self.location.origin).href };
  // No memory arena or pattern planning: both hold on to peak-sized buffers (measured: ~300 MB more).
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', enableCpuMemArena: false, enableMemPattern: false });
  ctx.postMessage({ type: 'ready' });
}

async function run(m: Extract<In, { type: 'run' }>) {
  if (!session) throw new Error('not ready');
  const n = m.size * m.size;
  const input = new Float32Array(3 * n);
  const px = m.pixels;
  for (let i = 0; i < n; i++) {
    input[i] = px[i * 4]! / 255 - 0.5;
    input[n + i] = px[i * 4 + 1]! / 255 - 0.5;
    input[2 * n + i] = px[i * 4 + 2]! / 255 - 0.5;
  }
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, m.size, m.size]) };
  const out = await session.run(feeds);
  const raw = new Float32Array(out[session.outputNames[0]!]!.data as Float32Array);
  for (const t of Object.values(out)) t.dispose?.();
  ctx.postMessage({ type: 'mask', raw }, [raw.buffer]);
}

ctx.onmessage = (e) => {
  const job = e.data.type === 'load' ? load(e.data) : run(e.data);
  job.catch((err: unknown) => ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
};
