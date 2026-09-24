// Read-only access to the local D1 database and R2 bucket behind the test Worker,
// so tests can check what is really stored, not just what the API says.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inject } from 'vitest';

function open(kind: 'd1/miniflare-D1DatabaseObject' | 'r2/miniflare-R2BucketObject'): DatabaseSync[] {
  const dir = join(inject('persistDir'), 'v3', kind);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    .map((f) => new DatabaseSync(join(dir, f), { readOnly: true }));
}

/** Runs a read query against the app's D1 database. */
export function d1<T = Record<string, unknown>>(sql: string, ...params: (string | number)[]): T[] {
  for (const db of open('d1/miniflare-D1DatabaseObject')) {
    const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    if (hasUsers) return db.prepare(sql).all(...params) as T[];
  }
  throw new Error('App database not found');
}

/** Every R2 object key under a prefix. */
export function r2Keys(prefix: string): string[] {
  return open('r2/miniflare-R2BucketObject').flatMap((db) =>
    (db.prepare('SELECT key FROM _mf_objects WHERE key LIKE ?').all(`${prefix}%`) as { key: string }[]).map((r) => r.key),
  );
}

export const userId = (username: string) => d1<{ id: string }>('SELECT id FROM users WHERE username_lower = ?', username.toLowerCase())[0]?.id;
