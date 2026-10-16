import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { Point } from '../../../shared/domain/cutout';

/** The most the photo zooms while drawing. */
const MAX_ZOOM = 4;
/** Points closer than this (screen pixels) aren't added: smooth lines, short lists. */
const STEP = 3;

/**
 * Draw round it (D54, 0.46.0): the photo, on which one finger draws loops round the buds
 * to keep; letting go joins the loop up, and everything outside the loops goes dark. Two
 * fingers zoom (up to 4×) and move the photo, so a loop can be drawn precisely. Loops are
 * in the photo's own pixels; `onLoop` gets each finished one (a tap or a line doesn't count:
 * the caller filters them with realLoops).
 */
export function DrawLoops(p: { photo: HTMLCanvasElement; loops: Point[][]; onLoop: (loop: Point[]) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const zoomer = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Point[] | null>(null);
  const zoom = useRef({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; m: { x: number; y: number }; z: { s: number; x: number; y: number } } | null>(null);
  const W = p.photo.width;
  const H = p.photo.height;
  // Drawn at most 1200px across: sharp enough at 4×, light on memory.
  const k = Math.min(1, 1200 / Math.max(W, H));

  useLayoutEffect(() => {
    const c = shown.current!;
    c.width = over.current!.width = Math.round(W * k);
    c.height = over.current!.height = Math.round(H * k);
    c.getContext('2d')!.drawImage(p.photo, 0, 0, c.width, c.height);
    return () => {
      c.width = c.height = 0;
    };
  }, [p.photo]);

  /** The loops so far: the outside dark, each loop's line glowing green. */
  function paint() {
    const c = over.current;
    if (!c) return;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    const path = (loop: Point[]) => {
      x.beginPath();
      loop.forEach((q, i) => (i ? x.lineTo(q.x * k, q.y * k) : x.moveTo(q.x * k, q.y * k)));
    };
    if (p.loops.length) {
      x.fillStyle = 'rgba(0, 0, 0, 0.6)';
      x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-out';
      for (const l of p.loops) {
        path(l);
        x.closePath();
        x.fill();
      }
      x.globalCompositeOperation = 'source-over';
    }
    // The line keeps the same width on screen whatever the zoom.
    const css = c.getBoundingClientRect().width || c.width;
    x.lineWidth = (3 * c.width) / css;
    x.lineCap = x.lineJoin = 'round';
    x.strokeStyle = '#58e08c';
    x.shadowColor = 'rgba(88, 224, 140, 0.9)';
    x.shadowBlur = (10 * c.width) / css;
    for (const l of p.loops) {
      path(l);
      x.closePath();
      x.stroke();
    }
    if (drawing.current) {
      path(drawing.current);
      x.stroke();
    }
    x.shadowBlur = 0;
  }
  useLayoutEffect(paint, [p.loops]);

  const toPhoto = (e: PointerEvent): Point => {
    const b = shown.current!.getBoundingClientRect();
    return { x: Math.min(W, Math.max(0, ((e.clientX - b.left) / b.width) * W)), y: Math.min(H, Math.max(0, ((e.clientY - b.top) / b.height) * H)) };
  };
  const place = () => {
    const z = zoom.current;
    zoomer.current!.style.transform = z.s === 1 ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
  };

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stage.current!.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      // A second finger: a pinch, not a loop.
      drawing.current = null;
      paint();
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: { ...zoom.current } };
    } else if (pts.current.size === 1) drawing.current = [toPhoto(e)];
  }
  function move(e: PointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinch.current;
    if (pz && pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const st = stage.current!.getBoundingClientRect();
      const zr = zoomer.current!;
      // The zoomer's untransformed top-left inside the stage (it's centred there).
      const ox = st.left + zr.offsetLeft;
      const oy = st.top + zr.offsetTop;
      const s = Math.min(MAX_ZOOM, Math.max(1, (pz.z.s * d) / pz.d));
      const f = s / pz.z.s;
      zoom.current = s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: m.x - ox - (pz.m.x - ox - pz.z.x) * f, y: m.y - oy - (pz.m.y - oy - pz.z.y) * f };
      place();
      paint();
    } else if (drawing.current) {
      const q = toPhoto(e);
      const last = drawing.current[drawing.current.length - 1]!;
      const b = shown.current!.getBoundingClientRect();
      if (Math.hypot(q.x - last.x, q.y - last.y) * (b.width / W) >= STEP) {
        drawing.current.push(q);
        paint();
      }
    }
  }
  function up(e: PointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    if (pinch.current) {
      if (pts.current.size < 2) pinch.current = null;
      return;
    }
    const loop = drawing.current;
    drawing.current = null;
    if (loop && e.type === 'pointerup') p.onLoop(loop);
    paint();
  }
  useEffect(() => {
    // iPhone: a pinch zooms the photo, never the page.
    const no = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', no);
    return () => document.removeEventListener('gesturestart', no);
  }, []);

  return (
    <div class="draw-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div class="draw-zoom" ref={zoomer}>
        <canvas ref={shown} role="img" aria-label="Your photo. Draw a loop round each bud you want to keep." />
        <canvas ref={over} class="draw-over" aria-hidden="true" />
      </div>
    </div>
  );
}
