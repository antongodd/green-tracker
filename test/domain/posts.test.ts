import { describe, expect, it } from 'vitest';
import { CAPTION_MAX, COMMENT_MAX, cursorOf, newestFirst, parseCursor, timeLabel, validateCaption, validateComment, validatePostInput } from '../../shared/domain/posts';
import { checkExportFile, EXPORT_FORMAT, validateRestore } from '../../shared/domain/backup';

describe('post limits (D77)', () => {
  it('a caption: optional, up to 500 characters, line breaks kept, ends trimmed', () => {
    expect(validateCaption(undefined)).toEqual({ ok: true, value: '' });
    expect(validateCaption('  a\r\nb\n\n ')).toEqual({ ok: true, value: 'a\nb' });
    expect(validateCaption('x'.repeat(CAPTION_MAX)).ok).toBe(true);
    expect(validateCaption('x'.repeat(CAPTION_MAX + 1)).ok).toBe(false);
    // Counted in characters, not UTF-16 units: 500 emoji fit.
    expect(validateCaption('🔥'.repeat(CAPTION_MAX)).ok).toBe(true);
    expect(validateCaption(5).ok).toBe(false);
  });

  it('a comment: something, up to 300 characters', () => {
    expect(validateComment('  hi  ')).toEqual({ ok: true, value: 'hi' });
    expect(validateComment('   ').ok).toBe(false);
    expect(validateComment('x'.repeat(COMMENT_MAX)).ok).toBe(true);
    expect(validateComment('x'.repeat(COMMENT_MAX + 1)).ok).toBe(false);
    expect(validateComment(null).ok).toBe(false);
  });

  it('a post: one photo (one of yours or an upload), about one thing or nothing', () => {
    expect(validatePostInput({ photo: { upload: 'u1' } })).toEqual({ ok: true, value: { caption: '', about: null, photos: [{ upload: 'u1' }], makeVisible: false } });
    // D78: up to ten, in order, none twice.
    expect(validatePostInput({ photos: [{ upload: 'u1' }, { fromPhotoId: 'p1' }] })).toMatchObject({ ok: true, value: { photos: [{ upload: 'u1' }, { fromPhotoId: 'p1' }] } });
    expect(validatePostInput({ photos: Array.from({ length: 10 }, (_, i) => ({ upload: `u${i}` })) }).ok).toBe(true);
    expect(validatePostInput({ photos: Array.from({ length: 11 }, (_, i) => ({ upload: `u${i}` })) }).ok).toBe(false);
    expect(validatePostInput({ photos: [{ upload: 'u1' }, { upload: 'u1' }] }).ok).toBe(false);
    expect(validatePostInput({ photos: [] }).ok).toBe(false);
    expect(validatePostInput({ caption: 'x', about: { product: 'p1' }, photo: { fromPhotoId: 'ph1' }, makeVisible: true }).ok).toBe(true);
    expect(validatePostInput({ about: { logEntry: 'e1' }, photo: { upload: 'u1' } }).ok).toBe(true);
    expect(validatePostInput({ about: null }).ok).toBe(false); // no photo
    expect(validatePostInput({ photo: { upload: 'u1', fromPhotoId: 'p' } }).ok).toBe(false);
    expect(validatePostInput({ about: { product: 'p', logEntry: 'e' }, photo: { upload: 'u1' } }).ok).toBe(false);
    expect(validatePostInput({ about: 'p', photo: { upload: 'u1' } }).ok).toBe(false);
  });
});

