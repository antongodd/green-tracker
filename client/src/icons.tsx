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

// Type marks (brief §7, Appendix A). Other / Not set have no mark.
const CONCENTRATE = [
  'M11.87 8.08L20.89 3.47A1 1 0 0 0 19.91 1.73L11.33 7.12A0.55 0.55 0 0 0 11.87 8.08Z',
  'M8.75 9.5C8.75 7.65 9.95 6.5 11.4 6.5C12.95 6.5 14.1 7.7 14.1 9.5C14.1 11.45 12.6 12.3 12.25 14.1C12.05 15.25 11.98 15.95 11.68 16.75C11.48 17.28 10.98 17.28 10.8 16.75C10.52 15.9 10.42 15.1 10.3 14.1C10.03 12.2 8.75 11.4 8.75 9.5Z',
  'M11.3 17.24C12.61 18.81 13.05 19.86 13.05 20.3A1.75 1.75 0 1 1 9.55 20.3C9.55 19.86 9.99 18.81 11.3 17.24Z',
];
const COOKIE =
  'M21.1 12L21.08 12.4L21.04 12.79L20.97 13.18L20.88 13.57L20.78 13.95L20.66 14.32L20.51 14.68L20.36 15.04L20.18 15.39L20 15.73L19.8 16.06L19.59 16.38L19.36 16.69L19.13 16.99L18.89 17.29L18.64 17.57L18.38 17.85L18.12 18.12L17.84 18.38L17.57 18.63L17.28 18.88L16.98 19.12L16.68 19.35L16.37 19.56L16.05 19.77L15.72 19.97L15.38 20.15L15.03 20.32L14.67 20.47L14.31 20.61L13.93 20.72L13.56 20.82L13.17 20.9L12.78 20.96L12.39 20.99L12 21L11.61 20.99L11.22 20.95L10.83 20.89L10.45 20.81L10.07 20.71L9.7 20.59L9.34 20.45L8.98 20.29L8.64 20.12L8.3 19.94L7.97 19.74L7.65 19.53L7.34 19.31L7.04 19.08L6.75 18.84L6.47 18.59L6.19 18.34L5.92 18.08L5.65 17.81L5.4 17.54L5.14 17.26L4.9 16.97L4.66 16.67L4.44 16.37L4.22 16.05L4.02 15.72L3.83 15.39L3.65 15.04L3.49 14.68L3.34 14.32L3.22 13.95L3.11 13.57L3.02 13.18L2.96 12.79L2.92 12.4L2.9 12L2.91 11.6L2.94 11.21L2.99 10.81L3.06 10.42L3.16 10.04L3.27 9.66L3.4 9.29L3.55 8.92L3.72 8.57L3.9 8.22L4.1 7.89L4.31 7.56L4.53 7.24L4.77 6.93L5.01 6.64L5.27 6.35L5.54 6.08L5.81 5.81L6.1 5.56L6.39 5.32L6.7 5.09L7.01 4.88L7.34 4.68L7.67 4.5L8.01 4.33L8.35 4.17L8.7 4.03L9.05 3.9L9.41 3.79L9.77 3.69L10.14 3.61L10.51 3.54L10.88 3.48L11.25 3.44L11.63 3.41L12 3.4L12.38 3.4L12.75 3.41L13.13 3.44L13.5 3.47L13.88 3.53L14.25 3.59L14.63 3.67L14.99 3.77L15.36 3.88L15.72 4.01L15.77 4.76L15.6 5.76L15.64 6.29L15.72 6.69L15.83 7.01L15.95 7.29L16.09 7.53L16.24 7.76L16.41 7.96L16.59 8.15L16.78 8.33L17 8.5L17.25 8.66L17.53 8.8L17.88 8.94L18.3 9.06L18.32 9.38L18.36 9.68L18.44 9.97L18.55 10.24L18.7 10.51L18.89 10.79L19.14 11.06L19.5 11.34L20.1 11.65Z M11.3 15.82C9.62 16.29 7.79 15.72 6.97 15.06C7.96 14.72 9.88 14.81 11.3 15.82Z M11.3 15.82C12.72 14.81 14.64 14.72 15.63 15.06C14.81 15.72 12.98 16.29 11.3 15.82Z M11.3 15.82C8.93 14.8 7.36 12.42 7.02 10.9C8.48 11.44 10.62 13.33 11.3 15.82Z M11.3 15.82C11.98 13.33 14.12 11.44 15.58 10.9C15.24 12.42 13.67 14.8 11.3 15.82Z M11.3 15.82C9.9 12.91 10.37 9.38 11.3 7.67C12.23 9.38 12.7 12.91 11.3 15.82Z M11 15.82L11.6 15.82L11.6 17.53L11 17.53Z';
const CRUMBS = 'M19.5 3A0.8 0.8 0 1 1 21.1 3A0.8 0.8 0 1 1 19.5 3Z M16.98 2.3A0.52 0.52 0 1 1 18.02 2.3A0.52 0.52 0 1 1 16.98 2.3Z M22.1 12.9A0.5 0.5 0 1 1 23.1 12.9A0.5 0.5 0 1 1 22.1 12.9Z';
const JOINT = 'M5.62 21.02L16.49 9.51L13.91 7.29L4.18 19.78A0.95 0.95 0 0 0 5.62 21.02Z M5.4 17.97L7.22 19.53L7.69 18.99L5.87 17.43Z';
const SMOKE = 'M16.17 7.56L19.14 6.19L17.94 3.78L19.98 2.76L19.62 2.04L16.86 3.42L18.06 5.81L15.83 6.84Z M13.86 6.42L15.45 4.6L13.86 2.78L13.34 3.22L14.55 4.6L13.34 5.98Z';

const scaled = (s: number) => `translate(12 12) scale(${s}) translate(-12 -12)`;

/** The product type's mark, labelled with its type name. Renders nothing for Other / Not set. */
export function TypeMark(p: { icon: string | null; label: string; class?: string }) {
  if (!p.icon) return null;
  return (
    <svg viewBox="0 0 24 24" class={p.class} role="img" aria-label={p.label}>
      {p.icon === 'flower' && <path fill="currentColor" d={FLOWER} />}
      {p.icon === 'concentrate' && (
        <g fill="currentColor" transform={scaled(1.06)}>
          {CONCENTRATE.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
      {p.icon === 'edibles' && (
        <g fill="currentColor" transform={scaled(0.92)}>
          {/* evenodd cuts the leaf and bite out of the cookie: load-bearing. */}
          <path fill-rule="evenodd" clip-rule="evenodd" d={COOKIE} />
          <path d={CRUMBS} />
        </g>
      )}
      {p.icon === 'pre_roll' && (
        <g fill="currentColor" transform={scaled(1.08)}>
          {/* evenodd cuts the paper band out of the joint: load-bearing. */}
          <path fill-rule="evenodd" clip-rule="evenodd" d={JOINT} />
          <path d={SMOKE} />
        </g>
      )}
    </svg>
  );
}

export const PlusIcon = icon('M12 4.5v15M4.5 12h15', { stroke: 2.6 });
export const ChevronDown = icon('M2.5 4.5 6 8l3.5-3.5', { stroke: 1.8, viewBox: '0 0 12 12' });
export const LockIcon = icon('M7 10V7.5a5 5 0 0 1 10 0V10h.5A1.5 1.5 0 0 1 19 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-9A1.5 1.5 0 0 1 6.5 10Zm2.3 0h5.4V7.5a2.7 2.7 0 0 0-5.4 0Z', { evenodd: true });
export const ExternalIcon = icon('M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3', { stroke: 1.6, viewBox: '0 0 16 16' });
