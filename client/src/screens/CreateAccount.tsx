import { useEffect, useRef, useState } from 'preact/hooks';
import { USERNAME_MAX, USERNAME_PROBLEM_TEXT, usernameProblem } from '../../../shared/domain/account';
import { api, errorText } from '../api';
import { RecoveryCodesBlock } from '../components/RecoveryCodes';
import { BackIcon, CheckIcon, CrossIcon } from '../icons';
import { passkeysSupported, signUp } from '../passkey';
import { linkTo, navigate } from '../router';

type Availability = { state: 'idle' | 'checking' } | { state: 'ok' } | { state: 'bad'; message: string };

function Steps(p: { step: 1 | 2 | 3 }) {
  return (
    <div class="steps" role="img" aria-label={`Step ${p.step} of 3`}>
      {[1, 2, 3].map((n) => (
        <i key={n} class={n <= p.step ? 'on' : ''} />
      ))}
    </div>
  );
}

/**
 * Create account: 1 username (live availability) → 2 passkey → 3 recovery codes.
 * The account exists from step 2; step 3 is shown by `CodesStep` from App.
 */
export function CreateAccount(p: { onCreated: (username: string, codes: string[]) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [avail, setAvail] = useState<Availability>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef('');

  // Live availability: local rules first, then the server after a short pause.
  useEffect(() => {
    latest.current = username;
    if (!username) return setAvail({ state: 'idle' });
    const problem = usernameProblem(username);
    if (problem) return setAvail(problem === 'too_short' ? { state: 'idle' } : { state: 'bad', message: USERNAME_PROBLEM_TEXT[problem] });
    setAvail({ state: 'checking' });
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; message: string | null }>('GET', `/auth/username?u=${encodeURIComponent(username)}`);
        if (latest.current === username) setAvail(r.available ? { state: 'ok' } : { state: 'bad', message: r.message ?? 'That username is taken.' });
      } catch (e) {
        if (latest.current === username) setAvail({ state: 'bad', message: errorText(e) });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [username]);

  async function createPasskey() {
    setBusy(true);
    setError('');
    try {
      const r = await signUp(username);
      p.onCreated(r.user.username, r.recoveryCodes);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const back = step === 1 ? () => navigate('/signin') : () => (setStep(1), setError(''));
  const tooShort = usernameProblem(username) === 'too_short';

  return (
    <main class="fullscreen">
      <div class="fs-top">
        <button class="hbtn" onClick={back} aria-label="Back">
          <BackIcon />
        </button>
      </div>
      <Steps step={step} />
      {step === 1 ? (
        <form
          class="form-page"
          onSubmit={(e) => {
            e.preventDefault();
            if (avail.state === 'ok') setStep(2);
          }}
        >
          <h1>Choose a username</h1>
          <p class="lead">People search for you by this name. It’s the only thing others see until you approve them.</p>
          <div class="field">
            <label for="username">Username</label>
            <input
              id="username"
              class="input"
              value={username}
              onInput={(e) => setUsername(e.currentTarget.value.trim())}
              maxLength={USERNAME_MAX + 5}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellcheck={false}
              autoFocus
            />
            <p class={`hint${avail.state === 'ok' ? ' ok' : avail.state === 'bad' ? ' bad' : ''}`} role="status">
              {avail.state === 'ok' && (
                <>
                  <CheckIcon /> Available
                </>
              )}
              {avail.state === 'bad' && (
                <>
                  <CrossIcon /> {avail.message}
                </>
              )}
              {avail.state === 'checking' && 'Checking…'}
              {avail.state === 'idle' && (tooShort && username ? USERNAME_PROBLEM_TEXT.too_short : '3–20 letters, numbers or _')}
            </p>
          </div>
          <button class="btn primary" type="submit" disabled={avail.state !== 'ok'}>
            Continue
          </button>
          <a class="btn text" href="/signin" onClick={linkTo('/signin')}>
            I already have an account
          </a>
        </form>
      ) : (
        <div class="form-page">
          <h1>Create your passkey</h1>
          <p class="lead">
            Your device will ask for Face ID, Touch ID or your screen lock. That’s how you’ll sign in as <strong>@{username}</strong>. There’s no password.
          </p>
          {!passkeysSupported() && <p class="error">This browser can’t create passkeys. Open Green Tracker in Safari on your iPhone.</p>}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn primary" onClick={createPasskey} disabled={busy || !passkeysSupported()}>
            {busy ? 'Waiting for your passkey…' : 'Create passkey'}
          </button>
        </div>
      )}
    </main>
  );
}

/** Step 3: the codes are shown once; Continue waits for "I've saved these". */
export function CodesStep(p: { username: string; codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <main class="fullscreen">
      <div class="fs-top" />
      <Steps step={3} />
      <div class="form-page">
        <h1>Save your recovery codes</h1>
        <p class="lead">
          If you lose your passkey, one of these codes gets you back in. Each code works once. <strong>This is the only time you’ll see them.</strong>
        </p>
        <RecoveryCodesBlock username={p.username} codes={p.codes} />
        <label class="check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.currentTarget.checked)} />
          I’ve saved these codes somewhere safe
        </label>
        <button class="btn primary" disabled={!saved} onClick={p.onDone}>
          Continue
        </button>
      </div>
    </main>
  );
}
