import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIVACY, effectivePrivacy, privacyEnabled, privacySummary, validatePrivacy } from '../../shared/domain/privacy';

describe('privacy settings (D45)', () => {
  it('start exactly as before: Leaderboard, Source, Country, photos and profile photo shared', () => {
    expect(DEFAULT_PRIVACY).toEqual({ shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true, shareWants: false });
    expect(privacySummary(DEFAULT_PRIVACY)).toBe('Leaderboard, Source, Country, Photos, Posts');
  });

  it('a switch whose prerequisite is off counts as off', () => {
    const all = { ...DEFAULT_PRIVACY };
    expect(effectivePrivacy(all)).toEqual(all);
    expect(effectivePrivacy({ ...all, shareBoard: false })).toEqual({ shareBoard: false, shareSource: false, shareCountry: false, sharePhotos: false, shareProfilePhoto: true, shareWants: false });
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareSource')).toBe(false);
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareProfilePhoto')).toBe(true);
    expect(privacySummary({ ...all, shareBoard: false })).toBe('Only your name and your posts');
    expect(privacySummary({ ...all, shareSource: false })).toBe('Leaderboard, Country, Photos, Posts');
    // D94: Want to try is its own switch, needing nothing else.
    expect(privacySummary({ ...all, shareWants: true })).toBe('Leaderboard, Source, Country, Photos, Posts, Want to try');
    expect(privacySummary({ ...all, shareBoard: false, shareWants: true })).toBe('Your name, your posts and Want to try');
    expect(effectivePrivacy({ ...all, shareBoard: false, shareWants: true }).shareWants).toBe(true);
  });

  it('takes only a full set of true/false switches', () => {
    expect(validatePrivacy(DEFAULT_PRIVACY)).toEqual({ ok: true, value: DEFAULT_PRIVACY });
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, extra: 1 })).toEqual({ ok: true, value: DEFAULT_PRIVACY }); // unknown keys dropped
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, shareBoard: 1 }).ok).toBe(false);
    const { shareCountry: _c, ...missing } = DEFAULT_PRIVACY;
    expect(validatePrivacy(missing).ok).toBe(false);
    // D94: shareWants alone may be missing (an older app or export): off.
    const { shareWants: _w, ...older } = DEFAULT_PRIVACY;
    expect(validatePrivacy({ ...older })).toEqual({ ok: true, value: DEFAULT_PRIVACY });
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, shareWants: 'yes' }).ok).toBe(false);
    expect(validatePrivacy(null).ok).toBe(false);
  });

  it('settings from before Smokes went (D60) still read: the Smokes switches are dropped', () => {
    const old = { ...DEFAULT_PRIVACY, shareSource: false, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true };
    expect(validatePrivacy(old)).toEqual({ ok: true, value: { ...DEFAULT_PRIVACY, shareSource: false } });
  });
});
