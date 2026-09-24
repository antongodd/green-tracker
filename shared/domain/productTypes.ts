// The single definition of product types, their rating sets and their units.
// Every dropdown, filter option, Rank by option, denominator, unit label and
// TOTAL rule is derived from what is declared here. To add a type, append one
// entry to PRODUCT_TYPES (never insert — positions the owner has learned must
// not shift). The type system and test/domain/productTypes.test.ts fail if any
// part of a declaration is missing.

/** Every rating category, in canonical display order (Consistency sits directly after Look). */
export const RATING_CATEGORIES = ['look', 'consistency', 'smell', 'taste', 'burn', 'high'] as const;
export type RatingKey = (typeof RATING_CATEGORIES)[number];

export const RATING_LABELS: Record<RatingKey, string> = {
  look: 'Look',
  consistency: 'Consistency',
  smell: 'Smell',
  taste: 'Taste',
  burn: 'Burn',
  high: 'High',
};

/**
 * One rated category within a type's set. `weight` is its share of Overall;
 * 0 means rated, stored and displayed but not feeding Overall (High, except
 * for edibles). A single weighted mean serves every type — with all weights 1
 * it is a straight mean.
 */
export interface RatingSlot {
  readonly key: RatingKey;
  readonly weight: number;
}
export type RatingSet = readonly RatingSlot[];

const FLOWER_SET: RatingSet = [
  { key: 'look', weight: 1 },
  { key: 'smell', weight: 1 },
  { key: 'taste', weight: 1 },
  { key: 'burn', weight: 1 },
  { key: 'high', weight: 0 },
];

const CONCENTRATE_SET: RatingSet = [
  { key: 'look', weight: 1 },
  { key: 'consistency', weight: 1 },
  { key: 'smell', weight: 1 },
  { key: 'taste', weight: 1 },
  { key: 'burn', weight: 1 },
  { key: 'high', weight: 0 },
];

// Edibles: Taste ×⅓, High ×⅔. Weights 1 and 2 give the same mean without
// floating-point thirds.
const EDIBLES_SET: RatingSet = [
  { key: 'taste', weight: 1 },
  { key: 'high', weight: 2 },
];

// Pre roll has no Look — you can't see the contents. Do not reopen.
const PRE_ROLL_SET: RatingSet = [
  { key: 'smell', weight: 1 },
  { key: 'taste', weight: 1 },
  { key: 'burn', weight: 1 },
  { key: 'high', weight: 0 },
];

/** Units: edibles are mg of THC — a different quantity, never a conversion. */
export interface UnitDef {
  /** Suffix for amounts, e.g. `7g`, `100mg`. */
  readonly amount: 'g' | 'mg';
  /** Rank by label for price. */
  readonly priceLabel: string;
  /** Value for money divides Overall by (per-unit price × this). */
  readonly vfmPriceMultiplier: number;
  /** Whether amounts are summed into the TOTAL (weight) tiles. */
  readonly countsTowardsWeightTotal: boolean;
}

export const GRAMS: UnitDef = {
  amount: 'g',
  priceLabel: 'Price per gram',
  vfmPriceMultiplier: 1,
  countsTowardsWeightTotal: true,
};

export const MG_THC: UnitDef = {
  amount: 'mg',
  priceLabel: 'Price per mg',
  vfmPriceMultiplier: 100, // VFM is per 100mg for edibles. Knowingly non-comparable.
  countsTowardsWeightTotal: false,
};

export type IconKey = 'flower' | 'concentrate' | 'edibles' | 'pre_roll';

export interface SubtypeDef {
  readonly key: string;
  readonly label: string;
}

