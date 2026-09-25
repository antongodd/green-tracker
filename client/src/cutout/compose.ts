// Remove background (D26): the canvas side — what the AI is shown, and the cut-out
// made from its mask. The maths (pieces, framing, zoom) is in shared/domain/cutout.ts.
import { CUTOUT_MAX_EDGE, CUTOUT_SIZE, frameSquare, keptBounds, type Pieces } from '../../../shared/domain/cutout';
import { draw, renderThumb, toPng } from '../images';

/** A part of the source photo, in its pixels: the whole photo, or a zoomed-in square. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the AI found in a region. */
export interface Analysis {
  region: Region;
  alpha: Float32Array;
  pieces: Pieces;
}

export const canvasOf = (img: HTMLImageElement): HTMLCanvasElement => draw(img, 0, 0, img.naturalWidth, img.naturalHeight, 1);

/** The region, stretched to the AI's square, as RGBA pixels. */
export function modelPixels(src: HTMLCanvasElement, r: Region): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = c.height = CUTOUT_SIZE;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, CUTOUT_SIZE, CUTOUT_SIZE);
  const px = x.getImageData(0, 0, CUTOUT_SIZE, CUTOUT_SIZE).data;
  c.width = c.height = 0;
  return px;
}

/** The region with only the kept things showing (the rest transparent), at the photo's resolution. */
export function composite(src: HTMLCanvasElement, a: Analysis, kept: ReadonlySet<number>): HTMLCanvasElement {
  const s = a.pieces.size;
  const m = document.createElement('canvas');
  m.width = m.height = s;
  const mx = m.getContext('2d')!;
  const md = mx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) if (kept.has(a.pieces.owner[i]!)) md.data[i * 4 + 3] = Math.round(a.alpha[i]! * 255);
  mx.putImageData(md, 0, 0);
  const { x, y, w, h } = a.region;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  const ox = out.getContext('2d')!;
  ox.drawImage(src, x, y, w, h, 0, 0, out.width, out.height);
  ox.globalCompositeOperation = 'destination-in';
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(m, 0, 0, out.width, out.height);
  m.width = m.height = 0;
  return out;
}

/** The finished cut-out: framed and centred on the kept things, as a transparent PNG, plus its thumbnail. */
export async function renderCutout(src: HTMLCanvasElement, a: Analysis, kept: ReadonlySet<number>): Promise<{ cropped: Blob; thumb: Blob }> {
  const bounds = keptBounds(a.pieces, a.alpha, kept);
  if (!bounds) throw new Error('nothing kept');
  const cut = composite(src, a, kept);
  const f = frameSquare(bounds, cut.width, cut.height);
  const size = Math.max(1, Math.min(CUTOUT_MAX_EDGE, Math.round(f.side)));
  const framed = document.createElement('canvas');
  framed.width = framed.height = size;
  const fx = framed.getContext('2d')!;
  fx.imageSmoothingQuality = 'high';
  fx.drawImage(cut, f.x, f.y, f.side, f.side, 0, 0, size, size);
  cut.width = cut.height = 0;
  const [cropped, thumb] = await Promise.all([toPng(framed), renderThumb(framed, true)]);
  framed.width = framed.height = 0;
  return { cropped, thumb };
}
