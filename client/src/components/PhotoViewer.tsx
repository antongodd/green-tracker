import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Crop } from '../../../shared/domain/photo';
import { BackIcon, CropIcon } from '../icons';

/** A photo as the screens show it: server URLs, or local previews for unsaved edits. */
export interface ShownPhoto {
  key: string;
  thumb: string;
  image: string;
  /** Where the cropper loads the uncropped original from. */
  original: string | Blob;
  crop: Crop | null;
  uploading?: boolean;
}

/** Stops the page behind an overlay from scrolling while it's open. */
export function useLockScroll() {
  useEffect(() => {
    const y = window.scrollY;
    const s = document.body.style;
    const prev = { position: s.position, top: s.top, width: s.width };
    s.position = 'fixed';
    s.top = `-${y}px`;
    s.width = '100%';
    return () => {
      Object.assign(s, prev);
      window.scrollTo(0, y);
    };
  }, []);
}

/**
 * Full-screen viewer (brief §6.9): full-bleed black over header and tabs, close
 * top-left, swipe between photos (P8), "Crop this photo" at the bottom.
 */
export function PhotoViewer(p: { photos: ShownPhoto[]; start: number; onClose: () => void; onCrop?: (i: number) => void; onRemove?: (i: number) => void }) {
  useLockScroll();
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(p.start);

  useLayoutEffect(() => {
    const el = strip.current!;
    el.scrollLeft = p.start * el.clientWidth;
  }, []);
  // Attached before the first paint, so no key press can arrive before it.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const el = strip.current!;
        el.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * el.clientWidth, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);

  const onScroll = () => {
    const el = strip.current!;
    setIndex(Math.min(p.photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const current = p.photos[index];

  return (
    <div class="viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div class="viewer-top">
        <button type="button" class="viewer-btn" onClick={p.onClose} aria-label="Close" autoFocus>
          <BackIcon />
        </button>
        {p.photos.length > 1 && (
          <span class="viewer-count num" aria-live="polite">
            {index + 1} / {p.photos.length}
          </span>
        )}
        <span class="viewer-btn" aria-hidden="true" />
      </div>
      <div class="viewer-strip" ref={strip} onScroll={onScroll}>
        {p.photos.map((ph, i) => (
          <div class="viewer-slide" key={ph.key}>
            <img src={ph.image} alt={`Photo ${i + 1} of ${p.photos.length}`} draggable={false} />
          </div>
        ))}
      </div>
      <div class="viewer-bottom">
        {/* Someone else's photos are read-only: no crop (brief §5). */}
        {p.onCrop && (
          <button type="button" class="btn secondary" onClick={() => p.onCrop!(index)} disabled={!current || current.uploading}>
            <CropIcon /> Crop this photo
          </button>
        )}
        {p.onRemove && (
          <button type="button" class="btn text danger-text" onClick={() => p.onRemove!(index)}>
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

type Box = { x: number; y: number; w: number; h: number };

/** The image's on-screen size: as large as fits the stage, same proportions. */
function frameSize(n: { w: number; h: number } | null, s: { w: number; h: number } | null) {
  if (!n || !s) return { visibility: 'hidden' as const };
  const scale = Math.min(s.w / n.w, s.h / n.h);
  return { width: `${Math.floor(n.w * scale)}px`, height: `${Math.floor(n.h * scale)}px` };
}
type Drag = { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; id: number; start: { x: number; y: number }; box: Box };
const MIN = 0.08;

/**
 * Cropper (brief §6.9): full-bleed black; Cancel · Free | Square · Apply; a crop
 * box with corner handles over a dimmed surround; drag inside to move; Reset to
 * original. Works in fractions of the original, so crops never compound.
 */
export function Cropper(p: { original: string | Blob; crop: Crop | null; onCancel: () => void; onApply: (crop: Crop | null) => void }) {
  useLockScroll();
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [square, setSquare] = useState(p.crop?.square ?? false);
  const [box, setBox] = useState<Box>(p.crop ? { x: p.crop.x, y: p.crop.y, w: p.crop.w, h: p.crop.h } : { x: 0, y: 0, w: 1, h: 1 });
  const [error, setError] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => stage.current && setStageSize({ w: stage.current.clientWidth, h: stage.current.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (typeof p.original !== 'string') {
      const url = URL.createObjectURL(p.original);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setSrc(p.original);
  }, [p.original]);

  const aspect = natural ? natural.w / natural.h : 1;
  /** Largest square (in image pixels) centred in `b`. */
  const toSquare = (b: Box): Box => {
    const side = Math.min(b.w * aspect, b.h); // in units of image height
    const w = side / aspect;
    const h = side;
    return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
  };

  function setMode(sq: boolean) {
    setSquare(sq);
    if (sq) setBox((b) => toSquare(b));
  }

  function down(e: PointerEvent, mode: Drag['mode']) {
    e.stopPropagation();
    e.preventDefault();
    const r = frame.current!.getBoundingClientRect();
    drag.current = { mode, id: e.pointerId, start: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, box };
    frame.current!.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const r = frame.current!.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - d.start.x;
    const dy = (e.clientY - r.top) / r.height - d.start.y;
    const b = d.box;
    if (d.mode === 'move') {
      setBox({ ...b, x: Math.min(1 - b.w, Math.max(0, b.x + dx)), y: Math.min(1 - b.h, Math.max(0, b.y + dy)) });
      return;
    }
    // Resize from a corner, keeping the opposite corner fixed.
    const west = d.mode === 'nw' || d.mode === 'sw';
    const north = d.mode === 'nw' || d.mode === 'ne';
    const ax = west ? b.x + b.w : b.x;
    const ay = north ? b.y + b.h : b.y;
    let w = Math.max(MIN, Math.min(west ? ax : 1 - ax, b.w + (west ? -dx : dx)));
    let h = Math.max(MIN, Math.min(north ? ay : 1 - ay, b.h + (north ? -dy : dy)));
    if (square) {
      // Equal sides in image pixels, limited by the room on both axes.
      const side = Math.min(Math.max(w * aspect, h), (west ? ax : 1 - ax) * aspect, north ? ay : 1 - ay);
      w = side / aspect;
      h = side;
    }
    setBox({ x: west ? ax - w : ax, y: north ? ay - h : ay, w, h });
  }
  function up(e: PointerEvent) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  /** Keyboard: arrows move the box; Shift + arrows resize it (keeping Square square). */
  function keyMove(e: KeyboardEvent) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = 0.02;
    setBox((b) => {
      if (!e.shiftKey) return { ...b, x: Math.min(1 - b.w, Math.max(0, b.x + d[0]! * step)), y: Math.min(1 - b.h, Math.max(0, b.y + d[1]! * step)) };
      let w = Math.max(MIN, Math.min(1 - b.x, b.w + (d[0] || d[1])! * step));
      let h = Math.max(MIN, Math.min(1 - b.y, b.h + (d[1] || d[0])! * step));
      if (square) {
        const side = Math.min(w * aspect, h, (1 - b.x) * aspect, 1 - b.y);
        w = side / aspect;
        h = side;
      }
      return { ...b, w, h };
    });
  }

  function reset() {
    setSquare(false);
    setBox({ x: 0, y: 0, w: 1, h: 1 });
  }

  function apply() {
    const full = !square && box.x < 0.001 && box.y < 0.001 && box.w > 0.999 && box.h > 0.999;
    p.onApply(full ? null : { ...box, square });
  }

  const pct = (v: number) => `${v * 100}%`;
  return (
    <div class="cropper" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div class="cropper-top">
        <button type="button" class="hbtn" onClick={p.onCancel}>
          Cancel
        </button>
        <div class="segmented" role="radiogroup" aria-label="Crop shape">
          <button type="button" role="radio" aria-checked={!square} class={!square ? 'on' : ''} onClick={() => setMode(false)}>
            Free
          </button>
          <button type="button" role="radio" aria-checked={square} class={square ? 'on' : ''} onClick={() => setMode(true)}>
            Square
          </button>
        </div>
        <button type="button" class="btn primary sm" onClick={apply} disabled={!natural}>
          Apply
        </button>
      </div>
      <div class="cropper-stage" ref={stage}>
        {src && (
          <div class="cropper-frame" ref={frame} style={frameSize(natural, stageSize)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <img
              src={src}
              alt="Photo to crop"
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setError('The original photo couldn’t be loaded.')}
            />
            {natural && (
              <div
                class="crop-box"
                style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
                onPointerDown={(e) => down(e, 'move')}
                role="group"
                aria-label="Crop area"
                aria-describedby="crop-help"
                tabIndex={0}
                onKeyDown={keyMove}
              >
                {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                  <span key={c} class={`handle ${c}`} onPointerDown={(e) => down(e, c)} aria-hidden="true" />
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p class="error">{error}</p>}
      </div>
      <p id="crop-help" class="visually-hidden">Drag the box or its corners. With a keyboard, arrow keys move it and Shift with arrow keys resizes it.</p>
      <div class="cropper-bottom">
        <button type="button" class="btn text" onClick={reset}>
          Reset to original
        </button>
      </div>
    </div>
  );
}
