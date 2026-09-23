// All image work happens here, in the browser (the server only stores files):
// resize to 1600px / JPEG 0.82, crop from the original, ~320px thumbnails.
import { PHOTO_MAX_EDGE, PHOTO_QUALITY, THUMB_SHORT_EDGE, type Crop } from '../../shared/domain/photo';
import { api, ApiError } from './api';

/** Decodes an image. Drawing an <img> to a canvas applies its EXIF orientation, so output is upright. */
export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ApiError(0, 'bad_image', 'That file couldn’t be opened as a photo.');
  } finally {
    if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ApiError(0, 'bad_image', 'The photo couldn’t be processed.'))), 'image/jpeg', PHOTO_QUALITY),
  );
}

/** Draws a source rectangle of `img` scaled by `scale` onto a new canvas. */
function draw(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const size = (img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight });

/** The cropped image (from the original, never from an earlier crop) and its thumbnail. */
export async function renderCrop(original: HTMLImageElement, crop: Crop | null): Promise<{ cropped: Blob; thumb: Blob }> {
  const { w, h } = size(original);
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = c.x * w;
  const sy = c.y * h;
  const sw = Math.max(1, c.w * w);
  const sh = Math.max(1, c.h * h);
  const cropped = draw(original, sx, sy, sw, sh, Math.min(1, PHOTO_MAX_EDGE / Math.max(sw, sh)));
  const thumb = draw(cropped, 0, 0, cropped.width, cropped.height, Math.min(1, THUMB_SHORT_EDGE / Math.min(cropped.width, cropped.height)));
  return { cropped: await toJpeg(cropped), thumb: await toJpeg(thumb) };
}

/** A picked file → the resized original (1600px long edge) plus the uncropped image and thumbnail. */
export async function prepareNewPhoto(file: Blob): Promise<{ original: Blob; cropped: Blob; thumb: Blob }> {
  const img = await loadImage(file);
  const { w, h } = size(img);
  const original = await toJpeg(draw(img, 0, 0, w, h, Math.min(1, PHOTO_MAX_EDGE / Math.max(w, h))));
  const resized = await loadImage(original);
  return { original, ...(await renderCrop(resized, null)) };
}

/** Uploads a set; returns its id. Attached to a record only by a later Save (or a profile crop). */
export async function uploadSet(parts: { original?: Blob; cropped: Blob; thumb: Blob }): Promise<string> {
  const form = new FormData();
  if (parts.original) form.append('original', parts.original, 'original.jpg');
  form.append('cropped', parts.cropped, 'cropped.jpg');
  form.append('thumb', parts.thumb, 'thumb.jpg');
  let res: Response;
  try {
    res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'offline', 'You’re offline. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as { upload?: string; error?: string; message?: string } | null;
  if (!res.ok || !data?.upload) throw new ApiError(res.status, data?.error ?? 'upload_failed', data?.message ?? 'The photo couldn’t be uploaded. Please try again.');
  return data.upload;
}

/** Discards an upload that will never be saved (Cancel, a replaced crop, a removed new photo). */
export function discardUpload(id: string): void {
  api('DELETE', `/uploads/${encodeURIComponent(id)}`).catch(() => {});
}
