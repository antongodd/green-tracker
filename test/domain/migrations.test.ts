import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { loadAppearance } from '../../server/lib/appearance';
import { DEFAULT_APPEARANCE } from '../../shared/domain/gems';

// D76: the looks and colour sets are no longer listed in the database. These run the real migrations, in order, on a
// scratch SQLite database (D1 is SQLite), and check what reading the settings back does with a value the app doesn't know.
const dir = new URL('../../migrations/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const migrate = (db: DatabaseSync, which: (f: string) => boolean) => {
  for (const f of files.filter(which)) db.exec(readFileSync(new URL(f, dir), 'utf8'));
};
// The first migration turns foreign keys on, as D1 has them, so the settings belong to real accounts here.
const fresh = () => new DatabaseSync(':memory:');
const row = (db: DatabaseSync) => db.prepare('SELECT user_id, look, board_top, preset, mark_first, updated_at FROM appearance_settings').all();
const put = (db: DatabaseSync, id: string, look: string, top: string, preset: string) => {
  db.prepare('INSERT OR IGNORE INTO users (id, username, username_lower, created_at) VALUES (?, ?, ?, 1)').run(id, id, id);
  db.prepare('INSERT INTO appearance_settings (user_id, look, board_top, preset, mark_first, updated_at) VALUES (?, ?, ?, ?, 0, 1)').run(id, look, top, preset);
};

describe('looks and colour sets without a database change (D76)', () => {
  it("0016 keeps everyone's settings exactly as they were", () => {
    const db = fresh();
    migrate(db, (f) => f < '0016');
    put(db, 'u1', 'daysky', 'tiles', 'synthwave');
    put(db, 'u2', 'aurora', 'strip', 'gems');
    const before = row(db);
    migrate(db, (f) => f.startsWith('0016'));
    expect(row(db)).toEqual(before);
  });

  it('after it, a new look or colour set needs no database change; the top is still checked', () => {
    const db = fresh();
    migrate(db, () => true);
    expect(() => put(db, 'u1', 'a-look-from-next-month', 'hero', 'a-new-colour-set')).not.toThrow();
    expect(() => put(db, 'u2', 'aurora', 'sideways', 'gems')).toThrow(/CHECK/);
    // Before 0016 the same new look was refused: the reason each new one needed a migration.
    const old = fresh();
    migrate(old, (f) => f < '0016');
    expect(() => put(old, 'u1', 'a-look-from-next-month', 'hero', 'gems')).toThrow(/CHECK/);
  });

  // A stand-in for D1 that answers the one query loadAppearance makes.
  const d1 = (stored: Record<string, unknown> | null) =>
    ({ prepare: () => ({ bind: () => ({ first: async () => stored }) }) }) as unknown as D1Database;

  it("reading back: a look or colour set this build doesn't know shows the default, the rest stay yours", async () => {
    expect(await loadAppearance(d1({ look: 'a-look-from-next-month', board_top: 'tiles', preset: 'synthwave', mark_first: 0 }), 'u')).toEqual({
      look: DEFAULT_APPEARANCE.look,
      top: 'tiles',
      preset: 'synthwave',
      markFirst: false,
    });
    expect(await loadAppearance(d1({ look: 'daysky', board_top: 'hero', preset: 'a-new-colour-set', mark_first: 1 }), 'u')).toEqual({
      look: 'daysky',
      top: 'hero',
      preset: DEFAULT_APPEARANCE.preset,
      markFirst: true,
    });
    expect(await loadAppearance(d1(null), 'u')).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('several photos in a post (D78)', () => {
  it('0018 copies every existing post’s photo in as its first', () => {
    const db = new DatabaseSync(':memory:');
    for (const f of files.filter((f) => f < '0018')) db.exec(readFileSync(new URL(f, dir), 'utf8'));
    db.prepare("INSERT INTO users (id, username, username_lower, created_at) VALUES ('u1', 'u1', 'u1', 1)").run();
    db.prepare("INSERT INTO posts (id, user_id, caption, image_set, cutout, created_at) VALUES ('p1', 'u1', 'hi', 'set1', 1, 5)").run();
    for (const f of files.filter((f) => f.startsWith('0018'))) db.exec(readFileSync(new URL(f, dir), 'utf8'));
    expect(db.prepare('SELECT post_id, user_id, position, image_set, cutout FROM post_photos').all()).toEqual([{ post_id: 'p1', user_id: 'u1', position: 0, image_set: 'set1', cutout: 1 }]);
  });
});

describe('email and password (D80)', () => {
  it('0019 keeps every account and its data, with no email yet; recovery codes go; recovery sessions just need the email now', () => {
    const db = fresh();
    migrate(db, (f) => f < '0019');
    db.prepare("INSERT INTO users (id, username, username_lower, created_at) VALUES ('u1', 'Sam', 'sam', 1)").run();
    db.prepare("INSERT INTO passkeys (id, user_id, public_key, created_at) VALUES ('pk1', 'u1', x'00', 1)").run();
    db.prepare("INSERT INTO recovery_codes (id, user_id, code_hash) VALUES ('c1', 'u1', 'h')").run();
    db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, needs_passkey) VALUES ('t1', 'u1', 1, 2, 1)").run();
    migrate(db, (f) => f.startsWith('0019'));
    expect(db.prepare('SELECT username, email, email_lower, password_hash FROM users').all()).toEqual([{ username: 'Sam', email: null, email_lower: null, password_hash: null }]);
    expect(db.prepare('SELECT id FROM passkeys').all()).toEqual([{ id: 'pk1' }]);
    expect(db.prepare('SELECT user_id, needs_passkey FROM sessions').all()).toEqual([{ user_id: 'u1', needs_passkey: 0 }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'recovery_codes'").all()).toEqual([]);
  });

  it('after it, one account per email; any number still without one', () => {
    const db = fresh();
    migrate(db, () => true);
    const add = (id: string, email: string | null) =>
      db.prepare('INSERT INTO users (id, username, username_lower, created_at, email, email_lower) VALUES (?, ?, ?, 1, ?, ?)').run(id, id, id, email, email?.toLowerCase() ?? null);
    add('a', null);
    add('b', null);
    add('c', 'sam@example.com');
    expect(() => add('d', 'SAM@example.com')).toThrow(/UNIQUE/);
  });
});
