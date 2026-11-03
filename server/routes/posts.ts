import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import {
  POSTS_PAGE,
  PREVIEW_COMMENTS,
  cursorOf,
  parseCursor,
  validateCaption,
  validateComment,
  validatePostInput,
  type Post,
  type PostAbout,
  type PostComment,
} from '../../shared/domain/posts';
import type { ProductTypeKey, StrainTypeKey } from '../../shared/domain/productTypes';
import type { Ratings } from '../../shared/domain/ratings';
import { overall } from '../../shared/domain/ratings';
import type { RatingKey } from '../../shared/domain/productTypes';
import type { Privacy } from '../../shared/domain/privacy';
import type { Preset } from '../../shared/domain/gems';
import { randomId } from '../lib/crypto';
import { fail, jsonBody } from '../lib/http';
import { copyImageSet, deleteLater, imageKeys, photoKey, serveImage } from '../lib/photos';
import { hit } from '../lib/rateLimit';
import { requireUser } from '../lib/session';
import { canView, findUser, photoColumnSql } from '../lib/social';
import { loadEffectivePrivacy } from '../lib/privacy';
import { loadAppearance } from '../lib/appearance';
import { load, NOT_KEPT } from './products';
import { yoursByKey, yoursFor, type YourScore } from '../../shared/domain/compare';

// Posts, comments and fires (D77). THE rule: a post — its photo, comments, fires and counts — is seen
// only by its owner and by people who pass canView (an approved follow, no block either way), checked
// in SQL on every request, so access ends the moment someone unfollows, is removed or is blocked.
// A comment or fire also needs its author to be able to see the post now, and nobody you've blocked
// (or who blocked you) is shown to you, nor counted. Replies are built field by field (Post, PostAbout).

export const posts = new Hono<AppEnv>();
posts.use('*', requireUser());

const HOUR = 60 * 60_000;
export const POST_LIMITS = {
  post: { name: 'post', max: 30, windowMs: HOUR },
  comment: { name: 'comment', max: 200, windowMs: HOUR },
  fire: { name: 'fire', max: 600, windowMs: HOUR },
};

const GONE: () => never = () => fail(404, 'not_found', 'This post isn’t available.');

/** SQL: may the viewer (?1) see post `p`? Yours, or you're an approved follower and neither has blocked the other. */
export const visiblePostSql = (p: string) => `(${p}.user_id = ?1 OR (
  EXISTS (SELECT 1 FROM follows vf WHERE vf.follower_id = ?1 AND vf.followed_id = ${p}.user_id AND vf.status = 'approved')
  AND NOT EXISTS (SELECT 1 FROM blocks vb WHERE (vb.blocker_id = ?1 AND vb.blocked_id = ${p}.user_id) OR (vb.blocker_id = ${p}.user_id AND vb.blocked_id = ?1))))`;

/**
 * SQL: is a comment or fire `x` (by x.user_id) shown to the viewer (?1) on a post owned by `owner`? Its author
 * can still see the post (the owner, or an approved follower), and no block between the viewer and the author.
 */
export const actorShownSql = (x: string, owner: string) => `((${x}.user_id = ${owner}
    OR EXISTS (SELECT 1 FROM follows af WHERE af.follower_id = ${x}.user_id AND af.followed_id = ${owner} AND af.status = 'approved'))
  AND NOT EXISTS (SELECT 1 FROM blocks ab WHERE (ab.blocker_id = ?1 AND ab.blocked_id = ${x}.user_id) OR (ab.blocker_id = ${x}.user_id AND ab.blocked_id = ?1)))`;

interface PostRow {
  id: string;
  user_id: string;
  username: string;
  product_id: string | null;
  log_entry_id: string | null;
  about_name: string | null;
  about_type: string | null;
  about_type_other: string | null;
  about_strain: string | null;
  caption: string;
  image_set: string;
  cutout: number;
  created_at: number;
  edited_at: number | null;
  photo: string | null;
  fires: number;
  you_fired: number;
  comment_count: number;
}

