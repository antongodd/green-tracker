import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import './styles.css';
import { api, type Me } from './api';
import { LeafGlass } from './icons';
import { navigate, usePath } from './router';
import { SessionContext } from './session';
import { CodesStep, CreateAccount } from './screens/CreateAccount';
import { More, Passkeys, RecoveryCodes } from './screens/More';
import { Placeholder } from './screens/Placeholder';
import { NewPasskey, Recover } from './screens/Recover';
import { SignIn } from './screens/SignIn';

const SIGNED_OUT_PATHS = ['/signin', '/signup', '/recover'];

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Sign-up step 3: the account exists but the codes must be shown once before anything else.
  const [fresh, setFresh] = useState<{ username: string; codes: string[] } | null>(null);
  const path = usePath();

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>('GET', '/auth/me'));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the address bar honest: signed-out people live on the sign-in paths, everyone else never sees them.
  const signedIn = !!me?.user;
  useEffect(() => {
    if (!me || fresh) return;
    if (!signedIn && !SIGNED_OUT_PATHS.includes(path)) navigate('/signin', { replace: true });
    if (signedIn && SIGNED_OUT_PATHS.includes(path)) navigate('/', { replace: true });
  }, [me, signedIn, path, fresh]);

  if (!me) {
    return (
      <div class="loading" aria-busy="true">
        {loadError ? (
          <div class="empty">
            <h2>Can’t reach Green Tracker</h2>
            <p>Check your connection and try again.</p>
            <button class="btn secondary" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : (
          <LeafGlass label="Loading" />
        )}
      </div>
    );
  }

  let screen;
  if (fresh) {
    screen = (
      <CodesStep
        username={fresh.username}
        codes={fresh.codes}
        onDone={() => {
          setFresh(null);
          navigate('/', { replace: true });
        }}
      />
    );
  } else if (!signedIn) {
    screen =
      path === '/signup' ? (
        <CreateAccount
          onCreated={async (username, codes) => {
            setFresh({ username, codes });
            await refresh();
          }}
        />
      ) : path === '/recover' ? (
        <Recover />
      ) : (
        <SignIn />
      );
  } else if (me.needsPasskey) {
    screen = <NewPasskey />;
  } else {
    switch (path) {
      case '/log':
        screen = <Placeholder tab="log" />;
        break;
      case '/people':
        screen = <Placeholder tab="people" />;
        break;
      case '/more':
        screen = <More />;
        break;
      case '/more/passkeys':
        screen = <Passkeys />;
        break;
      case '/more/recovery-codes':
        screen = <RecoveryCodes />;
        break;
      default:
        screen = <Placeholder tab="leaderboard" />;
    }
  }

  return <SessionContext.Provider value={{ me, refresh }}>{screen}</SessionContext.Provider>;
}

render(<App />, document.getElementById('app')!);
