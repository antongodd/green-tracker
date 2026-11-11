// Getting started (D97): a new account's welcome screen, its five steps (a card on the Leaderboard that folds to
// one line or hides, and each screen's own step), and a hint the first time you reach each screen. Where you're up
// to is saved to your account (it arrives with /api/auth/me), so it's the same on every phone.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { STEP_TEXT, TOUR_STEPS, nextStep, stepPath, tourComplete, withDone, withSeen, withVisit, type Tour, type TourHint, type TourPlace, type TourStep, type TourView } from '../../shared/domain/tour';
import { api } from './api';
import { CheckIcon, ChevronDown, ChevronRight, LeafLineIcon, PeopleLineIcon, StarIcon } from './icons';
import { linkTo, navigate } from './router';
import { useSession } from './session';

let tour: Tour | null = null;
/** Saves on their way: what the server last sent mustn't replace what you've just done. */
let saving = 0;
let message: string | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** What /api/auth/me says (null for an account without it), unless a save of ours is still on its way. */
export function adoptTour(next: Tour | null | undefined): void {
  if (saving) return;
  tour = next ?? null;
  changed();
}

/** As saved, hidden or not (the app shell: has the welcome screen been seen?). */
export function useTourState(): Tour | null {
  useTour();
  return tour;
}

/** Getting started while it's showing: null once hidden or finished, and for an account that never had it. */
export function useTour(): Tour | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return tour && tour.view !== 'off' ? tour : null;
}

/** Shows it at once and saves it; if the save fails it stays as shown until the app next loads. */
async function save(next: Tour): Promise<void> {
  tour = next;
  changed();
  saving++;
  try {
    const r = await api<{ tour: Tour }>('PUT', '/tour', next);
    if (saving === 1) tour = r.tour;
  } catch {
    // offline, or signed out meanwhile: nothing to put right
  } finally {
    saving--;
    changed();
  }
}

const active = (): Tour | null => (tour && tour.view !== 'off' ? tour : null);
function say(step: TourStep, t: Tour): void {
  message = `${STEP_TEXT[step].done} ${t.done.length} of ${TOUR_STEPS.length} done`;
}

/** A step really done (a product saved, a post posted…): ticks it, once. Nothing happens without Getting started. */
export function tourDone(step: TourStep): void {
  const t = active();
  if (!t || t.done.includes(step)) return;
  const next = withDone(t, step);
  say(step, next);
  void save(next);
}

/** Strainz or Sources opened: the step is done once you've seen both. */
export function tourVisit(place: TourPlace): void {
  const t = active();
  if (!t || t.visited.includes(place)) return;
  const next = withVisit(t, place);
  if (next.done.includes('places') && !t.done.includes('places')) say('places', next);
  void save(next);
}

const seen = (hint: TourHint) => {
  const t = active();
  if (t) void save(withSeen(t, hint));
};
const setView = (view: TourView) => {
  if (tour) void save({ ...tour, view });
};

/** Settings › Show me round again: a fresh list and hints, for any account. */
export async function restartTour(): Promise<void> {
  tour = (await api<{ tour: Tour }>('POST', '/tour/restart')).tour;
  changed();
}

/** The welcome screen, once, straight after an account is created. */
export function Welcome() {
  const { me } = useSession();
  const go = (view: TourView) => tour && void save({ ...tour, welcomed: true, view });
  return (
    <main class="fullscreen tour-welcome">
      <div class="tw-body">
        <p class="tw-kicker">Account created</p>
        <h1>Welcome, @{me.user?.username}</h1>
        <ul class="tw-points">
          <li>
            <StarIcon />
            <span>
              <b>Rate what you try</b>
              Your own Leaderboard, best at the top.
            </span>
          </li>
          <li>
            <LeafLineIcon />
            <span>
              <b>Know your strains and your plug</b>
              Strainz and Sources fill themselves in.
            </span>
          </li>
          <li>
            <PeopleLineIcon />
            <span>
              <b>Share with friends you approve</b>
              Nobody sees anything until you say so.
            </span>
          </li>
        </ul>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" onClick={() => go('open')}>
          Let’s go
        </button>
        {/* Skip: the list waits on the Leaderboard as one line, out of the way. */}
        <button type="button" class="btn text" onClick={() => go('small')}>
          Skip
        </button>
      </div>
    </main>
  );
}

