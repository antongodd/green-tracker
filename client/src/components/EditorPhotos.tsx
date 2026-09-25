import { useEffect, useRef, useState } from 'preact/hooks';
import type { Crop, PhotoInput, PhotoRecord } from '../../../shared/domain/photo';
import { errorText } from '../api';
import { CameraIcon } from '../icons';
import { discardUpload, loadImage, prepareNewPhoto, renderCrop, uploadSet } from '../images';
import { PhotoGrid, shownFromRecord } from './PhotoGrid';
import { Cropper, PhotoViewer, type ShownPhoto } from './PhotoViewer';
import { CutoutFlow, type CutoutResult } from './CutoutFlow';

/** A photo in the editor: saved (id), new (upload with its original), or saved with an unsaved crop. */
export interface PhotoDraft extends ShownPhoto {
  id?: string;
  /** A pending set waiting for Save. */
  upload?: string;
  /** The pending set includes the original (a new photo). */
  isNew?: boolean;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

let draftKey = 0;
const blobUrls = new Set<string>();
const blobUrl = (b: Blob) => {
  const u = URL.createObjectURL(b);
  blobUrls.add(u);
  return u;
};

export const draftsFromRecords = (photos: PhotoRecord[]): PhotoDraft[] => photos.map((ph) => ({ ...shownFromRecord(ph), id: ph.id, status: 'ready' }));

/** What Save sends: new and re-cropped photos by upload, the rest by id; order = display order. */
export function photosToInput(drafts: PhotoDraft[]): PhotoInput[] | string {
  if (drafts.some((d) => d.status === 'uploading')) return 'Wait for the photos to finish uploading.';
  if (drafts.some((d) => d.status === 'error')) return 'A photo failed to upload. Remove it or try adding it again.';
  return drafts.map((d) => ({ ...(d.id ? { id: d.id } : {}), ...(d.upload ? { upload: d.upload } : {}), crop: d.crop }));
}

/**
 * The editor's Photos section. Everything here is provisional: new photos and
 * crops upload straight away as pending sets, and only Save attaches them
 * (brief §11). Unsaved sets are discarded when the editor closes without saving.
 */
export function EditorPhotos(p: { drafts: PhotoDraft[]; setDrafts: (f: (d: PhotoDraft[]) => PhotoDraft[]) => void; savedRef: { current: boolean }; max?: number; name?: string }) {
  const max = p.max ?? Infinity;
  const [viewing, setViewing] = useState<number | null>(null);
  const [cropping, setCropping] = useState<number | null>(null);
  const [cuttingOut, setCuttingOut] = useState<number | null>(null);
  const latest = useRef(p.drafts);
  latest.current = p.drafts;

  // Leaving without saving (Cancel, Back, closing the app) discards pending sets.
  useEffect(
    () => () => {
      if (!p.savedRef.current) latest.current.forEach((d) => d.upload && discardUpload(d.upload));
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      blobUrls.clear();
    },
    [],
  );

  const update = (key: string, patch: Partial<PhotoDraft> | ((d: PhotoDraft) => Partial<PhotoDraft>)) =>
    p.setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)));

  /** Swaps a draft's pending set, discarding the one it replaces (or the new one if the draft is gone). */
  function settle(key: string, upload: string, patch: Partial<PhotoDraft>) {
    const draft = latest.current.find((d) => d.key === key);
    if (!draft) return discardUpload(upload);
    if (draft.upload && draft.upload !== upload) discardUpload(draft.upload);
    update(key, { ...patch, upload, status: 'ready', error: undefined });
  }

  async function add(files: FileList | null) {
    for (const file of Array.from(files ?? []).slice(0, Math.max(0, max - latest.current.length))) {
      const key = `ph${++draftKey}`;
      const preview = blobUrl(file);
      p.setDrafts((list) => [...list, { key, thumb: preview, image: preview, original: file, crop: null, status: 'uploading', isNew: true }]);
      try {
        const set = await prepareNewPhoto(file);
        const upload = await uploadSet(set);
        settle(key, upload, { thumb: blobUrl(set.thumb), image: blobUrl(set.cropped), original: set.original, isNew: true });
      } catch (e) {
        update(key, { status: 'error', error: errorText(e) });
      }
    }
  }

  /** A new crop — also how Restore background (D26) works: the same crop, rendered from the original again. */
  async function crop(index: number, next: Crop | null) {
    setCropping(null);
    const draft = p.drafts[index];
    if (!draft) return;
    update(draft.key, { status: 'uploading', crop: next });
    try {
      const original = await loadImage(draft.original);
      const { cropped, thumb } = await renderCrop(original, next);
      // A new photo's set must include its original; a saved photo keeps the one it has.
      const upload = await uploadSet(draft.isNew ? { original: draft.original as Blob, cropped, thumb } : { cropped, thumb });
      settle(draft.key, upload, { thumb: blobUrl(thumb), image: blobUrl(cropped), crop: next, cutout: false });
    } catch (e) {
      update(draft.key, { status: 'error', error: errorText(e), crop: draft.crop });
    }
  }

  /** A cut-out (D26): uploaded now as a pending set like a crop, attached by Save. Errors stay in the flow. */
  async function cutout(index: number, r: CutoutResult) {
    const draft = p.drafts[index];
    if (!draft) return;
    const upload = await uploadSet(draft.isNew ? { original: draft.original as Blob, ...r, cutout: true } : { ...r, cutout: true });
    settle(draft.key, upload, { thumb: blobUrl(r.thumb), image: blobUrl(r.cropped), cutout: true });
    setCuttingOut(null);
  }

  function remove(index: number) {
    const draft = p.drafts[index];
    if (!draft) return;
    if (draft.upload) discardUpload(draft.upload);
    p.setDrafts((list) => list.filter((d) => d.key !== draft.key));
    setViewing(null);
  }

  return (
    <section class="fgroup" aria-label="Photos">
      <span class="cap">{max === 1 ? 'Photo' : 'Photos'}</span>
      <PhotoGrid
        photos={p.drafts}
        onOpen={setViewing}
        onCrop={setCropping}
        onCutout={setCuttingOut}
        status={(i) => {
          const d = p.drafts[i]!;
          return d.status === 'uploading' ? 'Uploading…' : d.status === 'error' ? '!Failed' : null;
        }}
      >
        {p.drafts.length < max && (
          <label class="add-cell">
            <CameraIcon />
            {max === 1 ? 'Add photo' : 'Add photos'}
            <input type="file" accept="image/*" multiple={max > 1} aria-label={max === 1 ? 'Add photo' : 'Add photos'} onChange={(e) => (add(e.currentTarget.files), (e.currentTarget.value = ''))} />
          </label>
        )}
      </PhotoGrid>
      {p.drafts.some((d) => d.status === 'error') && (
        <p class="error" role="alert">
          {p.drafts.find((d) => d.status === 'error')!.error}
        </p>
      )}
      {viewing !== null && p.drafts.length > 0 && (
        <PhotoViewer
          photos={p.drafts}
          start={Math.min(viewing, p.drafts.length - 1)}
          onClose={() => setViewing(null)}
          onCrop={(i) => {
            setViewing(null);
            setCropping(i);
          }}
          onRemove={remove}
          onCutout={(i) => {
            setViewing(null);
            setCuttingOut(i);
          }}
          onRestore={(i) => {
            setViewing(null);
            crop(i, p.drafts[i]!.crop);
          }}
        />
      )}
      {cuttingOut !== null && p.drafts[cuttingOut] && (
        <CutoutFlow source={p.drafts[cuttingOut]!.image} name={p.name} onCancel={() => setCuttingOut(null)} onApply={(r) => cutout(cuttingOut, r)} />
      )}
      {cropping !== null && p.drafts[cropping] && (
        <Cropper original={p.drafts[cropping]!.original} crop={p.drafts[cropping]!.crop} onCancel={() => setCropping(null)} onApply={(c) => crop(cropping, c)} />
      )}
    </section>
  );
}
