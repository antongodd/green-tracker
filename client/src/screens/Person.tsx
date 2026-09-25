import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatScore } from '../../../shared/domain/format';
import { leaderboardEmptyState, leaderboardTiles, podiumPlace, rankByCaption, rankProducts, type Podium, type ViewState } from '../../../shared/domain/leaderboard';
import { CardGlint, PhotoGlints, PodiumBadge, podiumClass } from '../components/Podium';
import { photoUrl } from '../../../shared/domain/photo';
import { productTypeLabel } from '../../../shared/domain/product';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { overall } from '../../../shared/domain/ratings';
import type { PersonCard, SharedProduct } from '../../../shared/domain/social';
import { ApiError, errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { ControlRow, Tiles } from '../components/Controls';
import { PhotoGrid } from '../components/PhotoGrid';
import { Cluster, formatRankValue, Glints, Score, StrainTag, Thumb } from '../components/ProductRow';
import { PhotoViewer, type ShownPhoto } from '../components/PhotoViewer';
import { LeafOutline, MoreIcon, TypeMark } from '../icons';
import * as api from '../people';
import { cameFrom, linkTo, openRow } from '../router';
import { rememberRow, restoreRow } from '../scrollReturn';
import { loadOthersView, saveOthersView } from '../viewState';
import { Avatar } from '../components/Avatar';
import { photoOf } from './People';
import { Ratings } from './Profile';

const enc = encodeURIComponent;
const shown = (ph: { id: string; version: string }): ShownPhoto => ({ key: ph.id, thumb: photoUrl(ph, 'thumb'), image: photoUrl(ph, 'cropped'), original: '', crop: null });

/** Their row: identity, flag, type, score; the metadata line carries Source only (D12). */
function SharedRow(p: { username: string; product: SharedProduct; rank: number; podium: Podium | null; value: number | null; rankBy: ViewState['rankBy'] }) {
  const href = `/u/${enc(p.username)}/p/${enc(p.product.id)}`;
  const key = `u:${p.username}`;
  const open = (e: MouseEvent) => {
    rememberRow(key, p.product.id, e.currentTarget as HTMLElement);
    openRow(e, href);
  };
  return (
    <a class={`row${p.podium ? ` tier p${p.podium}` : ''}`} href={href} onClick={open} data-return={`${key}:${p.product.id}`}>
      <Glints podium={p.podium} />
      <span class="rk">{p.rank}</span>
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

/** Someone else's page: their read-only Leaderboard if you follow them; otherwise just a Follow card. */
export function Person(p: { username: string }) {
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [products, setProducts] = useState<SharedProduct[] | null>(null);
  const [view, setView] = useState<ViewState>(loadOthersView);
  const [error, setError] = useState<{ missing: boolean; text: string } | null>(null);
  const arrived = useRef(/^\/u\/[^/]+\/p\//.test(cameFrom() ?? ''));

  useEffect(() => {
    api
      .person(p.username)
      .then(async (card) => {
        setPerson(card);
        if (card.relation === 'following') setProducts(await api.theirProducts(card.username));
      })
      .catch((e) => setError({ missing: e instanceof ApiError && e.status === 404, text: errorText(e) }));
  }, [p.username]);

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !products) return;
    restored.current = true;
    restoreRow(`u:${person!.username}`, arrived.current);
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
  if (!person) return <><Header title={`@${p.username}`} leaf={false} left={<BackButton to="/people" />} /><main class="screen" /><TabBar active="people" /></>;
  if (person.relation !== 'following') return <Stranger person={person} onChange={setPerson} />;

  const rows = products ? rankProducts(products, view) : [];
  const empty = products ? leaderboardEmptyState(products.length, rows.length, view) : null;
  const tiles = leaderboardTiles(rows.map((r) => r.product));
  const change = (next: ViewState) => {
    setView(saveOthersView(next));
    window.scrollTo(0, 0);
  };
  const typeLabel = view.filter === 'all' ? null : productType(view.filter).label;

  // "@username" in the header is the signal you're viewing someone else's tracker (design §8).
  return (
    <>
      <Header title={`@${person.username}`} leaf={false} icon={person.photo && <Avatar username={person.username} src={photoOf(person)} size="hd" />} left={<BackButton to="/people" />} />
      <main class="screen">
        {products && products.length > 0 && (
          <>
            <ControlRow filter={view.filter} rankBy={view.rankBy} money={false} onFilter={(filter) => change({ ...view, filter })} onRankBy={(rankBy) => change({ ...view, rankBy })} />
            {/* PRODUCTS and AVERAGE only — never TOTAL. */}
            <Tiles
              tiles={[
                { value: String(tiles.products), label: 'Products' },
                { value: tiles.average === null ? '–' : formatScore(tiles.average), label: 'Average' },
              ]}
            />
          </>
        )}
        {empty === 'empty' && (
          <div class="empty">
            <LeafOutline />
            <h2>Nothing to see yet</h2>
            <p>@{person.username} hasn’t shared any products.</p>
          </div>
        )}
        {empty === 'filtered-empty' && (
          <div class="empty">
            <LeafOutline />
            <h2>No {typeLabel}</h2>
            <p>None of @{person.username}’s products are {typeLabel}.</p>
            <button class="btn secondary" style={{ width: 'auto' }} onClick={() => change({ ...view, filter: 'all' })}>
              Show all types
            </button>
          </div>
        )}
        {empty === 'rank-empty' && (
          <div class="empty">
            <LeafOutline />
            <h2>Nothing rated on that</h2>
            <p>None of these products has that rating yet.</p>
            <button class="btn secondary" style={{ width: 'auto' }} onClick={() => change({ ...view, rankBy: 'overall' })}>
              Rank by Overall
            </button>
          </div>
        )}
        {rows.length > 0 && (
          <div class="rows">
            {rows.map((r) => (
              <SharedRow key={r.product.id} username={person.username} product={r.product} rank={r.rank} podium={r.podium} value={r.value} rankBy={view.rankBy} />
            ))}
          </div>
        )}
      </main>
      <TabBar active="people" />
    </>
  );
}

/**
 * Their product profile, read-only: hero (no price), ratings, hit time, photos,
 * and details limited to strain type, product type, concentrate type, country and
 * Source (D1). No price history, VFM, notes, Leafly, crop or any action.
 */
export function SharedProfile(p: { username: string; id: string }) {
  const [product, setProduct] = useState<SharedProduct | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  // Its podium place on their board (D22), worked out only from what you can see.
  const [list, setList] = useState<SharedProduct[] | null>(null);
  const [view] = useState(loadOthersView);

  useEffect(() => {
    api
      .theirProduct(p.username, p.id)
      .then(setProduct)
      .catch((e) => setError(errorText(e)));
    api
      .theirProducts(p.username)
      .then(setList)
      .catch(() => {});
  }, [p.username, p.id]);

  const backTo = `/u/${enc(p.username)}`;
  if (!product) {
    return (
      <>
        <Header title={`@${p.username}`} leaf={false} left={<BackButton to={backTo} />} />
        <main class="screen">{error && <div class="empty"><h2>Not available</h2><p>{error}</p></div>}</main>
        <TabBar active="people" />
      </>
    );
  }
  const def = productType(product.productType);
  const o = overall(product.productType, product.ratings);
  const country = countryDisplay(product.country, product.countryOther);
  const labels = productTypeLabel({ ...product, concentrateType: product.concentrateType ?? 'not_set' });
  const photos = product.photos.map(shown);
  const podium = list ? podiumPlace(list, product.id, view) : null;
  const details: [string, string][] = (
    [
      ['Strain type', STRAIN_TYPES.find((s) => s.key === product.strainType)?.label ?? ''],
      ['Product type', labels.type ?? ''],
      ['Concentrate type', product.productType === 'concentrate' ? labels.concentrate ?? '' : ''],
      ['Country', country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : ''],
      ['Source', product.source ?? ''],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <>
      <Header title={`@${p.username} / ${product.name}`} leaf={false} left={<BackButton to={backTo} />} />
      <main class={`screen${podiumClass(podium)}`} data-podium={list ? podium ?? 'none' : undefined}>
        {photos[0] ? (
          <button class="hero-photo" onClick={() => setViewing(0)} aria-label="Open photos">
            <span class="hero-under" style={{ backgroundImage: `url("${photos[0].thumb}")` }} />
            <img src={photos[0].image} alt="" />
            <PhotoGlints podium={podium} />
          </button>
        ) : (
          <div class="hero-photo">
            {def.icon && <TypeMark icon={def.icon} label={def.label} />}
            <PhotoGlints podium={podium} />
          </div>
        )}
        <div class="hero">
          <CardGlint podium={podium} />
          <PodiumBadge podium={podium} view={view} whose="their" />
          <h1>{product.name}</h1>
          <div class={`hero-score${o === null ? ' unrated' : ''}`}>
            <b>{o === null ? '–' : formatScore(o)}</b>
            <span class="cap">{o === null ? 'Unrated' : 'Overall'}</span>
          </div>
          <div class="hero-line">
            <StrainTag strain={product.strainType} />
            {labels.type && <span>{labels.type}</span>}
            {product.productType === 'concentrate' && labels.concentrate && <span>· {labels.concentrate}</span>}
            {country && (
              <span>
                · {country.flag ? `${country.flag} ` : ''}
                {country.name}
              </span>
            )}
          </div>
        </div>
        <Ratings product={product} />
        {photos.length > 0 && (
          <section class="sect" aria-label="Photos">
            <span class="cap">Photos</span>
            <PhotoGrid photos={photos} onOpen={setViewing} />
          </section>
        )}
        {details.length > 0 && (
          <section class="sect" aria-label="Details">
            <span class="cap">Details</span>
            <dl class="kv">{details.map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v}</dd>])}</dl>
          </section>
        )}
      </main>
      <TabBar active="people" />
      {viewing !== null && <PhotoViewer photos={photos} start={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
