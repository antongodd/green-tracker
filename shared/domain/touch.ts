// Soft light (D101, GT Ideas #40): what a touch, or a mouse on a computer, does to the thing under it. A soft glow
// in the Look's colour sits where the finger is, and big photos lean a little towards it. The app (client/src/press.ts)
// and the website (site/public/site.js, its own copy) both use these numbers.

/** How far a big photo leans towards the finger, in degrees, at its very edge (Anton's pick B: gentle). */
export const LEAN_DEG = 4;
/** With a mouse, the lean is half that: the pointer rests over things far longer than a finger presses. */
export const HOVER_LEAN_DEG = 2;
/** Smaller than this (icons, switches, the tabs) and something gets no glow: it would only tint it. */
export const LIGHT_MIN_W = 64;
export const LIGHT_MIN_H = 36;
/**
 * A real mouse sends a stream of small moves; a glow under the pointer waits for this many over the same thing,
 * so a pointer that jumps straight onto something and clicks (as the browser tests' does) never leaves one behind.
 */
export const HOVER_MOVES = 3;

export interface Aim {
  /** Where the glow's centre sits, in pixels from the thing's top left corner. */
  x: number;
  y: number;
  /** Where the finger is across and down the thing, from -1 (left or top edge) to 1 (right or bottom edge). */
  lx: number;
  ly: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where a finger at (x, y) on the screen is on a thing whose box is `box`; kept inside the box. */
export function aimAt(box: { left: number; top: number; width: number; height: number }, x: number, y: number): Aim {
  const w = Math.max(1, box.width);
  const h = Math.max(1, box.height);
  const px = clamp(x - box.left, 0, w);
  const py = clamp(y - box.top, 0, h);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { x: Math.round(px), y: Math.round(py), lx: round((px / w) * 2 - 1), ly: round((py / h) * 2 - 1) };
}

/**
 * How a thing leans for an aim: it tips towards the finger, so a press on its right edge pushes the right side in
 * (turning about the vertical line through its middle) and one on its top edge pushes the top in.
 */
export function leanFor(aim: Aim, deg = LEAN_DEG): { rotateX: number; rotateY: number } {
  const zero = (v: number) => (Object.is(v, -0) ? 0 : v);
  return { rotateX: zero(-aim.ly * deg), rotateY: zero(aim.lx * deg) };
}

/** Whether something this big gets a glow under the finger. */
export const wantsLight = (width: number, height: number): boolean => width >= LIGHT_MIN_W && height >= LIGHT_MIN_H;
