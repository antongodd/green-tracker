// Smokes (D43, 0.36.0; option B "Week strip" of the mockups). Every time you had something:
// the tab (a strip of the last 7 days, then every smoke by day), the picker the + opens
// (/smokes/new), the form (/smokes/new/p|e/:id to add, /smokes/:id to change or delete),
// and the Smokes card on product and Log entry pages (option 1). Yours only: followers
// have no route to any of it.
import { useEffect, useRef, useState } from 'preact/hooks';
import { autoCapitalise } from '../../../shared/domain/capitalise';
import { emptyLogEntryInput, validateLogEntryInput, type LogEntry } from '../../../shared/domain/logEntry';
import { photoUrl, type PhotoRecord } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { productType, unitFor, type ProductTypeKey } from '../../../shared/domain/productTypes';
import {
  dayLabel,
  groupByDay,
  recentTargets,
  smokeAmountText,
  smokesOf,
  smokeTarget,
  smokeTotals,
  smokeVerb,
  timesCaption,
  timesText,
  validateSmokeInput,
  weekdayShort,
  weekStrip,
  whenText,
  type Smoke,
} from '../../../shared/domain/smoke';
import { ApiError, errorText } from '../api';
import { Header, Sheet, TabBar } from '../components/chrome';
import { EmptyCard } from '../components/EmptyCard';
import { TYPE_OPTIONS } from '../components/fieldOptions';
import { GroupHead, Select, TextField } from '../components/inputs';
import { MeButton } from '../components/MeButton';
import { todayIso } from '../components/ProductRow';
import { Skeleton } from '../components/Skeleton';
import { CalendarIcon, PlusIcon, ScaleIcon, SearchIcon, SparkIcon, TrashIcon, TypeMark } from '../icons';
import { cachedEntries, cachedEntry, fetchEntries, fetchEntry, saveEntry } from '../logEntries';
import { useOnline } from '../online';
import { cachedProduct, cachedProducts, fetchArchived, fetchProduct, fetchProducts } from '../products';
import { back, linkTo, navigate } from '../router';
import { deleteSmoke, saveSmoke, takeFresh, useSmokes } from '../smokes';

/** What a smoke was: a product (archived ones too) or a loose Log entry. */
interface Target {
  key: string;
  name: string;
  productType: string;
  photo: PhotoRecord | null;
  log: boolean;
}

const productTarget = (p: Product): Target => ({ key: `p:${p.id}`, name: p.name, productType: p.productType, photo: p.photos[0] ?? null, log: false });
const entryTarget = (e: LogEntry): Target => ({ key: `e:${e.id}`, name: e.name, productType: e.productType, photo: e.photo, log: true });

function targetMap(products: Product[], entries: LogEntry[]): Map<string, Target> {
  return new Map([...products.map(productTarget), ...entries.map(entryTarget)].map((t) => [t.key, t]));
}

/** The form's address for adding a smoke of `target` (`p:<id>` / `e:<id>`). */
export const addSmokePath = (target: string): string => `/smokes/new/${target[0]}/${encodeURIComponent(target.slice(2))}`;

const nowTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Thumb(p: { target: Target }) {
  const def = productType(p.target.productType);
  const photo = p.target.photo;
  return <div class={`thumb${photo?.cutout ? ' cut' : ''}`}>{photo ? <img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>;
}

const Name = (p: { target: Target }) => (
  <span class="nm">
    <span class="nm-t">{p.target.name}</span>
    {p.target.log && <span class="log-chip">Log</span>}
  </span>
);

/** "0.3 g · Relaxed, sleepy". */
function smokeLine(s: Smoke, type: string): string {
  return [s.amount !== null ? smokeAmountText(type, s.amount) : null, s.effect].filter(Boolean).join(' · ');
}

// The tab ------------------------------------------------------------------------

function WeekStrip(p: { smokes: Smoke[]; today: string; onDay: (date: string) => void }) {
  const days = weekStrip(p.smokes, p.today);
  const totals = smokeTotals(p.smokes, p.today);
  return (
    <section class="week" aria-label="Last 7 days">
      <div class="week-top">
        <span>
          <b class="num">{totals.week}</b> in the last 7 days
        </span>
        <span class="num">{totals.month} this month</span>
      </div>
      <div class="days">
        {days.map((d) => (
          <button
            type="button"
            key={d.date}
            class={`day${d.date === p.today ? ' today' : ''}`}
            disabled={d.count === 0}
            onClick={() => p.onDay(d.date)}
            aria-label={`${dayLabel(d.date, p.today)}: ${d.count === 1 ? '1 smoke' : `${d.count} smokes`}`}
          >
            <span class="dl">{d.date === p.today ? 'Today' : weekdayShort(d.date)}</span>
            <span class="bars" aria-hidden="true">
              {d.count === 0 ? <i class="none" /> : Array.from({ length: Math.min(d.count, 5) }, (_, i) => <i key={i} />)}
            </span>
            <span class="dn num">{d.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SmokeRow(p: { smoke: Smoke; target: Target; fresh: boolean }) {
  const line = smokeLine(p.smoke, p.target.productType) || productType(p.target.productType).label;
  const href = `/smokes/${p.smoke.id}`;
  return (
    <a class={`srow${p.fresh ? ' fresh' : ''}`} href={href} onClick={linkTo(href)} data-smoke={p.smoke.id}>
      <Thumb target={p.target} />
      <span class="sbody">
        <Name target={p.target} />
        <span class="sub">{line}</span>
      </span>
      <span class="tm num">{p.smoke.time}</span>
    </a>
  );
}

export function Smokes() {
  const { smokes, error: smokesError } = useSmokes();
  const [targets, setTargets] = useState<Map<string, Target> | null>(null);
  const [error, setError] = useState('');
  const [fresh] = useState(takeFresh);

  useEffect(() => {
    // Archived products' smokes still show and count (only the picker leaves them out).
    Promise.all([cachedProducts() ? Promise.resolve(cachedProducts()!) : fetchProducts(), fetchArchived(), cachedEntries() ? Promise.resolve(cachedEntries()!) : fetchEntries()])
      .then(([p, a, e]) => setTargets(targetMap([...p, ...a], e)))
      .catch((e) => setError(errorText(e)));
  }, []);

  const failed = error || (smokesError ? errorText(smokesError) : '');
  const ready = smokes !== null && targets !== null;
  const today = todayIso();
  const shown = ready ? smokes!.filter((s) => targets!.has(smokeTarget(s))) : [];
  const days = groupByDay(shown);

  function jump(date: string) {
    const h = document.getElementById(`day-${date}`);
    if (!h) return;
    const header = document.querySelector<HTMLElement>('.hdr')?.offsetHeight ?? 0;
    window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - header, behavior: 'smooth' });
  }

  return (
    <>
      <Header right={<MeButton />} />
      <main class="screen smokes">
        {!ready && !failed && <Skeleton kind="smokes" />}
        {failed && !ready && (
          <div class="empty">
            <h2>Couldn’t load your Smokes</h2>
            <p>{failed}</p>
          </div>
        )}
        {ready && (
          <>
            <WeekStrip smokes={shown} today={today} onDay={jump} />
            {days.length === 0 ? (
              <EmptyCard art="smokes" title="No smokes yet">
                <p>Each time you have something, add it here: what it was, when, how much and how it felt.</p>
                <a class="btn primary" style={{ width: 'auto' }} href="/smokes/new" onClick={linkTo('/smokes/new')}>
                  <PlusIcon />
                  Add a smoke
                </a>
              </EmptyCard>
            ) : (
              <>
                {days.map((d) => (
                  <section key={d.date} class="sday" aria-label={dayLabel(d.date, today)}>
                    <h2 class="group-h sday-h" id={`day-${d.date}`}>
                      <span class="gname">{dayLabel(d.date, today)}</span>
                      <span class="n">{d.smokes.length === 1 ? '1 smoke' : `${d.smokes.length} smokes`}</span>
                    </h2>
                    <div class="srows">
                      {d.smokes.map((s) => (
                        <SmokeRow key={s.id} smoke={s} target={targets!.get(smokeTarget(s))!} fresh={s.id === fresh} />
                      ))}
                    </div>
                  </section>
                ))}
                <p class="footnote">Only you see your Smokes. Tap one to change or delete it.</p>
              </>
            )}
          </>
        )}
      </main>
      <button class="fab" aria-label="Add a smoke" onClick={() => navigate('/smokes/new')}>
        <PlusIcon />
      </button>
      <TabBar active="smokes" />
    </>
  );
}

// The picker -------------------------------------------------------------------------

/** Set when the form was opened from the picker, so it offers Change. */
let fromPicker = false;

function PickRow(p: { target: Target; count: number; onPick: (key: string) => void }) {
  return (
    <button type="button" class="lrow pick" onClick={() => p.onPick(p.target.key)}>
      <Thumb target={p.target} />
      <span class="sbody">
        <Name target={p.target} />
        <span class="sub">{productType(p.target.productType).label}</span>
      </span>
      <span class="cnt num" aria-label={timesText(p.target.productType, p.count)}>
        {p.count}×
      </span>
    </button>
  );
}

export function SmokePicker() {
  const { smokes } = useSmokes();
  const [products, setProducts] = useState<Product[] | null>(cachedProducts());
  const [entries, setEntries] = useState<LogEntry[] | null>(cachedEntries());
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [newLog, setNewLog] = useState<{ name: string; type: ProductTypeKey } | null>(null);
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  useEffect(() => {
    Promise.all([fetchProducts(), fetchEntries()])
      .then(([p, e]) => {
        setProducts([...p]);
        setEntries([...e]);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  const choose = (key: string) => {
    fromPicker = true;
    navigate(addSmokePath(key), { replace: true });
  };

  async function addLogEntry() {
    if (!newLog) return;
    setError('');
    const v = validateLogEntryInput({ ...emptyLogEntryInput(), name: newLog.name, productType: newLog.type });
    if (!v.ok) return setError(v.message);
    setBusy(true);
    try {
      const entry = await saveEntry(null, v.value);
      choose(`e:${entry.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const ready = products !== null && entries !== null;
  const all = ready ? targetMap(products!, entries!) : new Map<string, Target>();
  const q = query.trim().toLowerCase();
  const matches = (t: Target) => !q || t.name.toLowerCase().includes(q);
  const count = (key: string) => (smokes ?? []).filter((s) => smokeTarget(s) === key).length;
  const byName = (a: Target, b: Target) => a.name.localeCompare(b.name);
  const recent = recentTargets(smokes ?? [])
    .map((k) => all.get(k))
    .filter((t): t is Target => !!t && matches(t))
    .slice(0, 4);
  const inRecent = new Set(recent.map((t) => t.key));
  const rest = [...all.values()].filter((t) => matches(t) && !inRecent.has(t.key));
  const board = rest.filter((t) => !t.log).sort(byName);
  const log = rest.filter((t) => t.log).sort(byName);
  const group = (title: string, list: Target[]) =>
    list.length > 0 && (
      <section class="pick-group" aria-label={title}>
        <h2 class="lh cap">{title}</h2>
        <div class="lrows">
          {list.map((t) => (
            <PickRow key={t.key} target={t} count={count(t.key)} onPick={choose} />
          ))}
        </div>
      </section>
    );

  return (
    <>
      <Header title="Add a smoke" left={<button class="hbtn" onClick={() => back('/smokes')}>Cancel</button>} />
      <main class="screen no-nav picker">
        <div class="pick-search">
          <label class="search">
            <SearchIcon />
            <input type="search" placeholder="Search your Leaderboard and Log" aria-label="Search your Leaderboard and Log" value={query} onInput={(e) => setQuery(e.currentTarget.value)} autoComplete="off" />
          </label>
        </div>
        {!ready && !error && <Skeleton kind="people" />}
        {ready && (
          <>
            {group('Recent', recent)}
            {group('Leaderboard', board)}
            {group('Log', log)}
            {q && recent.length + board.length + log.length === 0 && <p class="footnote">Nothing called “{query.trim()}” yet.</p>}
            <section class="pick-group" aria-label="Something new">
              {newLog === null ? (
                <div class="lrows">
                  <button type="button" class="lrow pick newlog" onClick={() => setNewLog({ name: autoCapitalise(query.trim()), type: 'flower' })}>
                    <span class="thumb plus">
                      <PlusIcon />
                    </span>
                    <span class="sbody">
                      <span class="nm">New Log entry</span>
                      <span class="sub">Something you haven’t added yet</span>
                    </span>
                  </button>
                </div>
              ) : (
                <form
                  class="fgroup newlog-form"
                  aria-label="New Log entry"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addLogEntry();
                  }}
                >
                  <span class="cap">New Log entry</span>
                  <TextField id="newlog-name" label="Name" value={newLog.name} onInput={(v) => setNewLog({ ...newLog, name: v })} onBlur={() => setNewLog({ ...newLog, name: autoCapitalise(newLog.name) })} autoCapitalize="words" />
                  <Select id="newlog-type" label="Product type" value={newLog.type} options={TYPE_OPTIONS} onChange={(v) => setNewLog({ ...newLog, type: v as ProductTypeKey })} />
                  <p class="small">It’s added to your Log, then you carry on with this smoke.</p>
                  <button class="btn primary" type="submit" disabled={busy || !online}>
                    {busy ? 'Adding…' : 'Next'}
                  </button>
                </form>
              )}
            </section>
          </>
        )}
        {error && (
          <p class="error pick-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </>
  );
}

// The form ---------------------------------------------------------------------------

interface Form {
  date: string;
  time: string;
  amount: string;
  effect: string;
}

/** Add a smoke of `target`, or change smoke `id`. */
export function SmokeForm(p: { id: string | null; target?: string }) {
  const { smokes, fresh, error: smokesError } = useSmokes();
  const existing = p.id && smokes ? smokes.find((s) => s.id === p.id) : undefined;
  const key = p.target ?? (existing ? smokeTarget(existing) : null);
  const [target, setTarget] = useState<Target | null>(null);
  const [form, setForm] = useState<Form | null>(() => (p.id ? null : { date: todayIso(), time: nowTime(), amount: '', effect: '' }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canChange] = useState(() => {
    const f = fromPicker && !p.id;
    fromPicker = false;
    return f;
  });
  const amountTouched = useRef(false);
  // Set once saved or deleted: the screen is on its way out.
  const leaving = useRef(false);
  const online = useOnline();

  // A smoke that's gone (deleted elsewhere, or reached through Back after a restore): the tab instead.
  // Only once the list is fresh: one added on another phone isn't in an older copy yet.
  useEffect(() => {
    if (p.id && fresh && !existing && !leaving.current) navigate('/smokes', { replace: true });
  }, [p.id, fresh, existing]);

  useEffect(() => {
    if (!existing || form) return;
    setForm({ date: existing.date, time: existing.time, amount: existing.amount === null ? '' : String(existing.amount), effect: existing.effect ?? '' });
  }, [existing, form]);

  // What it was: from the caches straight away, then fresh.
  useEffect(() => {
    if (!key) return;
    const id = key.slice(2);
    const product = key.startsWith('p:');
    const cached = product ? cachedProduct(id) : cachedEntry(id);
    if (cached) setTarget(product ? productTarget(cached as Product) : entryTarget(cached as LogEntry));
    (product ? fetchProduct(id).then(productTarget) : fetchEntry(id).then(entryTarget)).then(setTarget).catch((e) => {
      if (e instanceof ApiError && e.status === 404) navigate('/smokes', { replace: true });
      else setError(errorText(e));
    });
  }, [key]);

  // A new smoke starts with what you had last time (until you type one).
  useEffect(() => {
    if (p.id || !key || !smokes || amountTouched.current) return;
    const last = smokesOf(smokes, key).find((s) => s.amount !== null);
    if (last) setForm((f) => (f && !amountTouched.current ? { ...f, amount: String(last.amount) } : f));
  }, [smokes, key, p.id]);

  const title = p.id ? 'Smoke' : 'Add a smoke';
  const cancel = () => back('/smokes');
  if (!form || !target || !key) {
    const failed = error || (smokesError ? errorText(smokesError) : '');
    return (
      <>
        <Header title={title} left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
        <main class="screen no-nav">
          {failed && (
            <div class="empty">
              <h2>Couldn’t open this smoke</h2>
              <p>{failed}</p>
            </div>
          )}
        </main>
      </>
    );
  }

  const type = target.productType;
  const unit = unitFor(type).amount;
  const chips = unit === 'mg' ? ['5', '10', '20'] : ['0.2', '0.3', '0.5', '1'];
  const count = smokes ? smokesOf(smokes, key).length : null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setAmount = (v: string) => {
    amountTouched.current = true;
    set('amount', v);
  };

  async function save() {
    setError('');
    const t = form!.amount.trim().replace(',', '.');
    const amount = t === '' ? null : Number(t);
    if (amount !== null && !Number.isFinite(amount)) return setError('How much must be a number.');
    const v = validateSmokeInput(
      { productId: key!.startsWith('p:') ? key!.slice(2) : null, logEntryId: key!.startsWith('e:') ? key!.slice(2) : null, date: form!.date, time: form!.time, amount, effect: form!.effect },
      todayIso(),
    );
    if (!v.ok) return setError(v.message);
    setBusy(true);
    try {
      leaving.current = true;
      await saveSmoke(p.id, v.value);
      back('/smokes');
    } catch (e) {
      leaving.current = false;
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    setError('');
    try {
      leaving.current = true;
      await deleteSmoke(p.id!);
      back('/smokes');
    } catch (e) {
      leaving.current = false;
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={title} left={<button class="hbtn" onClick={cancel}>Cancel</button>} />
      <main class="screen has-savebar">
        <form
          class="editor smoke-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <section class="chosen" aria-label="What you had">
            <Thumb target={target} />
            <span class="sbody">
              <Name target={target} />
              <span class="sub">{count === null ? '' : timesText(type, count)}</span>
            </span>
            {canChange && (
              <button type="button" class="hbtn" onClick={() => navigate('/smokes/new', { replace: true })}>
                Change
              </button>
            )}
          </section>

          <section class="fgroup" aria-label="When">
            <GroupHead icon={CalendarIcon} label="When" />
            <div class="two-col">
              <TextField id="smoke-date" label="Date" type="date" value={form.date} onInput={(v) => set('date', v)} />
              <TextField id="smoke-time" label="Time" type="time" value={form.time} onInput={(v) => set('time', v)} />
            </div>
          </section>

          <section class="fgroup" aria-label="How much">
            <GroupHead icon={ScaleIcon} label="How much" />
            <TextField id="smoke-amount" label={unit === 'mg' ? 'Amount (mg THC)' : 'Amount (g)'} inputMode="decimal" placeholder="Optional" value={form.amount} onInput={setAmount} />
            <div class="chips" role="group" aria-label="Quick amounts">
              {chips.map((c) => (
                <button type="button" key={c} class="chip" aria-pressed={form.amount === c} onClick={() => setAmount(c)}>
                  {c} {unit}
                </button>
              ))}
            </div>
          </section>

          <section class="fgroup" aria-label="Effect">
            <GroupHead icon={SparkIcon} label="Effect" htmlFor="smoke-effect" />
            <textarea id="smoke-effect" class="input" placeholder="How did it feel?" value={form.effect} onInput={(e) => set('effect', e.currentTarget.value)} />
          </section>

          {p.id && (
            <button type="button" class="btn danger" onClick={() => setConfirmDelete(true)} disabled={busy || !online}>
              <TrashIcon />
              Delete smoke
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
          <button class="btn primary" onClick={save} disabled={busy || !online}>
            {busy ? 'Saving…' : p.id ? 'Save' : 'Add smoke'}
          </button>
        </div>
      </div>
      {confirmDelete && (
        <Sheet title="Delete this smoke?" message={`${target.name}, ${whenText(form, todayIso())}.`} options={[{ label: 'Delete smoke', danger: true, onSelect: remove }]} onCancel={() => setConfirmDelete(false)} />
      )}
    </>
  );
}

// The card on product and Log entry pages ----------------------------------------------

/**
 * Smokes on a product or Log entry page (option 1): the count in a big tile, when you last
 * had it, your last three (tap to change), and Add a smoke set to this one. "Taken" for edibles.
 */
export function SmokesCard(p: { target: string; productType: string; canAdd: boolean }) {
  const { smokes } = useSmokes();
  const mine = smokes ? smokesOf(smokes, p.target) : null;
  const today = todayIso();
  const verb = smokeVerb(p.productType);
  const add = addSmokePath(p.target);
  return (
    <section class="sect smokes-card" aria-labelledby="smokes-h">
      <span class="cap" id="smokes-h">
        Smokes
      </span>
      {mine !== null && (
        <>
          <div class="smk">
            <div class="tile smk-count">
              <b>{mine.length}</b>
              <span class="cap">{timesCaption(p.productType, mine.length)}</span>
            </div>
            <div class="smk-last">
              <span class="small">Last {verb}</span>
              <strong>{mine[0] ? whenText(mine[0], today) : `Not ${verb} yet`}</strong>
            </div>
          </div>
          {mine.length > 0 && (
            <div class="smk-recent">
              {mine.slice(0, 3).map((s) => (
                <a key={s.id} class="smk-row" href={`/smokes/${s.id}`} onClick={linkTo(`/smokes/${s.id}`)}>
                  <span class="w">{[dayLabel(s.date, today), smokeLine(s, p.productType)].filter(Boolean).join(' · ')}</span>
                  <span class="num">{s.time}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
      {p.canAdd && (
        <a class="btn primary" href={add} onClick={linkTo(add)}>
          <PlusIcon />
          Add a smoke
        </a>
      )}
    </section>
  );
}
