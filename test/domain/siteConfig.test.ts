import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D47: the live and dev sites are one Worker config with a "dev" environment. These guard the
// settings that must never cross over: live has no DEV label and no test-only limits; dev has its
// own database, photos and address. Neither has a Smokes switch any more (D60).
const jsonc = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
const config = JSON.parse(jsonc.replace(/^\s*\/\/.*$/gm, '')) as any;
const dev = config.env.dev;

describe('site config (D47, D60)', () => {
  it('live: no DEV label, no test-only settings', () => {
    expect(config.vars).toEqual({ RP_ID: 'green-tracker.green-tracker.workers.dev', ORIGIN: 'https://green-tracker.green-tracker.workers.dev' });
  });

  it('dev: the DEV label, its own address', () => {
    expect(dev.vars).toEqual({
      RP_ID: 'green-tracker-dev.green-tracker.workers.dev',
      ORIGIN: 'https://green-tracker-dev.green-tracker.workers.dev',
      SITE: 'dev',
    });
  });

  it('dev never touches live data: its own database and photo storage', () => {
    expect(dev.d1_databases).toHaveLength(1);
    expect(dev.d1_databases[0].binding).toBe('DB');
    expect(dev.d1_databases[0].database_name).not.toBe(config.d1_databases[0].database_name);
    expect(dev.d1_databases[0].database_id).not.toBe(config.d1_databases[0].database_id);
    expect(dev.r2_buckets).toEqual([{ binding: 'PHOTOS', bucket_name: 'green-tracker-dev-photos' }]);
    expect(config.r2_buckets[0].bucket_name).toBe('green-tracker-photos');
  });
});
