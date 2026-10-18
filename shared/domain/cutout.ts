// Remove background (D26): the AI (client/src/cutout/) turns a photo into a mask of
// "things"; everything else here is plain maths on that mask, shared so it can be
// tested without a browser. Masks are square, CUTOUT_SIZE × CUTOUT_SIZE, row by row,
// covering the whole source image (stretched to a square, as the AI sees it).

/** The model's files (client/public/ai/, made by scripts/make-cutout-model.py). The name holds its hash. */
export const CUTOUT_MODEL = { name: 'isnet-bud-6045f463', parts: 4, bytes: 46703493 } as const;
export const cutoutPartUrl = (i: number) => `/ai/${CUTOUT_MODEL.name}.part${i}.bin`;

/** The size the AI works at: same accuracy as 1024 on the test scenes, about 40% of the memory. */
export const CUTOUT_SIZE = 768;
/** The framed cut-out (the photo's "cropped" image) is at most this big; the thumbnail as usual. */
export const CUTOUT_MAX_EDGE = 1024;
/** Room around the bud when framing: the square is this much bigger than the bud. */
export const FRAME_PADDING = 1.16;
/** Zooming in on a tap (a bud lying on a tray): a square this fraction of the photo's short side… */
export const ZOOM_START = 0.45;
/** …widened by this much, at most this many times, while the bud still reaches its edge. */
export const ZOOM_GROW = 1.5;
export const ZOOM_TRIES = 3;
/** The bud "reaches the edge" when more than this share of the square's border is bud. */
export const ZOOM_EDGE = 0.01;

/** Separate things smaller than this share of the image are specks, not things. */
const MIN_PIECE = 0.002;
/** A pixel counts as "in" a thing above this mask value. */
const SOLID = 0.5;

/**
 * The AI's raw output → a mask from 0 to 1: stretched to use the full range (its
 * output isn't calibrated), then the faintest 10% dropped and the rest spread out,
 * which clears haze without hardening the soft edges.
 */
export function normaliseMask(raw: ArrayLike<number>): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Float32Array(raw.length);
  const span = hi - lo;
  if (!(span > 1e-6)) return out;
  for (let i = 0; i < raw.length; i++) out[i] = Math.min(1, Math.max(0, ((raw[i]! - lo) / span - 0.1) / 0.8));
  return out;
}

export interface Pieces {
  size: number;
  /** For each pixel, the thing it belongs to (0 = background). Soft edges belong to the thing they touch. */
  owner: Int32Array;
  /** The things, largest first. */
  ids: number[];
}

/** Splits a mask into separate things (4-connected), dropping specks. */
export function findPieces(alpha: Float32Array, size: number): Pieces {
  const n = size * size;
  const owner = new Int32Array(n);
  const stack = new Int32Array(n);
  const areas = [0];
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (owner[i] || alpha[i]! <= SOLID) continue;
    next++;
    let sp = 0;
    let area = 0;
    stack[sp++] = i;
    owner[i] = next;
    while (sp) {
      const p = stack[--sp]!;
      area++;
      const x = p % size;
      const visit = (q: number) => {
        if (!owner[q] && alpha[q]! > SOLID) {
          owner[q] = next;
          stack[sp++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < size - 1) visit(p + 1);
      if (p >= size) visit(p - size);
      if (p < n - size) visit(p + size);
    }
    areas.push(area);
  }
  const min = n * MIN_PIECE;
  for (let i = 0; i < n; i++) if (owner[i] && areas[owner[i]!]! < min) owner[i] = 0;
  // Soft edge pixels (faint but not background) join the thing they touch.
  for (let pass = 0; pass < 8; pass++) {
    let changed = 0;
    const was = owner.slice();
    for (let i = 0; i < n; i++) {
      if (was[i] || alpha[i]! < 0.02) continue;
      const x = i % size;
      const o = (x > 0 && was[i - 1]) || (x < size - 1 && was[i + 1]) || (i >= size && was[i - size]) || (i < n - size && was[i + size]) || 0;
      if (o) {
        owner[i] = o;
        changed++;
      }
    }
    if (!changed) break;
  }
  const ids: number[] = [];
  for (let k = 1; k < areas.length; k++) if (areas[k]! >= min) ids.push(k);
  ids.sort((a, b) => areas[b]! - areas[a]! || a - b);
  return { size, owner, ids };
}

/** The thing at (x, y) in 0–1 of the image, or the nearest one within `reach` (0–1); 0 if none. */
export function pieceAt(p: Pieces, x: number, y: number, reach = 0.04): number {
  const s = p.size;
  const mx = Math.floor(x * s);
  const my = Math.floor(y * s);
  const r = Math.ceil(reach * s);
  let best = 0;
  let bd = Infinity;
  for (let yy = Math.max(0, my - r); yy <= Math.min(s - 1, my + r); yy++) {
    for (let xx = Math.max(0, mx - r); xx <= Math.min(s - 1, mx + r); xx++) {
      const o = p.owner[yy * s + xx]!;
      if (!o) continue;
      const d = (xx - mx) ** 2 + (yy - my) ** 2;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  }
  return best;
}

/** How much of a thing lies on the image's border (0–1 of the border's length): it's bigger than the image. */
export function edgeShare(p: Pieces, id: number): number {
  const s = p.size;
  let n = 0;
  for (let k = 0; k < s; k++) {
    if (p.owner[k] === id) n++;
    if (p.owner[(s - 1) * s + k] === id) n++;
    if (p.owner[k * s] === id) n++;
    if (p.owner[k * s + s - 1] === id) n++;
  }
  return n / (4 * s);
}

/** A box in 0–1 of the image. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the kept things are (0–1 of the image), ignoring the outermost 1% of their
 * pixels each way, so a stray hair doesn't pull the frame. Null if nothing is kept.
 */
export function keptBounds(p: Pieces, alpha: Float32Array, kept: ReadonlySet<number>): Box | null {
  const s = p.size;
  const cols = new Uint32Array(s);
  const rows = new Uint32Array(s);
  let total = 0;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (kept.has(p.owner[i]!) && alpha[i]! > SOLID) {
        cols[x]!++;
        rows[y]!++;
        total++;
      }
    }
  }
  if (total < 20) return null;
  const range = (h: Uint32Array) => {
    const cut = total * 0.01;
    let lo = 0;
    for (let a = 0; lo < s; lo++) if ((a += h[lo]!) > cut) break;
    let hi = s - 1;
    for (let a = 0; hi > 0; hi--) if ((a += h[hi]!) > cut) break;
    return [lo / s, (hi + 1) / s] as const;
  };
  const [x0, x1] = range(cols);
  const [y0, y1] = range(rows);
  return { x: x0, y: y0, w: Math.max(1 / s, x1 - x0), h: Math.max(1 / s, y1 - y0) };
}

