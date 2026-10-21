// Your privacy settings (D45): read, and saved a switch at a time.
import type { Privacy } from '../../shared/domain/privacy';
import type { SharedProduct } from '../../shared/domain/social';
import { api } from './api';

// The last settings seen, so Settings shows its "What followers see" line at once when you come
// back to it: loaded late, the line pushed the screen down after it had landed where you were (0.54.0).
let cached: Privacy | null = null;
const keep = (p: Privacy) => (cached = p);
export const cachedPrivacy = () => cached;
export const clearPrivacyCache = () => void (cached = null);
export const fetchPrivacy = () => api<{ privacy: Privacy }>('GET', '/privacy').then((r) => keep(r.privacy));
export const savePrivacy = (p: Privacy) => api<{ privacy: Privacy }>('PUT', '/privacy', p).then((r) => keep(r.privacy));
/** Your own board exactly as followers get it now (the server builds both the same way). */
export const fetchPreview = () => api<{ products: SharedProduct[]; shared: boolean }>('GET', '/privacy/preview');
