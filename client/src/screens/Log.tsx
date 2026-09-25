import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatWeightTotal } from '../../../shared/domain/format';
import type { ViewState } from '../../../shared/domain/leaderboard';
import { groupLog, logTiles, type LogRow } from '../../../shared/domain/log';
import type { LogEntry } from '../../../shared/domain/logEntry';
import { photoUrl } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { productType } from '../../../shared/domain/productTypes';
import { errorText } from '../api';
import { Header, TabBar } from '../components/chrome';
import { MeButton } from '../components/MeButton';
import { ControlRow, Tiles } from '../components/Controls';
import { ChevronRight, LeafOutline, PlusIcon, TypeMark } from '../icons';
import { cachedEntries, fetchEntries } from '../logEntries';
import { cachedProducts, fetchProducts } from '../products';
import { cameFrom, linkTo, navigate, openRow } from '../router';
import { rememberRow, restoreRow } from '../scrollReturn';
import { loadView, saveView } from '../viewState';

type Source = { kind: 'product'; product: Product } | { kind: 'loose'; entry: LogEntry };

/** Projections are derived when drawn, never stored (brief §10.2). */
function toRows(products: Product[], entries: LogEntry[]): { rows: LogRow[]; sources: Map<string, Source> } {
  const sources = new Map<string, Source>();
  const rows: LogRow[] = [];
  for (const p of products) {
    sources.set(`p:${p.id}`, { kind: 'product', product: p });
    rows.push({ kind: 'product', id: p.id, name: p.name, productType: p.productType, country: p.country, countryOther: p.countryOther, hasPhoto: p.photos.length > 0, createdAt: p.createdAt, purchases: p.purchases });
  }
  for (const e of entries) {
    sources.set(`e:${e.id}`, { kind: 'loose', entry: e });
    rows.push({ kind: 'loose', id: e.id, name: e.name, productType: e.productType, country: e.country, countryOther: e.countryOther, hasPhoto: !!e.photo, createdAt: e.createdAt, amount: e.amount });
  }
  return { rows, sources };
}

function Row(p: { row: LogRow; source: Source }) {
  const key = `${p.row.kind === 'product' ? 'p' : 'e'}:${p.row.id}`;
  const href = p.row.kind === 'product' ? `/products/${p.row.id}` : `/log/${p.row.id}`;
  const def = productType(p.row.productType);
  const photo = p.source.kind === 'product' ? p.source.product.photos[0] : p.source.entry.photo;
  const open = (e: MouseEvent) => {
    rememberRow('log', key, e.currentTarget as HTMLElement);
    // Products fly their photo into the profile (D20); loose entries open their editor as before.
    if (p.row.kind === 'product') openRow(e, href);
    else linkTo(href)(e);
  };
  return (
    // The whole row is the tap target — the thumbnail opens the row, not a viewer.
    <a class="lrow" href={href} onClick={open} data-return={`log:${key}`}>
      <div class="thumb">{photo ? <img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>
      <span class="name">{p.row.name}</span>
      {/* The type mark means "has a full profile": product rows only (Other / Not set have none). */}
      {p.row.kind === 'product' && def.icon ? <TypeMark icon={def.icon} label={`${def.label} product`} class="mk" /> : <span />}
      <ChevronRight class="chev" />
    </a>
  );
}

export function Log() {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts());
  const [entries, setEntries] = useState<LogEntry[] | null>(cachedEntries());
  const [view, setView] = useState<ViewState>(loadView);
  const [error, setError] = useState('');
  const arrivedFromRow = useRef(/^\/(products|log)\//.test(cameFrom() ?? ''));

  useEffect(() => {
    Promise.all([fetchProducts(), fetchEntries()])
      .then(([p, e]) => {
        setProducts([...p]);
        setEntries([...e]);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  const ready = products !== null && entries !== null;
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !ready) return;
    restored.current = true;
    restoreRow('log', arrivedFromRow.current);
  }, [ready]);

  const { rows, sources } = ready ? toRows(products!, entries!) : { rows: [], sources: new Map<string, Source>() };
  const groups = groupLog(rows, view.filter);
  const tiles = logTiles(groups);
  const setFilter = (filter: ViewState['filter']) => {
    // One Type setting shared with the Leaderboard (its Rank by falls back if needed).
    setView(saveView({ ...loadView(), filter }));
    window.scrollTo(0, 0);
  };
  const typeLabel = view.filter === 'all' ? null : productType(view.filter).label;

  return (
    <>
      <Header right={<MeButton />} />
      <main class="screen">
        {error && !ready && (
          <div class="empty">
            <h2>Couldn’t load your Log</h2>
            <p>{error}</p>
          </div>
        )}
        {ready && (
          <>
            <ControlRow filter={view.filter} onFilter={setFilter} />
            {/* Log tiles show even when empty: 0 / 0 / 0g. */}
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: String(tiles.countries), label: 'Countries' },
                { value: formatWeightTotal(tiles.totalGrams), label: 'Total' },
              ]}
            />
            {rows.length === 0 ? (
              <div class="empty">
                <LeafOutline />
                <h2>Your Log is empty</h2>
                <p>Everything you try goes here. Add a quick entry, or add a product to your Leaderboard.</p>
                <a class="btn secondary" style={{ width: 'auto' }} href="/log/new" onClick={linkTo('/log/new')}>
                  Add a log entry
                </a>
              </div>
            ) : groups.length === 0 ? (
              <div class="empty">
                <LeafOutline />
                <h2>No {typeLabel} in your Log</h2>
                <p>
                  Your Log has {rows.length} {rows.length === 1 ? 'row' : 'rows'}, but none {rows.length === 1 ? 'is' : 'are'} {typeLabel}.
                </p>
                <button class="btn secondary" style={{ width: 'auto' }} onClick={() => setFilter('all')}>
                  Show all types
                </button>
              </div>
            ) : (
              <>
                {groups.map((g) => (
                  <section key={g.country?.key ?? 'none'} class="lgroup" aria-label={g.country?.name ?? 'No country'}>
                    <h2 class="group-h">
                      {g.country?.flag && <span class="flag">{g.country.flag}</span>}
                      <span class="gname">{g.country?.name ?? 'No country'}</span>
                      <span class="n num">{g.rows.length}</span>
                    </h2>
                    <div class="lrows">
                      {g.rows.map((r) => {
                        const k = `${r.kind === 'product' ? 'p' : 'e'}:${r.id}`;
                        return <Row key={k} row={r} source={sources.get(k)!} />;
                      })}
                    </div>
                  </section>
                ))}
                <p class="footnote">Everything you’ve tried, grouped by country. Rows with a type mark have a full profile on your Leaderboard.</p>
              </>
            )}
          </>
        )}
      </main>
      <button class="fab" aria-label="Add a log entry" onClick={() => navigate('/log/new')}>
        <PlusIcon />
      </button>
      <TabBar active="log" />
    </>
  );
}
