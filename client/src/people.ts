// Client calls for People (brief §5). Usernames go into URLs encoded.
import { tourDone } from './tour';
import type { PersonCard, SharedProduct } from '../../shared/domain/social';
import type { Appearance } from '../../shared/domain/gems';
import type { Comparison, YourScore } from '../../shared/domain/compare';
import type { StrainsAgainst } from '../../shared/domain/strains';
import type { ReportReason } from '../../shared/domain/trust';
import { api } from './api';
import { rememberTheirLook } from './theirLook';

const u = (username: string) => `/people/u/${encodeURIComponent(username)}`;

export const searchPeople = (q: string) => api<{ people: PersonCard[] }>('GET', `/people/search?q=${encodeURIComponent(q)}`).then((r) => r.people);
/** Incoming requests, newest first, each with the requester's photo version when they have one (D23). */
export const incomingRequests = () =>
  api<{ people: string[]; photos?: Record<string, string> }>('GET', '/people/requests').then((r) => r.people.map((username) => ({ username, photo: r.photos?.[username] })));
export const followers = () => api<{ people: PersonCard[] }>('GET', '/people/followers').then((r) => r.people);
export const following = () => api<{ people: PersonCard[] }>('GET', '/people/following').then((r) => r.people);
export const blocked = () => api<{ people: string[] }>('GET', '/people/blocked').then((r) => r.people);

export const person = (username: string) => api<{ person: PersonCard }>('GET', u(username)).then((r) => r.person);
export const follow = (username: string) =>
  api<{ person: PersonCard }>('POST', `${u(username)}/follow`).then((r) => {
    tourDone('friend'); // D97: asking to follow someone is the Find a friend step
    return r.person;
  });
/** Cancels a request or unfollows. */
export const unfollow = (username: string) => api<{ person: PersonCard }>('DELETE', `${u(username)}/follow`).then((r) => r.person);
export const block = (username: string) => api('POST', `${u(username)}/block`);
/** D84: report a person; `block` blocks them too. Neither is ever told. */
export const report = (username: string, reason: ReportReason, block: boolean) => api<{ person: PersonCard }>('POST', `${u(username)}/report`, { reason, block }).then((r) => r.person);
export const unblock = (username: string) => api('DELETE', `${u(username)}/block`);
export const approve = (username: string) => api('POST', `/people/requests/${encodeURIComponent(username)}/approve`);
export const decline = (username: string) => api('POST', `/people/requests/${encodeURIComponent(username)}/decline`);
export const removeFollower = (username: string) => api('DELETE', `/people/followers/${encodeURIComponent(username)}`);

/** Their board: what they share (D45); their appearance comes with it (D74) and is kept in theirLook.ts. */
export const theirBoard = (username: string) =>
  api<{ products: SharedProduct[]; appearance?: Appearance }>('GET', `${u(username)}/products`).then((r) => {
    rememberTheirLook(username, r.appearance);
    return { products: r.products };
  });
/** One of their products, with `yours` (D82): your own score when you've had the same product. */
export const theirProduct = (username: string, id: string) =>
  api<{ person: PersonCard; product: SharedProduct; appearance?: Appearance; yours: YourScore | null }>('GET', `${u(username)}/products/${encodeURIComponent(id)}`).then((r) => {
    rememberTheirLook(username, r.appearance);
    return { person: r.person, product: r.product, yours: r.yours ?? null };
  });
/** Compare boards (D82): your board against what they share with you. */
export const compareWith = (username: string) =>
  api<{ person: PersonCard; appearance?: Appearance; comparison: Comparison }>('GET', `${u(username)}/compare`).then((r) => {
    rememberTheirLook(username, r.appearance);
    return { person: r.person, comparison: r.comparison };
  });

// Friends on Strainz (D94) ----------------------------------------------------------------------------------------

/** A friend's product of a strain, from what they share with you. */
export interface StrainFriend {
  person: PersonCard;
  productId: string;
  score: number | null;
  kind: string;
  source: string | null;
}
/** Friends who've tried a strain (D94), best first. */
export const strainFriends = (name: string) => api<{ friends: StrainFriend[] }>('GET', `/people/strain-friends?name=${encodeURIComponent(name)}`).then((r) => r.friends);

/** Their Want to try lists, names only (D94), when they've switched them on; `tried` when you've had it. */
export type TheirWant = { kind: 'strain' | 'source'; name: string; tried: boolean };
/** Their Strainz page (D94): your strains against theirs, and their Want to try lists (or null). */
export const theirStrainz = (username: string) =>
  api<{ person: PersonCard; appearance?: Appearance; comparison: StrainsAgainst; wants: TheirWant[] | null }>('GET', `${u(username)}/strainz`).then((r) => {
    rememberTheirLook(username, r.appearance);
    return { person: r.person, comparison: r.comparison, wants: r.wants };
  });
