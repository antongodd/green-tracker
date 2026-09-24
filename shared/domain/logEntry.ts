// Loose Log entries (brief §6, §10.2): name, country, product type, concentrate
// type, an optional amount and one photo. No ratings, prices, dates or notes.

import type { PhotoInput, PhotoRecord } from './photo';
import { emptyProductInput, PRODUCT_LIMITS, validateProductInput, type ProductInput } from './product';
import type { ProductTypeKey } from './productTypes';

export interface LogEntry {
  id: string;
  name: string;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  concentrateType: string;
  concentrateTypeOther: string | null;
  country: string | null;
  countryOther: string | null;
  /** Grams, or mg of THC for edibles. A single hand-kept number, not a purchase history. */
  amount: number | null;
  photo: PhotoRecord | null;
  createdAt: number;
  updatedAt: number;
}

export interface LogEntryInput {
  name: string;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  concentrateType: string;
  concentrateTypeOther: string | null;
  country: string | null;
  countryOther: string | null;
  amount: number | null;
  /** At most one. */
  photos: PhotoInput[];
}

export function emptyLogEntryInput(): LogEntryInput {
  const p = emptyProductInput();
  return {
    name: '',
    productType: p.productType,
    productTypeOther: null,
    concentrateType: p.concentrateType,
    concentrateTypeOther: null,
    country: null,
    countryOther: null,
    amount: null,
    photos: [],
  };
}

export function logEntryToInput(e: LogEntry): LogEntryInput {
  const { id: _i, createdAt: _c, updatedAt: _u, photo, ...rest } = e;
  return { ...rest, photos: photo ? [{ id: photo.id, crop: photo.crop }] : [] };
}

/**
 * Validates a loose entry. The shared fields go through the product validator, so
 * names, types and countries follow exactly the same rules (and auto-capitalisation).
 */
export function validateLogEntryInput(raw: unknown): { ok: true; value: LogEntryInput } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'The entry could not be read.' };
  const r = raw as Record<string, unknown>;
  const shared = validateProductInput({
    name: r.name,
    productType: r.productType,
    productTypeOther: r.productTypeOther,
    concentrateType: r.concentrateType,
    concentrateTypeOther: r.concentrateTypeOther,
    country: r.country,
    countryOther: r.countryOther,
    photos: r.photos,
  });
  if (!shared.ok) return { ok: false, message: shared.message.replace('Give the product a name.', 'Give the entry a name.') };
  if (shared.value.photos.length > 1) return { ok: false, message: 'A log entry has one photo.' };
  const amount = r.amount ?? null;
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > PRODUCT_LIMITS.money)) {
    return { ok: false, message: 'Amount must be more than 0.' };
  }
  const v = shared.value;
  return {
    ok: true,
    value: {
      name: v.name,
      productType: v.productType,
      productTypeOther: v.productTypeOther,
      concentrateType: v.concentrateType,
      concentrateTypeOther: v.concentrateTypeOther,
      country: v.country,
      countryOther: v.countryOther,
      amount: amount as number | null,
      photos: v.photos,
    },
  };
}

/**
 * Promotion pre-fills the product editor from the entry's live form: name,
 * country, photo, product type and concentrate type. Everything else starts
 * empty, and the amount is dropped — no purchase is invented to hold it.
 */
export function promotionInput(entry: LogEntryInput): ProductInput {
  return {
    ...emptyProductInput(),
    name: entry.name,
    productType: entry.productType,
    productTypeOther: entry.productTypeOther,
    concentrateType: entry.concentrateType,
    concentrateTypeOther: entry.concentrateTypeOther,
    country: entry.country,
    countryOther: entry.countryOther,
    photos: entry.photos,
  };
}
