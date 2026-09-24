import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production config', () => {
  const raw = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  it('never relaxes the sign-up rate limit (test servers only)', () => {
    expect(raw).not.toContain('SIGNUP_LIMIT_PER_HOUR');
  });
  it('binds passkeys to the owner’s address (D11)', () => {
    expect(raw).toContain('"RP_ID": "green-tracker.green-tracker.workers.dev"');
    expect(raw).toContain('"ORIGIN": "https://green-tracker.green-tracker.workers.dev"');
  });
});
