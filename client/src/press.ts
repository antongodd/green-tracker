// "Lift" press feedback (D20). iPhone Safari barely shows :active, so the app marks
// the thing under your finger itself: .is-pressed, styled in styles.css.
//  - It waits a moment before showing, and any movement (a scroll) cancels it, so
//    scrolling a list never lights rows up.
//  - A quick tap still gets a brief press before whatever it opens.

const PRESSABLE = 'a[href], button, .pill, .country-btn, [role="button"]';
const DELAY_MS = 60; // before showing: long enough to tell a scroll from a press
const TAP_MS = 120; // how long a quick tap's press stays visible
const SLOP_PX = 8; // finger movement that means "scrolling", not "pressing"

let target: HTMLElement | null = null;
let shown: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let startX = 0;
let startY = 0;

function show(el: HTMLElement) {
  shown?.classList.remove('is-pressed');
  shown = el;
  el.classList.add('is-pressed');
}

function release(after = 0) {
  clearTimeout(timer);
  timer = undefined;
  target = null;
  const el = shown;
  shown = null;
  if (!el) return;
  if (after) setTimeout(() => el.classList.remove('is-pressed'), after);
  else el.classList.remove('is-pressed');
}

function pressableAt(e: PointerEvent): HTMLElement | null {
  const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE) ?? null;
  if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  return el;
}

export function installPress(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      release();
      target = pressableAt(e);
      if (!target) return;
      startX = e.clientX;
      startY = e.clientY;
      const el = target;
      timer = setTimeout(() => show(el), DELAY_MS);
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (target && Math.hypot(e.clientX - startX, e.clientY - startY) > SLOP_PX) release();
    },
    { passive: true },
  );
  document.addEventListener(
    'pointerup',
    () => {
      if (!target) return;
      if (!shown) show(target); // a quick tap: show it now, briefly
      release(TAP_MS);
    },
    { passive: true },
  );
  document.addEventListener('pointercancel', () => release(), { passive: true });
  // iOS cancels the pointer when a scroll takes over; this catches any that slip through.
  addEventListener('scroll', () => target && release(), { passive: true, capture: true });
}
