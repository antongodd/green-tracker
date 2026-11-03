// Picklist options shared by the product and log entry editors, all derived
// from the one type definition. (Country has its own picker: CountryPicker.tsx.)
import { CONCENTRATE_SUBTYPES, PRODUCT_TYPES, STRAIN_TYPES } from '../../../shared/domain/productTypes';

export const TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({ value: t.key, label: t.label }));
export const CONCENTRATE_OPTIONS = CONCENTRATE_SUBTYPES.map((s) => ({ value: s.key, label: s.label }));
/** D81: Strain type as one-tap chips; none chosen is Not set. */
export const STRAIN_CHOICES = STRAIN_TYPES.map((s) => ({ value: s.key, label: s.label }));
/**
 * D81: Type as one-tap chips, in the mocked-up order. "Not set" is offered only to a product that
 * already has it (from before, or Restore), so it can be kept; nobody picks it new.
 */
const CHIP_ORDER = ['flower', 'pre_roll', 'concentrate', 'edibles', 'other'];
export const typeChoices = (current: string) =>
  [...CHIP_ORDER, ...(CHIP_ORDER.includes(current) ? [] : ['not_set'])].map((key) => TYPE_OPTIONS.find((o) => o.value === key)!).filter(Boolean);
