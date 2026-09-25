// Photos (brief §11): many per product, one per log entry. The server stores and
// serves files; all image work (resize, crop, thumbnail) happens in the browser.

/** Resize on the way in: 1600px long edge, JPEG ~0.82. */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.82;
/** Thumbnails for lists (D8): about 320px on the short edge. */
export const THUMB_SHORT_EDGE = 320;

/** Upload size limits per file, well above what the resize produces. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_THUMB_BYTES = 1024 * 1024;

export type PhotoVariant = 'thumb' | 'cropped' | 'original';
export const PHOTO_VARIANTS: readonly PhotoVariant[] = ['thumb', 'cropped', 'original'];

/** A crop as fractions (0–1) of the original image. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chosen in Square mode (1:1). */
  square: boolean;
}

export interface PhotoRecord {
  id: string;
  /** Changes whenever the cropped image changes: part of the image URL and its ETag. */
  version: string;
  crop: Crop | null;
  /**
   * D26: the background has been removed. Its cropped image and thumbnail are then
   * transparent PNGs, framed around the bud and made from `crop` (kept, so Restore
   * background can put the photo back as it was). The original is never changed.
   */
  cutout: boolean;
}

/**
 * A photo as the editor saves it, in display order:
 * - an existing photo keeps its `id`; with `upload` it gets a new crop;
 * - a new photo has only `upload` (a set that includes the original).
 * A photo left out of the list is deleted.
 */
export interface PhotoInput {
  id?: string;
  upload?: string;
  crop: Crop | null;
}

export const MAX_PHOTOS_PER_PRODUCT = 100;

const EPS = 1e-6;
const frac = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -EPS && v <= 1 + EPS;

/** Validates a crop; null (uncropped) is valid. Returns undefined when invalid. */
export function parseCrop(raw: unknown): Crop | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  if (!frac(c.x) || !frac(c.y) || !frac(c.w) || !frac(c.h)) return undefined;
  if (c.w <= 0.001 || c.h <= 0.001 || c.x + c.w > 1 + EPS || c.y + c.h > 1 + EPS) return undefined;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp(c.x), y: clamp(c.y), w: clamp(c.w), h: clamp(c.h), square: c.square === true };
}

/** The image URL for a photo variant. The version makes a re-crop a new URL. */
export function photoUrl(p: Pick<PhotoRecord, 'id' | 'version'>, variant: PhotoVariant): string {
  return `/api/photos/${encodeURIComponent(p.id)}/${variant}?v=${encodeURIComponent(p.version)}`;
}

/** Profile photos (D23): one square crop per account. Others only ever get the crop. */
export type ProfilePhotoVariant = Exclude<PhotoVariant, 'original'>;

/** Your own profile photo: any variant (the original is for re-framing and export). */
export function ownProfilePhotoUrl(version: string, variant: PhotoVariant): string {
  return `/api/profile/photo/${variant}?v=${encodeURIComponent(version)}`;
}

/** Someone else's profile photo, served only while you're connected to them. */
export function personPhotoUrl(username: string, version: string, variant: ProfilePhotoVariant): string {
  return `/api/people/u/${encodeURIComponent(username)}/photo/${variant}?v=${encodeURIComponent(version)}`;
}
