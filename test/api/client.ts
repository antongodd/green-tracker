import { inject } from 'vitest';
import { SoftPasskey } from './authenticator';

const ORIGIN = 'http://localhost';
let ipCounter = 0;
/**
 * Each test file numbers its browsers from 1 again (files run in their own module scope), so every
 * file's first browser used to share 10.0.0.1 and the sign-up limit (10 an hour per address) counted
 * across files: adding a file with sign-ups pushed an unrelated file over it (0.41.0). A random
 * block per file keeps each file's addresses its own.
 */
const [blockA, blockB] = [1 + Math.floor(Math.random() * 250), Math.floor(Math.random() * 200)];

/** One browser: its own cookie jar and client IP (so rate limits don't leak between tests). */
export class Browser {
  cookies = new Map<string, string>();
  lastSetCookie: string[] = [];
  constructor(
    public ip = `10.${blockA}.${blockB + Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
    /** Which server: the main one (Smokes on), or `inject('liveApiBase')` for one with Smokes off (D46). */
    public base = inject('apiBase'),
  ) {}

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { 'cf-connecting-ip': this.ip, ...headers };
    if (method !== 'GET' && !('origin' in headers)) h.origin = ORIGIN;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    this.lastSetCookie = res.headers.getSetCookie();
    for (const c of this.lastSetCookie) {
      const [pair] = c.split(';');
      const [k, v] = pair!.split('=');
      if (/max-age=0/i.test(c) || v === '') this.cookies.delete(k!);
      else this.cookies.set(k!, v!);
    }
    const json = (await res.json()) as any;
    return { status: res.status, json, headers: res.headers };
  }
  /** multipart/form-data POST (photo uploads). */
  async upload(path: string, parts: Record<string, Uint8Array | string>) {
    const form = new FormData();
    // Bytes are files; a string is a plain form field (e.g. cutout=1).
    for (const [k, v] of Object.entries(parts)) typeof v === 'string' ? form.append(k, v) : form.append(k, new Blob([v as BlobPart], { type: 'image/jpeg' }), `${k}.jpg`);
    const headers: Record<string, string> = { 'cf-connecting-ip': this.ip, origin: 'http://localhost' };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + path, { method: 'POST', headers, body: form });
    return { status: res.status, json: (await res.json()) as any };
  }

  /** Raw GET (images): status, headers and bytes. */
  async raw(path: string, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { 'cf-connecting-ip': this.ip, ...headers };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + path, { headers: h });
    return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) };
  }

  get = (path: string) => this.req('GET', path);
  post = (path: string, body: unknown = {}) => this.req('POST', path, body);
  del = (path: string) => this.req('DELETE', path);
}

let nameCounter = 0;
/**
 * A username no other test has. Each test file runs in its own worker with its own counter, so the
 * time and counter alone repeated across files in the same millisecond ("That username is taken",
 * 0.40.1 CI); four random characters keep them apart.
 */
export const uniqueName = (prefix = 'user') => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}${++nameCounter}`.slice(0, 20);

/** Signs up a new account in `browser`; returns its passkey and recovery codes. */
export async function signUp(browser: Browser, username = uniqueName()) {
  const passkey = new SoftPasskey();
  const opts = await browser.post('/api/auth/signup/options', { username });
  if (opts.status !== 200) throw new Error(`signup options ${opts.status} ${JSON.stringify(opts.json)}`);
  const verify = await browser.post('/api/auth/signup/verify', { challengeId: opts.json.challengeId, response: await passkey.register(opts.json.options) });
  if (verify.status !== 200) throw new Error(`signup verify ${verify.status} ${JSON.stringify(verify.json)}`);
  return { username, passkey, codes: verify.json.recoveryCodes as string[] };
}

export async function signIn(browser: Browser, passkey: SoftPasskey) {
  const opts = await browser.post('/api/auth/signin/options');
  return browser.post('/api/auth/signin/verify', { challengeId: opts.json.challengeId, response: await passkey.authenticate(opts.json.options) });
}

export async function addPasskey(browser: Browser) {
  const passkey = new SoftPasskey();
  const opts = await browser.post('/api/account/passkeys/options');
  const res = await browser.post('/api/account/passkeys/verify', { challengeId: opts.json.challengeId, response: await passkey.register(opts.json.options) });
  return { passkey, res };
}
