// "Returning lands where you were" (brief §10.1): coming back from a product to a
// list scrolls to the row that was tapped — anchored to the record, not a pixel
// offset or index, since the product may have moved rank. Transient: kept in
// memory only, so tab switches and app launches start at the top.

let pending: { list: string; id: string; screenTop: number } | null = null;

/** Top of an element in document coordinates, from layout offsets (not transformed rects). */
function docTop(el: HTMLElement): number {
  let y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
  return y;
}

/** The row a product page was opened from, if any (for the Back animation, D20). */
export const pendingReturn = (): { list: string; id: string } | null => (pending ? { list: pending.list, id: pending.id } : null);

export function rememberRow(list: string, id: string, el: HTMLElement): void {
  pending = { list, id, screenTop: docTop(el) - window.scrollY };
}

/**
 * Call once a list has rendered. If we came back from that row's product, put the
 * row at roughly its previous screen position — or leave the page alone if the row
 * is already fully visible at the top. A row that's gone (archived, filtered out)
 * leaves the page at the top.
 */
export function restoreRow(list: string, cameFromProduct: boolean): void {
  const p = pending;
  pending = null;
  if (!p || p.list !== list || !cameFromProduct) return;
  const el = document.querySelector<HTMLElement>(`[data-return="${CSS.escape(`${list}:${p.id}`)}"]`);
  if (!el) return;
  const top = docTop(el);
  const header = document.querySelector<HTMLElement>('.hdr')?.offsetHeight ?? 0;
  const controls = document.querySelector<HTMLElement>('.controls')?.offsetHeight ?? 0;
  const nav = document.querySelector<HTMLElement>('.nav')?.offsetHeight ?? 0;
  const visibleAtTop = top >= header + controls && top + el.offsetHeight <= window.innerHeight - nav;
  if (visibleAtTop) return;
  window.scrollTo(0, Math.max(0, top - p.screenTop));
}
