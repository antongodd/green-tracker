// Posts, comments and fires (D77). A post is a photo and a caption, usually about one of your
// products or Log entries, seen only by you and your approved followers. This file defines what a
// post looks like on the way out (field by field, like SharedProduct) and the limits on the way in.

import type { Preset } from './gems';
import type { ProductTypeKey, StrainTypeKey } from './productTypes';

export const CAPTION_MAX = 500;
export const COMMENT_MAX = 300;
/** Posts per page of the Feed or a person's Posts. */
export const POSTS_PAGE = 20;
/** Comments shown under a post in a list (the rest are on its page). */
export const PREVIEW_COMMENTS = 2;
/** D78: photos in one post. */
export const POST_PHOTOS_MAX = 10;

/**
 * The card under a post's photo.
 * - `product`: one of the poster's products that followers may see now: name, type, strain, score
 *   in the poster's colours (`preset`), Source and Country only if their Privacy shares them (D45).
 * - `log`: one of their Log entries: only its name and type.
 * - `plain`: the product is no longer visible (Private, archived, returned to the Log, the board
 *   hidden, or deleted), or the entry has gone: the name and type as posted, and it doesn't open.
 * Never prices, purchases, amounts, suppliers, dates or notes.
 */
export interface PostAbout {
  kind: 'product' | 'log' | 'plain';
  name: string;
  productType: ProductTypeKey | null;
  productTypeOther: string | null;
  strainType: StrainTypeKey | null;
  /** Overall, out of 10 (product cards only). */
  score: number | null;
  /** The poster's Leaderboard colours (product cards only). */
  preset: Preset | null;
  source: string | null;
  country: string | null;
  countryOther: string | null;
  /** Where tapping the card goes, or null: it doesn't open. */
  href: string | null;
  /**
   * D78: the product's cover, when you may see it (yours, or their Privacy shares photos); otherwise null and the
   * card shows the type's icon. Never a Log entry's photo (the Log is never shared).
   */
  photo: { id: string; version: string; cutout: boolean } | null;
}

export interface PostComment {
  id: string;
  username: string;
  /** Their profile photo version, only where the photo rule (D23) allows. */
  photo?: string;
  body: string;
  createdAt: number;
  /** You may delete it: it's yours, or it's on your post. */
  canDelete: boolean;
}

export interface Post {
  id: string;
  username: string;
  photo?: string;
  mine: boolean;
  caption: string;
  createdAt: number;
  editedAt: number | null;
  /** The post's first photo: its version (for the address) and whether it's a cut-out (D26). */
  image: { version: string; cutout: boolean };
  /** D78: every photo, in order (the first is `image`). */
  photos: { version: string; cutout: boolean }[];
  about: PostAbout | null;
  fires: number;
  youFired: boolean;
  commentCount: number;
  /** In a list: the first two; on the post's page: every one, oldest first. */
  comments: PostComment[];
}

/** Every key a Post may have — the allow-list the tests check raw replies against. */
export const POST_KEYS: readonly (keyof Post)[] = ['id', 'username', 'photo', 'mine', 'caption', 'createdAt', 'editedAt', 'image', 'photos', 'about', 'fires', 'youFired', 'commentCount', 'comments'];
export const POST_ABOUT_KEYS: readonly (keyof PostAbout)[] = ['kind', 'name', 'productType', 'productTypeOther', 'strainType', 'score', 'preset', 'source', 'country', 'countryOther', 'href', 'photo'];

export type PostPhotoInput = { fromPhotoId: string } | { upload: string };
export type PostAboutInput = { product: string } | { logEntry: string } | null;

