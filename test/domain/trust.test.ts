import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, PHOTO_LIMIT, PHOTO_LIMIT_TEXT, PHOTO_WARN, REPORT_REASONS } from '../../shared/domain/trust';

// D84: the pieces that must agree across the app, the database and the website.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('trust basics (D84)', () => {
  it('the report reasons are exactly the ones the database allows', () => {
    const allowed = read('migrations/0021_trust.sql').match(/reason IN \(([^)]*)\)/)![1]!.match(/'([a-z0-9]+)'/g)!.map((x) => x.slice(1, -1));
    expect(REPORT_REASONS.map((r) => r.key)).toEqual(allowed);
  });

  it('the website shows the same contact address, and that it is for adults', () => {
    const site = read('site/public/index.html');
    expect(site).toContain(CONTACT_EMAIL);
    expect(site).toContain('<p class="eyebrow">Free · 18+ ·');
    expect(site).toContain('For adults 18+.');
  });

  it('the photo limit reads as a number, and the warning starts below it', () => {
    expect(PHOTO_LIMIT_TEXT).toContain('3,000 photos');
    expect(PHOTO_WARN).toBeLessThan(PHOTO_LIMIT);
  });
});
