import { useEffect, useState } from 'preact/hooks';
import { PHOTO_LIMIT, PHOTO_LIMIT_TEXT, PHOTO_WARN } from '../../../shared/domain/trust';
import { lastPhotoCount, onPhotoCount } from '../images';
import { useSession } from '../session';

// D84: near the photo limit, wherever photos are added: how many are left, or that it's full.

const n = (x: number) => x.toLocaleString('en-GB');

export function PhotoRoom() {
  const { me } = useSession();
  const [count, setCount] = useState(() => lastPhotoCount() ?? me.photoCount ?? 0);
  useEffect(() => onPhotoCount(setCount), []);
  if (count < PHOTO_WARN) return null;
  if (count >= PHOTO_LIMIT)
    return (
      <p class="room full" role="alert">
        {PHOTO_LIMIT_TEXT}
      </p>
    );
  return (
    <p class="room" role="status">
      You’ve got {n(count)} photos. An account can have {n(PHOTO_LIMIT)}, so there’s room for {n(PHOTO_LIMIT - count)} more.
    </p>
  );
}
