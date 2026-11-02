import { useState } from 'preact/hooks';
import { EMAIL_PROBLEM_TEXT, emailProblem, passwordProblem } from '../../../shared/domain/account';
import { api, errorText } from '../api';
import { AuthMark, BackButton, Header, TabBar } from '../components/chrome';
import { PasswordField } from '../components/inputs';
import { FaceIdIcon } from '../icons';
import { addPasskey } from '../passkey';
import { navigate } from '../router';
import { useSession } from '../session';
import { PasswordHint } from './CreateAccount';

// D80: email and password. Accounts from before it add both once (AddLogin); Settings can change either.

/** Straight after creating an account, once: a passkey so Face ID signs you in next time. */
export function FaceIdOffer(p: { onDone: () => void }) {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function yes() {
    setBusy(true);
    setError('');
    try {
      await addPasskey();
      await refresh(); // Settings counts it straight away
      p.onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <main class="fullscreen">
      <div class="grow">
        <div class="auth-mark big" aria-hidden="true">
          <FaceIdIcon />
        </div>
        <h1>Use Face ID next time?</h1>
        <p class="lead">Sign in with a glance instead of typing your password. You can change this any time in Settings.</p>
      </div>
      <div class="actions">
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" onClick={yes} disabled={busy}>
          {busy ? 'Waiting for Face ID…' : 'Use Face ID'}
        </button>
        <button class="btn text" onClick={p.onDone} disabled={busy}>
          Not now
        </button>
      </div>
    </main>
  );
}

/** An account from before D80 (signed in with Face ID): nothing else opens until it has an email and password. */
export function AddLogin() {
  const { me, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: Event) {
    e.preventDefault();
    const problem = emailProblem(email);
    if (problem) return setError(EMAIL_PROBLEM_TEXT[problem]);
    setBusy(true);
    setError('');
    try {
      await api('POST', '/account/login', { email: email.trim(), password });
      await refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function signOut() {
    await api('POST', '/auth/signout').catch(() => {});
    await refresh();
  }

  return (
    <main class="fullscreen">
      <div class="fs-top" />
      <form class="form-page" onSubmit={save} noValidate>
        <AuthMark />
        <h1>Add an email and password</h1>
        <p class="lead">
          You’ll sign in with these from now on, or with Face ID as before. <strong>Recovery codes are gone</strong>, so you don’t need to keep them any more.
        </p>
        <p class="login-who">@{me.user?.username}</p>
        <div class="fgroup">
          <div class="field">
            <label for="login-email">Email</label>
            <input id="login-email" class="input" type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellcheck={false} />
          </div>
          <PasswordField id="login-password" label="New password" value={password} onInput={setPassword} autoComplete="new-password" hint={<PasswordHint password={password} />} />
          <p class="hint">Your email is private. Nobody else ever sees it.</p>
        </div>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" type="submit" disabled={busy || !email.trim() || !!passwordProblem(password)}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
        <p class="lead small">Your products, Log, photos and followers stay just as they are.</p>
        <button class="btn text" type="button" onClick={signOut}>
          Sign out
        </button>
      </form>
    </main>
  );
}

/** Settings › Email: a new email, after your password. */
export function ChangeEmail() {
  const { me, refresh } = useSession();
  const [email, setEmail] = useState(me.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: Event) {
    e.preventDefault();
    const problem = emailProblem(email);
    if (problem) return setError(EMAIL_PROBLEM_TEXT[problem]);
    setBusy(true);
    setError('');
    try {
      await api('PUT', '/account/email', { email: email.trim(), password });
      await refresh();
      navigate('/more');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Email" left={<BackButton to="/more" />} />
      <main class="screen">
        <form class="wrap stack" style={{ paddingTop: '16px' }} onSubmit={save} noValidate>
          <p class="lead">You sign in with this email. It’s private: nobody else ever sees it.</p>
          <div class="fgroup">
            <div class="field">
              <label for="new-email">Email</label>
              <input id="new-email" class="input" type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellcheck={false} />
            </div>
            <PasswordField id="email-password" label="Your password" value={password} onInput={setPassword} autoComplete="current-password" />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn primary" type="submit" disabled={busy || !email.trim() || email.trim() === me.email || !password}>
            {busy ? 'Saving…' : 'Save email'}
          </button>
        </form>
      </main>
      <TabBar active="more" />
    </>
  );
}

/** Settings › Password: the current one, then a new one. Other devices are signed out. */
export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function save(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('PUT', '/account/password', { current, password });
      setDone(true);
      setCurrent('');
      setPassword('');
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  return (
    <>
      <Header title="Password" left={<BackButton to="/more" />} />
      <main class="screen">
        <form class="wrap stack" style={{ paddingTop: '16px' }} onSubmit={save}>
          <div class="fgroup">
            <PasswordField id="current-password" label="Current password" value={current} onInput={(v) => (setCurrent(v), setDone(false))} autoComplete="current-password" />
            <PasswordField id="new-password" label="New password" value={password} onInput={(v) => (setPassword(v), setDone(false))} autoComplete="new-password" hint={<PasswordHint password={password} />} />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p class="hint ok" role="status">
              Password changed. Any other phone or computer signed in to your account has been signed out.
            </p>
          )}
          <button class="btn primary" type="submit" disabled={busy || !current || !!passwordProblem(password)}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </main>
      <TabBar active="more" />
    </>
  );
}
