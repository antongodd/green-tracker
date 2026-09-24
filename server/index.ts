import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';
import { loadSession } from './lib/session';
import { auth } from './routes/auth';
import { account } from './routes/account';
import { products } from './routes/products';
import { photos, uploads } from './routes/photos';
import { log } from './routes/log';
import { people } from './routes/people';
import { data } from './routes/data';

export type { Env } from './env';

declare const __APP_VERSION__: string;

const app = new Hono<AppEnv>().basePath('/api');

// API responses hold personal data: never cache them anywhere — unless a route
// sets its own policy (photos: private, no-cache + ETag, so they revalidate).
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.has('cache-control')) c.header('cache-control', 'no-store');
});

// Cross-site request forgery: every state-changing request must come from the app's own origin.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('origin') !== c.env.ORIGIN) {
    return c.json({ error: 'bad_origin', message: 'This request didn’t come from Green Tracker.' }, 403);
  }
  await next();
});

app.use('*', loadSession);

app.get('/version', (c) => c.json({ version: __APP_VERSION__ }));

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return c.json({ ok: row?.ok === 1, version: __APP_VERSION__ });
});

app.route('/auth', auth);
app.route('/account', account);
app.route('/products', products);
app.route('/uploads', uploads);
app.route('/photos', photos);
app.route('/log', log);
app.route('/people', people);
app.route('/data', data);

app.notFound((c) => c.json({ error: 'not_found', message: 'Not found.' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  // Log the error type and route only: never request bodies or personal content.
  console.error(`${c.req.method} ${c.req.routePath}: ${err.name}`);
  return c.json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
});

export default app;
