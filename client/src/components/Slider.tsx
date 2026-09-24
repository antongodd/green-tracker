import { useRef } from 'preact/hooks';

/**
 * Our own slider instead of <input type="range">. Safari cancels a drag when a
 * native range's thumb restyles mid-gesture, which is exactly what happens on a
 * rating's first touch (unrated → rated). Here the thumb is a plain element, so
 * one continuous drag from "unrated" works, and so does:
 *  - starting anywhere on the bar, not just on the small thumb;
 *  - a tap to jump to a value;
 *  - a vertical swipe that starts on the bar still scrolls the page (touch-action: pan-y;
 *    a touch only takes over once it moves sideways).
 * Keyboard: arrows ±step, Page Up/Down ±bigStep, Home/End.
 */
export function Slider(p: {
  id?: string;
  min: number;
  max: number;
  step: number;
  bigStep?: number;
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  valueText: string;
  variant?: 'rating' | 'steps';
}) {
  const el = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const span = p.max - p.min;
  const decimals = (String(p.step).split('.')[1] ?? '').length;

  const snap = (v: number) => {
    const n = Math.round((Math.min(p.max, Math.max(p.min, v)) - p.min) / p.step) * p.step + p.min;
    return Number(n.toFixed(decimals));
  };
  const fromX = (clientX: number) => {
    const r = el.current!.getBoundingClientRect();
    // The thumb's centre travels between the ends inset by its radius.
    const inset = 13;
    const frac = (clientX - r.left - inset) / Math.max(1, r.width - inset * 2);
    return snap(p.min + frac * span);
  };
  const set = (v: number) => {
    if (v !== p.value) p.onChange(v);
  };

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    // A mouse or pen means it straight away; a finger might be starting a scroll.
    if (e.pointerType !== 'touch') {
      gesture.current.dragging = true;
      el.current!.setPointerCapture(e.pointerId);
      set(fromX(e.clientX));
    }
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.x) < 4 || Math.abs(e.clientY - g.y) > Math.abs(e.clientX - g.x)) return;
      g.dragging = true;
      el.current!.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    set(fromX(e.clientX));
  }
  function up(e: PointerEvent) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    // A tap sets the value; a drag ends exactly where the finger lifted
    // (browsers merge the last moves into the release).
    set(fromX(e.clientX));
    gesture.current = null;
  }
  function cancel() {
    gesture.current = null; // the browser took the touch for scrolling
  }
  function key(e: KeyboardEvent) {
    const cur = p.value ?? p.min;
    const big = p.bigStep ?? p.step * 10;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? (p.value === null ? p.min : cur + p.step)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? cur - p.step
      : e.key === 'PageUp' ? cur + big
      : e.key === 'PageDown' ? cur - big
      : e.key === 'Home' ? p.min
      : e.key === 'End' ? p.max
      : null;
    if (next === null) return;
    e.preventDefault();
    set(snap(next));
  }

  const pct = p.value === null ? 0 : ((p.value - p.min) / span) * 100;
  return (
    <div
      ref={el}
      id={p.id}
      class={`slider${p.variant === 'steps' ? ' slider--steps' : ''}${p.value === null ? ' slider--unset' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={p.value ?? undefined}
      aria-valuetext={p.valueText}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onKeyDown={key}
    >
      <div class="slider-track" />
      {p.variant !== 'steps' && <div class="slider-fill" style={{ width: `calc(13px + (100% - 26px) * ${pct / 100})` }} />}
      <div class="slider-thumb" style={{ left: `calc(13px + (100% - 26px) * ${pct / 100})` }} />
    </div>
  );
}
