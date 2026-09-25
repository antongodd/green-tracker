import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatAmount, formatGBP, formatScore, formatUnitPrice, formatVFM } from '../../../shared/domain/format';
import { leaflyTarget } from '../../../shared/domain/leafly';
import { headlinePrice, purchasesNewestFirst, unitPrice, valueForMoney } from '../../../shared/domain/money';
import { productTypeLabel, type Product } from '../../../shared/domain/product';
import { productType, RATING_LABELS, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { formatHitTime, overall, overallExplanation, ratedCount } from '../../../shared/domain/ratings';
import { errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { asPurchases, formatIsoDate, StrainTag } from '../components/ProductRow';
import { ExternalIcon, LockIcon, TypeMark } from '../icons';
import { cacheProduct, cachedProduct, cachedProducts, fetchProduct, fetchProducts, setFlag } from '../products';
import { podiumPlace } from '../../../shared/domain/leaderboard';
import { CardGlint, PhotoGlints, PodiumBadge, podiumClass } from '../components/Podium';
import { loadView } from '../viewState';
import { api } from '../api';
import { loadImage, renderCrop, uploadSet } from '../images';
import { PhotoGrid, shownFromRecord } from '../components/PhotoGrid';
import { Cropper, PhotoViewer } from '../components/PhotoViewer';
import type { Crop, PhotoRecord } from '../../../shared/domain/photo';
import { cameFrom, linkTo, navigate, savedScroll } from '../router';

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
        return (
          <div key={slot.key} class={`rbar${slot.weight === 0 ? ' muted' : ''}`}>
            <span>{RATING_LABELS[slot.key]}</span>
            <div class="track">{v != null && <div class="fill" style={{ width: `${v * 10}%` }} />}</div>
            <span class={`v${v == null ? ' none' : ''}`}>{v == null ? '—' : formatScore(v)}</span>
          </div>
        );
      })}
      <p class="small">{overallExplanation(type)}</p>
      <p class="small">
        Rated {count.rated} of {count.of} categories
      </p>
      {type === 'edibles' && (
        <div class="vfm">
          <span class="cap">Hit time</span>
          <span class="num">{formatHitTime(p.product.hitTimeMinutes)}</span>
        </div>
      )}
    </section>
  );
}

function PriceHistory(p: { product: Product }) {
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
        return (
          <div class="purchase" key={pu.id}>
            <span class="d">
              {pu.date ? formatIsoDate(pu.date) : 'No date'}
              {i === 0 && <span class="latest">Latest</span>}
            </span>
            <span class="u">{up === null ? '' : formatUnitPrice(type, up)}</span>
            <span class="s">{[pu.amount !== null ? formatAmount(type, pu.amount) : null, formatGBP(pu.totalPaid)].filter(Boolean).join(' · ')}</span>
            <span class="s r">{pu.supplier ?? ''}</span>
          </div>
        );
      })}
      {vfm !== null && (
        <div class="vfm">
          <span>
            <span class="cap">Value for money</span>
            <span class="small" style={{ display: 'block' }}>
              Overall ÷ latest {type === 'edibles' ? '£ per 100mg' : '£/g'} · higher is better
            </span>
          </span>
          <b>{formatVFM(vfm)}</b>
        </div>
      )}
    </section>
  );
}

/** Which list a profile was opened from, so its tab and Back fallback match (brief §10.2). */
const origin = new Map<string, 'log' | 'leaderboard'>();

