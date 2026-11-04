import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

// The look's own scene behind every screen (D90): petals, stars, bubbles, a jellyfish, rain, a grid. It sits over
// the fixed .bg-layer (the look's colour and lights, index.html) and follows whatever look is on the screen (yours,
// or a friend's on their pages, D74: screenLook.ts sets html[data-look]). Styled and animated in styles.css (".scene");
// still with Reduce Motion, hidden under the viewer and the croppers.

/** The look on the screen, following html[data-look] as it changes. */
function useShownLook(): string {
  const read = () => document.documentElement.dataset.look ?? 'aurora';
  const [look, setLook] = useState(read);
  useEffect(() => {
    const watch = new MutationObserver(() => setLook(read()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
    setLook(read());
    return () => watch.disconnect();
  }, []);
  return look;
}

/** The same scattering every time (no flicker between renders, the same picture on every phone). */
function scatter<T>(seed: number, n: number, make: (r: () => number, i: number) => T): T[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  return Array.from({ length: n }, (_, i) => make(r, i));
}
const css = (o: Record<string, string>): JSX.CSSProperties => o as JSX.CSSProperties;
const timing = (dur: number, at: number) => ({ animationDuration: `${dur.toFixed(1)}s`, animationDelay: `-${(at * dur).toFixed(1)}s` });

const stars = (seed: number, n: number, height: number) =>
  scatter(seed, n, (r) => <i class="star" style={css({ left: `${(r() * 100).toFixed(1)}vw`, top: `${(r() * height).toFixed(1)}vh`, ...timing(2 + r() * 4, r()) })} />);

const Hills = (p: { back: string; front: string }) => (
  <svg class="sc-hills" viewBox="0 0 390 230" preserveAspectRatio="none">
    <path d="M0 120 C60 90 110 100 160 80 C220 58 270 95 320 78 C350 68 372 74 390 70 V230 H0Z" fill={p.back} />
    <path d="M0 170 C70 140 120 160 190 140 C250 124 300 150 390 128 V230 H0Z" fill={p.front} />
  </svg>
);

function Sakura() {
  const blooms = [[160, 70], [140, 84], [118, 98], [96, 110], [70, 122], [48, 130], [190, 46], [214, 32], [238, 20], [186, 62], [170, 90], [112, 124], [150, 58], [226, 26]];
  return (
    <>
      <i class="cloud c1" />
      <i class="cloud c2" />
      <i class="moon" />
      <Hills back="#220e25" front="#180a1a" />
      <i class="mist" />
      <svg class="branch" viewBox="0 0 270 180">
        <path d="M270 8 C220 20 190 40 160 70 S100 118 40 132" stroke="#3a1a2c" stroke-width="6" fill="none" stroke-linecap="round" />
        <path d="M190 42 C186 64 174 82 160 94 M120 96 C122 112 116 126 104 136" stroke="#3a1a2c" stroke-width="3.5" fill="none" stroke-linecap="round" />
        {blooms.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <circle r="7" fill="#ffc6dc" opacity="0.45" />
            <circle r="3" fill="#ff8fbf" opacity="0.55" />
          </g>
        ))}
      </svg>
      {scatter(7, 22, (r) => {
        const size = 7 + r() * 7;
        return (
          <span class="fall" style={css({ left: `${(r() * 100).toFixed(1)}vw`, opacity: (0.16 + r() * 0.14).toFixed(2), ...timing(10 + r() * 9, r()) })}>
            <i style={css({ width: `${size.toFixed(1)}px`, height: `${(size * 0.75).toFixed(1)}px`, animationDuration: `${(2.5 + r() * 2.5).toFixed(1)}s` })} />
          </span>
        );
      })}
    </>
  );
}

function Nebula() {
  return (
    <>
      <div class="neb">
        <i class="n1" />
        <i class="n2" />
        <i class="n3" />
      </div>
      {stars(11, 60, 100)}
      <i class="shoot" />
      <i class="shoot s2" />
    </>
  );
}

function Aurora() {
  return (
    <>
      {stars(3, 34, 50)}
      <div class="sky">
        <i class="cur k1" />
        <i class="cur k2" />
        <i class="cur k3" />
      </div>
    </>
  );
}

