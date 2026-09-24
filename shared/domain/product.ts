// The product record as the API sends and receives it, and the one validator
// both sides use. Only what the user typed is stored; Overall, prices, VFM and
// tiles are derived (ratings.ts, money.ts).

import { autoCapitalise } from './capitalise';
import { COUNTRIES, OTHER_COUNTRY } from './countries';
import { CONCENTRATE_SUBTYPES, DEFAULT_PRODUCT_TYPE, RATING_CATEGORIES, STRAIN_TYPES, isProductTypeKey, productType, type ProductTypeKey, type RatingKey, type StrainTypeKey } from './productTypes';
import { MAX_PHOTOS_PER_PRODUCT, parseCrop, type PhotoInput, type PhotoRecord } from './photo';
import { isValidHitTime, isValidRating, type Ratings } from './ratings';

export interface PurchaseRecord {
  id: string;
  /** Entry order; breaks ties between same-date purchases. */
  seq: number;
  date: string | null;
  amount: number | null;
  totalPaid: number;
  supplier: string | null;
}

export interface Product {
  id: string;
  name: string;
  strainType: StrainTypeKey | null;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  /** Kept when the type moves away from Concentrate, restored on the way back. */
  concentrateType: string;
  concentrateTypeOther: string | null;
  country: string | null;
  countryOther: string | null;
  source: string | null;
  dateTried: string | null;
  leaflyLink: string | null;
  notes: string | null;
  hitTimeMinutes: number | null;
  /** Every stored rating, including categories outside the current type (hidden, ignored). */
  ratings: Ratings;
  purchases: PurchaseRecord[];
  /** In display order; the first is the hero and the list thumbnail. */
  photos: PhotoRecord[];
  archived: boolean;
  private: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A purchase as the editor sends it. `id` is set for purchases that already exist. */
export interface PurchaseInput {
  id?: string;
  date: string | null;
  amount: number | null;
  totalPaid: number | null;
  supplier: string | null;
}

/**
 * What the editor saves. `ratings` carries the categories the editor showed:
 * a number sets, null clears. Categories not mentioned are left as stored, so
 * a type switch can never lose ratings.
 */
export interface ProductInput {
  name: string;
  strainType: StrainTypeKey | null;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  concentrateType: string;
  concentrateTypeOther: string | null;
  country: string | null;
  countryOther: string | null;
  source: string | null;
  dateTried: string | null;
  leaflyLink: string | null;
  notes: string | null;
  hitTimeMinutes: number | null;
  ratings: Partial<Record<RatingKey, number | null>>;
  purchases: PurchaseInput[];
  photos: PhotoInput[];
  private: boolean;
}

export const PRODUCT_LIMITS = {
  name: 100,
  shortText: 100,
  leafly: 1000,
  notes: 5000,
  purchases: 500,
  money: 1_000_000,
} as const;

export function emptyProductInput(): ProductInput {
  return {
    name: '',
    strainType: null,
    productType: DEFAULT_PRODUCT_TYPE,
    productTypeOther: null,
    concentrateType: productType('concentrate').subtypes!.default,
    concentrateTypeOther: null,
    country: null,
    countryOther: null,
    source: null,
    dateTried: null, // Starts empty (owner, Phase 3).
    leaflyLink: null,
    notes: null,
    hitTimeMinutes: null,
    ratings: {},
    purchases: [],
    photos: [],
    private: false,
  };
}

/** The editor's starting point for an existing product. */
export function productToInput(p: Product): ProductInput {
  const { id: _id, archived: _a, createdAt: _c, updatedAt: _u, purchases, ratings, photos, ...rest } = p;
  return {
    ...rest,
    ratings: { ...ratings },
    purchases: purchases.map(({ seq: _s, ...pu }) => ({ ...pu })),
    photos: photos.map((ph) => ({ id: ph.id, crop: ph.crop })),
  };
}

export type ValidationResult = { ok: true; value: ProductInput } | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));
const CONCENTRATE_KEYS = new Set(CONCENTRATE_SUBTYPES.map((s) => s.key));
const STRAIN_KEYS = new Set<string>(STRAIN_TYPES.map((s) => s.key));

