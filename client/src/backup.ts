// Export and restore run in the browser (brief §13; the server's CPU budget is too
// small to build or unpack a file with embedded photos).
import { checkExportFile, EXPORT_FORMAT, EXPORT_VERSION, type ExportFile, type ExportLogEntry, type ExportPhoto, type ExportProduct, type RestorePayload } from '../../shared/domain/backup';
import type { LogEntry } from '../../shared/domain/logEntry';
import { ownProfilePhotoUrl, photoUrl, type PhotoRecord } from '../../shared/domain/photo';
import type { Product } from '../../shared/domain/product';
import { api, ApiError, type Me } from './api';
import { discardUpload, loadImage, renderCrop, uploadSet } from './images';
import { clearEntryCache, fetchEntries } from './logEntries';
import { clearProductCache, fetchArchived, fetchProducts } from './products';

declare const __APP_VERSION__: string;

export type Progress = (done: number, total: number) => void;

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, 'photo_failed', 'A photo couldn’t be downloaded. Check your connection and try again.');
  return res.blob();
}

const toBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

const fromBase64 = (s: string) => {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
};

/** Builds the export: all your data, photos embedded (cropped and originals). */
export async function buildExport(username: string, progress: Progress): Promise<File> {
  const [active, archived, entries, me] = await Promise.all([fetchProducts(), fetchArchived(), fetchEntries(), api<Me>('GET', '/auth/me')]);
  const products: Product[] = [...active, ...archived];
  const profile = me.user?.photo ?? null;
  const photos = products.reduce((n, p) => n + p.photos.length, 0) + entries.filter((e) => e.photo).length + (profile ? 1 : 0);
  let done = 0;
  progress(0, photos);
  const embed = async (ph: PhotoRecord, url = (v: 'original' | 'cropped') => photoUrl(ph, v)): Promise<ExportPhoto> => {
    const [original, cropped] = await Promise.all([fetchBlob(url('original')), fetchBlob(url('cropped'))]);
    const out = { crop: ph.crop, original: await toBase64(original), cropped: await toBase64(cropped) };
    progress(++done, photos);
    return out;
  };

  const exportProducts: ExportProduct[] = [];
  for (const p of products) {
    const embedded: ExportPhoto[] = [];
    for (const ph of p.photos) embedded.push(await embed(ph));
    exportProducts.push({
      name: p.name,
      strainType: p.strainType,
      productType: p.productType,
      productTypeOther: p.productTypeOther,
      concentrateType: p.concentrateType,
      concentrateTypeOther: p.concentrateTypeOther,
      country: p.country,
      countryOther: p.countryOther,
      source: p.source,
      dateTried: p.dateTried,
      leaflyLink: p.leaflyLink,
      notes: p.notes,
      hitTimeMinutes: p.hitTimeMinutes,
      private: p.private,
      ratings: p.ratings as Record<string, number>,
      purchases: [...p.purchases].sort((a, b) => a.seq - b.seq).map(({ date, amount, totalPaid, supplier }) => ({ date, amount, totalPaid, supplier })),
      photos: embedded,
      archived: p.archived,
      createdAt: p.createdAt,
    });
  }
  const exportEntries: ExportLogEntry[] = [];
  for (const e of entries as LogEntry[]) {
    exportEntries.push({
      name: e.name,
      productType: e.productType,
      productTypeOther: e.productTypeOther,
      concentrateType: e.concentrateType,
      concentrateTypeOther: e.concentrateTypeOther,
      country: e.country,
      countryOther: e.countryOther,
      amount: e.amount,
      photo: e.photo ? await embed(e.photo) : null,
      createdAt: e.createdAt,
    });
  }

  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    username,
    products: exportProducts,
    logEntries: exportEntries,
    // D23: your profile photo, original and crop; null when you have none.
    profilePhoto: profile ? await embed({ id: 'profile', ...profile }, (v) => ownProfilePhotoUrl(profile.version, v)) : null,
  };
  const date = file.exportedAt.slice(0, 10);
  return new File([JSON.stringify(file)], `green-tracker-${username}-${date}.json`, { type: 'application/json' });
}

/** Hands the file over: the share sheet on iPhone (Save to Files / iCloud), a download elsewhere. */
export async function deliver(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export interface ExportSummary {
  file: ExportFile;
  products: number;
  archived: number;
  logEntries: number;
  /** Product and Log photos (the profile photo is counted separately). */
  photos: number;
  /** D23: the file's profile photo; a file from before 0.17.0 has none and leaves yours alone. */
  profilePhoto: 'included' | 'none' | 'not-in-file';
}

/** Reads and checks a chosen export file. Nothing is changed. */
export async function readExport(file: Blob): Promise<ExportSummary> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new ApiError(0, 'bad_file', 'This isn’t a Green Tracker export file.');
  }
  const checked = checkExportFile(raw);
  if (!checked.ok) throw new ApiError(0, 'bad_file', checked.message);
  const f = checked.value;
  return {
    file: f,
    products: f.products.filter((p) => !p.archived).length,
    archived: f.products.filter((p) => p.archived).length,
    logEntries: f.logEntries.length,
    photos: f.products.reduce((n, p) => n + p.photos.length, 0) + f.logEntries.filter((e) => e.photo).length,
    profilePhoto: f.profilePhoto === undefined ? 'not-in-file' : f.profilePhoto ? 'included' : 'none',
  };
}

/**
 * Replaces all your data with the file's. Photos upload first (with fresh
 * thumbnails); then one server call swaps everything at once. If anything fails,
 * nothing is replaced and the uploaded photos are discarded.
 */
export async function restore(summary: ExportSummary, progress: Progress): Promise<void> {
  const uploads: string[] = [];
  let done = 0;
  const total = summary.photos + (summary.profilePhoto === 'included' ? 1 : 0);
  progress(0, total);
  const upload = async (ph: ExportPhoto) => {
    const cropped = fromBase64(ph.cropped);
    const { thumb } = await renderCrop(await loadImage(cropped), null);
    const id = await uploadSet({ original: fromBase64(ph.original), cropped, thumb });
    uploads.push(id);
    progress(++done, total);
    return { upload: id, crop: ph.crop };
  };
  try {
    const payload: RestorePayload = { products: [], logEntries: [] };
    for (const p of summary.file.products) {
      const photos = [];
      for (const ph of p.photos) photos.push(await upload(ph));
      payload.products.push({ ...p, purchases: p.purchases, photos });
    }
    for (const e of summary.file.logEntries) {
      const { photo, ...rest } = e;
      payload.logEntries.push({ ...rest, photos: photo ? [await upload(photo)] : [] });
    }
    const pp = summary.file.profilePhoto;
    if (pp !== undefined) payload.profilePhoto = pp ? { upload: (await upload(pp)).upload, crop: pp.crop! } : null;
    await api('POST', '/data/restore', payload);
  } catch (e) {
    uploads.forEach(discardUpload);
    throw e;
  }
  clearProductCache();
  clearEntryCache();
}
