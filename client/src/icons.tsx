// Marks from design brief Appendix A (24×24, currentColor) and the approved
// tab-bar icons (P1). The type marks' evenodd rules are load-bearing.
import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

type P = { class?: string; label?: string };
const a11y = (label?: string): JSX.SVGAttributes<SVGSVGElement> => (label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true });

/** Header leaf, "glass" variant. Gradient ids are per instance: duplicates break rendering. */
export function LeafGlass(p: P) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fill = `lg${id}`;
  const edge = `le${id}`;
  const leaflet = 'M0 0 C-3.6 -7.5 -2.4 -16.6 0 -21 C2.4 -16.6 3.6 -7.5 0 0 Z';
  return (
    <svg viewBox="0 0 34 34" fill="none" class={p.class} {...a11y(p.label)}>
      <defs>
        <linearGradient id={fill} x1="17" y1="4" x2="17" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#8df3b6" stop-opacity="0.88" />
          <stop offset="0.5" stop-color="#58e08c" stop-opacity="0.6" />
          <stop offset="1" stop-color="#2fb86a" stop-opacity="0.34" />
        </linearGradient>
        <linearGradient id={edge} x1="17" y1="4" x2="17" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#b6ffd4" stop-opacity="0.95" />
          <stop offset="1" stop-color="#2fb86a" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <g transform="translate(17 26)" fill={`url(#${fill})`} stroke={`url(#${edge})`} stroke-width="1" stroke-linejoin="round">
        <path d={leaflet} transform="rotate(-80) scale(0.54)" />
        <path d={leaflet} transform="rotate(80) scale(0.54)" />
        <path d={leaflet} transform="rotate(-41) scale(0.8)" />
        <path d={leaflet} transform="rotate(41) scale(0.8)" />
        <path d={leaflet} />
        <path d="M0 0 L0 4.4" stroke={`url(#${edge})`} stroke-width="1.5" stroke-linecap="round" />
      </g>
    </svg>
  );
}

const FLOWER =
  'M12 18.35C8.95 19.21 5.61 18.16 4.12 16.96C5.93 16.35 9.42 16.51 12 18.35Z M12 18.35C14.58 16.51 18.07 16.35 19.88 16.96C18.39 18.16 15.05 19.21 12 18.35Z M12 18.35C7.69 16.49 4.83 12.17 4.22 9.4C6.87 10.39 10.76 13.82 12 18.35Z M12 18.35C13.24 13.82 17.13 10.39 19.78 9.4C19.17 12.17 16.31 16.49 12 18.35Z M12 18.35C9.46 13.06 10.31 6.64 12 3.53C13.69 6.64 14.54 13.06 12 18.35Z M11.45 18.35H12.55V21.46H11.45Z';

export function FlowerMark(p: P) {
  return (
    <svg viewBox="0 0 24 24" class={p.class} {...a11y(p.label)}>
      <path fill="currentColor" d={FLOWER} />
    </svg>
  );
}

/** Outlined leaf for empty states (brief §6.10). */
export function LeafOutline(p: P) {
  return (
    <svg viewBox="0 0 24 24" class={p.class} {...a11y(p.label)}>
      <path fill="none" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round" d={FLOWER} />
    </svg>
  );
}

const icon = (d: string, opts: { evenodd?: boolean; stroke?: number; viewBox?: string } = {}) =>
  function Icon(p: P) {
    return (
      <svg viewBox={opts.viewBox ?? '0 0 24 24'} class={p.class} {...a11y(p.label)}>
        {opts.stroke ? (
          <path fill="none" stroke="currentColor" stroke-width={opts.stroke} stroke-linecap="round" stroke-linejoin="round" d={d} />
        ) : (
          <path fill="currentColor" fill-rule={opts.evenodd ? 'evenodd' : undefined} d={d} />
        )}
      </svg>
    );
  };

// Tab bar (P1): podium, notebook, two people, three dots.
export const BoardIcon = icon('M9 7.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20H9Z M2.5 12.5a1 1 0 0 1 1-1H8V20H3.5a1 1 0 0 1-1-1Z M16 14.5h4.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H16Z M12 1.9l.8 1.6 1.8.26-1.3 1.27.3 1.78L12 5.97l-1.6.84.3-1.78-1.3-1.27 1.8-.26Z');
export const LogIcon = icon('M6 2.5h11.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 6 2.5Z M8.5 7.25h8v1.5h-8Z M8.5 11.25h8v1.5h-8Z M8.5 15.25h5v1.5h-5Z', { evenodd: true });
export const PeopleIcon = icon('M9 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M1.5 19.5c0-3.3 3.4-5.5 7.5-5.5s7.5 2.2 7.5 5.5v.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5Z M16.5 11.2a3.3 3.3 0 1 0-1.1-6.4 5.5 5.5 0 0 1 0 6.2c.35.13.72.2 1.1.2Z M18 20.5h4a.5.5 0 0 0 .5-.5v-.4c0-2.6-2.3-4.4-5.4-4.8 1 1.1 1.4 2.4 1.4 3.8Z');
export const MoreIcon = icon('M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M19 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z');

// UI
export const BackIcon = icon('M15 4.5 7.5 12l7.5 7.5', { stroke: 2.4 });
export const ChevronRight = icon('M4.5 2.5 8 6l-3.5 3.5', { stroke: 1.8, viewBox: '0 0 12 12' });
export const CheckIcon = icon('M2.5 6.5 5 9l4.5-6', { stroke: 1.8, viewBox: '0 0 12 12' });
export const CrossIcon = icon('M2.5 2.5l7 7M9.5 2.5l-7 7', { stroke: 1.8, viewBox: '0 0 12 12' });
export const CopyIcon = icon('M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3', { stroke: 1.6, viewBox: '0 0 16 16' });
export const SaveIcon = icon('M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11', { stroke: 1.6, viewBox: '0 0 16 16' });
