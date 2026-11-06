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
  /** D23's profile photo rule, narrowed: off → everyone else sees your letter. */
  shareProfilePhoto: boolean;
  /**
   * D94: your Want to try lists (strains and sources), names only, never the notes. Off for everyone until they turn
   * it on (the lists were promised private, D92). Separate from the Leaderboard switch.
   */
  shareWants: boolean;
}

export const PRIVACY_KEYS = ['shareBoard', 'shareSource', 'shareCountry', 'sharePhotos', 'shareProfilePhoto', 'shareWants'] as const;
export type PrivacyKey = (typeof PRIVACY_KEYS)[number];

/** Until you change anything: exactly what followers saw before 0.38.0. */
export const DEFAULT_PRIVACY: Privacy = {
  shareBoard: true,
  shareSource: true,
  shareCountry: true,
  sharePhotos: true,
  shareProfilePhoto: true,
  shareWants: false,
};

/** What each switch needs on before it can apply (its row is greyed out otherwise). */
export const PRIVACY_NEEDS: Partial<Record<PrivacyKey, PrivacyKey>> = {
  shareSource: 'shareBoard',
  shareCountry: 'shareBoard',
  sharePhotos: 'shareBoard',
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

/**
 * A whole settings object, checked: every key a boolean. Anything else is refused. Keys it
 * doesn't know are ignored (an older app or export still sending the Smokes switches, D60).
 */
export function validatePrivacy(raw: unknown): { ok: true; value: Privacy } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'The privacy settings couldn’t be read.' };
  const r = raw as Record<string, unknown>;
  const out = {} as Privacy;
  for (const k of PRIVACY_KEYS) {
    // D94: an app or export from before shareWants doesn't send it: off, as it was then.
    if (k === 'shareWants' && r[k] === undefined) {
      out[k] = false;
      continue;
    }
    if (typeof r[k] !== 'boolean') return { ok: false, message: 'The privacy settings couldn’t be read.' };
    out[k] = r[k] as boolean;
  }
  return { ok: true, value: out };
}

/** The line under Settings → What followers see: "Leaderboard, Source, Country, Photos, Posts" (posts are always shared, D77). */
export function privacySummary(p: Privacy): string {
  const e = effectivePrivacy(p);
  if (!e.shareBoard) return e.shareWants ? 'Your name, your posts and Want to try' : 'Only your name and your posts';
  const parts = ['Leaderboard', e.shareSource && 'Source', e.shareCountry && 'Country', e.sharePhotos && 'Photos', 'Posts', e.shareWants && 'Want to try'].filter(Boolean);
  return parts.join(', ');
}
