import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatScore } from '../../../shared/domain/format';
import type { Band } from '../../../shared/domain/gems';
import { boardPlace, leaderboardEmptyState, leaderboardTiles, rankByCaption, rankProducts, type ViewState } from '../../../shared/domain/leaderboard';
import { ColoursSheet, Glints, pageClass, RankCrown, rowClass, useAppearance } from '../components/Gems';
import { ProductHero } from '../components/ProductHero';
import { heatStyle } from '../heat';
import { photoUrl } from '../../../shared/domain/photo';
import { productTypeLabel } from '../../../shared/domain/product';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { overall } from '../../../shared/domain/ratings';
import type { PersonCard, SharedProduct } from '../../../shared/domain/social';
import { ApiError, errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { ControlRow, Tiles } from '../components/Controls';
import { PhotoGrid } from '../components/PhotoGrid';
import { Cluster, formatRankValue, Score, Thumb } from '../components/ProductRow';
import { PhotoViewer, type ShownPhoto } from '../components/PhotoViewer';
import { MoreIcon } from '../icons';
import { fetchPreview } from '../privacy';
import { EmptyCard } from '../components/EmptyCard';
import * as api from '../people';
import { cameFrom, linkTo, openRow } from '../router';
import { rememberRow, restoreRow } from '../scrollReturn';
import { loadOthersView, saveOthersView } from '../viewState';
import { Avatar } from '../components/Avatar';
import { photoOf } from './People';
import { Ratings } from './Profile';
import { Skeleton } from '../components/Skeleton';
import { brandPath, NameLink } from '../components/NameLink';
import { nameKey, productsNamed } from '../../../shared/domain/names';

const enc = encodeURIComponent;
const shown = (ph: { id: string; version: string; cutout: boolean }): ShownPhoto => ({ key: ph.id, thumb: photoUrl(ph, 'thumb'), image: photoUrl(ph, 'cropped'), original: '', crop: null, cutout: ph.cutout });

/** Where someone's board lives: theirs under /u/…, or your own as followers see it (D45). */
const boardPath = (username: string, preview?: boolean) => (preview ? '/more/privacy/preview' : `/u/${enc(username)}`);

/** Their row: identity, flag, type, score; the metadata line carries Source only (D12). */
function SharedRow(p: { username: string; product: SharedProduct; rank: number; band: Band | null; first: boolean; value: number | null; rankBy: ViewState['rankBy']; preview?: boolean }) {
  const appearance = useAppearance();
  const href = `${boardPath(p.username, p.preview)}/p/${enc(p.product.id)}`;
  const key = `u:${p.username}`;
  const open = (e: MouseEvent) => {
    rememberRow(key, p.product.id, e.currentTarget as HTMLElement);
    openRow(e, href);
  };
  return (
    <a class={`row${rowClass(p, appearance)}`} {...heatStyle(p.band, p.rankBy, p.value)} href={href} onClick={open} data-return={`${key}:${p.product.id}`}>
      <Glints band={p.band} appearance={appearance} />
      <span class="rk">
        <RankCrown look={p} appearance={appearance} />
        {p.rank}
      </span>
      <Thumb product={p.product} />
      <div class="mid">
        <div class="name">{p.product.name}</div>
        <Cluster product={p.product} />
        {p.product.source && (
          <div class="meta">
            <span class="src">{p.product.source}</span>
          </div>
        )}
      </div>
      <Score value={p.value} label={rankByCaption(p.rankBy)} text={p.value === null ? undefined : formatRankValue(p.rankBy, p.value)} />
    </a>
  );
}

/** On your own board as followers see it (D45): says so, and links back to the switches. */
function PreviewNote() {
  return (
    <p class="pv-note">
      This is what your followers see now. <a href="/more/privacy" onClick={linkTo('/more/privacy')}>Change it in Privacy</a>
    </p>
  );
}

/** Not following: their username and a Follow button — nothing else (brief §5). */
function Stranger(p: { person: PersonCard; onChange: (next: PersonCard) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<'menu' | 'confirm' | null>(null);
  const run = async (f: () => Promise<PersonCard | unknown>, next?: PersonCard) => {
    setBusy(true);
    setError('');
    setMenu(null);
    try {
      const r = await f();
      p.onChange(next ?? (r as PersonCard));
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  const u = p.person.username;
  return (
    <>
      <Header title={`@${u}`} leaf={false} left={<BackButton to="/people" />} right={p.person.relation !== 'blocked' && <button class="hbtn" onClick={() => setMenu('menu')} aria-label={`Actions for @${u}`}><MoreIcon /></button>} />
      <main class="screen">
        <div class="stranger">
          <Avatar username={u} src={photoOf(p.person)} size="lg" />
          <h1>@{u}</h1>
          {p.person.relation === 'blocked' ? (
            <>
              <p class="lead">You’ve blocked @{u}. They can’t find you or see your leaderboard.</p>
              <button class="btn secondary" style={{ width: 'auto' }} disabled={busy} onClick={() => run(() => api.unblock(u), { username: u, relation: 'none' })}>
                Unblock
              </button>
            </>
          ) : p.person.relation === 'requested' ? (
            <>
              <button class="btn outline" style={{ width: 'auto' }} disabled={busy} onClick={() => run(() => api.unfollow(u))}>
                Requested
              </button>
              <p class="lead">Waiting for @{u} to approve. Tap Requested to cancel.</p>
            </>
          ) : (
            <>
              <button class="btn primary" style={{ width: 'auto', minWidth: '160px' }} disabled={busy} onClick={() => run(() => api.follow(u))}>
                Follow
              </button>
              <p class="lead">Follow to see their leaderboard.</p>
            </>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
      <TabBar active="people" />
      {menu === 'menu' && <Sheet title={`@${u}`} options={[{ label: 'Block', danger: true, onSelect: () => setMenu('confirm') }]} onCancel={() => setMenu(null)} />}
      {menu === 'confirm' && (
        <Sheet
          title={`Block @${u}?`}
          message="They won’t be able to find you, request to follow you or see your leaderboard. They aren’t told."
          options={[{ label: 'Block', danger: true, onSelect: () => run(() => api.block(u), { username: u, relation: 'blocked' }) }]}
          onCancel={() => setMenu(null)}
        />
      )}
    </>
  );
}

/**
 * Someone else's page: their read-only Leaderboard if you follow them; otherwise just a Follow card.
 * `preview` (D45): your own board exactly as your followers get it now, from the same server code.
 */
export function Person(p: { username: string; preview?: boolean }) {
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [products, setProducts] = useState<SharedProduct[] | null>(null);
  const [view, setView] = useState<ViewState>(() => loadOthersView());
  const [error, setError] = useState<{ missing: boolean; text: string } | null>(null);
  const arrived = useRef(/^\/u\/[^/]+\/p\/|^\/more\/privacy\/preview\/p\//.test(cameFrom() ?? ''));
  const listKey = p.preview ? 'u:preview' : `u:${p.username}`;
  // D48: the Colours key.
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const show = (board: { products: SharedProduct[] }) => {
      setView(loadOthersView());
      setProducts(board.products);
    };
    if (p.preview) {
      setPerson({ username: p.username, relation: 'following' });
      fetchPreview()
        .then(show)
        .catch((e) => setError({ missing: false, text: errorText(e) }));
      return;
    }
    api
      .person(p.username)
      .then(async (card) => {
        setPerson(card);
        if (card.relation === 'following') show(await api.theirBoard(card.username));
      })
      .catch((e) => setError({ missing: e instanceof ApiError && e.status === 404, text: errorText(e) }));
  }, [p.username, p.preview]);

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !products) return;
    restored.current = true;
    restoreRow(listKey, arrived.current);
  }, [products]);

  if (error) {
    return (
      <>
        <Header title={`@${p.username}`} leaf={false} left={<BackButton to="/people" />} />
        <main class="screen">
          <div class="empty">
            <h2>{error.missing ? 'No one found' : 'Couldn’t load this person'}</h2>
            <p>{error.missing ? `There’s no one called @${p.username}.` : error.text}</p>
          </div>
        </main>
        <TabBar active="people" />
      </>
    );
  }
  if (!person) return <><Header title={`@${p.username}`} leaf={false} left={<BackButton to="/people" />} /><main class="screen"><Skeleton kind="board" /></main><TabBar active="people" /></>;
  if (person.relation !== 'following') return <Stranger person={person} onChange={setPerson} />;

  const rows = products ? rankProducts(products, view) : [];
  const empty = products ? leaderboardEmptyState(products.length, rows.length, view) : null;
  const tiles = leaderboardTiles(rows.map((r) => r.product));
  const change = (next: ViewState) => {
    setView(saveOthersView(next));
    window.scrollTo(0, 0);
  };
  const back = p.preview ? '/more/privacy' : '/people';
  const tab = p.preview ? 'more' : 'people';
  const typeLabel = view.filter === 'all' ? null : productType(view.filter).label;

  // "@username" in the header is the signal you're viewing someone else's tracker (design §8).
  return (
    <>
      <Header title={`@${person.username}`} leaf={false} icon={person.photo && <Avatar username={person.username} src={photoOf(person)} size="hd" />} left={<BackButton to={back} />} />
      <main class="screen">
        {p.preview && <PreviewNote />}
        {!products && <Skeleton kind="board" />}
        {products && products.length > 0 && (
          <>
            <ControlRow filter={view.filter} rankBy={view.rankBy} money={false} onFilter={(filter) => change({ ...view, filter })} onRankBy={(rankBy) => change({ ...view, rankBy })} onKey={() => setShowKey(true)} />
            {/* PRODUCTS and AVERAGE only — never TOTAL. */}
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: tiles.average === null ? '–' : formatScore(tiles.average), label: 'Average' },
              ]}
              lead={1}
              foot={rows[0] && <span class="who">Their #1 · <b>{rows[0].product.name}</b></span>}
            />
          </>
        )}
        {empty === 'empty' && (
          <EmptyCard art="shared" title="Nothing to see yet">
            <p>@{person.username} hasn’t shared any products.</p>
          </EmptyCard>
        )}
        {empty === 'filtered-empty' && (
          <EmptyCard art="filter" title={`No ${typeLabel}`}>
            <p>None of @{person.username}’s products are {typeLabel}.</p>
            <button class="btn secondary" style={{ width: 'auto' }} onClick={() => change({ ...view, filter: 'all' })}>
              Show all types
            </button>
          </EmptyCard>
        )}
        {empty === 'rank-empty' && (
          <EmptyCard art="unrated" title="Nothing rated on that">
            <p>None of these products has that rating yet.</p>
            <button class="btn secondary" style={{ width: 'auto' }} onClick={() => change({ ...view, rankBy: 'overall' })}>
              Rank by Overall
            </button>
          </EmptyCard>
        )}
        {rows.length > 0 && (
          <div class="rows">
            {rows.map((r) => (
              <SharedRow key={r.product.id} username={person.username} product={r.product} rank={r.rank} band={r.band} first={r.first} value={r.value} rankBy={view.rankBy} preview={p.preview} />
            ))}
          </div>
        )}
      </main>
      <TabBar active={tab} />
      {showKey && <ColoursSheet onClose={() => setShowKey(false)} />}
    </>
  );
}

