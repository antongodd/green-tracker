import { useEffect, useRef, useState } from 'preact/hooks';
import { CAPTION_MAX, POST_PHOTOS_MAX, type PostAbout, type PostInput } from '../../../shared/domain/posts';
import type { Crop, PhotoRecord } from '../../../shared/domain/photo';
import { photoUrl } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import type { LogEntry } from '../../../shared/domain/logEntry';
import { overall } from '../../../shared/domain/ratings';
import { ApiError, errorText } from '../api';
import { Header, Sheet } from '../components/chrome';
import { CutoutFlow, type CutoutResult } from '../components/CutoutFlow';
import { Cropper } from '../components/PhotoViewer';
import { AboutCard } from '../components/PostCard';
import { Skeleton } from '../components/Skeleton';
import { Tick } from '../components/Tick';
import { useAppearance } from '../components/Gems';
import { CameraIcon, CameraLineIcon, LockIcon, SearchIcon, TypeMark } from '../icons';
import { PhotoGrid } from '../components/PhotoGrid';
import type { ShownPhoto } from '../components/PhotoViewer';
import { discardUpload, loadImage, prepareNewPhoto, renderCrop, uploadSet } from '../images';
import { fetchEntries, fetchEntry } from '../logEntries';
import { changing, fetchProduct, fetchProducts, forgetProduct } from '../products';
import { createPost } from '../posts';
import { back, navigate } from '../router';
import { play } from '../sounds';
import { productType } from '../../../shared/domain/productTypes';

// Writing a post (D77). From the Feed's + it asks what it's about (something on your Leaderboard,
// something in your Log, or just a photo); from a product's or Log entry's Post button it starts
// with that one. The photo starts as the product's cover (or the entry's photo); you can choose
// another of its photos, or take or choose a new one (then crop it or cut it out). The post gets its
// own copy. A Private product asks first: "Make visible and post" does both in one go.

type About = { kind: 'product'; product: Product } | { kind: 'log'; entry: LogEntry } | { kind: 'none' };
type Step = 'choose' | 'pickProduct' | 'pickLog' | 'compose';

/** A new photo, uploaded at once as a pending set (attached only by Post). */
interface NewPhoto {
  kind: 'new';
  key: string;
  status: 'uploading' | 'ready' | 'error';
  upload?: string;
  original: Blob;
  image: string;
  crop: Crop | null;
  cutout: boolean;
  error?: string;
}

/** D78: a photo in the post: one of the product's or entry's (copied when posted), or a new one. */
type Chosen = { kind: 'own'; key: string; photo: PhotoRecord } | NewPhoto;
let newKey = 0;

const searchText = (s: string) => s.toLocaleLowerCase().normalize('NFKD');

/** The preview of the card followers will see under the photo (built here, as the server will). */
function previewAbout(a: About, preset: PostAbout['preset']): PostAbout | null {
  if (a.kind === 'none') return null;
  if (a.kind === 'log')
    return { kind: 'log', name: a.entry.name, productType: a.entry.productType, productTypeOther: a.entry.productTypeOther, strainType: null, score: null, preset: null, source: null, country: null, countryOther: null, href: null, photo: null };
  const p = a.product;
  return { kind: 'product', name: p.name, productType: p.productType, productTypeOther: p.productTypeOther, strainType: p.strainType, score: overall(p.productType, p.ratings), preset, source: p.source, country: p.country, countryOther: p.countryOther, href: null, photo: p.photos[0] ?? null };
}

