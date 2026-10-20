import { describe, expect, it } from 'vitest';
import { canonicalName, nameKey, productsNamed, spentAt, suggestNames, usedNames, type NamedProduct } from '../../shared/domain/names';

const buy = (supplier: string | null, totalPaid = 10) => ({ supplier, totalPaid });
const p = (source: string | null, suppliers: (string | null)[] = [], archived = false) => ({ source, purchases: suppliers.map((s) => buy(s)), archived });

const PRODUCTS: (NamedProduct & { purchases: { supplier: string | null; totalPaid: number }[] })[] = [
  p('Grasshopper', ['Grasshopper', 'Grasshopper']),
  p('Grasshopper', ["Barney's"]),
  p(null, ['grasshopper']),
  p('Green House', ['Green House']),
  p('Cookies', ['Boerejongens']),
  p('Dutch Passion', []),
  p('Archived Brand', ['Archived Shop'], true),
];
const used = usedNames(PRODUCTS);
const names = (typed: string, first?: string) => suggestNames(used, typed, { first }).names.map((n) => n.name);

describe('brands and suppliers (D59)', () => {
  it('a name is the same whatever the capitals, accents, spaces and punctuation', () => {
    expect(nameKey("Barney's")).toBe('barneys');
    expect(nameKey('  BARNEYS ')).toBe('barneys');
    expect(nameKey('Green House')).toBe(nameKey('greenhouse'));
    expect(nameKey('Café Ölé')).toBe('cafeole');
    expect(nameKey('  ')).toBe('');
  });

  it('lists every name from Source and Supplier together, counting each product once, most used first', () => {
    expect(used.map((n) => [n.name, n.products, n.brand, n.shop])).toEqual([
      ['Grasshopper', 3, 2, 2],
      ["Barney's", 1, 0, 1],
      ['Boerejongens', 1, 0, 1],
      ['Cookies', 1, 1, 0],
      ['Dutch Passion', 1, 1, 0],
      ['Green House', 1, 1, 1],
    ]);
  });

  it('leaves archived products out', () => {
    expect(used.some((n) => n.name.startsWith('Archived'))).toBe(false);
  });

  it('shows the spelling used most, a capitalised one winning a tie', () => {
    expect(usedNames([p('grasshopper'), p('Grasshopper')])[0]!.name).toBe('Grasshopper');
    expect(usedNames([p('grasshopper'), p('grasshopper'), p('Grasshopper')])[0]!.name).toBe('grasshopper');
  });

  it('suggests the most used names when nothing is typed, at most four', () => {
    expect(names('')).toEqual(['Grasshopper', "Barney's", 'Boerejongens', 'Cookies']);
  });

  it('suggests names whose words, or the whole name, start with what is typed', () => {
    expect(names('gr')).toEqual(['Grasshopper', 'Green House']);
    expect(names('house')).toEqual(['Green House']);
    expect(names('greenh')).toEqual(['Green House']);
    expect(names('barneys')).toEqual([]); // the same name: nothing to offer
    expect(names('hopper')).toEqual([]); // not the middle of a word
  });

  it('offers nothing once it is a name you use, and says which spelling it will be saved as', () => {
    expect(suggestNames(used, 'grasshopper')).toEqual({ names: [], typo: false, savedAs: 'Grasshopper' });
    expect(suggestNames(used, 'Grasshopper')).toEqual({ names: [], typo: false, savedAs: null });
    expect(suggestNames(used, 'barneys').savedAs).toBe("Barney's");
  });

  it('suggests near misses for a typo of four letters or more', () => {
    expect(suggestNames(used, 'grashopper')).toEqual({ names: [used[0]], typo: true, savedAs: null });
    expect(suggestNames(used, 'cokies').names.map((n) => n.name)).toEqual(['Cookies']);
    expect(suggestNames(used, 'grashop').typo).toBe(true); // a typo partway through
    expect(suggestNames(used, 'gxa').names).toEqual([]); // too short to guess
    expect(suggestNames(used, 'zzzzzzz').names).toEqual([]);
  });

  it("puts the product's Source first in Supplier, even a new one", () => {
    expect(names('', 'Cookies')).toEqual(['Cookies', 'Grasshopper', "Barney's", 'Boerejongens']);
    expect(names('', 'new place')).toEqual(['New Place', 'Grasshopper', "Barney's", 'Boerejongens']);
    expect(names('c', 'Cookies')).toEqual(['Cookies']);
    expect(names('gr', 'Cookies')).toEqual(['Grasshopper', 'Green House']);
  });

  it('saves the spelling you already use, otherwise what was typed, capitalised', () => {
    expect(canonicalName(' grasshopper ', used)).toBe('Grasshopper');
    expect(canonicalName('barneys', used)).toBe("Barney's");
    expect(canonicalName('the bulldog', used)).toBe('The Bulldog');
    expect(canonicalName('  ', used)).toBe('');
  });

  it("finds a name's products, as brand and/or where it was bought, and what was spent there", () => {
    const key = nameKey('Grasshopper');
    expect(productsNamed(PRODUCTS, key).map((r) => [r.product.source, r.brand, r.shop])).toEqual([
      ['Grasshopper', true, true],
      ['Grasshopper', true, false],
      [null, false, true],
    ]);
    expect(spentAt(PRODUCTS, key)).toBe(30);
    expect(spentAt(PRODUCTS, nameKey('Archived Shop'))).toBe(0);
    expect(productsNamed(PRODUCTS, nameKey('Archived Brand'))).toEqual([]);
  });
});
