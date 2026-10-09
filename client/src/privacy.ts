// Your privacy settings (D45): read, and saved a switch at a time.
import type { Privacy } from '../../shared/domain/privacy';
import type { SharedBoardOptions, SharedProduct } from '../../shared/domain/social';
import { api } from './api';

export const fetchPrivacy = () => api<{ privacy: Privacy }>('GET', '/privacy').then((r) => r.privacy);
export const savePrivacy = (p: Privacy) => api<{ privacy: Privacy }>('PUT', '/privacy', p).then((r) => r.privacy);
/** Your own board exactly as followers get it now (the server builds both the same way). */
export const fetchPreview = () => api<{ products: SharedProduct[]; options: SharedBoardOptions; shared: boolean }>('GET', '/privacy/preview');
