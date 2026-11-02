import { useEffect, useRef, useState } from 'preact/hooks';
import type { Crop, PhotoRecord } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { api, errorText } from '../api';
import { loadImage, renderCrop, uploadSet } from '../images';
import { useOnline } from '../online';
import { cacheProduct, changing } from '../products';
import { CutoutFlow, type CutoutResult } from './CutoutFlow';
import { shownFromRecord } from './PhotoGrid';
import { Cropper, PhotoViewer } from './PhotoViewer';

/**
 * Your own product's photos full screen, with the bar along the bottom (D52): Set as cover, Crop,
 * Cut out / Restore background, each saved straight away. One piece for the product page and,
 * since D79, a tap on a row's photo in your Leaderboard, Archive or Log, so both behave the same.
 * `onCoverFrom` gets the cover a new one replaced (the page fades it out), or null when that failed.
 */
export function usePhotoEdits(o: { product: Product | undefined; setProduct: (p: Product) => void; onError: (message: string) => void; onCoverFrom?: (image: string | null) => void; start?: number | null }) {
  const online = useOnline();
  const [viewing, setViewing] = useState<number | null>(o.start ?? null);
  const [cropping, setCropping] = useState<number | null>(null);
  const [cuttingOut, setCuttingOut] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // D52: a short note says the cover is saved.
  const [note, setNote] = useState<string | null>(null);
  // A cover being saved: the lists keep this open until it's done and said (D79).
  const [covering, setCovering] = useState(false);
  const product = o.product;

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(t);
  }, [note]);

  /** A crop is saved straight away (brief §11), rendered from the original. */
  async function saveCrop(index: number, crop: Crop | null, text = 'Saving crop…') {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    setCropping(null);
    setSaving(text);
    o.onError('');
    try {
      const original = await loadImage(shownFromRecord(photo).original as string);
      const upload = await uploadSet(await renderCrop(original, crop));
      const r = await api<{ photo: PhotoRecord }>('POST', `/photos/${encodeURIComponent(photo.id)}/crop`, { upload, crop });
      o.setProduct(cacheProduct({ ...current, photos: current.photos.map((x) => (x.id === photo.id ? r.photo : x)) }));
    } catch (e) {
      o.onError(errorText(e));
    }
    setSaving(null);
  }

  /** A cut-out is saved straight away too (D26), like a crop: it keeps the crop it was made from. Errors stay in the flow. */
  async function saveCutout(index: number, r: CutoutResult) {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    const upload = await uploadSet({ ...r, cutout: true });
    const res = await api<{ photo: PhotoRecord }>('POST', `/photos/${encodeURIComponent(photo.id)}/crop`, { upload, crop: photo.crop });
    o.setProduct(cacheProduct({ ...current, photos: current.photos.map((x) => (x.id === photo.id ? res.photo : x)) }));
    setCuttingOut(null);
  }

  /** Set as cover (D52), saved straight away: the photo moves to the front. */
  async function saveCover(index: number) {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    setViewing(null);
    setCovering(true);
    o.onError('');
    const was = current.photos[0] ? shownFromRecord(current.photos[0]).image : null;
    // Show it straight away; put it back if the save fails.
    o.onCoverFrom?.(was);
    o.setProduct({ ...current, photos: [photo, ...current.photos.filter((x) => x.id !== photo.id)] });
    try {
      const r = await api<{ product: Product }>('POST', `/photos/${encodeURIComponent(photo.id)}/cover`);
      o.setProduct(cacheProduct(r.product));
      setNote('Cover updated');
    } catch (e) {
      o.onCoverFrom?.(null);
      o.setProduct(current);
      o.onError(errorText(e));
    }
    setCovering(false);
  }

  const overlays = product && (
    <>
      {viewing !== null && (
        <PhotoViewer
          photos={product.photos.map(shownFromRecord)}
          start={viewing}
          onClose={() => setViewing(null)}
          onCrop={(i) => {
            setViewing(null);
            setCropping(i);
          }}
          onCutout={(i) => {
            setViewing(null);
            setCuttingOut(i);
          }}
          // Restore background (D26): the photo's crop, rendered from the original again.
          onRestore={(i) => {
            setViewing(null);
            saveCrop(i, product.photos[i]!.crop, 'Restoring background…');
          }}
          onCover={online ? saveCover : undefined}
        />
      )}
      {note && (
        <p class="toast" role="status">
          {note}
        </p>
      )}
      {cropping !== null && product.photos[cropping] && (
        <Cropper original={shownFromRecord(product.photos[cropping]!).original} crop={product.photos[cropping]!.crop} onCancel={() => setCropping(null)} onApply={(crop) => saveCrop(cropping, crop)} />
      )}
      {cuttingOut !== null && product.photos[cuttingOut] && (
        <CutoutFlow source={shownFromRecord(product.photos[cuttingOut]!).image} name={product.name} onCancel={() => setCuttingOut(null)} onApply={(r) => saveCutout(cuttingOut, r)} />
      )}
    </>
  );
  const idle = viewing === null && cropping === null && cuttingOut === null && saving === null && note === null && !covering;
  return { open: setViewing, saving, idle, overlays };
}

/**
 * D79: a product's photos opened from its row in your Leaderboard, Archive or Log, starting on the
 * cover, with the product page's bar. Saving or a failed save shows as a note at the bottom; once
 * everything's closed and said, `onClose`. Changes reach the row through `onChange`.
 */
export function RowPhotos(p: { product: Product; onChange: (product: Product) => void; onClose: () => void }) {
  const [product, setProduct] = useState(p.product);
  const [error, setError] = useState('');
  const edits = usePhotoEdits({
    product,
    setProduct: (next) => {
      setProduct(next);
      p.onChange(next);
    },
    onError: setError,
    start: 0,
  });
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);
  const close = useRef(p.onClose);
  close.current = p.onClose;
  useEffect(() => {
    if (edits.idle && !error) close.current();
  }, [edits.idle, error]);
  return (
    <>
      {edits.overlays}
      {edits.saving && (
        <p class="toast" role="status">
          {edits.saving}
        </p>
      )}
      {error && (
        <p class="toast" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * D79: whether a tap on a list row landed on its photo, so it opens the viewer instead of the
 * row's page. The photo counts a few pixels beyond its edge (the Log's is 40px), never past the
 * gap before the name. Modifier-clicks and taps on rows without a photo open the page as before.
 */
export function tappedPhoto(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const row = e.currentTarget as HTMLElement | null;
  const thumb = row?.querySelector<HTMLElement>('.thumb');
  if (!thumb?.querySelector('img')) return false;
  const r = thumb.getBoundingClientRect();
  const slack = 6;
  return e.clientX >= r.left - slack && e.clientX <= r.right + slack && e.clientY >= r.top - slack && e.clientY <= r.bottom + slack;
}
