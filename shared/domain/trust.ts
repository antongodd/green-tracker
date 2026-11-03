// Trust basics for strangers (D84): reports, the 18+ tick, the photo limit and the contact address.

/** The address on the privacy page, the house rules, Settings and the website. */
export const CONTACT_EMAIL = 'help@example.com';

/** Most photos an account can have: product, Log and post photos together. The database checks it too (migration 0021). */
export const PHOTO_LIMIT = 3000;
/** From here the editors say how many are left. */
export const PHOTO_WARN = 2900;
export const PHOTO_LIMIT_TEXT = `You’ve reached ${PHOTO_LIMIT.toLocaleString('en-GB')} photos, the most an account can have. Delete a few you don’t need to add more.`;

export type ReportKind = 'post' | 'comment' | 'person';
export const REPORT_KINDS: readonly ReportKind[] = ['post', 'comment', 'person'];

/** The reasons, in the order the report sheet lists them. */
export const REPORT_REASONS = [
  { key: 'supply', label: 'Selling or offering to supply' },
  { key: 'personal', label: 'Phone number, address or other personal details' },
  { key: 'face', label: 'Someone’s face without their OK' },
  { key: 'under18', label: 'Looks under 18' },
  { key: 'abuse', label: 'Threats, hate or harassment' },
  { key: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['key'];
export const isReportReason = (x: unknown): x is ReportReason => REPORT_REASONS.some((r) => r.key === x);

/** Pending uploads an account may hold at once (swept after a day), so storage can't fill before a Save is refused. */
export const UPLOADS_PENDING_LIMIT = PHOTO_LIMIT;
