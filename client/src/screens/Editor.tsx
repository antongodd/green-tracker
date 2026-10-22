import { useEffect, useRef, useState } from 'preact/hooks';
import { autoCapitalise } from '../../../shared/domain/capitalise';
import { canonicalName, usedNames, type UsedName } from '../../../shared/domain/names';
import { OTHER_COUNTRY } from '../../../shared/domain/countries';
import { formatAmount, formatMoney, formatScore, formatUnitPrice } from '../../../shared/domain/format';
import { CURRENCIES, currencySign, formatRate, isValidRate } from '../../../shared/domain/currency';
import { fetchRate, lastCurrency, rememberCurrency, useCurrency } from '../money';
import { latestPurchase, unitPrice, unitPricePaid } from '../../../shared/domain/money';
import { emptyProductInput, productToInput, validateProductInput, type Product, type ProductInput } from '../../../shared/domain/product';
import { RATING_LABELS, productType, unitFor, type ProductTypeKey, type RatingKey } from '../../../shared/domain/productTypes';
import { overall, overallExplanation, ratedCount, type Ratings } from '../../../shared/domain/ratings';
import { errorText } from '../api';
import { Header } from '../components/chrome';
import { CONCENTRATE_OPTIONS, STRAIN_OPTIONS, TYPE_OPTIONS } from '../components/fieldOptions';
import { CountryField } from '../components/CountryPicker';
import { draftsFromRecords, EditorPhotos, photosToInput, type PhotoDraft } from '../components/EditorPhotos';
import { GroupHead, HitTimeInput, RatingInput, Select, TextField } from '../components/inputs';
import { formatIsoDate, todayIso } from '../components/ProductRow';
import { ChevronDown, ChevronRight, LeafLineIcon, LinkIcon, LockLineIcon, NoteIcon, PencilIcon, PinIcon, PlusIcon, ReceiptIcon, StarIcon, TrashIcon } from '../icons';
import { scoreHeat } from '../../../shared/domain/heat';
import { cachedProduct, cachedProducts, fetchProduct, fetchProducts, saveProduct } from '../products';
import { intoSuggestions, NameSuggestions } from '../components/NameSuggestions';
import { rankProducts } from '../../../shared/domain/leaderboard';
import { play, switchAttr } from '../sounds';
import { Tick } from '../components/Tick';
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
  /** D66: the currency it was paid in. */
  currency: string;
  /** Its rate into your main currency: saved, looked up or typed; null while not known. */
  rate: number | null;
  /** The rate box's text while it's open (Change, or when the look-up couldn't answer). */
  rateText: string | null;
  /** You typed the rate: a new date keeps it. */
  typed: boolean;
  /** Looking up the rate for its day, or the look-up couldn't answer. */
  look: 'idle' | 'loading' | 'failed';
}

interface Form extends Omit<ProductInput, 'ratings' | 'purchases' | 'photos'> {
  /** Every stored rating, including hidden ones; only the current type's are sent. */
  ratings: Ratings;
  purchases: PurchaseDraft[];
}

