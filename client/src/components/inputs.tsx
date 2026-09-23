import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { formatScore } from '../../../shared/domain/format';
import { HIT_TIME_MAX, HIT_TIME_STEP, RATING_MAX, RATING_MIN, formatHitTime } from '../../../shared/domain/ratings';
import { ChevronDown, CrossIcon } from '../icons';

/** Native select (iOS shows its own picker), styled as an input. */
export function Select(p: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <div class="field">
      <label for={p.id}>{p.label}</label>
      <div class="select">
        <select id={p.id} value={p.value} onChange={(e) => p.onChange(e.currentTarget.value)}>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown />
      </div>
    </div>
  );
}

export function TextField(p: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'decimal' | 'text' | 'url';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  children?: ComponentChildren;
}) {
  return (
    <div class="field">
      <label for={p.id}>{p.label}</label>
      <input
        id={p.id}
        class="input"
        type={p.type ?? 'text'}
        inputMode={p.inputMode}
        value={p.value}
        placeholder={p.placeholder}
        autoCapitalize={p.autoCapitalize}
        autoComplete="off"
        onInput={(e) => p.onInput(e.currentTarget.value)}
        onBlur={p.onBlur}
      />
      {p.children}
    </div>
  );
}

const clamp = (v: number) => Math.min(RATING_MAX, Math.max(RATING_MIN, v));

/**
 * One rating (brief §6.6): label, value (tap to type), ✕ to clear, and a 0.1-step
 * slider. Unrated shows — and an empty track; moving the slider rates it.
 */
export function RatingInput(p: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [typing, setTyping] = useState<string | null>(null);
  const v = p.value;
  const pct = v === null ? 0 : ((v - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100;

  function commit() {
    if (typing === null) return;
    const n = Number(typing.replace(',', '.'));
    if (typing.trim() === '') p.onChange(null);
    else if (Number.isFinite(n)) p.onChange(Math.round(clamp(n) * 10) / 10);
    setTyping(null);
  }

  return (
    <div class="rate">
      <div class="rate-top">
        <label class="l" for={`${p.id}-range`}>
          {p.label}
        </label>
        {typing === null ? (
          <button type="button" class={`val${v === null ? ' none' : ''}`} onClick={() => setTyping(v === null ? '' : formatScore(v))} aria-label={`${p.label}: ${v === null ? 'unrated' : formatScore(v)}. Tap to type a value`}>
            {v === null ? '—' : formatScore(v)}
          </button>
        ) : (
          <input
            class="val"
            inputMode="decimal"
            aria-label={`${p.label} (1 to 10)`}
            value={typing}
            ref={(el) => el?.focus()}
            onInput={(e) => setTyping(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
          />
        )}
        <button type="button" class={`clr${v === null ? ' hidden' : ''}`} onClick={() => p.onChange(null)} aria-label={`Clear ${p.label}`} tabIndex={v === null ? -1 : 0}>
          <CrossIcon />
        </button>
      </div>
      <input
        id={`${p.id}-range`}
        type="range"
        class={`range${v === null ? ' empty' : ''}`}
        min={RATING_MIN}
        max={RATING_MAX}
        step={0.1}
        value={v ?? RATING_MIN}
        style={{ '--pct': `${pct}%` }}
        aria-valuetext={v === null ? 'Unrated' : formatScore(v)}
        onInput={(e) => p.onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}

/**
 * Hit time (brief §6.7): a 13-stop duration picker, 0 → 3h. Deliberately not
 * styled like a score: no 1–10, no ✕ chrome, value shown as a duration.
 */
export function HitTimeInput(p: { value: number | null; onChange: (v: number | null) => void }) {
  const stops = HIT_TIME_MAX / HIT_TIME_STEP;
  return (
    <div class="hit">
      <div class="hit-top">
        <label for="hit-time">Hit time</label>
        <span class="d">
          {formatHitTime(p.value)}
          {p.value !== null && (
            <button type="button" class="btn text" style={{ display: 'inline', height: 'auto', padding: '0 0 0 12px', fontSize: '14px', width: 'auto' }} onClick={() => p.onChange(null)}>
              Not set
            </button>
          )}
        </span>
      </div>
      <input
        id="hit-time"
        type="range"
        class="range steps"
        min={0}
        max={stops}
        step={1}
        value={(p.value ?? 0) / HIT_TIME_STEP}
        aria-valuetext={formatHitTime(p.value)}
        onInput={(e) => p.onChange(Number(e.currentTarget.value) * HIT_TIME_STEP)}
      />
      <div class="ticks" aria-hidden="true">
        {Array.from({ length: stops + 1 }, (_, i) => (
          <i key={i} class={i % 4 === 0 ? 'maj' : ''} />
        ))}
      </div>
      <div class="ticks-lbl" aria-hidden="true">
        <span>0</span>
        <span>1h</span>
        <span>2h</span>
        <span>3h</span>
      </div>
    </div>
  );
}
