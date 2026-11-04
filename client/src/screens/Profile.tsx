import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatAmount, formatMoney, formatScore, formatUnitPrice, formatVFM } from '../../../shared/domain/format';
import { currencySign } from '../../../shared/domain/currency';
import { useCurrency } from '../money';
import { leaflyTarget } from '../../../shared/domain/leafly';
import { headlinePrice, paidInMain, purchasesNewestFirst, unitPrice, valueForMoney } from '../../../shared/domain/money';
import { productTypeLabel, type Product } from '../../../shared/domain/product';
import { productType, RATING_LABELS, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { formatHitTime, overall, overallExplanation, ratedCount } from '../../../shared/domain/ratings';
import { scoreHeat } from '../../../shared/domain/heat';
import { errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { asPurchases, formatIsoDate } from '../components/ProductRow';
import { BoxIcon, ExternalIcon, LockIcon, PostIcon, ReturnIcon } from '../icons';
import { cachedProduct, cachedProducts, changeMark, changing, fetchProduct, fetchProducts, setFlag } from '../products';
import { boardPlace } from '../../../shared/domain/leaderboard';
import { pageClass, useAppearance } from '../components/Gems';
import { ProductHero } from '../components/ProductHero';
import { loadView } from '../viewState';
import { PhotoGrid, shownFromRecord } from '../components/PhotoGrid';
import { usePhotoEdits } from '../components/ProductPhotos';
import { cameFrom, linkTo, navigate, replaceHistory, savedScroll } from '../router';
import { returnToLog } from '../logEntries';
import { useOnline } from '../online';
import { Skeleton } from '../components/Skeleton';
import { brandPath, NameLink } from '../components/NameLink';
import { play, switchAttr } from '../sounds';

/** Rating bars, Rated N of N and hit time — shared with the follower's read-only profile. */
export function Ratings(p: { product: Pick<Product, 'productType' | 'ratings' | 'hitTimeMinutes'> }) {
  const { productType: type, ratings } = p.product;
  const def = productType(type);
  const count = ratedCount(type, ratings);
  return (
    <section class="sect" aria-labelledby="ratings-h">
      <span class="cap" id="ratings-h">
        Ratings
      </span>
      {def.ratingSet.map((slot) => {
        const v = ratings[slot.key];
        // Heat (D32): a counting category's bar and number take its score's colour, the
        // Leaderboard's scale (D30); High where it doesn't count stays grey.
        const heat = slot.weight > 0 && v != null ? scoreHeat(slot.key, v) : null;
        return (
          <div key={slot.key} class={`rbar${slot.weight === 0 ? ' muted' : ''}`} data-heat={heat ?? undefined} style={heat ? { '--heat': heat } : undefined}>
            <span>{RATING_LABELS[slot.key]}</span>
            <div class="track">{v != null && <div class="fill" style={{ width: `${v * 10}%` }} />}</div>
            <span class={`v${v == null ? ' none' : ''}`}>{v == null ? '–' : formatScore(v)}</span>
          </div>
        );
      })}
      <p class="small">{overallExplanation(type)}</p>
      <p class="small">
        Rated {count.rated} of {count.of} categories
      </p>
      {type === 'edibles' && (
        <div class="vfm">
          <span class="cap">Time to kick in</span>
          <span class="num">{formatHitTime(p.product.hitTimeMinutes)}</span>
        </div>
      )}
    </section>
  );
}

function PriceHistory(p: { product: Product }) {
  const main = useCurrency();
  const type = p.product.productType;
  const history = purchasesNewestFirst(p.product.purchases);
  const vfm = valueForMoney(type, p.product.ratings, asPurchases(p.product));
  if (history.length === 0) return null;
  return (
    <section class="sect" aria-labelledby="price-h">
      <span class="cap" id="price-h">
        Price history
      </span>
      {history.map((pu, i) => {
        const up = unitPrice(pu);
        // D66: as you paid it, and in another currency what it came to in your main one.
        const foreign = pu.currency !== main;
        const paid = `${formatMoney(pu.totalPaid, pu.currency)}${foreign ? ` (≈ ${formatMoney(paidInMain(pu), main)})` : ''}`;
        return (
          <div class="purchase" key={pu.id}>
            <span class="d">
              {pu.date ? formatIsoDate(pu.date) : 'No date'}
              {i === 0 && <span class="latest">Latest</span>}
              {foreign && (
                <span class="fx" title={`Paid in ${currencySign(pu.currency)}`}>
                  {currencySign(pu.currency)}
                </span>
              )}
            </span>
            <span class="u">{up === null ? '' : formatUnitPrice(type, up, main)}</span>
            <span class="s">{[pu.amount !== null ? formatAmount(type, pu.amount) : null, paid].filter(Boolean).join(' · ')}</span>
            {/* D59: where you bought it opens everything from there. */}
            <span class="s r">{pu.supplier ? <NameLink name={pu.supplier} to={brandPath(pu.supplier)} /> : ''}</span>
          </div>
        );
      })}
      {vfm !== null && (
        <div class="vfm">
          <span>
            <span class="cap">Value for money</span>
            <span class="small" style={{ display: 'block' }}>
              Overall score divided by the latest price {type === 'edibles' ? 'per 20mg (counted as 1g of flower)' : 'per gram'}. Higher is better.
            </span>
          </span>
          <b>{formatVFM(vfm)}</b>
        </div>
      )}
    </section>
  );
}

/** Which list a profile was opened from, so its tab and Back fallback match (brief §10.2). */
// D92: from Strainz (a strain's page) or the Log, the product belongs to the Strainz tab; Back goes to where it was.
const origin = new Map<string, string>();

export function Profile(p: { id: string }) {
  const [backTo] = useState(() => {
    const came = cameFrom();
    if (came === '/log' || came?.startsWith('/strainz')) origin.set(p.id, came);
    else if (came === '/' || came === '/products/new') origin.set(p.id, '/');
    return origin.get(p.id) ?? '/';
  });
  const from = backTo === '/' ? 'leaderboard' : 'strainz';
  const [product, setProduct] = useState<Product | undefined>(cachedProduct(p.id));
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  // D52: the cover it replaced fades out over the new one.
  const [oldCover, setOldCover] = useState<string | null>(null);
  const path = `/products/${p.id}`;
  // Its row (D22, D48) comes from the same list and view as the Leaderboard.
  const appearance = useAppearance();
  const main = useCurrency();
  const [list, setList] = useState(cachedProducts);
  const [view] = useState(() => loadView());
  useEffect(() => {
    if (!list) fetchProducts().then(setList).catch(() => {});
  }, []);

  // The viewer, Crop, Cut out and Set as cover (D52), shared with the lists' photo taps (D79).
  const photos = usePhotoEdits({ product, setProduct, onError: setError, onCoverFrom: setOldCover });

  useEffect(() => {
    // D55: if you change it while this loads (Private, a new cover…), this older copy is dropped.
    const mark = changeMark(p.id);
    fetchProduct(p.id)
      .then((fresh) => {
        if (changeMark(p.id) === mark) setProduct(fresh);
      })
      .catch((e) => setError(errorText(e)));
  }, [p.id]);

  // Profile → editor → back lands where you were (brief §10.3).
  const [restored, setRestored] = useState(false);
  useLayoutEffect(() => {
    if (restored || !product) return;
    setRestored(true);
    const y = savedScroll(path);
    if (cameFrom() === `${path}/edit` && y !== undefined) window.scrollTo(0, y);
  }, [product, restored, path]);

  async function toggle(flag: 'private' | 'archived', value: boolean) {
    const before = product;
    setBusy(true);
    setError('');
    setConfirmArchive(false);
    changing(p.id);
    // Show the new state straight away; put it back if the save fails.
    setProduct((cur) => cur && { ...cur, [flag]: value });
    try {
      setProduct(await setFlag(p.id, flag, value));
    } catch (e) {
      setProduct(before);
      setError(errorText(e));
    }
    setBusy(false);
  }

  /** Return to Log (D50; "Move to Tried, not rated" in D92, "Move to Unranked" since 0.82.0): it becomes a Log entry again, keeping everything else hidden; its page opens. */
  async function moveToLog() {
    setConfirmReturn(false);
    setBusy(true);
    setError('');
    try {
      const entry = await returnToLog(p.id);
      play('log');
      // The product is gone from your list: Back from the entry goes to Strainz, where it now shows, not here.
      replaceHistory('/strainz');
      navigate(`/log/${entry.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  if (!product) {
    return (
      <>
        <Header title="" left={<BackButton to="/" />} />
        <main class="screen">
          {error ? (
            <div class="empty">
              <h2>Couldn’t open this product</h2>
              <p>{error}</p>
            </div>
          ) : (
            <Skeleton kind="product" />
          )}
        </main>
        <TabBar active={from} />
      </>
    );
  }

  const o = overall(product.productType, product.ratings);
  const price = headlinePrice(asPurchases(product));
  const country = countryDisplay(product.country, product.countryOther);
  const labels = productTypeLabel(product);
  const leafly = leaflyTarget(product.leaflyLink, product.name);
  const strain = STRAIN_TYPES.find((s) => s.key === product.strainType)?.label;
  const details: [string, string][] = [
    ['Strain type', strain ?? ''],
    ['Product type', labels.type ?? ''],
    ['Concentrate type', product.productType === 'concentrate' ? labels.concentrate ?? '' : ''],
    ['Country', country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : ''],
    ['Source', product.source ?? ''],
    ['Date tried', product.dateTried ? formatIsoDate(product.dateTried) : ''],
  ];
  const shown = details.filter(([, v]) => v);
  const ranked = list ? [...list.filter((x) => x.id !== product.id), product] : null;
  const place = ranked && !product.archived ? boardPlace(ranked, product.id, view) : null;
  const back = product.archived ? '/more/archive' : backTo;

  return (
    <>
      <Header title={product.name} left={<BackButton to={back} />} right={!product.archived && <a class="hbtn" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>Edit</a>} />
      <main class={`screen${pageClass(place, appearance)}`} data-band={ranked ? place?.band ?? 'none' : undefined}>
        <ProductHero
          name={product.name}
          productType={product.productType}
          strainType={product.strainType}
          typeLabel={labels.type}
          concentrateLabel={labels.concentrate}
          country={country}
          overall={o}
          photo={product.photos[0] ? shownFromRecord(product.photos[0]) : null}
          fadeFrom={oldCover}
          onFaded={() => setOldCover(null)}
          onOpenPhoto={() => photos.open(0)}
          place={place}
          appearance={appearance}
          view={view}
          whose="your"
          price={price !== null ? formatUnitPrice(product.productType, price, main) : null}
          notes={
            (product.private || product.archived) && (
              <div class="badge-line">
                {product.private && (
                  <span class="pill-note">
                    <LockIcon /> Private
                  </span>
                )}
                {product.archived && <span class="pill-note">Archived</span>}
              </div>
            )
          }
        />

        <Ratings product={product} />
        {product.photos.length > 0 && (
          <section class="sect" aria-label="Photos">
            <span class="cap">Photos</span>
            <PhotoGrid photos={product.photos.map(shownFromRecord)} cover onOpen={photos.open} />
            {photos.saving && <p class="small">{photos.saving}</p>}
          </section>
        )}
        <PriceHistory product={product} />
        {product.notes && (
          <section class="sect" aria-label="Notes">
            <span class="cap">Notes</span>
            <p class="notes">{product.notes}</p>
          </section>
        )}
        <section class="sect" aria-label="Leafly">
          <span class="cap">Leafly</span>
          <a class="btn secondary" href={leafly.url} target="_blank" rel="noopener noreferrer">
            {leafly.label} <ExternalIcon />
          </a>
        </section>
        {shown.length > 0 && (
          <section class="sect" aria-label="Details">
            <span class="cap">Details</span>
            <dl class="kv">
              {shown.map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{k === 'Source' ? <NameLink name={v} to={brandPath(v)} /> : v}</dd>])}
            </dl>
          </section>
        )}
        <section class="sect" aria-label="Actions">
          {product.archived ? (
            <button class="btn primary" onClick={() => toggle('archived', false)} disabled={busy}>
              Bring back
            </button>
          ) : (
            /* D87: Edit lives at the top (as in Apple's apps); the rest is one grouped list, Archive last in red. */
            <div class="acts">
              <label class="switch-row">
                <span>
                  Private
                  <span class="small">Hidden from your followers</span>
                </span>
                <input type="checkbox" role="switch" class="switch" {...switchAttr()} checked={product.private} disabled={busy} onChange={(e) => toggle('private', e.currentTarget.checked)} />
              </label>
              {/* D77: post it to your followers (a Private one asks first, in the composer). */}
              <a class="act" href={`/feed/new/p/${encodeURIComponent(product.id)}`} onClick={linkTo(`/feed/new/p/${encodeURIComponent(product.id)}`)}>
                <PostIcon />
                Post
              </a>
              <button class="act" onClick={() => setConfirmReturn(true)} disabled={busy || !online}>
                <ReturnIcon />
                Move to Unranked
              </button>
              <button class="act danger" onClick={() => setConfirmArchive(true)} disabled={busy}>
                <BoxIcon />
                Archive
              </button>
            </div>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
      <TabBar active={product.archived ? 'more' : from} />
      {photos.overlays}
      {confirmReturn && (
        <Sheet
          title={`Move “${product.name}” to Unranked?`}
          message="It leaves your Leaderboard and followers’ view, and shows on Strainz under Unranked. Its ratings, purchases, notes and photos are kept, hidden, for when you add it back."
          options={[{ label: 'Move to Unranked', tick: true, onSelect: moveToLog }]}
          onCancel={() => setConfirmReturn(false)}
        />
      )}
      {confirmArchive && (
        <Sheet
          title={`Archive “${product.name}”?`}
          message="It leaves your Leaderboard, Log, totals and followers’ view. Its data is kept, and you can bring it back from Settings → Archive."
          options={[
            {
              label: 'Archive',
              danger: true,
              onSelect: async () => {
                await toggle('archived', true);
                navigate('/', { replace: true });
              },
            },
          ]}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </>
  );
}
