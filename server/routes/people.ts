import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import type { PersonCard } from '../../shared/domain/social';
import { fail } from '../lib/http';
import { hit } from '../lib/rateLimit';
import { requireUser } from '../lib/session';
import { blockedEitherWay, canView, findUser, photoColumnSql, relationTo, shareProducts, toCards, visiblePhoto, type UserRef } from '../lib/social';
import { serveImage } from '../lib/photos';
import { load } from './products';

// People (brief §5). Following is one-way and needs approval; blocks remove follows
// both ways and hide the blocker. Nothing about another person is ever returned
// except their username and your own relation to them, unless you're an approved
// follower — and then only the shared product fields (lib/social.ts). Profile
// photos (D23) are added only where lib/social.ts's photo rule allows.

export const people = new Hono<AppEnv>();
people.use('*', requireUser());

const SEARCH_LIMIT = { name: 'people-search', max: 120, windowMs: 10 * 60_000 };
const NOT_FOUND: () => never = () => fail(404, 'not_found', 'There’s no one with that username.');

/** Someone else, by username. Someone who blocked you doesn't exist, as far as you can tell. */
async function other(c: Context<AppEnv>): Promise<UserRef> {
  const me = c.var.user!.id;
  const them = await findUser(c.env.DB, c.req.param('username') ?? '');
  if (!them || them.id === me) NOT_FOUND();
  const theyBlockedMe = await c.env.DB.prepare('SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2').bind(them.id, me).first();
  if (theyBlockedMe) NOT_FOUND();
  return them;
}

/** A person's card for the viewer: their photo only when the photo rule allows (D23). */
async function card(c: Context<AppEnv>, them: UserRef, relation: PersonCard['relation']): Promise<PersonCard> {
  const photo = await visiblePhoto(c.env.DB, c.var.user!.id, them.id);
  return photo ? { username: them.username, relation, photo: photo.image_set } : { username: them.username, relation };
}

// Lists ----------------------------------------------------------------------

/** Search by username (prefix first, then contains). The only search in the app. */
people.get('/search', async (c) => {
  const me = c.var.user!.id;
  await hit(c, SEARCH_LIMIT, me);
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return c.json({ people: [] });
  const like = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const { results } = await c.env.DB.prepare(
    `SELECT u.username,
            CASE WHEN f.status = 'approved' THEN 'following' WHEN f.status = 'pending' THEN 'requested' ELSE 'none' END AS relation,
            ${photoColumnSql('?1', 'u.id')}
     FROM users u
     LEFT JOIN follows f ON f.follower_id = ?1 AND f.followed_id = u.id
     WHERE u.id <> ?1 AND u.username_lower LIKE ?2 ESCAPE '\\'
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = ?1) OR (b.blocker_id = ?1 AND b.blocked_id = u.id))
     ORDER BY (u.username_lower LIKE ?3 ESCAPE '\\') DESC, u.username_lower
     LIMIT 20`,
  )
    .bind(me, `%${like}%`, `${like}%`)
    .all<PersonCard>();
  return c.json({ people: toCards(results) });
});

/** Incoming requests, newest first. `photos` maps a requester to their photo version (they reached out, so it's visible). */
people.get('/requests', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.username, ${photoColumnSql('?1', 'u.id')} FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.followed_id = ?1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
  )
    .bind(c.var.user!.id)
    .all<{ username: string; photo: string | null }>();
  return c.json({ people: results.map((r) => r.username), photos: Object.fromEntries(results.filter((r) => r.photo).map((r) => [r.username, r.photo])) });
});

people.get('/followers', async (c) => {
  const me = c.var.user!.id;
  const { results } = await c.env.DB.prepare(
    `SELECT u.username,
            CASE WHEN back.status = 'approved' THEN 'following' WHEN back.status = 'pending' THEN 'requested' ELSE 'none' END AS relation,
            ${photoColumnSql('?1', 'u.id')}
     FROM follows f JOIN users u ON u.id = f.follower_id
     LEFT JOIN follows back ON back.follower_id = ?1 AND back.followed_id = u.id
     WHERE f.followed_id = ?1 AND f.status = 'approved' ORDER BY u.username_lower`,
  )
    .bind(me)
    .all<PersonCard>();
  return c.json({ people: toCards(results) });
});

