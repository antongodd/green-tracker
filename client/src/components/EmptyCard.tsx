import type { ComponentChildren, JSX } from 'preact';
import { FLOWER } from '../icons';

/**
 * The empty states' line drawings (D33, 0.26.0): one small green drawing per kind of empty
 * screen, in place of the faint leaf. Strokes and fills come from `.empty-art` in styles.css.
 */
export type EmptyArtKind = 'podium' | 'filter' | 'unrated' | 'smokes' | 'log' | 'archive' | 'shared' | 'requests' | 'followers' | 'following' | 'blocked';

const Leaf = (p: { x: number; y: number; s: number }) => <path class="soft" d={FLOWER} transform={`translate(${p.x} ${p.y}) scale(${p.s})`} vector-effect="non-scaling-stroke" />;
const Person = (p: { x: number; y: number; r: number; class?: string }) => (
  <g class={p.class}>
    <circle class="soft" cx={p.x} cy={p.y} r={p.r} />
    <path class="soft" d={`M${p.x - p.r * 1.9} ${p.y + p.r * 3.4}c0-${p.r * 1.1} ${p.r * 0.85}-${p.r * 1.9} ${p.r * 1.9}-${p.r * 1.9}s${p.r * 1.9} ${p.r * 0.8} ${p.r * 1.9} ${p.r * 1.9}`} />
  </g>
);

const ART: Record<EmptyArtKind, () => JSX.Element> = {
  podium: () => (
    <>
      <rect class="soft" x="30" y="58" width="36" height="40" rx="4" />
      <rect class="soft" x="66" y="40" width="36" height="58" rx="4" />
      <rect class="soft" x="102" y="68" width="36" height="30" rx="4" />
      <text x="48" y="84">2</text>
      <text x="84" y="74" class="big">1</text>
      <text x="120" y="88" class="sm">3</text>
      <Leaf x={70} y={4} s={1.2} />
      <path class="dim" d="M18 98h132" />
    </>
  ),
  filter: () => (
    <>
      <path class="soft" d="M44 18h80l-30 36v28l-20 10V54z" />
      <Leaf x={108} y={50} s={1.7} />
      <path class="dim" d="M30 30h6M26 44h10M132 24h6" />
    </>
  ),
  unrated: () => (
    <>
      <path class="dim" d="M34 26h16M34 52h16M34 78h16" />
      <rect class="dim dash" x="60" y="21" width="80" height="10" rx="5" />
      <rect x="60" y="47" width="80" height="10" rx="5" />
      <rect class="fill" x="60" y="47" width="52" height="10" rx="5" />
      <rect x="60" y="73" width="80" height="10" rx="5" />
      <rect class="fill" x="60" y="73" width="36" height="10" rx="5" />
    </>
  ),
  // Smokes (D43): a flame over a week of empty days.
  smokes: () => (
    <>
      <path class="soft" d="M86 8c2 9 18 16 18 34a20 20 0 0 1-40 0c0-9 5-15 10-19 .3 6 3 10 7 12-1-10 1-19 5-27Z" />
      <path d="M84 44c-4 3-6 6-6 10a6 6 0 0 0 12 0c0-4-2-7-6-10Z" />
      <path class="dim dash" d="M22 94h124" />
      <path class="dim" d="M34 86v8M52 82v12M70 88v6M98 84v10M116 88v6M134 80v14" />
    </>
  ),
  log: () => (
    <>
      <rect class="soft" x="46" y="10" width="76" height="88" rx="6" />
      <path d="M58 10v88" />
      <path class="dim" d="M68 30h40M68 44h40M68 58h28" />
      <Leaf x={96} y={60} s={1.35} />
      <path d="M40 22h8M40 40h8M40 58h8M40 76h8" />
    </>
  ),
  archive: () => (
    <>
      <rect class="soft" x="36" y="22" width="96" height="18" rx="4" />
      <path class="soft" d="M42 40h84v52a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4z" />
      <rect x="72" y="52" width="24" height="8" rx="4" />
      <Leaf x={68} y={0} s={1.3} />
    </>
  ),
  shared: () => (
    <>
      <rect class="dim dash" x="30" y="58" width="36" height="40" rx="4" />
      <rect class="dim dash" x="66" y="40" width="36" height="58" rx="4" />
      <rect class="dim dash" x="102" y="68" width="36" height="30" rx="4" />
      <circle class="soft" cx="84" cy="20" r="12" />
      <text x="84" y="25" class="sm">@</text>
    </>
  ),
  requests: () => (
    <>
      <Person x={84} y={16} r={8} class="dim dash" />
      <path class="soft" d="M36 60h30l6 12h24l6-12h30v30a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4z" />
      <path d="M36 60l12-26h8M132 60l-12-26h-8" />
    </>
  ),
  followers: () => (
    <>
      <Person x={40} y={42} r={11} class="dim dash" />
      <Person x={128} y={42} r={11} class="dim dash" />
      <Person x={84} y={34} r={15} />
    </>
  ),
  following: () => (
    <>
      <Person x={64} y={38} r={15} />
      <Person x={110} y={46} r={12} class="dim dash" />
      <circle class="soft" cx="132" cy="24" r="10" />
      <path d="M132 19v10M127 24h10" />
    </>
  ),
  blocked: () => (
    <>
      <Person x={66} y={36} r={15} />
      <circle class="soft" cx="116" cy="44" r="18" />
      <path d="M103.3 56.7l25.4-25.4" />
    </>
  ),
};

export function EmptyArt(p: { kind: EmptyArtKind }) {
  const Drawing = ART[p.kind];
  return (
    <svg class="empty-art" viewBox="0 0 168 104" aria-hidden="true">
      <Drawing />
    </svg>
  );
}

/** An empty state (brief §6.10): a drawing, a title, then the caller's text and button. */
export function EmptyCard(p: { art: EmptyArtKind; title: string; compact?: boolean; children?: ComponentChildren }) {
  return (
    <div class={p.compact ? 'empty compact' : 'empty'} data-art={p.art}>
      <EmptyArt kind={p.art} />
      <h2>{p.title}</h2>
      {p.children}
    </div>
  );
}
