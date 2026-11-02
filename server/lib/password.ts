import { base64url, randomBytes, utf8 } from './crypto';

// D80: passwords are stored only as a salted PBKDF2-SHA256 hash. 100,000 rounds is the most Workers allow.
const ROUNDS = 100_000;
const SCHEME = 'pbkdf2-sha256';

async function derive(password: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: rounds }, key, 256);
  return new Uint8Array(bits);
}

function fromBase64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
}

/** `pbkdf2-sha256$<rounds>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${SCHEME}$${ROUNDS}$${base64url(salt)}$${base64url(await derive(password, salt, ROUNDS))}`;
}

/** Built once, so a sign-in for an email with no account takes as long as a wrong password. */
let dummy: Promise<string> | null = null;

/** True when `password` matches `stored`. With no stored hash it still does the work, then says no. */
export async function checkPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    await checkPassword(password, await (dummy ??= hashPassword('not-a-password')));
    return false;
  }
  const [scheme, rounds, salt, hash] = stored.split('$');
  if (scheme !== SCHEME || !rounds || !salt || !hash) return false;
  const got = await derive(password, fromBase64url(salt), Number(rounds));
  const want = fromBase64url(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}
