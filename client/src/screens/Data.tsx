import { useState } from 'preact/hooks';
import { errorText } from '../api';
import { buildExport, deliver, readExport, restore, type ExportSummary } from '../backup';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { deleteAccount } from '../passkey';
import { navigate } from '../router';
import { formatDate, useSession } from '../session';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** More → Export: one JSON file with everything, photos embedded; the share sheet on iPhone. */
export function ExportScreen() {
  const { me } = useSession();
  const [state, setState] = useState<{ busy: boolean; note: string; error: string }>({ busy: false, note: '', error: '' });

  async function go() {
    setState({ busy: true, note: 'Preparing…', error: '' });
    try {
      const file = await buildExport(me.user!.username, (done, total) => setState((s) => ({ ...s, note: total ? `Adding photos: ${done} of ${total}` : 'Preparing…' })));
      const how = await deliver(file);
      const size = file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB`;
      setState({ busy: false, error: '', note: how === 'cancelled' ? 'Export cancelled.' : `Exported ${file.name} (${size}).` });
    } catch (e) {
      setState({ busy: false, note: '', error: errorText(e) });
    }
  }

  return (
    <>
      <Header title="Export" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          <p class="lead">
            Saves <strong>all of your data</strong> as one file: every product (archived ones too), ratings, purchases, notes, your Log, and every photo — cropped and original.
          </p>
          <p class="lead">It doesn’t include who you follow, your followers or blocks, your passkeys or recovery codes, or your filter settings.</p>
          <p class="lead">On iPhone, choose <strong>Save to Files</strong> to keep it in Files or iCloud Drive.</p>
          <button class="btn primary" onClick={go} disabled={state.busy}>
            {state.busy ? 'Exporting…' : 'Export my data'}
          </button>
          {state.note && (
            <p class="hint" role="status">
              {state.note}
            </p>
          )}
          {state.error && (
            <p class="error" role="alert">
              {state.error}
            </p>
          )}
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}

/** More → Restore: pick a file, see what's in it, confirm, and everything is replaced at once. */
export function RestoreScreen() {
  const { refresh } = useSession();
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function pick(files: FileList | null) {
    setError('');
    setSummary(null);
    const f = files?.[0];
    if (!f) return;
    try {
      setSummary(await readExport(f));
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
      await restore(summary, (done, total) => setNote(done < total ? `Uploading photos: ${done} of ${total}` : 'Replacing your data…'));
      await refresh().catch(() => {}); // the profile photo may have changed (D23)
      navigate('/', { replace: true });
    } catch (e) {
      setError(`${errorText(e)} Nothing was changed.`);
      setBusy(false);
      setNote('');
    }
  }

  const f = summary?.file;
  return (
    <>
      <Header title="Restore" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          <p class="lead">
            Restoring from an export file <strong>replaces all of your data</strong> — products, Log and photos — with what’s in the file. Your followers, who you follow and your passkeys stay as they are.
          </p>
          <label class="btn secondary" style={{ position: 'relative' }}>
            Choose an export file
            <input type="file" accept=".json,application/json" style={{ position: 'absolute', inset: 0, opacity: 0 }} disabled={busy} onChange={(e) => (pick(e.currentTarget.files), (e.currentTarget.value = ''))} aria-label="Choose an export file" />
          </label>
          {summary && f && (
            <section class="sect" style={{ margin: 0 }} aria-label="File contents">
              <span class="cap">In this file</span>
              <dl class="kv">
                <dt>Exported</dt>
                <dd>
                  {formatDate(Date.parse(f.exportedAt))} by @{f.username}
                </dd>
                <dt>Products</dt>
                <dd class="num">
                  {summary.products}
                  {summary.archived ? ` + ${summary.archived} archived` : ''}
                </dd>
                <dt>Log entries</dt>
                <dd class="num">{summary.logEntries}</dd>
                <dt>Photos</dt>
                <dd class="num">{summary.photos}</dd>
                <dt>Profile photo</dt>
                <dd>{summary.profilePhoto === 'included' ? 'Included' : summary.profilePhoto === 'none' ? 'None (yours will be removed)' : 'Not in this file (yours stays)'}</dd>
              </dl>
              <button class="btn danger" onClick={() => setConfirming(true)} disabled={busy}>
                {busy ? 'Restoring…' : 'Replace my data with this file'}
              </button>
            </section>
          )}
          {note && (
            <p class="hint" role="status">
              {note}
            </p>
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

/** More → Delete account: type the username, confirm with the passkey. Irreversible. */
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
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          <p class="lead">
            This permanently deletes <strong>@{username}</strong> and everything in it:
          </p>
          <ul class="lead" style={{ margin: 0, paddingLeft: '20px' }}>
            <li>every product, rating, purchase and note, archived ones too</li>
            <li>your whole Log</li>
            <li>every photo</li>
            <li>your followers, who you follow, requests and blocks</li>
            <li>your passkeys and recovery codes</li>
          </ul>
          <p class="lead">
            <strong>It can’t be undone.</strong> To keep a copy, <a href="/more/export" onClick={(e) => (e.preventDefault(), navigate('/more/export'))} style={{ color: 'var(--accent-bright)' }}>export your data</a> first.
          </p>
          <div class="field">
            <label for="confirm-username">Type your username to confirm</label>
            <input id="confirm-username" class="input" value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder={username} autoCapitalize="none" autoCorrect="off" spellcheck={false} autoComplete="off" />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn danger-solid" onClick={go} disabled={!matches || busy}>
            {busy ? 'Waiting for your passkey…' : 'Delete my account'}
          </button>
          <p class="hint">You’ll be asked for Face ID or your passkey to confirm.</p>
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
