import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { photoUrl, type PhotoRecord } from '../../../shared/domain/photo';
import { MoreIcon, StarFillIcon } from '../icons';
import type { ShownPhoto } from './PhotoViewer';

export const shownFromRecord = (ph: PhotoRecord): ShownPhoto => ({
  key: ph.id,
  thumb: photoUrl(ph, 'thumb'),
  image: photoUrl(ph, 'cropped'),
  original: photoUrl(ph, 'original'),
  crop: ph.crop,
  cutout: ph.cutout,
});

/** How long a press must last before the photo lifts to be dragged (D52). */
const HOLD_MS = 300;

/**
 * Photo grid (brief §6.9): 3 columns, square cells, 4px gaps; tapping a photo opens the viewer.
 * D52 (0.44.0): a product's first photo is its **cover**, marked with a gold ring and a star
 * (`cover`). In an editor each photo has a ⋯ button (`onMore`: Set as cover, Crop, Remove
 * background, Remove photo), and with `onMove` a photo can be pressed and held, then dragged
 * to a new place; the others slide out of its way.
 */
export function PhotoGrid(p: {
  photos: ShownPhoto[];
  onOpen: (i: number) => void;
  cover?: boolean;
  onMore?: (i: number) => void;
  onMove?: (from: number, to: number) => void;
  status?: (i: number) => string | null;
  children?: ComponentChildren;
}) {
  // While dragging: the order shown (indices into p.photos) and where the lifted photo is.
  const [order, setOrder] = useState<number[] | null>(null);
  const drag = useRef<{ from: number; key: string; x: number; y: number; ox: number; oy: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  /** The photos on screen, by key (read from the page each time, so never out of date). */
  const cells = () => new Map([...(grid.current?.querySelectorAll<HTMLDivElement>('.pslot') ?? [])].map((el) => [el.dataset.key!, el]));
  const before = useRef<Map<string, DOMRect> | null>(null);
  const suppressClick = useRef(false);
  const shown = order ?? p.photos.map((_, i) => i);

  // The photos that moved slide from where they were (measured before the change).
  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    if (!was || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const [key, el] of cells()) {
      const b = was.get(key);
      if (!b || key === drag.current?.key) continue;
      const a = el.getBoundingClientRect();
      if (b.left !== a.left || b.top !== a.top) el.animate([{ transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)` }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }
  });
  const measure = () => (before.current = new Map([...cells()].map(([k, el]) => [k, el.getBoundingClientRect()])));

  /** Moves the lifted photo under the finger (relative to the slot it now sits in). */
  const follow = () => {
    const d = drag.current;
    const el = d && cells().get(d.key);
    if (!d || !el) return;
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${d.x - d.ox - r.left}px, ${d.y - d.oy - r.top}px) scale(1.06)`;
  };
  useLayoutEffect(follow, [order]);

  // The page mustn't scroll while a photo is being dragged.
  useEffect(() => {
    const block = (e: TouchEvent) => drag.current && e.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  function press(e: PointerEvent, i: number) {
    if (!p.onMove || p.photos.length < 2 || e.button !== 0 || p.photos[i]!.uploading || (e.target as Element).closest('.more-photo')) return;
    const start = { x: e.clientX, y: e.clientY };
    const key = p.photos[i]!.key;
    let current = p.photos.map((_, j) => j);
    const lift = () => {
      const el = cells().get(key)!;
      const r = el.getBoundingClientRect();
      drag.current = { from: i, key, x: start.x, y: start.y, ox: start.x - r.left, oy: start.y - r.top };
      suppressClick.current = true;
      el.classList.add('lifted');
      setOrder(current);
    };
    const timer = setTimeout(lift, HOLD_MS);
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) end(); // a scroll, not a hold
        return;
      }
      d.x = ev.clientX;
      d.y = ev.clientY;
      // Over another photo: take its place. Where each photo sits in the grid, not where it is
      // mid-slide (a sliding photo under the finger would swap straight back).
      const g = grid.current!.getBoundingClientRect();
      const over = [...cells()].find(([k, el]) => {
        if (k === key) return false;
        const x = ev.clientX - g.left - el.offsetLeft;
        const y = ev.clientY - g.top - el.offsetTop;
        return x >= 0 && x <= el.offsetWidth && y >= 0 && y <= el.offsetHeight;
      });
      if (over) {
        const to = current.findIndex((j) => p.photos[j]!.key === over[0]);
        const at = current.findIndex((j) => j === i);
        if (to !== at) {
          current = [...current];
          current.splice(to, 0, ...current.splice(at, 1));
          measure();
          setOrder(current);
          return;
        }
      }
      follow();
    };
    const end = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      const d = drag.current;
      if (!d) return;
      const el = cells().get(key);
      if (el) {
        el.classList.remove('lifted');
        el.style.transform = '';
      }
      drag.current = null;
      setOrder(null);
      const to = current.indexOf(i);
      if (to !== i) p.onMove!(i, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  return (
    <div class={`pgrid${p.onMove ? ' movable' : ''}`} ref={grid}>
      {shown.map((i, at) => {
        const ph = p.photos[i]!;
        const status = p.status?.(i) ?? null;
        const isCover = !!p.cover && at === 0;
        return (
          <div
            key={ph.key}
            class={`pslot${isCover ? ' cover' : ''}`}
            data-key={ph.key}
            onPointerDown={(e) => press(e, i)}
            onContextMenu={(e) => p.onMove && e.preventDefault()}
          >
            <button
              type="button"
              class={`pcell${ph.uploading ? ' uploading' : ''}${ph.cutout ? ' cut' : ''}`}
              onClick={() => {
                if (suppressClick.current) return void (suppressClick.current = false);
                p.onOpen(i);
              }}
              aria-label={`Open photo ${i + 1}${isCover ? ', the cover' : ''}`}
            >
              <img src={ph.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
              {status && <span class={`state${status.startsWith('!') ? ' bad' : ''}`}>{status.replace(/^!/, '')}</span>}
            </button>
            {isCover && (
              <span class="cover-star" aria-hidden="true">
                <StarFillIcon />
              </span>
            )}
            {p.onMore && !ph.uploading && (
              <button type="button" class="more-photo" onClick={() => p.onMore!(i)} aria-label={`Options for photo ${i + 1}`}>
                <MoreIcon />
              </button>
            )}
          </div>
        );
      })}
      {p.children}
    </div>
  );
}
