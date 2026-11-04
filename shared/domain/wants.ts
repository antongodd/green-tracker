// Want to try (D92): strains (on Strainz) and sources (on Sources) you want to look out for. Private:
// only you ever see them (never followers, never posts). One leaves its list by itself when you add a
// product with that name (a strain) or from that source (its Source, or where a purchase was bought),
// matched like every other name (nameKey).
import { autoCapitalise } from './capitalise';
import { nameKey } from './names';

export type WantKind = 'strain' | 'source';
export const WANT_KINDS: readonly WantKind[] = ['strain', 'source'];

export interface Want {
  id: string;
  kind: WantKind;
  name: string;
  note: string | null;
  createdAt: number;
}

export interface WantInput {
  kind: WantKind;
  name: string;
  note: string | null;
}

export const WANT_LIMITS = { name: 100, note: 200, perAccount: 500 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** Checks what the Want to try sheet sends: a kind, a name (capitalised like a product's) and an optional note. */
export function validateWantInput(raw: unknown): Result<WantInput> {
  const bad = (message: string): Result<WantInput> => ({ ok: false, message });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('That couldn’t be read.');
  const r = raw as Record<string, unknown>;
  if (!WANT_KINDS.includes(r.kind as WantKind)) return bad('That couldn’t be read.');
  const kind = r.kind as WantKind;
  if (typeof r.name !== 'string') return bad(kind === 'strain' ? 'Give the strain a name.' : 'Give the source a name.');
  const name = autoCapitalise(r.name);
  if (!name || !nameKey(name)) return bad(kind === 'strain' ? 'Give the strain a name.' : 'Give the source a name.');
  if (name.length > WANT_LIMITS.name) return bad(`Keep the name to ${WANT_LIMITS.name} characters.`);
  if (r.note !== undefined && r.note !== null && typeof r.note !== 'string') return bad('That couldn’t be read.');
  const note = typeof r.note === 'string' ? r.note.trim() : '';
  if (note.length > WANT_LIMITS.note) return bad(`Keep the note to ${WANT_LIMITS.note} characters.`);
  return { ok: true, value: { kind, name, note: note || null } };
}

/** What a product has that can tick a want off: its name (the strain), its Source and where it was bought. */
export interface TickingProduct {
  name: string;
  source: string | null;
  purchases: readonly { supplier: string | null }[];
}

/** The wants this product ticks off: a strain with its name, a source it's from or was bought at. */
export function wantsTriedBy<W extends Pick<Want, 'kind' | 'name'>>(wants: readonly W[], p: TickingProduct): W[] {
  const strain = nameKey(p.name);
  const sources = new Set([p.source, ...p.purchases.map((x) => x.supplier)].flatMap((s) => (s && nameKey(s) ? [nameKey(s)] : [])));
  return wants.filter((w) => (w.kind === 'strain' ? nameKey(w.name) === strain : sources.has(nameKey(w.name))));
}

/** The words that say a want left its list (shown once, after Save). */
export function tickedOffText(ticked: readonly Pick<Want, 'kind' | 'name'>[]): string | null {
  if (!ticked.length) return null;
  const names = ticked.map((w) => w.name);
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;
  return `You tried ${list}! ${names.length === 1 ? 'It’s' : 'They’re'} off your Want to try list.`;
}
