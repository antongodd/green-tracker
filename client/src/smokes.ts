// Client access to your smokes (D43), with an in-memory cache and a hook, so the
// Smokes tab, the product and Log entry pages and the form all show the same list.
import { useEffect, useState } from 'preact/hooks';
import type { Smoke, SmokeInput } from '../../shared/domain/smoke';
import { api } from './api';

let list: Smoke[] | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** The smoke saved last, so the Smokes tab can light its row up once. */
let fresh: string | null = null;
export const takeFresh = (): string | null => {
  const f = fresh;
  fresh = null;
  return f;
};

export const cachedSmokes = (): Smoke[] | null => list;

export async function fetchSmokes(): Promise<Smoke[]> {
  list = (await api<{ smokes: Smoke[] }>('GET', '/smokes')).smokes;
  changed();
  return list;
}

export async function saveSmoke(id: string | null, input: SmokeInput): Promise<Smoke> {
  const { smoke } = id ? await api<{ smoke: Smoke }>('PUT', `/smokes/${encodeURIComponent(id)}`, input) : await api<{ smoke: Smoke }>('POST', '/smokes', input);
  if (list) list = [...list.filter((s) => s.id !== smoke.id), smoke];
  fresh = smoke.id;
  changed();
  return smoke;
}

export async function deleteSmoke(id: string): Promise<void> {
  await api('DELETE', `/smokes/${encodeURIComponent(id)}`);
  if (list) list = list.filter((s) => s.id !== id);
  changed();
}

/** After Add to leaderboard: the entry's smokes now belong to the new product (the server moved them). */
export function moveEntrySmokes(entryId: string, productId: string): void {
  if (!list) return;
  list = list.map((s) => (s.logEntryId === entryId ? { ...s, productId, logEntryId: null } : s));
  changed();
}

/** After a Log entry is deleted: its smokes went with it. */
export function dropEntrySmokes(entryId: string): void {
  if (!list) return;
  list = list.filter((s) => s.logEntryId !== entryId);
  changed();
}

/** Most used (D44): each of your products with how many times you've had it (0 when never). */
export function withSmokeCounts<P extends { id: string }>(products: P[], smokes: Smoke[]): (P & { smokeCount: number })[] {
  const counts = new Map<string, number>();
  for (const s of smokes) if (s.productId) counts.set(s.productId, (counts.get(s.productId) ?? 0) + 1);
  return products.map((p) => ({ ...p, smokeCount: counts.get(p.id) ?? 0 }));
}

/** Forget everything (sign-out, restore), so the next account never sees this one's data. */
export function clearSmokeCache(): void {
  list = null;
  changed();
}

/** Your smokes: the cached list straight away, refreshed once per screen (`fresh` once it has been). */
export function useSmokes(): { smokes: Smoke[] | null; fresh: boolean; error: unknown } {
  const [smokes, setSmokes] = useState<Smoke[] | null>(list);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const update = () => setSmokes(list);
    listeners.add(update);
    fetchSmokes()
      .then(() => setFresh(true))
      .catch(setError);
    return () => void listeners.delete(update);
  }, []);
  return { smokes, fresh, error };
}
