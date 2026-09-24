import { describe, expect, it } from 'vitest';
import { emptyLogEntryInput, promotionInput, validateLogEntryInput } from '../../shared/domain/logEntry';

describe('log entries', () => {
  it('uses the same defaults as a product: Flower, concentrate type Hash', () => {
    expect(emptyLogEntryInput()).toMatchObject({ productType: 'flower', concentrateType: 'hash', amount: null, photos: [] });
  });

  it('shares the product rules: auto-capitalised name, the Other pattern, real countries', () => {
    const r = validateLogEntryInput({ ...emptyLogEntryInput(), name: ' gary payton ', country: 'OTHER', countryOther: 'Atlantis' });
    expect(r).toMatchObject({ ok: true, value: { name: 'Gary Payton', country: 'OTHER', countryOther: 'Atlantis' } });
    expect(validateLogEntryInput({ ...emptyLogEntryInput(), name: 'X', country: 'ZZ' }).ok).toBe(false);
  });

  it('allows one photo and a positive amount (or none)', () => {
    const photo = { upload: 'u1', crop: null };
    expect(validateLogEntryInput({ ...emptyLogEntryInput(), name: 'X', photos: [photo, { upload: 'u2', crop: null }] })).toEqual({ ok: false, message: 'A log entry has one photo.' });
    expect(validateLogEntryInput({ ...emptyLogEntryInput(), name: 'X', amount: -1 }).ok).toBe(false);
    expect(validateLogEntryInput({ ...emptyLogEntryInput(), name: 'X', amount: 3.5, photos: [photo] }).ok).toBe(true);
  });
});

describe('promotion pre-fill (§10.2)', () => {
  it('carries name, country, photo, product type and concentrate type; drops the amount; the rest starts empty', () => {
    const p = promotionInput({
      ...emptyLogEntryInput(),
      name: 'RS11',
      country: 'TH',
      productType: 'concentrate',
      concentrateType: 'other',
      concentrateTypeOther: 'Bubble hash',
      amount: 7,
      photos: [{ id: 'ph1', crop: null }],
    });
    expect(p).toMatchObject({ name: 'RS11', country: 'TH', productType: 'concentrate', concentrateType: 'other', concentrateTypeOther: 'Bubble hash', photos: [{ id: 'ph1', crop: null }] });
    expect(p).toMatchObject({ purchases: [], ratings: {}, source: null, dateTried: null, notes: null, strainType: null, private: false });
  });
});
