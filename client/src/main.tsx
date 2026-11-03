import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import './styles.css';
import { api, type Me } from './api';
import { DEFAULT_APPEARANCE } from '../../shared/domain/gems';
import { setOwnLook } from './screenLook';
import { forgetTheirLooks } from './theirLook';
import { LeafGlass } from './icons';
import { navigate, usePath } from './router';
import { registerServiceWorker, useOnline } from './online';
import { installPress } from './press';
import { installSounds, ticksSupported } from './sounds';
import { TickSwitch } from './components/Tick';
import { SessionContext } from './session';
import { CreateAccount } from './screens/CreateAccount';
import { AddLogin, ChangeEmail, ChangePassword, FaceIdOffer } from './screens/LoginDetails';
import { DeleteAccount, ExportScreen, RestoreScreen } from './screens/Data';
import { Editor } from './screens/Editor';
import { Log } from './screens/Log';
import { LogEditor } from './screens/LogEditor';
import { LogEntryPage } from './screens/LogEntry';
import { Archive, Leaderboard } from './screens/Leaderboard';
import { More, Passkeys } from './screens/More';
import { Profile } from './screens/Profile';
import { clearProductCache } from './products';
import { clearPrivacyCache } from './privacy';
import { clearEntryCache } from './logEntries';
import { BlockedPeople, People } from './screens/People';
import { Person, SharedProfile, TheirBrandPage } from './screens/Person';
import { Compare } from './screens/Compare';
import { EmailSignIn, SignIn } from './screens/SignIn';
import { passkeysSupported } from './passkey';
import { PrivacyScreen } from './screens/Privacy';
import { AppearanceScreen } from './screens/Appearance';
import { CurrencyScreen } from './screens/Currency';
import { SoundsScreen } from './screens/Sounds';
import { BrandPage, BrandsList } from './screens/Brands';
import { Feed } from './screens/Feed';
import { PostPage } from './screens/PostPage';
import { Composer } from './screens/Composer';

