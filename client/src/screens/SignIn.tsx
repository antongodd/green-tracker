import { useState } from 'preact/hooks';
import { errorText } from '../api';
import type { Podium } from '../../../shared/domain/leaderboard';
import { Cluster, Glints, Score, Thumb, type RowProduct } from '../components/ProductRow';
import { LeafGlass } from '../icons';
import { passkeysSupported, signIn } from '../passkey';
import { linkTo } from '../router';
import { useSession } from '../session';
import { takeDeletedNotice } from './Data';

/** The welcome screen's example Leaderboard (D36): drawn with the real row parts, never anyone's data. */
const EXAMPLES: { product: RowProduct; score: number }[] = [
  { product: { id: 'eg1', name: 'Wedding Cake', productType: 'flower', strainType: 'hybrid', country: 'US', countryOther: null, photos: [] }, score: 9.4 },
  { product: { id: 'eg2', name: 'Gelato 41', productType: 'flower', strainType: 'hybrid', country: 'US', countryOther: null, photos: [] }, score: 9.1 },
  { product: { id: 'eg3', name: 'Zkittlez', productType: 'flower', strainType: 'indica', country: 'CA', countryOther: null, photos: [] }, score: 8.6 },
];

function Showcase() {
  return (
    <figure class="showcase">
      <div class="fan" aria-hidden="true">
        {EXAMPLES.map(({ product, score }, i) => {
          // The podium's three looks: rainbow, Diamond, Gold (D39).
          const podium = (i + 1) as Podium;
          return (
            <div key={product.id} class={`row tier p${podium} eg eg${i + 1}`}>
              <Glints podium={podium} />
              <span class="rk">{i + 1}</span>
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
    <main class="fullscreen welcome">
      {/* D36 (0.29.0): the name small at the top, a headline, and an example Leaderboard. */}
      <div class="grow">
        <div class="brand">
          <LeafGlass class="brand-mark" />
          <h1>Green Tracker</h1>
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