export interface ProductTypeDef {
  readonly key: string;
  readonly label: string;
  readonly ratingSet: RatingSet;
  readonly unit: UnitDef;
  /** null = no icon (Other, Not set). */
  readonly icon: IconKey | null;
  /** Emoji shown in the filter dropdown; null = not a filter option. */
  readonly filterEmoji: string | null;
  /** Choosing this type reveals a free-text box (the one "Other" pattern). */
  readonly freeText: boolean;
  /** Sub-types (Concentrate only), with the default for a new record. */
  readonly subtypes: { readonly options: readonly SubtypeDef[]; readonly default: string } | null;
}

export const CONCENTRATE_SUBTYPES: readonly SubtypeDef[] = [
  { key: 'hash', label: 'Hash' },
  { key: 'rosin', label: 'Rosin' },
  { key: 'live_rosin', label: 'Live Rosin' },
  { key: 'wax', label: 'Wax' },
  { key: 'live_resin', label: 'Live Resin' },
  { key: 'diamonds', label: 'Diamonds' },
  { key: 'thc_distillate', label: 'THC distillate' },
  { key: 'other', label: 'Other' },
  { key: 'not_set', label: 'Not set' },
];

export const PRODUCT_TYPES = [
  {
    key: 'flower',
    label: 'Flower',
    ratingSet: FLOWER_SET,
    unit: GRAMS,
    icon: 'flower',
    filterEmoji: '🌿',
    freeText: false,
    subtypes: null,
  },
  {
    key: 'concentrate',
    label: 'Concentrate',
    ratingSet: CONCENTRATE_SET,
    unit: GRAMS,
    icon: 'concentrate',
    filterEmoji: '💧',
    freeText: false,
    subtypes: { options: CONCENTRATE_SUBTYPES, default: 'hash' },
  },
  {
    key: 'edibles',
    label: 'Edibles',
    ratingSet: EDIBLES_SET,
    unit: MG_THC,
    icon: 'edibles',
    filterEmoji: '🍪',
    freeText: false,
    subtypes: null,
  },
  {
    key: 'pre_roll',
    label: 'Pre roll',
    ratingSet: PRE_ROLL_SET,
    unit: GRAMS,
    icon: 'pre_roll',
    filterEmoji: '💨', // Never 🚬.
    freeText: false,
    subtypes: null,
  },
  {
    key: 'other',
    label: 'Other',
    ratingSet: FLOWER_SET,
    unit: GRAMS,
    icon: null,
    filterEmoji: null,
    freeText: true,
    subtypes: null,
  },
  {
    key: 'not_set',
    label: 'Not set',
    ratingSet: FLOWER_SET,
    unit: GRAMS,
    icon: null,
    filterEmoji: null,
    freeText: false,
    subtypes: null,
  },
] as const satisfies readonly ProductTypeDef[];

export type ProductTypeKey = (typeof PRODUCT_TYPES)[number]['key'];

export const DEFAULT_PRODUCT_TYPE: ProductTypeKey = 'flower';

const BY_KEY = new Map<string, ProductTypeDef>(PRODUCT_TYPES.map((t) => [t.key, t]));

export function isProductTypeKey(value: unknown): value is ProductTypeKey {
  return typeof value === 'string' && BY_KEY.has(value);
}

/** Look up a type. Unknown keys resolve to Not set rather than throwing. */
export function productType(key: string): ProductTypeDef {
  return BY_KEY.get(key) ?? BY_KEY.get('not_set')!;
}

/** Units for a product type — the one place units are resolved. */
export function unitFor(typeKey: string): UnitDef {
  return productType(typeKey).unit;
}

/** Types offered by the Type filter (besides All). Other/Not set are not options. */
export const FILTER_TYPES: readonly ProductTypeDef[] = PRODUCT_TYPES.filter((t) => t.filterEmoji !== null);

export const STRAIN_TYPES = [
  { key: 'indica', label: 'Indica' },
  { key: 'sativa', label: 'Sativa' },
  { key: 'hybrid', label: 'Hybrid' },
] as const;
export type StrainTypeKey = (typeof STRAIN_TYPES)[number]['key'];
