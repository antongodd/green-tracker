// Account rules shared by the server (enforcement) and the client (live hints).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_CHARS = /^[A-Za-z0-9_]+$/;

export type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars';

/** D7: 3–20 characters, letters, digits and underscore. Shown as typed, unique case-insensitively. */
export function usernameProblem(username: string): UsernameProblem | null {
  if (username.length < USERNAME_MIN) return 'too_short';
  if (username.length > USERNAME_MAX) return 'too_long';
  if (!USERNAME_CHARS.test(username)) return 'invalid_chars';
  return null;
}

export const USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string> = {
  too_short: `Use at least ${USERNAME_MIN} characters.`,
  too_long: `Use ${USERNAME_MAX} characters or fewer.`,
  invalid_chars: 'Use only letters, numbers and _.',
};

/** The key usernames are unique on. */
export function usernameKey(username: string): string {
  return username.toLowerCase();
}

// Recovery codes -------------------------------------------------------------

export const RECOVERY_CODE_COUNT = 10;
/** No 0/O, 1/I/L, so a code copied by hand can't be misread. 31 symbols × 8 ≈ 39.6 bits. */
export const RECOVERY_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

/** Formats 8 alphabet characters as `XXXX-XXXX`. */
export function formatRecoveryCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Normalises typed input to the 8 stored characters: case-insensitive, spaces
 * and dashes ignored. Returns null when it can't be a code.
 */
export function normaliseRecoveryCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!RECOVERY_CODE_ALPHABET.includes(ch)) return null;
  return s;
}
