import { useEffect, useState } from 'preact/hooks';
import { formatPerUnit, formatScore, formatVFM } from '../../../shared/domain/format';
import { rankProducts } from '../../../shared/domain/leaderboard';
import { matchesName, nameKey } from '../../../shared/domain/names';
import { photoUrl } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { productType } from '../../../shared/domain/productTypes';
import { formatDay, notRated, sortStrains, STRAIN_SORTS, strainPath, strainRank, strainsOf, strainTypeLabel, type Strain, type StrainSort } from '../../../shared/domain/strains';
import { errorText } from '../api';
import { BackButton, Header, LargeTitle, TabBar } from '../components/chrome';
import { Tiles } from '../components/Controls';
import { EmptyCard } from '../components/EmptyCard';
import { MeButton } from '../components/MeButton';
import { ProductRow } from '../components/ProductRow';
import { RowPhotos } from '../components/ProductPhotos';
import { Skeleton } from '../components/Skeleton';
import { ChevronRight, TypeMark } from '../icons';
import { cachedEntries, fetchEntries } from '../logEntries';
import { useCurrency } from '../money';
import { renameStrain } from '../products';
import { linkTo, navigate } from '../router';
import { useWants } from '../wants';
import { Halves, WantList, WantSheet, type Half } from '../components/Wants';
import { CardPhoto, useProducts } from './Brands';
import type { LogEntry } from '../../../shared/domain/logEntry';

// Strainz (D92): your products grouped by strain (the product's Name), in the Log's place in the tab bar. Two
// halves: Tried (cards like Sources, then the Log entries you never rated) and Want to try (private).

const enc = encodeURIComponent;
let lastHalf: Half = 'tried'; // the half you were on, kept while the app is open
let lastSort: StrainSort = 'average';

/** Your Log entries, from the cache at once and fresh from the server. */
function useEntries(): LogEntry[] | null {
  const [entries, setEntries] = useState<LogEntry[] | null>(cachedEntries());
  useEffect(() => {
    fetchEntries()
      .then((e) => setEntries([...e]))
      .catch(() => setEntries((e) => e ?? []));
  }, []);
  return entries;
}

/** "3 products · Indica". */
function strainLine(s: Strain<Product>): string {
  const type = strainTypeLabel(s.strainType);
  return `${s.products.length} ${s.products.length === 1 ? 'product' : 'products'}${type ? ` · ${type}` : ''}`;
}

/** The picture of a strain: its best product's (else its first's). */
const cover = (s: Strain<Product>) => s.best?.product ?? s.products[0]!;