export interface PostInput {
  caption: string;
  about: PostAboutInput;
  /** D78: one to ten, in order. */
  photos: PostPhotoInput[];
  /** Pressed "Make visible and post" on a Private product. */
  makeVisible: boolean;
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** Line breaks are kept; spaces and blank lines at either end are not. */
export const tidyText = (s: string): string => s.replace(/\r\n?/g, '\n').trim();

export function validateCaption(raw: unknown): Result<string> {
  if (raw === undefined || raw === null) return { ok: true, value: '' };
  if (typeof raw !== 'string') return { ok: false, message: 'The caption couldn’t be read.' };
  const v = tidyText(raw);
  if ([...v].length > CAPTION_MAX) return { ok: false, message: `A caption can be up to ${CAPTION_MAX} characters.` };
  return { ok: true, value: v };
}

export function validateComment(raw: unknown): Result<string> {
  if (typeof raw !== 'string') return { ok: false, message: 'The comment couldn’t be read.' };
  const v = tidyText(raw);
  if (!v) return { ok: false, message: 'Write something first.' };
  if ([...v].length > COMMENT_MAX) return { ok: false, message: `A comment can be up to ${COMMENT_MAX} characters.` };
  return { ok: true, value: v };
}

const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

export function validatePostInput(raw: unknown): Result<PostInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, message: 'The post couldn’t be read.' };
  const r = raw as Record<string, unknown>;
  const caption = validateCaption(r.caption);
  if (!caption.ok) return caption;
  let about: PostAboutInput = null;
  const a = r.about as Record<string, unknown> | null | undefined;
  if (a !== null && a !== undefined) {
    if (typeof a !== 'object') return { ok: false, message: 'What the post is about couldn’t be read.' };
    if (id(a.product) && a.logEntry === undefined) about = { product: a.product };
    else if (id(a.logEntry) && a.product === undefined) about = { logEntry: a.logEntry };
    else return { ok: false, message: 'What the post is about couldn’t be read.' };
  }
  // D78: `photos`, one to ten (`photo`, a single one, as before D78).
  const list = Array.isArray(r.photos) ? (r.photos as unknown[]) : r.photo !== undefined ? [r.photo] : [];
  if (!list.length) return { ok: false, message: 'Add a photo to post.' };
  if (list.length > POST_PHOTOS_MAX) return { ok: false, message: `A post can have up to ${POST_PHOTOS_MAX} photos.` };
  const photos: PostPhotoInput[] = [];
  for (const raw of list) {
    const ph = raw as Record<string, unknown> | null;
    if (ph && typeof ph === 'object' && id(ph.fromPhotoId) && ph.upload === undefined) photos.push({ fromPhotoId: ph.fromPhotoId });
    else if (ph && typeof ph === 'object' && id(ph.upload) && ph.fromPhotoId === undefined) photos.push({ upload: ph.upload });
    else return { ok: false, message: 'A photo couldn’t be read.' };
  }
  const keys = photos.map((x) => ('upload' in x ? `u:${x.upload}` : `p:${x.fromPhotoId}`));
  if (new Set(keys).size !== keys.length) return { ok: false, message: 'A photo was listed twice.' };
  return { ok: true, value: { caption: caption.value, about, photos, makeVisible: r.makeVisible === true } };
}

/** A post's photo (the `n`th, D78), through the access check (D77); never a public address. */
export const postPhotoUrl = (post: { id: string; image: { version: string }; photos?: { version: string }[] }, variant: 'cropped' | 'thumb', n = 0) =>
  `/api/posts/${encodeURIComponent(post.id)}/photos/${n}/${variant}?v=${encodeURIComponent(post.photos?.[n]?.version ?? post.image.version)}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * When something was posted, the way the Feed says it: "Now", "5m", "2h", "Yesterday", then a date
 * ("28 Oct", with the year when it isn't this year). Days are the device's calendar days.
 */
export function timeLabel(ms: number, now: number = Date.now()): string {
  const ago = now - ms;
  if (ago < 60_000) return 'Now';
  if (ago < 3_600_000) return `${Math.floor(ago / 60_000)}m`;
  const then = new Date(ms);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfToday) return `${Math.floor(ago / 3_600_000)}h`;
  const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
  if (ms >= startOfYesterday) return 'Yesterday';
  const date = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === today.getFullYear() ? date : `${date} ${then.getFullYear()}`;
}

/** The Feed's paging cursor: the last post's time and id. */
export const cursorOf = (p: { createdAt: number; id: string }) => `${p.createdAt}_${p.id}`;
export function parseCursor(raw: string | undefined | null): { t: number; id: string } | null {
  if (!raw) return null;
  const m = /^(\d{1,16})_([A-Za-z0-9_-]{1,64})$/.exec(raw);
  return m ? { t: Number(m[1]), id: m[2]! } : null;
}
