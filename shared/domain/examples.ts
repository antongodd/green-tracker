// D81: the examples shown in the product editor's empty Name and Source boxes, one of each
// picked at random each time the editor opens (the owner's lists, 2026-11-03).

/** Strains for "e.g. …" in Name. */
export const NAME_EXAMPLES = [
  'Lemon Cherry Gelato',
  'Gelato',
  'OG Kush',
  'Blue Zushi',
  'Zkittlez',
  'Runtz',
  'Watermelon Zkittlez',
  'Sour Diesel',
  'Lemon Haze',
  'Zombie Kush',
  'RS11',
  'Wedding Cake',
] as const;

/** Brands and growers for "The brand or grower, e.g. …" in Source. */
export const SOURCE_EXAMPLES = ['Cookies', 'Tenco', 'Wizard Trees', '710 Nomads', 'Z Money'] as const;

/** One of the list, at random (`random` is Math.random, or a stand-in in tests). */
export function pickExample<T>(list: readonly T[], random: () => number = Math.random): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;
}

export const nameExample = (random?: () => number) => `e.g. ${pickExample(NAME_EXAMPLES, random)}`;
export const sourceExample = (random?: () => number) => `The brand or grower, e.g. ${pickExample(SOURCE_EXAMPLES, random)}`;
