import type { Crop } from '../../shared/domain/photo';
import type { Appearance } from '../../shared/domain/gems';
import { reportNetwork } from './online';

/** A failed API call. `message` is written for the person using the app and can be shown as-is. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const OFFLINE = 'You’re offline. Check your connection and try again.';

/** Save and Post give up after this long, so a weak signal can't leave them hanging (0.69.2). */
export const SAVE_TIMEOUT_MS = 20_000;
const TIMED_OUT = 'That took too long, so it stopped. Your signal may be weak: try again.';

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctl = opts.timeoutMs ? new AbortController() : null;
  let timedOut = false;
  const timer = ctl ? setTimeout(() => ((timedOut = true), ctl.abort()), opts.timeoutMs) : null;
  try {
    let res: Response;
    try {
      res = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl?.signal,
      });
    } catch {
      if (timedOut) throw new ApiError(0, 'timeout', TIMED_OUT);
      reportNetwork(false);
      throw new ApiError(0, 'offline', OFFLINE);
    }
    reportNetwork(true);
    const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (timedOut) throw new ApiError(0, 'timeout', TIMED_OUT);
    if (!res.ok) {
      throw new ApiError(res.status, data?.error ?? 'server_error', data?.message ?? 'Something went wrong. Please try again.');
    }
    return data as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A new product, Log entry or post that timed out may have reached the server anyway: say where to
 * look before trying again, so a second try doesn't make it twice.
 */
export const timedOutNew = (e: unknown, where: string): string | null =>
  e instanceof ApiError && e.code === 'timeout' ? `That took too long, so it stopped. It may have been saved anyway: check ${where} before you try again.` : null;

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

// Shapes returned by the server ------------------------------------------------

export interface Me {
  /** `photo`: your profile photo's version and framing (D23), when you have one. */
  user: { username: string; photo?: { version: string; crop: Crop } } | null;
  /** D80: your email (private, only ever sent to you). Null on an account from before D80. */
  email?: string | null;
  /** D80: an account from before email and password: it adds both before anything else. */
  needsLogin?: boolean;
  /** D84: an account from before the 18+ tick: it ticks it, once, before anything else. */
  needsAdult?: boolean;
  /** D84: your photos (product, Log and post), against PHOTO_LIMIT. */
  photoCount?: number;
  passkeys?: number;
  /** Incoming follow requests: the number on the Feed tab and its People button (D77). */
  pendingRequests?: number;
  /** D77: something new in the Feed since you last opened it (the dot on the Feed tab). */
  feedNew?: boolean;
  /** D48: your Leaderboard colours and #1 mark (signed in only). */
  appearance?: Appearance;
  /** D66: your main currency, which every price shown together is in (signed in only). */
  currency?: string;
  /** D47: which site this is. The dev site shows an orange DEV label. */
  site?: 'dev' | 'live';
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}
