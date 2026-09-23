import { useEffect, useState } from 'preact/hooks';
import type { Product } from '../../../shared/domain/product';
import { rankProducts, type ViewState } from '../../../shared/domain/leaderboard';
import { errorText } from '../api';
import { BackButton, Header, TabBar } from '../components/chrome';
import { ProductRow } from '../components/ProductRow';
import { LeafOutline, PlusIcon } from '../icons';
import { cachedProducts, fetchArchived, fetchProducts, setFlag } from '../products';
import { linkTo, navigate } from '../router';

// Phase 3: the default ranking (Overall, all types). Filter, Rank by, tiles,
// the other empty states and scroll return arrive in Phase 4.
const DEFAULT_VIEW: ViewState = { filter: 'all', rankBy: 'overall' };

export function Leaderboard() {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts());
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts()
      .then((p) => setProducts([...p]))
      .catch((e) => setError(errorText(e)));
  }, []);

  const rows = products ? rankProducts(products, DEFAULT_VIEW) : [];
  return (
    <>
      <Header />
      <main class="screen">
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && products.length === 0 && (
          <div class="empty">
            <LeafOutline />
            <h2>Nothing ranked yet</h2>
            <p>Add the first thing you’ve tried and it’ll appear here.</p>
            <a class="btn secondary" style={{ width: 'auto' }} href="/products/new" onClick={linkTo('/products/new')}>
              Add a product
            </a>
          </div>
        )}
        {rows.length > 0 && (
          <div class="rows" style={{ paddingTop: '12px' }}>
            {rows.map((r) => (
              <ProductRow key={r.product.id} product={r.product} rank={r.rank} podium={r.podium} />
            ))}
          </div>
        )}
      </main>
      <button class="fab" aria-label="Add a product" onClick={() => navigate('/products/new')}>
        <PlusIcon />
      </button>
      <TabBar active="leaderboard" />
    </>
  );
}

/** Archived products, ranked by Overall whatever Rank by says, each with Un-archive (P7). */
export function Archive() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchArchived()
      .then(setProducts)
      .catch((e) => setError(errorText(e)));
  }, []);

  async function unarchive(id: string) {
    setError('');
    try {
      await setFlag(id, 'archived', false);
      setProducts((list) => list?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const rows = products ? rankProducts(products, DEFAULT_VIEW) : [];
  return (
    <>
      <Header title="Archive" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap" style={{ padding: '12px 16px' }}>
          <p class="lead">Archived products are kept but hidden from your Leaderboard, Log, tiles and followers.</p>
          {error && (
            <p class="error" role="alert" style={{ marginTop: '8px' }}>
              {error}
            </p>
          )}
        </div>
        {products && products.length === 0 && (
          <div class="empty">
            <LeafOutline />
            <h2>Nothing archived</h2>
            <p>Products you archive from their profile appear here.</p>
          </div>
        )}
        <div class="rows">
          {rows.map((r) => (
            <div class="archived-row" key={r.product.id}>
              <ProductRow product={r.product} rank={r.rank} podium={null} />
              <button class="btn secondary unarchive" style={{ width: 'auto', height: '40px' }} onClick={() => unarchive(r.product.id)}>
                Un-archive
              </button>
            </div>
          ))}
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
