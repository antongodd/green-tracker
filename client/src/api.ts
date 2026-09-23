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

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', OFFLINE);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'server_error', data?.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

// Shapes returned by the server ------------------------------------------------

export interface Me {
  user: { username: string } | null;
  needsPasskey?: boolean;
  passkeys?: number;
  recoveryCodesLeft?: number;
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}
