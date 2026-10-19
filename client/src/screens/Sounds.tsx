// Sounds and ticks (D56, 0.47.0; their own screen since 0.48.0, D57: More → Sounds and ticks).
// Saved on this phone at once, nothing sent to the server. On the dev site only, a Silent test
// (D57) plays the save sound in each of the iPhone's sound modes, to find the one that stays
// quiet on silent in the Home Screen app.
import { useState } from 'preact/hooks';
import { BackButton, Header, TabBar } from '../components/chrome';
import { useSession } from '../session';
import { play, setSoundsOn, setSoundSet, setTicksOn, silentTest, SILENT_TESTS, SOUND_SETS, sounds, switchAttr, ticks, ticksSupported } from '../sounds';

export function SoundsScreen() {
  const dev = useSession().me.site === 'dev';
  // A change redraws the screen, so its own switches tick or not straight away.
  const [, redraw] = useState(0);
  const now = sounds();
  const update = (f: () => void) => (f(), redraw((n) => n + 1));
  return (
    <>
      <Header title="Sounds and ticks" left={<BackButton to="/more" />} />
      <main class="screen privacy sounds-screen">
        <section aria-label="Sounds and ticks">
          <div class="wrap">
            <div class="list">
              <label class="li priv-row">
                <span class="main">
                  <span>Sounds</span>
                  <span class="sub">Quiet sounds when you save, delete or get a new #1.</span>
                </span>
                <input type="checkbox" role="switch" class="switch" {...switchAttr()} aria-label="Sounds" checked={now.on} onChange={(e) => update(() => setSoundsOn(e.currentTarget.checked))} />
              </label>
              {ticksSupported() && (
                <label class="li priv-row">
                  <span class="main">
                    <span>Ticks</span>
                    <span class="sub">A light tick you can feel as you tap.</span>
                  </span>
                  <input type="checkbox" role="switch" class="switch" {...switchAttr()} aria-label="Ticks" checked={ticks()} onChange={(e) => update(() => setTicksOn(e.currentTarget.checked))} />
                </label>
              )}
            </div>
          </div>
        </section>
        {now.on && (
          <section aria-labelledby="ap-sound-set">
            <h2 class="lh cap" id="ap-sound-set">
              Sound
            </h2>
            <div class="wrap">
              <div class="list" role="radiogroup" aria-labelledby="ap-sound-set">
                {SOUND_SETS.map((s) => (
                  <label key={s.key} class="li sound-set">
                    <span class="main">
                      <span>{s.label}</span>
                      <span class="sub">{s.description}</span>
                    </span>
                    <input
                      type="radio"
                      class="radio"
                      name="sound-set"
                      value={s.key}
                      checked={now.set === s.key}
                      onClick={() => update(() => (setSoundSet(s.key), play('save', s.key)))}
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}
        <div class="wrap">
          <p class="footnote priv-foot">Saved on this phone only{now.on ? '. Tap a sound to hear it.' : '.'}</p>
        </div>
        {dev && (
          <section aria-labelledby="silent-test">
            <h2 class="lh cap" id="silent-test">
              Silent test (dev only)
            </h2>
            <div class="wrap">
              <p class="footnote silent-how">Flip your iPhone to silent, then tap each test. Which ones stay quiet?</p>
              <div class="silent-tests">
                {SILENT_TESTS.map((t, i) => (
                  <button key={t} type="button" class="btn secondary" onClick={() => silentTest(t)}>
                    Test {i + 1}
                    {i === 0 ? ' (now)' : ''}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <TabBar active="more" />
    </>
  );
}
