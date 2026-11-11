import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { freshTour, mergeTour, validateTour } from '../../shared/domain/tour';
import { fail, jsonBody } from '../lib/http';
import { requireUser } from '../lib/session';
import { loadTour, saveTourStatement } from '../lib/tour';

// Getting started (D97): yours to read (on /api/auth/me) and move along, never anyone else's.

export const tour = new Hono<AppEnv>();
tour.use('*', requireUser());

/** Saves where you're up to. A step, place or hint already saved stays (mergeTour). */
tour.put('/', async (c) => {
  const v = validateTour(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_tour', v.message);
  const stored = await loadTour(c.env.DB, c.var.user!.id);
  // An account from before D97 has none until it asks to be shown round.
  if (!stored) fail(404, 'no_tour', 'Getting started isn’t on for this account. Turn it on in Settings.');
  const next = mergeTour(stored, v.value);
  await saveTourStatement(c.env.DB, c.var.user!.id, next).run();
  return c.json({ tour: next });
});

/** Settings > Show me round again: a fresh list and hints, for any account. The welcome screen isn't shown again. */
tour.post('/restart', async (c) => {
  const next = freshTour(true);
  await saveTourStatement(c.env.DB, c.var.user!.id, next).run();
  return c.json({ tour: next });
});
