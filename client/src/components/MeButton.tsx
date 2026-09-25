import { useEffect, useState } from 'preact/hooks';
import { ownProfilePhotoUrl } from '../../../shared/domain/photo';
import { linkTo } from '../router';
import { useSession } from '../session';
import { Avatar } from './Avatar';

// You, in the top-right corner of the four main tabs (D25): your profile photo, or
// your letter until you add one. Tapping it opens People with your card.

/**
 * Your thumbnail, fetched once per version and kept on the device as a blob URL,
 * with a decoded image held here so the header — rebuilt on every tab switch —
 * shows it on its first frame instead of flashing the letter while it revalidates.
 */
const kept = new Map<string, { url: string; img: HTMLImageElement }>();

function useOwnThumb(version: string | undefined): string | undefined {
  const [src, setSrc] = useState(() => (version ? kept.get(version)?.url : undefined));
  useEffect(() => {
    if (!version) return setSrc(undefined);
    const hit = kept.get(version);
    if (hit) return setSrc(hit.url);
    let live = true;
    const direct = ownProfilePhotoUrl(version, 'thumb');
    fetch(direct, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(async (blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        for (const old of kept.values()) URL.revokeObjectURL(old.url); // only the current photo is kept
        kept.clear();
        kept.set(version, { url, img });
        if (live) setSrc(url);
      })
      // Offline or refused: the ordinary URL, which falls back to the letter if it can't load.
      .catch(() => live && setSrc(direct));
    return () => {
      live = false;
    };
  }, [version]);
  return src;
}

/** `onHere` replaces the navigation on People itself (back to the top, search cleared). */
export function MeButton(p: { onHere?: () => void }) {
  const { me } = useSession();
  const src = useOwnThumb(me.user?.photo?.version);
  if (!me.user) return null;
  const go = linkTo('/people');
  return (
    <a
      class="hbtn me-btn"
      href="/people"
      aria-label={`Your profile (@${me.user.username})`}
      onClick={(e) => {
        if (!p.onHere) return go(e);
        e.preventDefault();
        p.onHere();
      }}
    >
      <Avatar username={me.user.username} src={src} size="hd" />
    </a>
  );
}