const SIGNED_OUT_PATHS = ['/signin', '/login', '/signup'];

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Sign-up step 3: the account exists but the codes must be shown once before anything else.
  // D80: just created an account: offer Face ID once (where the browser has passkeys) before the app opens.
  const [fresh, setFresh] = useState(false);
  const path = usePath();

  const refresh = useCallback(async () => {
    try {
      const next = await api<Me>('GET', '/auth/me');
      // A different (or no) account must never see the previous one's cached data.
      setMe((prev) => {
        if (prev?.user?.username !== next.user?.username) {
          clearProductCache();
          clearPrivacyCache();
          clearEntryCache();
          forgetTheirLooks();
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
    // Back on screen (iOS keeps a Home Screen app open for days): the Feed dot and the follow requests
    // number catch up (0.69.9).
    const back = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [refresh]);

  // The whole app's look (D64, D65, D72): screenLook.ts puts it on (someone you follow's instead on their
  // pages, D74). Signed out, the last look stays until someone signs in.
  const look = me?.user ? (me.appearance?.look ?? DEFAULT_APPEARANCE.look) : null;
  useEffect(() => {
    if (look) setOwnLook(look);
  }, [look]);

  // Keep the address bar honest: signed-out people live on the sign-in paths, everyone else never sees them.
  const signedIn = !!me?.user;
  useEffect(() => {
    if (!me || fresh) return;
    if (!signedIn && !SIGNED_OUT_PATHS.includes(path)) navigate('/signin', { replace: true });
    if (signedIn && SIGNED_OUT_PATHS.includes(path)) navigate('/', { replace: true });
    // The one Appearance page (D48–D70) became three (D71): its old address opens Settings.
    if (signedIn && path === '/more/appearance') navigate('/more', { replace: true });
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
      <FaceIdOffer
        onDone={() => {
          setFresh(false);
          navigate('/', { replace: true });
        }}
      />
    );
  } else if (!signedIn) {
    screen =
      path === '/signup' ? (
        <CreateAccount
          onCreated={async () => {
            if (passkeysSupported()) setFresh(true);
            else navigate('/', { replace: true });
            await refresh();
          }}
        />
      ) : path === '/login' ? (
        <EmailSignIn />
      ) : (
        <SignIn />
      );
  } else if (me.needsLogin) {
    screen = <AddLogin />;
  } else {
    const product = path.match(/^\/products\/([^/]+)(\/edit)?$/);
    const entry = path.match(/^\/log\/([^/]+)(\/promote|\/edit)?$/);
    const them = path.match(/^\/u\/([^/]+)(?:\/p\/([^/]+)|\/brands\/([^/]+)|\/(posts)|\/(compare))?$/);
    const postPage = path.match(/^\/posts\/([^/]+)$/); // D77
    const compose = path.match(/^\/feed\/new(?:\/(p|log)\/([^/]+))?$/);
    const preview = path.match(/^\/more\/privacy\/preview(?:\/p\/([^/]+)|\/brands\/([^/]+))?$/);
    const brand = path.match(/^\/brands\/([^/]+)$/); // D59
    if (path === '/products/new') screen = <Editor key="new" id={null} />;
    else if (postPage) screen = <PostPage key={path} id={decodeURIComponent(postPage[1]!)} />;
    else if (compose) screen = <Composer key={path} product={compose[1] === 'p' ? decodeURIComponent(compose[2]!) : undefined} entry={compose[1] === 'log' ? decodeURIComponent(compose[2]!) : undefined} />;
    else if (preview?.[1]) screen = <SharedProfile key={path} username={me.user!.username} id={decodeURIComponent(preview[1])} preview />;
    else if (preview?.[2]) screen = <TheirBrandPage key={path} username={me.user!.username} name={decodeURIComponent(preview[2])} preview />;
    else if (brand) screen = <BrandPage key={path} name={decodeURIComponent(brand[1]!)} />;
    else if (preview) screen = <Person key={path} username={me.user!.username} preview />;
    else if (path === '/log/new') screen = <LogEditor key="new-entry" id={null} />;
    else if (entry?.[2] === '/promote') screen = <Editor key={`promote-${entry[1]}`} id={null} promoteFrom={decodeURIComponent(entry[1]!)} />;
    else if (entry?.[2] === '/edit') screen = <LogEditor key={`edit-${entry[1]}`} id={decodeURIComponent(entry[1]!)} />;
    else if (entry) screen = <LogEntryPage key={entry[1]} id={decodeURIComponent(entry[1]!)} />;
    else if (them?.[2]) screen = <SharedProfile key={path} username={decodeURIComponent(them[1]!)} id={decodeURIComponent(them[2])} />;
    else if (them?.[3]) screen = <TheirBrandPage key={path} username={decodeURIComponent(them[1]!)} name={decodeURIComponent(them[3])} />;
    else if (them?.[5]) screen = <Compare key={path} username={decodeURIComponent(them[1]!)} />;
    else if (them) screen = <Person key={them[1]} username={decodeURIComponent(them[1]!)} tab={them[4] ? 'posts' : 'board'} />;
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
        case '/feed': // D77: in People's place in the tab bar
          screen = <Feed />;
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
        case '/more/email': // D80
          screen = <ChangeEmail />;
          break;
        case '/more/password':
          screen = <ChangePassword />;
          break;
        case '/more/privacy':
          screen = <PrivacyScreen />;
          break;
        case '/more/look': // D71: each Appearance choice on its own page
          screen = <AppearanceScreen part="look" />;
          break;
        case '/more/top':
          screen = <AppearanceScreen part="top" />;
          break;
        case '/more/colours':
          screen = <AppearanceScreen part="colours" />;
          break;
        case '/more/sounds':
          screen = <SoundsScreen />;
          break;
        case '/more/currency':
          screen = <CurrencyScreen />;
          break;
        case '/sources': // D61: the Sources tab
        case '/more/brands': // where it lived before (D59)
          screen = <BrandsList />;
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

/** Design §6.12: a slim banner under the header while offline. */
function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div class="offline" role="status">
      You’re offline — changes can’t be saved
    </div>
  );
}

render(
  <>
    <App />
    <OfflineBanner />
    {ticksSupported() && <TickSwitch />}
  </>,
  document.getElementById('app')!,
);
registerServiceWorker();
installPress();
installSounds();
