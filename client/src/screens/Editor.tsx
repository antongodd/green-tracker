import { useEffect, useRef, useState } from 'preact/hooks';
import { autoCapitalise } from '../../../shared/domain/capitalise';
import { OTHER_COUNTRY } from '../../../shared/domain/countries';
import { formatScore, formatUnitPrice } from '../../../shared/domain/format';
import { unitPrice } from '../../../shared/domain/money';
import { emptyProductInput, productToInput, validateProductInput, type Product, type ProductInput } from '../../../shared/domain/product';
import { RATING_LABELS, productType, unitFor, type ProductTypeKey, type RatingKey } from '../../../shared/domain/productTypes';
import { overall, overallExplanation, ratedCount, type Ratings } from '../../../shared/domain/ratings';
import { errorText } from '../api';
import { Header } from '../components/chrome';
import { CONCENTRATE_OPTIONS, STRAIN_OPTIONS, TYPE_OPTIONS } from '../components/fieldOptions';
import { CountryField } from '../components/CountryPicker';
import { draftsFromRecords, EditorPhotos, photosToInput, type PhotoDraft } from '../components/EditorPhotos';
import { HitTimeInput, RatingInput, Select, TextField } from '../components/inputs';
import { todayIso } from '../components/ProductRow';
import { PlusIcon } from '../icons';
import { cachedProduct, fetchProduct, saveProduct } from '../products';
import { useOnline } from '../online';
import { back, navigate, replaceHistory } from '../router';
import { promoteEntry } from '../logEntries';
import { takePromotion } from '../promotion';
import { Sheet } from '../components/chrome';

interface PurchaseDraft {
  key: string;
  id?: string;
  date: string;
  amount: string;
  totalPaid: string;
  supplier: string;
}

interface Form extends Omit<ProductInput, 'ratings' | 'purchases' | 'photos'> {
  /** Every stored rating, including hidden ones; only the current type's are sent. */
  ratings: Ratings;
  purchases: PurchaseDraft[];
}

