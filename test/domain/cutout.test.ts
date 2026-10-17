import { describe, expect, it } from 'vitest';
import { edgeShare, findPieces, frameSquare, FRAME_PADDING, keptBounds, normaliseMask, pieceAt, zoomSquare, CUTOUT_MODEL, insideLoops, keepInside, LOOP_MARGIN, loopArea, loopRegion, realLoops, type Point } from '../../shared/domain/cutout';

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

// Draw round it (D54): loops drawn on the photo.
const circle = (cx: number, cy: number, r: number, n = 48): Point[] => Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * r, y: cy + Math.sin((i / n) * Math.PI * 2) * r }));
const square = (x: number, y: number, s: number): Point[] => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

describe('loops', () => {
  it('a tap or a line is not a loop; a real loop is', () => {
    expect(loopArea(square(0, 0, 10))).toBe(100);
    expect(realLoops([[{ x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], square(0, 0, 5), square(0, 0, 40)])).toEqual([square(0, 0, 40)]);
  });

  it('the AI is shown the part round the loops, with a margin, inside the photo', () => {
    expect(loopRegion([], 1000, 800)).toBeNull();
    const r = loopRegion([square(100, 200, 100)], 1000, 800)!;
    const m = 100 * LOOP_MARGIN;
    expect(r).toEqual({ x: 100 - m, y: 200 - m, w: 100 + 2 * m, h: 100 + 2 * m });
    // Two loops: one region round both. Near the edge: clipped to the photo.
    expect(loopRegion([square(0, 0, 50), square(900, 700, 100)], 1000, 800)).toEqual({ x: 0, y: 0, w: 1000, h: 800 });
  });

  it('marks the mask pixels inside the loops, and only those', () => {
    const region = { x: 0, y: 0, w: 100, h: 100 };
    const inside = insideLoops([circle(30, 50, 20), square(70, 10, 20)], region, 100);
    const at = (x: number, y: number) => inside[y * 100 + x];
    expect(at(30, 50)).toBe(1); // the circle's middle
    expect(at(30, 32)).toBe(1); // just inside its top
    expect(at(30, 25)).toBe(0); // just outside
    expect(at(55, 50)).toBe(0); // between the two
    expect(at(80, 20)).toBe(1); // the square
    expect(at(80, 40)).toBe(0);
    // About the circle's and the square's areas.
    const n = inside.reduce((s, v) => s + v, 0);
    expect(Math.abs(n - (Math.PI * 400 + 400))).toBeLessThan(40);
  });

  it('works in the region’s own pixels when the region is part of the photo, stretched', () => {
    // A 200 × 100 region from (400, 300), shown to the AI as a 50 × 50 mask.
    const inside = insideLoops([square(400, 300, 100)], { x: 400, y: 300, w: 200, h: 100 }, 50);
    expect(inside[10 * 50 + 10]).toBe(1); // left half: the loop
    expect(inside[10 * 50 + 40]).toBe(0); // right half: outside it
  });

  it('two touching things: only what’s inside the loop is kept', () => {
    // One "thing" to the AI (two touching blobs), 0–49 and 50–99 across.
    const alpha = mask(100, [[0, 20, 100, 60]]);
    const kept = keepInside(alpha, insideLoops([square(-5, 15, 52)], { x: 0, y: 0, w: 100, h: 100 }, 100));
    const p = findPieces(kept, 100);
    expect(p.ids).toHaveLength(1);
    const b = keptBounds(p, kept, new Set(p.ids))!;
    expect(b.x).toBeCloseTo(0, 2);
    expect(b.x + b.w).toBeLessThanOrEqual(0.48);
  });
});
