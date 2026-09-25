import type { Product } from '../../shared/domain/product';
import { productType } from '../../shared/domain/productTypes';
import type { Ratings } from '../../shared/domain/ratings';
import { tieBreak } from '../../shared/domain/leaderboard';
import type { PersonCard, Relation, SharedProduct } from '../../shared/domain/social';
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
 * SQL for THE profile-photo rule (D23): may `viewer` see `owner`'s profile photo?
 * Yes for yourself; otherwise only when you're connected and neither has blocked
 * the other: the owner follows you or has asked to (they reached out to you), or
 * you're their approved follower. Sending someone a request doesn't reveal their
 * photo until they approve it. Both arguments are SQL expressions (a parameter or
 * a column), so lists and single checks share one definition.
 */
export const photoVisibleSql = (viewer: string, owner: string) => `(${owner} = ${viewer} OR (
  (EXISTS (SELECT 1 FROM follows pf WHERE pf.follower_id = ${owner} AND pf.followed_id = ${viewer})
    OR EXISTS (SELECT 1 FROM follows pf WHERE pf.follower_id = ${viewer} AND pf.followed_id = ${owner} AND pf.status = 'approved'))
  AND NOT EXISTS (SELECT 1 FROM blocks pb WHERE (pb.blocker_id = ${viewer} AND pb.blocked_id = ${owner}) OR (pb.blocker_id = ${owner} AND pb.blocked_id = ${viewer}))))`;

/** A list column: the owner's profile-photo version when the viewer may see it, else NULL. */
export const photoColumnSql = (viewer: string, owner: string) =>
  `(SELECT pp.image_set FROM profile_photos pp WHERE pp.user_id = ${owner} AND ${photoVisibleSql(viewer, owner)}) AS photo`;

/** The owner's profile-photo sets, if the viewer may see the photo. */
export async function visiblePhoto(db: D1Database, viewer: string, owner: string): Promise<{ original_set: string; image_set: string } | null> {
  return db
    .prepare(`SELECT pp.original_set, pp.image_set FROM profile_photos pp WHERE pp.user_id = ?2 AND ${photoVisibleSql('?1', '?2')}`)
    .bind(viewer, owner)
    .first<{ original_set: string; image_set: string }>();
}

/** Rows from a list query → cards; `photo` only when there is one to show. */
export function toCards(rows: { username: string; relation: Relation; photo?: string | null }[]): PersonCard[] {
  return rows.map((r) => (r.photo ? { username: r.username, relation: r.relation, photo: r.photo } : { username: r.username, relation: r.relation }));
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
    photos: p.photos.map((ph) => ({ id: ph.id, version: ph.version, cutout: ph.cutout })),
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
