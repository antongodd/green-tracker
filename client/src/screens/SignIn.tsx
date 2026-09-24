import { useState } from 'preact/hooks';
import { errorText } from '../api';
import { LeafGlass } from '../icons';
import { passkeysSupported, signIn } from '../passkey';
import { linkTo } from '../router';
import { useSession } from '../session';
import { takeDeletedNotice } from './Data';

export function SignIn() {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted] = useState(takeDeletedNotice);
  const supported = passkeysSupported();

  async function go() {
    setBusy(true);
    setError('');
    try {
      await signIn();
      await refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <main class="fullscreen">
      <div class="grow">
        <LeafGlass class="mark" />
        <h1>Green Tracker</h1>
        <p class="lead">Rate, rank and remember everything you’ve tried.</p>
        {deleted && (
          <p class="lead" role="status" style={{ color: 'var(--text)' }}>
            Your account and all of its data have been deleted.
          </p>
        )}
      </div>
      <div class="actions">
        {!supported && <p class="error">This browser can’t use passkeys. Open Green Tracker in Safari on your iPhone, or another up-to-date browser.</p>}
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" onClick={go} disabled={busy || !supported}>
          {busy ? 'Waiting for your passkey…' : 'Sign in with passkey'}
        </button>
        <a class="btn secondary" href="/signup" onClick={linkTo('/signup')}>
          Create account
        </a>
        <a class="btn text" href="/recover" onClick={linkTo('/recover')}>
          Use a recovery code
        </a>
      </div>
    </main>
  );
}
