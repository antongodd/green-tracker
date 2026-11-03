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

// Email and password (D80) -------------------------------------------------------

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailProblem = 'empty' | 'invalid' | 'too_long';
export type PasswordProblem = 'too_short' | 'too_long';

/** Not checked by sending a message yet (D80): only that it looks like an email. */
export function emailProblem(email: string): EmailProblem | null {
  const e = email.trim();
  if (!e) return 'empty';
  if (e.length > EMAIL_MAX) return 'too_long';
  if (!EMAIL_SHAPE.test(e)) return 'invalid';
  return null;
}

export const EMAIL_PROBLEM_TEXT: Record<EmailProblem, string> = {
  empty: 'Enter your email.',
  invalid: 'That doesn’t look like an email address.',
  too_long: 'That email is too long.',
};

export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'too_short';
  if (password.length > PASSWORD_MAX) return 'too_long';
  return null;
}

export const PASSWORD_PROBLEM_TEXT: Record<PasswordProblem, string> = {
  too_short: `Use at least ${PASSWORD_MIN} characters.`,
  too_long: `Use ${PASSWORD_MAX} characters or fewer.`,
};

/** The key emails are unique on (case doesn't matter, spaces at either end are ignored). */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}