function Picker<T extends { id: string; name: string }>(p: { title: string; items: T[] | null; error: string; note: string; row: (item: T) => preact.JSX.Element; onPick: (item: T) => void; onBack: () => void }) {
  const [q, setQ] = useState('');
  const shown = p.items?.filter((x) => searchText(x.name).includes(searchText(q.trim()))) ?? null;
  return (
    <>
      <Header
        title={p.title}
        leaf={false}
        left={
          <button type="button" class="hbtn" onClick={p.onBack}>
            Back
          </button>
        }
      />
      <main class="screen composer">
        <div class="wrap stack" style={{ paddingTop: '12px' }}>
          <label class="search">
            <SearchIcon />
            <span class="visually-hidden">Search</span>
            <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Search" />
          </label>
          {p.error && (
            <p class="error" role="alert">
              {p.error}
            </p>
          )}
          {!shown && !p.error && <Skeleton kind="people" />}
          {shown && shown.length === 0 && <p class="small">{q.trim() ? `Nothing called “${q.trim()}”.` : 'Nothing here yet.'}</p>}
          {shown && shown.length > 0 && (
            <div class="list pick-list">
              {shown.map((x) => (
                <button type="button" key={x.id} class="pick" onClick={() => p.onPick(x)}>
                  {p.row(x)}
                </button>
              ))}
            </div>
          )}
          <p class="small">{p.note}</p>
        </div>
      </main>
    </>
  );
}

const TypeThumb = (p: { type: string; photo?: { id: string; version: string } | null }) => {
  const def = productType(p.type);
  return <span class="thumb">{p.photo ? <img src={photoUrl(p.photo, 'thumb')} alt="" loading="lazy" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}</span>;
};

