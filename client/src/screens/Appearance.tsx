// Appearance (D48, 0.41.0; Settings → Appearance): a preview, the whole app's look and the top of
// the Leaderboard (D64, 0.54.0), your Leaderboard colours preset and the #1 mark. Saved to your
// account at once, so they follow you to a new phone; a friend's board shows in your look and
// colours too. (Sounds and ticks have their own screen since 0.48.0, D57: Sounds.tsx.)
import { useRef, useState } from 'preact/hooks';
import { BAND_FLOORS, BOARD_TOP_KEYS, BOARD_TOPS, LOOK_KEYS, LOOKS, PRESET_KEYS, PRESETS, READY_LOOKS, scoreBand, type Appearance, type Band } from '../../../shared/domain/gems';
import { errorText } from '../api';
import { saveAppearance } from '../appearance';
import { BackButton, Header, TabBar } from '../components/chrome';
import { Tiles } from '../components/Controls';
import { Glints, RankCrown, rowClass, useAppearance } from '../components/Gems';
import { Cluster, Score, Thumb, type RowProduct } from '../components/ProductRow';
import { useOnline } from '../online';
import { useSession } from '../session';
import { switchAttr } from '../sounds';

const BANDS: Band[] = [1, 2, 3, 4];

/** Made-up rows, to show your look, colours and #1 mark: never anyone's data. */
const sample = (id: string, name: string, strainType: 'hybrid' | 'sativa' | 'indica'): RowProduct => ({ id, name, productType: 'flower', strainType, country: 'US', countryOther: null, photos: [] });
const SAMPLES = [
  { product: sample('s1', 'Wedding Cake', 'hybrid'), score: 9.7 },
  { product: sample('s2', 'Lemon Haze', 'sativa'), score: 9.2 },
  { product: sample('s3', 'Blue Dream', 'hybrid'), score: 8.6 },
];

function SampleRow(p: { appearance: Appearance; rank: number }) {
  const { product, score } = SAMPLES[p.rank - 1]!;
  const look = { band: scoreBand('overall', score), first: p.rank === 1 };
  return (
    <div class={`row${rowClass(look, p.appearance)} sample`}>
      <Glints band={look.band} appearance={p.appearance} />
      <span class="rk">
        <RankCrown look={look} appearance={p.appearance} />
        {p.rank}
      </span>
      <Thumb product={product} />
      <div class="mid">
        <div class="name">{product.name}</div>
        <Cluster product={product} />
      </div>
      <Score value={score} />
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

  // Quick taps (0.55.0): saves go one at a time, in order, and only the latest choice decides what's
  // shown, so an earlier save finishing can't flip a newer choice back.
  const latest = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  async function change(next: Appearance) {
    const id = ++latest.current;
    const before = a;
    setShown(next);
    setError('');
    const saving = queue.current.then(() => saveAppearance(next));
    queue.current = saving.catch(() => {});
    try {
      await saving;
      await refresh();
      if (latest.current === id) setShown(null);
    } catch (e) {
      if (latest.current !== id) return;
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
        <section aria-labelledby="ap-preview">
          <h2 class="lh cap" id="ap-preview">
            Preview
          </h2>
          <div class="wrap">
            <div class="ap-preview" aria-hidden="true">
              <Tiles
                top={a.top}
                lead={1}
                tiles={[
                  { value: '28', label: 'Products' },
                  { value: '7.7', label: 'Average' },
                  { value: '95.2g', label: 'Total' },
                ]}
                foot={<span class="who">Your #1 · <b>{SAMPLES[0]!.product.name}</b></span>}
              />
              <div class="ap-rows">
                {SAMPLES.map((_, i) => (
                  <SampleRow key={i} rank={i + 1} appearance={a} />
                ))}
              </div>
            </div>
          </div>
        </section>
        <section aria-labelledby="ap-look">
          <h2 class="lh cap" id="ap-look">
            Look
          </h2>
          <div class="wrap">
            <div class="ap-cards looks" role="radiogroup" aria-labelledby="ap-look">
              {LOOK_KEYS.map((k) => {
                const ready = READY_LOOKS.includes(k);
                return (
                  <label key={k} class={`ap-card look-${k}${ready ? '' : ' soon'}`}>
                    <span class="look-sw" aria-hidden="true">
                      <b>9.3</b>
                      <i />
                    </span>
                    <span class="ap-name">{LOOKS[k].label}</span>
                    <span class="ap-sub">{ready ? LOOKS[k].description : 'Coming next'}</span>
                    <input type="radio" class="radio" name="look" value={k} checked={a.look === k} disabled={!online || !ready} onChange={() => change({ ...a, look: k })} />
                  </label>
                );
              })}
            </div>
          </div>
        </section>
        <section aria-labelledby="ap-top">
          <h2 class="lh cap" id="ap-top">
            Top of the Leaderboard
          </h2>
          <div class="wrap">
            <div class="ap-cards tops" role="radiogroup" aria-labelledby="ap-top">
              {BOARD_TOP_KEYS.map((k) => (
                <label key={k} class={`ap-card top-${k}`}>
                  <span class="top-dia" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span class="ap-name">{BOARD_TOPS[k].label}</span>
                  <span class="ap-sub">{BOARD_TOPS[k].description}</span>
                  <input type="radio" class="radio" name="top" value={k} checked={a.top === k} disabled={!online} onChange={() => change({ ...a, top: k })} />
                </label>
              ))}
            </div>
            <p class="footnote priv-foot">The Log, friends’ boards and brand pages use it too.</p>
          </div>
        </section>
        <section aria-labelledby="ap-colours">
          <h2 class="lh cap" id="ap-colours">
            Leaderboard colours
          </h2>
          <div class="wrap">
            <div class="list" role="radiogroup" aria-labelledby="ap-colours">
              {PRESET_KEYS.map((k) => (
                <label key={k} class="li preset">
                  <span class="main">
                    <span>
                      <span class="pl">{PRESETS[k].label}</span>
                      {(k === 'aurora' || k === 'neon') && <span class="new-tag">New</span>}
                    </span>
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
            </div>
          </div>
        </section>
        <div class="wrap">
          <p class="footnote priv-foot">
            Saved to your account, so it follows you to a new phone. Friends’ boards show in your look and colours too. The colours come from scores, so a
            9.5 is always the top colour, wherever it is.
          </p>
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
