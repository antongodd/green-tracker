import { useEffect, useRef, useState } from 'preact/hooks';
import { autoCapitalise } from '../../../shared/domain/capitalise';
import { OTHER_COUNTRY } from '../../../shared/domain/countries';
import { emptyLogEntryInput, logEntryToInput, promotionInput, validateLogEntryInput, type LogEntry, type LogEntryInput } from '../../../shared/domain/logEntry';
import { productType, unitFor, type ProductTypeKey } from '../../../shared/domain/productTypes';
import { ApiError, errorText } from '../api';
import { Header, Sheet } from '../components/chrome';
import { draftsFromRecords, EditorPhotos, photosToInput, type PhotoDraft } from '../components/EditorPhotos';
import { CONCENTRATE_OPTIONS, COUNTRY_OPTIONS, TYPE_OPTIONS } from '../components/fieldOptions';
import { Select, TextField } from '../components/inputs';
import { cachedEntry, deleteEntry, fetchEntry, saveEntry } from '../logEntries';
import { startPromotion } from '../promotion';
import { back, navigate } from '../router';

interface Form extends Omit<LogEntryInput, 'amount' | 'photos'> {
  amount: string;
}

const toForm = ({ amount, photos: _p, ...rest }: LogEntryInput): Form => ({ ...rest, amount: amount === null ? '' : String(amount) });

function toInput(f: Form, drafts: PhotoDraft[]): LogEntryInput | string {
  const photos = photosToInput(drafts);
  if (typeof photos === 'string') return photos;
  const t = f.amount.trim().replace(',', '.');
  const amount = t === '' ? null : Number(t);
  if (amount !== null && !Number.isFinite(amount)) return 'Amount must be a number.';
  return { ...f, amount, photos };
}

/**
 * The loose entry editor (brief §9, §10.2): name, classification, country, amount,
 * one photo. Save to log; Add to leaderboard (saved entries only) hands the live
 * form to the product editor; Delete (saved entries only) behind a confirmation.
 */
export function LogEditor(p: { id: string | null }) {
  const existing = p.id ? cachedEntry(p.id) : undefined;
  const [form, setForm] = useState<Form | null>(() => (p.id ? (existing ? toForm(logEntryToInput(existing)) : null) : toForm(emptyLogEntryInput())));
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() => (existing?.photo ? draftsFromRecords([existing.photo]) : []));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Set when the pending uploads belong elsewhere now (saved, or handed to promotion).
  const handedOff = useRef(false);
  const loaded = useRef(!!form);

  useEffect(() => {
    if (!p.id || loaded.current) return;
    fetchEntry(p.id)
      .then((e: LogEntry) => {
        loaded.current = true;
        setForm(toForm(logEntryToInput(e)));
        setDrafts(e.photo ? draftsFromRecords([e.photo]) : []);
      })
      .catch((e) => {
        // A promoted or deleted entry reached through Back: go to the Log instead.
        if (e instanceof ApiError && e.status === 404) navigate('/log', { replace: true });
        else setError(errorText(e));
      });
  }, [p.id]);

  const cancel = () => back('/log');
  if (!form) {
    return (
      <>
        <Header title="" left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
        <main class="screen no-nav">{error && <div class="empty"><h2>Couldn’t open this entry</h2><p>{error}</p></div>}</main>
      </>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const def = productType(form.productType);
  const unit = unitFor(form.productType).amount;
  const uploading = drafts.some((d) => d.status === 'uploading');

  function checked(): LogEntryInput | null {
    setError('');
    const input = toInput(form!, drafts);
    if (typeof input === 'string') return setError(input), null;
    const v = validateLogEntryInput(input);
    if (!v.ok) return setError(v.message), null;
    return v.value;
  }

  async function save() {
    const input = checked();
    if (!input) return;
    setBusy(true);
    try {
      await saveEntry(p.id, input);
      handedOff.current = true;
      back('/log');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  /** Commits nothing: opens the product editor pre-filled from this live form. */
  function addToLeaderboard() {
    const input = checked();
    if (!input || !p.id) return;
    handedOff.current = true;
    startPromotion({ entryId: p.id, input: promotionInput(input), drafts });
    navigate(`/log/${p.id}/promote`);
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    try {
      await deleteEntry(p.id!);
      handedOff.current = false; // discard any pending photo changes
      back('/log');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={p.id ? form.name || 'Log entry' : 'New log entry'} left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
      <main class="screen has-savebar" style={p.id ? { paddingBottom: 'calc(var(--safe-bottom) + 160px)' } : undefined}>
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
            <Select id="type" label="Product type" value={form.productType} options={TYPE_OPTIONS} onChange={(v) => set('productType', v as ProductTypeKey)} />
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
          </section>

          <section class="fgroup" aria-label="Amount">
            <span class="cap">Amount</span>
            <TextField id="amount" label={unit === 'mg' ? 'Amount (mg THC)' : 'Amount (g)'} inputMode="decimal" value={form.amount} onInput={(v) => set('amount', v)} />
          </section>

          <EditorPhotos drafts={drafts} setDrafts={setDrafts} savedRef={handedOff} max={1} />

          {p.id && (
            <button type="button" class="btn danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete entry
            </button>
          )}
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
          <button class="btn primary" onClick={save} disabled={busy || uploading}>
            {busy ? 'Saving…' : uploading ? 'Uploading photo…' : 'Save to log'}
          </button>
          {p.id && (
            <button class="btn secondary" onClick={addToLeaderboard} disabled={busy || uploading}>
              Add to leaderboard
            </button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <Sheet
          title={`Delete “${form.name}”?`}
          message="This removes the entry and its photo for good."
          options={[{ label: 'Delete entry', danger: true, onSelect: remove }]}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
