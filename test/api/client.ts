import { inject } from 'vitest';
import { SoftPasskey } from './authenticator';

const ORIGIN = 'http://localhost';
let ipCounter = 0;

/** One browser: its own cookie jar and client IP (so rate limits don't leak between tests). */
export class Browser {
  cookies = new Map<string, string>();
  lastSetCookie: string[] = [];
  constructor(public ip = `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`) {}

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { 'cf-connecting-ip': this.ip, ...headers };
    if (method !== 'GET' && !('origin' in headers)) h.origin = ORIGIN;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(inject('apiBase') + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
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
  get = (path: string) => this.req('GET', path);
  post = (path: string, body: unknown = {}) => this.req('POST', path, body);
  del = (path: string) => this.req('DELETE', path);
}

let nameCounter = 0;
export const uniqueName = (prefix = 'user') => `${prefix}${Date.now().toString(36).slice(-5)}${++nameCounter}`.slice(0, 20);

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
