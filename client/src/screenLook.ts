// The look on the screen (D64, D65, D72): html[data-look] picks its colours, the Home Screen app's
// top bar follows, and a light look takes the light tone with the iPhone's own controls. It is your
// own look, remembered on this phone so the next launch opens in it (look.js), except while you're
// on the board or a product page of someone you follow: there it is theirs (D74), fading in over
// a third of a second when it arrives after the screen, and never remembered.

import { LIGHT_LOOKS, LOOK_BG, type Look } from '../../shared/domain/gems';

let own: Look | null = null;
let borrowed: Look | null = null;

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

function paint() {
  const look = borrowed ?? own;
  if (!look) return;
  const root = document.documentElement;
  root.dataset.look = look;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', LOOK_BG[look]);
  const light = LIGHT_LOOKS.includes(look);
  if (light) root.dataset.tone = 'light';
  else delete root.dataset.tone;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', light ? 'light' : 'dark');
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', light ? 'default' : 'black-translucent');
}

/** Your own look: shown unless someone else's is borrowed, and remembered on this phone. */
export function setOwnLook(look: Look) {
  own = look;
  try {
    localStorage.setItem('gt.look', look);
  } catch {}
  paint();
}

/**
 * Shows someone else's look (D74), or yours again with null. `fade` cross-fades the whole screen
 * (Safari's view transitions, iOS 18+); without them, with Reduce Motion, or while "Photo grows"
 * (D20) is running, it changes at once.
 */
export function borrowLook(look: Look | null, fade = false) {
  borrowed = look;
  const doc = document as ViewTransitionDoc;
  const root = document.documentElement;
  const changes = (borrowed ?? own) !== root.dataset.look;
  if (!fade || !changes || typeof doc.startViewTransition !== 'function' || root.classList.contains('vt-photo') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paint();
    return;
  }
  root.classList.add('vt-look');
  // paint() reads the look when the browser is ready, so leaving during the fade still lands on yours.
  doc.startViewTransition(paint).finished.finally(() => root.classList.remove('vt-look'));
}
