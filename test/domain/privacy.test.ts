import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIVACY, effectivePrivacy, privacyEnabled, privacySummary, validatePrivacy } from '../../shared/domain/privacy';

describe('privacy settings (D45)', () => {
  it('start exactly as before: Leaderboard, Source, Country, photos and profile photo shared', () => {
    expect(DEFAULT_PRIVACY).toEqual({ shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareProfilePhoto: true });
    expect(privacySummary(DEFAULT_PRIVACY)).toBe('Followers see: Leaderboard, Source, Country, Photos');
  });

  it('a switch whose prerequisite is off counts as off', () => {
    const all = { ...DEFAULT_PRIVACY };
    expect(effectivePrivacy(all)).toEqual(all);
    expect(effectivePrivacy({ ...all, shareBoard: false })).toEqual({ shareBoard: false, shareSource: false, shareCountry: false, sharePhotos: false, shareProfilePhoto: true });
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareSource')).toBe(false);
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareProfilePhoto')).toBe(true);
    expect(privacySummary({ ...all, shareBoard: false })).toBe('Followers see only your name');
    expect(privacySummary({ ...all, shareSource: false })).toBe('Followers see: Leaderboard, Country, Photos');
  });

  it('takes only a full set of true/false switches', () => {
    expect(validatePrivacy(DEFAULT_PRIVACY)).toEqual({ ok: true, value: DEFAULT_PRIVACY });
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, extra: 1 })).toEqual({ ok: true, value: DEFAULT_PRIVACY }); // unknown keys dropped
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, shareBoard: 1 }).ok).toBe(false);
    const { shareCountry: _c, ...missing } = DEFAULT_PRIVACY;
    expect(validatePrivacy(missing).ok).toBe(false);
    expect(validatePrivacy(null).ok).toBe(false);
  });

  it('settings from before Smokes went (D60) still read: the Smokes switches are dropped', () => {
    const old = { ...DEFAULT_PRIVACY, shareSource: false, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true };
    expect(validatePrivacy(old)).toEqual({ ok: true, value: { ...DEFAULT_PRIVACY, shareSource: false } });
  });
});
