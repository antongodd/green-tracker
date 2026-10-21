import { useEffect, useState } from 'preact/hooks';
import { formatGBP, formatScore } from '../../../shared/domain/format';
import { leaderboardTiles, rankProducts } from '../../../shared/domain/leaderboard';
import { matchesName, nameKey, productsNamed, spentOn, usedNames } from '../../../shared/domain/names';
import { photoUrl } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { productType } from '../../../shared/domain/productTypes';
import { errorText } from '../api';
import { BackButton, Header, TabBar, type Tab } from '../components/chrome';
import { Tiles } from '../components/Controls';
import { EmptyCard } from '../components/EmptyCard';
import { MeButton } from '../components/MeButton';
import { brandPath } from '../components/NameLink';
import { ProductRow } from '../components/ProductRow';
import { Skeleton } from '../components/Skeleton';
import { TypeMark } from '../icons';
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

/** A Sources card's picture: its best product's first photo (a cut-out without its box), else the type's mark. */
function CardPhoto(p: { product: Product }) {
  const first = p.product.photos[0];
  const def = productType(p.product.productType);
  return (
    <span class={`scard-ph${first?.cutout ? ' cut' : ''}`}>
      {first ? <img src={photoUrl(first, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}
    </span>
  );
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

type Sort = 'products' | 'average' | 'spent' | 'az';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'products', label: 'Most products' },
  { key: 'average', label: 'Best average' },
  { key: 'spent', label: 'Most spent' },
  { key: 'az', label: 'A–Z' },
];

/**
 * The Sources tab (D61, option B "Cards"; D59's list before it): every name in your products'
 * Source and purchases' Supplier, one list for both, two cards a row. Each card: the photo of its
 * best product (by Overall; the type's mark without one), the name and its average, how many
 * products and what you spent on it (D62), the best one, and Brand / Bought here. Archived ones left out.
 */
export function BrandsList() {
  const { products, error } = useProducts();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('products');
  const names = (products ? usedNames(products) : []).map((n) => {
    const named = productsNamed(products!, n.key).map((r) => r.product);
    const top = rankProducts(named, { filter: 'all', rankBy: 'overall' })[0]!;
    return { ...n, average: leaderboardTiles(named).average, spent: spentOn(products!, n.key), best: top.value === null ? null : top.product, cover: top.product };
  });
  const shown = names.filter((n) => matchesName(n.name, query));
  if (sort === 'az') shown.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'spent') shown.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
  if (sort === 'average') shown.sort((a, b) => (a.average === b.average ? 0 : a.average === null ? 1 : b.average === null ? -1 : b.average - a.average) || a.name.localeCompare(b.name));
  return (
    <>
      <Header title="Brands & suppliers" right={<MeButton />} />
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
            <div class="scards">
              {shown.map((n) => (
                <a class="scard" key={n.key} href={brandPath(n.name)} onClick={linkTo(brandPath(n.name))}>
                  <CardPhoto product={n.cover} />
                  <span class="scard-top">
                    <span class="nm">{n.name}</span>
                    <span class="avg">
                      <span class="visually-hidden">Average </span>
                      {n.average === null ? '–' : formatScore(n.average)}
                    </span>
                  </span>
                  <span class="sub">
                    {n.products} {n.products === 1 ? 'product' : 'products'} · {formatGBP(n.spent)} spent
                  </span>
                  {n.best && <span class="sub best">best: {n.best.name}</span>}
                  <RoleTags brand={n.brand > 0} shop={n.shop > 0} />
                </a>
              ))}
              {shown.length === 0 && <p class="scards-none">No matching names</p>}
            </div>
          </>
        )}
      </main>
      <TabBar active="sources" />
    </>
  );
}

/**
 * One brand or supplier (D59): every product with it as its Source or a purchase's Supplier,
 * together, best first, tagged Brand / Bought here; tiles for products, average and what you
 * spent on it (D62: as a brand and where you bought, each purchase once). Archived products are left out.
 */
export function BrandPage(p: { name: string }) {
  const key = nameKey(p.name);
  const { products, error } = useProducts();
  // Opened from the Sources tab it belongs to Sources; from a product page, to the Leaderboard.
  const [tab] = useState<Tab>(() => (cameFrom()?.startsWith('/sources') ? 'sources' : 'leaderboard'));
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
      <Header title={name} left={<BackButton to={tab === 'sources' ? '/sources' : '/'} />} />
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
                { value: formatGBP(spentOn(products!, key)), label: 'Spent' },
              ]}
              lead={1}
              foot={rows[0] && <span class="who">Best · <b>{rows[0].product.name}</b></span>}
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
