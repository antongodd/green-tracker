// "Add to leaderboard" hands the log entry's live form (unsaved edits included)
// to the product editor. Nothing is committed until the product is saved.
import type { ProductInput } from '../../shared/domain/product';
import type { PhotoDraft } from './components/EditorPhotos';

export interface Promotion {
  entryId: string;
  input: ProductInput;
  /** The entry's photo draft, pending uploads included; the product editor now owns them. */
  drafts: PhotoDraft[];
}

let current: Promotion | null = null;

export const startPromotion = (p: Promotion): void => {
  current = p;
};
/** Taken once by the product editor (a reload of the promote screen finds nothing). */
export function takePromotion(entryId: string): Promotion | null {
  const p = current?.entryId === entryId ? current : null;
  current = null;
  return p;
}
