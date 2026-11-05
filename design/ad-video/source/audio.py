# The ad's soundtrack, synthesized: 120 bpm, C major, 21 seconds. Music and effects share one beat grid.
import numpy as np, wave

SR = 48000
DUR = 26.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
BEAT = 0.5
rng = np.random.default_rng(7)

def note(m): return 440.0 * 2 ** ((m - 69) / 12)

def env(n, a, d, s=0.0, r=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    if r is not None:
        e *= np.clip((n / SR - t) / r, 0, 1)
    return e

def add(t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    R[i:i + len(sig)] += sig * gain * r * 1.414

def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def osc(freq, dur, kind='sine', detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * freq * t
    if kind == 'sine': return np.sin(ph)
    if kind == 'tri': return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw':
        s = np.zeros_like(t)
        for k in range(1, 12): s += np.sin(ph * k) / k * (1 if k * freq < 9000 else 0)
        return s * 0.55

# Chords per bar (2s): Cmaj7, Am7, Fmaj7, G6 (MIDI notes).
CH = [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 59, 64]]
ROOT = [36, 33, 29, 31]

def pad(t0, dur, chord, g):
    n = int(dur * SR); s = np.zeros(n)
    for m in chord:
        for dt in (-0.06, 0.06):
            s += osc(note(m + 12) * 2 ** (dt / 12), dur, 'saw')[:n]
    s = lowpass(s, 1400) * env(n, 0.35, 99, 1.0, r=0.4) / len(chord)
    add(t0, s, g * 0.5, -0.3); add(t0, s, g * 0.5, 0.3)

def kick(t0, g=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    add(t0, s, 0.9 * g)

def clap(t0, g=1.0):
    n = int(0.25 * SR); t = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = s - lowpass(s, 900)
    e = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) % 0.011) * 300) * (t < 0.035)
    add(t0, lowpass(s * e, 6000), 0.22 * g)

def hat(t0, g=1.0, pan=0.25):
    n = int(0.06 * SR); t = np.arange(n) / SR
    s = rng.standard_normal(n); s = s - lowpass(s, 7000)
    add(t0, s * np.exp(-t * 70), 0.07 * g, pan)

def bass(t0, m, dur, g=1.0):
    n = int(dur * SR)
    s = osc(note(m), dur, 'tri') + 0.4 * osc(note(m) * 2, dur, 'sine')
    add(t0, lowpass(s, 600) * env(n, 0.006, 0.18, 0.55, r=0.04), 0.42 * g)

def pluck(t0, m, g=1.0, pan=0.0, dur=0.5):
    n = int(dur * SR)
    s = osc(note(m), dur, 'tri') + 0.3 * osc(note(m) * 2, dur, 'sine')
    add(t0, s * env(n, 0.003, 0.12), 0.13 * g, pan)

def bell(t0, m, g=1.0, pan=0.0, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * note(m) * t) + 0.35 * np.sin(2 * np.pi * note(m) * 2.76 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * note(m) * 5.4 * t) * np.exp(-t * 12)
    add(t0, s * env(n, 0.002, 0.45), 0.12 * g, pan)

def pop(t0, m, g=1.0, pan=0.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = note(m) * (1 + 0.6 * np.exp(-t * 60))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32)
    add(t0, s, 0.32 * g, pan)

def tick(t0, g=1.0, pan=0.0):
    n = int(0.03 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 2093 * t) * np.exp(-t * 180)
    add(t0, s, 0.06 * g, pan)

