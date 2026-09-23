export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  /** WebAuthn relying-party ID: the site's hostname. Passkeys are bound to it. */
  RP_ID: string;
  /** The exact origin the app is served from, e.g. https://green-tracker.green-tracker.workers.dev */
  ORIGIN: string;
}

export interface SessionUser {
  id: string;
  username: string;
}

export interface Session {
  tokenHash: string;
  needsPasskey: boolean;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: SessionUser | null; session: Session | null };
};
