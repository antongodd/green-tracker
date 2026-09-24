import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import './styles.css';
import { api, type Me } from './api';
import { LeafGlass } from './icons';
import { navigate, usePath } from './router';
import { SessionContext } from './session';
import { CodesStep, CreateAccount } from './screens/CreateAccount';
import { DeleteAccount, ExportScreen, RestoreScreen } from './screens/Data';
import { Editor } from './screens/Editor';
import { Log } from './screens/Log';
import { LogEditor } from './screens/LogEditor';
import { Archive, Leaderboard } from './screens/Leaderboard';
import { More, Passkeys, RecoveryCodes } from './screens/More';
import { Profile } from './screens/Profile';
import { clearProductCache } from './products';
import { clearEntryCache } from './logEntries';
import { BlockedPeople, People } from './screens/People';
import { Person, SharedProfile } from './screens/Person';
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
      const next = await api<Me>('GET', '/auth/me');
      // A different (or no) account must never see the previous one's cached data.
      setMe((prev) => {
        if (prev?.user?.username !== next.user?.username) {
          clearProductCache();
          clearEntryCache();
        }
        return next;
      });
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
    const product = path.match(/^\/products\/([^/]+)(\/edit)?$/);
    const entry = path.match(/^\/log\/([^/]+)(\/promote)?$/);
    const them = path.match(/^\/u\/([^/]+)(?:\/p\/([^/]+))?$/);
    if (path === '/products/new') screen = <Editor key="new" id={null} />;
    else if (path === '/log/new') screen = <LogEditor key="new-entry" id={null} />;
    else if (entry?.[2]) screen = <Editor key={`promote-${entry[1]}`} id={null} promoteFrom={decodeURIComponent(entry[1]!)} />;
    else if (entry) screen = <LogEditor key={entry[1]} id={decodeURIComponent(entry[1]!)} />;
    else if (them?.[2]) screen = <SharedProfile key={path} username={decodeURIComponent(them[1]!)} id={decodeURIComponent(them[2])} />;
    else if (them) screen = <Person key={path} username={decodeURIComponent(them[1]!)} />;
    else if (product?.[2]) screen = <Editor key={product[1]} id={decodeURIComponent(product[1]!)} />;
    else if (product) screen = <Profile key={product[1]} id={decodeURIComponent(product[1]!)} />;
    else
      switch (path) {
        case '/log':
          screen = <Log />;
          break;
        case '/people':
          screen = <People />;
          break;
        case '/more/blocked':
          screen = <BlockedPeople />;
          break;
        case '/more/export':
          screen = <ExportScreen />;
          break;
        case '/more/restore':
          screen = <RestoreScreen />;
          break;
        case '/more/delete':
          screen = <DeleteAccount />;
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
        case '/more/archive':
          screen = <Archive />;
          break;
        default:
          screen = <Leaderboard />;
      }
  }

  return <SessionContext.Provider value={{ me, refresh }}>{screen}</SessionContext.Provider>;
}

render(<App />, document.getElementById('app')!);
