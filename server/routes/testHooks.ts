import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { usernameKey } from '../../shared/domain/account';
import { fail, jsonBody, str } from '../lib/http';

// Test servers only (TEST_HOOKS, set by test/api/globalSetup.ts; config.test.ts checks it's never in wrangler.jsonc).
// Everywhere else every address here answers 404, as if it didn't exist.
export const testHooks = new Hono<AppEnv>();

testHooks.use('*', async (c, next) => {
  if (c.env.TEST_HOOKS !== '1') fail(404, 'not_found', 'Not found.');
  await next();
});

/** D80: turns an account back into one from before email and password, as every account was when 0019 ran. */
testHooks.post('/old-account', async (c) => {
  const username = str(await jsonBody(c), 'username');
  await c.env.DB.prepare('UPDATE users SET email = NULL, email_lower = NULL, password_hash = NULL WHERE username_lower = ?1').bind(usernameKey(username)).run();
  return c.json({ ok: true });
});

/** D83: makes an account's sessions look signed in `minutes` ago (a fresh sign-in skips the password for Face ID). */
testHooks.post('/age-sessions', async (c) => {
  const body = await jsonBody(c);
  const minutes = typeof body.minutes === 'number' ? body.minutes : 10;
  await c.env.DB.prepare('UPDATE sessions SET created_at = created_at - ?1 WHERE user_id = (SELECT id FROM users WHERE username_lower = ?2)')
    .bind(minutes * 60_000, usernameKey(str(body, 'username')))
    .run();
  return c.json({ ok: true });
});

/** D84: turns an account back into one from before the 18+ tick, as every account was when 0021 ran. */
testHooks.post('/not-adult', async (c) => {
  const username = str(await jsonBody(c), 'username');
  await c.env.DB.prepare('UPDATE users SET adult_at = NULL WHERE username_lower = ?1').bind(usernameKey(username)).run();
  return c.json({ ok: true });
});

/**
 * D84: gives one of the account's products `count` more photo rows (no files), to reach the photo limit without
 * thousands of uploads. Stops where the database's limit stops it, like a real Save.
 */
testHooks.post('/fill-photos', async (c) => {
  const body = await jsonBody(c);
  const count = typeof body.count === 'number' ? body.count : 0;
  const product = await c.env.DB.prepare('SELECT p.id, p.user_id FROM products p JOIN users u ON u.id = p.user_id WHERE u.username_lower = ?1 AND p.id = ?2')
    .bind(usernameKey(str(body, 'username')), str(body, 'product'))
    .first<{ id: string; user_id: string }>();
  if (!product) fail(404, 'not_found', 'Not found.');
  await c.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?3)
     INSERT INTO photos (id, user_id, product_id, position, original_set, image_set, created_at, updated_at)
     SELECT 'fill' || ?4 || '-' || i, ?1, ?2, 1000 + i, 'fill', 'fill', 1, 1 FROM n`,
  )
    .bind(product.user_id, product.id, count, Date.now())
    .run();
  return c.json({ ok: true });
});
