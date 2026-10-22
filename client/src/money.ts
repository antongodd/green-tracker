// Money (D66): your main currency, and exchange rates for the purchase form.
import { DEFAULT_CURRENCY, isCurrencyCode } from '../../shared/domain/currency';
import { api } from './api';
import { useSession } from './session';

/** Your main currency: every price shown together or compared is in it. */
export const useCurrency = (): string => useSession().me.currency ?? DEFAULT_CURRENCY;

/** Changes it; the server works every purchase out again in the new one. */
export const saveCurrency = (currency: string) => api<{ currency: string }>('PUT', '/money', { currency }).then((r) => r.currency);

const rates = new Map<string, Promise<number>>();

/** 1 `from` in `to` on `date` (none → today), from the server; asked once per visit. */
export function fetchRate(from: string, to: string, date: string | null): Promise<number> {
  const key = `${from}|${to}|${date ?? ''}`;
  let r = rates.get(key);
  if (!r) {
    r = api<{ rate: number }>('GET', `/money/rate?from=${from}&to=${to}${date ? `&date=${date}` : ''}`).then((x) => x.rate);
    r.catch(() => rates.delete(key));
    rates.set(key, r);
  }
  return r;
}

/** The phone remembers the currency of the purchase you last added, so a week in Amsterdam is € all the way. */
const LAST = 'gt.currency.last';
export function lastCurrency(): string | null {
  try {
    const c = localStorage.getItem(LAST);
    return isCurrencyCode(c) ? c : null;
  } catch {
    return null;
  }
}
export function rememberCurrency(code: string): void {
  try {
    localStorage.setItem(LAST, code);
  } catch {}
}