/** The Strainz tab (D92). */
export function StrainzList() {
  const { products, error } = useProducts();
  const entries = useEntries();
  const { wants, error: wantsError } = useWants();
  const [half, setHalfNow] = useState<Half>(lastHalf);
  const [sort, setSortNow] = useState<StrainSort>(lastSort);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const setHalf = (h: Half) => setHalfNow((lastHalf = h));
  const setSort = (s: StrainSort) => setSortNow((lastSort = s));
  const strains = products ? strainsOf(products) : [];
  const unrated = entries ? notRated(entries, strains) : [];
  const shown = sortStrains(
    strains.filter((s) => matchesName(s.name, query)),
    sort,
  );
  const shownUnrated = unrated.filter((u) => matchesName(u.name, query));
  const wantCount = (wants ?? []).filter((w) => w.kind === 'strain').length;
  const known = (name: string) => {
    const s = strains.find((x) => x.key === nameKey(name));
    return s ? `You’ve tried ${s.name}: ${s.products.length} ${s.products.length === 1 ? 'product' : 'products'}.` : null;
  };
  const favourite = sortStrains(strains, 'average')[0];
  return (
    <>
      <Header title="Strainz" large right={<MeButton />} />
      <main class="screen">
        <LargeTitle title="Strainz" />
        <div class="wrap halves-wrap">
          <Halves label="Strainz" value={half} tried={strains.length + unrated.length} want={wantCount} wantLabel="Want to try" onChange={setHalf} />
        </div>
        {half === 'want' ? (
          <WantList kind="strain" wants={wants} error={wantsError} onAdd={() => setAdding(true)} />
        ) : (
          <>
            {!products && !error && <Skeleton kind="board" />}
            {error && !products && (
              <div class="empty">
                <h2>Couldn’t load your products</h2>
                <p>{error}</p>
              </div>
            )}
            {products && strains.length === 0 && unrated.length === 0 && (
              <EmptyCard art="podium" title="No strains yet">
                <p>Add a product and its name becomes a strain here, with your average, how many you’ve tried and more.</p>
                <a class="btn primary" style={{ width: 'auto' }} href="/products/new" onClick={linkTo('/products/new')}>
                  Add a product
                </a>
              </EmptyCard>
            )}
            {products && (strains.length > 0 || unrated.length > 0) && (
              <>
                <div class="wrap brands-top">
                  <label for="strain-search" class="visually-hidden">
                    Search strains
                  </label>
                  <input id="strain-search" class="input" type="text" placeholder="Search strains" autoComplete="off" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
                  {strains.length > 0 && (
                    <div class="brand-sort" role="group" aria-label="Sort">
                      {STRAIN_SORTS.map((s) => (
                        <button type="button" key={s.key} class={`pill${sort === s.key ? ' active' : ''}`} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {favourite?.average != null && (
                    <p class="lead strainz-lead">
                      <b class="num">{strains.length}</b> {strains.length === 1 ? 'strain' : 'strains'} · your favourite <b>{favourite.name}</b>
                    </p>
                  )}
                </div>
                {strains.length > 0 && (
                  <div class="scards">
                    {shown.map((s) => (
                      <a class="scard" key={s.key} href={strainPath(s.name)} onClick={linkTo(strainPath(s.name))}>
                        <CardPhoto product={cover(s)} />
                        <span class="scard-top">
                          <span class="nm">{s.name}</span>
                          <span class="avg">
                            <span class="visually-hidden">Average </span>
                            {s.average === null ? '–' : formatScore(s.average)}
                          </span>
                        </span>
                        <span class="sub">{strainLine(s)}</span>
                        {s.products.length === 1 && (
                          <span class="meta roles">
                            <span class="role once">Tried once</span>
                          </span>
                        )}
                      </a>
                    ))}
                    {shown.length === 0 && <p class="scards-none">No matching strains</p>}
                  </div>
                )}
                {shownUnrated.length > 0 && (
                  <section class="unrated" aria-labelledby="unrated-h">
                    <h2 id="unrated-h" class="group-h wrap">
                      <span class="gname">Tried, not rated</span>
                      <span class="n num">{shownUnrated.length}</span>
                    </h2>
                    <div class="scards">
                      {shownUnrated.map((u) => {
                        const def = productType(u.entry.productType);
                        const ph = u.entry.photo;
                        return (
                          <a class="scard plain" key={u.key} href={`/log/${enc(u.entry.id)}`} onClick={linkTo(`/log/${enc(u.entry.id)}`)}>
                            <span class={`scard-ph${ph?.cutout ? ' cut' : ''}`}>{ph ? <img src={photoUrl(ph, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}</span>
                            <span class="scard-top">
                              <span class="nm">{u.name}</span>
                            </span>
                            <span class="sub">Not rated{u.count > 1 ? ` · ${u.count} times` : ''}</span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                )}
                <div class="wrap">
                  <a class="log-link" href="/log" onClick={linkTo('/log')}>
                    <span class="ll-text">
                      <span class="ll-t">Your Log</span>
                      <span class="small">Everything you’ve tried, by country</span>
                    </span>
                    <ChevronRight class="chev" />
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <TabBar active="strainz" add={{ label: 'Add a strain to try', onAdd: () => setAdding(true) }} />
      {adding && (
        <WantSheet
          kind="strain"
          known={known}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setHalf('want');
          }}
        />
      )}
    </>
  );
}

/** Rename a strain (D92): every product and Log entry with its name takes the new one. */
function RenameSheet(p: { strain: Strain<Product>; onClose: () => void }) {
  const [name, setName] = useState(p.strain.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = p.strain.products.length;
  const save = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await renameStrain(
        p.strain.name,
        name,
        p.strain.products.map((x) => x.id),
      );
      navigate(strainPath(r.name), { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <form class="sheet want-sheet" role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={save}>
        <div class="grp pad">
          <h2 id="rename-title" class="lbl">
            Rename {p.strain.name}
          </h2>
          <p class="small">
            {n === 1 ? 'Its product takes the new name' : `All ${n} of its products take the new name`}, and so does any Log entry with it. Renaming it to a strain you have joins the two.
          </p>
          <div class="field">
            <label for="rename-name">Name</label>
            <input id="rename-name" class="input" type="text" autoComplete="off" value={name} onInput={(e) => setName(e.currentTarget.value)} autoFocus />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <div class="btn-row">
            <button type="button" class="btn secondary" onClick={p.onClose}>
              Cancel
            </button>
            <button type="submit" class="btn primary" disabled={busy || !name.trim() || name.trim() === p.strain.name}>
              {busy ? 'Renaming…' : 'Rename'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/** Pick the strain to compare with. */
function PickSheet(p: { strain: Strain<Product>; strains: Strain<Product>[]; onClose: () => void }) {
  const others = sortStrains(
    p.strains.filter((s) => s.key !== p.strain.key),
    'az',
  );
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <div class="sheet pick-sheet" role="dialog" aria-modal="true" aria-labelledby="pick-title">
        <div class="grp">
          <div class="ttl">
            <strong id="pick-title">Compare {p.strain.name} with…</strong>
          </div>
          <div class="pick-list">
            {others.map((s) => (
              <a key={s.key} class="opt pick" href={`${strainPath(p.strain.name)}/vs/${enc(s.name)}`} onClick={linkTo(`${strainPath(p.strain.name)}/vs/${enc(s.name)}`)}>
                <span>{s.name}</span>
                <span class="num">{s.average === null ? '–' : formatScore(s.average)}</span>
              </a>
            ))}
          </div>
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onClose} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

/** A strain's page (D92): your average and its place, best and lowest, kinds, prices, sources, dates, its products. */
export function StrainPage(p: { name: string }) {
  const main = useCurrency();
  const { products, error, setProducts } = useProducts();
  const [sheet, setSheet] = useState<'rename' | 'pick' | null>(null);
  const [photosOf, setPhotosOf] = useState<Product | null>(null);
  const strains = products ? strainsOf(products) : [];
  const key = nameKey(p.name);
  const s = strains.find((x) => x.key === key);
  const name = s?.name ?? p.name;
  const rank = s ? strainRank(strains, s.key) : null;
  const rated = strains.filter((x) => x.average !== null).length;
  const rows = s ? rankProducts(s.products, { filter: 'all', rankBy: 'overall' }) : [];
  const type = s ? strainTypeLabel(s.strainType) : null;
  return (
    <>
      <Header title={name} left={<BackButton to="/strainz" />} />
      <main class="screen">
        {!products && !error && <Skeleton kind="board" />}
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && !s && (
          <EmptyCard art="filter" title={`No ${name}`}>
            <p>None of your products is called that now.</p>
          </EmptyCard>
        )}
        {s && (
          <>
            <div class="wrap stack strain-top">
              <div class="strain-hero">
                <CardPhoto product={cover(s)} />
                <div class="sh-text">
                  <h1 class="sh-name">{s.name}</h1>
                  <span class="meta roles">
                    {type && <span class="sh-type">{type}</span>}
                    {s.products.length === 1 && <span class="role once">Tried once</span>}
                  </span>
                </div>
              </div>
              {s.average !== null && (
                <p class="lead strain-place">
                  {rank === 1 ? (
                    <>
                      Your <b>favourite</b> of your {rated} rated strains.
                    </>
                  ) : (
                    <>
                      <b>#{rank}</b> of your {rated} rated strains.
                    </>
                  )}
                </p>
              )}
            </div>
            <Tiles
              tiles={[
                { value: s.average === null ? '–' : formatScore(s.average), label: 'Average' },
                { value: String(s.products.length), label: s.products.length === 1 ? 'Product' : 'Products' },
                { value: s.best ? formatScore(s.best.score) : '–', label: 'Best' },
              ]}
              lead={0}
              foot={s.lowest && <span class="who">Lowest · <b>{formatScore(s.lowest.score)}</b></span>}
            />
            <div class="wrap stack">
              <div class="btn-row">
                <button type="button" class="btn primary" onClick={() => setSheet('pick')} disabled={strains.length < 2}>
                  Compare
                </button>
                <button type="button" class="btn secondary" onClick={() => setSheet('rename')}>
                  Rename
                </button>
              </div>
              <dl class="facts">
                <div>
                  <dt>Kinds</dt>
                  <dd>{s.kinds.join(', ')}</dd>
                </div>
                {s.pricePerGram !== null && (
                  <div>
                    <dt>Price per gram</dt>
                    <dd>{formatPerUnit(s.pricePerGram, main)} on average</dd>
                  </div>
                )}
                {s.valueForMoney !== null && (
                  <div>
                    <dt>Value for money</dt>
                    <dd class="num">{formatVFM(s.valueForMoney)}</dd>
                  </div>
                )}
                {s.sources.length > 0 && (
                  <div>
                    <dt>From</dt>
                    <dd>{s.sources.join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt>{s.firstTried === s.lastTried ? 'Tried' : 'First tried'}</dt>
                  <dd>{formatDay(s.firstTried)}</dd>
                </div>
                {s.firstTried !== s.lastTried && (
                  <div>
                    <dt>Last tried</dt>
                    <dd>{formatDay(s.lastTried)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <h2 class="group-h wrap">
              <span class="gname">Your {s.name} products</span>
              <span class="n num">{s.products.length}</span>
            </h2>
            <div class="rows">
              {rows.map((r) => (
                <ProductRow key={r.product.id} product={r.product} rank={r.rank} band={r.band} first={r.first} onPhoto={() => setPhotosOf(r.product)} />
              ))}
            </div>
          </>
        )}
      </main>
      <TabBar active="strainz" add={{ label: `Add a ${name} product`, onAdd: () => navigate(`/products/new/${enc(name)}`) }} />
      {sheet === 'rename' && s && <RenameSheet strain={s} onClose={() => setSheet(null)} />}
      {sheet === 'pick' && s && <PickSheet strain={s} strains={strains} onClose={() => setSheet(null)} />}
      {photosOf && <RowPhotos product={photosOf} onChange={(next) => setProducts((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)} onClose={() => setPhotosOf(null)} />}
    </>
  );
}

/** Two strains side by side (D92): the better figure on each line is marked. */
export function StrainCompare(p: { name: string; other: string }) {
  const main = useCurrency();
  const { products, error } = useProducts();
  const strains = products ? strainsOf(products) : [];
  const a = strains.find((x) => x.key === nameKey(p.name));
  const b = strains.find((x) => x.key === nameKey(p.other));
  type Line = { label: string; a: string; b: string; win: number | null };
  const line = (label: string, x: number | null, y: number | null, show: (v: number) => string, higherWins = true): Line => ({
    label,
    a: x === null ? '–' : show(x),
    b: y === null ? '–' : show(y),
    win: x === null || y === null || x === y ? null : (x > y) === higherWins ? 0 : 1,
  });
  const lines: Line[] =
    a && b
      ? [
          line('Average', a.average, b.average, formatScore),
          line('Times tried', a.products.length, b.products.length, String),
          line('Best', a.best?.score ?? null, b.best?.score ?? null, formatScore),
          line('Lowest', a.lowest?.score ?? a.best?.score ?? null, b.lowest?.score ?? b.best?.score ?? null, formatScore),
          line('Price per gram', a.pricePerGram, b.pricePerGram, (v) => formatPerUnit(v, main), false),
          line('Value for money', a.valueForMoney, b.valueForMoney, formatVFM),
          { label: 'Last tried', a: formatDay(a.lastTried), b: formatDay(b.lastTried), win: a.lastTried === b.lastTried ? null : a.lastTried > b.lastTried ? 0 : 1 },
        ]
      : [];
  const sideName = (s: Strain<Product> | undefined, fallback: string) => s?.name ?? fallback;
  return (
    <>
      <Header title="Compare" left={<BackButton to={a ? strainPath(a.name) : '/strainz'} />} />
      <main class="screen">
        {!products && !error && <Skeleton kind="board" />}
        {error && !products && (
          <div class="empty">
            <h2>Couldn’t load your products</h2>
            <p>{error}</p>
          </div>
        )}
        {products && (!a || !b) && (
          <EmptyCard art="filter" title="Nothing to compare">
            <p>One of these strains isn’t in your products now.</p>
          </EmptyCard>
        )}
        {a && b && (
          <div class="wrap stack">
            <table class="vs">
              <caption class="visually-hidden">
                {a.name} against {b.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <CardPhoto product={cover(a)} />
                    <a href={strainPath(a.name)} onClick={linkTo(strainPath(a.name))}>
                      {sideName(a, p.name)}
                    </a>
                  </th>
                  <td />
                  <th scope="col">
                    <CardPhoto product={cover(b)} />
                    <a href={strainPath(b.name)} onClick={linkTo(strainPath(b.name))}>
                      {sideName(b, p.other)}
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.label}>
                    <td class={`v num${l.win === 0 ? ' win' : ''}`}>
                      {l.a}
                      {l.win === 0 && <span class="visually-hidden"> (better)</span>}
                    </td>
                    <th scope="row">{l.label}</th>
                    <td class={`v num${l.win === 1 ? ' win' : ''}`}>
                      {l.b}
                      {l.win === 1 && <span class="visually-hidden"> (better)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="footnote">The better figure on each line is green. Price per gram is the latest price you paid, with 20mg of an edible counted as a gram.</p>
          </div>
        )}
      </main>
      <TabBar active="strainz" />
    </>
  );
}
