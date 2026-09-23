import { Hono } from 'hono';

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
}

declare const __APP_VERSION__: string;

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.get('/version', (c) => c.json({ version: __APP_VERSION__ }));

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return c.json({ ok: row?.ok === 1, version: __APP_VERSION__ });
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
