// Filter and Rank by are view state, stored per device (D5) — never part of the
// user's data or export. The Type filter is one setting shared by the
// Leaderboard and the Log.
import { resolveViewState, type ViewState } from '../../shared/domain/leaderboard';

const KEY = 'gt.view';
/**
 * Someone else's Leaderboard offers no Price or VFM, so its Rank by is stored
 * separately — viewing a friend never resets your own price ranking. The Type
 * filter stays shared everywhere.
 */
const OTHERS_KEY = 'gt.view.others';

function read(key = KEY): { filter?: unknown; rankBy?: unknown } {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { filter?: unknown; rankBy?: unknown }) : {};
  } catch {
    return {};
  }
}

function write(view: ViewState, key = KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // Private browsing or storage full: the setting just won't persist.
  }
}

/**
 * The stored view, validated. An invalid or no-longer-offered value falls back and is overwritten,
 * except a stored Most used where Smokes is off (`used` false, D46): it shows Overall but is kept,
 * so it comes back once Smokes does.
 */
export function loadView(used = true): ViewState {
  const stored = read();
  const { filter, rankBy, changed } = resolveViewState(stored, { money: true, used });
  if (changed && (used || stored.rankBy !== 'used')) write({ filter, rankBy });
  return { filter, rankBy };
}

/** Saves a change; a Rank by that doesn't exist under the new filter falls back to Overall. */
export function saveView(next: ViewState, used = true): ViewState {
  const { filter, rankBy } = resolveViewState(next, { money: true, used });
  write({ filter, rankBy });
  return { filter, rankBy };
}

/**
 * A followed person's view: the shared Type filter with its own Rank by (never Price or VFM;
 * Most used only when that person shares it, `used`, D45). A stored Most used isn't overwritten
 * by a board that doesn't offer it, so it comes back on one that does.
 */
export function loadOthersView(used = false): ViewState {
  const { rankBy } = read(OTHERS_KEY);
  const { filter, rankBy: r } = resolveViewState({ filter: loadView().filter, rankBy }, { money: false, used });
  return { filter, rankBy: r };
}

export function saveOthersView(next: ViewState, used = false): ViewState {
  const { filter, rankBy } = resolveViewState(next, { money: false, used });
  write({ filter, rankBy }, OTHERS_KEY);
  saveView({ ...loadView(), filter });
  return { filter, rankBy };
}
