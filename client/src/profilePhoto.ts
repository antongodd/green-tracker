// Your profile photo (D23). Image work happens here in the browser, like product
// photos: resize to 1600px, render the square crop and a ~320px thumbnail, upload the
// set, then point the profile at it.
import { ownProfilePhotoUrl, type Crop } from '../../shared/domain/photo';
import { api } from './api';
import { discardUpload, loadImage, renderCrop, resizeOriginal, uploadSet } from './images';

/** A picked file, resized to 1600px: the original that will be framed and stored. */
export const prepareOriginal = resizeOriginal;

/**
 * Saves a framing. With `original` (a Blob) it's a new photo and the original is
 * uploaded too; otherwise it re-frames the current photo, whose original stays.
 */
export async function saveProfilePhoto(original: Blob | string, crop: Crop, isNew: boolean): Promise<void> {
  const img = await loadImage(original);
  const { cropped, thumb } = await renderCrop(img, crop);
  const upload = await uploadSet(isNew && original instanceof Blob ? { original, cropped, thumb } : { cropped, thumb });
  try {
    await api('PUT', '/profile/photo', { upload, crop });
  } catch (e) {
    discardUpload(upload);
    throw e;
  }
}

export const removeProfilePhoto = () => api('DELETE', '/profile/photo');

/** Your current original, for re-framing. */
export const ownOriginalUrl = (version: string) => ownProfilePhotoUrl(version, 'original');
