// Want to try (D92): your lists of strains and sources to look out for, with a small cache like products.ts, and
// the one message that says a want was ticked off (shown by <TickedOff /> wherever you are after Save).
import { useEffect, useState } from 'preact/hooks';
import { tickedOffText, type Want, type WantInput } from '../../shared/domain/wants';
import { api } from './api';

let list: Want[] | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const cachedWants = (): Want[] | null => list;

export async function fetchWants(): Promise<Want[]> {
  list = (await api<{ wants: Want[] }>('GET', '/wants')).wants;
  changed();
  return list;
}

export async function addWant(input: WantInput): Promise<Want> {
  const { want } = await api<{ want: Want }>('POST', '/wants', input);
  list = [want, ...(list ?? []).filter((w) => w.id !== want.id)];
  changed();
  return want;
}

export async function removeWant(id: string): Promise<void> {
  await api('DELETE', `/wants/${encodeURIComponent(id)}`);
  if (list) list = list.filter((w) => w.id !== id);
  changed();
}

/** Your lists, from the cache at once and fresh from the server. */
export function useWants(): { wants: Want[] | null; error: string } {
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const l = () => redraw((n) => n + 1);
    listeners.add(l);
    fetchWants().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t load your list.'));
    return () => void listeners.delete(l);
  }, []);
  return { wants: list, error };
}

// The message after a Save that ticked something off.
let message: string | null = null;
const messageListeners = new Set<() => void>();

/** A save's `tickedOff`: drops them from the cached lists and shows the message. */
export function noteTickedOff(ticked: readonly Pick<Want, 'kind' | 'name'>[] | undefined): void {
  const text = tickedOffText(ticked ?? []);
  if (!text) return;
  // The server removed them; the next fetch agrees. Until then, forget the cache.
  list = null;
  changed();
  message = text;
  messageListeners.forEach((l) => l());
}

/** The message that a want was ticked off, shown for a few seconds over whatever screen you land on. */
export function TickedOff() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const l = () => {
      setText(message);
      message = null;
    };
    messageListeners.add(l);
    return () => void messageListeners.delete(l);
  }, []);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), 4500);
    return () => clearTimeout(t);
  }, [text]);
  return text ? (
    <p class="toast ticked" role="status">
      {text}
    </p>
  ) : null;
}

export function clearWantsCache(): void {
  list = null;
}
