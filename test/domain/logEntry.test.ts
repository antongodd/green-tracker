import { describe, expect, it } from 'vitest';
import { emptyLogEntryInput, keptPromotionInput, promotionInput, returnedAmount, validateLogEntryInput } from '../../shared/domain/logEntry';
import { emptyProductInput, type Product } from '../../shared/domain/product';

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

describe('Return to Log (D50)', () => {
  it('the amount is all the purchases’ amounts added up; none with an amount is no amount', () => {
    expect(returnedAmount([{ amount: 3.5 }, { amount: 3.5 }, { amount: null }])).toBe(7);
    expect(returnedAmount([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3); // no floating-point dust
    expect(returnedAmount([{ amount: null }])).toBeNull();
    expect(returnedAmount([])).toBeNull();
    expect(returnedAmount([{ amount: 900_000 }, { amount: 900_000 }])).toBe(1_000_000); // within what an entry may hold
  });

  it('Add to leaderboard fills in everything kept, under the entry’s own name, type, country and photo (first)', () => {
    const kept: Product = {
      ...emptyProductInput(),
      id: 'p1',
      name: 'Old Name',
      strainType: 'indica',
      notes: 'Kept notes',
      source: 'Club',
      ratings: { look: 8, consistency: 7 },
      purchases: [{ id: 'pu1', seq: 1, date: '2026-09-03', amount: 3.5, totalPaid: 30, supplier: 'A' }],
      photos: [{ id: 'ph2', version: 'v', crop: null, cutout: false }],
      private: true,
      archived: false,
      createdAt: 1,
      updatedAt: 2,
    };
    const entry = { ...emptyLogEntryInput(), name: 'New Name', productType: 'pre_roll' as const, country: 'ES', amount: 12, photos: [{ id: 'ph1', crop: null }] };
    expect(keptPromotionInput(entry, kept)).toEqual({
      ...emptyProductInput(),
      name: 'New Name',
      productType: 'pre_roll',
      country: 'ES',
      strainType: 'indica',
      notes: 'Kept notes',
      source: 'Club',
      private: true,
      ratings: { look: 8, consistency: 7 },
      purchases: [{ id: 'pu1', date: '2026-09-03', amount: 3.5, totalPaid: 30, supplier: 'A' }],
      photos: [{ id: 'ph1', crop: null }, { id: 'ph2', crop: null }],
    });
  });
});
