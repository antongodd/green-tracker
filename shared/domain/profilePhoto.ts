// Profile photos (D23): framing a square crop by moving and zooming the photo
// under a fixed circle. Pure geometry, in the original image's pixels, so the
// framing screen and the tests share it.

import type { Crop } from './photo';

/** Where the circle sits on the photo: its centre, and how far it's zoomed in (1 = the short edge fills the circle). */
export interface Frame {
  cx: number;
  cy: number;
  zoom: number;
}

/** Zoom stops at 5×, or earlier on a small photo so the crop keeps at least 80px across. */
export function maxZoom(w: number, h: number): number {
  return Math.max(1, Math.min(5, Math.min(w, h) / 80));
}

/** The side of the square the circle covers, in original pixels. */
export const frameSide = (w: number, h: number, zoom: number) => Math.min(w, h) / zoom;

/** Keeps the zoom in range and the square inside the photo (the circle is never left partly empty). */
export function clampFrame(w: number, h: number, f: Frame): Frame {
  const zoom = Math.min(maxZoom(w, h), Math.max(1, Number.isFinite(f.zoom) ? f.zoom : 1));
  const half = frameSide(w, h, zoom) / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : (lo + hi) / 2));
  return { cx: clamp(f.cx, half, w - half), cy: clamp(f.cy, half, h - half), zoom };
}

/** A new photo starts centred, zoomed out as far as the circle allows. */
export const initialFrame = (w: number, h: number): Frame => ({ cx: w / 2, cy: h / 2, zoom: 1 });

/** The saved crop (fractions of the original) as a frame; anything unusable starts afresh. */
export function frameFromCrop(w: number, h: number, crop: Crop | null): Frame {
  if (!crop) return initialFrame(w, h);
  const side = Math.min(crop.w * w, crop.h * h);
  if (!(side > 0)) return initialFrame(w, h);
  return clampFrame(w, h, { cx: (crop.x + crop.w / 2) * w, cy: (crop.y + crop.h / 2) * h, zoom: Math.min(w, h) / side });
}

/** The frame as the stored crop: a square in pixels, as fractions of the original. */
export function frameToCrop(w: number, h: number, frame: Frame): Crop {
  const f = clampFrame(w, h, frame);
  const side = frameSide(w, h, f.zoom);
  const x = Math.max(0, (f.cx - side / 2) / w);
  const y = Math.max(0, (f.cy - side / 2) / h);
  return { x, y, w: Math.min(side / w, 1 - x), h: Math.min(side / h, 1 - y), square: true };
}
