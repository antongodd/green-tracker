import { describe, expect, it } from 'vitest';
import { aimAt, HOVER_LEAN_DEG, HOVER_MOVES, LEAN_DEG, leanFor, wantsLight } from '../../shared/domain/touch';

// Soft light (D101): where the glow sits and which way a photo leans.
describe('touch', () => {
  const box = { left: 100, top: 200, width: 300, height: 100 };

  it('puts the glow where the finger is, kept inside the thing', () => {
    expect(aimAt(box, 250, 250)).toEqual({ x: 150, y: 50, lx: 0, ly: 0 });
    expect(aimAt(box, 100, 200)).toEqual({ x: 0, y: 0, lx: -1, ly: -1 });
    expect(aimAt(box, 999, -50)).toEqual({ x: 300, y: 0, lx: 1, ly: -1 });
  });

  it('copes with a thing that has no size yet', () => {
    const a = aimAt({ left: 0, top: 0, width: 0, height: 0 }, 5, 5);
    expect(Number.isFinite(a.lx) && Number.isFinite(a.ly)).toBe(true);
  });

  it('leans towards the finger: the edge you press goes in', () => {
    expect(leanFor(aimAt(box, 400, 250))).toEqual({ rotateX: 0, rotateY: LEAN_DEG }); // right edge
    expect(leanFor(aimAt(box, 250, 200))).toEqual({ rotateX: LEAN_DEG, rotateY: 0 }); // top edge
    expect(leanFor(aimAt(box, 100, 300))).toEqual({ rotateX: -LEAN_DEG, rotateY: -LEAN_DEG }); // bottom left
    expect(leanFor(aimAt(box, 250, 250))).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it('stays gentle (Anton picked B), and gentler still with a mouse', () => {
    expect(LEAN_DEG).toBeLessThanOrEqual(4);
    expect(HOVER_LEAN_DEG).toBeLessThan(LEAN_DEG);
    expect(HOVER_MOVES).toBeGreaterThan(1); // one jump of the pointer (a test's click) never lights anything
  });

  it('gives no glow to small things like icons and switches', () => {
    expect(wantsLight(44, 44)).toBe(false);
    expect(wantsLight(340, 76)).toBe(true);
    expect(wantsLight(120, 36)).toBe(true);
  });
});