function Forest() {
  return (
    <>
      <i class="ray r1" />
      <i class="ray r2" />
      <i class="ray r3" />
      <svg class="trees back" viewBox="0 0 430 420" preserveAspectRatio="none">
        <g fill="#0b2015">
          <path d="M30 420 L60 150 L90 420Z" />
          <path d="M100 420 L140 100 L180 420Z" />
          <path d="M200 420 L235 170 L270 420Z" />
          <path d="M280 420 L325 90 L370 420Z" />
          <path d="M360 420 L395 160 L430 420Z" />
        </g>
      </svg>
      <i class="fog f1" />
      <svg class="trees" viewBox="0 0 430 420" preserveAspectRatio="none">
        <g fill="#06110b">
          <path d="M-10 420 L40 210 L90 420Z" />
          <path d="M70 420 L120 250 L170 420Z" />
          <path d="M240 420 L300 190 L360 420Z" />
          <path d="M340 420 L400 240 L460 420Z" />
        </g>
      </svg>
      <i class="fog f2" />
      {scatter(5, 6, (r) => <i class="leaf" style={css({ left: `${(r() * 92).toFixed(1)}vw`, ...timing(16 + r() * 12, r()) })} />)}
    </>
  );
}

function DeepSea() {
  return (
    <>
      <i class="ray r1" />
      <i class="ray r2" />
      <i class="ray r3" />
      <i class="ray r4" />
      {scatter(13, 22, (r) => <i class="pk" style={css({ left: `${(r() * 100).toFixed(1)}vw`, top: `${(24 + r() * 74).toFixed(1)}vh`, ...timing(2 + r() * 4, r()) })} />)}
      <div class="jelly">
        <svg viewBox="0 0 70 110">
          <path d="M5 34 C5 12 20 2 35 2 C50 2 65 12 65 34 C55 30 45 36 35 32 C25 36 15 30 5 34Z" fill="rgba(230, 190, 255, 0.35)" />
          <g stroke="rgba(227, 198, 255, 0.4)" stroke-width="1.4" fill="none">
            <path d="M15 34 C12 55 20 70 14 100" />
            <path d="M28 34 C26 60 33 76 27 108" />
            <path d="M42 34 C44 60 37 78 43 106" />
            <path d="M55 34 C58 56 50 72 56 98" />
          </g>
        </svg>
      </div>
      {scatter(17, 14, (r) => {
        const s = 4 + r() * 12;
        return <i class="bub" style={css({ left: `${(r() * 96).toFixed(1)}vw`, width: `${s.toFixed(1)}px`, height: `${s.toFixed(1)}px`, ...timing(9 + r() * 10, r()) })} />;
      })}
    </>
  );
}

const Crystal = (p: { class: string }) => (
  <svg class={`crystal ${p.class}`} viewBox="0 0 150 150">
    <g stroke="#dff4ff" stroke-width="1.4" fill="none" stroke-linecap="round">
      <path d="M10 10 L110 110" />
      <path d="M30 30 L52 18 M30 30 L18 52 M55 55 L82 40 M55 55 L40 82 M80 80 L102 68 M80 80 L68 102" />
      <path d="M10 10 L140 40 M10 10 L40 140" />
      <path d="M60 22 L72 10 M22 60 L10 72 M100 32 L110 20 M32 100 L20 110" />
    </g>
  </svg>
);

function Frost() {
  return (
    <>
      <i class="band" />
      <Crystal class="tl" />
      <Crystal class="br" />
      {scatter(19, 50, (r, i) => {
        const near = i % 9 === 0;
        const s = near ? 6 + r() * 3 : 1.5 + r() * 2.5;
        return (
          <i
            class={near ? 'flake near' : 'flake'}
            style={css({ left: `${(r() * 100).toFixed(1)}vw`, width: `${s.toFixed(1)}px`, height: `${s.toFixed(1)}px`, opacity: (near ? 0.18 : 0.1 + r() * 0.14).toFixed(2), ...timing(near ? 7 + r() * 3 : 12 + r() * 14, r()) })}
          />
        );
      })}
    </>
  );
}

function Fireflies() {
  return (
    <>
      <i class="moon" />
      {scatter(23, 16, (r) => {
        const w = 6 + r() * 6;
        const b = 2 + r() * 3;
        return (
          <i
            class="ff"
            style={css({ left: `${(3 + r() * 92).toFixed(1)}vw`, top: `${(20 + r() * 70).toFixed(1)}vh`, animationDuration: `${w.toFixed(1)}s, ${b.toFixed(1)}s`, animationDelay: `-${(r() * w).toFixed(1)}s, -${(r() * b).toFixed(1)}s` })}
          />
        );
      })}
      <svg class="grass" viewBox="0 0 410 260" preserveAspectRatio="none">
        <path d="M0 260 L0 150 L12 260 L20 120 L30 260 L42 160 L50 260 L62 110 L74 260 L84 150 L96 260 L108 130 L120 260 L130 170 L142 260 L156 120 L168 260 L178 150 L190 260 L204 110 L216 260 L226 160 L238 260 L252 130 L264 260 L274 150 L286 260 L300 115 L312 260 L322 160 L334 260 L348 130 L360 260 L372 150 L384 260 L396 120 L410 260Z" fill="#0a1a15" />
      </svg>
      <svg class="grass g2" viewBox="0 0 410 200" preserveAspectRatio="none">
        <path d="M0 200 L6 110 L18 200 L30 90 L40 200 L54 120 L66 200 L80 80 L92 200 L104 120 L116 200 L130 90 L144 200 L156 130 L168 200 L182 85 L196 200 L208 120 L220 200 L234 95 L248 200 L260 125 L272 200 L286 85 L300 200 L312 120 L324 200 L338 95 L352 200 L364 125 L376 200 L390 90 L410 200Z" fill="#06110e" />
      </svg>
    </>
  );
}

