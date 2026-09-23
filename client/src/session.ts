import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Me } from './api';

export interface SessionState {
  me: Me;
  /** Re-reads who is signed in (after sign-in, sign-out, passkey changes). */
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<SessionState>({ me: { user: null }, refresh: async () => {} });
export const useSession = () => useContext(SessionContext);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `23 Sep 2026`, in the device's time zone. Fixed month names: Intl's en-GB varies ("Sept"). */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