let draftKey = 0;
const numText = (n: number | null) => (n === null ? '' : String(n));
const parseNum = (s: string): number | null | 'bad' => {
  const t = s.trim().replace(/^[£€$¥]/, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : 'bad';
};

function toForm({ photos: _photos, ...input }: ProductInput, stored: Ratings, main: string): Form {
  return {
    ...input,
    ratings: { ...stored },
    purchases: input.purchases.map((p) => {
      const currency = p.currency ?? main;
      return {
        key: `p${++draftKey}`,
        id: p.id,
        date: p.date ?? '',
        amount: numText(p.amount),
        totalPaid: numText(p.totalPaid),
        supplier: p.supplier ?? '',
        currency,
        rate: currency === main ? 1 : (p.rate ?? null),
        rateText: null,
        typed: false,
        look: 'idle' as const,
      };
    }),
  };
}

/** A purchase's rate into your main currency as the form stands (D66): 1 for the main one; 'bad' when the typed rate can't be read. */
function draftRate(d: PurchaseDraft, main: string): number | null | 'bad' {
  if (d.currency === main) return 1;
  if (d.rateText !== null) {
    const n = parseNum(d.rateText);
    return n === null ? null : typeof n === 'number' && isValidRate(n) ? n : 'bad';
  }
  return d.rate;
}

/** Why a kept purchase in another currency can't be saved yet: no rate, or one that can't be read (D66). */
function rateProblem(d: PurchaseDraft, main: string): string | null {
  if (typeof parseNum(d.totalPaid) !== 'number') return null;
  const r = draftRate(d, main);
  if (typeof r === 'number') return null;
  if (r === 'bad') return 'An exchange rate must be a number more than 0.';
  return d.look === 'loading' ? 'Still getting an exchange rate. Try again in a moment.' : `Type the exchange rate for the purchase in ${currencySign(d.currency)}.`;
}

/**
 * The first purchase that would stop the product saving (a number that can't be read, or a value
 * the shared rules refuse), so the editor can open it (D42). A missing total paid isn't one: that
 * purchase is simply not kept.
 */
function blockingPurchase(f: Form, main: string): string | null {
  for (const d of f.purchases) {
    const amount = parseNum(d.amount);
    const totalPaid = parseNum(d.totalPaid);
    if (amount === 'bad' || totalPaid === 'bad' || rateProblem(d, main)) return d.key;
    const one = validateProductInput({ ...emptyProductInput(), name: 'Check', purchases: [{ date: d.date || null, amount, totalPaid, supplier: d.supplier || null }] });
    if (!one.ok) return d.key;
  }
  return null;
}

/** Builds what the server receives; returns a message if a number can't be read. */
function toInput(f: Form, drafts: PhotoDraft[], main: string): ProductInput | string {
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
    const problem = rateProblem(d, main);
    if (problem) return problem;
    const rate = draftRate(d, main);
    purchases.push({
      ...(d.id ? { id: d.id } : {}),
      date: d.date || null,
      amount,
      totalPaid,
      supplier: d.supplier || null,
      currency: d.currency,
      ...(d.currency !== main && typeof rate === 'number' ? { rate } : {}),
    });
  }
  return { ...f, ratings, purchases, photos };
}

/** Your #1 by Overall (the Leaderboard's opening view): its id, null if nothing is rated, undefined if not loaded. */
function topProduct(): string | null | undefined {
  const list = cachedProducts();
  if (!list) return undefined;
  const top = rankProducts(list, { filter: 'all', rankBy: 'overall' })[0];
  return top?.first ? top.product.id : null;
}

/**
 * The product editor. With `promoteFrom`, it's the promotion editor (brief §10.2):
 * pre-filled from the log entry's live form, nothing committed until Save, and
 * Cancel asks first (Keep editing / Discard).
 */
