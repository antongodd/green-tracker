// Someone's appearance as their board arrives with it (D74), kept for this visit so going back
// and forth between their board and product pages never shows yours in between.

import { useEffect, useState } from 'preact/hooks';
import type { Appearance } from '../../shared/domain/gems';

const known = new Map<string, Appearance>();
const listeners = new Set<() => void>();
const key = (username: string) => username.toLowerCase();

export function rememberTheirLook(username: string, a: Appearance | undefined) {
  if (!a) return;
  const before = known.get(key(username));
  if (before && JSON.stringify(before) === JSON.stringify(a)) return;
  known.set(key(username), a);
  listeners.forEach((f) => f());
}

export const knownTheirLook = (username: string): Appearance | null => known.get(key(username)) ?? null;

/** Signing out or in as someone else. */
export const forgetTheirLooks = () => known.clear();

/** Their appearance once known; re-renders when it arrives or changes. */
export function useTheirLook(username: string): Appearance | null {
  const [, changed] = useState(0);
  useEffect(() => {
    const f = () => changed((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return knownTheirLook(username);
}
