// Sounds and ticks (D56, 0.47.0). Quiet sounds made in code (nothing downloaded) at a few
// big moments, and a light tick you can feel on iPhones (iOS 18+). Both switches and the
// sound set are saved on this phone only (localStorage), not in your account.
//
// Ticks: an iPhone web app can't vibrate, but flipping an <input type=checkbox switch>
// gives one light tick. It only works when your finger lands on the switch (or its label)
// itself: flipping it from code a moment later gives nothing (tested on Anton's iPhone).
// So a button that ticks carries <Tick />, a hidden switch inside a label that fills the
// button; the app's own switches get the `switch` attribute (`switchAttr`).

export type SoundSet = 'soft' | 'woody';
export type Moment = 'switch' | 'save' | 'log' | 'delete' | 'first';

export const SOUND_SETS: { key: SoundSet; label: string; description: string }[] = [
  { key: 'soft', label: 'Soft', description: 'Gentle pops.' },
  { key: 'woody', label: 'Woody', description: 'Warm knocks.' },
];

const KEYS = { sounds: 'gt-sounds', ticks: 'gt-ticks', set: 'gt-sound-set' } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: the choice lasts until the app closes.
  }
}

let soundsOn = read(KEYS.sounds) !== 'off';
let ticksOn = read(KEYS.ticks) !== 'off';
let soundSet: SoundSet = read(KEYS.set) === 'woody' ? 'woody' : 'soft';

export const sounds = () => ({ on: soundsOn, set: soundSet });
/** iOS 18+ Safari knows the switch control; elsewhere there are no ticks and no Ticks setting. */
export const ticksSupported = (): boolean => typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
export const ticks = (): boolean => ticksOn && ticksSupported();

export function setSoundsOn(on: boolean): void {
  soundsOn = on;
  write(KEYS.sounds, on ? 'on' : 'off');
}
export function setTicksOn(on: boolean): void {
  ticksOn = on;
  write(KEYS.ticks, on ? 'on' : 'off');
}
export function setSoundSet(set: SoundSet): void {
  soundSet = set;
  write(KEYS.set, set);
}

/** Spread onto the app's switches (`input.switch`), so flipping one ticks. */
export const switchAttr = (): Record<string, boolean> => ({ switch: ticks() });

// ---- The sound maker ----

/**
 * The iPhone's sound mode for the app (navigator.audioSession, Safari 16.4+): "ambient" is quiet on
 * silent and leaves your music playing. Set before every sound, not only once: set once (0.47.0) the
 * Home Screen app still played on silent; set every time (0.48.0) it stays quiet (Anton, D58).
 */
const SESSION = 'ambient';

function setSession(type: string): void {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== type) session.type = type;
  } catch {
    // Older Safari: nothing to set.
  }
}

let ctx: AudioContext | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
const IDLE_MS = 10_000; // then the sound maker sleeps, so it costs no battery

const AudioCtx = (): typeof AudioContext | undefined => window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

/** Each sound maker's volume: 60% on the test page, which Anton found about right. */
const volumes = new WeakMap<BaseAudioContext, GainNode>();
function volume(c: BaseAudioContext): GainNode {
  let g = volumes.get(c);
  if (!g) {
    g = c.createGain();
    g.gain.value = 0.54;
    g.connect(c.destination);
    volumes.set(c, g);
  }
  return g;
}

function audio(): AudioContext | null {
  setSession(SESSION);
  if (!ctx) {
    const AC = AudioCtx();
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  clearTimeout(idle);
  idle = setTimeout(() => ctx?.suspend().catch(() => {}), IDLE_MS);
  return ctx;
}

interface Voice {
  dur?: number;
  gain?: number;
  partials?: [number, number][];
  glide?: number;
}

function voice(c: AudioContext, t: number, freq: number, { dur = 0.12, gain = 0.2, partials = [[1, 1]], glide = 0 }: Voice = {}) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(volume(c));
  for (const [mult, amp] of partials) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * mult * glide, t + dur);
    const pg = c.createGain();
    pg.gain.value = amp;
    o.connect(pg).connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

