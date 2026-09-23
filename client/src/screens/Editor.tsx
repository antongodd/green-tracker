import { useEffect, useRef, useState } from 'preact/hooks';
import { autoCapitalise } from '../../../shared/domain/capitalise';
import { COUNTRIES, OTHER_COUNTRY } from '../../../shared/domain/countries';
import { formatScore, formatUnitPrice } from '../../../shared/domain/format';
import { unitPrice } from '../../../shared/domain/money';
import { emptyProductInput, productToInput, validateProductInput, type Product, type ProductInput } from '../../../shared/domain/product';
import { CONCENTRATE_SUBTYPES, PRODUCT_TYPES, RATING_LABELS, STRAIN_TYPES, productType, unitFor, type ProductTypeKey, type RatingKey } from '../../../shared/domain/productTypes';
import { overall, overallExplanation, ratedCount, type Ratings } from '../../../shared/domain/ratings';
import { errorText } from '../api';
import { Header } from '../components/chrome';
import { HitTimeInput, RatingInput, Select, TextField } from '../components/inputs';
import { todayIso } from '../components/ProductRow';
import { PlusIcon } from '../icons';
import { cachedProduct, fetchProduct, saveProduct } from '../products';
import { back, navigate } from '../router';

interface PurchaseDraft {
  key: string;
  id?: string;
  date: string;
  amount: string;
  totalPaid: string;
  supplier: string;
}

interface Form extends Omit<ProductInput, 'ratings' | 'purchases'> {
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

function toForm(input: ProductInput, stored: Ratings): Form {
  return {
    ...input,
    ratings: { ...stored },
    purchases: input.purchases.map((p) => ({ key: `p${++draftKey}`, id: p.id, date: p.date ?? '', amount: numText(p.amount), totalPaid: numText(p.totalPaid), supplier: p.supplier ?? '' })),
  };
}

/** Builds what the server receives; returns a message if a number can't be read. */
function toInput(f: Form): ProductInput | string {
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
  return { ...f, ratings, purchases };
}

const TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({ value: t.key, label: t.label }));
const CONCENTRATE_OPTIONS = CONCENTRATE_SUBTYPES.map((s) => ({ value: s.key, label: s.label }));
const STRAIN_OPTIONS = [{ value: '', label: 'Not set' }, ...STRAIN_TYPES.map((s) => ({ value: s.key, label: s.label }))];
const COUNTRY_OPTIONS = [{ value: '', label: 'Not set' }, ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })), { value: OTHER_COUNTRY, label: 'Other' }];

export function Editor(p: { id: string | null }) {
  const existing = p.id ? cachedProduct(p.id) : undefined;
  const [form, setForm] = useState<Form | null>(() => (p.id ? (existing ? toForm(productToInput(existing), existing.ratings) : null) : toForm(emptyProductInput(), {})));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const loaded = useRef(!!form);

  useEffect(() => {
    if (!p.id || loaded.current) return;
    fetchProduct(p.id)
      .then((prod: Product) => {
        loaded.current = true;
        setForm(toForm(productToInput(prod), prod.ratings));
      })
      .catch((e) => setError(errorText(e)));
  }, [p.id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const cancel = () => back(p.id ? `/products/${p.id}` : '/');

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
    const input = toInput(form);
    if (typeof input === 'string') return setError(input);
    const checked = validateProductInput(input);
    if (!checked.ok) return setError(checked.message);
    setSaving(true);
    try {
      const saved = await saveProduct(p.id, checked.value);
      if (p.id) back(`/products/${saved.id}`);
      else navigate(`/products/${saved.id}`, { replace: true });
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  return (
    <>
      <Header title={p.id ? form.name || 'Edit product' : 'New product'} left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
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
            <Select id="country" label="Country" value={form.country ?? ''} options={COUNTRY_OPTIONS} onChange={(v) => set('country', v || null)} />
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
          <button class="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
