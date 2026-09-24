// Country picklist, approved by the owner (D9).
// Stored as an ISO 3166-1 alpha-2 code, or OTHER_COUNTRY with free text
// (the same "Other" pattern as product type and concentrate type).

export const OTHER_COUNTRY = 'OTHER';

export const COUNTRIES: readonly { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

const NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));

/** Flag emoji from an ISO code via regional indicator symbols. */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export interface CountryDisplay {
  /** Stable identity for grouping/deduping (case-insensitive for free text). */
  key: string;
  name: string;
  flag: string | null;
}

/** Resolve a stored country. Other with nothing typed (or an unknown code) means not set → null. */
export function countryDisplay(code: string | null, otherText: string | null): CountryDisplay | null {
  if (!code) return null;
  if (code === OTHER_COUNTRY) {
    const text = otherText?.trim();
    return text ? { key: `other:${text.toLowerCase()}`, name: text, flag: null } : null;
  }
  const name = NAMES.get(code);
  return name ? { key: code, name, flag: flagEmoji(code) } : null;
}

/**
 * Search-only nicknames for the country picker (D16). Never shown or stored:
 * they only help find a country ("uk" → United Kingdom).
 */
export const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  GB: ['UK', 'Britain', 'Great Britain', 'GB', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  US: ['USA', 'US', 'America', 'United States of America'],
  NL: ['Holland'],
  CZ: ['Czech Republic'],
  SZ: ['Swaziland'],
  MK: ['Macedonia'],
  KR: ['Korea'],
  TR: ['Türkiye'],
};

/** Lower-case, accents removed, runs of spaces/punctuation collapsed to one space. */
export function normaliseSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** True when `q` (normalised) starts at the beginning of any word of `text` (normalised). */
const startsAWord = (text: string, q: string) => ` ${text}`.includes(` ${q}`);

/**
 * Countries matching a search, best first (D16). A match is the query starting
 * any word of the name or of a nickname; capitals and accents are ignored.
 * Order: a nickname typed in full (UK), then names starting with the query,
 * then nicknames starting with it, then any other word start — A–Z within each.
 * An empty query returns every country, A–Z.
 */
export function searchCountries(query: string): { code: string; name: string }[] {
  const q = normaliseSearch(query);
  if (!q) return [...COUNTRIES];
  const ranked: { c: { code: string; name: string }; rank: number }[] = [];
  for (const c of COUNTRIES) {
    const name = normaliseSearch(c.name);
    const aliases = (COUNTRY_ALIASES[c.code] ?? []).map(normaliseSearch);
    let rank = -1;
    if (aliases.includes(q)) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (aliases.some((a) => a.startsWith(q))) rank = 2;
    else if (startsAWord(name, q) || aliases.some((a) => startsAWord(a, q))) rank = 3;
    if (rank >= 0) ranked.push({ c, rank });
  }
  // COUNTRIES is A–Z already and sort is stable, so ranking alone keeps A–Z within a rank.
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.c);
}

/**
 * The picker's "Used" section (D16): listed countries on the given records, most
 * used first, then A–Z; at most `limit`. Other (free text) and unknown codes are left out.
 */
export function usedCountries(codes: readonly (string | null)[], limit = 5): { code: string; name: string }[] {
  const counts = new Map<string, number>();
  for (const code of codes) if (code && NAMES.has(code)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || NAMES.get(a[0])!.localeCompare(NAMES.get(b[0])!))
    .slice(0, limit)
    .map(([code]) => ({ code, name: NAMES.get(code)! }));
}
