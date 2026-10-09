import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIVACY, effectivePrivacy, privacyEnabled, privacySummary, validatePrivacy } from '../../shared/domain/privacy';
import { rankByOptions, resolveViewState } from '../../shared/domain/leaderboard';

describe('privacy settings (D45)', () => {
  it('start exactly as before: Leaderboard, Source, Country, photos and profile photo shared; no smokes', () => {
    expect(DEFAULT_PRIVACY).toEqual({ shareBoard: true, shareSource: true, shareCountry: true, sharePhotos: true, shareSmokeCounts: false, shareMostUsed: false, shareSmokes: false, shareProfilePhoto: true });
    expect(privacySummary(DEFAULT_PRIVACY)).toBe('Followers see: Leaderboard, Source, Country, Photos');
  });

  it('a switch whose prerequisite is off counts as off, all the way up', () => {
    const all = { ...DEFAULT_PRIVACY, shareSmokeCounts: true, shareMostUsed: true, shareSmokes: true };
    expect(effectivePrivacy(all)).toEqual(all);
    expect(effectivePrivacy({ ...all, shareSmokeCounts: false })).toMatchObject({ shareMostUsed: false, shareSmokes: true });
    expect(effectivePrivacy({ ...all, shareBoard: false })).toEqual({ ...all, shareBoard: false, shareSource: false, shareCountry: false, sharePhotos: false, shareSmokeCounts: false, shareMostUsed: false, shareSmokes: false, shareProfilePhoto: true });
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareMostUsed')).toBe(false);
    expect(privacyEnabled({ ...all, shareBoard: false }, 'shareProfilePhoto')).toBe(true);
    expect(privacySummary({ ...all, shareBoard: false })).toBe('Followers see only your name');
    expect(privacySummary({ ...all, shareSource: false })).toBe('Followers see: Leaderboard, Country, Photos, Smoke counts, Most used, Smokes');
  });

  it('takes only a full set of true/false switches', () => {
    expect(validatePrivacy(DEFAULT_PRIVACY)).toEqual({ ok: true, value: DEFAULT_PRIVACY });
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, extra: 1 })).toEqual({ ok: true, value: DEFAULT_PRIVACY }); // unknown keys dropped
    expect(validatePrivacy({ ...DEFAULT_PRIVACY, shareBoard: 1 }).ok).toBe(false);
    const { shareSmokes: _s, ...missing } = DEFAULT_PRIVACY;
    expect(validatePrivacy(missing).ok).toBe(false);
    expect(validatePrivacy(null).ok).toBe(false);
  });

  it('a friend’s board offers Most used only when they share it', () => {
    expect(rankByOptions('all', { money: false }).map((o) => o.key)).not.toContain('used');
    expect(rankByOptions('all', { money: false, used: true }).map((o) => o.key)).toContain('used');
    expect(rankByOptions('flower', { money: false, used: true }).map((o) => o.key)).not.toContain('price');
    expect(resolveViewState({ filter: 'all', rankBy: 'used' }, { money: false, used: true }).rankBy).toBe('used');
    expect(resolveViewState({ filter: 'all', rankBy: 'used' }, { money: false }).rankBy).toBe('overall');
  });
});