const POST_SELECT = `SELECT p.id, p.user_id, u.username, p.product_id, p.log_entry_id, p.about_name, p.about_type, p.about_type_other, p.about_strain,
    p.caption, p.image_set, p.cutout, p.created_at, p.edited_at, ${photoColumnSql('?1', 'p.user_id')},
    (SELECT COUNT(*) FROM post_fires x WHERE x.post_id = p.id AND ${actorShownSql('x', 'p.user_id')}) AS fires,
    EXISTS (SELECT 1 FROM post_fires y WHERE y.post_id = p.id AND y.user_id = ?1) AS you_fired,
    (SELECT COUNT(*) FROM post_comments x WHERE x.post_id = p.id AND ${actorShownSql('x', 'p.user_id')}) AS comment_count
  FROM posts p JOIN users u ON u.id = p.user_id`;

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  owner_id: string;
  username: string;
  body: string;
  created_at: number;
  photo: string | null;
}

/** The comments shown to the viewer on these posts, oldest first, at most `perPost` each. */
async function commentsFor(db: D1Database, viewer: string, postIds: string[], perPost: number): Promise<Map<string, CommentRow[]>> {
  const out = new Map<string, CommentRow[]>();
  if (!postIds.length) return out;
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT c.id, c.post_id, c.user_id, p.user_id AS owner_id, u.username, c.body, c.created_at, ${photoColumnSql('?1', 'c.user_id')},
                ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at, c.id) AS rn
         FROM post_comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id
         WHERE c.post_id IN (SELECT value FROM json_each(?2)) AND ${actorShownSql('c', 'p.user_id')}
       ) WHERE rn <= ?3 ORDER BY post_id, rn`,
    )
    .bind(viewer, JSON.stringify(postIds), perPost)
    .all<CommentRow>();
  for (const r of results) out.set(r.post_id, [...(out.get(r.post_id) ?? []), r]);
  return out;
}

const toComment = (viewer: string, r: CommentRow): PostComment => ({
  id: r.id,
  username: r.username,
  ...(r.photo ? { photo: r.photo } : {}),
  body: r.body,
  createdAt: r.created_at,
  canDelete: r.user_id === viewer || r.owner_id === viewer,
});

interface AboutProductRow {
  id: string;
  user_id: string;
  name: string;
  product_type: string;
  product_type_other: string | null;
  concentrate_type: string | null;
  concentrate_type_other: string | null;
  strain_type: string | null;
  source: string | null;
  country: string | null;
  country_other: string | null;
  private: number;
  archived: number;
  kept: number;
}

/**
 * The card under each post, for this viewer, worked out now (never stored): what the poster's
 * Privacy (D45) allows today, the product's state today. See PostAbout.
 */
async function aboutFor(db: D1Database, viewer: string, rows: PostRow[]): Promise<Map<string, PostAbout | null>> {
  const productIds = [...new Set(rows.map((r) => r.product_id).filter((x): x is string => !!x))];
  const entryIds = [...new Set(rows.map((r) => r.log_entry_id).filter((x): x is string => !!x))];
  const [prods, ratings, entries, covers] = await db.batch<unknown>([
    db
      .prepare(
        `SELECT pr.id, pr.user_id, pr.name, pr.product_type, pr.product_type_other, pr.concentrate_type, pr.concentrate_type_other, pr.strain_type, pr.source, pr.country, pr.country_other, pr.private, pr.archived,
                NOT ${NOT_KEPT('pr')} AS kept
         FROM products pr WHERE pr.id IN (SELECT value FROM json_each(?1))`,
      )
      .bind(JSON.stringify(productIds)),
    db.prepare('SELECT product_id, category, value FROM ratings WHERE product_id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(productIds)),
    db.prepare('SELECT id, user_id, name, product_type, product_type_other FROM log_entries WHERE id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(entryIds)),
    // D78: each product's cover (its first photo), for the card.
    db
      .prepare('SELECT id, product_id, image_set, cutout FROM photos WHERE product_id IN (SELECT value FROM json_each(?1)) ORDER BY product_id, position')
      .bind(JSON.stringify(productIds)),
  ]);
  const coverOf = new Map<string, { id: string; version: string; cutout: boolean }>();
  for (const x of covers!.results as { id: string; product_id: string; image_set: string; cutout: number }[])
    if (!coverOf.has(x.product_id)) coverOf.set(x.product_id, { id: x.id, version: x.image_set, cutout: x.cutout === 1 });
  const productById = new Map((prods!.results as AboutProductRow[]).map((p) => [p.id, p]));
  const ratingsById = new Map<string, Ratings>();
  for (const r of ratings!.results as { product_id: string; category: string; value: number }[]) {
    const m = ratingsById.get(r.product_id) ?? {};
    m[r.category as RatingKey] = r.value;
    ratingsById.set(r.product_id, m);
  }
  const entryById = new Map((entries!.results as { id: string; user_id: string; name: string; product_type: string; product_type_other: string | null }[]).map((e) => [e.id, e]));

  // Each poster's Privacy and colours, once per request.
  const privacy = new Map<string, Privacy>();
  const presets = new Map<string, Preset>();
  for (const owner of new Set(rows.map((r) => r.user_id))) {
    privacy.set(owner, await loadEffectivePrivacy(db, owner));
    presets.set(owner, (await loadAppearance(db, owner)).preset);
  }

  // D82: your own products, loaded once and only when a friend's card could match one of them.
  let yours: Map<string, YourScore> | null = null;
  const yourScore = async (p: AboutProductRow): Promise<YourScore | null> => {
    yours ??= yoursByKey(await load(db, viewer, { archived: false }));
    return yoursFor(
      {
        id: p.id,
        name: p.name,
        productType: p.product_type as ProductTypeKey,
        productTypeOther: p.product_type_other,
        concentrateType: p.concentrate_type,
        concentrateTypeOther: p.concentrate_type_other,
        source: p.source,
        ratings: {},
      },
      yours,
    );
  };

  const out = new Map<string, PostAbout | null>();
  for (const r of rows) {
    const mine = r.user_id === viewer;
    const base = { score: null, preset: null, source: null, country: null, countryOther: null, photo: null, yours: null };
    const plain = (): PostAbout | null =>
      r.about_name
        ? { kind: 'plain', name: r.about_name, productType: r.about_type as ProductTypeKey | null, productTypeOther: r.about_type_other, strainType: r.about_strain as StrainTypeKey | null, ...base, href: null }
        : null;
    const p = r.product_id ? productById.get(r.product_id) : undefined;
    const e = r.log_entry_id ? entryById.get(r.log_entry_id) : undefined;
    if (p && p.user_id === r.user_id) {
      const pv = privacy.get(r.user_id)!;
      const shown = mine ? p.kept === 0 : p.private === 0 && p.archived === 0 && p.kept === 0 && pv.shareBoard;
      if (!shown) {
        out.set(r.id, plain());
        continue;
      }
      const shareSource = mine || pv.shareSource;
      const shareCountry = mine || pv.shareCountry;
      out.set(r.id, {
        kind: 'product',
        name: p.name,
        productType: p.product_type as ProductTypeKey,
        productTypeOther: p.product_type_other,
        strainType: p.strain_type as StrainTypeKey | null,
        score: overall(p.product_type, ratingsById.get(p.id) ?? {}),
        preset: presets.get(r.user_id)!,
        source: shareSource ? p.source : null,
        country: shareCountry ? p.country : null,
        countryOther: shareCountry && p.country === 'OTHER' ? p.country_other : null,
        href: mine ? `/products/${encodeURIComponent(p.id)}` : `/u/${encodeURIComponent(r.username)}/p/${encodeURIComponent(p.id)}`,
        // Its cover, as their board shows it: only while their Privacy shares product photos (D45).
        photo: mine || pv.sharePhotos ? (coverOf.get(p.id) ?? null) : null,
        // D82: "You've had this too", only on a friend's card whose Source they share (same name, Source and type).
        yours: !mine && pv.shareSource && p.source ? await yourScore(p) : null,
      });
    } else if (e && e.user_id === r.user_id) {
      // A Log entry: its name and type only. The Log is never shared, so it opens only for you.
      out.set(r.id, {
        kind: 'log',
        name: e.name,
        productType: e.product_type as ProductTypeKey,
        productTypeOther: e.product_type_other,
        strainType: null,
        ...base,
        href: mine ? `/log/${encodeURIComponent(e.id)}` : null,
      });
    } else out.set(r.id, plain());
  }
  return out;
}

/** Rows → posts for the viewer: cards, counts and the comments (`perPost` of them). */
async function build(db: D1Database, viewer: string, rows: PostRow[], perPost: number): Promise<Post[]> {
  if (!rows.length) return [];
  const [about, comments] = [await aboutFor(db, viewer, rows), await commentsFor(db, viewer, rows.map((r) => r.id), perPost)];
  // D78: every photo of these posts (already ones the viewer may see), in order.
  const { results: pics } = await db
    .prepare('SELECT post_id, image_set, cutout FROM post_photos WHERE post_id IN (SELECT value FROM json_each(?1)) ORDER BY post_id, position')
    .bind(JSON.stringify(rows.map((r) => r.id)))
    .all<{ post_id: string; image_set: string; cutout: number }>();
  const photos = new Map<string, { version: string; cutout: boolean }[]>();
  for (const x of pics) photos.set(x.post_id, [...(photos.get(x.post_id) ?? []), { version: x.image_set, cutout: x.cutout === 1 }]);
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    ...(r.photo ? { photo: r.photo } : {}),
    mine: r.user_id === viewer,
    caption: r.caption,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    image: { version: r.image_set, cutout: r.cutout === 1 },
    photos: photos.get(r.id) ?? [{ version: r.image_set, cutout: r.cutout === 1 }],
    about: about.get(r.id) ?? null,
    fires: r.fires,
    youFired: r.you_fired === 1,
    commentCount: r.comment_count,
    comments: (comments.get(r.id) ?? []).map((c) => toComment(viewer, c)),
  }));
}

/** A page of posts matching `where` (extra SQL using ?2 onwards), newest first, 20 at a time. */
async function page(c: Context<AppEnv>, where: string, binds: unknown[]): Promise<{ posts: Post[]; next: string | null }> {
  const viewer = c.var.user!.id;
  const cursor = parseCursor(c.req.query('before'));
  if (c.req.query('before') && !cursor) fail(400, 'bad_request', 'The request couldn’t be read.');
  const n = binds.length + 2;
  const cond = cursor ? `AND (p.created_at < ?${n} OR (p.created_at = ?${n} AND p.id < ?${n + 1}))` : '';
  const { results } = await c.env.DB.prepare(`${POST_SELECT} WHERE ${visiblePostSql('p')} ${where} ${cond} ORDER BY p.created_at DESC, p.id DESC LIMIT ${POSTS_PAGE + 1}`)
    .bind(viewer, ...binds, ...(cursor ? [cursor.t, cursor.id] : []))
    .all<PostRow>();
  const more = results.length > POSTS_PAGE;
  const list = await build(c.env.DB, viewer, results.slice(0, POSTS_PAGE), PREVIEW_COMMENTS);
  return { posts: list, next: more ? cursorOf(list[list.length - 1]!) : null };
}

/** One post the viewer may see, with every comment; otherwise the same 404 for every reason. */
async function one(c: Context<AppEnv>, id: string): Promise<Post> {
  const viewer = c.var.user!.id;
  const row = await c.env.DB.prepare(`${POST_SELECT} WHERE p.id = ?2 AND ${visiblePostSql('p')}`).bind(viewer, id).first<PostRow>();
  if (!row) GONE();
  const [post] = await build(c.env.DB, viewer, [row], 1_000_000);
  return post!;
}

/** The bare post row, if the viewer may see it. */
async function visibleRow(c: Context<AppEnv>, id: string): Promise<{ id: string; user_id: string; image_set: string }> {
  const row = await c.env.DB.prepare(`SELECT p.id, p.user_id, p.image_set FROM posts p WHERE p.id = ?2 AND ${visiblePostSql('p')}`)
    .bind(c.var.user!.id, id)
    .first<{ id: string; user_id: string; image_set: string }>();
  if (!row) GONE();
  return row;
}

// The Feed ----------------------------------------------------------------------

/** Yours and everyone you follow (approved), newest first. Opening it (the first page) marks the Feed seen. */
posts.get('/feed', async (c) => {
  const result = await page(c, '', []);
  if (!c.req.query('before')) await c.env.DB.prepare('UPDATE users SET feed_seen_at = ?2 WHERE id = ?1').bind(c.var.user!.id, Date.now()).run();
  return c.json(result);
});

/** One person's posts (yours too): the same rule, so a non-follower gets nothing. */
posts.get('/by/:username', async (c) => {
  const me = c.var.user!.id;
  const them = await findUser(c.env.DB, c.req.param('username'));
  // As on People: someone who blocked you doesn't exist, as far as you can tell.
  const theyBlockedMe = them && them.id !== me && (await c.env.DB.prepare('SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2').bind(them.id, me).first());
  if (!them || theyBlockedMe) fail(404, 'not_found', 'There’s no one with that username.');
  if (them.id !== me && !(await canView(c.env.DB, me, them.id))) fail(403, 'not_following', 'Follow to see their posts.');
  return c.json(await page(c, 'AND p.user_id = ?2', [them.id]));
});

/**
 * Your own posts, oldest first, with what they're about by id: for Export (D77), which runs in the
 * browser. Yours only, so nothing here is ever someone else's.
 */
posts.get('/mine', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, product_id, log_entry_id, about_name, about_type, about_type_other, about_strain, caption, image_set, cutout, created_at, edited_at
     FROM posts WHERE user_id = ?1 ORDER BY created_at, id`,
  )
    .bind(c.var.user!.id)
    .all<{ id: string; product_id: string | null; log_entry_id: string | null; about_name: string | null; about_type: string | null; about_type_other: string | null; about_strain: string | null; caption: string; image_set: string; cutout: number; created_at: number; edited_at: number | null }>();
  const { results: pics } = await c.env.DB.prepare('SELECT post_id, image_set, cutout FROM post_photos WHERE user_id = ?1 ORDER BY post_id, position')
    .bind(c.var.user!.id)
    .all<{ post_id: string; image_set: string; cutout: number }>();
  const photos = new Map<string, { version: string; cutout: boolean }[]>();
  for (const x of pics) photos.set(x.post_id, [...(photos.get(x.post_id) ?? []), { version: x.image_set, cutout: x.cutout === 1 }]);
  return c.json({
    posts: results.map((r) => ({
      id: r.id,
      productId: r.product_id,
      logEntryId: r.log_entry_id,
      aboutName: r.about_name === null ? null : { name: r.about_name, productType: r.about_type, productTypeOther: r.about_type_other, strainType: r.about_strain },
      caption: r.caption,
      image: { version: r.image_set, cutout: r.cutout === 1 },
      photos: photos.get(r.id) ?? [{ version: r.image_set, cutout: r.cutout === 1 }],
      createdAt: r.created_at,
      editedAt: r.edited_at,
    })),
  });
});

