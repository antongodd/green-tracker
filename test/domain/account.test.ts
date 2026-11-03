import { describe, expect, it } from 'vitest';
import { emailKey, emailProblem, passwordProblem, usernameKey, usernameProblem } from '../../shared/domain/account';

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

describe('emails and passwords (D80)', () => {
  it.each([
    ['sam@example.com', null],
    ['  Sam.Grows+gt@example.co.uk ', null],
    ['', 'empty'],
    ['   ', 'empty'],
    ['sam', 'invalid'],
    ['sam@example', 'invalid'],
    ['sam @example.com', 'invalid'],
    ['@example.com', 'invalid'],
    [`${'a'.repeat(250)}@x.co`, 'too_long'],
  ])('email %j → %j', (e, problem) => expect(emailProblem(e)).toBe(problem));

  it('emails are unique whatever the case, ignoring spaces at the ends', () => expect(emailKey(' Sam@Example.COM ')).toBe('sam@example.com'));

  it.each([
    ['1234567', 'too_short'],
    ['12345678', null],
    ['a'.repeat(200), null],
    ['a'.repeat(201), 'too_long'],
  ])('password of %j → %j', (pw, problem) => expect(passwordProblem(pw)).toBe(problem));
});
