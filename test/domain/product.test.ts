import { describe, expect, it } from 'vitest';
import { emptyProductInput, productTypeLabel, validateProductInput, type ProductInput } from '../../shared/domain/product';

const base = (over: Partial<ProductInput> = {}) => ({ ...emptyProductInput(), name: 'Gelato', ...over });
const ok = (over: Partial<ProductInput> = {}) => {
  const r = validateProductInput(base(over));
  if (!r.ok) throw new Error(r.message);
  return r.value;
};

describe('validateProductInput', () => {
  it('starts from the brief’s defaults', () => {
    expect(emptyProductInput()).toMatchObject({ productType: 'flower', concentrateType: 'hash', dateTried: null, private: false });
  });

  it('trims text, turns blanks into null and auto-capitalises name, Source and supplier', () => {
    const v = ok({ name: '  blue dream ', source: '   ', notes: '  keep  spacing inside  ', purchases: [{ date: null, amount: null, totalPaid: 5, supplier: 'o’shea' }] });
    expect(v.name).toBe('Blue Dream');
    expect(v.source).toBeNull();
    expect(v.notes).toBe('keep  spacing inside');
    expect(v.purchases[0]!.supplier).toBe('O’shea');
  });

  it('is idempotent', () => {
    const once = ok({ name: 'pineapple eXpress', source: 'rs11' });
    const twice = validateProductInput(once);
    expect(twice).toEqual({ ok: true, value: once });
  });

  it('drops purchases with no total paid and keeps ones with no amount', () => {
    const v = ok({
      purchases: [
        { date: '2026-01-01', amount: 3.5, totalPaid: null, supplier: null },
        { date: '2026-01-02', amount: null, totalPaid: 10, supplier: null },
      ],
    });
    expect(v.purchases).toEqual([{ date: '2026-01-02', amount: null, totalPaid: 10, supplier: null }]);
  });

  it('accepts a zero total paid (a gift) but not a zero amount', () => {
    expect(ok({ purchases: [{ date: null, amount: 1, totalPaid: 0, supplier: null }] }).purchases).toHaveLength(1);
    expect(validateProductInput(base({ purchases: [{ date: null, amount: 0, totalPaid: 1, supplier: null }] })).ok).toBe(false);
  });

  it('passes rating clears (null) through and checks the range', () => {
    expect(ok({ ratings: { look: null, taste: 1, high: 10 } }).ratings).toEqual({ look: null, taste: 1, high: 10 });
    expect(validateProductInput(base({ ratings: { look: 0.9 } })).ok).toBe(false);
  });

  it('checks real calendar dates', () => {
    expect(ok({ dateTried: '2024-02-29' }).dateTried).toBe('2024-02-29');
    expect(validateProductInput(base({ dateTried: '2025-02-29' })).ok).toBe(false);
    expect(validateProductInput(base({ dateTried: '29/02/2024' })).ok).toBe(false);
  });
});

describe('productTypeLabel (the one "Other" pattern)', () => {
  const lbl = (over: object) => productTypeLabel({ productType: 'flower', productTypeOther: null, concentrateType: 'hash', concentrateTypeOther: null, ...over });
  it.each([
    [{}, { type: 'Flower', concentrate: null }],
    [{ productType: 'concentrate' }, { type: 'Concentrate', concentrate: 'Hash' }],
    [{ productType: 'concentrate', concentrateType: 'other', concentrateTypeOther: 'Bubble hash' }, { type: 'Concentrate', concentrate: 'Bubble hash' }],
    [{ productType: 'concentrate', concentrateType: 'other' }, { type: 'Concentrate', concentrate: null }],
    [{ productType: 'concentrate', concentrateType: 'not_set' }, { type: 'Concentrate', concentrate: null }],
    [{ productType: 'other', productTypeOther: 'Tincture' }, { type: 'Tincture', concentrate: null }],
    [{ productType: 'other' }, { type: null, concentrate: null }],
    [{ productType: 'not_set' }, { type: null, concentrate: null }],
    // Concentrate type is kept but not shown when the product isn't a concentrate.
    [{ productType: 'flower', concentrateType: 'rosin' }, { type: 'Flower', concentrate: null }],
  ])('%j → %j', (over, out) => expect(lbl(over)).toEqual(out));
});
