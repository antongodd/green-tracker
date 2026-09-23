import { describe, expect, it } from 'vitest';
import { RECOVERY_CODE_ALPHABET, formatRecoveryCode, normaliseRecoveryCode, usernameKey, usernameProblem } from '../../shared/domain/account';

describe('usernames (D7)', () => {
  it.each([
    ['abc', null],
    ['Anton_101', null],
    ['a'.repeat(20), null],
    ['ab', 'too_short'],
    ['', 'too_short'],
    ['a'.repeat(21), 'too_long'],
    ['anton!', 'invalid_chars'],
    ['an ton', 'invalid_chars'],
    ['anton.g', 'invalid_chars'],
    ['zoë', 'invalid_chars'],
  ])('%s → %s', (u, problem) => expect(usernameProblem(u)).toBe(problem));

  it('is unique case-insensitively', () => expect(usernameKey('Anton_G')).toBe(usernameKey('anton_g')));
});

describe('recovery codes', () => {
  it('uses no look-alike characters', () => {
    for (const ch of '01OIL') expect(RECOVERY_CODE_ALPHABET).not.toContain(ch);
  });
  it('formats as XXXX-XXXX', () => expect(formatRecoveryCode('ABCDEFGH')).toBe('ABCD-EFGH'));
  it.each([
    ['ABCD-EFGH', 'ABCDEFGH'],
    ['abcd-efgh', 'ABCDEFGH'],
    [' abcd efgh ', 'ABCDEFGH'],
    ['ABCDEFGH', 'ABCDEFGH'],
    ['ABCD-EFG', null],
    ['ABCD-EFGHJ', null],
    ['ABCD-EFG0', null],
    ['ABCD-EFGO', null],
  ])('reads %j as %j', (input, out) => expect(normaliseRecoveryCode(input)).toBe(out));
});
