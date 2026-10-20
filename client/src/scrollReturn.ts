// "Returning lands where you were" (brief §10.1): coming back from a product to a
// list scrolls to the row that was tapped — anchored to the record, not a pixel
// offset or index, since the product may have moved rank. Transient: kept in
// memory only, so tab switches and app launches start at the top.

import { holding, holdOffset, scrollPage, whenReleased } from './scrollHold';

let pending: { list: string; id: string; screenTop: number; scroll: number } | null = null;

/** Top of an element in document coordinates, from layout offsets (not transformed rects). */
function docTop(el: HTMLElement): number {
  let y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
  return y;
}

/** The row a product page was opened from, if any (for the Back animation, D20). */
export const pendingReturn = (): { list: string; id: string; scroll: number } | null => (pending ? { list: pending.list, id: pending.id, scroll: pending.scroll } : null);

export function rememberRow(list: string, id: string, el: HTMLElement): void {
  pending = { list, id, screenTop: docTop(el) - window.scrollY, scroll: window.scrollY };
}

/**
 * Call once a list has rendered. If we came back from that row's product, land where
 * you were when you tapped it, as long as the row is still fully on screen there. If
 * it moved (re-rated), put it at roughly its previous screen position instead; if it's
 * gone (archived, filtered out), go to the top.
 *
 * The list's history entry also restores its scroll by itself (router.ts: the phone
 * only shows its picture of the list during a swipe back when it does), sometimes after
 * this has run. "Where you were" is the same place, so that's harmless; when the row
 * moved or went, that restore is undone (0.19.3: GitHub's faster machines caught it
 * landing after the app).
 */
export function restoreRow(list: string, cameFromProduct: boolean): void {
  const p = pending;
  pending = null;
  if (!p || p.list !== list || !cameFromProduct) return;
  landing++; // the row decides, not the pixel offset (land)
  const el = document.querySelector<HTMLElement>(`[data-return="${CSS.escape(`${list}:${p.id}`)}"]`);
  if (!el) {
    keep(0, p.scroll);
    return;
  }
  const top = docTop(el) - holdOffset(); // as if the screen weren't moved by a hold
  const header = document.querySelector<HTMLElement>('.hdr')?.offsetHeight ?? 0;
  const controls = document.querySelector<HTMLElement>('.controls')?.offsetHeight ?? 0;
  const nav = document.querySelector<HTMLElement>('.nav')?.offsetHeight ?? 0;
  const onScreenWhereYouWere = top - p.scroll >= header + controls && top - p.scroll + el.offsetHeight <= window.innerHeight - nav;
  keep(onScreenWhereYouWere ? p.scroll : Math.max(0, top - p.screenTop), p.scroll);
}

/** Scrolls to `y`, and back to it if the browser's own restore (towards `restored`) lands afterwards. */
function keep(y: number, restored: number): void {
  scrollPage(y);
  if (Math.abs(y - restored) <= 1) return;
  // Undo only the browser's restore: stop as soon as a finger (or wheel, or key) takes over,
  // and never mid-flight: the flight ends by scrolling to y itself (scrollHold.ts).
  let touched = false;
  const stop = () => (touched = true);
  const inputs = ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const;
  inputs.forEach((type) => addEventListener(type, stop, { once: true, passive: true, capture: true }));
  const undo = () => {
    if (!touched && !holding() && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  };
  // Counted from the end of the flight, if there is one: on a busy phone a flight can outlast these
  // (0.50.0), and the browser's restore can land just after it.
  whenReleased(() => {
    requestAnimationFrame(() => {
      undo();
      requestAnimationFrame(undo);
    });
    for (const ms of [150, 400, 800]) setTimeout(undo, ms);
    setTimeout(() => inputs.forEach((type) => removeEventListener(type, stop, { capture: true })), 900);
  });
}

let landing = 0;

/**
 * Back to any screen (router.ts, popstate): lands where you were on it (0.52.0). The screen
 * may still be drawing its content (a list from the network, Settings' numbers), so for a
 * moment it keeps putting the page there: as far as it can go until it's tall enough, and
 * back again if something moves it (Chromium's scroll anchoring follows content loading in
 * above). A finger (or wheel, or key) taking over stops it, and so does a list returning to
 * its row (restoreRow), which knows better.
 */
export function land(y: number): void {
  const id = ++landing;
  if (y <= 0) return;
  let touched = false;
  const stop = () => (touched = true);
  const inputs = ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const;
  inputs.forEach((type) => addEventListener(type, stop, { once: true, passive: true, capture: true }));
  const until = performance.now() + 1000;
  const step = () => {
    if (touched || id !== landing || performance.now() > until) {
      inputs.forEach((type) => removeEventListener(type, stop, { capture: true }));
      return;
    }
    if (!holding() && Math.abs(window.scrollY - y) > 1) scrollPage(y);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
