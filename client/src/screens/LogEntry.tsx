// A loose Log entry's own page (D41, 0.34.0): opened from the Log, like a product page.
// The Poster's top (D27) with an "In your Log" tag and the name, a Details card, and an
// Actions card: Add to leaderboard, Edit (also top right) and Delete entry. The form is
// at /log/:id/edit (LogEditor). `.hero-photo` is the Photo grows target (transitions.ts),
// so an entry with a photo flies it in from its Log row and home again, as products do.
import { useEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatAmount } from '../../../shared/domain/format';
import { logEntryToInput, promotionInput, type LogEntry } from '../../../shared/domain/logEntry';
import { productTypeLabel } from '../../../shared/domain/product';
import { productType } from '../../../shared/domain/productTypes';
import { ApiError, errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { draftsFromRecords } from '../components/EditorPhotos';
import { shownFromRecord } from '../components/PhotoGrid';
import { PhotoViewer } from '../components/PhotoViewer';
import { Skeleton } from '../components/Skeleton';
import { BoardLineIcon, PencilIcon, TrashIcon, TypeMark } from '../icons';
import { cachedEntry, deleteEntry, fetchEntry } from '../logEntries';
import { useOnline } from '../online';
import { startPromotion } from '../promotion';
import { back, linkTo, navigate } from '../router';
import { formatDate } from '../session';
import { smokesOf } from '../../../shared/domain/smoke';
import { cachedSmokes } from '../smokes';
import { SmokesCard } from './Smokes';

/** What deleting takes with it: its photo and (D43) its smokes. */
function deleteMessage(smokes: number, photo: boolean): string {
  const parts = [photo ? 'its photo' : null, smokes ? (smokes === 1 ? 'its smoke' : `its ${smokes} smokes`) : null].filter(Boolean);
  return `This removes the entry${parts.length ? ` and ${parts.join(' and ')}` : ''} for good.`;
}

export function LogEntryPage(p: { id: string }) {
  const [entry, setEntry] = useState<LogEntry | undefined>(cachedEntry(p.id));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(false);
  const online = useOnline();
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
    startPromotion({ entryId: e.id, input: promotionInput(logEntryToInput(e)), drafts: e.photo ? draftsFromRecords([e.photo]) : [] });
    navigate(`${path}/promote`);
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    setError('');
    try {
      await deleteEntry(p.id);
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

        <SmokesCard target={`e:${entry.id}`} productType={entry.productType} canAdd />

        <section class="sect" aria-label="Details">
          <span class="cap">Details</span>
          <dl class="kv">
            {details.filter(([, v]) => v).map(([k, v]) => [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v}</dd>])}
          </dl>
        </section>

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
          message={deleteMessage(smokesOf(cachedSmokes() ?? [], `e:${entry.id}`).length, !!entry.photo)}
          options={[{ label: 'Delete entry', danger: true, onSelect: remove }]}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
