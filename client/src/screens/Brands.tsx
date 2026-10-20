import { useEffect, useState } from 'preact/hooks';
import { formatGBP, formatScore } from '../../../shared/domain/format';
import { leaderboardTiles, rankProducts } from '../../../shared/domain/leaderboard';
import { matchesName, nameKey, nameRoleText, productsNamed, spentAt, usedNames } from '../../../shared/domain/names';
import type { Product } from '../../../shared/domain/product';
import { errorText } from '../api';
import { BackButton, Header, TabBar, type Tab } from '../components/chrome';
import { Tiles } from '../components/Controls';
import { EmptyCard } from '../components/EmptyCard';
import { brandPath } from '../components/NameLink';
import { ProductRow } from '../components/ProductRow';
import { Skeleton } from '../components/Skeleton';
import { ChevronRight } from '../icons';
import { cachedProducts, fetchProducts } from '../products';
import { cameFrom, linkTo } from '../router';

/** Your products (not archived), from the cache at once and fresh from the server. */
function useProducts(): { products: Product[] | null; error: string } {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((e) => setError(errorText(e)));
  }, []);
  return { products, error };
}

/** Brand and/or Bought here, in place of a row's price · Source line. */
export function RoleTags(p: { brand: boolean; shop: boolean }) {
  return (
    <div class="meta roles">
      {p.brand && <span class="role brand">Brand</span>}
      {p.shop && <span class="role shop">Bought here</span>}
    </div>
  );
}

type Sort = 'products' | 'average' | 'az';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'products', label: 'Most products' },
  { key: 'average', label: 'Best average' },
  { key: 'az', label: 'A–Z' },
];

/**
 * More → Brands & suppliers (D59): every name in your products' Source and purchases' Supplier,
 * one list for both, with how many products each has and their average. Archived ones left out.
 */
export function BrandsList() {
  const { products, error } = useProducts();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('products');
  const names = (products ? usedNames(products) : []).map((n) => ({ ...n, average: leaderboardTiles(productsNamed(products!, n.key).map((r) => r.product)).average }));
  const shown = names.filter((n) => matchesName(n.name, query));
  if (sort === 'az') shown.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'average') shown.sort((a, b) => (a.average === b.average ? 0 : a.average === null ? 1 : b.average === null ? -1 : b.average - a.average) || a.name.localeCompare(b.name));
  return (
    <>
      <Header title="Brands & suppliers" left={<BackButton to="/more" />} />
      <main class="screen">
        {!products && !error && <Skeleton kind="board" />}
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && names.length === 0 && (
          <EmptyCard art="filter" title="No brands or suppliers yet">
            <p>Add a Source to a product, or a Supplier to a purchase, and it shows here.</p>
          </EmptyCard>
        )}
        {names.length > 0 && (
          <>
            <div class="wrap brands-top">
              <label for="brand-search" class="visually-hidden">
                Search
              </label>
              <input id="brand-search" class="input" type="text" placeholder="Search" autoComplete="off" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
              <div class="brand-sort" role="group" aria-label="Sort">
                {SORTS.map((s) => (
                  <button type="button" key={s.key} class={`pill${sort === s.key ? ' active' : ''}`} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div class="wrap">
              <div class="list brands">
                {shown.map((n) => (
                  <a class="li link" key={n.key} href={brandPath(n.name)} onClick={linkTo(brandPath(n.name))}>
                    <span class="main">
                      <span class="nm">{n.name}</span>
                      <span class="sub">
                        {n.products} {n.products === 1 ? 'product' : 'products'} · {nameRoleText(n)}
                      </span>
                    </span>
                    <span class="avg">
                      <span class="visually-hidden">Average </span>
                      {n.average === null ? '–' : formatScore(n.average)}
                    </span>
                    <ChevronRight class="chev" />
                  </a>
                ))}
                {shown.length === 0 && <p class="li none">No matching names</p>}
              </div>
            </div>
          </>
        )}
      </main>
      <TabBar active="more" />
    </>
  );
}

/**
 * One brand or supplier (D59): every product with it as its Source or a purchase's Supplier,
 * together, best first, tagged Brand / Bought here; tiles for products, average and what you
 * spent there. Archived products are left out.
 */
export function BrandPage(p: { name: string }) {
  const key = nameKey(p.name);
  const { products, error } = useProducts();
  // Opened from More's list it belongs to More; from a product page, to the Leaderboard.
  const [tab] = useState<Tab>(() => (cameFrom()?.startsWith('/more') ? 'more' : 'leaderboard'));
  const named = products ? productsNamed(products, key) : [];
  const roles = new Map(named.map((r) => [r.product.id, r]));
  const name = (products && usedNames(products).find((n) => n.key === key)?.name) || p.name;
  const rows = rankProducts(
    named.map((r) => r.product),
    { filter: 'all', rankBy: 'overall' },
  );
  const tiles = leaderboardTiles(rows.map((r) => r.product));
  const brand = named.some((r) => r.brand);
  const shop = named.some((r) => r.shop);
  return (
    <>
      <Header title={name} left={<BackButton to={tab === 'more' ? '/more/brands' : '/'} />} />
      <main class="screen">
        {!products && !error && <Skeleton kind="board" />}
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && named.length === 0 && (
          <EmptyCard art="filter" title={`Nothing from ${name}`}>
            <p>None of your products has it as its Source or where you bought it.</p>
          </EmptyCard>
        )}
        {named.length > 0 && (
          <>
            <p class="lead brand-lead">
              {brand && shop ? (
                <>
                  Everything from <strong>{name}</strong>, or bought there.
                </>
              ) : brand ? (
                <>
                  Everything from <strong>{name}</strong>.
                </>
              ) : (
                <>
                  Everything you bought at <strong>{name}</strong>.
                </>
              )}
            </p>
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: tiles.average === null ? '–' : formatScore(tiles.average), label: 'Average' },
                ...(shop ? [{ value: formatGBP(spentAt(products!, key)), label: 'Spent here' }] : []),
              ]}
            />
            <div class="rows">
              {rows.map((r) => (
                <ProductRow key={r.product.id} product={r.product} rank={r.rank} band={r.band} first={r.first} meta={<RoleTags brand={roles.get(r.product.id)!.brand} shop={roles.get(r.product.id)!.shop} />} />
              ))}
            </div>
          </>
        )}
      </main>
      <TabBar active={tab} />
    </>
  );
}
