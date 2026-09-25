import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Crop } from '../../../shared/domain/photo';
import { clampFrame, frameFromCrop, frameSide, frameToCrop, maxZoom, type Frame } from '../../../shared/domain/profilePhoto';
import { useLockScroll } from './PhotoViewer';

/**
 * Move and zoom (D23): frames a profile photo inside a fixed circle. Drag to move,
 * pinch or the slider to zoom; with a keyboard, arrow keys move and + / − zoom.
 * Full-bleed black like the photo cropper. The result is a square crop of the original.
 */
export function AvatarCropper(p: { original: string | Blob; crop: Crop | null; busy?: boolean; error?: string; onCancel: () => void; onApply: (crop: Crop) => void }) {
  useLockScroll();
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [loadError, setLoadError] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    if (typeof p.original === 'string') return setSrc(p.original);
    const url = URL.createObjectURL(p.original);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [p.original]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (el) setStage({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const diameter = Math.max(0, Math.min(stage.w - 32, stage.h - 32, 360));
  const n = natural;
  const f = n && frame ? frame : null;
  const scale = n && f ? diameter / frameSide(n.w, n.h, f.zoom) : 0;
  const update = (next: (f: Frame) => Frame) => setFrame((cur) => (cur && n ? clampFrame(n.w, n.h, next(cur)) : cur));

  const down = (e: PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Not a live pointer (e.g. already released): moves still arrive on the stage.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const move = (e: PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev || !scale) return;
    const before = [...map.values()];
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...map.values()];
    if (after.length === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      update((f) => ({ ...f, cx: f.cx - dx / scale, cy: f.cy - dy / scale }));
    } else if (after.length === 2) {
      // Pinch: zoom by the change in finger distance, pan with their midpoint.
      const dist = (a: { x: number; y: number }[]) => Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y) || 1;
      const mid = (a: { x: number; y: number }[]) => ({ x: (a[0]!.x + a[1]!.x) / 2, y: (a[0]!.y + a[1]!.y) / 2 });
      const ratio = dist(after) / dist(before);
      const m0 = mid(before);
      const m1 = mid(after);
      update((f) => ({ zoom: f.zoom * ratio, cx: f.cx - (m1.x - m0.x) / scale, cy: f.cy - (m1.y - m0.y) / scale }));
    }
  };
  const up = (e: PointerEvent) => pointers.current.delete(e.pointerId);

  const keys = (e: KeyboardEvent) => {
    if (!n) return;
    const step = frameSide(n.w, n.h, frame?.zoom ?? 1) * 0.05;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key]!;
      update((f) => ({ ...f, cx: f.cx + dx, cy: f.cy + dy }));
    } else if (e.key === '+' || e.key === '=') update((f) => ({ ...f, zoom: f.zoom * 1.1 }));
    else if (e.key === '-' || e.key === '_') update((f) => ({ ...f, zoom: f.zoom / 1.1 }));
    else return;
    e.preventDefault();
  };

  return (
    <div class="cropper avatar-cropper" role="dialog" aria-modal="true" aria-label="Move and zoom">
      <div class="cropper-top">
        <button type="button" class="hbtn" onClick={p.onCancel} disabled={p.busy}>
          Cancel
        </button>
        <strong class="cropper-title">Move and zoom</strong>
        <button type="button" class="btn primary sm" onClick={() => n && frame && p.onApply(frameToCrop(n.w, n.h, frame))} disabled={!f || p.busy}>
          {p.busy ? 'Saving…' : 'Apply'}
        </button>
      </div>
      <div
        class="avatar-stage"
        ref={stageRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        tabIndex={0}
        role="group"
        aria-label="Photo framing"
        aria-describedby="avatar-crop-help"
        onKeyDown={keys}
        data-frame={f && n ? JSON.stringify(frameToCrop(n.w, n.h, f)) : undefined}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={f && n ? { width: `${n.w * scale}px`, height: `${n.h * scale}px`, left: `${stage.w / 2 - f.cx * scale}px`, top: `${stage.h / 2 - f.cy * scale}px` } : { visibility: 'hidden' }}
            onLoad={(e) => {
              const w = e.currentTarget.naturalWidth;
              const h = e.currentTarget.naturalHeight;
              setNatural({ w, h });
              setFrame(frameFromCrop(w, h, p.crop));
            }}
            onError={() => setLoadError('The photo couldn’t be loaded.')}
          />
        )}
        <span class="avatar-ring" style={{ width: `${diameter}px`, height: `${diameter}px` }} aria-hidden="true" />
      </div>
      <p id="avatar-crop-help" class="visually-hidden">Drag to move the photo and pinch to zoom. With a keyboard, arrow keys move it and plus or minus zoom.</p>
      <div class="avatar-bottom">
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={n ? maxZoom(n.w, n.h) : 1}
          step={0.01}
          value={frame?.zoom ?? 1}
          disabled={!f}
          onInput={(e) => {
            const zoom = Number(e.currentTarget.value);
            update((f) => ({ ...f, zoom }));
          }}
        />
        <span>Drag to move · pinch or slide to zoom</span>
        {(p.error || loadError) && (
          <p class="error" role="alert">
            {p.error || loadError}
          </p>
        )}
      </div>
    </div>
  );
}
