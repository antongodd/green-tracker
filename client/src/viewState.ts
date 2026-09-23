// Filter and Rank by are view state, stored per device (D5) — never part of the
// user's data or export. The Type filter is one setting shared by the
// Leaderboard and the Log.
import { resolveViewState, type ViewState } from '../../shared/domain/leaderboard';

const KEY = 'gt.view';

function read(): { filter?: unknown; rankBy?: unknown } {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { filter?: unknown; rankBy?: unknown }) : {};
  } catch {
    return {};
  }
}

function write(view: ViewState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    // Private browsing or storage full: the setting just won't persist.
  }
}

/** The stored view, validated. An invalid or no-longer-offered value falls back and is overwritten. */
export function loadView(): ViewState {
  const { filter, rankBy, changed } = resolveViewState(read(), { money: true });
  if (changed) write({ filter, rankBy });
  return { filter, rankBy };
}

/** Saves a change; a Rank by that doesn't exist under the new filter falls back to Overall. */
export function saveView(next: ViewState): ViewState {
  const { filter, rankBy } = resolveViewState(next, { money: true });
  write({ filter, rankBy });
  return { filter, rankBy };
}
