/**
 * The Leafly button: a saved link is opened as typed (adding https:// if it has
 * no http(s) scheme — so a typed `javascript:` link can never run); otherwise a
 * search for the product name. Never guesses a URL.
 */
export function leaflyTarget(savedLink: string | null, productName: string): { label: string; url: string } {
  const link = savedLink?.trim();
  if (link) {
    return { label: 'View on Leafly', url: /^https?:\/\//i.test(link) ? link : `https://${link}` };
  }
  return { label: 'Search Leafly', url: `https://www.leafly.com/search?q=${encodeURIComponent(productName)}` };
}
