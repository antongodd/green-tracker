import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { errorText } from '../api';
import { buildExport, deliver, readExport, restore, type ExportSummary } from '../backup';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { CheckIcon, ChevronRight, CrossIcon, DashIcon, DownloadIcon, FaceIdIcon, FileIcon, TrashIcon, UploadIcon } from '../icons';
import { deleteAccount } from '../passkey';
import { navigate } from '../router';
import { formatDate, useSession } from '../session';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Photos done of total while Export or Restore works (D40): a bar and its words. */
type Progress = { text: string; done: number; total: number };

function ProgressCard(p: { progress: Progress }) {
  const { text, done, total } = p.progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div class="data-card teal data-progress">
      <p role="status">{text}</p>
      <div class="bar" role="progressbar" aria-label={text} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={total ? done : 0}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The top of each Data screen (D40): a glowing icon tile, a heading and one plain sentence. */
function DataHero(p: { tint: 'teal' | 'red'; icon: ComponentChildren; title: string; children: ComponentChildren }) {
  return (
    <div class="data-hero">
      <div class={`data-mark ${p.tint}`} aria-hidden="true">
        {p.icon}
      </div>
      <h1>{p.title}</h1>
      <p>{p.children}</p>
    </div>
  );
}

/** More → Export: one JSON file with everything, photos embedded; the share sheet on iPhone. */
export function ExportScreen() {
  const { me } = useSession();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [note, setNote] = useState<{ text: string; done: boolean } | null>(null);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setNote(null);
    setError('');
    setProgress({ text: 'Preparing…', done: 0, total: 0 });
    try {
      const file = await buildExport(me.user!.username, (done, total) => setProgress(total ? { text: `Adding photos: ${done} of ${total}`, done, total } : { text: 'Preparing…', done: 0, total: 0 }));
      setProgress(null);
      const how = await deliver(file);
      const size = file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB`;
      setNote(how === 'cancelled' ? { text: 'Export cancelled.', done: false } : { text: `Exported ${file.name} (${size}).`, done: true });
    } catch (e) {
      setError(errorText(e));
    }
    setProgress(null);
    setBusy(false);
  }

  return (
    <>
      <Header title="Export" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack data" style={{ paddingTop: '16px' }}>
          <DataHero tint="teal" icon={<UploadIcon />} title="Your data, in one file">
            Keep a copy, or move it to another account.
          </DataHero>
          <section class="data-card" aria-label="In the file">
            <span class="cap">In the file</span>
            <ul class="checks">
              <li class="yes">
                <CheckIcon />
                <span>
                  Every product<small>archived ones too: ratings, purchases, notes</small>
                </span>
              </li>
              <li class="yes">
                <CheckIcon />
                <span>Your whole Log</span>
              </li>
              <li class="yes">
                <CheckIcon />
                <span>
                  Every photo<small>cropped and original, cut-outs too</small>
                </span>
              </li>
              <li class="not">
                <DashIcon />
                <span>Not included: who you follow, your followers and blocks, your passkeys and recovery codes, and your filter settings</span>
              </li>
            </ul>
          </section>
          <button class="btn primary" onClick={go} disabled={busy}>
            <UploadIcon />
            {busy ? 'Exporting…' : 'Export my data'}
          </button>
          {progress && <ProgressCard progress={progress} />}
          {note && (
            <p class={`hint data-note${note.done ? ' ok' : ''}`} role="status">
              {note.text}
            </p>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {!progress && !note && !error && (
            <p class="hint data-note">
              On iPhone, choose <strong>Save to Files</strong> to keep it in Files or iCloud Drive.
            </p>
          )}
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}

const PROFILE_PHOTO: Record<ExportSummary['profilePhoto'], string> = {
  included: 'Profile photo included.',
  none: 'No profile photo: yours will be removed.',
  'not-in-file': 'No profile photo in this file: yours stays.',
};

/** More → Restore: pick a file, see what's in it, confirm, and everything is replaced at once. */
export function RestoreScreen() {
  const { refresh } = useSession();
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');

  async function pick(files: FileList | null) {
    setError('');
    setSummary(null);
    const f = files?.[0];
    if (!f) return;
    try {
      setSummary(await readExport(f));
      setFileName(f.name);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function run() {
    if (!summary) return;
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      await restore(summary, (done, total) => setProgress(done < total ? { text: `Uploading photos: ${done} of ${total}`, done, total } : { text: 'Replacing your data…', done: 1, total: 1 }));
      await refresh().catch(() => {}); // the profile photo may have changed (D23)
      navigate('/', { replace: true });
    } catch (e) {
      setError(`${errorText(e)} Nothing was changed.`);
      setBusy(false);
      setProgress(null);
    }
  }

  // One picker; its words change once a file is chosen.
  const label = summary ? 'Choose a different file' : 'Choose an export file';
  const picker = (
    <label class="btn secondary" style={{ position: 'relative' }}>
      {!summary && <FileIcon />}
      {label}
      <input type="file" accept=".json,application/json" style={{ position: 'absolute', inset: 0, opacity: 0 }} disabled={busy} onChange={(e) => (pick(e.currentTarget.files), (e.currentTarget.value = ''))} aria-label={label} />
    </label>
  );
  const f = summary?.file;
  return (
    <>
      <Header title="Restore" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack data" style={{ paddingTop: '16px' }}>
          <DataHero tint="teal" icon={<DownloadIcon />} title="Restore from a file">
            Replaces your products, Log and photos with an export file. Followers and passkeys stay as they are.
          </DataHero>
          {!summary && picker}
          {summary && f && (
            <>
              <section class="data-card teal" aria-label="File contents">
                <div class="file-head">
                  <span class="li-ic teal">
                    <FileIcon />
                  </span>
                  <span class="who">
                    <b>{fileName}</b>
                    <span>
                      Exported {formatDate(Date.parse(f.exportedAt))} by @{f.username}
                    </span>
                  </span>
                </div>
                <div class="data-tiles">
                  <div class="data-tile">
                    <b>{summary.products}</b>
                    <span>Products</span>
                  </div>
                  <div class="data-tile">
                    <b>{summary.logEntries}</b>
                    <span>Log</span>
                  </div>
                  <div class="data-tile">
                    <b>{summary.photos}</b>
                    <span>Photos</span>
                  </div>
                </div>
                <p class="hint">
                  {summary.archived ? `+ ${plural(summary.archived, 'archived product')}. ` : ''}
                  {PROFILE_PHOTO[summary.profilePhoto]}
                </p>
              </section>
              {progress ? (
                <ProgressCard progress={progress} />
              ) : (
                <button class="btn danger-out" onClick={() => setConfirming(true)} disabled={busy}>
                  <DownloadIcon />
                  Replace my data with this file
                </button>
              )}
              {picker}
            </>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
      <TabBar active="more" />
      {confirming && summary && (
        <Sheet
          title="Replace all your data?"
          message={`Everything in your account now is replaced by this file’s ${plural(summary.products + summary.archived, 'product')}, ${plural(summary.logEntries, 'log entry', 'log entries')} and ${plural(summary.photos, 'photo')}. This can’t be undone.`}
          options={[{ label: 'Replace my data', danger: true, onSelect: run }]}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

let deletedNotice = false;
/** Shown once on the sign-in screen after an account is deleted. */
export const takeDeletedNotice = () => {
  const n = deletedNotice;
  deletedNotice = false;
  return n;
};

/** More → Delete account: type the username, confirm with the passkey. Irreversible. (Look: D40.) */
export function DeleteAccount() {
  const { me, refresh } = useSession();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const username = me.user!.username;
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  async function go() {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(typed.trim());
      deletedNotice = true;
      await refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Delete account" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack data" style={{ paddingTop: '16px' }}>
          <DataHero tint="red" icon={<TrashIcon />} title={`Delete @${username}`}>
            This permanently deletes your account and everything in it. <strong>It can’t be undone.</strong>
          </DataHero>
          <section class="data-card red" aria-label="What goes">
            <span class="cap">What goes</span>
            <ul class="checks">
              <li class="gone">
                <CrossIcon />
                <span>
                  Every product, rating, purchase and note<small>archived ones too</small>
                </span>
              </li>
              <li class="gone">
                <CrossIcon />
                <span>Your whole Log</span>
              </li>
              <li class="gone">
                <CrossIcon />
                <span>Every photo</span>
              </li>
              <li class="gone">
                <CrossIcon />
                <span>Your followers, who you follow, requests and blocks</span>
              </li>
              <li class="gone">
                <CrossIcon />
                <span>Your passkeys and recovery codes</span>
              </li>
            </ul>
          </section>
          <a class="data-link" href="/more/export" onClick={(e) => (e.preventDefault(), navigate('/more/export'))}>
            <span class="li-ic teal">
              <UploadIcon />
            </span>
            <span class="main">
              <b>Keep a copy?</b> Export first.
            </span>
            <span class="go">
              Export <ChevronRight />
            </span>
          </a>
          <div class="field">
            <label for="confirm-username">Type your username to confirm</label>
            <input id="confirm-username" class={`input${matches ? ' armed' : ''}`} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder={username} autoCapitalize="none" autoCorrect="off" spellcheck={false} autoComplete="off" />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn danger-solid" onClick={go} disabled={!matches || busy}>
            <FaceIdIcon />
            {busy ? 'Waiting for your passkey…' : 'Delete my account'}
          </button>
          <p class="hint data-note">You’ll be asked for Face ID or your passkey to confirm.</p>
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