/**
 * The square the cut-out is framed in, in pixels of a W × H image: centred on the
 * kept things with FRAME_PADDING of room. It may reach past the image's edges
 * (that part is simply transparent).
 */
export function frameSquare(b: Box, width: number, height: number): { x: number; y: number; side: number } {
  const w = b.w * width;
  const h = b.h * height;
  const side = Math.max(w, h) * FRAME_PADDING;
  const cx = (b.x + b.w / 2) * width;
  const cy = (b.y + b.h / 2) * height;
  return { x: cx - side / 2, y: cy - side / 2, side };
}

/** A square of `side` pixels centred on a tap, moved (not shrunk) to stay inside a W × H image. */
export function zoomSquare(width: number, height: number, tx: number, ty: number, side: number): { x: number; y: number; side: number } {
  const s = Math.min(side, width, height);
  return { x: Math.max(0, Math.min(width - s, tx - s / 2)), y: Math.max(0, Math.min(height - s, ty - s / 2)), side: s };
}

// Draw round it (D54, 0.46.0): loops drawn on the photo, in its pixels.

export interface Point {
  x: number;
  y: number;
}
/** Room around the loops when showing the AI just that part: this share of their larger side. */
export const LOOP_MARGIN = 0.08;
/** A loop must have at least this many points and enclose at least this many square pixels to count. */
const LOOP_MIN_POINTS = 3;
const LOOP_MIN_AREA = 100;

/** A loop's area (shoelace; self-crossing loops count their net area). */
export function loopArea(loop: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]!;
    const q = loop[(i + 1) % loop.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** The loops worth keeping: a tap or a scribble with no inside doesn't count. */
export const realLoops = (loops: readonly (readonly Point[])[]): Point[][] => loops.filter((l) => l.length >= LOOP_MIN_POINTS && loopArea(l) >= LOOP_MIN_AREA).map((l) => [...l]);

/**
 * The part of a W × H photo the AI is shown for these loops: round them all, with
 * LOOP_MARGIN of room, inside the photo. Null when there's no loop.
 */
export function loopRegion(loops: readonly (readonly Point[])[], width: number, height: number): { x: number; y: number; w: number; h: number } | null {
  const pts = loops.flat();
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m = Math.max(x1 - x0, y1 - y0) * LOOP_MARGIN;
  const x = Math.max(0, Math.floor(x0 - m));
  const y = Math.max(0, Math.floor(y0 - m));
  const w = Math.min(width, Math.ceil(x1 + m)) - x;
  const h = Math.min(height, Math.ceil(y1 + m)) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/**
 * Which pixels of a size × size mask (covering `region` of the photo, stretched) lie
 * inside any loop: 1 inside, 0 outside. Row by row, filling between the loop's
 * crossings (even-odd within a loop; loops add up).
 */
export function insideLoops(loops: readonly (readonly Point[])[], region: { x: number; y: number; w: number; h: number }, size: number): Uint8Array {
  const inside = new Uint8Array(size * size);
  for (const loop of loops) {
    for (let row = 0; row < size; row++) {
      const py = region.y + ((row + 0.5) / size) * region.h;
      const xs: number[] = [];
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]!;
        const b = loop[(i + 1) % loop.length]!;
        if (a.y <= py !== b.y <= py) xs.push(a.x + ((py - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil(((xs[k]! - region.x) / region.w) * size - 0.5));
        const to = Math.min(size - 1, Math.floor(((xs[k + 1]! - region.x) / region.w) * size - 0.5));
        for (let col = from; col <= to; col++) inside[row * size + col] = 1;
      }
    }
  }
  return inside;
}

/** The AI's mask with everything outside the loops dropped. */
export function keepInside(alpha: Float32Array, inside: Uint8Array): Float32Array {
  const out = new Float32Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) if (inside[i]) out[i] = alpha[i]!;
  return out;
}
