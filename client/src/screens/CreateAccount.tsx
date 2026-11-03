import { useEffect, useRef, useState } from 'preact/hooks';
import { EMAIL_PROBLEM_TEXT, PASSWORD_MIN, USERNAME_MAX, USERNAME_PROBLEM_TEXT, emailProblem, passwordProblem, usernameProblem } from '../../../shared/domain/account';
import { ApiError, api, errorText } from '../api';
import { PasswordField } from '../components/inputs';
import { AdultTick } from './About';
import { BackIcon, CheckIcon, CrossIcon } from '../icons';
import { AuthMark } from '../components/chrome';
import { linkTo, navigate } from '../router';

type Availability = { state: 'idle' | 'checking' } | { state: 'ok' } | { state: 'bad'; message: string };

function Steps(p: { step: 1 | 2 }) {
  return (
    <div class="steps" role="img" aria-label={`Step ${p.step} of 2`}>
      {[1, 2].map((n) => (
        <i key={n} class={n <= p.step ? 'on' : ''} />
      ))}
    </div>
  );
}

/** The password's rule as you type: grey until it's long enough, then green with a tick (D80). */
export function PasswordHint(p: { password: string }) {
  const ok = !passwordProblem(p.password);
  return (
    <p class={`hint${ok ? ' ok' : ''}`}>
      {ok && <CheckIcon />}
      At least {PASSWORD_MIN} characters
    </p>
  );
}

/**
 * Create account (D80): 1 email and password → 2 username (live availability). Nothing is saved until
 * step 2's Create account; the server checks everything again, and a taken email sends you back to step 1.
 */
export function CreateAccount(p: { onCreated: () => void | Promise<void> }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false); // D84
  const [emailError, setEmailError] = useState('');
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

  function next(e: Event) {
    e.preventDefault();
    const problem = emailProblem(email);
    if (problem) return setEmailError(EMAIL_PROBLEM_TEXT[problem]);
    if (passwordProblem(password) || !adult) return;
    setEmailError('');
    setStep(2);
  }

  async function create(e: Event) {
    e.preventDefault();
    if (avail.state !== 'ok') return;
    setBusy(true);
    setError('');
    try {
      await api('POST', '/auth/signup', { email: email.trim(), password, username, adult });
      await p.onCreated();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code.startsWith('email_')) {
        setEmailError(err.message);
        setStep(1);
      } else if (err instanceof ApiError && err.code.startsWith('password_')) {
        setStep(1);
      } else setError(errorText(err));
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
        <form class="form-page" onSubmit={next} noValidate>
          <AuthMark />
          <h1>Create your account</h1>
          <p class="lead">Your email is private: only you see it. We use it only to sign you in.</p>
          <div class="fgroup">
            <div class="field">
              <label for="email">Email</label>
              <input
                id="email"
                class={`input${emailError ? ' bad' : ''}`}
                type="email"
                value={email}
                onInput={(e) => (setEmail(e.currentTarget.value), setEmailError(''))}
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellcheck={false}
                autoFocus
              />
              {emailError && (
                <p class="hint bad" role="alert">
                  <CrossIcon /> {emailError}
                </p>
              )}
            </div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onInput={setPassword}
              autoComplete="new-password"
              hint={
                <>
                  <PasswordHint password={password} />
                  <p class="hint">Pick one you’ll remember: we can’t reset it by email yet.</p>
                </>
              }
            />
          </div>
          <AdultTick checked={adult} onChange={setAdult} />
          <button class="btn primary" type="submit" disabled={!email.trim() || !!passwordProblem(password) || !adult}>
            Continue
          </button>
          <a class="btn text" href="/login" onClick={linkTo('/login')}>
            I already have an account
          </a>
        </form>
      ) : (
        <form class="form-page" onSubmit={create}>
          {/* For the iPhone's password store (iCloud Keychain): step 1's email and password ride along, hidden, so
              Create account saves them under the email, not the @name. Never shown, never focusable. */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
          <input type="password" name="password" autoComplete="new-password" value={password} readOnly hidden tabIndex={-1} aria-hidden="true" />
          <AuthMark />
          <h1>Pick your @name</h1>
          <p class="lead">Friends find you by this name. It’s the only thing others see until you approve them.</p>
          <div class="fgroup">
            <div class="field">
              <label for="username">Username</label>
              <div class="at-input">
                <span aria-hidden="true">@</span>
                <input
                  id="username"
                  class="input"
                  value={username}
                  onInput={(e) => setUsername(e.currentTarget.value.trim())}
                  maxLength={USERNAME_MAX + 5}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellcheck={false}
                  autoFocus
                />
              </div>
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
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn primary" type="submit" disabled={avail.state !== 'ok' || busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>
        </form>
      )}
    </main>
  );
}
