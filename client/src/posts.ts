// Client calls for posts, comments and fires (D77).
import type { Post, PostInput } from '../../shared/domain/posts';
import { api } from './api';

export type Page = { posts: Post[]; next: string | null };
const q = (before?: string | null) => (before ? `?before=${encodeURIComponent(before)}` : '');
const one = (id: string) => `/posts/${encodeURIComponent(id)}`;

/** The Feed: yours and everyone you follow. The first page also marks it seen. */
export const feedPage = (before?: string | null) => api<Page>('GET', `/posts/feed${q(before)}`);
/** One person's posts (yours too). */
export const postsBy = (username: string, before?: string | null) => api<Page>('GET', `/posts/by/${encodeURIComponent(username)}${q(before)}`);
export const fetchPost = (id: string) => api<{ post: Post }>('GET', one(id)).then((r) => r.post);
export const createPost = (input: Omit<PostInput, 'makeVisible'> & { makeVisible?: boolean }) => api<{ post: Post }>('POST', '/posts', input).then((r) => r.post);
export const editCaption = (id: string, caption: string) => api<{ post: Post }>('PUT', one(id), { caption }).then((r) => r.post);
export const deletePost = (id: string) => api('DELETE', one(id));
export const addComment = (id: string, body: string) => api<{ post: Post }>('POST', `${one(id)}/comments`, { body }).then((r) => r.post);
export const deleteComment = (id: string, cid: string) => api<{ post: Post }>('DELETE', `${one(id)}/comments/${encodeURIComponent(cid)}`).then((r) => r.post);
export const setFire = (id: string, on: boolean) => api<{ fires: number; youFired: boolean }>(on ? 'PUT' : 'DELETE', `${one(id)}/fire`);
export const firers = (id: string) => api<{ people: { username: string; photo?: string }[] }>('GET', `${one(id)}/fires`).then((r) => r.people);

/** Your own posts with what they're about by id, for Export. */
export interface OwnPost {
  id: string;
  productId: string | null;
  logEntryId: string | null;
  aboutName: { name: string; productType: string | null; productTypeOther: string | null; strainType: string | null } | null;
  caption: string;
  image: { version: string; cutout: boolean };
  createdAt: number;
  editedAt: number | null;
}
export const ownPosts = () => api<{ posts: OwnPost[] }>('GET', '/posts/mine').then((r) => r.posts);

/**
 * The Feed's list, kept while you open a post and come back (so it returns where you were, scrollReturn),
 * and updated in place when you give a fire or comment on a post's page.
 */
let kept: Page | null = null;
export const keptFeed = (): Page | null => kept;
export const keepFeed = (p: Page | null): void => {
  kept = p;
};
/** A post changed on its own page (fire, comment, caption): the kept Feed shows the same. */
export function patchKept(post: Pick<Post, 'id'> & Partial<Post>): void {
  if (!kept) return;
  kept = { ...kept, posts: kept.posts.map((x) => (x.id === post.id ? { ...x, ...post, comments: post.comments ? post.comments.slice(0, 2) : x.comments } : x)) };
}
export function dropKept(id: string): void {
  if (kept) kept = { ...kept, posts: kept.posts.filter((x) => x.id !== id) };
}