/**
 * Checks and normalises editor input: trims text (blank → null), applies
 * auto-capitalisation to name, Source and supplier, drops purchases with no
 * total paid, and rejects anything out of range. Idempotent.
 */
export function validateProductInput(raw: unknown): ValidationResult {
  const fail = (message: string): ValidationResult => ({ ok: false, message });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('The product could not be read.');
  const r = raw as Record<string, unknown>;

  const text = (key: string, max: number, opts: { capitalise?: boolean } = {}): string | null | undefined => {
    const v = r[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') return undefined;
    const t = opts.capitalise ? autoCapitalise(v) : v.trim();
    if (t.length > max) return undefined;
    return t === '' ? null : t;
  };

  const name = text('name', PRODUCT_LIMITS.name, { capitalise: true });
  if (name === undefined) return fail(`Keep the name to ${PRODUCT_LIMITS.name} characters.`);
  if (name === null) return fail('Give the product a name.');

  const strainType = r.strainType ?? null;
  if (strainType !== null && !(typeof strainType === 'string' && STRAIN_KEYS.has(strainType))) return fail('Choose a strain type from the list.');

  const type = r.productType ?? DEFAULT_PRODUCT_TYPE;
  if (!isProductTypeKey(type)) return fail('Choose a product type from the list.');
  const productTypeOther = text('productTypeOther', PRODUCT_LIMITS.shortText);

  const concentrateType = r.concentrateType ?? 'hash';
  if (typeof concentrateType !== 'string' || !CONCENTRATE_KEYS.has(concentrateType)) return fail('Choose a concentrate type from the list.');
  const concentrateTypeOther = text('concentrateTypeOther', PRODUCT_LIMITS.shortText);

  const country = r.country ?? null;
  if (country !== null && !(typeof country === 'string' && (country === OTHER_COUNTRY || COUNTRY_CODES.has(country)))) return fail('Choose a country from the list.');
  const countryOther = text('countryOther', PRODUCT_LIMITS.shortText);

  const source = text('source', PRODUCT_LIMITS.shortText, { capitalise: true });
  const leaflyLink = text('leaflyLink', PRODUCT_LIMITS.leafly);
  const notes = text('notes', PRODUCT_LIMITS.notes);
  if ([productTypeOther, concentrateTypeOther, countryOther, source].includes(undefined)) return fail(`Keep text fields to ${PRODUCT_LIMITS.shortText} characters.`);
  if (leaflyLink === undefined) return fail('That Leafly link is too long.');
  if (notes === undefined) return fail(`Keep notes to ${PRODUCT_LIMITS.notes} characters.`);

  const dateTried = r.dateTried ?? null;
  if (dateTried !== null && !(typeof dateTried === 'string' && isIsoDate(dateTried))) return fail('Date tried isn’t a valid date.');

  const hit = r.hitTimeMinutes ?? null;
  if (hit !== null && !isValidHitTime(hit)) return fail('Hit time must be 0–3 hours in 15-minute steps.');

  const ratingsIn = r.ratings ?? {};
  if (typeof ratingsIn !== 'object' || ratingsIn === null || Array.isArray(ratingsIn)) return fail('The ratings could not be read.');
  const ratings: Partial<Record<RatingKey, number | null>> = {};
  for (const [key, value] of Object.entries(ratingsIn)) {
    if (!(RATING_CATEGORIES as readonly string[]).includes(key)) return fail('Unknown rating category.');
    if (value !== null && !isValidRating(value)) return fail('Ratings go from 1 to 10.');
    ratings[key as RatingKey] = value as number | null;
  }

  const purchasesIn = r.purchases ?? [];
  if (!Array.isArray(purchasesIn)) return fail('The purchases could not be read.');
  if (purchasesIn.length > PRODUCT_LIMITS.purchases) return fail('Too many purchases.');
  const purchases: PurchaseInput[] = [];
  for (const pRaw of purchasesIn) {
    if (!pRaw || typeof pRaw !== 'object') return fail('A purchase could not be read.');
    const p = pRaw as Record<string, unknown>;
    // A purchase with no total paid is discarded on save (brief §9).
    if (p.totalPaid === null || p.totalPaid === undefined) continue;
    if (typeof p.totalPaid !== 'number' || !Number.isFinite(p.totalPaid) || p.totalPaid < 0 || p.totalPaid > PRODUCT_LIMITS.money) return fail('Total paid must be an amount in £.');
    const amount = p.amount ?? null;
    if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > PRODUCT_LIMITS.money)) return fail('Amount must be more than 0.');
    const date = p.date ?? null;
    if (date !== null && !(typeof date === 'string' && isIsoDate(date))) return fail('A purchase date isn’t a valid date.');
    const sup = p.supplier;
    let supplier: string | null = null;
    if (typeof sup === 'string') {
      supplier = autoCapitalise(sup) || null;
      if (supplier && supplier.length > PRODUCT_LIMITS.shortText) return fail(`Keep supplier to ${PRODUCT_LIMITS.shortText} characters.`);
    } else if (sup !== null && sup !== undefined) return fail('A purchase could not be read.');
    const id = typeof p.id === 'string' ? p.id : undefined;
    purchases.push({ ...(id ? { id } : {}), date, amount, totalPaid: p.totalPaid, supplier });
  }

  const photosIn = r.photos ?? [];
  if (!Array.isArray(photosIn)) return fail('The photos could not be read.');
  if (photosIn.length > MAX_PHOTOS_PER_PRODUCT) return fail(`Up to ${MAX_PHOTOS_PER_PRODUCT} photos per product.`);
  const photos: PhotoInput[] = [];
  for (const phRaw of photosIn) {
    if (!phRaw || typeof phRaw !== 'object') return fail('A photo could not be read.');
    const ph = phRaw as Record<string, unknown>;
    const id = typeof ph.id === 'string' ? ph.id : undefined;
    const upload = typeof ph.upload === 'string' ? ph.upload : undefined;
    if (!id && !upload) return fail('A photo could not be read.');
    const crop = parseCrop(ph.crop);
    if (crop === undefined) return fail('A photo crop could not be read.');
    photos.push({ ...(id ? { id } : {}), ...(upload ? { upload } : {}), crop });
  }

  return {
    ok: true,
    value: {
      name,
      strainType: strainType as StrainTypeKey | null,
      productType: type,
      productTypeOther: productTypeOther ?? null,
      concentrateType,
      concentrateTypeOther: concentrateTypeOther ?? null,
      country: country as string | null,
      countryOther: countryOther ?? null,
      source: source ?? null,
      dateTried: dateTried as string | null,
      leaflyLink: leaflyLink ?? null,
      notes: notes ?? null,
      hitTimeMinutes: hit as number | null,
      ratings,
      purchases,
      photos,
      private: r.private === true,
    },
  };
}

/** Label for the product type line, following the "Other" pattern (Other with nothing typed = not set). */
export function productTypeLabel(p: Pick<Product, 'productType' | 'productTypeOther' | 'concentrateType' | 'concentrateTypeOther'>): {
  type: string | null;
  concentrate: string | null;
} {
  const def = productType(p.productType);
  const type = p.productType === 'not_set' ? null : def.freeText ? p.productTypeOther?.trim() || null : def.label;
  let concentrate: string | null = null;
  if (def.subtypes) {
    if (p.concentrateType === 'other') concentrate = p.concentrateTypeOther?.trim() || null;
    else if (p.concentrateType !== 'not_set') concentrate = def.subtypes.options.find((s) => s.key === p.concentrateType)?.label ?? null;
  }
  return { type, concentrate };
}
