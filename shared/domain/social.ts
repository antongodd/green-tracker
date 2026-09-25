// The social layer (brief §5): one-way follows that need approval; blocks.
// This file defines exactly what may cross from one account to another.

import type { StrainTypeKey, ProductTypeKey } from './productTypes';
import type { Ratings } from './ratings';

/** How the viewer relates to another person. */
export type Relation = 'none' | 'requested' | 'following' | 'blocked';

/**
 * A person as others see them: the username, your own relation to them, and —
 * only when you're connected to them (D23, `canSeePhoto` on the server) — the
 * version of their profile photo. Nothing else.
 */
export interface PersonCard {
  username: string;
  relation: Relation;
  /** Their profile photo's version; absent when they have none or you may not see it. */
  photo?: string;
}

/**
 * A product as an approved follower receives it — the complete list of fields
 * that ever leave the owner's account (brief §5, owner decisions D1–D3):
 * identity, ratings, hit time, photos, and Source (D1).
 * Never: prices, purchases, amounts, suppliers, VFM, notes, date tried, Leafly,
 * private/archived flags, the Log.
 */
export interface SharedProduct {
  id: string;
  name: string;
  strainType: StrainTypeKey | null;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  /** Only meaningful for concentrates; null otherwise. */
  concentrateType: string | null;
  concentrateTypeOther: string | null;
  country: string | null;
  countryOther: string | null;
  /** Owner decision D1: followers see Source. */
  source: string | null;
  /** Edibles only; null otherwise. */
  hitTimeMinutes: number | null;
  /** Only the categories in the product's current rating set. */
  ratings: Ratings;
  /** Cropped images only; the follower never gets originals. */
  photos: { id: string; version: string }[];
  /**
   * D3: date tried is never sent, so the server passes the owner's tie-break
   * order (most recent date tried first, undated last, then name) as an opaque rank.
   */
  tieRank: number;
}

/** Every key a SharedProduct may have — the allow-list the server builds from and the tests check. */
export const SHARED_PRODUCT_KEYS: readonly (keyof SharedProduct)[] = [
  'id',
  'name',
  'strainType',
  'productType',
  'productTypeOther',
  'concentrateType',
  'concentrateTypeOther',
  'country',
  'countryOther',
  'source',
  'hitTimeMinutes',
  'ratings',
  'photos',
  'tieRank',
];