function Lava() {
  return (
    <>
      <i class="heat" />
      <div class="goo">
        <i class="b1" />
        <i class="b2" />
        <i class="b3" />
        <i class="b4" />
        <i class="b5" />
      </div>
    </>
  );
}

const BLOCKS: [number, number, number][] = [[0, 180, 60], [56, 110, 50], [104, 210, 44], [146, 60, 62], [206, 170, 40], [244, 130, 70], [312, 200, 78]];
function Neon() {
  return (
    <>
      <svg class="city" viewBox="0 0 390 420" preserveAspectRatio="none">
        <g fill="#0a0620">
          {BLOCKS.map(([x, y, w]) => (
            <rect key={x} x={x} y={y} width={w} height={420 - y} />
          ))}
        </g>
      </svg>
      {scatter(29, 40, (r) => {
        const [x, y, w] = BLOCKS[Math.floor(r() * BLOCKS.length)]!;
        // In the skyline's own units (390 × 420, stretched over the bottom half of the screen).
        const left = ((x + 6 + r() * (w - 14)) / 390) * 100;
        const fromBottom = ((420 - (y + 12 + r() * (400 - y))) / 420) * 50;
        return <i class="win" style={css({ left: `${left.toFixed(1)}vw`, bottom: `${Math.max(1, fromBottom).toFixed(1)}vh`, ...timing(4 + r() * 9, r()) })} />;
      })}
      <i class="sign s1" />
      <i class="sign s2" />
      {scatter(31, 36, (r) => <i class="rain" style={css({ left: `${(r() * 108 - 8).toFixed(1)}vw`, ...timing(0.7 + r() * 0.6, r()) })} />)}
    </>
  );
}

function Outrun() {
  return (
    <>
      <i class="sky" />
      {stars(37, 32, 38)}
      <i class="sun" />
      <svg class="mtn" viewBox="0 0 390 100" preserveAspectRatio="none">
        <path d="M0 100 L0 70 L40 40 L80 66 L130 20 L180 62 L220 44 L260 70 L310 30 L350 60 L390 46 L390 100Z" fill="#14062e" />
        <path d="M0 70 L40 40 L80 66 L130 20 L180 62 L220 44 L260 70 L310 30 L350 60 L390 46" stroke="#5ff2ff" stroke-opacity="0.3" stroke-width="1.2" fill="none" />
      </svg>
      <i class="floor" />
    </>
  );
}

function Daylight() {
  const clouds: [number, number, number, number][] = [[8, 48, 0.9, 0], [22, 64, 0.7, 0.45], [36, 56, 0.85, 0.25], [52, 80, 0.6, 0.6], [15, 72, 0.5, 0.85]];
  return (
    <>
      <i class="sun" />
      {clouds.map(([top, dur, op, at]) => (
        <span key={top} class="cloud2" style={css({ top: `${top}vh`, opacity: String(op), ...timing(dur, at) })}>
          <i style={css({ width: '90px', height: '40px', left: '0', top: '18px' })} />
          <i style={css({ width: '70px', height: '50px', left: '34px', top: '0' })} />
          <i style={css({ width: '80px', height: '38px', left: '70px', top: '20px' })} />
        </span>
      ))}
    </>
  );
}

const SCENES: Record<string, () => JSX.Element> = { sakura: Sakura, nebula: Nebula, aurora: Aurora, forest: Forest, deepsea: DeepSea, frost: Frost, fireflies: Fireflies, lava: Lava, neon: Neon, outrun: Outrun, daysky: Daylight };

/** The scene for the look on the screen; none for a look without one. */
export function Backdrop() {
  const look = useShownLook();
  const Scene = SCENES[look];
  if (!Scene) return null;
  return (
    <div class={`scene scene-${look}`} aria-hidden="true" key={look}>
      <Scene />
    </div>
  );
}
