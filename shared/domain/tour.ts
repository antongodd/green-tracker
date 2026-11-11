// Getting started (D97): what a new account is shown on its first days. A welcome screen, five steps that tick
// themselves off as you really do them, and a hint the first time you reach each screen. Yours only: never sent
// to followers, never in Export or Restore.

export const TOUR_STEPS = ['product', 'places', 'friend', 'post', 'look'] as const;
export type TourStep = (typeof TOUR_STEPS)[number];
/** The two screens of the `places` step: it's done once you've opened both. */
export const TOUR_PLACES = ['strainz', 'sources'] as const;
export type TourPlace = (typeof TOUR_PLACES)[number];
export const TOUR_HINTS = ['add', 'strainz', 'sources', 'friends', 'post', 'look'] as const;
export type TourHint = (typeof TOUR_HINTS)[number];
/** The list on the Leaderboard: all five steps, one line, or put away (Hide this list, or Done at the end). */
export const TOUR_VIEWS = ['open', 'small', 'off'] as const;
export type TourView = (typeof TOUR_VIEWS)[number];

export interface Tour {
  /** The welcome screen has been seen (once, on any phone). */
  welcomed: boolean;
  view: TourView;
  done: TourStep[];
  visited: TourPlace[];
  seen: TourHint[];
}

/** A new account's; `welcomed` for Show me round again, which skips the welcome screen. */
export const freshTour = (welcomed = false): Tour => ({ welcomed, view: 'open', done: [], visited: [], seen: [] });

export const STEP_TEXT: Record<TourStep, { title: string; sub: string; path: string; done: string }> = {
  product: { title: 'Add your first product', sub: 'Rate something you’ve tried', path: '/products/new', done: 'First one ranked.' },
  places: { title: 'Look at Strainz and Sources', sub: 'Your strains, and who you buy from', path: '/strainz', done: 'Strainz and Sources seen.' },
  friend: { title: 'Find a friend', sub: 'Invite one, or search their @name', path: '/feed', done: 'Friend step done.' },
  post: { title: 'Post to the Feed', sub: 'Only followers you approve see it', path: '/feed', done: 'Posted.' },
  look: { title: 'Pick your Look', sub: 'Colours and background for the whole app', path: '/more/look', done: 'Look chosen.' },
};

/** Known values only, once each, in the list's own order. */
const pick = <T extends string>(list: readonly T[], raw: unknown): T[] | null => {
  if (!Array.isArray(raw)) return null;
  if (raw.some((v) => !list.includes(v as T))) return null;
  return list.filter((k) => raw.includes(k));
};

/** Opening both places is the `places` step, however the two arrived. */
function settle(t: Tour): Tour {
  const done = TOUR_PLACES.every((p) => t.visited.includes(p)) && !t.done.includes('places') ? TOUR_STEPS.filter((s) => s === 'places' || t.done.includes(s)) : t.done;
  return { ...t, done };
}

/** A whole state, checked. Anything it doesn't know is refused. */
export function validateTour(raw: unknown): { ok: true; value: Tour } | { ok: false; message: string } {
  const bad = { ok: false as const, message: 'Getting started couldn’t be saved.' };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad;
  const r = raw as Record<string, unknown>;
  const done = pick(TOUR_STEPS, r.done);
  const visited = pick(TOUR_PLACES, r.visited);
  const seen = pick(TOUR_HINTS, r.seen);
  if (typeof r.welcomed !== 'boolean' || !TOUR_VIEWS.includes(r.view as TourView) || !done || !visited || !seen) return bad;
  return { ok: true, value: settle({ welcomed: r.welcomed, view: r.view as TourView, done, visited, seen }) };
}

/** What's stored, read back: a value this build doesn't know is dropped, the rest stay. */
export function readTour(json: string): Tour {
  let r: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) r = parsed as Record<string, unknown>;
  } catch {
    // unreadable: a fresh one
  }
  const some = <T extends string>(list: readonly T[], raw: unknown): T[] => (Array.isArray(raw) ? list.filter((k) => raw.includes(k)) : []);
  return settle({
    welcomed: r.welcomed === true,
    view: TOUR_VIEWS.includes(r.view as TourView) ? (r.view as TourView) : 'open',
    done: some(TOUR_STEPS, r.done),
    visited: some(TOUR_PLACES, r.visited),
    seen: some(TOUR_HINTS, r.seen),
  });
}

/**
 * What's saved when `next` arrives over `stored`: a step, a place or a hint never comes undone (two phones, or a
 * slow save, can't untick one), and the welcome stays seen. Only how the list is shown follows the newest save.
 */
export function mergeTour(stored: Tour, next: Tour): Tour {
  const both = <T extends string>(list: readonly T[], a: T[], b: T[]) => list.filter((k) => a.includes(k) || b.includes(k));
  return settle({
    welcomed: stored.welcomed || next.welcomed,
    view: next.view,
    done: both(TOUR_STEPS, stored.done, next.done),
    visited: both(TOUR_PLACES, stored.visited, next.visited),
    seen: both(TOUR_HINTS, stored.seen, next.seen),
  });
}

export const tourComplete = (t: Tour): boolean => t.done.length === TOUR_STEPS.length;
/** The first step not done yet. */
export const nextStep = (t: Tour): TourStep | null => TOUR_STEPS.find((s) => !t.done.includes(s)) ?? null;
export const withDone = (t: Tour, step: TourStep): Tour => (t.done.includes(step) ? t : { ...t, done: TOUR_STEPS.filter((s) => s === step || t.done.includes(s)) });
export const withVisit = (t: Tour, place: TourPlace): Tour => (t.visited.includes(place) ? t : settle({ ...t, visited: TOUR_PLACES.filter((p) => p === place || t.visited.includes(p)) }));
export const withSeen = (t: Tour, hint: TourHint): Tour => (t.seen.includes(hint) ? t : { ...t, seen: TOUR_HINTS.filter((h) => h === hint || t.seen.includes(h)) });
/** Where a step's row takes you: Sources once Strainz has been opened. */
export const stepPath = (t: Tour, step: TourStep): string => (step === 'places' && t.visited.includes('strainz') && !t.visited.includes('sources') ? '/sources' : STEP_TEXT[step].path);