let draftKey = 0;
const numText = (n: number | null) => (n === null ? '' : String(n));
const parseNum = (s: string): number | null | 'bad' => {
  const t = s.trim().replace(/^£/, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : 'bad';
};

function toForm({ photos: _photos, ...input }: ProductInput, stored: Ratings): Form {
  return {
    ...input,
    ratings: { ...stored },
    purchases: input.purchases.map((p) => ({ key: `p${++draftKey}`, id: p.id, date: p.date ?? '', amount: numText(p.amount), totalPaid: numText(p.totalPaid), supplier: p.supplier ?? '' })),
  };
}

/** Builds what the server receives; returns a message if a number can't be read. */
function toInput(f: Form, drafts: PhotoDraft[]): ProductInput | string {
  const photos = photosToInput(drafts);
  if (typeof photos === 'string') return photos;
  const set = productType(f.productType).ratingSet;
  const ratings: ProductInput['ratings'] = {};
  for (const s of set) ratings[s.key] = f.ratings[s.key] ?? null;
  const purchases: ProductInput['purchases'] = [];
  for (const d of f.purchases) {
    const amount = parseNum(d.amount);
    const totalPaid = parseNum(d.totalPaid);
    if (amount === 'bad' || totalPaid === 'bad') return 'Amounts and prices must be numbers.';
    purchases.push({ ...(d.id ? { id: d.id } : {}), date: d.date || null, amount, totalPaid, supplier: d.supplier || null });
  }
  return { ...f, ratings, purchases, photos };
}

/**
 * The product editor. With `promoteFrom`, it's the promotion editor (brief §10.2):
 * pre-filled from the log entry's live form, nothing committed until Save, and
 * Cancel asks first (Keep editing / Discard).
 */
export function Editor(p: { id: string | null; promoteFrom?: string }) {
  const existing = p.id ? cachedProduct(p.id) : undefined;
  const [promotion] = useState(() => (p.promoteFrom ? takePromotion(p.promoteFrom) : null));
  const [form, setForm] = useState<Form | null>(() =>
    promotion ? toForm(promotion.input, {}) : p.id ? (existing ? toForm(productToInput(existing), existing.ratings) : null) : p.promoteFrom ? null : toForm(emptyProductInput(), {}),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() => (promotion ? promotion.drafts : existing ? draftsFromRecords(existing.photos) : []));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = useOnline();
  const saved = useRef(false);
  const loaded = useRef(!!form);

  // A reload of the promotion screen has nothing to promote: go back to the entry.
  useEffect(() => {
    if (p.promoteFrom && !promotion) navigate(`/log/${p.promoteFrom}`, { replace: true });
  }, []);

  useEffect(() => {
    if (!p.id || loaded.current) return;
    fetchProduct(p.id)
      .then((prod: Product) => {
        loaded.current = true;
        setForm(toForm(productToInput(prod), prod.ratings));
        setDrafts(draftsFromRecords(prod.photos));
      })
      .catch((e) => setError(errorText(e)));
  }, [p.id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  // "Use '…' as Other" in the country picker also fills the Which country? box.
  const setCountry = (country: string | null, otherText?: string) => setForm((f) => (f ? { ...f, country, ...(otherText !== undefined ? { countryOther: otherText } : {}) } : f));
  const cancel = () => (p.promoteFrom ? setConfirmLeave(true) : back(p.id ? `/products/${p.id}` : '/'));

  if (!form) {
    return (
      <>
        <Header title="" left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
        <main class="screen no-nav">{error && <div class="empty"><h2>Couldn’t open this product</h2><p>{error}</p></div>}</main>
      </>
    );
  }

  const def = productType(form.productType);
  const unit = unitFor(form.productType).amount;
  const setRating = (k: RatingKey, v: number | null) =>
    setForm((f) => {
      if (!f) return f;
      const ratings = { ...f.ratings };
      if (v === null) delete ratings[k];
      else ratings[k] = v;
      return { ...f, ratings };
    });
  const setPurchase = (key: string, patch: Partial<PurchaseDraft>) => set('purchases', form.purchases.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const o = overall(form.productType, form.ratings);
  const count = ratedCount(form.productType, form.ratings);

  async function save() {
    if (!form) return;
    setError('');
    const input = toInput(form, drafts);
    if (typeof input === 'string') return setError(input);
    const checked = validateProductInput(input);
    if (!checked.ok) return setError(checked.message);
    setSaving(true);
    try {
      const product = p.promoteFrom ? await promoteEntry(p.promoteFrom, checked.value) : await saveProduct(p.id, checked.value);
      saved.current = true; // the pending uploads now belong to the product
      if (p.id) back(`/products/${product.id}`);
      else if (p.promoteFrom) {
        // The entry is gone: drop its editor from history, then open the new product.
        replaceHistory('/log');
        navigate(`/products/${product.id}`);
      }
      else navigate(`/products/${product.id}`, { replace: true });
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  return (
    <>
      <Header title={p.promoteFrom ? 'Add to leaderboard' : p.id ? form.name || 'Edit product' : 'New product'} left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
      <main class="screen has-savebar">
        <form
          class="editor"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <section class="fgroup" aria-label="Basics">
            <span class="cap">Basics</span>
            <TextField id="name" label="Name" value={form.name} onInput={(v) => set('name', v)} onBlur={() => set('name', autoCapitalise(form.name))} autoCapitalize="words" />
          </section>

          <section class="fgroup" aria-label="Classification">
            <span class="cap">Classification</span>
            <div class="two-col">
              <Select id="type" label="Product type" value={form.productType} options={TYPE_OPTIONS} onChange={(v) => set('productType', v as ProductTypeKey)} />
              <Select id="strain" label="Strain type" value={form.strainType ?? ''} options={STRAIN_OPTIONS} onChange={(v) => set('strainType', (v || null) as Form['strainType'])} />
            </div>
            {def.freeText && <TextField id="type-other" label="What type?" value={form.productTypeOther ?? ''} onInput={(v) => set('productTypeOther', v)} />}
            {def.subtypes && (
              <>
                <Select id="conc" label="Concentrate type" value={form.concentrateType} options={CONCENTRATE_OPTIONS} onChange={(v) => set('concentrateType', v)} />
                {form.concentrateType === 'other' && <TextField id="conc-other" label="What concentrate?" value={form.concentrateTypeOther ?? ''} onInput={(v) => set('concentrateTypeOther', v)} />}
              </>
            )}
          </section>

          <section class="fgroup" aria-label="Origin">
            <span class="cap">Origin</span>
            <CountryField id="country" label="Country" value={form.country} otherText={form.countryOther} onChange={setCountry} />
            {form.country === OTHER_COUNTRY && <TextField id="country-other" label="Which country?" value={form.countryOther ?? ''} onInput={(v) => set('countryOther', v)} />}
            <div class="two-col">
              <TextField id="source" label="Source" placeholder="Source/Brand" value={form.source ?? ''} onInput={(v) => set('source', v)} onBlur={() => set('source', autoCapitalise(form.source ?? ''))} autoCapitalize="words" />
              <TextField id="date-tried" label="Date tried" type="date" value={form.dateTried ?? ''} onInput={(v) => set('dateTried', v || null)} />
            </div>
          </section>

          <section class="fgroup" aria-label="Ratings">
            <span class="cap">Ratings</span>
            {def.ratingSet.map((s) => (
              <RatingInput key={s.key} id={`rate-${s.key}`} label={RATING_LABELS[s.key]} value={form.ratings[s.key] ?? null} onChange={(v) => setRating(s.key, v)} />
            ))}
            {form.productType === 'edibles' && <HitTimeInput value={form.hitTimeMinutes} onChange={(v) => set('hitTimeMinutes', v)} />}
            <p class="small">
              Rated {count.rated} of {count.of}
              {o !== null && ` · Overall ${formatScore(o)}`}
            </p>
            <p class="small">{overallExplanation(form.productType)}</p>
          </section>

          <section class="fgroup" aria-label="Purchases">
            <span class="cap">Purchases</span>
            {form.purchases.map((d, i) => {
              const amount = parseNum(d.amount);
              const total = parseNum(d.totalPaid);
              const up = typeof amount === 'number' && typeof total === 'number' ? unitPrice({ amount, totalPaid: total }) : null;
              return (
                <div class="pcard" key={d.key} role="group" aria-label={`Purchase ${i + 1}`}>
                  <div class="two-col">
                    <TextField id={`${d.key}-date`} label="Date" type="date" value={d.date} onInput={(v) => setPurchase(d.key, { date: v })} />
                    <TextField id={`${d.key}-amount`} label={unit === 'mg' ? 'Amount (mg THC)' : 'Amount (g)'} inputMode="decimal" value={d.amount} onInput={(v) => setPurchase(d.key, { amount: v })} />
                  </div>
                  <div class="two-col">
                    <TextField id={`${d.key}-paid`} label="Total paid (£)" inputMode="decimal" value={d.totalPaid} onInput={(v) => setPurchase(d.key, { totalPaid: v })} />
                    <TextField id={`${d.key}-supplier`} label="Supplier" value={d.supplier} onInput={(v) => setPurchase(d.key, { supplier: v })} onBlur={() => setPurchase(d.key, { supplier: autoCapitalise(d.supplier) })} autoCapitalize="words" />
                  </div>
                  <div class="pcard-foot">
                    <span>{up !== null ? formatUnitPrice(form.productType, up) : total === null ? 'Needs a total paid to be kept' : ''}</span>
                    <button type="button" onClick={() => set('purchases', form.purchases.filter((x) => x.key !== d.key))}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" class="addrow" onClick={() => set('purchases', [...form.purchases, { key: `p${++draftKey}`, date: todayIso(), amount: '', totalPaid: '', supplier: '' }])}>
              <PlusIcon /> Add purchase
            </button>
          </section>

          <EditorPhotos drafts={drafts} setDrafts={setDrafts} savedRef={saved} />

          <section class="fgroup" aria-label="Notes">
            <label class="cap" for="notes">
              Notes
            </label>
            <textarea id="notes" class="input" value={form.notes ?? ''} onInput={(e) => set('notes', e.currentTarget.value)} />
          </section>

          <section class="fgroup" aria-label="Leafly">
            <span class="cap">Leafly</span>
            <TextField id="leafly" label="Leafly link" inputMode="url" autoCapitalize="none" placeholder="Paste a link, or leave empty to search by name" value={form.leaflyLink ?? ''} onInput={(v) => set('leaflyLink', v)} />
          </section>

          <section class="fgroup" aria-label="Private">
            <label class="switch-row">
              <span>
                Private
                <span class="small">Hidden from your followers</span>
              </span>
              <input type="checkbox" role="switch" class="switch" checked={form.private} onChange={(e) => set('private', e.currentTarget.checked)} />
            </label>
          </section>
          <button type="submit" hidden />
        </form>
      </main>
      <div class="savebar">
        <div class="inner">
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn primary" onClick={save} disabled={saving || drafts.some((d) => d.status === 'uploading') || !online}>
            {saving ? 'Saving…' : drafts.some((d) => d.status === 'uploading') ? 'Uploading photos…' : 'Save'}
          </button>
        </div>
      </div>
      {confirmLeave && (
        <Sheet
          title="Leave without adding it?"
          message="Nothing has been added to your Leaderboard yet. Your log entry stays as it was."
          cancelLabel="Keep editing"
          options={[{ label: 'Discard', danger: true, onSelect: () => back(`/log/${p.promoteFrom}`) }]}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}
