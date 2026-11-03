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