export function Profile(p: { id: string }) {
  const [from] = useState(() => {
    const came = cameFrom();
    if (came === '/log') origin.set(p.id, 'log');
    else if (came === '/' || came === '/products/new') origin.set(p.id, 'leaderboard');
    return origin.get(p.id) ?? 'leaderboard';
  });
  const [product, setProduct] = useState<Product | undefined>(cachedProduct(p.id));
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [cropping, setCropping] = useState<number | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);
  const path = `/products/${p.id}`;
  // Its podium place (D22) comes from the same list and view as the Leaderboard.
  const [list, setList] = useState(cachedProducts);
  const [view] = useState(loadView);
  useEffect(() => {
    if (!list) fetchProducts().then(setList).catch(() => {});
  }, []);

  /** A crop made on the profile is saved straight away (brief §11), rendered from the original. */
  async function saveCrop(index: number, crop: Crop | null) {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    setCropping(null);
    setSavingCrop(true);
    setError('');
    try {
      const original = await loadImage(shownFromRecord(photo).original as string);
      const upload = await uploadSet(await renderCrop(original, crop));
      const r = await api<{ photo: PhotoRecord }>('POST', `/photos/${encodeURIComponent(photo.id)}/crop`, { upload, crop });
      const updated = { ...current, photos: current.photos.map((x) => (x.id === photo.id ? r.photo : x)) };
      setProduct(cacheProduct(updated));
    } catch (e) {
      setError(errorText(e));
    }
    setSavingCrop(false);
  }

  useEffect(() => {
    fetchProduct(p.id)
      .then(setProduct)
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

  if (!product) {
    return (
      <>
        <Header title="" left={<BackButton to="/" />} />
        <main class="screen">
          {error && (
            <div class="empty">
              <h2>Couldn’t open this product</h2>
              <p>{error}</p>
            </div>
          )}
        </main>
        <TabBar active={from} />
      </>
    );
  }

  const def = productType(product.productType);
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
  const podium = list && !product.archived ? podiumPlace([...list.filter((x) => x.id !== product.id), product], product.id, view) : null;
  const back = product.archived ? '/more/archive' : from === 'log' ? '/log' : '/';

  return (
    <>
      <Header title={product.name} left={<BackButton to={back} />} right={!product.archived && <a class="hbtn" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>Edit</a>} />
      <main class={`screen${podiumClass(podium)}`} data-podium={list ? podium ?? 'none' : undefined}>
        {product.photos[0] ? (
          <button class="hero-photo" onClick={() => setViewing(0)} aria-label="Open photos">
            {/* The thumbnail (already on the device) shows until the full photo arrives (D20). */}
            <span class="hero-under" style={{ backgroundImage: `url("${shownFromRecord(product.photos[0]).thumb}")` }} />
            <img src={shownFromRecord(product.photos[0]).image} alt="" />
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
          <PodiumBadge podium={podium} view={view} whose="your" />
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
          {price !== null && <div class="hero-price">{formatUnitPrice(product.productType, price)}</div>}
          {(product.private || product.archived) && (
            <div class="badge-line">
              {product.private && (
                <span class="pill-note">
                  <LockIcon /> Private
                </span>
              )}
              {product.archived && <span class="pill-note">Archived</span>}
            </div>
          )}
        </div>

        <Ratings product={product} />
        {product.photos.length > 0 && (
          <section class="sect" aria-label="Photos">
            <span class="cap">Photos</span>
            <PhotoGrid photos={product.photos.map(shownFromRecord)} onOpen={setViewing} onCrop={setCropping} />
            {savingCrop && <p class="small">Saving crop…</p>}
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
              {shown.map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v}</dd>])}
            </dl>
          </section>
        )}
        <section class="sect" aria-label="Actions">
          {product.archived ? (
            <button class="btn primary" onClick={() => toggle('archived', false)} disabled={busy}>
              Un-archive
            </button>
          ) : (
            <>
              <a class="btn primary" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>
                Edit
              </a>
              <label class="switch-row">
                <span>
                  Private
                  <span class="small">Hidden from your followers</span>
                </span>
                <input type="checkbox" role="switch" class="switch" checked={product.private} disabled={busy} onChange={(e) => toggle('private', e.currentTarget.checked)} />
              </label>
              <button class="btn danger" onClick={() => setConfirmArchive(true)} disabled={busy}>
                Archive
              </button>
            </>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
      <TabBar active={product.archived ? 'more' : from} />
      {viewing !== null && (
        <PhotoViewer
          photos={product.photos.map(shownFromRecord)}
          start={viewing}
          onClose={() => setViewing(null)}
          onCrop={(i) => {
            setViewing(null);
            setCropping(i);
          }}
        />
      )}
      {cropping !== null && product.photos[cropping] && (
        <Cropper original={shownFromRecord(product.photos[cropping]!).original} crop={product.photos[cropping]!.crop} onCancel={() => setCropping(null)} onApply={(crop) => saveCrop(cropping, crop)} />
      )}
      {confirmArchive && (
        <Sheet
          title={`Archive “${product.name}”?`}
          message="It leaves your Leaderboard, Log, tiles and followers’ view. Its data is kept, and you can un-archive it from More → Archive."
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
