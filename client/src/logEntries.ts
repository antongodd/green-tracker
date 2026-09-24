// Client access to loose Log entries, with an in-memory cache like products.ts.
import type { LogEntry, LogEntryInput } from '../../shared/domain/logEntry';
import type { Product, ProductInput } from '../../shared/domain/product';
import { api } from './api';
import { cacheProduct } from './products';

const byId = new Map<string, LogEntry>();
let list: LogEntry[] | null = null;

function remember(e: LogEntry): LogEntry {
  byId.set(e.id, e);
  if (list) {
    const i = list.findIndex((x) => x.id === e.id);
    if (i >= 0) list[i] = e;
    else list.push(e);
  }
  return e;
}
function forget(id: string): void {
  byId.delete(id);
  if (list) list = list.filter((x) => x.id !== id);
}

export const cachedEntries = (): LogEntry[] | null => list;
export const cachedEntry = (id: string): LogEntry | undefined => byId.get(id);

export async function fetchEntries(): Promise<LogEntry[]> {
  const r = await api<{ entries: LogEntry[] }>('GET', '/log');
  r.entries.forEach((e) => byId.set(e.id, e));
  list = r.entries;
  return list;
}

export async function fetchEntry(id: string): Promise<LogEntry> {
  return remember((await api<{ entry: LogEntry }>('GET', `/log/${encodeURIComponent(id)}`)).entry);
}

export async function saveEntry(id: string | null, input: LogEntryInput): Promise<LogEntry> {
  const r = id ? await api<{ entry: LogEntry }>('PUT', `/log/${encodeURIComponent(id)}`, input) : await api<{ entry: LogEntry }>('POST', '/log', input);
  return remember(r.entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await api('DELETE', `/log/${encodeURIComponent(id)}`);
  forget(id);
}

/** Promotion: one atomic call creates the product and removes the entry. */
export async function promoteEntry(id: string, input: ProductInput): Promise<Product> {
  const r = await api<{ product: Product }>('POST', `/log/${encodeURIComponent(id)}/promote`, input);
  forget(id);
  return cacheProduct(r.product);
}

export function clearEntryCache(): void {
  byId.clear();
  list = null;
}
