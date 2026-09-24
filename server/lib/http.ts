import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

/** Error body: a stable code for the client's logic and a sentence it can show as-is. */
export interface ApiError {
  error: string;
  message: string;
}

export function fail(status: 400 | 401 | 403 | 404 | 409 | 429, error: string, message: string, headers?: Record<string, string>): never {
  const res = new Response(JSON.stringify({ error, message } satisfies ApiError), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
  throw new HTTPException(status, { res });
}

/** Parses a JSON body into a plain object; anything else is a 400. */
export async function jsonBody(c: Context): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    fail(400, 'bad_request', 'The request could not be read.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'bad_request', 'The request could not be read.');
  return body as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== 'string') fail(400, 'bad_request', 'The request is missing something.');
  return v;
}
