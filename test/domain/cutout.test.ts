import { describe, expect, it } from 'vitest';
import { edgeShare, findPieces, frameSquare, FRAME_PADDING, keptBounds, normaliseMask, pieceAt, zoomSquare, CUTOUT_MODEL } from '../../shared/domain/cutout';

// Remove background (D26): the maths on the AI's mask.

/** A size × size mask with filled rectangles (x, y, w, h in pixels), each at a value. */
function mask(size: number, rects: [number, number, number, number, number?][]) {
  const a = new Float32Array(size * size);
  for (const [x, y, w, h, v = 1] of rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) a[yy * size + xx] = v;
  return a;
}

describe('normaliseMask', () => {
  it('stretches the raw output to 0–1 and clears the faint haze', () => {
    const out = normaliseMask([2, 2.05, 2.5, 3]);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0); // 5% of the range: haze
    expect(out[2]).toBeCloseTo(0.5, 5);
    expect(out[3]).toBe(1);
  });
  it('a flat output is empty, not a solid square', () => {
    expect([...normaliseMask([0.4, 0.4, 0.4])]).toEqual([0, 0, 0]);
  });
});

describe('findPieces', () => {
  it('finds separate things, largest first, and drops specks', () => {
    const size = 100;
    const a = mask(size, [
      [10, 10, 20, 20], // 400 px
      [60, 50, 30, 30], // 900 px: the largest
      [95, 2, 2, 2], // a speck (4 px < 0.2% of 10,000)
    ]);
    const p = findPieces(a, size);
    expect(p.ids).toHaveLength(2);
    expect(pieceAt(p, 0.75, 0.65)).toBe(p.ids[0]);
    expect(pieceAt(p, 0.2, 0.2)).toBe(p.ids[1]);
    expect(p.owner[2 * size + 95]).toBe(0);
  });
  it('things touching diagonally only are separate; touching sides are one', () => {
    const size = 40;
    expect(findPieces(mask(size, [[0, 0, 10, 10], [10, 10, 10, 10]]), size).ids).toHaveLength(2);
    expect(findPieces(mask(size, [[0, 0, 10, 10], [10, 0, 10, 10]]), size).ids).toHaveLength(1);
  });
  it('soft edges belong to the thing they touch', () => {
    const size = 50;
    const a = mask(size, [[10, 10, 20, 20], [30, 10, 3, 20, 0.3]]); // a faint fringe on the right
    const p = findPieces(a, size);
    expect(p.owner[15 * size + 31]).toBe(p.ids[0]);
  });
});

describe('pieceAt', () => {
  it('forgives a tap just beside a thing, but not one far away', () => {
    const size = 100;
    const p = findPieces(mask(size, [[40, 40, 20, 20]]), size);
    expect(pieceAt(p, 0.62, 0.5)).toBe(p.ids[0]); // 2px outside
    expect(pieceAt(p, 0.95, 0.95)).toBe(0);
  });
});

describe('keptBounds and frameSquare', () => {
  it('frames only the kept things, square, centred, with room around', () => {
    const size = 100;
    const a = mask(size, [[10, 10, 10, 10], [50, 40, 30, 40]]);
    const p = findPieces(a, size);
    const big = p.ids[0]!;
    const b = keptBounds(p, a, new Set([big]))!;
    expect(b.x).toBeCloseTo(0.5, 2);
    expect(b.y).toBeCloseTo(0.4, 2);
    expect(b.w).toBeCloseTo(0.3, 1);
    expect(b.h).toBeCloseTo(0.4, 1);
    // A 1000 × 1000 photo: a 400px-tall thing → a square of 400 × padding, centred on it.
    const f = frameSquare(b, 1000, 1000);
    expect(f.side).toBeCloseTo(b.h * 1000 * FRAME_PADDING, 5);
    expect(f.x + f.side / 2).toBeCloseTo((b.x + b.w / 2) * 1000, 5);
    expect(f.y + f.side / 2).toBeCloseTo((b.y + b.h / 2) * 1000, 5);
  });
  it('ignores a stray hair when framing (fewer than 1% of the thing’s pixels)', () => {
    const size = 200;
    const a = mask(size, [[50, 50, 60, 60], [110, 80, 30, 1]]); // 30px of hair beside 3,600px of bud
    const p = findPieces(a, size);
    expect(p.ids).toHaveLength(1);
    const b = keptBounds(p, a, new Set(p.ids))!;
    expect(b.x + b.w).toBeLessThan(0.6);
  });
  it('nothing kept: no frame', () => {
    const a = mask(20, [[2, 2, 10, 10]]);
    expect(keptBounds(findPieces(a, 20), a, new Set())).toBeNull();
  });
  it('a frame may reach past the photo (that part is simply clear)', () => {
    const f = frameSquare({ x: 0, y: 0, w: 0.2, h: 0.2 }, 1000, 1000);
    expect(f.x).toBeLessThan(0);
  });
});

describe('zoom', () => {
  it('a square round the tap, moved (not shrunk) to stay inside the photo', () => {
    expect(zoomSquare(1600, 1200, 800, 600, 540)).toEqual({ x: 530, y: 330, side: 540 });
    expect(zoomSquare(1600, 1200, 10, 10, 540)).toEqual({ x: 0, y: 0, side: 540 });
    expect(zoomSquare(1600, 1200, 1590, 1190, 540)).toEqual({ x: 1060, y: 660, side: 540 });
    expect(zoomSquare(1600, 1200, 800, 600, 5000).side).toBe(1200);
  });
  it('tells when the tapped thing runs off the square (so it widens)', () => {
    const size = 100;
    const inside = findPieces(mask(size, [[30, 30, 40, 40]]), size);
    expect(edgeShare(inside, inside.ids[0]!)).toBe(0);
    const cut = findPieces(mask(size, [[0, 20, 100, 60]]), size);
    expect(edgeShare(cut, cut.ids[0]!)).toBeGreaterThan(0.2);
  });
});

describe('the model files', () => {
  it('are split in parts of the declared total size', async () => {
    const { statSync } = await import('node:fs');
    const sizes = Array.from({ length: CUTOUT_MODEL.parts }, (_, i) => statSync(new URL(`../../client/public/ai/${CUTOUT_MODEL.name}.part${i}.bin`, import.meta.url)).size);
    expect(sizes.reduce((s, n) => s + n, 0)).toBe(CUTOUT_MODEL.bytes);
    // Workers static assets serve files up to 25 MiB.
    for (const n of sizes) expect(n).toBeLessThanOrEqual(25 * 1024 * 1024);
  });
});
