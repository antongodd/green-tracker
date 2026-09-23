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
import { cachedProduct, fetchProduct, setFlag } from '../products';
import { cameFrom, linkTo, navigate, savedScroll } from '../router';

function Ratings(p: { product: Product }) {
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

export function Profile(p: { id: string }) {
  const [product, setProduct] = useState<Product | undefined>(cachedProduct(p.id));
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = `/products/${p.id}`;

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
        <TabBar active="leaderboard" />
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
  const back = product.archived ? '/more/archive' : '/';

  return (
    <>
      <Header title={product.name} left={<BackButton to={back} />} right={!product.archived && <a class="hbtn" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>Edit</a>} />
      <main class="screen">
        <div class="hero-photo">{def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>
        <div class="hero">
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
      <TabBar active={product.archived ? 'more' : 'leaderboard'} />
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
