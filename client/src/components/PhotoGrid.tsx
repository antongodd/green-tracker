import type { ComponentChildren } from 'preact';
import { photoUrl, type PhotoRecord } from '../../../shared/domain/photo';
import { CropIcon, CutoutIcon } from '../icons';
import type { ShownPhoto } from './PhotoViewer';

export const shownFromRecord = (ph: PhotoRecord): ShownPhoto => ({
  key: ph.id,
  thumb: photoUrl(ph, 'thumb'),
  image: photoUrl(ph, 'cropped'),
  original: photoUrl(ph, 'original'),
  crop: ph.crop,
  cutout: ph.cutout,
});

/**
 * Photo grid (brief §6.9): 3 columns, square cells, 4px gaps. Tapping a photo
 * opens the viewer; the ⛶ button opens the cropper directly, and (D26) the button
 * bottom-left removes the background (not shown once it's removed: the viewer restores it).
 */
export function PhotoGrid(p: {
  photos: ShownPhoto[];
  onOpen: (i: number) => void;
  onCrop?: (i: number) => void;
  onCutout?: (i: number) => void;
  status?: (i: number) => string | null;
  children?: ComponentChildren;
}) {
  return (
    <div class="pgrid">
      {p.photos.map((ph, i) => {
        const status = p.status?.(i) ?? null;
        return (
          <div key={ph.key} style={{ position: 'relative' }}>
            <button type="button" class={`pcell${ph.uploading ? ' uploading' : ''}${ph.cutout ? ' cut' : ''}`} style={{ width: '100%' }} onClick={() => p.onOpen(i)} aria-label={`Open photo ${i + 1}`}>
              <img src={ph.thumb} alt="" loading="lazy" decoding="async" />
              {status && <span class={`state${status.startsWith('!') ? ' bad' : ''}`}>{status.replace(/^!/, '')}</span>}
            </button>
            {p.onCutout && !ph.uploading && !ph.cutout && (
              <button type="button" class="cutout-btn" onClick={() => p.onCutout!(i)} aria-label={`Remove background from photo ${i + 1}`}>
                <CutoutIcon />
              </button>
            )}
            {p.onCrop && !ph.uploading && (
              <button type="button" class="crop-btn" onClick={() => p.onCrop!(i)} aria-label={`Crop photo ${i + 1}`}>
                <CropIcon />
              </button>
            )}
          </div>
        );
      })}
      {p.children}
    </div>
  );
}
