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
import { ChevronRight, PlusIcon, TypeMark } from '../icons';
import { EmptyCard } from '../components/EmptyCard';
import { cachedEntries, fetchEntries } from '../logEntries';
import { cachedProducts, fetchProducts } from '../products';
import { cameFrom, linkTo, navigate, openPlainRow, openRow } from '../router';
import { rememberRow, restoreRow } from '../scrollReturn';
import { loadView, saveView } from '../viewState';
import { Skeleton } from '../components/Skeleton';
import { PhotoButton, photoTap } from '../components/ProductRow';
import { RowPhotos } from '../components/ProductPhotos';
import { PhotoViewer } from '../components/PhotoViewer';
import { shownFromRecord } from '../components/PhotoGrid';

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

function Row(p: { row: LogRow; source: Source; onPhoto: (source: Source) => void }) {
  const key = `${p.row.kind === 'product' ? 'p' : 'e'}:${p.row.id}`;
  const href = p.row.kind === 'product' ? `/products/${p.row.id}` : `/log/${p.row.id}`;
  const def = productType(p.row.productType);
  const photo = p.source.kind === 'product' ? p.source.product.photos[0] : p.source.entry.photo;
  const onPhoto = () => p.onPhoto(p.source);
  const open = (e: MouseEvent) => {
    // D79: a tap on the photo opens it full screen (a product's, with the bar, as on its page).
    if (photoTap(e, onPhoto)) return;
    rememberRow('log', key, e.currentTarget as HTMLElement);
    // Products, and loose entries with a photo (D41), fly it into their page's top (D20).
    if (p.row.kind === 'product' || photo) openRow(e, href);
    else openPlainRow(e, href);
  };
  return (
    // The row opens its page; its photo (D79), the viewer.
    <>
      <a class="lrow" href={href} onClick={open} data-return={`log:${key}`}>
        <div class={`thumb${photo?.cutout ? ' cut' : ''}`}>{photo ? <img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>
        <span class="name">{p.row.name}</span>
        {/* The type mark means "has a full profile": product rows only (Other / Not set have none). */}
        {p.row.kind === 'product' && def.icon ? <TypeMark icon={def.icon} label={`${def.label} product`} class="mk" /> : <span />}
        <ChevronRight class="chev" />
      </a>
      <PhotoButton name={p.row.name} onPhoto={onPhoto} photos={photo ? 1 : 0} />
    </>
  );
}

export function Log() {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts());
  const [entries, setEntries] = useState<LogEntry[] | null>(cachedEntries());
  const [view, setView] = useState<ViewState>(loadView);
  const [error, setError] = useState('');
  // D79: the row whose photos are open.
  const [photosOf, setPhotosOf] = useState<Source | null>(null);
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
  // The glass hero's line (D64): the country you've tried most from.
  const mostFrom = groups.filter((g) => g.country).reduce<(typeof groups)[number] | null>((m, g) => (!m || g.rows.length > m.rows.length ? g : m), null);
  const setFilter = (filter: ViewState['filter']) => {
    // One Type setting shared with the Leaderboard (its Rank by falls back if needed).
    setView(saveView({ ...loadView(), filter }));
    window.scrollTo(0, 0);
  };
  const typeLabel = view.filter === 'all' ? null : productType(view.filter).label;

  return (
    <>
      <Header right={<MeButton />} />
      <main class="screen has-fab">
        {!ready && !error && <Skeleton kind="log" />}
        {error && !ready && (
          <div class="empty">
            <h2>Couldn’t load your Log</h2>
            <p>{error}</p>
          </div>
        )}
        {ready && (
          <>
            {/* An empty Log shows only its card: no Type pill and no 0 / 0 / 0g (0.69.9), as on the Leaderboard. */}
            {rows.length > 0 && <ControlRow filter={view.filter} onFilter={setFilter} />}
            {rows.length > 0 && <Tiles
              tiles={[
                { value: String(tiles.products), label: tiles.products === 1 ? 'Product' : 'Products' },
                { value: String(tiles.countries), label: tiles.countries === 1 ? 'Country' : 'Countries' },
                { value: formatWeightTotal(tiles.totalGrams), label: 'Total' },
              ]}
              foot={mostFrom && (
                <>
                  <span class="who">
                    Most from · <b>{mostFrom.country!.flag && <span class="flag">{mostFrom.country!.flag} </span>}{mostFrom.country!.name}</b>
                  </span>
                  <b class="n">{mostFrom.rows.length}</b>
                </>
              )}
            />}
            {rows.length === 0 ? (
              <EmptyCard art="log" title="Your Log is empty">
                <p>Everything you try goes here. Add a quick entry, or add a product to your Leaderboard.</p>
                <a class="btn primary" style={{ width: 'auto' }} href="/log/new" onClick={linkTo('/log/new')}>
                  <PlusIcon />
                  Add a Log entry
                </a>
              </EmptyCard>
            ) : groups.length === 0 ? (
              <EmptyCard art="filter" title={`No ${typeLabel} rows in your Log`}>
                <p>
                  Your Log has {rows.length} {rows.length === 1 ? 'row' : 'rows'}, but none in {typeLabel}.
                </p>
                <button class="btn secondary" style={{ width: 'auto' }} onClick={() => setFilter('all')}>
                  Show all types
                </button>
              </EmptyCard>
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
                        return <Row key={k} row={r} source={sources.get(k)!} onPhoto={setPhotosOf} />;
                      })}
                    </div>
                  </section>
                ))}
                <p class="footnote">Everything you’ve tried, grouped by country. Rows with the leaf or other icon have a full profile on your Leaderboard.</p>
              </>
            )}
          </>
        )}
      </main>
      <button class="fab" aria-label="Add a Log entry" onClick={() => navigate('/log/new')}>
        <PlusIcon />
      </button>
      <TabBar active="log" />
      {photosOf?.kind === 'product' && <RowPhotos product={photosOf.product} onChange={(next) => setProducts((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)} onClose={() => setPhotosOf(null)} />}
      {/* A Log entry's own photo, as on its page: no bar. */}
      {photosOf?.kind === 'loose' && photosOf.entry.photo && <PhotoViewer photos={[shownFromRecord(photosOf.entry.photo)]} start={0} onClose={() => setPhotosOf(null)} />}
    </>
  );
}
