import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  FILTER_TYPES,
  OTHER_COUNTRY,
  PRODUCT_TYPES,
  autoCapitalise,
  countryDisplay,
  filterOptions,
  flagEmoji,
  groupLog,
  leaflyTarget,
  type LogRow,
} from '../../shared/domain';

describe('Auto-capitalisation (§11 table, exactly)', () => {
  it.each([
    ['blue dream', 'Blue Dream'],
    ['RS11', 'RS11'],
    ['OG KUSH', 'OG KUSH'],
    ['pineapple eXpress', 'Pineapple EXpress'],
    ["o'shea", "O'shea"],
    ['blue-dream', 'Blue-dream'],
  ])('%s → %s', (typed, stored) => {
    expect(autoCapitalise(typed)).toBe(stored);
  });

  it('trims, splits on whitespace only, and handles emoji / non-ASCII safely', () => {
    expect(autoCapitalise('  lemon  haze ')).toBe('Lemon  Haze');
    expect(autoCapitalise('🍋 haze')).toBe('🍋 Haze');
    expect(autoCapitalise('éclair ßeta')).toBe('Éclair ßeta');
    expect(autoCapitalise('')).toBe('');
  });
});

describe('Product type definition is complete (§7 one definition)', () => {
  it('declares every type in order, appended never inserted', () => {
    expect(PRODUCT_TYPES.map((t) => t.label)).toEqual(['Flower', 'Concentrate', 'Edibles', 'Pre roll', 'Other', 'Not set']);
  });

  it('every type has a label, a non-empty rating set, a unit, and consistent icon/filter declarations', () => {
    for (const t of PRODUCT_TYPES) {
      expect(t.label).toBeTruthy();
      expect(t.ratingSet.length).toBeGreaterThan(0);
      expect(t.ratingSet.some((s) => s.weight > 0)).toBe(true);
      expect(t.unit.amount).toMatch(/^(g|mg)$/);
      // Real types have an icon and a filter emoji; Other / Not set have neither.
      expect(t.icon === null).toBe(t.filterEmoji === null);
    }
  });

  it('only Concentrate has sub-types, defaulting to Hash', () => {
    const withSubtypes = PRODUCT_TYPES.filter((t) => t.subtypes);
    expect(withSubtypes.map((t) => t.key)).toEqual(['concentrate']);
    expect(withSubtypes[0]!.subtypes!.default).toBe('hash');
  });

  it('only Edibles uses mg — a new type must not become a second', () => {
    expect(PRODUCT_TYPES.filter((t) => t.unit.amount === 'mg').map((t) => t.key)).toEqual(['edibles']);
  });

  it('filter: All plus Flower, Concentrate, Edibles, Pre roll; never 🚬', () => {
    expect(filterOptions().map((o) => o.label)).toEqual(['All', 'Flower', 'Concentrate', 'Edibles', 'Pre roll']);
    expect(FILTER_TYPES.map((t) => t.filterEmoji)).toEqual(['🌿', '💧', '🍪', '💨']);
  });
});

describe('Countries', () => {
  it('flag emoji from ISO code', () => {
    expect(flagEmoji('GB')).toBe('🇬🇧');
  });

  it('Other with nothing typed means not set', () => {
    expect(countryDisplay(OTHER_COUNTRY, '  ')).toBeNull();
    expect(countryDisplay(OTHER_COUNTRY, 'Atlantis')).toMatchObject({ name: 'Atlantis', flag: null });
    expect(countryDisplay(null, null)).toBeNull();
  });

  it('list has unique codes', () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });
});

describe('Log grouping and order (§17 Log)', () => {
  const row = (name: string, country: string | null, hasPhoto = false, createdAt = 0): LogRow => ({
    kind: 'loose', id: `${name}-${createdAt}`, name, productType: 'flower', country, countryOther: null, hasPhoto, createdAt, amount: null,
  });

  it('groups most rows first, ties alphabetical, No country last', () => {
    const groups = groupLog(
      [row('a', null), row('b', null), row('c', null), row('d', 'TH'), row('e', 'GB'), row('f', 'NL'), row('g', 'NL')],
      'all',
    );
    expect(groups.map((g) => g.country?.name ?? 'No country')).toEqual(['Netherlands', 'Thailand', 'United Kingdom', 'No country']);
  });

  it('within a group: photo first, then name case-insensitive, then newest first', () => {
    const groups = groupLog(
      [row('banana', 'GB'), row('Apple', 'GB', false, 1), row('apple', 'GB', false, 2), row('zebra', 'GB', true)],
      'all',
    );
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(['zebra-0', 'apple-2', 'Apple-1', 'banana-0']);
  });

  it('empty groups are not drawn under a filter', () => {
    expect(groupLog([row('a', 'GB')], 'edibles')).toEqual([]);
  });
});

describe('Leafly (§12)', () => {
  it('saved link opens as typed, adding https:// when missing', () => {
    expect(leaflyTarget('leafly.com/strains/x', 'X')).toEqual({ label: 'View on Leafly', url: 'https://leafly.com/strains/x' });
    expect(leaflyTarget('https://www.leafly.com/x', 'X').url).toBe('https://www.leafly.com/x');
  });

  it('no link → search by URL-encoded name; never guessed', () => {
    expect(leaflyTarget(null, 'Blue Dream & Co')).toEqual({
      label: 'Search Leafly',
      url: 'https://www.leafly.com/search?q=Blue%20Dream%20%26%20Co',
    });
  });

  it('a javascript: link can never run', () => {
    expect(leaflyTarget('javascript:alert(1)', 'X').url).toBe('https://javascript:alert(1)');
  });
});