/** A short filtered noise burst: the "knock" of wood. */
function knock(c: AudioContext, t: number, centre: number, gain: number) {
  const len = Math.ceil(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = centre;
  f.Q.value = 3;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(volume(c));
  src.start(t);
}

const MARIMBA: [number, number][] = [
  [1, 1],
  [4, 0.12],
];

type Play = (c: AudioContext, t: number) => void;
const SETS: Record<SoundSet, Record<Moment, Play>> = {
  soft: {
    switch: (c, t) => voice(c, t, 700, { dur: 0.06, gain: 0.16, glide: 0.75 }),
    save: (c, t) => {
      voice(c, t, 659, { dur: 0.14, gain: 0.18 });
      voice(c, t + 0.08, 988, { dur: 0.22, gain: 0.16 });
    },
    log: (c, t) => {
      voice(c, t, 523, { dur: 0.12, gain: 0.16 });
      voice(c, t + 0.07, 784, { dur: 0.2, gain: 0.15 });
    },
    delete: (c, t) => voice(c, t, 520, { dur: 0.22, gain: 0.16, glide: 0.62 }),
    first: (c, t) => [523, 659, 784, 1047].forEach((f, i) => voice(c, t + i * 0.075, f, { dur: i === 3 ? 0.5 : 0.16, gain: 0.15 })),
  },
  woody: {
    switch: (c, t) => {
      knock(c, t, 2400, 0.2);
      voice(c, t, 420, { dur: 0.05, gain: 0.1 });
    },
    save: (c, t) => {
      knock(c, t, 2000, 0.12);
      voice(c, t, 523, { dur: 0.16, gain: 0.2, partials: MARIMBA });
      voice(c, t + 0.09, 784, { dur: 0.22, gain: 0.18, partials: MARIMBA });
    },
    log: (c, t) => {
      knock(c, t, 1800, 0.12);
      voice(c, t, 440, { dur: 0.15, gain: 0.2, partials: MARIMBA });
      voice(c, t + 0.08, 659, { dur: 0.2, gain: 0.18, partials: MARIMBA });
    },
    delete: (c, t) => {
      knock(c, t, 1400, 0.14);
      voice(c, t, 392, { dur: 0.14, gain: 0.2, partials: MARIMBA });
      voice(c, t + 0.09, 294, { dur: 0.22, gain: 0.18, partials: MARIMBA });
    },
    first: (c, t) =>
      [523, 659, 784, 1047].forEach((f, i) => {
        knock(c, t + i * 0.08, 2000, 0.08);
        voice(c, t + i * 0.08, f, { dur: i === 3 ? 0.5 : 0.18, gain: 0.18, partials: MARIMBA });
      }),
  },
};

/** Play a moment's sound, if Sounds is on. `set` previews a set in Appearance. */
export function play(moment: Moment, set: SoundSet = soundSet): void {
  if (!soundsOn) return;
  // For the browser tests (the sounds themselves can't be heard there).
  window.dispatchEvent(new CustomEvent('gt-sound', { detail: { moment, set } }));
  const c = audio();
  if (!c) return;
  try {
    SETS[set][moment](c, c.currentTime + 0.01);
  } catch {
    // A sound must never get in the way of what you were doing.
  }
}

/**
 * iPhones only let a page make sound after a tap, and a sound that follows a save (or a new
 * #1) comes after the server answers. So every touch wakes the sound maker, and flipping any
 * of the app's switches plays the switch sound.
 */
export function installSounds(): void {
  document.addEventListener(
    'pointerdown',
    () => {
      if (soundsOn) audio();
    },
    { passive: true, capture: true },
  );
  document.addEventListener('change', (e) => {
    const t = e.target as HTMLElement | null;
    if (t instanceof HTMLInputElement && t.classList.contains('switch')) play('switch');
  });
}
