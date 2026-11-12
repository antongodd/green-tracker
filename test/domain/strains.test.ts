import { describe, expect, it } from 'vitest';
import { compareStrains, formatDay, kindLabel, onlyInLog, onStrainz, sortStrains, strainPath, strainRank, strainScores, strainsOf, type StrainEntry, type StrainProduct } from '../../shared/domain/strains';
import { tickedOffText, validateWantInput, wantsTriedBy } from '../../shared/domain/wants';

// Strainz (D92): a strain is a product's Name, matched like every name (capitals, spaces and punctuation don't
// count); "Cookies Zkittlez" is another strain (the owner: "they are not the same strain").

let n = 0;
const p = (name: string, score: number | null, over: Partial<StrainProduct & { concentrateType: string }> = {}): StrainProduct & { concentrateType?: string } => ({
  id: `p${++n}`,
  name,
  productType: 'flower',
  strainType: null,
  ratings: score === null ? {} : { look: score, smell: score, taste: score, burn: score },
  source: null,
  dateTried: '2026-10-01',
  createdAt: 1,
  purchases: [],
  ...over,
});

describe('strainsOf', () => {
  const list = [
    p('Zkittlez', 9, { source: 'Green Room', strainType: 'indica', dateTried: '2026-06-02', purchases: [{ date: '2026-06-02', amount: 2, totalPaid: 20, supplier: null, seq: 1 }] }),
    p('zkittlez ', 8, { productType: 'concentrate', concentrateType: 'live_rosin', source: 'Kush Co', strainType: 'indica', dateTried: '2026-09-14', purchases: [{ date: '2026-09-14', amount: 1, totalPaid: 40, supplier: null, seq: 1 }] }),
    p('ZKITTLEZ', 7, { source: 'Green Room', strainType: 'hybrid', dateTried: null, createdAt: Date.UTC(2026, 9, 28) }),
    p('Cookies Zkittlez', 9.5),
    p('Gelato 41', null),
    p('Archived', 10, { archived: true }),
  ];
  const strains = strainsOf(list);
  const z = strains.find((s) => s.key === 'zkittlez')!;

  it('groups by name, ignoring capitals and spaces; another name is another strain; archived ones left out', () => {
    expect(strains.map((s) => s.name).sort()).toEqual(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
    expect(z.products.map((x) => x.name)).toEqual(['Zkittlez', 'zkittlez ', 'ZKITTLEZ']);
  });

  it('the average, best and lowest of its rated products; the strain type most of them have', () => {
    expect(z.average).toBeCloseTo(8);
    expect(z.best!.score).toBe(9);
    expect(z.lowest!.score).toBe(7);
    expect(z.strainType).toBe('indica');
    expect(strains.find((s) => s.name === 'Gelato 41')).toMatchObject({ average: null, best: null, lowest: null });
    expect(strains.find((s) => s.name === 'Cookies Zkittlez')!.lowest).toBeNull(); // tried once
  });

  it('kinds, sources (most used first), the days (Date tried, else the day it was added) and prices', () => {
    expect(z.kinds).toEqual(['Flower', 'Live rosin']);
    expect(z.sources).toEqual(['Green Room', 'Kush Co']);
    expect(z.firstTried).toBe('2026-06-02');
    expect(z.lastTried).toBe('2026-10-28');
    expect(z.pricePerGram).toBeCloseTo((10 + 40) / 2);
    expect(z.valueForMoney).toBeCloseTo((9 / 10 + 8 / 40) / 2);
  });

  it('sorts four ways; ranks among rated strains only', () => {
    expect(sortStrains(strains, 'average').map((s) => s.name)).toEqual(['Cookies Zkittlez', 'Zkittlez', 'Gelato 41']);
    expect(sortStrains(strains, 'tried').map((s) => s.name)).toEqual(['Zkittlez', 'Cookies Zkittlez', 'Gelato 41']);
    expect(sortStrains(strains, 'recent')[0]!.name).toBe('Zkittlez');
    expect(sortStrains(strains, 'az').map((s) => s.name)).toEqual(['Cookies Zkittlez', 'Gelato 41', 'Zkittlez']);
    expect(strainRank(strains, 'zkittlez')).toBe(2);
    expect(strainRank(strains, 'gelato41')).toBeNull();
  });

  it('a Log entry with no product of its name is a strain of its own, only in your Log (Unranked)', () => {
    const entries: StrainEntry[] = [
      { id: 'e1', name: 'Amnesia Haze', productType: 'flower', amount: null, country: 'NL', createdAt: 1 },
      { id: 'e2', name: 'amnesia haze', productType: 'flower', amount: 2, country: 'NL', createdAt: 3 },
    ];
    const withLog = strainsOf(list, entries);
    const a = withLog.find((s) => s.key === 'amnesiahaze')!;
    expect(onlyInLog(a)).toBe(true);
    expect(a).toMatchObject({ name: 'Amnesia Haze', tried: 2, grams: 2, average: null, products: [] });
    expect(a.entries.map((e) => e.id)).toEqual(['e2', 'e1']); // newest first
    expect(onlyInLog(withLog.find((s) => s.key === 'zkittlez')!)).toBe(false);
  });

  it('labels, days and addresses', () => {
    expect(kindLabel({ productType: 'concentrate', concentrateType: 'hash' })).toBe('Hash');
    expect(kindLabel({ productType: 'concentrate', concentrateType: 'not_set' })).toBe('Concentrate');
    expect(kindLabel({ productType: 'edibles' })).toBe('Edible');
    expect(formatDay('2026-06-02')).toBe('2 Jun 2026');
    expect(strainPath(' Gelato 41 ')).toBe('/strainz/Gelato%2041');
  });
});

describe('Most smoked and Most tried (D100)', () => {
  const buy = (amount: number | null) => ({ date: '2026-06-02', amount, totalPaid: 20, supplier: null, seq: 1 });
  const e = (id: string, name: string, amount: number | null, over: Partial<StrainEntry> = {}): StrainEntry => ({ id, name, productType: 'flower', amount, country: null, createdAt: 5, ...over });
  const products = [
    p('Zkittlez', 9, { purchases: [buy(3.5), buy(null)] }),
    p('Zkittlez', 8, { productType: 'pre_roll', purchases: [buy(1)] }),
    p('Zkittlez', 9, { productType: 'edibles', purchases: [buy(200)] }), // edibles aren't on Strainz
    p('Runtz', 7, { purchases: [buy(10)] }),
    p('Blue Dream', 6),
    p('Blue Dream', 6.5),
    p('Gummy Bears', 9, { productType: 'edibles', purchases: [buy(100)] }),
  ];
  const entries = [e('l1', 'zkittlez', 3), e('l2', 'Blue Dream', null), e('l3', 'Blue Dream', null), e('l4', 'Zkittlez', 50, { productType: 'edibles' }), e('l5', 'Gummy Bears', 20, { productType: 'edibles' })];
  const strains = strainsOf(products, entries);
  const z = strains.find((s) => s.key === 'zkittlez')!;

  it('edibles are left out of Strainz altogether: their products, their Log entries, a strain that was only edibles', () => {
    expect(onStrainz('edibles')).toBe(false);
    expect(['flower', 'concentrate', 'pre_roll'].every(onStrainz)).toBe(true);
    expect(strains.map((s) => s.name).sort()).toEqual(['Blue Dream', 'Runtz', 'Zkittlez']);
    expect(z.products).toHaveLength(2);
    expect(z.entries.map((x) => x.id)).toEqual(['l1']);
    expect(z.kinds).toEqual(['Flower', 'Pre-roll']);
  });

  it('a strain counts its products and Log entries (tried) and their grams; a blank amount counts 0', () => {
    expect(z).toMatchObject({ tried: 3, grams: 7.5 });
    expect(strains.find((s) => s.key === 'bluedream')).toMatchObject({ tried: 4, grams: 0 });
    expect(z.average).toBeCloseTo(8.5); // Log entries have no score
  });

  it('Most smoked: most grams first; Most tried: most products and Log entries first', () => {
    expect(sortStrains(strains, 'smoked').map((s) => s.name)).toEqual(['Runtz', 'Zkittlez', 'Blue Dream']);
    expect(sortStrains(strains, 'tried').map((s) => s.name)).toEqual(['Blue Dream', 'Zkittlez', 'Runtz']);
  });

  it('a friend’s strains leave edibles out too', () => {
    const scored = (name: string, productType: string, score: number) => ({ id: `${name}-${productType}`, name, productType, ratings: { look: score, smell: score, taste: score, burn: score, high: score } });
    expect(strainScores([scored('Gummy Bears', 'edibles', 9), scored('Runtz', 'flower', 7)]).map((s) => s.name)).toEqual(['Runtz']);
    const vs = compareStrains([scored('Runtz', 'flower', 8)], [scored('Runtz', 'edibles', 9), scored('Gummy Bears', 'edibles', 9)]);
    expect(vs).toEqual({ both: [], onlyThem: [] });
  });
});

describe('Want to try (D92)', () => {
  it('checks a want: a kind, a name capitalised, an optional note', () => {
    expect(validateWantInput({ kind: 'strain', name: ' runtz', note: '  ' })).toEqual({ ok: true, value: { kind: 'strain', name: 'Runtz', note: null } });
    expect(validateWantInput({ kind: 'source', name: '!!!' })).toEqual({ ok: false, message: 'Give the source a name.' });
    expect(validateWantInput({ kind: 'x', name: 'A' }).ok).toBe(false);
  });

  it('a product ticks off the strain of its name and the sources it’s from or was bought at', () => {
    const wants = [
      { kind: 'strain' as const, name: 'Runtz' },
      { kind: 'strain' as const, name: 'Runtz Cake' },
      { kind: 'source' as const, name: 'Cloud Nine' },
      { kind: 'source' as const, name: 'Kush Co' },
    ];
    expect(wantsTriedBy(wants, { name: 'RUNTZ', source: 'Kush Co', purchases: [{ supplier: 'cloud-nine' }] })).toEqual([wants[0], wants[2], wants[3]]);
    expect(wantsTriedBy(wants, { name: 'Runtz Cookies', source: null, purchases: [] })).toEqual([]);
  });

  it('says what was ticked off', () => {
    expect(tickedOffText([])).toBeNull();
    expect(tickedOffText([{ kind: 'strain', name: 'Runtz' }])).toBe('You tried Runtz! It’s off your Want to try list.');
    expect(tickedOffText([{ kind: 'strain', name: 'Runtz' }, { kind: 'source', name: 'Cloud Nine' }])).toBe('You tried Runtz and Cloud Nine! They’re off your Want to try list.');
  });
});
