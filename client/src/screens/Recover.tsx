import { useState } from 'preact/hooks';
import { api, errorText } from '../api';
import { BackIcon, LeafGlass } from '../icons';
import { addPasskey, passkeysSupported } from '../passkey';
import { navigate } from '../router';
import { useSession } from '../session';

/** Sign in with a recovery code (single use). The next screen asks for a new passkey (D4). */
export function Recover() {
  const { refresh } = useSession();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('POST', '/auth/recover', { username, code });
      await refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main class="fullscreen">
      <div class="fs-top">
        <button class="hbtn" onClick={() => navigate('/signin')} aria-label="Back">
          <BackIcon />
        </button>
      </div>
      <form class="form-page" onSubmit={submit}>
        <h1>Use a recovery code</h1>
        <p class="lead">Enter your username and one of the codes you saved when you created your account. Each code works once.</p>
        <div class="fgroup">
          <div class="field">
            <label for="r-username">Username</label>
            <input id="r-username" class="input" value={username} onInput={(e) => setUsername(e.currentTarget.value.trim())} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellcheck={false} required />
          </div>
          <div class="field">
            <label for="r-code">Recovery code</label>
            <input id="r-code" class="input code" value={code} onInput={(e) => setCode(e.currentTarget.value)} placeholder="XXXX-XXXX" autoComplete="one-time-code" autoCapitalize="characters" autoCorrect="off" spellcheck={false} required />
          </div>
        </div>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" type="submit" disabled={busy || !username || !code}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

/** Shown after a recovery-code sign-in until a new passkey exists. Nothing else is reachable. */
export function NewPasskey() {
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      await addPasskey();
      await refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function signOut() {
    await api('POST', '/auth/signout').catch(() => {});
    await refresh();
  }

  const left = me.recoveryCodesLeft ?? 0;
  return (
    <main class="fullscreen">
      <div class="grow">
        <LeafGlass class="mark" />
        <h1>Add a new passkey</h1>
        <p class="lead">
          You signed in as <strong>@{me.user?.username}</strong> with a recovery code. Create a passkey on this device so you can sign in with Face ID next time.
        </p>
        <p class="lead">
          You have {left} recovery {left === 1 ? 'code' : 'codes'} left.
        </p>
      </div>
      <div class="actions">
        {!passkeysSupported() && <p class="error">This browser can’t create passkeys. Open Green Tracker in Safari on your iPhone.</p>}
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" onClick={create} disabled={busy || !passkeysSupported()}>
          {busy ? 'Waiting for your passkey…' : 'Create passkey'}
        </button>
        <button class="btn text" onClick={signOut}>
          Sign out
        </button>
      </div>
    </main>
  );
}
