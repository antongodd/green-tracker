import { useState } from 'preact/hooks';

/**
 * A person's circle (design brief §9 People): their profile photo (D23) when you may
 * see it, otherwise the first letter of their username on --surface-3. The letter
 * stays underneath, so a photo that can't load (access just ended) falls back to it.
 */
export function Avatar(p: { username: string; src?: string; size?: 'hd' | 'lg' | 'xl' }) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = p.src && failed !== p.src ? p.src : undefined;
  return (
    <span class={`av${p.size ? ` ${p.size}` : ''}${photo ? ' has-photo' : ''}`} aria-hidden="true">
      {[...p.username][0]!.toUpperCase()}
      {photo && <img src={photo} alt="" draggable={false} onError={() => setFailed(photo)} />}
    </span>
  );
}
