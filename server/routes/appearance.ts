import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validateAppearance } from '../../shared/domain/gems';
import { fail, jsonBody } from '../lib/http';
import { loadAppearance, saveAppearanceStatement } from '../lib/appearance';
import { requireUser } from '../lib/session';

// Your appearance settings (D48): yours to read and change, never anyone else's.

export const appearance = new Hono<AppEnv>();
appearance.use('*', requireUser());

appearance.get('/', async (c) => c.json({ appearance: await loadAppearance(c.env.DB, c.var.user!.id) }));

/** Saves the whole set (each choice in the app saves at once). */
appearance.put('/', async (c) => {
  const v = validateAppearance(await jsonBody(c));
  if (!v.ok) fail(400, 'invalid_appearance', v.message);
  await saveAppearanceStatement(c.env.DB, c.var.user!.id, v.value).run();
  return c.json({ appearance: v.value });
});