// Writing a post ------------------------------------------------------------------

/**
 * A new post: its own copy of the photo (one of yours, or a fresh upload), a caption, and what it's
 * about. A Private product needs `makeVisible` (409 product_private otherwise): then turning Private off
 * and the post go in one batch, all or nothing. Archived products and ones kept by a Log entry (D50)
 * can't be posted.
 */
posts.post('/', async (c) => {
  const me = c.var.user!.id;
  const db = c.env.DB;
  const v = validatePostInput(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_post', v.message);
  const input = v.value;
  await hit(c, POST_LIMITS.post, me);

  let about: { productId: string | null; logEntryId: string | null; name: string | null; type: string | null; typeOther: string | null; strain: string | null } = {
    productId: null,
    logEntryId: null,
    name: null,
    type: null,
    typeOther: null,
    strain: null,
  };
  let makeVisible = false;
  if (input.about && 'product' in input.about) {
    const p = await db
      .prepare(`SELECT id, name, product_type, product_type_other, strain_type, private, archived, NOT ${NOT_KEPT('products')} AS kept FROM products WHERE id = ?1 AND user_id = ?2`)
      .bind(input.about.product, me)
      .first<{ id: string; name: string; product_type: string; product_type_other: string | null; strain_type: string | null; private: number; archived: number; kept: number }>();
    if (!p) fail(404, 'not_found', 'That product doesn’t exist.');
    if (p.archived === 1) fail(409, 'archived', 'This product is archived. Bring it back from Settings → Archive first.');
    if (p.kept === 1) fail(409, 'kept', 'This one is back in your Log. Post its Log entry instead.');
    if (p.private === 1) {
      if (!input.makeVisible) fail(409, 'product_private', 'This product is private. Your followers can’t see it.');
      makeVisible = true;
    }
    about = { productId: p.id, logEntryId: null, name: p.name, type: p.product_type, typeOther: p.product_type_other, strain: p.strain_type };
  } else if (input.about && 'logEntry' in input.about) {
    const e = await db
      .prepare('SELECT id, name, product_type, product_type_other FROM log_entries WHERE id = ?1 AND user_id = ?2')
      .bind(input.about.logEntry, me)
      .first<{ id: string; name: string; product_type: string; product_type_other: string | null }>();
    if (!e) fail(404, 'not_found', 'That Log entry doesn’t exist.');
    about = { productId: null, logEntryId: e.id, name: e.name, type: e.product_type, typeOther: e.product_type_other, strain: null };
  }

  // D78: the photos, in order, each a copy of one of yours or a fresh upload (an upload's original is never kept).
  // All are checked before anything is copied, so a missing one changes nothing.
  const statements: D1PreparedStatement[] = [];
  const unused: string[] = [];
  const copies: string[] = [];
  const fromIds = input.photos.flatMap((x) => ('fromPhotoId' in x ? [x.fromPhotoId] : []));
  const upIds = input.photos.flatMap((x) => ('upload' in x ? [x.upload] : []));
  const [ownPhotos, ups] = await db.batch<unknown>([
    db.prepare('SELECT id, image_set, cutout FROM photos WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))').bind(me, JSON.stringify(fromIds)),
    db.prepare('SELECT id, has_original, cutout FROM uploads WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))').bind(me, JSON.stringify(upIds)),
  ]);
  const photoById = new Map((ownPhotos!.results as { id: string; image_set: string; cutout: number }[]).map((r) => [r.id, r]));
  const upById = new Map((ups!.results as { id: string; has_original: number; cutout: number }[]).map((r) => [r.id, r]));
  if (fromIds.some((x) => !photoById.has(x))) fail(400, 'photo_missing', 'That photo couldn’t be found. Please choose another.');
  if (upIds.some((x) => !upById.has(x))) fail(400, 'photo_upload_missing', 'The photo upload has expired. Please add the photo again.');
  const sets: { set: string; cutout: number }[] = [];
  try {
    for (const x of input.photos) {
      if ('fromPhotoId' in x) {
        const ph = photoById.get(x.fromPhotoId)!;
        const set = await copyImageSet(c.env.PHOTOS, me, ph.image_set);
        copies.push(set);
        sets.push({ set, cutout: ph.cutout });
      } else {
        const up = upById.get(x.upload)!;
        sets.push({ set: up.id, cutout: up.cutout });
        statements.push(db.prepare('DELETE FROM uploads WHERE id = ?1 AND user_id = ?2').bind(up.id, me));
        if (up.has_original === 1) unused.push(photoKey(me, up.id, 'original'));
      }
    }
  } catch (e) {
    deleteLater(c.executionCtx, c.env.PHOTOS, copies.flatMap((set) => imageKeys(me, set)));
    throw e;
  }

  const id = randomId();
  const now = Date.now();
  if (makeVisible) statements.push(db.prepare(`UPDATE products SET private = 0, updated_at = ?3 WHERE id = ?1 AND user_id = ?2`).bind(about.productId, me, now));
  statements.push(
    db
      .prepare(
        `INSERT INTO posts (id, user_id, product_id, log_entry_id, about_name, about_type, about_type_other, about_strain, caption, image_set, cutout, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(id, me, about.productId, about.logEntryId, about.name, about.type, about.typeOther, about.strain, input.caption, sets[0]!.set, sets[0]!.cutout, now),
    db
      .prepare(
        `INSERT INTO post_photos (post_id, user_id, position, image_set, cutout)
         SELECT ?1, ?2, key, json_extract(value, '$.set'), json_extract(value, '$.cutout') FROM json_each(?3)`,
      )
      .bind(id, me, JSON.stringify(sets)),
  );
  try {
    await db.batch(statements);
  } catch (e) {
    deleteLater(c.executionCtx, c.env.PHOTOS, copies.flatMap((set) => imageKeys(me, set)));
    throw e;
  }
  deleteLater(c.executionCtx, c.env.PHOTOS, unused);
  return c.json({ post: await one(c, id) }, 201);
});

/** Edit the caption (yours only; anyone else gets the same 404). */
posts.put('/:id', async (c) => {
  const me = c.var.user!.id;
  const body = await jsonBody(c);
  const caption = validateCaption(body.caption);
  if (!caption.ok) fail(400, 'invalid_post', caption.message);
  const res = await c.env.DB.prepare('UPDATE posts SET caption = ?3, edited_at = ?4 WHERE id = ?1 AND user_id = ?2').bind(c.req.param('id'), me, caption.value, Date.now()).run();
  if (res.meta.changes !== 1) GONE();
  return c.json({ post: await one(c, c.req.param('id')) });
});

/** Delete (yours only): its comments and fires go with it, then its own photo files. */
posts.delete('/:id', async (c) => {
  const me = c.var.user!.id;
  const db = c.env.DB;
  const { results: sets } = await db.prepare('SELECT pp.image_set FROM post_photos pp JOIN posts p ON p.id = pp.post_id WHERE p.id = ?1 AND p.user_id = ?2').bind(c.req.param('id'), me).all<{ image_set: string }>();
  const row = await db.prepare('DELETE FROM posts WHERE id = ?1 AND user_id = ?2 RETURNING image_set').bind(c.req.param('id'), me).first<{ image_set: string }>();
  if (!row) GONE();
  deleteLater(c.executionCtx, c.env.PHOTOS, [...new Set([row.image_set, ...sets.map((x) => x.image_set)])].flatMap((set) => imageKeys(me, set)));
  return c.json({ ok: true });
});

// One post ---------------------------------------------------------------------------

posts.get('/:id', async (c) => c.json({ post: await one(c, c.req.param('id')) }));

/** D78: the post's `n`th photo, cropped or thumb only, after the same check; the same 403 for every refusal. */
posts.get('/:id/photos/:n/:variant', async (c) => {
  const variant = c.req.param('variant');
  const n = Number(c.req.param('n'));
  const denied: () => never = () => fail(403, 'not_authorised', 'You can’t see this photo.');
  if ((variant !== 'cropped' && variant !== 'thumb') || !Number.isInteger(n) || n < 0) denied();
  const row = await c.env.DB.prepare(
    `SELECT p.user_id, pp.image_set FROM posts p JOIN post_photos pp ON pp.post_id = p.id AND pp.position = ?3 WHERE p.id = ?2 AND ${visiblePostSql('p')}`,
  )
    .bind(c.var.user!.id, c.req.param('id'), n)
    .first<{ user_id: string; image_set: string }>();
  if (!row) denied();
  return serveImage(c.env.PHOTOS, c.req.header('if-none-match'), row.user_id, row.image_set, variant);
});

/** The post's first photo (before D78's several), kept for addresses already on a phone. */
posts.get('/:id/photo/:variant', async (c) => {
  const variant = c.req.param('variant');
  const denied: () => never = () => fail(403, 'not_authorised', 'You can’t see this photo.');
  if (variant !== 'cropped' && variant !== 'thumb') denied();
  const row = await c.env.DB.prepare(`SELECT p.user_id, p.image_set FROM posts p WHERE p.id = ?2 AND ${visiblePostSql('p')}`)
    .bind(c.var.user!.id, c.req.param('id'))
    .first<{ user_id: string; image_set: string }>();
  if (!row) denied();
  return serveImage(c.env.PHOTOS, c.req.header('if-none-match'), row.user_id, row.image_set, variant);
});

posts.post('/:id/comments', async (c) => {
  const me = c.var.user!.id;
  const post = await visibleRow(c, c.req.param('id'));
  const v = validateComment((await jsonBody(c)).body);
  if (!v.ok) fail(400, 'invalid_comment', v.message);
  await hit(c, POST_LIMITS.comment, me);
  await c.env.DB.prepare('INSERT INTO post_comments (id, post_id, user_id, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(randomId(), post.id, me, v.value, Date.now()).run();
  return c.json({ post: await one(c, post.id) }, 201);
});

/** Delete a comment: its author, or the post's owner. */
posts.delete('/:id/comments/:cid', async (c) => {
  const me = c.var.user!.id;
  const post = await visibleRow(c, c.req.param('id'));
  const res = await c.env.DB.prepare('DELETE FROM post_comments WHERE id = ?1 AND post_id = ?2 AND (user_id = ?3 OR ?4 = ?3)').bind(c.req.param('cid'), post.id, me, post.user_id).run();
  if (res.meta.changes !== 1) fail(404, 'not_found', 'That comment isn’t there any more.');
  return c.json({ post: await one(c, post.id) });
});

const fireState = async (c: Context<AppEnv>, id: string) => {
  const p = await one(c, id);
  return { fires: p.fires, youFired: p.youFired };
};

posts.put('/:id/fire', async (c) => {
  const me = c.var.user!.id;
  const post = await visibleRow(c, c.req.param('id'));
  await hit(c, POST_LIMITS.fire, me);
  await c.env.DB.prepare('INSERT INTO post_fires (post_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING').bind(post.id, me, Date.now()).run();
  return c.json(await fireState(c, post.id));
});

posts.delete('/:id/fire', async (c) => {
  const post = await visibleRow(c, c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM post_fires WHERE post_id = ?1 AND user_id = ?2').bind(post.id, c.var.user!.id).run();
  return c.json(await fireState(c, post.id));
});

/** Who gave a fire, newest first (the same rule as the count). */
posts.get('/:id/fires', async (c) => {
  const post = await visibleRow(c, c.req.param('id'));
  const { results } = await c.env.DB.prepare(
    `SELECT u.username, ${photoColumnSql('?1', 'x.user_id')} FROM post_fires x JOIN users u ON u.id = x.user_id
     WHERE x.post_id = ?2 AND ${actorShownSql('x', '?3')} ORDER BY x.created_at DESC`,
  )
    .bind(c.var.user!.id, post.id, post.user_id)
    .all<{ username: string; photo: string | null }>();
  return c.json({ people: results.map((r) => (r.photo ? { username: r.username, photo: r.photo } : { username: r.username })) });
});


/**
 * SQL for the Feed dot (D77), viewer ?1, last seen ?2: a post by someone you follow, or a comment
 * or fire by someone else on your posts, since you last opened the Feed.
 */
export const FEED_NEW_SQL = `SELECT
   EXISTS (SELECT 1 FROM posts p WHERE p.user_id <> ?1 AND p.created_at > ?2 AND ${visiblePostSql('p')})
   OR EXISTS (SELECT 1 FROM post_comments x JOIN posts p ON p.id = x.post_id WHERE p.user_id = ?1 AND x.user_id <> ?1 AND x.created_at > ?2 AND ${actorShownSql('x', 'p.user_id')})
   OR EXISTS (SELECT 1 FROM post_fires x JOIN posts p ON p.id = x.post_id WHERE p.user_id = ?1 AND x.user_id <> ?1 AND x.created_at > ?2 AND ${actorShownSql('x', 'p.user_id')})
   AS new`;