describe('time labels', () => {
  const now = new Date(2026, 10, 2, 15, 0).getTime();
  it('Now, minutes, hours today, Yesterday, then a date (with the year when it isn’t this year)', () => {
    expect(timeLabel(now - 20_000, now)).toBe('Now');
    expect(timeLabel(now - 5 * 60_000, now)).toBe('5m');
    expect(timeLabel(now - 2 * 3_600_000, now)).toBe('2h');
    expect(timeLabel(new Date(2026, 10, 2, 0, 30).getTime(), now)).toBe('14h');
    expect(timeLabel(new Date(2026, 10, 1, 23, 50).getTime(), now)).toBe('Yesterday');
    expect(timeLabel(new Date(2026, 10, 1, 0, 5).getTime(), now)).toBe('Yesterday');
    expect(timeLabel(new Date(2026, 9, 28, 12).getTime(), now)).toBe('28 Oct');
    expect(timeLabel(new Date(2025, 11, 31, 12).getTime(), now)).toBe('31 Dec 2025');
  });
  it('just after midnight, a post from late yesterday is Yesterday', () => {
    const early = new Date(2026, 10, 2, 0, 10).getTime();
    expect(timeLabel(new Date(2026, 10, 1, 23, 0).getTime(), early)).toBe('Yesterday');
  });
});

describe('the paging cursor', () => {
  it('round-trips, and anything else is refused', () => {
    expect(parseCursor(cursorOf({ createdAt: 1793632253000, id: 'abc_DEF-1' }))).toEqual({ t: 1793632253000, id: 'abc_DEF-1' });
    expect(parseCursor('nope')).toBeNull();
    expect(parseCursor("1_x' OR 1")).toBeNull();
    expect(parseCursor(undefined)).toBeNull();
  });
});

describe('posts in Export and Restore', () => {
  const file = (posts: unknown) => ({ format: EXPORT_FORMAT, version: 1, products: [], logEntries: [{ name: 'E', createdAt: 1, photo: null }], posts });
  const good = { caption: 'hi', createdAt: 5, editedAt: null, about: { logEntry: 0 }, aboutName: { name: 'E', productType: 'flower', productTypeOther: null, strainType: null }, image: 'AAAA' };
  it('a file’s posts point at things in the same file', () => {
    expect(checkExportFile(file([good])).ok).toBe(true);
    expect(checkExportFile(file(undefined)).ok).toBe(true);
    expect(checkExportFile(file([{ ...good, about: { product: 0 } }])).ok).toBe(false);
    expect(checkExportFile(file([{ ...good, about: { logEntry: 0, product: 0 } }])).ok).toBe(false);
    expect(checkExportFile(file([{ ...good, caption: 'x'.repeat(501) }])).ok).toBe(false);
    expect(checkExportFile(file([{ ...good, image: '' }])).ok).toBe(false);
    expect(checkExportFile(file([{ ...good, photos: [{ image: 'AAAA' }, { image: 'BBBB', cutout: true }] }])).ok).toBe(true);
    expect(checkExportFile(file([{ ...good, photos: [] }])).ok).toBe(false);
  });
  it('a restore’s posts: each its own upload; keptBy only for an entry that keeps a product', () => {
    const base = { products: [], logEntries: [{ name: 'E', productType: 'flower', createdAt: 1, photos: [] }] };
    const p = { caption: '', createdAt: 5, editedAt: null, about: null, aboutName: null, uploads: ['u1'] };
    expect(validateRestore({ ...base, posts: [p] }).ok).toBe(true);
    expect(validateRestore({ ...base, posts: [p, p] }).ok).toBe(false);
    expect(validateRestore({ ...base, posts: [{ ...p, uploads: ['a', 'b', 'c'] }] }).ok).toBe(true);
    expect(validateRestore({ ...base, posts: [{ ...p, uploads: [] }] }).ok).toBe(false);
    expect(validateRestore({ ...base, posts: [{ ...p, about: { keptBy: 0 } }] }).ok).toBe(false);
  });
});

describe('the composer’s lists', () => {
  it('newest first, leaving the original list alone', () => {
    const list = [{ name: 'old', createdAt: 1 }, { name: 'newest', createdAt: 30 }, { name: 'middle', createdAt: 20 }];
    expect(newestFirst(list).map((x) => x.name)).toEqual(['newest', 'middle', 'old']);
    expect(list[0]!.name).toBe('old');
  });
});
