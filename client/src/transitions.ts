// "Photo grows" (D20): opening a product from a list flies the row's thumbnail up
// into the product page's big photo while the rest of the page fades; Back flies it
// home to the row. Built on Safari's view transitions (iOS 18+). Where they're
// missing, or Reduce Motion is on, navigation is exactly as before.

import { pendingReturn } from './scrollReturn';

const NAME = 'gt-photo';
const WAIT_MS = 400; // longest the old screen stays frozen while the new one renders

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

function available(): boolean {
  return typeof (document as ViewTransitionDoc).startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// While a view transition prepares the new screen, the browser pauses frames, so
// requestAnimationFrame never fires: wait on short timers instead.
const tick = () => new Promise<void>((r) => setTimeout(r, 16));

/** Resolves with the element once it exists (checked every tick), or null after the deadline. */
async function waitFor<T extends Element>(find: () => T | null, deadline: number): Promise<T | null> {
  for (;;) {
    const el = find();
    if (el || performance.now() >= deadline) return el;
    await tick();
  }
}

/** Gives the big photo a moment to decode, so the thumbnail doesn't fly into an empty frame. */
async function photoReady(hero: Element, deadline: number): Promise<void> {
  const img = hero.querySelector('img');
  if (!img || img.complete) return;
  await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, Math.max(0, deadline - performance.now())))]);
}

function name(el: Element | null | undefined, on: boolean) {
  if (el instanceof HTMLElement) el.style.viewTransitionName = on ? NAME : '';
}

// Safari draws the frozen old screen in the wrong place if the page scrolls while a view
// transition is running: opening a product from a scrolled list jumped the whole screen
// down by the distance scrolled (0.19.1, owner's recording). So nothing scrolls during
// the flight: the new screen is drawn lower by that distance (html.vt-hold), which puts it
// at the top of the screen with the page still where it was, and the real scroll to the
// top happens once the flight is over, when it can't be seen.
function hold(y: number): void {
  const root = document.documentElement;
  root.style.setProperty('--vt-hold', `${y}px`);
  root.classList.add('vt-hold');
}
function release(): void {
  const root = document.documentElement;
  if (!root.classList.contains('vt-hold')) return;
  root.classList.remove('vt-hold');
  root.style.removeProperty('--vt-hold');
  window.scrollTo(0, 0);
}

/** Two ordinary frames (or 100ms, if frames aren't coming). */
const settle = () =>
  Promise.race([
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    new Promise<void>((r) => setTimeout(r, 100)),
  ]);

let opening = false;

function run(direction: 'open' | 'back', update: () => Promise<void>): void {
  const root = document.documentElement;
  root.classList.add('vt-photo', `vt-${direction}`);
  const t = (document as ViewTransitionDoc).startViewTransition!(update);
  t.finished.finally(() => {
    release();
    // The screen that just arrived has been seen fading in already. While .vt-photo is
    // on, its entrance fade is off; removing the class would switch the fade back on
    // and restart it, so the page dipped dark and faded in again right after the photo
    // landed (0.14.0, owner's recording). Turn it off on that element for good first.
    document.querySelectorAll<HTMLElement>('.screen, .fullscreen').forEach((el) => (el.style.animation = 'none'));
    root.classList.remove('vt-photo', `vt-${direction}`);
    document.querySelectorAll<HTMLElement>('.thumb, .hero-photo').forEach((el) => name(el, false));
  });
}

/**
 * Opens a product from a list row. Returns false (and does nothing) when the
 * animation isn't available, so the caller navigates as usual.
 *
 * `record` adds the product's history entry (returning the path left, or null if
 * already there) and `show` then draws it. The entry is added first, and two ordinary
 * frames shown, before the flight starts: the phone keeps its picture of the list for
 * swipe-back when the entry is added, and one taken mid-flight could be the darkened
 * screen (0.19.1: swiping back showed black behind the page, owner's recording).
 */
export function openProductWithPhoto(row: HTMLElement, record: () => string | null, show: (from: string) => void): boolean {
  if (!available()) return false;
  if (opening) return true; // a second tap while the first is starting
  const from = record();
  if (from === null) return true;
  opening = true;
  const thumb = row.querySelector('.thumb');
  void settle().then(() => {
    opening = false;
    if (location.pathname === from) return; // went back again before the flight started
    name(thumb, true);
    run('open', async () => {
      name(thumb, false);
      hold(window.scrollY); // where the frozen list is
      show(from);
      const deadline = performance.now() + WAIT_MS;
      const hero = await waitFor(() => document.querySelector('.hero-photo'), deadline);
      if (!hero) return; // not rendered in time: an ordinary fade instead
      await photoReady(hero, deadline);
      name(hero, true);
    });
  });
  return true;
}

/**
 * Back from a product page to the row it was opened from. Returns false when it
 * doesn't apply (no animation, no photo on screen, not opened from a list).
 */
export function backToRowWithPhoto(goBack: () => void): boolean {
  const target = pendingReturn();
  const hero = document.querySelector('.hero-photo');
  if (!available() || !target || !hero) return false;
  name(hero, true);
  run('back', async () => {
    name(hero, false);
    const popped = new Promise<void>((r) => addEventListener('popstate', () => r(), { once: true }));
    goBack();
    await popped;
    const deadline = performance.now() + WAIT_MS;
    const row = await waitFor(() => document.querySelector(`[data-return="${CSS.escape(`${target.list}:${target.id}`)}"]`), deadline);
    if (!row) return;
    await tick(); // the list has put the row back where it was (scrollReturn, a layout effect)
    const thumb = row.querySelector('.thumb');
    const r = thumb?.getBoundingClientRect();
    if (r && r.bottom > 0 && r.top < innerHeight) name(thumb, true);
  });
  return true;
}
