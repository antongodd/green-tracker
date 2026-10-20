import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatAmount, formatGBP, formatScore, formatUnitPrice, formatVFM } from '../../../shared/domain/format';
import { leaflyTarget } from '../../../shared/domain/leafly';
import { headlinePrice, purchasesNewestFirst, unitPrice, valueForMoney } from '../../../shared/domain/money';
import { productTypeLabel, type Product } from '../../../shared/domain/product';
import { productType, RATING_LABELS, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { formatHitTime, overall, overallExplanation, ratedCount } from '../../../shared/domain/ratings';
import { scoreHeat } from '../../../shared/domain/heat';
import { errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { asPurchases, formatIsoDate } from '../components/ProductRow';
import { ExternalIcon, LockIcon, ReturnIcon } from '../icons';
import { cacheProduct, cachedProduct, cachedProducts, changeMark, changing, fetchProduct, fetchProducts, setFlag } from '../products';
import { boardPlace } from '../../../shared/domain/leaderboard';
import { pageClass, useAppearance } from '../components/Gems';
import { ProductHero } from '../components/ProductHero';
import { loadView } from '../viewState';
import { api } from '../api';
import { loadImage, renderCrop, uploadSet } from '../images';
import { PhotoGrid, shownFromRecord } from '../components/PhotoGrid';
import { Cropper, PhotoViewer } from '../components/PhotoViewer';
import { CutoutFlow, type CutoutResult } from '../components/CutoutFlow';
import type { Crop, PhotoRecord } from '../../../shared/domain/photo';
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
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  const [viewing, setViewing] = useState<number | null>(null);
  const [cropping, setCropping] = useState<number | null>(null);
  const [savingCrop, setSavingCrop] = useState<string | null>(null);
  const [cuttingOut, setCuttingOut] = useState<number | null>(null);
  // D52: the cover it replaced fades out over the new one; a short note says it's saved.
  const [oldCover, setOldCover] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const path = `/products/${p.id}`;
  // Its row (D22, D48) comes from the same list and view as the Leaderboard.
  const appearance = useAppearance();
  const [list, setList] = useState(cachedProducts);
  const [view] = useState(() => loadView());
  useEffect(() => {
    if (!list) fetchProducts().then(setList).catch(() => {});
  }, []);

  /** A crop made on the profile is saved straight away (brief §11), rendered from the original. */
  async function saveCrop(index: number, crop: Crop | null, note = 'Saving crop…') {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    setCropping(null);
    setSavingCrop(note);
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
    setSavingCrop(null);
  }

  /**
   * A cut-out made on the profile is saved straight away too (D26), like a crop: its
   * set is a cut-out and the photo keeps the crop it was made from. Errors stay in the flow.
   */
  async function saveCutout(index: number, r: CutoutResult) {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    const upload = await uploadSet({ ...r, cutout: true });
    const res = await api<{ photo: PhotoRecord }>('POST', `/photos/${encodeURIComponent(photo.id)}/crop`, { upload, crop: photo.crop });
    setProduct(cacheProduct({ ...current, photos: current.photos.map((x) => (x.id === photo.id ? res.photo : x)) }));
    setCuttingOut(null);
  }

  /** Set as cover (D52), saved straight away: the photo moves to the front. */
  async function saveCover(index: number) {
    const current = product;
    const photo = current?.photos[index];
    if (!current || !photo) return;
    changing(current.id);
    setViewing(null);
    setError('');
    const was = current.photos[0] ? shownFromRecord(current.photos[0]).image : null;
    // Show it straight away; put it back if the save fails.
    setOldCover(was);
    setProduct({ ...current, photos: [photo, ...current.photos.filter((x) => x.id !== photo.id)] });
    try {
      const r = await api<{ product: Product }>('POST', `/photos/${encodeURIComponent(photo.id)}/cover`);
      setProduct(cacheProduct(r.product));
      setNote('Cover updated');
    } catch (e) {
      setOldCover(null);
      setProduct(current);
      setError(errorText(e));
    }
  }
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(t);
  }, [note]);

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

  /** Return to Log (D50): it becomes a Log entry again, keeping everything else hidden; its page opens. */
  async function moveToLog() {
    setConfirmReturn(false);
    setBusy(true);
    setError('');
    try {
      const entry = await returnToLog(p.id);
      play('log');
      // The product is gone from your list: Back from the entry goes to the Log, not here.
      replaceHistory('/log');
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
  const back = product.archived ? '/more/archive' : from === 'log' ? '/log' : '/';

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
          onOpenPhoto={() => setViewing(0)}
          place={place}
          appearance={appearance}
          view={view}
          whose="your"
          price={price !== null ? formatUnitPrice(product.productType, price) : null}
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
            <PhotoGrid photos={product.photos.map(shownFromRecord)} cover onOpen={setViewing} />
            {savingCrop && <p class="small">{savingCrop}</p>}
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
                <input type="checkbox" role="switch" class="switch" {...switchAttr()} checked={product.private} disabled={busy} onChange={(e) => toggle('private', e.currentTarget.checked)} />
              </label>
              <button class="btn secondary" onClick={() => setConfirmReturn(true)} disabled={busy || !online}>
                <ReturnIcon />
                Return to Log
              </button>
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
          onCutout={(i) => {
            setViewing(null);
            setCuttingOut(i);
          }}
          // Restore background (D26): the photo's crop, rendered from the original again.
          onRestore={(i) => {
            setViewing(null);
            saveCrop(i, product.photos[i]!.crop, 'Restoring background…');
          }}
          onCover={online ? saveCover : undefined}
        />
      )}
      {note && (
        <p class="toast" role="status">
          {note}
        </p>
      )}
      {cropping !== null && product.photos[cropping] && (
        <Cropper original={shownFromRecord(product.photos[cropping]!).original} crop={product.photos[cropping]!.crop} onCancel={() => setCropping(null)} onApply={(crop) => saveCrop(cropping, crop)} />
      )}
      {cuttingOut !== null && product.photos[cuttingOut] && (
        <CutoutFlow source={shownFromRecord(product.photos[cuttingOut]!).image} name={product.name} onCancel={() => setCuttingOut(null)} onApply={(r) => saveCutout(cuttingOut, r)} />
      )}
      {confirmReturn && (
        <Sheet
          title={`Return “${product.name}” to your Log?`}
          message="It leaves your Leaderboard and followers’ view. Its ratings, purchases, notes and photos are kept, hidden, for when you add it back."
          options={[{ label: 'Return to Log', tick: true, onSelect: moveToLog }]}
          onCancel={() => setConfirmReturn(false)}
        />
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
