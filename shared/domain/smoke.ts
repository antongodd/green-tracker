// Smokes (D43, 0.36.0): one record per time you had something — what (a product on
// your Leaderboard or a loose Log entry), when (your phone's own date and time, as
// typed: 23:30 stays 23:30 wherever you are), how much and how it felt. Yours only:
// followers never see any of it. Counts and groupings are derived, never stored.

import { isIsoDate } from './product';
import { unitFor } from './productTypes';

export interface Smoke {
  id: string;
  /** Exactly one of productId and logEntryId is set. */
  productId: string | null;
  logEntryId: string | null;
  /** YYYY-MM-DD, the phone's own calendar day. */
  date: string;
  /** HH:MM, 24-hour, the phone's own clock. */
  time: string;
  /** Grams, or mg of THC for edibles. */
  amount: number | null;
  effect: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SmokeInput {
  productId: string | null;
  logEntryId: string | null;
  date: string;
  time: string;
  amount: number | null;
  effect: string | null;
}

export const SMOKE_LIMITS = { effect: 500, amount: 100_000 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (s: unknown): s is string => typeof s === 'string' && TIME.test(s);

/** `2026-10-08` plus `n` days, by the calendar (no time zone involved). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/**
 * The fields of a smoke, checked the same way on the phone and the server. `latest` is
 * the last date allowed: the phone passes its own today; the server, which can't know
 * your time zone, allows a day past its own.
 */
export function validateSmokeFields(raw: unknown, latest?: string): Result<Omit<SmokeInput, 'productId' | 'logEntryId'>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'The smoke could not be read.' };
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== 'string' || !isIsoDate(r.date)) return { ok: false, message: 'Choose a date.' };
  if (latest && r.date > latest) return { ok: false, message: 'The date can’t be in the future.' };
  if (!isTime(r.time)) return { ok: false, message: 'Choose a time.' };
  const amount = r.amount ?? null;
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > SMOKE_LIMITS.amount)) {
    return { ok: false, message: 'How much must be more than 0.' };
  }
  const effectRaw = r.effect ?? null;
  if (effectRaw !== null && typeof effectRaw !== 'string') return { ok: false, message: 'The effect could not be read.' };
  const effect = effectRaw === null || effectRaw.trim() === '' ? null : effectRaw.trim();
  if (effect !== null && effect.length > SMOKE_LIMITS.effect) return { ok: false, message: `Keep the effect to ${SMOKE_LIMITS.effect} characters.` };
  return { ok: true, value: { date: r.date, time: r.time, amount: amount as number | null, effect } };
}

/** A whole smoke: its fields, and what it was (exactly one product or Log entry). */
export function validateSmokeInput(raw: unknown, latest?: string): Result<SmokeInput> {
  const f = validateSmokeFields(raw, latest);
  if (!f.ok) return f;
  const r = raw as Record<string, unknown>;
  const productId = r.productId ?? null;
  const logEntryId = r.logEntryId ?? null;
  const isId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if ((productId === null) === (logEntryId === null) || (productId !== null && !isId(productId)) || (logEntryId !== null && !isId(logEntryId))) {
    return { ok: false, message: 'Choose what you had.' };
  }
  return { ok: true, value: { productId: productId as string | null, logEntryId: logEntryId as string | null, ...f.value } };
}

// Wording ---------------------------------------------------------------------

/** Edibles are taken; everything else is smoked. */
export function smokeVerb(typeKey: string): 'smoked' | 'taken' {
  return typeKey === 'edibles' ? 'taken' : 'smoked';
}

/** "Smoked 14 times", "Taken once", "Not smoked yet". */
export function timesText(typeKey: string, n: number): string {
  const verb = smokeVerb(typeKey);
  if (n === 0) return `Not ${verb} yet`;
  const Verb = verb[0]!.toUpperCase() + verb.slice(1);
  return `${Verb} ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}`;
}

/** The big tile's caption under the count: "times smoked", "time taken". */
export function timesCaption(typeKey: string, n: number): string {
  return `${n === 1 ? 'time' : 'times'} ${smokeVerb(typeKey)}`;
}

/** An amount in the type's unit: `0.3 g`, `10 mg`. */
export function smokeAmountText(typeKey: string, amount: number): string {
  const s = (Math.round(amount * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${s} ${unitFor(typeKey).amount}`;
}

// Ordering, days and counts ---------------------------------------------------

/** Newest first: date, then time, then the order they were added. */
export function sortSmokes<T extends Pick<Smoke, 'date' | 'time' | 'createdAt'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.time !== b.time ? (a.time < b.time ? 1 : -1) : b.createdAt - a.createdAt));
}

/** `p:<id>` or `e:<id>`: what a smoke was. */
export const smokeTarget = (s: Pick<Smoke, 'productId' | 'logEntryId'>): string => (s.productId ? `p:${s.productId}` : `e:${s.logEntryId}`);

/** Smokes grouped by day, newest day first, each day newest first. */
export function groupByDay<T extends Pick<Smoke, 'date' | 'time' | 'createdAt'>>(list: readonly T[]): { date: string; smokes: T[] }[] {
  const out: { date: string; smokes: T[] }[] = [];
  for (const s of sortSmokes(list)) {
    const last = out[out.length - 1];
    if (last && last.date === s.date) last.smokes.push(s);
    else out.push({ date: s.date, smokes: [s] });
  }
  return out;
}

/** The week strip: the 7 days ending today, oldest first, each with its count. */
export function weekStrip(list: readonly Pick<Smoke, 'date'>[], today: string): { date: string; count: number }[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return days.map((date) => ({ date, count: list.filter((s) => s.date === date).length }));
}

/** The figures beside the strip: the last 7 days (today included) and this calendar month. */
export function smokeTotals(list: readonly Pick<Smoke, 'date'>[], today: string): { week: number; month: number } {
  const from = addDays(today, -6);
  const month = today.slice(0, 7);
  return {
    week: list.filter((s) => s.date >= from && s.date <= today).length,
    month: list.filter((s) => s.date.slice(0, 7) === month && s.date <= today).length,
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d!, wd: new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() };
};

/** The short weekday of a calendar day: "Thu". */
export const weekdayShort = (iso: string): string => WEEKDAYS[parts(iso).wd]!;

/** A day's heading: "Today", "Yesterday", "Tue 6 Oct", or "Tue 6 Oct 2025" in another year. */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  const p = parts(iso);
  return `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]}${p.y !== parts(today).y ? ` ${p.y}` : ''}`;
}

/** When a smoke was, in a line: "Today, 21:40", "Tue 6 Oct, 19:05". */
export const whenText = (s: Pick<Smoke, 'date' | 'time'>, today: string): string => `${dayLabel(s.date, today)}, ${s.time}`;

/** What you had most recently first, each once (the picker's Recent). */
export function recentTargets(list: readonly Smoke[]): string[] {
  const seen: string[] = [];
  for (const s of sortSmokes(list)) {
    const k = smokeTarget(s);
    if (!seen.includes(k)) seen.push(k);
  }
  return seen;
}

/** A product's or Log entry's smokes, newest first. */
export function smokesOf(list: readonly Smoke[], target: string): Smoke[] {
  return sortSmokes(list.filter((s) => smokeTarget(s) === target));
}