export function Composer(p: { product?: string; entry?: string }) {
  const appearance = useAppearance();
  const [about, setAbout] = useState<About | null>(null);
  const [step, setStep] = useState<Step>(p.product || p.entry ? 'compose' : 'choose');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [at, setAt] = useState(0); // the one shown big
  const [menu, setMenu] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'private' | null>(null);
  const [editing, setEditing] = useState<{ what: 'crop' | 'cutout'; key: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const posted = useRef(false);
  const latest = useRef(chosen);
  latest.current = chosen;

  // Leaving without posting discards new photos' pending sets.
  useEffect(
    () => () => {
      if (!posted.current) latest.current.forEach((c) => c.kind === 'new' && c.upload && discardUpload(c.upload));
    },
    [],
  );

  const start = (a: About) => {
    setAbout(a);
    const photos = a.kind === 'product' ? a.product.photos : a.kind === 'log' && a.entry.photo ? [a.entry.photo] : [];
    // Its cover to start with; new photos already added stay.
    setChosen((list) => [...(photos[0] ? [{ kind: 'own' as const, key: photos[0].id, photo: photos[0] }] : []), ...list.filter((c) => c.kind === 'new')]);
    setAt(0);
    setStep('compose');
  };

  // From a Post button: the product or entry, then its cover.
  useEffect(() => {
    if (p.product)
      fetchProduct(p.product)
        .then((product) => start({ kind: 'product', product }))
        .catch((e) => setError(errorText(e)));
    if (p.entry)
      fetchEntry(p.entry)
        .then((entry) => start({ kind: 'log', entry }))
        .catch((e) => setError(errorText(e)));
  }, [p.product, p.entry]);

  useEffect(() => {
    if (step === 'pickProduct' && !products)
      fetchProducts()
        .then(setProducts)
        .catch((e) => setError(errorText(e)));
    if (step === 'pickLog' && !entries)
      fetchEntries()
        .then(setEntries)
        .catch((e) => setError(errorText(e)));
  }, [step]);

  const leave = () => back('/feed');

  if (step === 'pickProduct')
    return (
      <Picker
        title="Your Leaderboard"
        items={products?.filter((x) => !x.archived) ?? null}
        error={error}
        note="Archived products and ones returned to the Log aren’t listed: post their Log entry instead."
        onBack={() => setStep('choose')}
        onPick={(product) => start({ kind: 'product', product })}
        row={(x) => {
          const score = overall(x.productType, x.ratings);
          return (
            <>
              <TypeThumb type={x.productType} photo={x.photos[0]} />
              <span class="mid">
                <b>{x.name}</b>
                <span class="small">{productType(x.productType).label}</span>
              </span>
              {x.private && (
                <span class="lock-tag">
                  <LockIcon />
                  Private
                </span>
              )}
              {score !== null && <span class="num sc">{score.toFixed(1)}</span>}
            </>
          );
        }}
      />
    );
  if (step === 'pickLog')
    return (
      <Picker
        title="Your Log"
        items={entries}
        error={error}
        note="Followers see only its name and type."
        onBack={() => setStep('choose')}
        onPick={(entry) => start({ kind: 'log', entry })}
        row={(x) => (
          <>
            <TypeThumb type={x.productType} photo={x.photo} />
            <span class="mid">
              <b>{x.name}</b>
              <span class="small">{productType(x.productType).label}</span>
            </span>
          </>
        )}
      />
    );

  const photos = about?.kind === 'product' ? about.product.photos : about?.kind === 'log' && about.entry.photo ? [about.entry.photo] : [];
  const shownAt = Math.min(at, Math.max(0, chosen.length - 1));
  const big = chosen[shownAt];
  const image = big ? (big.kind === 'own' ? photoUrl(big.photo, 'cropped') : big.image) : null;
  const cut = big ? (big.kind === 'own' ? big.photo.cutout : big.cutout) : false;
  const ready = chosen.length > 0 && chosen.every((c) => c.kind === 'own' || c.status === 'ready');
  const full = chosen.length >= POST_PHOTOS_MAX;
  const left = CAPTION_MAX - [...caption].length;
  const preview = about ? previewAbout(about, appearance.preset) : null;
  const isPrivate = about?.kind === 'product' && about.product.private;
  const update = (key: string, patch: Partial<NewPhoto>) => setChosen((list) => list.map((c) => (c.key === key && c.kind === 'new' ? { ...c, ...patch } : c)));

  /** Its own photos: tap to add or take out. */
  const toggleOwn = (ph: PhotoRecord) =>
    setChosen((list) => (list.some((c) => c.key === ph.id) ? list.filter((c) => c.key !== ph.id) : list.length >= POST_PHOTOS_MAX ? list : [...list, { kind: 'own', key: ph.id, photo: ph }]));

  const pick = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, POST_PHOTOS_MAX - latest.current.length)) {
      const key = `new${++newKey}`;
      setChosen((list) => [...list, { kind: 'new', key, status: 'uploading', original: f, image: URL.createObjectURL(f), crop: null, cutout: false }]);
      setAt(latest.current.length);
      try {
        const set = await prepareNewPhoto(f);
        const upload = await uploadSet(set);
        if (!latest.current.some((c) => c.key === key)) discardUpload(upload);
        else update(key, { status: 'ready', upload, original: set.original, image: URL.createObjectURL(set.cropped) });
      } catch (e) {
        update(key, { status: 'error', error: errorText(e) });
      }
    }
  };
  /** A crop or a cut-out of a new photo: a new pending set, with its original (it's a new photo). */
  const reset = async (key: string, parts: { cropped: Blob; thumb: Blob }, patch: Partial<NewPhoto>) => {
    const cur = latest.current.find((c) => c.key === key);
    if (!cur || cur.kind !== 'new') return;
    update(key, { status: 'uploading' });
    try {
      const upload = await uploadSet({ original: cur.original, ...parts, cutout: patch.cutout });
      if (cur.upload) discardUpload(cur.upload);
      update(key, { ...patch, status: 'ready', upload, image: URL.createObjectURL(parts.cropped) });
    } catch (e) {
      update(key, { status: 'error', error: errorText(e) });
    }
  };
  const crop = async (key: string, c: Crop | null) => {
    setEditing(null);
    const cur = latest.current.find((x) => x.key === key);
    if (!cur || cur.kind !== 'new') return;
    await reset(key, await renderCrop(await loadImage(cur.original), c), { crop: c, cutout: false });
  };
  const cutout = async (key: string, r: CutoutResult) => {
    setEditing(null);
    await reset(key, r, { cutout: true });
  };
  const remove = (i: number) => {
    const c = chosen[i];
    if (c?.kind === 'new' && c.upload) discardUpload(c.upload);
    setChosen((list) => list.filter((_, n) => n !== i));
  };
  const move = (from: number, to: number) =>
    setChosen((list) => {
      const next = [...list];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  const shown: ShownPhoto[] = chosen.map((c) =>
    c.kind === 'own'
      ? { key: c.key, thumb: photoUrl(c.photo, 'thumb'), image: photoUrl(c.photo, 'cropped'), original: '', crop: null, cutout: c.photo.cutout }
      : { key: c.key, thumb: c.image, image: c.image, original: c.original, crop: c.crop, cutout: c.cutout, uploading: c.status === 'uploading' },
  );
  const menuFor = menu !== null ? chosen[menu] : undefined;

  const post = async (makeVisible = false) => {
    if (!about || !ready) return;
    if (isPrivate && !makeVisible) return setSheet('private');
    setSheet(null);
    setBusy(true);
    setError('');
    const input: PostInput = {
      caption,
      about: about.kind === 'product' ? { product: about.product.id } : about.kind === 'log' ? { logEntry: about.entry.id } : null,
      photos: chosen.map((c) => (c.kind === 'own' ? { fromPhotoId: c.photo.id } : { upload: c.upload! })),
      makeVisible,
    };
    // D55: making it visible changes the product, so an older load can't put Private back.
    if (makeVisible && about.kind === 'product') changing(about.product.id);
    try {
      await createPost(input);
      posted.current = true;
      if (about.kind === 'product') forgetProduct(about.product.id);
      play('save');
      navigate('/feed', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'product_private') setSheet('private');
      else setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Header
        title="New post"
        leaf={false}
        left={
          <button type="button" class="hbtn" onClick={leave}>
            Cancel
          </button>
        }
      />
      <main class="screen composer">
        {step === 'compose' && !about && !error && <Skeleton kind="product" />}
        {about && (
          <div class="wrap stack" style={{ paddingTop: '12px' }}>
            {image ? (
              <div class={`compose-photo${cut ? ' cut' : ''}`}>
                <img src={image} alt={`Photo ${shownAt + 1} of the post`} />
                {chosen.length > 1 && <span class="photo-count">{`${shownAt + 1}/${chosen.length}`}</span>}
                {big?.kind === 'new' && big.status === 'uploading' && <span class="up-note">Uploading…</span>}
              </div>
            ) : (
              <button type="button" class="compose-photo pick-photo" onClick={() => file.current?.click()}>
                <CameraLineIcon />
                Take or choose a photo
              </button>
            )}
            {chosen.some((c) => c.kind === 'new' && c.status === 'error') && (
              <p class="error" role="alert">
                {(chosen.find((c) => c.kind === 'new' && c.status === 'error') as NewPhoto).error}
              </p>
            )}
            {chosen.length > 0 && (
              <section class="compose-photos" aria-label="The post’s photos">
                <span class="cap">
                  Photos · {chosen.length} of {POST_PHOTOS_MAX}
                  {chosen.length > 1 ? ' · hold and drag to reorder' : ''}
                </span>
                <PhotoGrid photos={shown} cover onOpen={setAt} onMore={setMenu} onMove={move} status={(i) => (shown[i]!.uploading ? 'Uploading…' : null)}>
                  {!full && (
                    <button type="button" class="add-cell" onClick={() => file.current?.click()}>
                      <CameraIcon />
                      Add photo
                    </button>
                  )}
                </PhotoGrid>
              </section>
            )}
            {photos.length > 1 && (
              <section class="compose-photos" aria-label={`Its photos: tap to add or take out`}>
                <span class="cap">From {about.kind === 'product' ? about.product.name : 'it'}: tap to add</span>
                <div class="photo-pick">
                  {photos.map((ph, i) => {
                    const on = chosen.some((c) => c.key === ph.id);
                    return (
                      <button key={ph.id} type="button" aria-pressed={on} aria-label={`Its photo ${i + 1}`} class={on ? 'on' : ''} disabled={!on && full} onClick={() => toggleOwn(ph)}>
                        <img src={photoUrl(ph, 'thumb')} alt="" />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <input
              ref={file}
              class="visually-hidden"
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.currentTarget.files;
                pick(f).finally(() => undefined);
                e.currentTarget.value = '';
              }}
            />

            <label class="cap" for="caption">
              Caption
            </label>
            <textarea id="caption" class="caption-input" maxLength={CAPTION_MAX} placeholder="What’s it like?" value={caption} onInput={(e) => setCaption(e.currentTarget.value)} />
            {left <= 50 && <div class={`count${left < 0 ? ' over' : ''}`}>{left} left</div>}

            <span class="cap">What followers see under the photo</span>
            {preview ? <AboutCard about={preview} /> : <p class="small">Just the photo and caption: no card.</p>}
            {about.kind === 'log' && <p class="small">Only its name and type. It doesn’t open for followers.</p>}
            {!p.product && !p.entry && (
              <button type="button" class="link-btn" onClick={() => setStep('choose')}>
                Change what it’s about
              </button>
            )}
          </div>
        )}
        {error && (
          <p class="error wrap" role="alert">
            {error}
          </p>
        )}
      </main>
      {about && (
        <div class="compose-bar" role="region" aria-label="Post it">
          <button type="button" class="btn primary has-tick" disabled={!ready || busy || left < 0} onClick={() => post()}>
            {busy ? 'Posting…' : 'Post'}
            <Tick />
          </button>
          {!image && <p class="why">Add a photo to post</p>}
        </div>
      )}
      {step === 'choose' && (
        <Sheet
          title="What’s this about?"
          options={[
            { label: 'Something on my Leaderboard', onSelect: () => setStep('pickProduct') },
            { label: 'Something in my Log', onSelect: () => setStep('pickLog') },
            { label: 'Just a photo', onSelect: () => (about?.kind === 'none' ? setStep('compose') : start({ kind: 'none' })) },
          ]}
          onCancel={() => (about ? setStep('compose') : leave())}
        />
      )}
      {sheet === 'private' && (
        <Sheet
          title="This product is private."
          message="Your followers can’t see it. Make it visible and post it?"
          options={[{ label: 'Make visible and post', tick: true, onSelect: () => post(true) }]}
          onCancel={() => setSheet(null)}
        />
      )}
      {menu !== null && menuFor && (
        <Sheet
          title={`Photo ${menu + 1}${menu === 0 ? ' · shown first' : ''}`}
          options={[
            ...(menu > 0 ? [{ label: 'Show first', onSelect: () => (setMenu(null), move(menu, 0)) }] : []),
            ...(menuFor.kind === 'new' && menuFor.status === 'ready'
              ? [
                  { label: 'Crop', onSelect: () => (setMenu(null), setEditing({ what: 'crop', key: menuFor.key })) },
                  menuFor.cutout
                    ? { label: 'Restore background', onSelect: () => (setMenu(null), crop(menuFor.key, menuFor.crop)) }
                    : { label: 'Remove background', onSelect: () => (setMenu(null), setEditing({ what: 'cutout', key: menuFor.key })) },
                ]
              : []),
            { label: 'Remove from the post', danger: true, onSelect: () => (setMenu(null), remove(menu)) },
          ]}
          onCancel={() => setMenu(null)}
        />
      )}
      {editing &&
        (() => {
          const c = chosen.find((x) => x.key === editing.key);
          if (!c || c.kind !== 'new') return null;
          return editing.what === 'crop' ? (
            <Cropper original={c.original} crop={c.crop} onCancel={() => setEditing(null)} onApply={(v) => crop(c.key, v)} />
          ) : (
            <CutoutFlow source={c.image} name={about?.kind === 'product' ? about.product.name : undefined} onCancel={() => setEditing(null)} onApply={(r) => cutout(c.key, r)} />
          );
        })()}
    </>
  );
}

