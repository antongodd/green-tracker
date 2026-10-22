// A loose Log entry's own page (D41, 0.34.0): opened from the Log, like a product page.
// The Poster's top (D27) with an "In your Log" tag and the name, a Details card, and an
// Actions card: Add to leaderboard, Edit (also top right) and Delete entry. An entry returned
// from the Leaderboard (D50) also shows what it keeps, which Add to leaderboard brings back. The form is
// at /log/:id/edit (LogEditor). `.hero-photo` is the Photo grows target (transitions.ts),
// so an entry with a photo flies it in from its Log row and home again, as products do.
import { useEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatAmount, formatMoney, formatScore } from '../../../shared/domain/format';
import { paidInMain } from '../../../shared/domain/money';
import { useCurrency } from '../money';
import { keptPromotionInput, logEntryToInput, promotionInput, type LogEntry } from '../../../shared/domain/logEntry';
import { overall, ratedCount } from '../../../shared/domain/ratings';
import { productTypeLabel, type Product } from '../../../shared/domain/product';
import { productType } from '../../../shared/domain/productTypes';
import { ApiError, errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { draftsFromRecords } from '../components/EditorPhotos';
import { shownFromRecord } from '../components/PhotoGrid';
import { PhotoViewer } from '../components/PhotoViewer';
import { Skeleton } from '../components/Skeleton';
import { BoardLineIcon, PencilIcon, ReturnIcon, TrashIcon, TypeMark } from '../icons';
import { cachedEntry, deleteEntry, fetchEntry } from '../logEntries';
import { useOnline } from '../online';
import { play } from '../sounds';
import { startPromotion } from '../promotion';
import { back, linkTo, navigate } from '../router';
import { formatDate } from '../session';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * D50: what a returned entry keeps from the Leaderboard, as the Kept card lists it (ratings
 * under the entry's current type, as they'd count when added back), each with its label.
 */
function keptRows(kept: Product, entry: Pick<LogEntry, 'productType'>, main: string): [string, string][] {
  const rated = ratedCount(entry.productType, kept.ratings).rated;
  const o = overall(entry.productType, kept.ratings);
  const paid = kept.purchases.reduce((n, p) => n + paidInMain(p), 0); // D66: in your main currency
  const rows: [string, string][] = [
    ['Ratings', rated ? `${rated}${o !== null ? ` · Overall ${formatScore(o)}` : ''}` : ''],
    ['Purchases', kept.purchases.length ? `${kept.purchases.length} · ${formatMoney(paid, main)}` : ''],
    ['Notes', kept.notes ? 'Yes' : ''],
    ['Other photos', kept.photos.length ? String(kept.photos.length) : ''],
  ];
  return rows.filter(([, v]) => v);
}

/** What deleting takes with it: its photo, and (D50) what it keeps from the Leaderboard. */
function deleteMessage(photo: boolean, kept: Product | null): string {
  const base = `This removes the entry${photo ? ' and its photo' : ''} for good.`;
  if (!kept) return base;
  const what = [
    Object.keys(kept.ratings).length ? plural(Object.keys(kept.ratings).length, 'rating') : null,
    kept.purchases.length ? plural(kept.purchases.length, 'purchase') : null,
    kept.notes ? 'notes' : null,
    kept.photos.length ? plural(kept.photos.length, 'other photo') : null,
  ].filter((x): x is string => !!x);
  const list = what.length > 1 ? `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}` : what[0];
  return `${base} What’s kept from your Leaderboard goes too${list ? `: ${list}` : ''}.`;
}

export function LogEntryPage(p: { id: string }) {
  const [entry, setEntry] = useState<LogEntry | undefined>(cachedEntry(p.id));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(false);
  const online = useOnline();
  const main = useCurrency();
  const path = `/log/${p.id}`;

  useEffect(() => {
    fetchEntry(p.id)
      .then(setEntry)
      .catch((e) => {
        // Promoted or deleted, and reached through Back: the Log instead.
        if (e instanceof ApiError && e.status === 404) navigate('/log', { replace: true });
        else setError(errorText(e));
      });
  }, [p.id]);

  if (!entry) {
    return (
      <>
        <Header title="" left={<BackButton to="/log" />} />
        <main class="screen">
          {error ? (
            <div class="empty">
              <h2>Couldn’t open this entry</h2>
              <p>{error}</p>
            </div>
          ) : (
            <Skeleton kind="product" />
          )}
        </main>
        <TabBar active="log" />
      </>
    );
  }

  const def = productType(entry.productType);
  const labels = productTypeLabel(entry);
  const country = countryDisplay(entry.country, entry.countryOther);
  const photo = entry.photo ? shownFromRecord(entry.photo) : null;
  const details: [string, string][] = [
    ['Type', labels.type ?? ''],
    ['Concentrate type', entry.productType === 'concentrate' ? labels.concentrate ?? '' : ''],
    ['Country', country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : ''],
    ['Amount', entry.amount !== null ? formatAmount(entry.productType, entry.amount) : ''],
    ['Logged', formatDate(entry.createdAt)],
  ];

  /** Opens the product editor filled in from the entry (nothing is committed until it's saved). */
  function addToLeaderboard() {
    const e = entry!;
    const own = logEntryToInput(e);
    // D50: a returned entry comes back with everything it kept, its own photo first.
    if (e.kept) startPromotion({ entryId: e.id, input: keptPromotionInput(own, e.kept), drafts: draftsFromRecords([...(e.photo ? [e.photo] : []), ...e.kept.photos]), ratings: e.kept.ratings });
    else startPromotion({ entryId: e.id, input: promotionInput(own), drafts: e.photo ? draftsFromRecords([e.photo]) : [] });
    navigate(`${path}/promote`);
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    setError('');
    try {
      await deleteEntry(p.id);
      play('delete');
      back('/log');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const edit = (
    <a class="hbtn" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>
      Edit
    </a>
  );
  return (
    <>
      <Header title={entry.name} left={<BackButton to="/log" />} right={edit} />
      <main class="screen entry-page">
        <div class={`poster${!photo ? ' plain' : photo.cutout ? ' cut' : ''}`}>
          {photo ? (
            <button class={`hero-photo${photo.cutout ? ' cut' : ''}`} onClick={() => setViewing(true)} aria-label="Open photo">
              {/* The thumbnail (already on the device) shows until the full photo arrives (D20). */}
              <span class="hero-under" style={{ backgroundImage: `url("${photo.thumb}")` }} />
              <img src={photo.image} alt="" />
            </button>
          ) : (
            <div class="hero-photo">{def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>
          )}
          <div class="hero">
            <span class="log-tag">In your Log</span>
            <div class="hero-head">
              <h1>{entry.name}</h1>
            </div>
          </div>
        </div>


        <section class="sect" aria-label="Details">
          <span class="cap">Details</span>
          <dl class="kv">
            {details.filter(([, v]) => v).map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v}</dd>])}
          </dl>
        </section>

        {entry.kept && (
          <section class="sect kept" aria-labelledby="kept-h">
            <div class="kept-head">
              <span class="kept-ic" aria-hidden="true">
                <ReturnIcon />
              </span>
              <span>
                <strong id="kept-h">Kept from your Leaderboard</strong>
                <span class="small">Hidden for now. Add to leaderboard brings it all back.</span>
              </span>
            </div>
            {keptRows(entry.kept, entry, main).length > 0 && (
              <dl class="kv">
                {keptRows(entry.kept, entry, main).map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v}</dd>])}
              </dl>
            )}
          </section>
        )}

        <section class="sect" aria-label="Actions">
          <button class="btn primary" onClick={addToLeaderboard} disabled={busy || !online}>
            <BoardLineIcon />
            Add to leaderboard
          </button>
          <a class="btn secondary" href={`${path}/edit`} onClick={linkTo(`${path}/edit`)}>
            <PencilIcon />
            Edit
          </a>
          <button class="btn danger" onClick={() => setConfirmDelete(true)} disabled={busy || !online}>
            <TrashIcon />
            Delete entry
          </button>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
      <TabBar active="log" />
      {viewing && photo && <PhotoViewer photos={[photo]} start={0} onClose={() => setViewing(false)} />}
      {confirmDelete && (
        <Sheet
          title={`Delete “${entry.name}”?`}
          message={deleteMessage(!!entry.photo, entry.kept)}
          options={[{ label: 'Delete entry', danger: true, tick: true, onSelect: remove }]}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
