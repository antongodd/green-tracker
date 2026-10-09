// Privacy (D45, 0.38.0; layout B "Preview on top" of the mockups): what your approved
// followers see. The "What followers see" card comes from the server's own follower code
// (/api/privacy/preview), so it shows exactly what's sent; each switch saves at once.
import { useEffect, useState } from 'preact/hooks';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatScore } from '../../../shared/domain/format';
import { rankProducts } from '../../../shared/domain/leaderboard';
import { DEFAULT_PRIVACY, PRIVACY_NEEDS, privacyEnabled, type Privacy as Settings, type PrivacyKey } from '../../../shared/domain/privacy';
import { productType } from '../../../shared/domain/productTypes';
import type { SharedBoardOptions, SharedProduct } from '../../../shared/domain/social';
import { timesText } from '../../../shared/domain/smoke';
import { errorText } from '../api';
import { BackButton, Header, TabBar } from '../components/chrome';
import { Thumb } from '../components/ProductRow';
import { ChevronRight, FlameIcon } from '../icons';
import { useOnline } from '../online';
import { fetchPreview, fetchPrivacy, savePrivacy } from '../privacy';
import { linkTo } from '../router';

interface Switch {
  key: PrivacyKey;
  label: string;
  note: string;
  warn?: boolean;
}

const GROUPS: { title: string; switches: Switch[] }[] = [
  { title: 'Your Leaderboard', switches: [{ key: 'shareBoard', label: 'Share my Leaderboard', note: 'Off: followers see nothing but your name.' }] },
  {
    title: 'On your products',
    switches: [
      { key: 'shareSource', label: 'Source', note: 'Where you got it, e.g. Cookies.' },
      { key: 'shareCountry', label: 'Country', note: 'The flag and country name.' },
      { key: 'sharePhotos', label: 'Product photos', note: 'Without them, followers see the type’s mark.' },
    ],
  },
  {
    title: 'Smokes',
    switches: [
      { key: 'shareSmokeCounts', label: 'How many times I’ve had each', note: '“Smoked 14 times” on your products.' },
      { key: 'shareMostUsed', label: 'Most used on my Leaderboard', note: 'Followers can rank your board by it.' },
      { key: 'shareSmokes', label: 'My Smokes: what and when', note: 'Shows followers each smoke’s day, time and amount (never the effect).', warn: true },
    ],
  },
  { title: 'You', switches: [{ key: 'shareProfilePhoto', label: 'My profile photo', note: 'Off: everyone else sees your letter instead.' }] },
];

const LABEL = Object.fromEntries(GROUPS.flatMap((g) => g.switches.map((sw) => [sw.key, sw.label]))) as Record<PrivacyKey, string>;

type Preview = { products: SharedProduct[]; options: SharedBoardOptions; shared: boolean };

/** The top of your board as a follower gets it, and what else they see. */
function PreviewCard(p: { settings: Settings; preview: Preview | null }) {
  const pv = p.preview;
  const top = pv ? rankProducts(pv.products, { filter: 'all', rankBy: 'overall' })[0] : undefined;
  let body;
  if (!pv) body = <p class="small">Loading…</p>;
  else if (!pv.shared) body = <p class="pv-nothing">Only your name. No Leaderboard, no products.</p>;
  else if (!top) body = <p class="pv-nothing">Your Leaderboard, with nothing on it yet.</p>;
  else {
    const t = top.product;
    const country = countryDisplay(t.country, t.countryOther);
    const meta = [productType(t.productType).label, country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : null, t.source].filter(Boolean).join(' · ');
    body = (
      <>
        <div class="pv-row">
          <Thumb product={t} />
          <span class="pv-mid">
            <b>{t.name}</b>
            <span>{meta}</span>
          </span>
          <span class="pv-score">
            <b>{top.value === null ? '–' : formatScore(top.value)}</b>
            <span>{top.value === null ? 'Unrated' : 'Overall'}</span>
          </span>
        </div>
        {(t.smokeCount !== undefined || t.smokes) && (
          <p class="pv-line">
            <FlameIcon class="flame" />
            {timesText(t.productType, t.smokeCount ?? t.smokes!.length)}
            {t.smokes ? ', with each day, time and amount' : ''}
          </p>
        )}
        {pv.options.mostUsed && <p class="pv-line">They can rank your board by Most used.</p>}
      </>
    );
  }
  return (
    <section class="pv" aria-label="What followers see">
      <div class="pv-cap">
        <span>What followers see</span>
        <a href="/more/privacy/preview" onClick={linkTo('/more/privacy/preview')}>
          Open their view <ChevronRight />
        </a>
      </div>
      {body}
      <p class="pv-line">Beside your name: {p.settings.shareProfilePhoto ? 'your photo, if you have one' : 'your letter'}.</p>
    </section>
  );
}

export function PrivacyScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const online = useOnline();

  const reloadPreview = () =>
    fetchPreview()
      .then(setPreview)
      .catch(() => {});

  useEffect(() => {
    fetchPrivacy()
      .then(setSettings)
      .catch((e) => setError(errorText(e)));
    reloadPreview();
  }, []);

  /** A switch saves at once; if the save fails it goes back. */
  async function flip(key: PrivacyKey, value: boolean) {
    const before = settings!;
    const next = { ...before, [key]: value };
    setSettings(next);
    setBusy(true);
    setError('');
    try {
      setSettings(await savePrivacy(next));
      await reloadPreview();
    } catch (e) {
      setSettings(before);
      setError(errorText(e));
    }
    setBusy(false);
  }

  const s = settings ?? DEFAULT_PRIVACY;
  return (
    <>
      <Header title="Privacy" left={<BackButton to="/more" />} />
      <main class="screen privacy">
        {settings && <PreviewCard settings={s} preview={preview} />}
        {error && (
          <p class="error pv-error" role="alert">
            {error}
          </p>
        )}
        {settings &&
          GROUPS.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h2 class="lh cap">{g.title}</h2>
              <div class="wrap">
                <div class="list">
                  {g.switches.map((sw) => {
                    const enabled = privacyEnabled(s, sw.key);
                    return (
                      <label key={sw.key} class={`li priv-row${enabled ? '' : ' off'}`}>
                        <span class="main">
                          <span>{sw.label}</span>
                          <span class="sub">
                            {sw.warn && <strong class="warn">Not recommended. </strong>}
                            {/* Dimmed rows say why, in words (the text itself stays full strength). */}
                            {enabled ? sw.note : `Needs “${LABEL[PRIVACY_NEEDS[sw.key]!]}” on.`}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          class="switch"
                          aria-label={sw.label}
                          checked={s[sw.key] && enabled}
                          disabled={!enabled || busy || !online}
                          onChange={(e) => flip(sw.key, e.currentTarget.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        {settings && (
          <div class="wrap">
            <p class="footnote priv-foot">
              These apply to all your followers; they aren’t told when you change them. Someone who doesn’t follow you never sees any of it. A product
              you’ve made Private stays hidden whatever these say. Prices, purchases, suppliers, notes, date tried, Leafly links and your Log are never
              shared.
            </p>
          </div>
        )}
      </main>
      <TabBar active="more" />
    </>
  );
}
