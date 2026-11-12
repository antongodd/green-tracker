// Press feedback (D20, D87; Soft light D101). iPhone Safari barely shows :active, so the app marks the thing under
// your finger itself: .is-pressed, styled in styles.css.
//  - It waits a moment before showing, and any movement (a scroll) cancels it, so scrolling a list never lights
//    rows up.
//  - A quick tap still gets a brief press before whatever it opens.
//  - Soft light (D101): a soft glow in the Look's colour sits where the finger is (a .touch-light inside the thing,
//    placed by --tx / --ty), big photos lean a little towards it (--rx / --ry), it springs back when you let go,
//    and a tab's icon bounces when tapped. With a mouse on a computer the glow follows the pointer instead.

import { aimAt, HOVER_LEAN_DEG, HOVER_MOVES, LEAN_DEG, leanFor, wantsLight } from '../../shared/domain/touch';

const PRESSABLE = 'a[href], button, .pill, [role="button"]';
/** Too small or too busy for a glow of their own: the tabs bounce instead, switches and icons press in. */
const NO_LIGHT = '.tab, .switch, .hbtn, .me-btn, .more-btn, .clr, .fab, [data-no-light]';
const DELAY_MS = 60; // before showing: long enough to tell a scroll from a press
const TAP_MS = 120; // how long a quick tap's press stays visible
const SLOP_PX = 8; // finger movement that means "scrolling", not "pressing"
const FADE_MS = 400; // the glow fading out, before it's taken away

let target: HTMLElement | null = null;
let shown: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let startX = 0;
let startY = 0;
let hovered: HTMLElement | null = null;
let hoverAt: HTMLElement | null = null;
let hoverMoves = 0;
const fades = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Puts the glow's centre, and the lean, where the finger (or pointer) is on `el`. */
function aim(el: HTMLElement, x: number, y: number, deg: number) {
  const a = aimAt(el.getBoundingClientRect(), x, y);
  const lean = leanFor(a, deg);
  el.style.setProperty('--tx', `${a.x}px`);
  el.style.setProperty('--ty', `${a.y}px`);
  el.style.setProperty('--rx', `${lean.rotateX}deg`);
  el.style.setProperty('--ry', `${lean.rotateY}deg`);
}

function light(el: HTMLElement) {
  if (el.matches(NO_LIGHT)) return;
  const box = el.getBoundingClientRect();
  if (!wantsLight(box.width, box.height)) return;
  clearTimeout(fades.get(el));
  let glow = el.querySelector<HTMLElement>(':scope > .touch-light');
  if (!glow) {
    glow = document.createElement('span');
    glow.className = 'touch-light';
    glow.setAttribute('aria-hidden', 'true');
    // Held in the element's own style, not a class: a redraw that changes the class mid-press would otherwise let
    // the glow spread over whatever holds it.
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      el.dataset.touchHost = '';
    }
    el.appendChild(glow);
    void glow.offsetWidth; // start from nothing, so it fades in
  }
  glow.classList.add('on');
}

function unlight(el: HTMLElement) {
  if (el === hovered) return; // the pointer is still over it
  const glow = el.querySelector<HTMLElement>(':scope > .touch-light');
  if (!glow) return;
  glow.classList.remove('on');
  clearTimeout(fades.get(el));
  fades.set(
    el,
    setTimeout(() => {
      glow.remove();
      if (el.dataset.touchHost !== undefined) {
        el.style.removeProperty('position');
        delete el.dataset.touchHost;
      }
    }, FADE_MS),
  );
}

function show(el: HTMLElement) {
  if (shown && shown !== el) {
    shown.classList.remove('is-pressed');
    unlight(shown);
  }
  shown = el;
  aim(el, startX, startY, LEAN_DEG);
  el.classList.add('is-pressed');
  light(el);
}

function letGo(el: HTMLElement) {
  el.classList.remove('is-pressed');
  unlight(el);
  if (hovered === el) aim(el, startX, startY, HOVER_LEAN_DEG);
}

function release(after = 0) {
  clearTimeout(timer);
  timer = undefined;
  target = null;
  const el = shown;
  shown = null;
  if (!el) return;
  if (after) setTimeout(() => letGo(el), after);
  else letGo(el);
}

function pressableAt(e: Event): HTMLElement | null {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(PRESSABLE) ?? null;
  if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  return el;
}

/** A tab's icon bounces when tapped (only the animation; Reduce Motion leaves it still, in styles.css). */
function bounce(el: HTMLElement) {
  if (!el.classList.contains('tab')) return;
  el.classList.remove('tab-pop');
  void el.offsetWidth;
  el.classList.add('tab-pop');
  const done = () => el.classList.remove('tab-pop');
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, 700);
}

function unhover() {
  const el = hovered;
  hovered = null;
  if (!el) return;
  el.classList.remove('is-hover');
  unlight(el);
}

export function installPress(): void {
  const mouse = matchMedia('(hover: hover)');
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
      if (e.pointerType !== 'mouse' || !mouse.matches || target) return;
      // A mouse: the glow follows the pointer, once it has really moved over the thing.
      const el = pressableAt(e);
      if (el !== hoverAt) {
        hoverAt = el;
        hoverMoves = 0;
        if (hovered && hovered !== el) unhover();
      }
      if (!el) return;
      hoverMoves += 1;
      if (hovered !== el && hoverMoves >= HOVER_MOVES) {
        hovered = el;
        el.classList.add('is-hover');
        aim(el, e.clientX, e.clientY, HOVER_LEAN_DEG);
        light(el);
      } else if (hovered === el) aim(el, e.clientX, e.clientY, HOVER_LEAN_DEG);
    },
    { passive: true },
  );
  document.addEventListener(
    'pointerup',
    () => {
      if (!target) return;
      const el = target;
      if (!shown) show(el); // a quick tap: show it now, briefly
      bounce(el);
      release(TAP_MS);
    },
    { passive: true },
  );
  document.addEventListener('pointercancel', () => release(), { passive: true });
  document.addEventListener(
    'mouseout',
    (e) => {
      if (!e.relatedTarget) {
        hoverAt = null;
        unhover();
      }
    },
    { passive: true },
  );
  // iOS cancels the pointer when a scroll takes over; this catches any that slip through. A scroll also moves
  // things out from under a resting mouse.
  addEventListener(
    'scroll',
    () => {
      if (target) release();
      hoverAt = null;
      unhover();
    },
    { passive: true, capture: true },
  );
}
