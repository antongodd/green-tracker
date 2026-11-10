// Put it on your Home Screen (D96). Shown by the app itself while it's open in a browser tab on a phone, before
// sign-up, so the steps are always followed on the app's own address (never the website's). On an iPhone only
// Safari can do it, so any other browser gets a stop screen with the link to copy; Android has Chrome's steps.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { installKind, safariBar, type InstallEnv, type InstallKind, type SafariBar } from '../../../shared/domain/install';
import { LeafGlass } from '../icons';
import { useSession } from '../session';

const SKIP_KEY = 'gt.install.skipped';

function env(): InstallEnv {
  const standalone = (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  return { userAgent: navigator.userAgent, standalone, touchPoints: navigator.maxTouchPoints || 0 };
}

/** What this phone and browser need to see; worked out once, as the app starts. */
export function currentInstall(): { kind: InstallKind; bar: SafariBar } {
  const e = env();
  return { kind: installKind(e), bar: safariBar(e) };
}

/** "Carry on in Safari" lasts until the tab is closed: next time, the steps are back. */
export function installSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}
export function skipInstall(): void {
  try {
    sessionStorage.setItem(SKIP_KEY, '1');
  } catch {
    // Private browsing with storage off: skipped for this page only.
  }
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
  </svg>
);
const AddIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const Key = ({ children }: { children: ComponentChildren }) => <span class="inst-key">{children}</span>;

function Step({ n, title, children }: { n: number; title: ComponentChildren; children?: ComponentChildren }) {
  return (
    <li>
      <span class="inst-n" aria-hidden="true">
        {n}
      </span>
      <div>
        <b>{title}</b>
        {children && <span class="inst-t">{children}</span>}
      </div>
    </li>
  );
}

/** The link to carry into the right browser: this site's own address, shown and copied. */
function CopyLink({ primary }: { primary?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const browser = /Android/.test(navigator.userAgent) ? 'Chrome' : 'Safari';
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.origin);
      setState('copied');
    } catch {
      setState('failed'); // some apps' own browsers refuse: the address is on screen to hold and copy
    }
  }
  return (
    <>
      <p class="inst-url">{location.host}</p>
      <button class={`btn ${primary ? 'primary' : 'secondary'}`} onClick={copy}>
        {state === 'copied' ? `Copied. Now open ${browser}` : 'Copy the link'}
      </button>
      <p class="lead small" role="status">
        {state === 'failed' ? 'Couldn’t copy it. Hold the address above, then tap Copy.' : ''}
      </p>
    </>
  );
}

export function Install({ kind, bar, onSkip }: { kind: Exclude<InstallKind, 'none'>; bar: SafariBar; onSkip: () => void }) {
  const { me } = useSession();
  const name = me.site === 'dev' ? 'GT Dev' : 'Green Tracker';
  const signedIn = !!me.user;
  const [help, setHelp] = useState(false);
  const brand = (
    <div class="brand">
      <LeafGlass class="brand-mark" />
      <p class="inst-name">Green Tracker</p>
      {me.site === 'dev' && (
        <b class="dev-badge" aria-label="Dev site">
          DEV
        </b>
      )}
    </div>
  );

  if (kind === 'ios-other' || kind === 'android-other') {
    const safari = kind === 'ios-other';
    const right = safari ? 'Safari' : 'Chrome';
    return (
      <main class="fullscreen install">
        {brand}
        <h1>Open this in {right}</h1>
        <p class="lead">
          {safari
            ? `${name} only goes on your Home Screen from Safari, the blue compass on your iPhone. You’re in another browser right now.`
            : `${name} only goes on your Home screen from Chrome. You’re in another browser right now.`}
        </p>
        <ol class="inst-steps inst-card">
          <Step n={1} title="Copy the link" />
          <Step n={2} title={`Open ${right}`}>
            {safari ? 'The blue compass on your iPhone.' : 'The red, yellow, green and blue circle.'}
          </Step>
          <Step n={3} title={safari ? 'Paste it in the bar at the bottom and tap Go' : 'Paste it in the bar at the top and tap Go'} />
        </ol>
        <CopyLink primary />
        {safari && <p class="lead small">In WhatsApp or Instagram? You can also tap ⋯ or the compass, then Open in Safari.</p>}
        <div class="inst-space" />
        {/* Someone already signed in here keeps their way to their own things; a new person can't start in the wrong browser. */}
        {signedIn && (
          <button class="btn text inst-skip" onClick={onSkip}>
            Carry on here
          </button>
        )}
      </main>
    );
  }

  const ios = kind === 'ios-safari';
  const screenName = ios ? 'Home Screen' : 'Home screen';
  const after = signedIn ? `Then open ${name} from your ${screenName}.` : `Then open ${name} from your ${screenName} and make your account there.`;
  return (
    <main class={`fullscreen install bar-${ios ? bar : 'none'}`}>
      {brand}
      <h1>
        First, put {name} on your {screenName}
      </h1>
      <p class="lead">{signedIn ? 'Three taps, and it opens full screen like a proper app.' : 'Three taps, then you make your account in the app.'}</p>
      {ios ? (
        <ol class="inst-steps inst-card">
          {bar === 'dots' ? (
            <Step
              n={1}
              title={
                <>
                  Tap <Key>···</Key> below, then{' '}
                  <Key>
                    <ShareIcon /> Share
                  </Key>
                </>
              }
            >
              Share already in the bar? Tap it.
            </Step>
          ) : (
            <Step
              n={1}
              title={
                <>
                  Tap{' '}
                  <Key>
                    <ShareIcon /> Share
                  </Key>{' '}
                  {bar === 'top' ? 'at the top' : 'below'}
                </>
              }
            >
              The square with an arrow pointing up.
            </Step>
          )}
          {bar === 'dots' ? (
            <Step
              n={2}
              title={
                <>
                  Tap View More, then{' '}
                  <Key>
                    <AddIcon /> Add to Home Screen
                  </Key>
                </>
              }
            >
              View More is the last round button.
            </Step>
          ) : (
            <Step
              n={2}
              title={
                <>
                  Tap{' '}
                  <Key>
                    <AddIcon /> Add to Home Screen
                  </Key>
                </>
              }
            >
              Scroll down the list to find it.
            </Step>
          )}
          <Step n={3} title="Tap Add">
            {after}
          </Step>
        </ol>
      ) : (
        <ol class="inst-steps inst-card">
          <Step
            n={1}
            title={
              <>
                Tap <Key>⋮</Key> at the top right
              </>
            }
          />
          <Step n={2} title="Tap Add to Home screen">
            It may say Install app.
          </Step>
          <Step n={3} title="Tap Install or Add">
            {after}
          </Step>
        </ol>
      )}
      {ios && (
        <div class="inst-help">
          <button class="btn text" aria-expanded={help} onClick={() => setHelp(!help)}>
            Can’t find Add to Home Screen?
          </button>
          {help && (
            <div class="inst-card inst-helpbox">
              <p class="lead">Then this isn’t Safari itself (an app opened the page for you). Copy the link, open Safari, the blue compass, and paste it in the bar at the bottom.</p>
              <CopyLink />
            </div>
          )}
        </div>
      )}
      <div class="inst-space" />
      <button class="btn text inst-skip" onClick={onSkip}>
        Carry on in {ios ? 'Safari' : 'Chrome'}
      </button>
      {ios && bar !== 'top' && (
        <p class="inst-arrow" aria-hidden="true">
          Start here ↓
        </p>
      )}
    </main>
  );
}
