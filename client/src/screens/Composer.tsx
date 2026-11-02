import { useEffect, useRef, useState } from 'preact/hooks';
import { CAPTION_MAX, type PostAbout, type PostInput } from '../../../shared/domain/posts';
import type { Crop } from '../../../shared/domain/photo';
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
import { CameraLineIcon, LockIcon, SearchIcon, TypeMark } from '../icons';
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
  status: 'uploading' | 'ready' | 'error';
  upload?: string;
  original: Blob;
  image: string;
  crop: Crop | null;
  cutout: boolean;
  error?: string;
}

const searchText = (s: string) => s.toLocaleLowerCase().normalize('NFKD');

/** The preview of the card followers will see under the photo (built here, as the server will). */
function previewAbout(a: About, preset: PostAbout['preset']): PostAbout | null {
  if (a.kind === 'none') return null;
  if (a.kind === 'log')
    return { kind: 'log', name: a.entry.name, productType: a.entry.productType, productTypeOther: a.entry.productTypeOther, strainType: null, score: null, preset: null, source: null, country: null, countryOther: null, href: null };
  const p = a.product;
  return { kind: 'product', name: p.name, productType: p.productType, productTypeOther: p.productTypeOther, strainType: p.strainType, score: overall(p.productType, p.ratings), preset, source: p.source, country: p.country, countryOther: p.countryOther, href: null };
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
  const [existing, setExisting] = useState<string | null>(null); // a photo id of the product or entry
  const [fresh, setFresh] = useState<NewPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'private' | null>(null);
  const [editing, setEditing] = useState<'crop' | 'cutout' | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const posted = useRef(false);
  const latestFresh = useRef(fresh);
  latestFresh.current = fresh;

  // Leaving without posting discards a new photo's pending set.
  useEffect(
    () => () => {
      const f = latestFresh.current;
      if (!posted.current && f?.upload) discardUpload(f.upload);
    },
    [],
  );

  const start = (a: About) => {
    setAbout(a);
    const photos = a.kind === 'product' ? a.product.photos : a.kind === 'log' && a.entry.photo ? [a.entry.photo] : [];
    setExisting(photos[0]?.id ?? null);
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
  const chosen = photos.find((x) => x.id === existing);
  const image = fresh ? fresh.image : chosen ? photoUrl(chosen, 'cropped') : null;
  const cut = fresh ? fresh.cutout : !!chosen?.cutout;
  const ready = fresh ? fresh.status === 'ready' : !!chosen;
  const left = CAPTION_MAX - [...caption].length;
  const preview = about ? previewAbout(about, appearance.preset) : null;
  const isPrivate = about?.kind === 'product' && about.product.private;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (fresh?.upload) discardUpload(fresh.upload);
    const local = URL.createObjectURL(f);
    setFresh({ status: 'uploading', original: f, image: local, crop: null, cutout: false });
    try {
      const set = await prepareNewPhoto(f);
      const upload = await uploadSet(set);
      setFresh({ status: 'ready', upload, original: set.original, image: URL.createObjectURL(set.cropped), crop: null, cutout: false });
    } catch (e) {
      setFresh((cur) => cur && { ...cur, status: 'error', error: errorText(e) });
    }
  };
  /** A crop or a cut-out of the new photo: a new pending set, with its original (it's a new photo). */
  const reset = async (parts: { cropped: Blob; thumb: Blob }, patch: Partial<NewPhoto>) => {
    const cur = fresh!;
    setFresh({ ...cur, status: 'uploading' });
    try {
      const upload = await uploadSet({ original: cur.original, ...parts, cutout: patch.cutout });
      if (cur.upload) discardUpload(cur.upload);
      setFresh({ ...cur, ...patch, status: 'ready', upload, image: URL.createObjectURL(parts.cropped) });
    } catch (e) {
      setFresh({ ...cur, status: 'error', error: errorText(e) });
    }
  };
  const crop = async (c: Crop | null) => {
    setEditing(null);
    const original = await loadImage(fresh!.original);
    await reset(await renderCrop(original, c), { crop: c, cutout: false });
  };
  const cutout = async (r: CutoutResult) => {
    setEditing(null);
    await reset(r, { cutout: true });
  };
  const removePhoto = () => {
    if (fresh?.upload) discardUpload(fresh.upload);
    setFresh(null);
    setExisting(null);
  };

  const post = async (makeVisible = false) => {
    if (!about || !ready) return;
    if (isPrivate && !makeVisible) return setSheet('private');
    setSheet(null);
    setBusy(true);
    setError('');
    const input: PostInput = {
      caption,
      about: about.kind === 'product' ? { product: about.product.id } : about.kind === 'log' ? { logEntry: about.entry.id } : null,
      photo: fresh ? { upload: fresh.upload! } : { fromPhotoId: chosen!.id },
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
                <img src={image} alt="The post’s photo" />
                {fresh?.status === 'uploading' && <span class="up-note">Uploading…</span>}
              </div>
            ) : (
              <button type="button" class="compose-photo pick-photo" onClick={() => file.current?.click()}>
                <CameraLineIcon />
                Take or choose a photo
              </button>
            )}
            {fresh?.status === 'error' && (
              <p class="error" role="alert">
                {fresh.error}
              </p>
            )}
            {!fresh && photos.length > 1 && (
              <div class="photo-pick" role="radiogroup" aria-label="Choose another of its photos">
                {photos.map((ph, i) => (
                  <button key={ph.id} type="button" role="radio" aria-checked={ph.id === existing} aria-label={`Photo ${i + 1}`} class={ph.id === existing ? 'on' : ''} onClick={() => setExisting(ph.id)}>
                    <img src={photoUrl(ph, 'thumb')} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div class="chips">
              {image && (
                <button type="button" class="chip" onClick={() => file.current?.click()}>
                  <CameraLineIcon />
                  New photo
                </button>
              )}
              {fresh?.status === 'ready' && (
                <>
                  <button type="button" class="chip" onClick={() => setEditing('crop')}>
                    Crop
                  </button>
                  <button type="button" class="chip" onClick={() => (fresh.cutout ? crop(fresh.crop) : setEditing('cutout'))}>
                    {fresh.cutout ? 'Restore background' : 'Cut out'}
                  </button>
                </>
              )}
              {image && (
                <button type="button" class="chip dng" onClick={removePhoto}>
                  Remove
                </button>
              )}
            </div>
            <input
              ref={file}
              class="visually-hidden"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                pick(f);
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
      {editing === 'crop' && fresh && <Cropper original={fresh.original} crop={fresh.crop} onCancel={() => setEditing(null)} onApply={crop} />}
      {editing === 'cutout' && fresh && <CutoutFlow source={fresh.image} name={about?.kind === 'product' ? about.product.name : undefined} onCancel={() => setEditing(null)} onApply={cutout} />}
    </>
  );
}

