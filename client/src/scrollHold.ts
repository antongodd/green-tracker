// Safari draws the frozen old screen of a view transition in the wrong place if the page
// scrolls while the transition runs: opening a product from a scrolled list dropped the
// whole screen by the distance scrolled, and Back threw the product page up the same way
// (0.19.1 and 0.19.2, owner's recordings). So during Photo grows the page never really
// scrolls. A "hold" keeps the real scroll where it is (`at`) and draws the screen lower or
// higher instead (html.vt-hold: a margin of at − to on `.screen`), so it looks scrolled to
// `to`. Releasing it drops the margin and scrolls to `to` in one go, which looks the same.

let held: { at: number; to: number } | null = null;

function apply(): void {
  const root = document.documentElement;
  root.style.setProperty('--vt-hold', `${held!.at - held!.to}px`);
  root.classList.add('vt-hold');
}

/** Whether a hold is on (a flight is running). */
export const holding = (): boolean => held !== null;

/** How far the screen is currently drawn down by a hold (0 without one). */
export const holdOffset = (): number => (held ? held.at - held.to : 0);

/**
 * Starts a hold with the page really at `at` (default: where it is) and the screen looking
 * the same as now. A different `at` scrolls there at once, invisibly.
 */
export function holdScroll(at = window.scrollY): void {
  const now = window.scrollY;
  held = { at, to: now };
  apply();
  if (at !== now) window.scrollTo(0, at);
}

/** Scrolls the page: for real, or during a hold by moving the screen instead. */
export function scrollPage(y: number): void {
  if (!held) {
    window.scrollTo(0, y);
    return;
  }
  // Only as far as the screen's own content allows, as a real scroll would.
  const content = document.documentElement.scrollHeight - holdOffset();
  held.to = Math.max(0, Math.min(y, content - window.innerHeight));
  apply();
}

/** Ends the hold: the page scrolls to where the screen looked, which can't be seen. */
export function releaseScroll(): void {
  if (!held) return;
  const { to } = held;
  held = null;
  const root = document.documentElement;
  root.classList.remove('vt-hold');
  root.style.removeProperty('--vt-hold');
  window.scrollTo(0, to);
}
