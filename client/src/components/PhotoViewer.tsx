import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Crop } from '../../../shared/domain/photo';
import { BackIcon, CropIcon, CutoutIcon, StarFillIcon, StarIcon, TrashIcon } from '../icons';

/** A photo as the screens show it: server URLs, or local previews for unsaved edits. */
export interface ShownPhoto {
  key: string;
  thumb: string;
  image: string;
  /** Where the cropper loads the uncropped original from. */
  original: string | Blob;
  crop: Crop | null;
  uploading?: boolean;
  /** D26: the background has been removed (the image and thumbnail are transparent PNGs). */
  cutout?: boolean;
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

/** D53: the most a photo zooms in (the saved photo is 1600px across: about its full detail on an iPhone). */
export const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 300;
type Zoom = { s: number; x: number; y: number };
const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };

/**
 * Full-screen viewer (brief §6.9): full-bleed black over header and tabs, close
 * top-left, swipe between photos (P8). D52 (0.44.0): a bar along the bottom with
 * Set as cover (a product's photos; "The cover" on the first), Crop, Cut out (D26;
 * Restore background on a photo already cut out) and, in an editor, Remove.
 * Someone else's photos get no bar.
 * D53 (0.45.0): zoom. Pinch (1×–4×, the spot between the fingers stays put), double-tap
 * for 2× there and back, drag to look around (the photo stops at its edges). Zoomed in,
 * the top and the bar slide away ("clear view"); one tap brings them back. Swiping to
 * another photo only when zoomed right out, so the viewer handles swipes itself (the
 * phone's own scrolling can't be combined with pinching); a photo always starts at 1×.
 */
