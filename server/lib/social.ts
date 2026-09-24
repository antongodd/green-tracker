import type { Product } from '../../shared/domain/product';
import { productType } from '../../shared/domain/productTypes';
import type { Ratings } from '../../shared/domain/ratings';
import { tieBreak } from '../../shared/domain/leaderboard';
import type { Relation, SharedProduct } from '../../shared/domain/social';
import { usernameKey } from '../../shared/domain/account';

export interface UserRef {
  id: string;
  username: string;
}

export async function findUser(db: D1Database, username: string): Promise<UserRef | null> {
  return db.prepare('SELECT id, username FROM users WHERE username_lower = ?1').bind(usernameKey(username)).first<UserRef>();
}

/** True if either person has blocked the other. */
export async function blockedEitherWay(db: D1Database, a: string, b: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM blocks WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1)')
    .bind(a, b)
    .first();
  return row !== null;
}

export async function relationTo(db: D1Database, me: string, them: string): Promise<Relation> {
  const blocked = await db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2').bind(me, them).first();
  if (blocked) return 'blocked';
  const f = await db.prepare('SELECT status FROM follows WHERE follower_id = ?1 AND followed_id = ?2').bind(me, them).first<{ status: string }>();
  return f?.status === 'approved' ? 'following' : f?.status === 'pending' ? 'requested' : 'none';
}

/**
 * THE access rule for someone else's content: an approved follow, and no block
 * either way. A pending request grants nothing. Checked on every request, so
 * access ends the moment a follow is removed or a block is made.
 */
export async function canView(db: D1Database, viewer: string, owner: string): Promise<boolean> {
  if (viewer === owner) return true;
  const row = await db
    .prepare(
      `SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.followed_id = ?2 AND f.status = 'approved'
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = ?2) OR (b.blocker_id = ?2 AND b.blocked_id = ?1))`,
    )
    .bind(viewer, owner)
    .first();
  return row !== null;
}

/**
 * Builds a follower's copy of a product from an explicit allow-list — never by
 * copying the record and deleting fields, so nothing new can leak by accident.
 * The caller has already excluded private and archived products.
 */
export function shareProduct(p: Product, tieRank: number): SharedProduct {
  const def = productType(p.productType);
  const ratings: Ratings = {};
  for (const slot of def.ratingSet) {
    const v = p.ratings[slot.key];
    if (v !== undefined) ratings[slot.key] = v;
  }
  const isConcentrate = !!def.subtypes;
  return {
    id: p.id,
    name: p.name,
    strainType: p.strainType,
    productType: p.productType,
    productTypeOther: def.freeText ? p.productTypeOther : null,
    concentrateType: isConcentrate ? p.concentrateType : null,
    concentrateTypeOther: isConcentrate && p.concentrateType === 'other' ? p.concentrateTypeOther : null,
    country: p.country,
    countryOther: p.country === 'OTHER' ? p.countryOther : null,
    source: p.source,
    hitTimeMinutes: p.productType === 'edibles' ? p.hitTimeMinutes : null,
    ratings,
    photos: p.photos.map((ph) => ({ id: ph.id, version: ph.version })),
    tieRank,
  };
}

/** The follower's list: visible products only, each with the owner's tie-break rank (D3). */
export function shareProducts(products: Product[]): SharedProduct[] {
  const visible = products.filter((p) => !p.private && !p.archived);
  const ordered = [...visible].sort(tieBreak);
  const rank = new Map(ordered.map((p, i) => [p.id, i]));
  return visible.map((p) => shareProduct(p, rank.get(p.id)!));
}