const Dot = (p: { on: boolean }) => <span class={`ts-dot${p.on ? ' on' : ''}`}>{p.on && <CheckIcon />}</span>;

/** The list on the Leaderboard: all five steps; one line (the arrow); gone (Hide this list, or Done at the end). */
export function GettingStarted() {
  const t = useTour();
  if (!t) return null;
  const n = t.done.length;
  const total = TOUR_STEPS.length;
  if (tourComplete(t)) {
    return (
      <div class="wrap">
        <section class="gs" aria-labelledby="gs-h">
          <div class="gs-top">
            <span class="gs-ring" style={{ '--p': 100 }} aria-hidden="true">
              {total}
            </span>
            <div class="gs-t">
              <h2 id="gs-h">You’re all set</h2>
              <p>That’s the whole app. Find this again in Settings.</p>
            </div>
          </div>
          <button type="button" class="btn primary gs-done" onClick={() => setView('off')}>
            Done
          </button>
        </section>
      </div>
    );
  }
  if (t.view === 'small') {
    return (
      <div class="wrap">
        <button type="button" class="gs gs-small" aria-expanded="false" aria-label={`Getting started, ${n} of ${total} done. Show the steps`} onClick={() => setView('open')}>
          <b>Getting started</b>
          <span class="gs-bar" aria-hidden="true">
            <i style={{ width: `${(n / total) * 100}%` }} />
          </span>
          <span class="gs-n">
            {n} of {total}
          </span>
          <ChevronDown />
        </button>
      </div>
    );
  }
  return (
    <div class="wrap">
      <section class="gs" aria-labelledby="gs-h">
        <div class="gs-top">
          <span class="gs-ring" style={{ '--p': (n / total) * 100 }} aria-hidden="true">
            {n}/{total}
          </span>
          <div class="gs-t">
            <h2 id="gs-h">Getting started</h2>
            <p>
              <span class="visually-hidden">
                {n} of {total} done.{' '}
              </span>
              Five things to try. Skip any you like.
            </p>
          </div>
          <button type="button" class="gs-fold" aria-expanded="true" aria-label="Make Getting started smaller" onClick={() => setView('small')}>
            <ChevronDown />
          </button>
        </div>
        <ul class="gs-steps">
          {TOUR_STEPS.map((s) => {
            const done = t.done.includes(s);
            const to = stepPath(t, s);
            return (
              <li key={s}>
                <a class={`gs-step${done ? ' done' : ''}`} href={to} onClick={linkTo(to)}>
                  <Dot on={done} />
                  <span class="gs-st">
                    <b>{STEP_TEXT[s].title}</b>
                    <span>{done ? 'Done' : STEP_TEXT[s].sub}</span>
                  </span>
                  <ChevronRight class="chev" />
                </a>
              </li>
            );
          })}
        </ul>
        <button type="button" class="gs-hide" onClick={() => setView('off')}>
          Hide this list
        </button>
      </section>
    </div>
  );
}

/**
 * A screen's own step, at its top: what to do here, then a tick and what's next (a link to it). `step`: the Feed
 * has two (find a friend, then post).
 */
export function TourLine(p: { step: TourStep; note?: string }) {
  const t = useTour();
  if (!t || tourComplete(t)) return null;
  const at = TOUR_STEPS.indexOf(p.step) + 1;
  if (t.done.includes(p.step)) {
    const next = nextStep(t)!;
    const to = stepPath(t, next);
    return (
      <div class="wrap">
        <a class="gs tour-line done" href={to} onClick={linkTo(to)}>
          <Dot on />
          <span class="gs-st">
            <b>{STEP_TEXT[p.step].title}</b>
            <span>Done. Next: {STEP_TEXT[next].title}</span>
          </span>
          <ChevronRight class="chev" />
        </a>
      </div>
    );
  }
  return (
    <div class="wrap">
      <div class="gs tour-line">
        <Dot on={false} />
        <span class="gs-st">
          <b>{STEP_TEXT[p.step].title}</b>
          <span>{p.note ?? STEP_TEXT[p.step].sub}</span>
        </span>
        <span class="gs-n">
          Step {at} of {TOUR_STEPS.length}
        </span>
      </div>
    </div>
  );
}

