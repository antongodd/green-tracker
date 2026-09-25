import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatScore, formatWeightTotal } from '../../../shared/domain/format';
import { leaderboardEmptyState, leaderboardTiles, rankProducts, type ViewState } from '../../../shared/domain/leaderboard';
import type { Product } from '../../../shared/domain/product';
import { productType, RATING_LABELS, type RatingKey } from '../../../shared/domain/productTypes';
import { errorText } from '../api';
import { BackButton, Header, TabBar } from '../components/chrome';
import { MeButton } from '../components/MeButton';
import { ControlRow, Tiles } from '../components/Controls';
import { ProductRow } from '../components/ProductRow';
import { LeafOutline, PlusIcon } from '../icons';
import { cachedProducts, fetchArchived, fetchProducts, setFlag } from '../products';
import { cameFrom, linkTo, navigate } from '../router';
import { restoreRow } from '../scrollReturn';
import { loadView, saveView } from '../viewState';

const DEFAULT_VIEW: ViewState = { filter: 'all', rankBy: 'overall' };

/** The three empty states (brief §10.1) — never claims the app is empty when it isn't. */
function EmptyCard(p: { kind: 'empty' | 'filtered-empty' | 'rank-empty'; view: ViewState; total: number; onAll: () => void; onOverall: () => void }) {
  const typeLabel = p.view.filter === 'all' ? null : productType(p.view.filter).label;
  if (p.kind === 'empty') {
    return (
      <div class="empty">
        <LeafOutline />
        <h2>Nothing ranked yet</h2>
        <p>Add the first thing you’ve tried and it’ll appear here.</p>
        <a class="btn secondary" style={{ width: 'auto' }} href="/products/new" onClick={linkTo('/products/new')}>
          Add a product
        </a>
      </div>
    );
  }
  if (p.kind === 'filtered-empty') {
    return (
      <div class="empty">
        <LeafOutline />
        <h2>No {typeLabel} yet</h2>
        <p>
          You have {p.total} {p.total === 1 ? 'product' : 'products'}, but none {p.total === 1 ? 'is' : 'are'} {typeLabel}.
        </p>
        <button class="btn secondary" style={{ width: 'auto' }} onClick={p.onAll}>
          Show all types
        </button>
      </div>
    );
  }
  const scope = typeLabel ? `${typeLabel} products` : 'products';
  const { title, body } =
    p.view.rankBy === 'price'
      ? { title: 'Nothing priced yet', body: `None of your ${scope} has a purchase with an amount, so there’s no price to rank.` }
      : p.view.rankBy === 'vfm'
        ? { title: 'No value for money yet', body: `Value for money needs an Overall and a latest purchase with an amount. None of your ${scope} has both.` }
        : {
            title: `Nothing rated on ${RATING_LABELS[p.view.rankBy as RatingKey]}`,
            body: `None of your ${scope} has a ${RATING_LABELS[p.view.rankBy as RatingKey]} rating yet.`,
          };
  return (
    <div class="empty">
      <LeafOutline />
      <h2>{title}</h2>
      <p>{body}</p>
      <button class="btn secondary" style={{ width: 'auto' }} onClick={p.onOverall}>
        Rank by Overall
      </button>
    </div>
  );
}

export function Leaderboard() {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts());
  const [view, setView] = useState<ViewState>(loadView);
  const [error, setError] = useState('');
  const arrivedFromProduct = useRef(/^\/products\//.test(cameFrom() ?? ''));

  useEffect(() => {
    fetchProducts()
      .then((p) => setProducts([...p]))
      .catch((e) => setError(errorText(e)));
  }, []);

  // Once rows exist, return to the tapped row (only on the first render with data).
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !products) return;
    restored.current = true;
    restoreRow('leaderboard', arrivedFromProduct.current);
  }, [products]);

  const change = (next: ViewState) => {
    setView(saveView(next));
    window.scrollTo(0, 0);
  };

  const rows = products ? rankProducts(products, view) : [];
  const empty = products ? leaderboardEmptyState(products.length, rows.length, view) : null;
  const tiles = leaderboardTiles(rows.map((r) => r.product));

  return (
    <>
      <Header right={<MeButton />} />
      <main class="screen">
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && products.length > 0 && (
          <>
            <ControlRow filter={view.filter} rankBy={view.rankBy} onFilter={(filter) => change({ ...view, filter })} onRankBy={(rankBy) => change({ ...view, rankBy })} />
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: tiles.average === null ? '–' : formatScore(tiles.average), label: 'Average' },
                { value: formatWeightTotal(tiles.totalGrams ?? 0), label: 'Total' },
              ]}
            />
          </>
        )}
        {empty && products && (
          <EmptyCard kind={empty} view={view} total={products.length} onAll={() => change({ ...view, filter: 'all' })} onOverall={() => change({ ...view, rankBy: 'overall' })} />
        )}
        {rows.length > 0 && (
          <div class="rows">
            {rows.map((r) => (
              <ProductRow key={r.product.id} list="leaderboard" product={r.product} rank={r.rank} podium={r.podium} rankBy={view.rankBy} value={r.value} />
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
