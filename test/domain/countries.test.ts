import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY_ALIASES, normaliseSearch, OTHER_COUNTRY, searchCountries, usedCountries } from '../../shared/domain/countries';

const names = (q: string) => searchCountries(q).map((c) => c.name);

describe('country search (D16)', () => {
  it('an empty or blank search lists every country A–Z', () => {
    expect(searchCountries('')).toEqual([...COUNTRIES]);
    expect(searchCountries('   ')).toHaveLength(COUNTRIES.length);
  });

  it('matches the start of any word, ignoring capitals', () => {
    expect(names('uni')).toEqual(['United Kingdom', 'United States']);
    expect(names('KING')).toEqual(['United Kingdom']);
    expect(names('afr')).toEqual(['South Africa']);
    expect(names('tob')).toEqual(['Trinidad and Tobago']);
    expect(names('united k')).toEqual(['United Kingdom']);
  });

  it('does not match the middle of a word', () => {
    expect(names('ngdom')).toEqual([]);
    expect(names('land')).toEqual([]);
  });

  it('finds countries by nickname, a nickname typed in full coming first', () => {
    expect(names('uk')).toEqual(['United Kingdom', 'Ukraine']);
    expect(names('england')).toEqual(['United Kingdom']);
    expect(names('scot')).toEqual(['United Kingdom']);
    expect(names('usa')).toEqual(['United States']);
    expect(names('us')).toEqual(['United States']);
    expect(names('america')).toEqual(['United States']);
    expect(names('holland')).toEqual(['Netherlands']);
  });

  it('names starting with the search come before other matches', () => {
    // Ireland by name, then the UK through "Northern Ireland".
    expect(names('ire')).toEqual(['Ireland', 'United Kingdom']);
  });

  it('ignores accents and punctuation both ways', () => {
    expect(normaliseSearch('Türkiye')).toBe('turkiye');
    expect(names('türk')).toEqual(['Turkey']);
    expect(names('Trinidad-and')).toEqual(['Trinidad and Tobago']);
  });

  it('every nickname belongs to a listed country', () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const code of Object.keys(COUNTRY_ALIASES)) expect(codes.has(code)).toBe(true);
  });
});

describe('used countries (D16)', () => {
  it('most used first, then A–Z, at most five', () => {
    const codes = ['US', 'GB', 'GB', 'CA', 'US', 'GB', 'NL', 'ES', 'MA', 'TH', null];
    expect(usedCountries(codes).map((c) => c.code)).toEqual(['GB', 'US', 'CA', 'MA', 'NL']);
  });

  it('leaves out Other, not set and unknown codes', () => {
    expect(usedCountries([OTHER_COUNTRY, OTHER_COUNTRY, null, 'XX', 'JP'])).toEqual([{ code: 'JP', name: 'Japan' }]);
    expect(usedCountries([])).toEqual([]);
  });
});
