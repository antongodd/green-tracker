// Privacy settings (D45, 0.38.0): what your approved followers see. One setting for all
// of them. The server applies these when it builds a follower's copy of your data, so a
// follower's phone never receives what you've hidden. Someone who doesn't follow you
// never sees any of it, whatever these say. Nothing here can show more than the field
// allow-list in social.ts permits.

export interface Privacy {
  /** Off: followers see your name (and photo, if shared) and nothing else. */
  shareBoard: boolean;
  shareSource: boolean;
  shareCountry: boolean;
  sharePhotos: boolean;
  /** "Smoked 14 times" on your products (D43). Off by default. */
  shareSmokeCounts: boolean;
  /** Most used in Rank by on your board (D44). Needs the counts. Off by default. */
  shareMostUsed: boolean;
  /** Each smoke's day, time and amount on your products, never its effect. Off by default. */
  shareSmokes: boolean;
  /** D23's profile photo rule, narrowed: off → everyone else sees your letter. */
  shareProfilePhoto: boolean;
}

export const PRIVACY_KEYS = ['shareBoard', 'shareSource', 'shareCountry', 'sharePhotos', 'shareSmokeCounts', 'shareMostUsed', 'shareSmokes', 'shareProfilePhoto'] as const;
export type PrivacyKey = (typeof PRIVACY_KEYS)[number];

/** Until you change anything: exactly what followers saw before 0.38.0. */
export const DEFAULT_PRIVACY: Privacy = {
  shareBoard: true,
  shareSource: true,
  shareCountry: true,
  sharePhotos: true,
  shareSmokeCounts: false,
  shareMostUsed: false,
  shareSmokes: false,
  shareProfilePhoto: true,
};

/** What each switch needs on before it can apply (its row is greyed out otherwise). */
export const PRIVACY_NEEDS: Partial<Record<PrivacyKey, PrivacyKey>> = {
  shareSource: 'shareBoard',
  shareCountry: 'shareBoard',
  sharePhotos: 'shareBoard',
  shareSmokeCounts: 'shareBoard',
  shareMostUsed: 'shareSmokeCounts',
  shareSmokes: 'shareBoard',
};

/** Whether a switch can apply: everything it needs is on (all the way up). */
export function privacyEnabled(p: Privacy, key: PrivacyKey): boolean {
  const need = PRIVACY_NEEDS[key];
  return !need || (p[need] && privacyEnabled(p, need));
}

/** What actually applies: a switch that's on but needs one that's off counts as off. */
export function effectivePrivacy(p: Privacy): Privacy {
  const out = { ...p };
  for (const k of PRIVACY_KEYS) out[k] = p[k] && privacyEnabled(p, k);
  return out;
}

/** A whole settings object, checked: every key a boolean. Anything else is refused. */
export function validatePrivacy(raw: unknown): { ok: true; value: Privacy } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'The privacy settings could not be read.' };
  const r = raw as Record<string, unknown>;
  const out = {} as Privacy;
  for (const k of PRIVACY_KEYS) {
    if (typeof r[k] !== 'boolean') return { ok: false, message: 'The privacy settings could not be read.' };
    out[k] = r[k] as boolean;
  }
  return { ok: true, value: out };
}

/** The line under More → What followers see: "Followers see: Leaderboard, Source, Country, Photos". */
export function privacySummary(p: Privacy): string {
  const e = effectivePrivacy(p);
  if (!e.shareBoard) return 'Followers see only your name';
  const parts = ['Leaderboard', e.shareSource && 'Source', e.shareCountry && 'Country', e.sharePhotos && 'Photos', e.shareSmokeCounts && 'Smoke counts', e.shareMostUsed && 'Most used', e.shareSmokes && 'Smokes'].filter(Boolean);
  return `Followers see: ${parts.join(', ')}`;
}