/**
 * Their product profile, read-only: hero (no price), ratings, hit time, photos,
 * and details limited to strain type, product type, concentrate type, country and
 * Source (D1). No price history, VFM, notes, Leafly, crop or any action.
 */
export function SharedProfile(p: { username: string; id: string; preview?: boolean }) {
  const [product, setProduct] = useState<SharedProduct | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  // Its row on their board (D22, D48), worked out only from what you can see, under the
  // same Rank by as their board.
  const [list, setList] = useState<SharedProduct[] | null>(null);
  const [view, setView] = useState(() => loadOthersView());
  const appearance = useAppearance();

  useEffect(() => {
    const board = p.preview ? fetchPreview() : api.theirBoard(p.username);
    board
      .then((b) => {
        setView(loadOthersView());
        setList(b.products);
        if (p.preview) {
          const mine = b.products.find((x) => x.id === p.id);
          if (mine) setProduct(mine);
          else setError('Your followers can’t see this product.');
        }
      })
      .catch((e) => (p.preview ? setError(errorText(e)) : undefined));
    if (!p.preview)
      api
        .theirProduct(p.username, p.id)
        .then(setProduct)
        .catch((e) => setError(errorText(e)));
  }, [p.username, p.id, p.preview]);

  const backTo = boardPath(p.username, p.preview);
  const tab = p.preview ? 'more' : 'people';
  if (!product) {
    return (
      <>
        <Header title={`@${p.username}`} leaf={false} left={<BackButton to={backTo} />} />
        <main class="screen">{error ? <div class="empty"><h2>Not available</h2><p>{error}</p></div> : <Skeleton kind="product" />}</main>
        <TabBar active={tab} />
      </>
    );
  }
  const o = overall(product.productType, product.ratings);
  const country = countryDisplay(product.country, product.countryOther);
  const labels = productTypeLabel({ ...product, concentrateType: product.concentrateType ?? 'not_set' });
  const photos = product.photos.map(shown);
  const place = list ? boardPlace(list, product.id, view) : null;
  const details: [string, string][] = (
    [
      ['Strain type', STRAIN_TYPES.find((s) => s.key === product.strainType)?.label ?? ''],
      ['Product type', labels.type ?? ''],
      ['Concentrate type', product.productType === 'concentrate' ? labels.concentrate ?? '' : ''],
      ['Country', country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : ''],
      ['Source', product.source ?? ''],
    ] as [string, string][]
  ).filter(([, v]) => v);
  // D59: their Source opens their products from that brand (only ever Source, never where they bought it).
  const value = (k: string, v: string) => (k === 'Source' ? <NameLink name={v} to={brandPath(v, backTo)} /> : v);

  return (
    <>
      <Header title={`@${p.username} / ${product.name}`} leaf={false} left={<BackButton to={backTo} />} />
      <main class={`screen${pageClass(place, appearance)}`} data-band={list ? place?.band ?? 'none' : undefined}>
        <ProductHero
          name={product.name}
          productType={product.productType}
          strainType={product.strainType}
          typeLabel={labels.type}
          concentrateLabel={labels.concentrate}
          country={country}
          overall={o}
          photo={photos[0] ?? null}
          onOpenPhoto={() => setViewing(0)}
          place={place}
          appearance={appearance}
          view={view}
          whose="their"
        />
        <Ratings product={product} />
        {photos.length > 0 && (
          <section class="sect" aria-label="Photos">
            <span class="cap">Photos</span>
            <PhotoGrid photos={photos} cover onOpen={setViewing} />
          </section>
        )}
        {details.length > 0 && (
          <section class="sect" aria-label="Details">
            <span class="cap">Details</span>
            <dl class="kv">{details.map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{value(k, v)}</dd>])}</dl>
          </section>
        )}
        {p.preview && <PreviewNote />}
      </main>
      <TabBar active={tab} />
      {viewing !== null && <PhotoViewer photos={photos} start={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/**
 * Their products from one brand (D59), from their board as you see it: only products whose
 * Source is that brand, so nothing about where they bought anything. With Source not shared
 * (D45) nothing matches.
 */
export function TheirBrandPage(p: { username: string; name: string; preview?: boolean }) {
  const [products, setProducts] = useState<SharedProduct[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (p.preview ? fetchPreview() : api.theirBoard(p.username))
      .then((b) => setProducts(b.products))
      .catch((e) => setError(errorText(e)));
  }, [p.username, p.preview]);
  const key = nameKey(p.name);
  const named = products ? productsNamed(products, key).map((r) => r.product) : [];
  const name = named.find((x) => x.source)?.source ?? p.name;
  const rows = rankProducts(named, { filter: 'all', rankBy: 'overall' });
  const tiles = leaderboardTiles(named);
  const backTo = boardPath(p.username, p.preview);
  const tab = p.preview ? 'more' : 'people';
  return (
    <>
      <Header title={name} leaf={false} left={<BackButton to={backTo} />} />
      <main class="screen">
        {p.preview && <PreviewNote />}
        {!products && !error && <Skeleton kind="board" />}
        {error && (
          <div class="empty">
            <h2>Not available</h2>
            <p>{error}</p>
          </div>
        )}
        {products && named.length === 0 && (
          <EmptyCard art="filter" title={`Nothing from ${name}`}>
            <p>@{p.username} hasn’t shared any products from {name}.</p>
          </EmptyCard>
        )}
        {named.length > 0 && (
          <>
            <p class="lead brand-lead">
              <strong>@{p.username}</strong>’s products from {name}.
            </p>
            {/* PRODUCTS and AVERAGE only, as on their board: never prices or where they bought it. */}
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: tiles.average === null ? '–' : formatScore(tiles.average), label: 'Average' },
              ]}
            />
            <div class="rows">
              {rows.map((r) => (
                <SharedRow key={r.product.id} username={p.username} product={r.product} rank={r.rank} band={r.band} first={r.first} value={r.value} rankBy="overall" preview={p.preview} />
              ))}
            </div>
          </>
        )}
      </main>
      <TabBar active={tab} />
    </>
  );
}