export function Editor(p: { id: string | null; promoteFrom?: string }) {
  const main = useCurrency();
  const existing = p.id ? cachedProduct(p.id) : undefined;
  const [promotion] = useState(() => (p.promoteFrom ? takePromotion(p.promoteFrom) : null));
  const [form, setForm] = useState<Form | null>(() =>
    promotion
      ? toForm(promotion.input, promotion.ratings ?? {}, main)
      : p.id
        ? existing
          ? toForm(productToInput(existing), existing.ratings, main)
          : null
        : p.promoteFrom
          ? null
          : toForm(emptyProductInput(), {}, main),
  );
  const [error, setError] = useState('');
  // D42: the one purchase whose fields are open; a new one opens with the cursor in Amount.
  const [openPurchase, setOpenPurchase] = useState<string | null>(null);
  const focusAmount = useRef<string | null>(null);
  useEffect(() => {
    if (!openPurchase || focusAmount.current !== openPurchase) return;
    focusAmount.current = null;
    document.getElementById(`${openPurchase}-amount`)?.focus();
  }, [openPurchase]);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() => (promotion ? promotion.drafts : existing ? draftsFromRecords(existing.photos) : []));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = useOnline();
  // D59: the names already used in Source and Supplier, offered under those boxes while you type.
  const [used, setUsed] = useState<UsedName[]>(() => usedNames(cachedProducts() ?? []));
  const [suggesting, setSuggesting] = useState<string | null>(null);
  useEffect(() => {
    if (!cachedProducts())
      fetchProducts()
        .then((list) => setUsed(usedNames(list)))
        .catch(() => {});
  }, []);
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
        setForm(toForm(productToInput(prod), prod.ratings, main));
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
  const setPurchase = (key: string, patch: Partial<PurchaseDraft> | ((d: PurchaseDraft) => Partial<PurchaseDraft>)) =>
    setForm((f) => (f ? { ...f, purchases: f.purchases.map((d) => (d.key === key ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)) } : f));
  // D66: a purchase in another currency gets the rate for its day; one that can't be had opens the rate box.
  const lookUp = (key: string, currency: string, date: string) => {
    setPurchase(key, { rate: null, rateText: null, typed: false, look: 'loading' });
    const still = (d: PurchaseDraft) => d.currency === currency && d.date === date && !d.typed;
    fetchRate(currency, main, date || null)
      .then((rate) => setPurchase(key, (d) => (still(d) ? { rate, look: 'idle' } : {})))
      .catch(() => setPurchase(key, (d) => (still(d) ? { look: 'failed', rateText: d.rateText ?? '' } : {})));
  };
  const setCurrency = (d: PurchaseDraft, currency: string) => {
    rememberCurrency(currency);
    setPurchase(d.key, { currency });
    if (currency === main) setPurchase(d.key, { rate: 1, rateText: null, typed: false, look: 'idle' });
    else lookUp(d.key, currency, d.date);
  };
  const setDate = (d: PurchaseDraft, date: string) => {
    setPurchase(d.key, { date });
    if (d.currency !== main && !d.typed) lookUp(d.key, d.currency, date);
  };
  // Done in the rate box keeps a rate that can be read (and then it stays, whatever the date).
  const closeRate = (d: PurchaseDraft) => {
    const r = draftRate(d, main);
    if (typeof r === 'number') setPurchase(d.key, { rate: r, rateText: null, typed: true, look: 'idle' });
  };
  // D42: purchases fold into one-line rows; one opens at a time. "Latest" follows the app's own rule
  // (newest date, then entry order) over the purchases that would be kept (those with a total paid).
  const kept = form.purchases.map((d, i) => ({ key: d.key, date: d.date || null, seq: i, total: parseNum(d.totalPaid) })).filter((x) => typeof x.total === 'number');
  const latestKey = latestPurchase(kept)?.key ?? null;
  const addPurchase = () => {
    const key = `p${++draftKey}`;
    // D66: in the currency of the last purchase you added (a week in Amsterdam is € all the way).
    const currency = lastCurrency() ?? main;
    const date = todayIso();
    set('purchases', [...form.purchases, { key, date, amount: '', totalPaid: '', supplier: '', currency, rate: currency === main ? 1 : null, rateText: null, typed: false, look: 'idle' }]);
    if (currency !== main) lookUp(key, currency, date);
    setOpenPurchase(key);
    focusAmount.current = key;
  };
  // Leaving Source or Supplier (not for its suggestions) saves the spelling you already use (D59).
  // Read from the latest form: a picked suggestion and the blur that follows it land together (D61).
  const leaveSource = (e?: FocusEvent) => {
    if (e && intoSuggestions(e.relatedTarget, 'source')) return;
    setSuggesting(null);
    setForm((f) => (f ? { ...f, source: canonicalName(f.source ?? '', used) } : f));
  };
  const leaveSupplier = (d: PurchaseDraft, e?: FocusEvent) => {
    if (e && intoSuggestions(e.relatedTarget, `${d.key}-supplier`)) return;
    setSuggesting(null);
    setForm((f) => (f ? { ...f, purchases: f.purchases.map((x) => (x.key === d.key ? { ...x, supplier: canonicalName(x.supplier, used) } : x)) } : f));
  };
  const o = overall(form.productType, form.ratings);
  const count = ratedCount(form.productType, form.ratings);

  async function save() {
    if (!form) return;
    setError('');
    // A purchase that stops the save opens, so its fields are in view (D42).
    const fail = (message: string) => {
      const key = blockingPurchase(form, main);
      if (key) setOpenPurchase(key);
      setError(message);
    };
    const input = toInput(form, drafts, main);
    if (typeof input === 'string') return fail(input);
    const checked = validateProductInput(input);
    if (!checked.ok) return fail(checked.message);
    setSaving(true);
    const topBefore = topProduct();
    try {
      const product = p.promoteFrom ? await promoteEntry(p.promoteFrom, checked.value) : await saveProduct(p.id, checked.value);
      saved.current = true; // the pending uploads now belong to the product
      // D56: a fanfare when this save puts it at the top of your Leaderboard, else the save sound.
      play(topBefore !== undefined && topBefore !== product.id && topProduct() === product.id ? 'first' : 'save');
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
            <GroupHead icon={PencilIcon} label="Basics" />
            <TextField id="name" label="Name" value={form.name} onInput={(v) => set('name', v)} onBlur={() => set('name', autoCapitalise(form.name))} autoCapitalize="words" />
          </section>

          <section class="fgroup" aria-label="Classification">
            <GroupHead icon={LeafLineIcon} label="Classification" />
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
            <GroupHead icon={PinIcon} label="Origin" />
            <CountryField id="country" label="Country" value={form.country} otherText={form.countryOther} onChange={setCountry} />
            {form.country === OTHER_COUNTRY && <TextField id="country-other" label="Which country?" value={form.countryOther ?? ''} onInput={(v) => set('countryOther', v)} />}
            <div class="two-col">
              <TextField id="source" label="Source" placeholder="Source/Brand" value={form.source ?? ''} onInput={(v) => set('source', v)} onFocus={() => setSuggesting('source')} onBlur={leaveSource} autoCapitalize="words" />
              {/* Next after Source for Tab, drawn across the card under both boxes (.suggest in a .two-col). */}
              {suggesting === 'source' && <NameSuggestions for="source" label="Source" typed={form.source ?? ''} used={used} onPick={(name) => set('source', name)} onLeave={leaveSource} />}
              <TextField id="date-tried" label="Date tried" type="date" value={form.dateTried ?? ''} onInput={(v) => set('dateTried', v || null)} />
            </div>
          </section>

          <section class="fgroup" aria-label="Ratings">
            {/* D34: Overall, live and in its colour, at the right of the heading. */}
            <GroupHead icon={StarIcon} label="Ratings">
              <span class="gh-ov">
                <span>Overall</span>
                <b class={o === null ? 'none' : undefined} style={o === null ? undefined : { color: scoreHeat('overall', o) ?? undefined }}>
                  {o === null ? '—' : formatScore(o)}
                </b>
              </span>
            </GroupHead>
            <div class="rates">
              {def.ratingSet.map((s) => (
                <RatingInput
                  key={s.key}
                  id={`rate-${s.key}`}
                  rating={s.key}
                  label={RATING_LABELS[s.key]}
                  value={form.ratings[s.key] ?? null}
                  onChange={(v) => setRating(s.key, v)}
                  note={s.weight === 0 ? 'Doesn’t count towards Overall' : undefined}
                />
              ))}
            </div>
            {form.productType === 'edibles' && <HitTimeInput value={form.hitTimeMinutes} onChange={(v) => set('hitTimeMinutes', v)} />}
            <p class="small">
              Rated {count.rated} of {count.of}
            </p>
            <p class="small">{overallExplanation(form.productType)}</p>
          </section>

          <section class="fgroup" aria-label="Purchases">
            <GroupHead icon={ReceiptIcon} label="Purchases" />
            {form.purchases.map((d, i) => {
              const amount = parseNum(d.amount);
              const total = parseNum(d.totalPaid);
              // D66: the price per unit in your main currency once the rate is known; until then, as paid.
              const rate = draftRate(d, main);
              const foreign = d.currency !== main;
              const priced = typeof amount === 'number' && typeof total === 'number';
              const up = priced && typeof rate === 'number' ? unitPrice({ amount, totalPaid: total, rate }) : null;
              const paidUp = priced && foreign ? unitPricePaid({ amount, totalPaid: total }) : null;
              const upText = up !== null ? formatUnitPrice(form.productType, up, main) : paidUp !== null ? formatUnitPrice(form.productType, paidUp, d.currency) : null;
              const open = openPurchase === d.key;
              const sub = [typeof amount === 'number' ? formatAmount(form.productType, amount) : null, typeof total === 'number' ? formatMoney(total, d.currency) : null, d.supplier.trim() || null].filter(Boolean).join(' · ');
              const bodyId = `${d.key}-fields`;
              return (
                <div class={`pcard${open ? ' open' : ''}`} key={d.key} role="group" aria-label={`Purchase ${i + 1}`}>
                  <button type="button" class="psum" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpenPurchase(open ? null : d.key)}>
                    <span class="l">
                      <b>
                        {d.date ? formatIsoDate(d.date) : 'No date'}
                        {d.key === latestKey && <span class="tag-latest">Latest</span>}
                        {foreign && <span class="fx">{currencySign(d.currency)}</span>}
                      </b>
                      {total === null ? <span class="warn">Needs a total paid to be kept</span> : <span>{sub}</span>}
                    </span>
                    <span class="r">
                      {upText ?? '—'}
                      {up !== null && paidUp !== null && <small>{formatUnitPrice(form.productType, paidUp, d.currency)}</small>}
                    </span>
                    <ChevronRight class="chev" />
                  </button>
                  {open && (
                    <div class="pbody" id={bodyId}>
                      <div class="two-col">
                        <TextField id={`${d.key}-date`} label="Date" type="date" value={d.date} onInput={(v) => setDate(d, v)} />
                        <TextField id={`${d.key}-amount`} label={unit === 'mg' ? 'Amount (mg THC)' : 'Amount (g)'} inputMode="decimal" value={d.amount} onInput={(v) => setPurchase(d.key, { amount: v })} />
                      </div>
                      <div class="two-col">
                        {/* D66: the currency, a native picker (names in the list) behind its sign, then the amount. */}
                        <div class="field">
                          <label for={`${d.key}-paid`}>Total paid</label>
                          <div class="money-in">
                            <span class="cur">
                              <span class="cur-face" aria-hidden="true">
                                <b>{currencySign(d.currency)}</b>
                                <ChevronDown />
                              </span>
                              <select id={`${d.key}-cur`} aria-label="Currency" value={d.currency} onChange={(e) => setCurrency(d, e.currentTarget.value)}>
                                {CURRENCIES.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {currencySign(c.code)} {c.name}
                                  </option>
                                ))}
                              </select>
                            </span>
                            <input id={`${d.key}-paid`} class="input" type="text" inputMode="decimal" autoComplete="off" value={d.totalPaid} onInput={(e) => setPurchase(d.key, { totalPaid: e.currentTarget.value })} />
                          </div>
                        </div>
                        <TextField id={`${d.key}-supplier`} label="Supplier" value={d.supplier} onInput={(v) => setPurchase(d.key, { supplier: v })} onFocus={() => setSuggesting(`${d.key}-supplier`)} onBlur={(e) => leaveSupplier(d, e)} autoCapitalize="words" />
                        {suggesting === `${d.key}-supplier` && (
                          // The product's Source comes first: with no brand, it's often where it was bought.
                          <NameSuggestions for={`${d.key}-supplier`} label="Supplier" typed={d.supplier} used={used} first={form.source} onPick={(name) => setForm((f) => (f ? { ...f, purchases: f.purchases.map((x) => (x.key === d.key ? { ...x, supplier: name } : x)) } : f))} onLeave={() => leaveSupplier(d)} />
                        )}
                      </div>
                      {foreign && <RateLine d={d} main={main} total={typeof total === 'number' ? total : null} rate={rate} onChange={() => setPurchase(d.key, { rateText: formatRate(d.rate ?? 1) })} onText={(v) => setPurchase(d.key, { rateText: v, typed: true })} onDone={() => closeRate(d)} />}
                      <div class="pcard-foot">
                        <span class={total === null ? 'warn' : ''}>{total === null ? 'Needs a total paid to be kept' : (upText ?? '')}</span>
                        <button type="button" onClick={() => (set('purchases', form.purchases.filter((x) => x.key !== d.key)), setOpenPurchase(null))}>
                          <TrashIcon />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" class="addrow dashed" onClick={addPurchase}>
              <PlusIcon /> Add purchase
            </button>
          </section>

          <EditorPhotos drafts={drafts} setDrafts={setDrafts} savedRef={saved} name={form.name || undefined} />

          <section class="fgroup" aria-label="Notes">
            <GroupHead icon={NoteIcon} label="Notes" htmlFor="notes" />
            <textarea id="notes" class="input" value={form.notes ?? ''} onInput={(e) => set('notes', e.currentTarget.value)} />
          </section>

          <section class="fgroup" aria-label="Leafly">
            <GroupHead icon={LinkIcon} label="Leafly" />
            <TextField id="leafly" label="Leafly link" inputMode="url" autoCapitalize="none" placeholder="Paste a link, or leave empty to search by name" value={form.leaflyLink ?? ''} onInput={(v) => set('leaflyLink', v)} />
          </section>

          <section class="fgroup" aria-label="Private">
            <label class="switch-row">
              <span class="gh-ic">
                <LockLineIcon />
              </span>
              <span>
                Private
                <span class="small">Hidden from your followers</span>
              </span>
              <input type="checkbox" role="switch" class="switch" {...switchAttr()} checked={form.private} onChange={(e) => set('private', e.currentTarget.checked)} />
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
          <button class="btn primary has-tick" onClick={save} disabled={saving || drafts.some((d) => d.status === 'uploading') || !online}>
            {saving ? 'Saving…' : drafts.some((d) => d.status === 'uploading') ? 'Uploading photos…' : 'Save'}
            {!saving && !drafts.some((d) => d.status === 'uploading') && online && <Tick />}
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

/**
 * D66: under a purchase in another currency, one slim line: what it comes to in your main currency
 * and the rate, with Change; or the rate box, open while you type it (and when the look-up couldn't answer).
 */
function RateLine(p: { d: PurchaseDraft; main: string; total: number | null; rate: number | null | 'bad'; onChange: () => void; onText: (v: string) => void; onDone: () => void }) {
  const { d, main } = p;
  const rate = typeof p.rate === 'number' ? p.rate : null;
  const sum = p.total !== null && rate !== null ? `≈ ${formatMoney(p.total * rate, main)}` : null;
  const per = rate !== null ? `${currencySign(d.currency)}1 = ${currencySign(main)}${formatRate(rate)}` : null;
  if (d.rateText === null) {
    return (
      <div class="fxline" aria-live="polite">
        <span class="fx-sum">
          {d.look === 'loading' ? (
            <span class="fx-rate">Getting the rate…</span>
          ) : (
            <>
              {sum && <b>{sum}</b>}
              {per && <span class="fx-rate">{per}</span>}
            </>
          )}
        </span>
        {d.look !== 'loading' && (
          <button type="button" class="fx-btn" onClick={p.onChange}>
            Change
          </button>
        )}
      </div>
    );
  }
  return (
    <div class="fxline open">
      <div class="fx-edit">
        <TextField id={`${d.key}-rate`} label={`${currencySign(main)} for ${currencySign(d.currency)}1`} inputMode="decimal" value={d.rateText} onInput={p.onText} />
        <span class="fx-sum" aria-live="polite">
          {sum && <b>{sum}</b>}
        </span>
        <button type="button" class="fx-btn" onClick={p.onDone} disabled={rate === null}>
          Done
        </button>
      </div>
      {d.look === 'failed' && <span class="warn">Couldn’t get the rate. Type it in.</span>}
      {p.rate === 'bad' && <span class="warn">That rate isn’t a number.</span>}
    </div>
  );
}