def whoosh(t0, dur, up=True, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    s = rng.standard_normal(n)
    cut = (400 + 5000 * x) if up else (5400 - 5000 * x)
    out = np.zeros(n); acc = 0.0
    for i in range(n):
        a = np.exp(-2 * np.pi * cut[i] / SR); acc = (1 - a) * s[i] + a * acc; out[i] = acc
    shape = np.sin(np.pi * x) ** 2 if not up else x ** 2 * (x < 0.98)
    add(t0, out * shape, 0.25 * g, 0.0)

def glide(t0, dur, m0, m1, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    f = note(m0) * (note(m1) / note(m0)) ** x
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    add(t0, s * np.sin(np.pi * np.clip(x * 1.2, 0, 1)) ** 0.5 * (1 - x * 0.3), 0.05 * g, 0.1)

def sparkle(t0, root=72, g=1.0):
    for k, m in enumerate([0, 4, 7, 11, 14]):
        bell(t0 + k * 0.0625, root + m, g * (1 - k * 0.1), pan=-0.4 + k * 0.2, dur=1.2)

# 1. The hook (0–3s): a quiet pad and the texts arriving.
pad(0.0, 3.0, CH[2], 0.35)
pop(0.25, 76, 1.0, -0.2)
for k in range(4): tick(1.0 + k * 0.25, 0.8, 0.3)
pop(2.0, 72, 1.0, 0.2)
whoosh(2.0, 1.0, up=True, g=1.1)

# 2–5. The groove (3–17.5s).
GROOVE_END = 22.5
for b in range(6, int(GROOVE_END / BEAT)):
    t = b * BEAT
    bar = int(t // 2) % 4; beat_in_bar = b % 4
    kick(t, 1.0 if beat_in_bar == 0 else 0.8)
    if beat_in_bar in (1, 3): clap(t)
    hat(t + 0.25, 1.0)
    hat(t, 0.5, -0.25)
    for e in range(2): bass(t + e * 0.25, ROOT[bar] + (12 if (b * 2 + e) % 4 == 3 else 0), 0.24)
    # Plucked arpeggio, quiet, on 16ths.
    ch = CH[bar]
    for s16 in range(4):
        idx = (b * 4 + s16) * 3 % len(ch)
        pluck(t + s16 * 0.125, ch[idx] + 12, 0.6 if s16 else 0.9, pan=0.35 if s16 % 2 else -0.35, dur=0.3)
for bar_t in np.arange(3.0, GROOVE_END, 2.0):
    pad(bar_t, 2.0, CH[int(bar_t // 2) % 4], 0.22)

# The reveal.
kick(3.0, 1.3); whoosh(3.0, 0.5, up=False, g=0.6)
sparkle(3.25, 76, 0.9)
pluck(3.5, 76, 1.2); pluck(4.0, 79, 1.2)

# 3. The editor: tap, typing, photo, Hybrid, the slider, Save.
tick(6.0, 1.6)
for k in range(1, 8): tick(6.0 + k * 0.125, 0.7, 0.2 * (-1) ** k)
pop(7.25, 79, 0.8, 0.3)
pop(7.625, 74, 0.6, 0.3)
whoosh(7.625, 0.6, up=False, g=0.35)
glide(8.25, 1.0, 60, 84, 1.0)
sparkle(9.25, 72, 1.0)
pop(9.75, 67, 0.7)

# 4. Screens slide; the Leaderboard; Mega Z Emerald lands at #1.
whoosh(9.75, 0.5, up=False, g=0.5)
sparkle(11.0, 79, 1.1)
# 5. The Feed: tap the caption, type, Post (the sheet slides down); @mira's fire and comment arrive.
whoosh(13.75, 0.5, up=False, g=0.5)
tick(15.0, 1.6)
for k in range(8): tick(15.25 + k * 0.125, 0.7, 0.2 * (-1) ** k)
pop(16.75, 72, 0.9)
whoosh(16.875, 0.5, up=False, g=0.4)
sparkle(17.75, 76, 0.9)
pop(17.75, 79, 0.6, 0.3)
# 6. Sources: tap The Grove, its page slides in; a chime on what you spent.
whoosh(18.25, 0.5, up=False, g=0.5)
pop(20.0, 74, 0.8, -0.2)
whoosh(20.0, 0.45, up=False, g=0.3)
bell(21.0, 79, 1.0, 0.2); bell(21.25, 83, 0.7, -0.2)

# 6. The end: the drums stop, one big chord rings out.
whoosh(22.0, 0.5, up=True, g=0.7)
kick(23.0, 1.3)
end_chord = [36, 48, 55, 59, 62, 64, 71]
pad(23.0, 3.0, end_chord[1:], 0.55)
bass(23.0, 36, 2.6, 1.2)
sparkle(23.0, 72, 1.1)
for k, m in enumerate([84, 88, 91]): bell(23.5 + k * 0.25, m, 0.6, pan=0.3 - k * 0.3)

# A small room, then the mix.
def room(x):
    out = x.copy()
    for d, g in ((0.031, 0.22), (0.047, 0.18), (0.071, 0.14), (0.113, 0.1), (0.163, 0.07)):
        k = int(d * SR); out[k:] += lowpass(x[:-k], 3500) * g
    return out
L = room(L); R = room(R[:]) if False else room(R)
fade = np.ones(N); fl = int(0.9 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 2
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / np.max(np.abs(mix))
pcm = (mix * 32767).astype('<i2')
with wave.open('sound.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('peak', np.max(np.abs(mix)), 'rms', np.sqrt(np.mean(mix ** 2)))
