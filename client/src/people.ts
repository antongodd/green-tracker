// Client calls for People (brief §5). Usernames go into URLs encoded.
import type { PersonCard, SharedProduct } from '../../shared/domain/social';
import { api } from './api';

const u = (username: string) => `/people/u/${encodeURIComponent(username)}`;

export const searchPeople = (q: string) => api<{ people: PersonCard[] }>('GET', `/people/search?q=${encodeURIComponent(q)}`).then((r) => r.people);
export const incomingRequests = () => api<{ people: string[] }>('GET', '/people/requests').then((r) => r.people);
export const followers = () => api<{ people: PersonCard[] }>('GET', '/people/followers').then((r) => r.people);
export const following = () => api<{ people: PersonCard[] }>('GET', '/people/following').then((r) => r.people);
export const blocked = () => api<{ people: string[] }>('GET', '/people/blocked').then((r) => r.people);

export const person = (username: string) => api<{ person: PersonCard }>('GET', u(username)).then((r) => r.person);
export const follow = (username: string) => api<{ person: PersonCard }>('POST', `${u(username)}/follow`).then((r) => r.person);
/** Cancels a request or unfollows. */
export const unfollow = (username: string) => api<{ person: PersonCard }>('DELETE', `${u(username)}/follow`).then((r) => r.person);
export const block = (username: string) => api('POST', `${u(username)}/block`);
export const unblock = (username: string) => api('DELETE', `${u(username)}/block`);
export const approve = (username: string) => api('POST', `/people/requests/${encodeURIComponent(username)}/approve`);
export const decline = (username: string) => api('POST', `/people/requests/${encodeURIComponent(username)}/decline`);
export const removeFollower = (username: string) => api('DELETE', `/people/followers/${encodeURIComponent(username)}`);

export const theirProducts = (username: string) => api<{ products: SharedProduct[] }>('GET', `${u(username)}/products`).then((r) => r.products);
export const theirProduct = (username: string, id: string) => api<{ product: SharedProduct }>('GET', `${u(username)}/products/${encodeURIComponent(id)}`).then((r) => r.product);
