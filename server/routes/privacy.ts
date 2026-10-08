import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { effectivePrivacy, validatePrivacy } from '../../shared/domain/privacy';
import { fail, jsonBody } from '../lib/http';
import { loadPrivacy, savePrivacyStatement } from '../lib/privacy';
import { requireUser } from '../lib/session';
import { sharedSmokes, shareProducts } from '../lib/social';
import { load } from './products';

// Your privacy settings (D45): yours to read and change, never anyone else's.

export const privacy = new Hono<AppEnv>();
privacy.use('*', requireUser());

privacy.get('/', async (c) => c.json({ privacy: await loadPrivacy(c.env.DB, c.var.user!.id) }));

/** Saves the whole set (each switch in the app saves at once). */
privacy.put('/', async (c) => {
  const v = validatePrivacy(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_privacy', v.message);
  await savePrivacyStatement(c.env.DB, c.var.user!.id, v.value).run();
  return c.json({ privacy: v.value });
});

/**
 * Your own board exactly as a follower receives it now: the same code builds both,
 * so the preview on the Privacy screen can't drift from what's really sent.
 */
privacy.get('/preview', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const p = effectivePrivacy(await loadPrivacy(db, userId));
  const products = p.shareBoard ? shareProducts(await load(db, userId, { archived: false }), p, await sharedSmokes(db, userId, p)) : [];
  return c.json({ products, options: { mostUsed: p.shareMostUsed }, shared: p.shareBoard });
});
