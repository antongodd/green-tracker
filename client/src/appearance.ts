// Your appearance settings (D48): saved to your account, a choice at a time.
import type { Appearance } from '../../shared/domain/gems';
import { api } from './api';

export const saveAppearance = (a: Appearance) => api<{ appearance: Appearance }>('PUT', '/appearance', a).then((r) => r.appearance);
