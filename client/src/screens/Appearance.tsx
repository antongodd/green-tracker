// Appearance (D48, 0.41.0; More → Appearance): your Leaderboard colours preset and the
// #1 mark. Saved to your account at once, so they follow you to a new phone; a friend's
// board shows in your colours too. (Sounds and ticks have their own screen since 0.48.0, D57: Sounds.tsx.)
import { useState } from 'preact/hooks';
import { BAND_FLOORS, PRESET_KEYS, PRESETS, scoreBand, type Appearance, type Band } from '../../../shared/domain/gems';
import { errorText } from '../api';
import { saveAppearance } from '../appearance';
import { BackButton, Header, TabBar } from '../components/chrome';
import { Glints, RankCrown, rowClass, useAppearance } from '../components/Gems';
import { Cluster, Score, Thumb, type RowProduct } from '../components/ProductRow';
import { useOnline } from '../online';
import { useSession } from '../session';
import { switchAttr } from '../sounds';

const BANDS: Band[] = [1, 2, 3, 4];

/** A made-up top row, to show the #1 mark in your colours: never anyone's data. */
const SAMPLE: RowProduct = { id: 'sample', name: 'Wedding Cake', productType: 'flower', strainType: 'hybrid', country: 'US', countryOther: null, photos: [] };
const SAMPLE_SCORE = 9.7;

function SampleRow(p: { appearance: Appearance }) {
  const look = { band: scoreBand('overall', SAMPLE_SCORE), first: true };
  return (
    <div class={`row${rowClass(look, p.appearance)} sample`} aria-hidden="true">
      <Glints band={look.band} appearance={p.appearance} />
      <span class="rk">
        <RankCrown look={look} appearance={p.appearance} />1
      </span>
      <Thumb product={SAMPLE} />
      <div class="mid">
        <div class="name">{SAMPLE.name}</div>
        <Cluster product={SAMPLE} />
      </div>
      <Score value={SAMPLE_SCORE} />
    </div>
  );
}

export function AppearanceScreen() {
  const { refresh } = useSession();
  const saved = useAppearance();
  // What you see changes at once; if the save fails it goes back.
  const [shown, setShown] = useState<Appearance | null>(null);
  const [error, setError] = useState('');
  const online = useOnline();
  const a = shown ?? saved;

  async function change(next: Appearance) {
    const before = a;
    setShown(next);
    setError('');
    try {
      await saveAppearance(next);
      await refresh();
      setShown(null);
    } catch (e) {
      setShown(before);
      setError(errorText(e));
    }
  }

  return (
    <>
      <Header title="Appearance" left={<BackButton to="/more" />} />
      <main class="screen privacy appearance">
        {error && (
          <p class="error pv-error" role="alert">
            {error}
          </p>
        )}
        <section aria-labelledby="ap-colours">
          <h2 class="lh cap" id="ap-colours">
            Leaderboard colours
          </h2>
          <div class="wrap">
            <div class="list" role="radiogroup" aria-labelledby="ap-colours">
              {PRESET_KEYS.map((k) => (
                <label key={k} class="li preset">
                  <span class="main">
                    <span>{PRESETS[k].label}</span>
                    <span class="sub">{PRESETS[k].description}</span>
                    <span class="strip" aria-hidden="true">
                      {BANDS.map((b) => (
                        <span key={b} class="strip-cell">
                          <span class={`swatch band${b} pal-${k}`} />
                          <span class="strip-l">{BAND_FLOORS[b - 1]!.toFixed(1)}+</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <input type="radio" class="radio" name="preset" value={k} checked={a.preset === k} disabled={!online} onChange={() => change({ ...a, preset: k })} />
                </label>
              ))}
            </div>
          </div>
        </section>
        <section aria-labelledby="ap-first">
          <h2 class="lh cap" id="ap-first">
            Your #1
          </h2>
          <div class="wrap">
            <div class="list">
              <label class="li priv-row">
                <span class="main">
                  <span>Mark my #1</span>
                  <span class="sub">A crown and a halo on your top product, whatever its colour.</span>
                </span>
                <input type="checkbox" role="switch" class="switch" {...switchAttr()} aria-label="Mark my #1" checked={a.markFirst} disabled={!online} onChange={(e) => change({ ...a, markFirst: e.currentTarget.checked })} />
              </label>
              <div class="li sample-li">
                <SampleRow appearance={a} />
              </div>
            </div>
          </div>
        </section>
        <div class="wrap">
          <p class="footnote priv-foot">
            Saved to your account, so it follows you to a new phone. Friends’ boards show in your colours too. The colours come from scores, so a 9.5 is
            always the top colour, wherever it is.
          </p>
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
