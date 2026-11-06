import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { CONTACT_EMAIL } from '../../../shared/domain/trust';
import { api, errorText } from '../api';
import { AuthMark, BackButton, Header } from '../components/chrome';
import { BackIcon } from '../icons';
import { useSession } from '../session';

// Trust basics for strangers (D84): the privacy page, the house rules, and the 18+ tick. Every sentence on the
// privacy page must stay true: when what's kept, where, or who sees it changes, change it here too (SPEC §4).

export const PRIVACY_UPDATED = '6 November 2026';

/** A page from Settings (with Back), or over sign-up (with Close, so nothing typed there is lost). */
function AboutPage(p: { title: string; onClose?: () => void; children: ComponentChildren }) {
  const left = p.onClose ? (
    <button type="button" class="hbtn" onClick={p.onClose} aria-label="Close">
      <BackIcon />
    </button>
  ) : (
    <BackButton to="/more" />
  );
  const body = <div class="wrap about">{p.children}</div>;
  // Over sign-up it sits inside that screen's <main>, so it isn't one itself.
  return p.onClose ? (
    <div class="about-over" role="dialog" aria-modal="true" aria-label={p.title}>
      <Header title={p.title} left={left} />
      <div class="screen">{body}</div>
    </div>
  ) : (
    <>
      <Header title={p.title} left={left} />
      <main class="screen">{body}</main>
    </>
  );
}

const Mail = () => <span class="mail">{CONTACT_EMAIL}</span>;

export function PrivacyNotice(p: { onClose?: () => void }) {
  return (
    <AboutPage title="Privacy" onClose={p.onClose}>
      <p class="intro">Green Tracker is a free app run by one person, Anton, in the UK. No ads, no tracking, and your data is never sold or shared.</p>
      <h2>What’s kept</h2>
      <ul>
        <li>
          <b>Your email</b>, only to sign you in.
        </li>
        <li>
          <b>Your password</b>, only as a scrambled code that can’t be turned back into it. Nobody can read it, Anton included.
        </li>
        <li>
          <b>Face ID</b>: only a key your iPhone makes. Your face never leaves your phone.
        </li>
        <li>
          <b>What you add</b>: your @name, profile photo, products, ratings, purchases and prices, Log, Want to try lists (only you see them, unless you share their names in What followers see), notes, photos, posts, comments, 🔥s and settings.
        </li>
        <li>
          <b>To stop break-ins</b>: a scrambled form of your internet address (never the address itself) to limit how many tries can be made, and a random code for each phone you’ve signed in on.
        </li>
      </ul>
      <h2>Where</h2>
      <p>
        With Cloudflare, who run the app’s servers: your details in <b>Western Europe</b>, your photos in <b>North America</b>. Cloudflare also keeps technical logs of visits (such as the time and the page asked for) for up to 7 days.
      </p>
      <h2>Who sees what</h2>
      <dl class="who">
        <dt>You</dt>
        <dd>Everything.</dd>
        <dt>Followers you approve</dt>
        <dd>Only what you switch on in What followers see (your Leaderboard, and your Want to try lists by name if you choose), and your posts. Never your Log or your notes.</dd>
        <dt>Anyone on the app</dt>
        <dd>Your @name. People you follow, or ask to follow, also see your profile photo, unless you turn it off.</dd>
        <dt>Anton</dt>
        <dd>Can look at the data to fix problems and to deal with reports. Never for anything else.</dd>
      </dl>
      <p>A comment or 🔥 you leave is seen by everyone who can see that post. Your email is never shown to anyone else.</p>
      <p>One thing to know: if someone tries to sign up with your email, the app tells them it’s already used.</p>
      <h2>Reports</h2>
      <p>If you report something, Anton sees what you reported and your @name. The person isn’t told who reported them.</p>
      <h2>Export and delete</h2>
      <p>
        Export your products, Log, Want to try lists, photos and posts any time (Settings, Export). Delete account removes everything at once, and your photos straight away. A copy stays in the app’s backups for up to <b>30 days</b>, then it’s gone for good.
      </p>
      <h2>For adults only</h2>
      <p>You must be 18 or over to use Green Tracker.</p>
      <h2>Contact</h2>
      <p>
        Questions, a problem, or you can’t sign in to delete your account: <Mail />
      </p>
      <p class="hint">Updated {PRIVACY_UPDATED}</p>
    </AboutPage>
  );
}

const RULES: [string, string, string][] = [
  ['🔞', '18 or over only', 'No accounts for anyone younger.'],
  ['🚫', 'No selling or supplying', 'Don’t offer, sell, swap or ask to buy anything, and no “DM me”.'],
  ['📵', 'No personal details', 'No phone numbers, addresses or other ways to find someone, yours included.'],
  ['🙈', 'No faces without a yes', 'Only post someone’s face if they’re happy for you to.'],
  ['🤝', 'Be decent', 'No threats, hate or harassment.'],
];

export function HouseRules(p: { onClose?: () => void }) {
  return (
    <AboutPage title="House rules" onClose={p.onClose}>
      <p class="intro">Green Tracker is a diary for adults, shared with friends you approve. To keep it that way:</p>
      <ul class="rules">
        {RULES.map(([e, title, text]) => (
          <li key={title}>
            <span class="e" aria-hidden="true">
              {e}
            </span>
            <span>
              <b>{title}</b>
              {text}
            </span>
          </li>
        ))}
      </ul>
      <h2>If someone breaks them</h2>
      <p>
        Tap <b>⋯</b> on the post, comment or profile, then <b>Report</b>. It disappears for you straight away, and Anton gets a look.
      </p>
      <p>Anton can remove posts and comments that break the rules and close accounts that keep doing it.</p>
      <h2>Your own stuff</h2>
      <p>What you post is down to you. Your diary stays yours: export it or delete it any time.</p>
      <p>
        Questions: <Mail />
      </p>
    </AboutPage>
  );
}

/** The 18+ tick: a real checkbox, with the two pages as links beside it (never inside the label). */
export function AdultTick(p: { checked: boolean; onChange: (v: boolean) => void; agree?: string }) {
  const [open, setOpen] = useState<'privacy' | 'rules' | null>(null);
  return (
    <div class="adult">
      <label class="adult-tick">
        <input type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.currentTarget.checked)} />
        <span>
          <b>I’m 18 or over</b>
          <small>{p.agree ?? 'and I agree to the house rules'}</small>
        </span>
      </label>
      <p class="adult-links">
        <button type="button" class="linkish" onClick={() => setOpen('rules')}>
          House rules
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" class="linkish" onClick={() => setOpen('privacy')}>
          Privacy
        </button>
      </p>
      {open === 'privacy' && <PrivacyNotice onClose={() => setOpen(null)} />}
      {open === 'rules' && <HouseRules onClose={() => setOpen(null)} />}
    </div>
  );
}

/** D84: an account from before the tick is asked once, before anything else; Sign out is the only other way on. */
export function AdultOnce() {
  const { refresh } = useSession();
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('POST', '/account/adult', { adult: true });
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
      <form class="form-page" onSubmit={go}>
        <AuthMark />
        <h1>One quick thing</h1>
        <p class="lead">Green Tracker now has house rules and a privacy page. Please confirm you’re an adult to carry on.</p>
        <AdultTick checked={adult} onChange={setAdult} agree="and I’ll follow the house rules" />
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary" type="submit" disabled={!adult || busy}>
          Continue
        </button>
        <p class="hint center">You’ll only see this once.</p>
        <button type="button" class="btn text" onClick={signOut}>
          Sign out
        </button>
      </form>
    </main>
  );
}
