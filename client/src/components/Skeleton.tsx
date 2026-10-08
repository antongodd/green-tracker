import { useEffect, useState } from 'preact/hooks';

/**
 * Loading placeholders (D37, 0.30.0): faint shapes laid out like the screen that's coming, with a
 * soft light sweeping across (still under Reduce Motion). Nothing shows for the first 250ms, so a
 * quick load never flickers. Screen readers hear "Loading".
 */
export type SkeletonKind = 'board' | 'smokes' | 'log' | 'product' | 'people';

const DELAY_MS = 250;

const Row = (p: { round?: boolean }) => (
  <div class="sk-row">
    <span class={`sk sk-th${p.round ? ' round' : ''}`} />
    <span class="sk-lines">
      <span class="sk sk-l1" />
      <span class="sk sk-l2" />
    </span>
    {!p.round && <span class="sk sk-sc" />}
  </div>
);
const rows = (n: number, round?: boolean) => Array.from({ length: n }, (_, i) => <Row key={i} round={round} />);

const Controls = (p: { left: boolean }) => (
  <>
    <div class="sk-pills">
      {p.left ? <span class="sk sk-pill" /> : <span />}
      <span class="sk sk-pill" />
    </div>
    <div class="sk-tiles">
      <span class="sk sk-tile" />
      <span class="sk sk-tile" />
      <span class="sk sk-tile" />
    </div>
  </>
);

const SHAPES: Record<SkeletonKind, () => preact.JSX.Element> = {
  board: () => (
    <>
      <Controls left />
      {rows(6)}
    </>
  ),
  // Smokes (D43): the week strip's card, then days of rows.
  smokes: () => (
    <>
      <span class="sk sk-week" />
      <span class="sk sk-gh" />
      {rows(2)}
      <span class="sk sk-gh" />
      {rows(3)}
    </>
  ),
  log: () => (
    <>
      <Controls left={false} />
      <span class="sk sk-gh" />
      {rows(3)}
      <span class="sk sk-gh" />
      {rows(2)}
    </>
  ),
  product: () => (
    <>
      <span class="sk sk-hero" />
      <div class="sk-card">
        <span class="sk sk-gh" />
        {[62, 80, 45, 70].map((w) => (
          <div class="sk-bar" key={w}>
            <span class="sk" />
            <span class="sk" style={{ width: `${w}%` }} />
            <span class="sk" />
          </div>
        ))}
      </div>
    </>
  ),
  people: () => <>{rows(3, true)}</>,
};

export function Skeleton(p: { kind: SkeletonKind }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  // When the shapes go, the real screen fades in where they were (only if they were seen).
  useEffect(() => {
    if (!shown) return;
    return () => {
      const screen = document.querySelector<HTMLElement>('.screen');
      if (!screen) return;
      screen.classList.add('sk-reveal');
      setTimeout(() => screen.classList.remove('sk-reveal'), 300);
    };
  }, [shown]);
  if (!shown) return null;
  const Shapes = SHAPES[p.kind];
  return (
    <div class={`skel skel-${p.kind}`} role="status" aria-label="Loading">
      <span class="visually-hidden">Loading</span>
      <div class="skel-shapes" aria-hidden="true">
        <Shapes />
      </div>
    </div>
  );
}