export function PhotoViewer(p: {
  photos: ShownPhoto[];
  start: number;
  onClose: () => void;
  onCrop?: (i: number) => void;
  onRemove?: (i: number) => void;
  onCutout?: (i: number) => void;
  onRestore?: (i: number) => void;
  onCover?: (i: number) => void;
}) {
  useLockScroll();
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(p.start);
  const indexRef = useRef(p.start);
  // The zoom lives in a ref and is drawn straight onto the photo (every frame of a pinch);
  // state only says whether it's zoomed (clear view) and the scale for the "2.4×" note.
  const zoom = useRef<Zoom>(NO_ZOOM);
  const [zoomed, setZoomed] = useState(false);
  const [controls, setControls] = useState(false);
  const [scaleNote, setScaleNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>();
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  const hasBar = !!(p.onCover || p.onCrop || p.onCutout || p.onRemove);

  const img = () => strip.current?.children[indexRef.current]?.querySelector('img') ?? null;

  /** Where the photo may sit at scale `s`: it covers the screen where it's bigger than it, else stays on it. */
  function clamp(z: Zoom): Zoom {
    const el = img();
    const st = stage.current;
    if (!el || !st) return NO_ZOOM;
    const S = st.getBoundingClientRect();
    // The photo's centre at 1×, measured without the zoom (offsets ignore transforms).
    const slide = el.parentElement!;
    const cx = slide.offsetLeft - indexRef.current * S.width + el.offsetLeft + el.offsetWidth / 2;
    const cy = el.offsetTop + el.offsetHeight / 2;
    const range = (size: number, centre: number, screen: number) => {
      const half = (size * z.s) / 2;
      const a = screen - half - centre;
      const b = half - centre;
      return [Math.min(a, b), Math.max(a, b)] as const;
    };
    const [xl, xh] = range(el.offsetWidth, cx, S.width);
    const [yl, yh] = range(el.offsetHeight, cy, S.height);
    return { s: z.s, x: Math.min(xh, Math.max(xl, z.x)), y: Math.min(yh, Math.max(yl, z.y)) };
  }

  /** The photo's centre on screen at 1× (for keeping the spot under the fingers). */
  function centre() {
    const el = img()!;
    const S = stage.current!.getBoundingClientRect();
    return { x: S.left + S.width / 2, y: S.top + el.offsetTop + el.offsetHeight / 2 };
  }

  function draw(z: Zoom, animate: boolean) {
    zoom.current = z;
    const el = img();
    if (el) {
      el.classList.toggle('glide', animate);
      el.style.transform = z.s === 1 && !z.x && !z.y ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
    }
    const on = z.s > 1.01;
    setZoomed(on);
    if (!on) setControls(false);
  }
  function showScale(s: number) {
    setScaleNote(`${s.toFixed(1)}×`);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setScaleNote(null), 900);
  }

  function slideTo(i: number, animate = true) {
    const n = Math.min(p.photos.length - 1, Math.max(0, i));
    // The photo being left goes back to 1× (unseen); the next one starts at 1×.
    draw(NO_ZOOM, false);
    indexRef.current = n;
    setIndex(n);
    const el = strip.current!;
    el.classList.toggle('glide', animate);
    el.style.transform = `translateX(${-n * 100}%)`;
  }
  useLayoutEffect(() => slideTo(p.start, false), []);
  // Attached before the first paint, so no key press can arrive before it.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') slideTo(indexRef.current + (e.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    // iPhone: a pinch must zoom the photo, never the whole page.
    const noPageZoom = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', noPageZoom);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('gesturestart', noPageZoom);
    };
  }, [p.onClose]);
  useEffect(() => () => (clearTimeout(noteTimer.current), clearTimeout(tapTimer.current)), []);

  // Gestures. Two fingers: pinch (and move). One finger: look around when zoomed, else swipe.
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ pinch?: { d: number; m: { x: number; y: number }; z: Zoom }; pan?: { x: number; y: number; z: Zoom }; swipe?: { x: number; y: number }; moved: boolean; lastTap: number }>({ moved: false, lastTap: 0 });

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stage.current!.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;
    s.moved = false;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: zoom.current };
      s.pan = s.swipe = undefined;
      snapBack();
    } else if (pts.current.size === 1) {
      if (zoom.current.s > 1.01) s.pan = { x: e.clientX, y: e.clientY, z: zoom.current };
      else s.swipe = { x: e.clientX, y: e.clientY };
    }
  }
  function move(e: PointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;
    if (s.pinch && pts.current.size === 2) {
      s.moved = true;
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // A little past the limits while pinching; it settles back on release.
      const scale = Math.min(MAX_ZOOM * 1.15, Math.max(0.85, (s.pinch.z.s * d) / s.pinch.d));
      const c = centre();
      const k = scale / s.pinch.z.s;
      draw({ s: scale, x: m.x - c.x - (s.pinch.m.x - c.x - s.pinch.z.x) * k, y: m.y - c.y - (s.pinch.m.y - c.y - s.pinch.z.y) * k }, false);
      showScale(Math.min(MAX_ZOOM, Math.max(1, scale)));
    } else if (s.pan) {
      if (Math.hypot(e.clientX - s.pan.x, e.clientY - s.pan.y) > 6) s.moved = true;
      draw(clamp({ s: s.pan.z.s, x: s.pan.z.x + e.clientX - s.pan.x, y: s.pan.z.y + e.clientY - s.pan.y }), false);
    } else if (s.swipe) {
      const dx = e.clientX - s.swipe.x;
      if (Math.abs(dx) > 6) s.moved = true;
      const i = indexRef.current;
      const edge = (i === 0 && dx > 0) || (i === p.photos.length - 1 && dx < 0) ? 0.3 : 1;
      const el = strip.current!;
      el.classList.remove('glide');
      el.style.transform = `translateX(calc(${-i * 100}% + ${dx * edge}px))`;
    }
  }
  function snapBack() {
    const el = strip.current!;
    el.classList.add('glide');
    el.style.transform = `translateX(${-indexRef.current * 100}%)`;
  }
  function up(e: PointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    const s = g.current;
    if (s.pinch) {
      if (pts.current.size < 2) {
        s.pinch = undefined;
        const z = zoom.current;
        draw(z.s < 1.02 ? NO_ZOOM : clamp({ ...z, s: Math.min(MAX_ZOOM, z.s) }), true);
        // One finger still down: carry on looking around with it.
        const rest = [...pts.current.values()][0];
        if (rest) s.pan = { x: rest.x, y: rest.y, z: zoom.current };
      }
      return;
    }
    if (s.swipe) {
      const dx = e.clientX - s.swipe.x;
      s.swipe = undefined;
      if (Math.abs(dx) > Math.min(60, stage.current!.clientWidth / 5)) slideTo(indexRef.current + (dx < 0 ? 1 : -1));
      else snapBack();
    }
    s.pan = undefined;
    if (!s.moved && e.type === 'pointerup') tap(e);
  }
  function tap(e: PointerEvent) {
    const s = g.current;
    const now = Date.now();
    if (now - s.lastTap < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer.current);
      s.lastTap = 0;
      if (zoom.current.s > 1.01) draw(NO_ZOOM, true);
      else {
        const c = centre();
        draw(clamp({ s: 2, x: -(e.clientX - c.x), y: -(e.clientY - c.y) }), true);
        showScale(2);
      }
      return;
    }
    s.lastTap = now;
    // One tap while zoomed: the buttons come back (or go again). Waits to be sure it isn't a double-tap.
    tapTimer.current = setTimeout(() => zoom.current.s > 1.01 && setControls((v) => !v), DOUBLE_TAP_MS);
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    const z = zoom.current;
    const scale = Math.min(MAX_ZOOM, Math.max(1, z.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.003))));
    if (scale === 1) return draw(NO_ZOOM, false);
    const c = centre();
    const k = scale / z.s;
    draw(clamp({ s: scale, x: e.clientX - c.x - (e.clientX - c.x - z.x) * k, y: e.clientY - c.y - (e.clientY - c.y - z.y) * k }), false);
    showScale(scale);
  }
  useEffect(() => {
    const el = stage.current!;
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const current = p.photos[index];
  const clear = zoomed && !controls;

  return (
    <div class={`viewer${hasBar ? ' has-bar' : ''}${clear ? ' clear' : ''}`} role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div
        class="viewer-stage"
        ref={stage}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        tabIndex={0}
        role="group"
        aria-label={`Photos. Pinch or double-tap to zoom${zoomed ? `; zoomed in` : ''}.`}
      >
        <div class="viewer-strip" ref={strip}>
          {p.photos.map((ph, i) => (
            <div class="viewer-slide" key={ph.key}>
              <img src={ph.image} alt={`Photo ${i + 1} of ${p.photos.length}${ph.cutout ? ', background removed' : ''}`} draggable={false} />
            </div>
          ))}
        </div>
      </div>
      {scaleNote && (
        <span class="viewer-scale num" aria-hidden="true">
          {scaleNote}
        </span>
      )}
      <div class="viewer-top" inert={clear}>
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
      {/* Someone else's photos are read-only: no bar (brief §5). */}
      {(p.onCover || p.onCrop || p.onCutout || p.onRemove) && (
        <div class="viewer-bar" inert={clear}>
          {p.onCover &&
            (index === 0 ? (
              <button type="button" class="on" disabled>
                <StarFillIcon /> The cover
              </button>
            ) : (
              <button type="button" onClick={() => p.onCover!(index)} disabled={!current || current.uploading}>
                <StarIcon /> Set as cover
              </button>
            ))}
          {p.onCrop && (
            <button type="button" onClick={() => p.onCrop!(index)} disabled={!current || current.uploading}>
              <CropIcon /> Crop
            </button>
          )}
          {p.onCutout && current && !current.cutout && (
            <button type="button" onClick={() => p.onCutout!(index)} disabled={current.uploading}>
              <CutoutIcon /> Cut out
            </button>
          )}
          {p.onRestore && current?.cutout && (
            <button type="button" onClick={() => p.onRestore!(index)} disabled={current.uploading}>
              <CutoutIcon /> Restore background
            </button>
          )}
          {p.onRemove && (
            <button type="button" class="dng" onClick={() => p.onRemove!(index)}>
              <TrashIcon /> Remove
            </button>
          )}
        </div>
      )}
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
/** Largest square (in image pixels) centred in `b`, for an image `aspect` (width ÷ height) wide. */
function squareIn(b: Box, aspect: number): Box {
  const side = Math.min(b.w * aspect, b.h); // in units of image height
  const w = side / aspect;
  const h = side;
  return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
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
  const toSquare = (b: Box): Box => squareIn(b, aspect);

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
              onLoad={(e) => {
                const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                setNatural(n);
                // Square tapped before the photo loaded was squared with the wrong proportions (the
                // size wasn't known): square it again now, in the load itself, so a Reset or Free
                // tapped a moment later can't be undone by it. Harmless on a box that's already square.
                if (square) setBox((b) => squareIn(b, n.w / n.h));
              }}
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
