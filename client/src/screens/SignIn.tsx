import { useState } from 'preact/hooks';
import { ApiError, api, errorText } from '../api';
import { AuthMark } from '../components/chrome';
import { PasswordField } from '../components/inputs';
import { DEFAULT_APPEARANCE, scoreBand } from '../../../shared/domain/gems';
import { Effects, RankCrown, rowClass } from '../components/Gems';
import { Cluster, Score, Thumb, type RowProduct } from '../components/ProductRow';
import { BackIcon, FaceIdIcon, LeafGlass } from '../icons';
import { passkeysSupported, signIn } from '../passkey';
import { linkTo, navigate } from '../router';
import { useSession } from '../session';
import { takeDeletedNotice } from './Data';

/** The welcome screen's example Leaderboard (D36): drawn with the real row parts, never anyone's data. */
const EXAMPLES: { product: RowProduct; score: number }[] = [
  { product: { id: 'eg1', name: 'Wedding Cake', productType: 'flower', strainType: 'hybrid', country: 'US', countryOther: null, photos: [] }, score: 9.7 },
  { product: { id: 'eg2', name: 'Gelato 41', productType: 'flower', strainType: 'hybrid', country: 'US', countryOther: null, photos: [] }, score: 9.2 },
  { product: { id: 'eg3', name: 'Zkittlez', productType: 'flower', strainType: 'indica', country: 'CA', countryOther: null, photos: [] }, score: 8.7 },
];

function Showcase() {
  return (
    <figure class="showcase">
      <div class="fan" aria-hidden="true">
        {EXAMPLES.map(({ product, score }, i) => {
          // Three of the colours (D48) in the starting preset: Aurora with the #1 mark, Violet, Lagoon (D91).
          const look = { band: scoreBand('overall', score), first: i === 0 };
          return (
            <div key={product.id} class={`row${rowClass(look, DEFAULT_APPEARANCE)} eg eg${i + 1}`}>
              <Effects band={look.band} appearance={DEFAULT_APPEARANCE} />
              <span class="rk">
                <RankCrown look={look} appearance={DEFAULT_APPEARANCE} />
                {i + 1}
              </span>
              <Thumb product={product} />
              <div class="mid">
                <div class="name">{product.name}</div>
                <Cluster product={product} />
              </div>
              <Score value={score} />
            </div>
          );
        })}
      </div>
      <figcaption>Example Leaderboard</figcaption>
    </figure>
  );
}

/** The welcome screen (D36): Sign in (email and password, D80), Create account, and Face ID for those with a passkey. */
export function SignIn() {
  const { refresh, me } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted] = useState(takeDeletedNotice);
  const supported = passkeysSupported();

  async function faceId() {
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
    <main class="fullscreen welcome">
      {/* D36 (0.29.0): the name small at the top, a headline, and an example Leaderboard. */}
      <div class="grow">
        <div class="brand">
          <LeafGlass class="brand-mark" />
          <h1>Green Tracker</h1>
          {me.site === 'dev' && (
            <b class="dev-badge" aria-label="Dev site">
              DEV
            </b>
          )}
        </div>
        <p class="headline">
          Your stash, <em>ranked.</em>
        </p>
        <p class="lead">Rate, rank and remember everything you’ve tried.</p>
        {deleted && (
          <p class="lead" role="status" style={{ color: 'var(--text)' }}>
            Your account and all of its data have been deleted.
          </p>
        )}
        <Showcase />
      </div>
      <div class="actions">
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <a class="btn primary" href="/login" onClick={linkTo('/login')}>
          Sign in
        </a>
        <a class="btn secondary" href="/signup" onClick={linkTo('/signup')}>
          Create account
        </a>
        {supported && (
          <button class="btn text" onClick={faceId} disabled={busy}>
            <FaceIdIcon />
            {busy ? 'Waiting for Face ID…' : 'Sign in with Face ID'}
          </button>
        )}
      </div>
    </main>
  );
}

/** Too many wrong tries (D80's limits; D83: only wrong tries count): the server's words, plus the way in that still works. */
const TOO_MANY_TEXT = 'Too many tries. Wait a few minutes and try again, or sign in with Face ID if you set it up.';

/** Forgot password? Honest words (0.69.1): there's no email reset yet, so Face ID is the way back in. */
const FORGOT_TEXT = 'We can’t reset passwords by email yet. If you set up Face ID, sign in with that instead.';

/** Sign in with email and password (D80); Face ID underneath for anyone with a passkey. */
export function EmailSignIn() {
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'' | 'password' | 'faceid'>('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy('password');
    setError('');
    try {
      await api('POST', '/auth/signin', { email: email.trim(), password });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'rate_limited' ? TOO_MANY_TEXT : errorText(err));
      setBusy('');
    }
  }

  async function faceId() {
    setBusy('faceid');
    setError('');
    try {
      await signIn();
      await refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy('');
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
        <AuthMark />
        <h1>Welcome back</h1>
        <div class="fgroup">
          <div class="field">
            <label for="signin-email">Email</label>
            <input id="signin-email" class="input" type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellcheck={false} required />
          </div>
          <PasswordField id="signin-password" label="Password" value={password} onInput={setPassword} autoComplete="current-password" bad={!!error} />
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button class="btn primary" type="submit" disabled={!!busy || !email.trim() || !password}>
          {busy === 'password' ? 'Signing in…' : 'Sign in'}
        </button>
        <button class="btn text" type="button" aria-expanded={forgot} aria-controls="forgot-help" onClick={() => setForgot(!forgot)}>
          Forgot password?
        </button>
        <p id="forgot-help" class="lead small" hidden={!forgot}>
          {FORGOT_TEXT}
        </p>
        {passkeysSupported() && (
          <>
            <div class="or" aria-hidden="true">
              <span />
              or
              <span />
            </div>
            <button class="btn secondary" type="button" onClick={faceId} disabled={!!busy}>
              <FaceIdIcon />
              {busy === 'faceid' ? 'Waiting for Face ID…' : 'Sign in with Face ID'}
            </button>
          </>
        )}
        <a class="btn text" href="/signup" onClick={linkTo('/signup')}>
          New here? Create account
        </a>
      </form>
    </main>
  );
}
