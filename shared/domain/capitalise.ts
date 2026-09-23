/**
 * Auto-capitalisation for product name, log entry name, Source and supplier.
 * Applied on blur. Only ever ADDS capitals: uppercases the first character of
 * each whitespace-separated word and leaves everything else exactly as typed.
 * Trims leading/trailing whitespace. A first character whose uppercase form is
 * not a single character (e.g. ß → SS) is left alone rather than rewritten.
 */
export function autoCapitalise(value: string): string {
  return value.trim().replace(/(^|\s)(\S)/gu, (_, space: string, ch: string) => {
    const upper = ch.toUpperCase();
    return space + ([...upper].length === 1 ? upper : ch);
  });
}