/** The two screens of one step: what's left of it, said on each. */
export function PlaceLine(p: { place: TourPlace }) {
  const t = useTour();
  const other = p.place === 'strainz' ? 'sources' : 'strainz';
  return <TourLine step="places" note={t && !t.visited.includes(other) ? `Have a look, then open ${other === 'sources' ? 'Sources' : 'Strainz'}` : undefined} />;
}

const HINTS: Record<TourHint, { title: string; text: string; target?: string; float: boolean }> = {
  add: { title: 'Start here.', text: 'Tap + to add something you’ve tried and give it a score.', target: '.fab', float: true },
  strainz: { title: 'Strainz.', text: 'Every strain you rate gets its own page: your average, what you paid, where you got it.', target: '.nav .tab[aria-current="page"]', float: true },
  sources: { title: 'Sources.', text: 'Who you buy from, ranked by how their products score for you.', target: '.nav .tab[aria-current="page"]', float: true },
  friends: { title: 'Find your friends.', text: 'Tap People, top left, to search a friend’s @name, or send an invite. Only followers you approve see your posts.', float: false }, // no arrow: People sits in the very corner, where one can't reach
  post: { title: 'Your turn.', text: 'Tap + to post a photo of what you’re on.', target: '.fab', float: true },
  look: { title: 'Make it yours.', text: 'A Look changes the colours and background everywhere. Tap one to choose it; change it any time in Settings.', float: false },
};

/**
 * A hint, the first time you reach a screen: shown once, until Got it. `float` ones sit above the tab bar with an
 * arrow down at the + or the tab; the others sit in the page with an arrow up. Not a dialog: the screen works under it.
 * A `float` one goes after the screen's `<main>`, never inside it: while a screen fades in it is moved a little
 * (`enter`), and anything fixed inside it would be placed against the screen, not the phone, for that moment.
 */
export function TourHint(p: { id: TourHint; children?: ComponentChildren }) {
  const t = useTour();
  const h = HINTS[p.id];
  const box = useRef<HTMLDivElement>(null);
  const show = !!t && !t.seen.includes(p.id);
  // The arrow points at its target wherever that is on this phone.
  useLayoutEffect(() => {
    if (!show || !h.target) return;
    const place = () => {
      const el = box.current;
      const target = document.querySelector(h.target!);
      if (!el || !target) return;
      const b = el.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      el.style.setProperty('--ax', `${Math.round(Math.min(Math.max(r.left + r.width / 2 - b.left - 8, 16), b.width - 32))}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [show, h.target]);
  if (!show) return null;
  const body = (
    <>
      <p>
        <b>{h.title}</b> {h.text}
      </p>
      <div class="th-row">
        {p.children}
        <button type="button" class="btn primary sm" onClick={() => seen(p.id)}>
          Got it
        </button>
      </div>
    </>
  );
  if (h.float) {
    return (
      <aside class="tour-float" aria-label="Tip">
        <div ref={box} class="tour-hint down">
          {body}
        </div>
      </aside>
    );
  }
  return (
    <div class="wrap">
      <div ref={box} class={`tour-hint${h.target ? ' up' : ''}`} role="note" aria-label="Tip">
        {body}
      </div>
    </div>
  );
}

/** "First one ranked. 1 of 5 done": a few seconds over whatever screen you land on after a step. */
export function TourToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const l = () => {
      if (!message) return;
      setText(message);
      message = null;
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 3500);
    return () => clearTimeout(timer);
  }, [text]);
  return text ? (
    <p class="toast tour-toast" role="status">
      {text}
    </p>
  ) : null;
}

/** Settings: brings the list and the hints back, then shows them on the Leaderboard. */
export async function showMeRoundAgain(): Promise<void> {
  await restartTour();
  navigate('/');
}
