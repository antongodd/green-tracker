// D99: a new product lands on the Leaderboard. Save (a new product, or a Log entry moved up) leaves its id here and
// opens the Leaderboard, which takes it on its first render and plays the landing (components/Landing.tsx).
// `html.landing` is on from Save until the landing has finished, so the browser tests' `settled` can wait for it.

let pending: string | null = null;

/** Save: this product should land on the Leaderboard that opens next. */
export function expectLanding(id: string): void {
  pending = id;
  document.documentElement.classList.add('landing');
}

/** The Leaderboard, once: the product to land, if any. */
export function takeLanding(): string | null {
  const id = pending;
  pending = null;
  return id;
}

/** The landing finished, was skipped, or couldn't happen. */
export function landed(): void {
  pending = null;
  document.documentElement.classList.remove('landing');
}
