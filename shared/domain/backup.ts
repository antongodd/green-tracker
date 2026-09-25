// Export and restore (brief §13). The export is one JSON file with all of the
// user's data and photos embedded (cropped and originals). It excludes view state
// and social data (follows, requests, blocks), and also account security (passkeys,
// recovery codes). Derived figures are never stored, so a restored export always
// displays under the current rules.

import { parseCrop, type Crop } from './photo';
import { validateLogEntryInput, type LogEntryInput } from './logEntry';
import { validateProductInput, type ProductInput } from './product';

export const EXPORT_FORMAT = 'green-tracker-export';
export const EXPORT_VERSION = 1;

/** A photo in the file: JPEG bytes as base64, plus its crop (fractions of the original). */
export interface ExportPhoto {
  crop: Crop | null;
  original: string;
  cropped: string;
}

export interface ExportProduct extends Omit<ProductInput, 'photos' | 'ratings' | 'purchases'> {
  /** Every stored rating, including categories hidden by a type switch. */
  ratings: Record<string, number>;
  /** In entry order. */
  purchases: { date: string | null; amount: number | null; totalPaid: number; supplier: string | null }[];
  photos: ExportPhoto[];
  archived: boolean;
  createdAt: number;
}

export interface ExportLogEntry extends Omit<LogEntryInput, 'photos'> {
  photo: ExportPhoto | null;
  createdAt: number;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  username: string;
  products: ExportProduct[];
  logEntries: ExportLogEntry[];
  /**
   * Your profile photo (D23, since 0.17.0): null when you had none. Absent in files
   * made before 0.17.0, and restoring such a file leaves your current photo alone.
   */
  profilePhoto?: ExportPhoto | null;
}

/** What the server receives for a restore: the file's records, with photos already uploaded as sets. */
export interface RestoreProduct extends ProductInput {
  archived: boolean;
  createdAt: number;
}
export interface RestoreLogEntry extends LogEntryInput {
  createdAt: number;
}
export interface RestorePayload {
  products: RestoreProduct[];
  logEntries: RestoreLogEntry[];
  /** Absent: leave the current profile photo. null: remove it. Otherwise: an uploaded set with its original. */
  profilePhoto?: { upload: string; crop: Crop } | null;
}

export const RESTORE_LIMITS = { products: 5000, logEntries: 5000 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isB64 = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(v.slice(0, 64));

/** Checks an export file's structure before anything is uploaded or replaced. */
export function checkExportFile(raw: unknown): Result<ExportFile> {
  const bad = (message: string): Result<ExportFile> => ({ ok: false, message });
  if (!raw || typeof raw !== 'object') return bad('This isn’t a Green Tracker export file.');
  const f = raw as Record<string, unknown>;
  if (f.format !== EXPORT_FORMAT) return bad('This isn’t a Green Tracker export file.');
  if (typeof f.version !== 'number' || f.version > EXPORT_VERSION) return bad('This export was made by a newer version of Green Tracker. Update the app and try again.');
  if (!Array.isArray(f.products) || !Array.isArray(f.logEntries)) return bad('The export file is incomplete.');
  if (f.products.length > RESTORE_LIMITS.products || f.logEntries.length > RESTORE_LIMITS.logEntries) return bad('The export file is too large to restore.');
  const photoOk = (p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const ph = p as Record<string, unknown>;
    return parseCrop(ph.crop) !== undefined && isB64(ph.original) && isB64(ph.cropped);
  };
  for (const p of f.products as Record<string, unknown>[]) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.photos) || !p.photos.every(photoOk) || !isTime(p.createdAt)) return bad('A product in the file couldn’t be read.');
  }
  for (const e of f.logEntries as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object' || (e.photo !== null && !photoOk(e.photo)) || !isTime(e.createdAt)) return bad('A log entry in the file couldn’t be read.');
  }
  if (f.profilePhoto !== undefined && f.profilePhoto !== null && !(photoOk(f.profilePhoto) && (f.profilePhoto as { crop: unknown }).crop !== null)) return bad('The profile photo in the file couldn’t be read.');
  return { ok: true, value: raw as ExportFile };
}

/**
 * Validates a restore payload with the same rules as every other write. All-or-
 * nothing: the first problem rejects the whole restore, before any data changes.
 */
export function validateRestore(raw: unknown): Result<RestorePayload> {
  const bad = (message: string): Result<RestorePayload> => ({ ok: false, message });
  if (!raw || typeof raw !== 'object') return bad('The restore could not be read.');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.products) || !Array.isArray(r.logEntries)) return bad('The restore could not be read.');
  if (r.products.length > RESTORE_LIMITS.products || r.logEntries.length > RESTORE_LIMITS.logEntries) return bad('Too much data to restore at once.');

  const uploads = new Set<string>();
  const newPhotosOnly = (photos: { id?: string; upload?: string }[]) =>
    photos.every((ph) => !ph.id && ph.upload && !uploads.has(ph.upload) && (uploads.add(ph.upload), true));

  const products: RestoreProduct[] = [];
  for (const [i, raw] of (r.products as Record<string, unknown>[]).entries()) {
    const v = validateProductInput(raw);
    const where = `Product ${i + 1}${raw && typeof raw.name === 'string' ? ` (“${raw.name}”)` : ''}`;
    if (!v.ok) return bad(`${where}: ${v.message}`);
    if (Object.values(v.value.ratings).some((x) => x === null)) return bad(`${where}: a rating is missing its value.`);
    if (!newPhotosOnly(v.value.photos)) return bad(`${where}: a photo could not be read.`);
    if (typeof raw.archived !== 'boolean' || !isTime(raw.createdAt)) return bad(`${where} could not be read.`);
    products.push({ ...v.value, archived: raw.archived, createdAt: raw.createdAt });
  }
  const logEntries: RestoreLogEntry[] = [];
  for (const [i, raw] of (r.logEntries as Record<string, unknown>[]).entries()) {
    const v = validateLogEntryInput(raw);
    if (!v.ok) return bad(`Log entry ${i + 1}: ${v.message}`);
    if (!newPhotosOnly(v.value.photos)) return bad(`Log entry ${i + 1}: a photo could not be read.`);
    if (!isTime(raw.createdAt)) return bad(`Log entry ${i + 1} could not be read.`);
    logEntries.push({ ...v.value, createdAt: raw.createdAt });
  }
  if (r.profilePhoto === undefined) return { ok: true, value: { products, logEntries } };
  if (r.profilePhoto === null) return { ok: true, value: { products, logEntries, profilePhoto: null } };
  const pp = r.profilePhoto as Record<string, unknown>;
  const crop = parseCrop(pp.crop);
  if (typeof pp.upload !== 'string' || !pp.upload || uploads.has(pp.upload) || !crop) return bad('The profile photo could not be read.');
  return { ok: true, value: { products, logEntries, profilePhoto: { upload: pp.upload, crop } } };
}