/** People you follow, and your outgoing requests (shown as Requested). */
people.get('/following', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.username, CASE WHEN f.status = 'approved' THEN 'following' ELSE 'requested' END AS relation,
            ${photoColumnSql('?1', 'u.id')}
     FROM follows f JOIN users u ON u.id = f.followed_id
     WHERE f.follower_id = ?1 ORDER BY f.status = 'pending', u.username_lower`,
  )
    .bind(c.var.user!.id)
    .all<PersonCard>();
  return c.json({ people: toCards(results) });
});

people.get('/blocked', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?1 ORDER BY u.username_lower')
    .bind(c.var.user!.id)
    .all<{ username: string }>();
  return c.json({ people: results.map((r) => r.username) });
});

// Incoming requests ------------------------------------------------------------

people.post('/requests/:username/approve', async (c) => {
  const them = await other(c);
  const res = await c.env.DB.prepare(`UPDATE follows SET status = 'approved' WHERE follower_id = ?1 AND followed_id = ?2 AND status = 'pending'`)
    .bind(them.id, c.var.user!.id)
    .run();
  if (res.meta.changes !== 1) fail(404, 'not_found', 'That request is no longer there.');
  return c.json({ ok: true });
});

/** Declining is silent: the requester just sees Follow again. */
people.post('/requests/:username/decline', async (c) => {
  const them = await other(c);
  await c.env.DB.prepare(`DELETE FROM follows WHERE follower_id = ?1 AND followed_id = ?2 AND status = 'pending'`).bind(them.id, c.var.user!.id).run();
  return c.json({ ok: true });
});

/** Remove a follower: their access ends immediately. */
people.delete('/followers/:username', async (c) => {
  const them = await other(c);
  await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ?1 AND followed_id = ?2').bind(them.id, c.var.user!.id).run();
  return c.json({ ok: true });
});

// One person -------------------------------------------------------------------

/** A person's card: username and your relation. A non-follower gets nothing more. */
people.get('/u/:username', async (c) => {
  const them = await other(c);
  return c.json({ person: await card(c, them, await relationTo(c.env.DB, c.var.user!.id, them.id)) });
});

/** Follow → a pending request. Blocked either way → refused as if they didn't exist. */
people.post('/u/:username/follow', async (c) => {
  const me = c.var.user!.id;
  const them = await other(c);
  if (await blockedEitherWay(c.env.DB, me, them.id)) fail(403, 'blocked', 'You’ve blocked this person. Unblock them first.');
  await c.env.DB.prepare(`INSERT INTO follows (follower_id, followed_id, status, created_at) VALUES (?1, ?2, 'pending', ?3) ON CONFLICT DO NOTHING`)
    .bind(me, them.id, Date.now())
    .run();
  return c.json({ person: await card(c, them, await relationTo(c.env.DB, me, them.id)) });
});

/** Cancel a request, or unfollow: access ends immediately. */
people.delete('/u/:username/follow', async (c) => {
  const me = c.var.user!.id;
  const them = await other(c);
  await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ?1 AND followed_id = ?2').bind(me, them.id).run();
  return c.json({ person: await card(c, them, 'none') });
});

/** Block: removes follows both ways and pending requests; they can't find or request you. Not notified. */
people.post('/u/:username/block', async (c) => {
  const me = c.var.user!.id;
  const them = await other(c);
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM follows WHERE (follower_id = ?1 AND followed_id = ?2) OR (follower_id = ?2 AND followed_id = ?1)').bind(me, them.id),
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING').bind(me, them.id, Date.now()),
  ]);
  return c.json({ person: { username: them.username, relation: 'blocked' } satisfies PersonCard });
});

people.delete('/u/:username/block', async (c) => {
  const me = c.var.user!.id;
  const them = await other(c);
  await c.env.DB.prepare('DELETE FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2').bind(me, them.id).run();
  return c.json({ person: await card(c, them, await relationTo(c.env.DB, me, them.id)) });
});

// Their products (approved followers only) ------------------------------------

async function sharedFor(c: Context<AppEnv>) {
  const them = await other(c);
  if (!(await canView(c.env.DB, c.var.user!.id, them.id))) fail(403, 'not_following', 'Follow to see their leaderboard.');
  return { them, products: shareProducts(await load(c.env.DB, them.id, { archived: false })) };
}

/** Their Leaderboard: visible products, shared fields only. */
people.get('/u/:username/products', async (c) => {
  const { them, products } = await sharedFor(c);
  return c.json({ person: await card(c, them, 'following'), products });
});

/** One of their product profiles. Private, archived or unknown → not found. */
people.get('/u/:username/products/:id', async (c) => {
  const { them, products } = await sharedFor(c);
  const product = products.find((p) => p.id === c.req.param('id'));
  if (!product) fail(404, 'not_found', 'That product isn’t available.');
  return c.json({ person: await card(c, them, 'following'), product });
});

// Their profile photo (D23) -----------------------------------------------------

/**
 * The crop or its thumbnail, only while the photo rule allows (lib/social.ts); never
 * the original. Anything else — unknown person, blocked, not connected, no photo — is
 * the same 403, so the reply can't be used to probe. Revalidated on every view.
 */
people.get('/u/:username/photo/:variant', async (c) => {
  const variant = c.req.param('variant');
  const denied: () => never = () => fail(403, 'not_authorised', 'You can’t see this photo.');
  if (variant !== 'thumb' && variant !== 'cropped') denied();
  const them = await findUser(c.env.DB, c.req.param('username') ?? '');
  if (!them) denied();
  const photo = await visiblePhoto(c.env.DB, c.var.user!.id, them.id);
  if (!photo) denied();
  return serveImage(c.env.PHOTOS, c.req.header('if-none-match'), them.id, photo.image_set, variant);
});
