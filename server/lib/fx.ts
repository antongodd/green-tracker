import type { Env } from '../env';

// Exchange rates (D66): the European Central Bank's daily reference rates, through Frankfurter
// (a free, open-source service; no key, no account). The app's first outside connection: only
// the server asks, never your phone, and all it sends is which currencies and which days — nothing
// about you or your products. Each day's rates are kept in D1 (fx_rates) once fetched, so a day
// is asked for once. When the service can't answer, the app asks you to type the rate instead.

export const FX_DEFAULT_URL = 'https://api.frankfurter.dev';
/** The first day the ECB published rates. */
export const FIRST_FX_DAY = '1999-01-04';
const TIMEOUT_MS = 8000;

export class FxUnavailable extends Error {
  constructor() {
    super('fx_unavailable');
  }
}

export interface RateNeed {
  /** The currency you paid in. */
  from: string;
  /** Your main currency. */
  to: string;
  /** The purchase's day; none → today. */
  day: string | null;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** The day a rate is looked up for: today when undated or in the future, never before the ECB's first. */
export function fxDay(day: string | null, today = todayUtc()): string {
  const d = day ?? today;
  return d > today ? today : d < FIRST_FX_DAY ? FIRST_FX_DAY : d;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Reads the service's answer: v2's rows (`[{ date, base, quote, rate }]`), or v1's table
 * (`{ rates: { day: { code: rate } } }`). Everything is per euro.
 */
export function parseRates(body: unknown): Map<string, [string, number][]> {
  const out = new Map<string, [string, number][]>();
  const add = (date: unknown, code: unknown, rate: unknown) => {
    if (typeof date !== 'string' || typeof code !== 'string' || typeof rate !== 'number' || !(rate > 0) || !Number.isFinite(rate)) return;
    out.set(code, [...(out.get(code) ?? []), [date.slice(0, 10), rate]]);
  };
  if (Array.isArray(body)) {
    for (const r of body) if (r && typeof r === 'object' && (r as { base?: unknown }).base === 'EUR') add((r as Record<string, unknown>).date, (r as Record<string, unknown>).quote, (r as Record<string, unknown>).rate);
  } else if (body && typeof body === 'object' && (body as { rates?: unknown }).rates && typeof (body as { rates: unknown }).rates === 'object') {
    for (const [date, row] of Object.entries((body as { rates: Record<string, unknown> }).rates)) {
      if (row && typeof row === 'object') for (const [code, rate] of Object.entries(row)) add(date, code, rate);
    }
  }
  for (const list of out.values()) list.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/** The rate for `day`: the latest published on or before it (weekends and holidays have none of their own). */
function onOrBefore(list: [string, number][] | undefined, day: string): number | undefined {
  let found: number | undefined;
  for (const [d, r] of list ?? []) {
    if (d > day) break;
    found = r;
  }
  return found;
}

/**
 * The rate for each need, in order: 1 unit of `from` in `to` on its day. Uses the kept rates
 * where it can and asks the service once for the rest. Throws FxUnavailable when it can't.
 */
export async function ratesFor(env: Pick<Env, 'DB' | 'FX_URL'>, needs: readonly RateNeed[]): Promise<number[]> {
  const today = todayUtc();
  const asked = needs.map((n) => ({ ...n, day: fxDay(n.day, today) }));
  const wanted = new Map<string, { day: string; currency: string }>();
  for (const n of asked) if (n.from !== n.to) for (const c of [n.from, n.to]) if (c !== 'EUR') wanted.set(`${n.day}|${c}`, { day: n.day, currency: c });
  const perEur = new Map<string, number>();
  if (wanted.size) {
    const days = [...new Set([...wanted.values()].map((w) => w.day))];
    const codes = [...new Set([...wanted.values()].map((w) => w.currency))];
    const { results } = await env.DB.prepare('SELECT day, currency, per_eur FROM fx_rates WHERE day IN (SELECT value FROM json_each(?1)) AND currency IN (SELECT value FROM json_each(?2))')
      .bind(JSON.stringify(days), JSON.stringify(codes))
      .all<{ day: string; currency: string; per_eur: number }>();
    for (const r of results) perEur.set(`${r.day}|${r.currency}`, r.per_eur);
    const missing = [...wanted.entries()].filter(([k]) => !perEur.has(k)).map(([, w]) => w);
    if (missing.length) {
      const missingDays = missing.map((m) => m.day).sort();
      // A few days before the first, so a Monday or a day after a holiday finds the working day before.
      const from = addDays(missingDays[0]!, -10);
      const to = missingDays[missingDays.length - 1]!;
      const quotes = [...new Set(missing.map((m) => m.currency))].sort().join(',');
      const url = `${env.FX_URL || FX_DEFAULT_URL}/v2/rates?base=EUR&quotes=${quotes}&from=${from}&to=${to}`;
      const get = (u: string) => fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      let table: Map<string, [string, number][]>;
      try {
        // The ECB's own rates; should the service ever refuse that choice, its blended ones.
        let res = await get(`${url}&providers=ecb`);
        if (!res.ok && res.status !== 429 && res.status < 500) res = await get(url);
        if (!res.ok) throw new FxUnavailable();
        table = parseRates(await res.json());
      } catch {
        throw new FxUnavailable();
      }
      const fresh: { d: string; c: string; r: number }[] = [];
      for (const m of missing) {
        const r = onOrBefore(table.get(m.currency), m.day);
        if (r === undefined) throw new FxUnavailable();
        perEur.set(`${m.day}|${m.currency}`, r);
        // Today's may still change (the ECB publishes in the afternoon): only past days are kept.
        if (m.day < today) fresh.push({ d: m.day, c: m.currency, r });
      }
      if (fresh.length) {
        await env.DB.prepare(
          `INSERT INTO fx_rates (day, currency, per_eur, fetched_at)
           SELECT json_extract(value, '$.d'), json_extract(value, '$.c'), json_extract(value, '$.r'), ?2 FROM json_each(?1) WHERE true
           ON CONFLICT (day, currency) DO NOTHING`,
        )
          .bind(JSON.stringify(fresh), Date.now())
          .run();
      }
    }
  }
  const of = (day: string, c: string) => (c === 'EUR' ? 1 : perEur.get(`${day}|${c}`)!);
  return asked.map((n) => (n.from === n.to ? 1 : of(n.day, n.to) / of(n.day, n.from)));
}
