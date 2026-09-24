// Picklist options shared by the product and log entry editors, all derived
// from the one type definition. (Country has its own picker: CountryPicker.tsx.)
import { CONCENTRATE_SUBTYPES, PRODUCT_TYPES, STRAIN_TYPES } from '../../../shared/domain/productTypes';

export const TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({ value: t.key, label: t.label }));
export const CONCENTRATE_OPTIONS = CONCENTRATE_SUBTYPES.map((s) => ({ value: s.key, label: s.label }));
export const STRAIN_OPTIONS = [{ value: '', label: 'Not set' }, ...STRAIN_TYPES.map((s) => ({ value: s.key, label: s.label }))];
