import { describe, expect, it } from 'vitest';
import { checkExportFile, EXPORT_FORMAT, validateRestore } from '../../shared/domain/backup';
import { clampFrame, frameFromCrop, frameSide, frameToCrop, initialFrame, maxZoom } from '../../shared/domain/profilePhoto';

// D23: framing a profile photo (move and zoom under a circle) → a square crop.

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('Move and zoom geometry (D23)', () => {
  it('a new photo starts centred with the short edge filling the circle', () => {
    const c = frameToCrop(1600, 1200, initialFrame(1600, 1200));
    close(c.w * 1600, 1200);
    close(c.h * 1200, 1200);
    close(c.x, 200 / 1600);
    close(c.y, 0);
    expect(c.square).toBe(true);
  });

  it('every crop is square in pixels and inside the photo, however far it is dragged or zoomed', () => {
    for (const [w, h] of [[1600, 1200], [900, 1600], [500, 500], [120, 4000]] as const) {
      for (const f of [initialFrame(w, h), { cx: -1e6, cy: 1e6, zoom: 3 }, { cx: w, cy: 0, zoom: 99 }, { cx: NaN, cy: NaN, zoom: NaN }, { cx: w / 3, cy: h / 3, zoom: 0.2 }]) {
        const c = frameToCrop(w, h, f);
        close(c.w * w, c.h * h);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('zoom runs from 1 to 5×, stopping early on a small photo (the crop keeps at least 80px)', () => {
    expect(maxZoom(1600, 1200)).toBe(5);
    expect(maxZoom(200, 300)).toBe(2.5);
    expect(maxZoom(60, 60)).toBe(1);
    expect(clampFrame(1600, 1200, { cx: 800, cy: 600, zoom: 12 }).zoom).toBe(5);
    expect(clampFrame(1600, 1200, { cx: 800, cy: 600, zoom: 0.5 }).zoom).toBe(1);
    expect(frameSide(1600, 1200, 5)).toBe(240);
  });

  it('a saved crop reopens exactly where it was left', () => {
    const f = { cx: 1000, cy: 500, zoom: 2.5 };
    const again = frameFromCrop(1600, 1200, frameToCrop(1600, 1200, f));
    close(again.cx, f.cx);
    close(again.cy, f.cy);
    close(again.zoom, f.zoom);
    expect(frameFromCrop(1600, 1200, null)).toEqual(initialFrame(1600, 1200));
  });
});

describe('Export files and the profile photo (D23)', () => {
  const file = (extra: object) => ({ format: EXPORT_FORMAT, version: 1, exportedAt: '2026-09-25T00:00:00Z', appVersion: '0.17.0', username: 'a', products: [], logEntries: [], ...extra });
  const photo = { crop: { x: 0, y: 0, w: 1, h: 1, square: true }, original: 'AAAA', cropped: 'BBBB' };

  it('accepts a file with a photo, with none (null) and from before 0.17.0 (absent)', () => {
    expect(checkExportFile(file({ profilePhoto: photo })).ok).toBe(true);
    expect(checkExportFile(file({ profilePhoto: null })).ok).toBe(true);
    expect(checkExportFile(file({})).ok).toBe(true);
  });

  it('refuses an unreadable profile photo', () => {
    expect(checkExportFile(file({ profilePhoto: { ...photo, original: '' } })).ok).toBe(false);
    expect(checkExportFile(file({ profilePhoto: { ...photo, crop: null } })).ok).toBe(false);
    expect(checkExportFile(file({ profilePhoto: 'photo' })).ok).toBe(false);
  });

  it('a restore keeps absent (leave it), null (remove it) and an upload apart', () => {
    const base = { products: [], logEntries: [] };
    const absent = validateRestore(base);
    expect(absent.ok && !('profilePhoto' in absent.value)).toBe(true);
    const none = validateRestore({ ...base, profilePhoto: null });
    expect(none.ok && none.value.profilePhoto).toBe(null);
    const set = validateRestore({ ...base, profilePhoto: { upload: 'u1', crop: photo.crop } });
    expect(set.ok && set.value.profilePhoto).toEqual({ upload: 'u1', crop: photo.crop });
    expect(validateRestore({ ...base, profilePhoto: { upload: 'u1', crop: null } }).ok).toBe(false);
    expect(validateRestore({ ...base, profilePhoto: { upload: '', crop: photo.crop } }).ok).toBe(false);
  });
});
