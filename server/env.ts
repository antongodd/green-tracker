export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  /** WebAuthn relying-party ID: the site's hostname. Passkeys are bound to it. */
  RP_ID: string;
  /** The exact origin the app is served from, e.g. https://green-tracker.green-tracker.workers.dev */
  ORIGIN: string;
  /** "dev" on the dev site (D47): the app shows its DEV label. Unset on the live site. */
  SITE?: string;
  /** Test servers only: raises the sign-up limit. Never set in production (default 10 an hour). */
  SIGNUP_LIMIT_PER_HOUR?: string;
  /** Test servers only: where exchange rates come from (a stand-in). Never set in production (D66: Frankfurter). */
  FX_URL?: string;
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
