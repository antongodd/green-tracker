// Client access to your products, with a small in-memory cache so going back
// to a list or profile draws instantly while the fresh copy loads.
import type { Product, ProductInput } from '../../shared/domain/product';
import { api } from './api';

const byId = new Map<string, Product>();
let list: Product[] | null = null;

function remember(p: Product): Product {
  byId.set(p.id, p);
  if (list) {
    const i = list.findIndex((x) => x.id === p.id);
    if (p.archived) {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) list[i] = p;
    else list.push(p);
  }
  return p;
}

export const cachedProducts = (): Product[] | null => list;
export const cachedProduct = (id: string): Product | undefined => byId.get(id);

export async function fetchProducts(): Promise<Product[]> {
  const r = await api<{ products: Product[] }>('GET', '/products');
  r.products.forEach((p) => byId.set(p.id, p));
  list = r.products;
  return list;
}

export async function fetchArchived(): Promise<Product[]> {
  const r = await api<{ products: Product[] }>('GET', '/products?archived=1');
  r.products.forEach((p) => byId.set(p.id, p));
  return r.products;
}

export async function fetchProduct(id: string): Promise<Product> {
  return remember((await api<{ product: Product }>('GET', `/products/${encodeURIComponent(id)}`)).product);
}

export async function saveProduct(id: string | null, input: ProductInput): Promise<Product> {
  const r = id ? await api<{ product: Product }>('PUT', `/products/${encodeURIComponent(id)}`, input) : await api<{ product: Product }>('POST', '/products', input);
  return remember(r.product);
}

export async function setFlag(id: string, flag: 'private' | 'archived', value: boolean): Promise<Product> {
  return remember((await api<{ product: Product }>('POST', `/products/${encodeURIComponent(id)}/${flag}`, { value })).product);
}

/** Forget everything (sign-out), so the next account never sees this one's data. */
export function clearProductCache(): void {
  byId.clear();
  list = null;
}
