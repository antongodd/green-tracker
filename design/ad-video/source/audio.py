# The soundtrack, written for this video: a laid-back 90 bpm beat (F minor), with the effects in the same key
# and on the same grid as the picture (timeline.json, from events.mjs). Synthesized here: no samples, no licence.
# python3 -I audio.py  →  sound.wav (44.1 kHz stereo)
import json, wave, sys
import numpy as np

SR = 44100
SHORT = len(sys.argv) > 1 and sys.argv[1] == 'short'
T = json.load(open('timeline-short.json' if SHORT else 'timeline.json'))
TOTAL = T['total']
N = int(SR * (TOTAL + 0.5))
BEAT = 60 / T['bpm']
BAR = 4 * BEAT
rng = np.random.default_rng(420)
SC = T['scenes']

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'])}
def n(name):  # 'Ab3' → midi
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]

def env(length, a=0.005, d=0.3, s=0.0, r=0.05, hold=None):
    k = int(SR * length); t = np.arange(k) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / d))
    rel = np.clip((length - t) / r, 0, 1)
    return e * rel

def shape(x, lo=None, hi=None, order=2):
    # zero-phase filter in the frequency domain
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, len(x))

class Track:
    def __init__(self): self.l = np.zeros(N); self.r = np.zeros(N)
    def add(self, t, x, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= N or i < 0: return
        x = x[: N - i]
        self.l[i:i + len(x)] += x * gain * np.sqrt((1 - pan) / 2) * 1.414
        self.r[i:i + len(x)] += x * gain * np.sqrt((1 + pan) / 2) * 1.414

# ---- instruments
def keys(m, length, vel=1.0):
    # an electric piano: a round tone with a little bell on the attack and a slow tremolo
    f = hz(m); k = int(SR * length); t = np.arange(k) / SR
    x = np.sin(2 * np.pi * f * t + 0.9 * np.exp(-t / 0.25) * np.sin(2 * np.pi * f * 2 * t))
    x += 0.34 * np.exp(-t / 0.1) * np.sin(2 * np.pi * f * 7.02 * t) * vel + 0.2 * np.exp(-t / 0.3) * np.sin(2 * np.pi * f * 3 * t)
    x += 0.12 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.5)
    return x * env(length, 0.006, 0.9, 0.12, 0.12) * vel

def bass(m, length):
    f = hz(m); k = int(SR * length); t = np.arange(k) / SR
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.3) + 0.3 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.2)
    return np.tanh(1.6 * x) * env(length, 0.008, 0.6, 0.5, 0.05)

def kick():
    k = int(SR * 0.32); t = np.arange(k) / SR
    ph = 2 * np.pi * np.cumsum(48 + 95 * np.exp(-t / 0.035)) / SR
    return np.tanh(1.8 * np.sin(ph)) * np.exp(-t / 0.13) + 0.25 * shape(rng.standard_normal(k), hi=3000) * np.exp(-t / 0.004)

def snare(v=1.0):
    k = int(SR * 0.26); t = np.arange(k) / SR
    nz = shape(rng.standard_normal(k), lo=900, hi=7000) * np.exp(-t / 0.075)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) + 0.5 * np.sin(2 * np.pi * 285 * t) * np.exp(-t / 0.03)
    return (0.9 * nz + 0.55 * tone) * v

def hat(open_=False, v=1.0):
    k = int(SR * (0.22 if open_ else 0.05)); t = np.arange(k) / SR
    return shape(rng.standard_normal(k), lo=6500, hi=13000) * np.exp(-t / (0.07 if open_ else 0.014)) * v

def clap():
    k = int(SR * 0.2); t = np.arange(k) / SR
    e = sum(np.exp(-np.maximum(0, t - d) / 0.012) * (t >= d) for d in (0, 0.011, 0.023)) + 0.6 * np.exp(-t / 0.07)
    return shape(rng.standard_normal(k), lo=800, hi=5000) * e * 0.5

def pluck(m, length, v=1.0):
    f = hz(m); k = int(SR * length); t = np.arange(k) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.2)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = np.sin(ph) + 0.3 * np.sin(2 * ph) * np.exp(-t / 0.2) + 0.12 * np.sin(3 * ph) * np.exp(-t / 0.1)
    return x * env(length, 0.012, 0.45, 0.25, 0.1) * v

def bell(m, length=0.9, v=1.0):
    f = hz(m); k = int(SR * length); t = np.arange(k) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.28) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.09) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.04)
    return x * np.minimum(1, t / 0.002) * v

def click(f=1500, d=0.012, v=1.0):
    k = int(SR * 0.05); t = np.arange(k) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / d) + 0.4 * shape(rng.standard_normal(k), lo=1500, hi=6000) * np.exp(-t / 0.004)) * v

def swell(length, lo, hi, rise=True):
    k = int(SR * length); t = np.arange(k) / SR
    x = shape(rng.standard_normal(k), lo=lo, hi=hi)
    e = (t / length) ** 2.2 if rise else np.exp(-t / (length / 4))
    return x * e * np.clip((length - t) / 0.02, 0, 1)

def glide(f0, f1, length, v=1.0):
    k = int(SR * length); t = np.arange(k) / SR
    f = f0 * (f1 / f0) ** (t / length)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / length) ** 0.6 * v

# ---- the arrangement, bar by bar
CH = [  # root for the bass, then the chord
    ('F2', ['Ab3', 'C4', 'Eb4', 'G4']),      # Fm9
    ('Db2', ['F3', 'Ab3', 'C4', 'Eb4']),     # Dbmaj9
    ('Ab1', ['G3', 'Bb3', 'C4', 'Eb4']),     # Abmaj9
    ('Eb2', ['G3', 'Bb3', 'Db4', 'F4']),     # Eb9
]
MEL = [
    [(0.5, 'C5', .5), (1.0, 'Eb5', .5), (1.5, 'F5', 1.0), (3.0, 'Eb5', .5), (3.5, 'C5', .5)],
    [(0.5, 'Ab4', .5), (1.0, 'C5', .5), (1.5, 'Eb5', 1.5)],
    [(0.5, 'C5', .5), (1.0, 'Eb5', .5), (1.5, 'G5', 1.0), (2.5, 'F5', .5), (3.0, 'Eb5', 1.0)],
    [(0.5, 'Bb4', .5), (1.0, 'Db5', .5), (1.5, 'F5', 1.5), (3.5, 'G5', .5)],
]
drums, bs, ep, mel, fx = Track(), Track(), Track(), Track(), Track()
SW = 0.024  # swing: the off 16ths sit a touch late
def at(bar, beat):
    s = beat % 0.5
    return bar * BAR + beat * BEAT + (SW if abs(s - 0.25) < 1e-6 else 0)

t_drop, t_answer, t_end = SC['snap'], SC['answer'], SC['end']
t_looks = SC['looks']
BARS = int(np.ceil(TOTAL / BAR))
duck = np.ones(N)  # the chords and bass dip under each kick
for b in range(BARS):
    t0 = b * BAR
    root, chord = CH[b % 4]
    full = t_drop <= t0 < t_answer - 0.01 or t0 >= t_end - 0.01
    quiet = t0 < t_drop
    lift = t_looks <= t0 < t_answer
    # chords
    if t0 < t_end + 2 * BAR - 0.01:
        for (bt, ln, v) in ([(0, 3.4, 1.0), (1.5, 1.2, .55), (3.5, .5, .4)] if not quiet else [(0, 3.9, .8)]):
            for i, nm in enumerate(chord):
                ep.add(at(b, bt) + i * 0.012, keys(n(nm), ln * BEAT, v), 0.085, pan=(-.35 + .23 * i))
    if full:
        last = t0 + BAR >= TOTAL - 0.2
        for (bt, m, ln) in [(0, n(root), .7), (1.5, n(root), .45), (2.5, n(root) + 7, .45), (3.5, n(root) + (12 if b % 2 else 10), .4)]:
            if not (last and bt > 0): bs.add(at(b, bt), bass(m, ln * BEAT if not last else 2.5), 0.27)
        ks = [0, 1.75, 2.5] + ([3.75] if b % 4 == 3 else [])
        for bt in ks:
            if last and bt > 0: continue
            drums.add(at(b, bt), kick(), 0.6)
            i = int(at(b, bt) * SR); k = int(.22 * SR)
            if i + k < N: duck[i:i + k] = np.minimum(duck[i:i + k], 1 - .45 * np.exp(-np.arange(k) / SR / .07))
        if not last:
            for bt in (1, 3): drums.add(at(b, bt), snare(), 0.46); drums.add(at(b, bt), clap(), 0.26 if lift else 0.14)
            if b % 4 == 3: drums.add(at(b, 3.75), snare(.45), 0.25)
            if b % 2 == 1: drums.add(at(b, 2.25), snare(.3), 0.2)
            busy = t0 >= SC['rate'] - 0.01
            for h in range(16 if busy else 8):
                bt = h * (0.25 if busy else 0.5)
                v = (1.0 if bt % 1 == 0 else .62 if bt % .5 == 0 else .33) * (0.85 + 0.3 * rng.random())
                drums.add(at(b, bt), hat(False, v), 0.26, pan=.25)
            drums.add(at(b, 3.5), hat(True, .7), 0.2, pan=.25)
            if lift:
                for bt in (0, 2): drums.add(at(b, bt), hat(True, .9), 0.2, pan=-.3)
        # the tune comes in with the Leaderboard
        if t0 >= SC['rank'] - 0.01 and not last:
            for (bt, nm, ln) in MEL[b % 4]:
                m = n(nm) + (12 if lift else 0)
                x = pluck(m, ln * BEAT, .9)
                mel.add(at(b, bt), x, 0.15, pan=.2)
                mel.add(at(b, bt) + .75 * BEAT, x, 0.05, pan=-.5)   # an echo
                mel.add(at(b, bt) + 1.5 * BEAT, x, 0.02, pan=.5)
    elif t0 >= t_answer - 0.01 and t0 < t_end - 0.01:
        # the answer: the drums step back, a heartbeat kick and the bass stay
        bs.add(at(b, 0), bass(n(root), 2.5 * BEAT), 0.26)
        for bt in ((0, 2) if abs(t0 - round(t0 / BAR) * BAR) < 1e-6 else (0, 2)): drums.add(at(b, bt), kick(), 0.3)
        for h in range(8): drums.add(at(b, h * .5), hat(False, .5 if h % 2 == 0 else .25), 0.16, pan=.25)

# the final chord rings out
for i, nm in enumerate(['F2', 'C3', 'Ab3', 'C4', 'Eb4', 'G4', 'C5']):
    ep.add(TOTAL - 2 * BEAT - 0.0 + i * 0.02, keys(n(nm), 2.6, .9), 0.1, pan=(-.4 + .13 * i))

# ---- effects, on the picture
def ev(kind): return [e for e in T['events'] if e['kind'] == kind]
for e in ev('recv'):
    fx.add(e['t'], bell(n('C6'), .5, .8), 0.12, pan=-.3); fx.add(e['t'] + .06, bell(n('F6'), .4, .6), 0.12, pan=-.3)
for e in ev('send'):
    fx.add(e['t'], glide(hz(n('F5')), hz(n('C6')), .14, .9), 0.13, pan=.3)
for e in ev('boom'):
    k = int(SR * 1.4); t = np.arange(k) / SR
    fx.add(e['t'], np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t / .08)) / SR) * np.exp(-t / .45), 0.5)
    fx.add(e['t'], bell(n('F5'), 1.2), 0.1); fx.add(e['t'], bell(n('C6'), 1.2), 0.07, pan=.3)
for e in ev('riser'):
    fx.add(e['t'], swell(e['len'], 500, 9000), 0.22); fx.add(e['t'], glide(hz(n('F4')), hz(n('F6')), e['len'], .6), 0.03)
for e in ev('shutter'):
    fx.add(e['t'], click(900, .02, 1) , 0.3); fx.add(e['t'] + .045, click(600, .03, .8), 0.25)
for e in ev('scan'):
    k = int(SR * e['len']); t = np.arange(k) / SR
    sh = sum(np.sin(2 * np.pi * hz(n(nm)) * (1 + t / e['len'] * .06) * t + i) for i, nm in enumerate(['F5', 'C6', 'G6'])) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * np.sin(np.pi * t / e['len'])
    fx.add(e['t'], sh, 0.022); fx.add(e['t'], swell(e['len'], 3000, 11000), 0.05)
for e in ev('ding'):
    fx.add(e['t'], bell(n('F6'), 1.1), 0.13); fx.add(e['t'] + .09, bell(n('C7'), 1.0), 0.1, pan=.3)
for e in ev('whoosh'):
    fx.add(e['t'] - .12, swell(.22, 700, 6000), 0.14); fx.add(e['t'] + .1, swell(.3, 500, 4000, rise=False), 0.07)
for e in ev('scene'):
    if e['id'] in ('chat', 'reveal', 'answer', 'end'): continue
    fx.add(e['t'] - .2, swell(.2, 1200, 9000), 0.1)
for e in ev('tap'): fx.add(e['t'], click(1300, .01, 1), 0.3)
for i, e in enumerate(ev('key')): fx.add(e['t'], click(1900 + 150 * (i % 3), .006, .8), 0.13, pan=(-.2 + .2 * (i % 3)))
for e in ev('slide'): fx.add(e['t'], glide(hz(n('F4')), hz(n('C6')), e['len'], .8), 0.045)
for e in ev('success'):
    for i, nm in enumerate(['F5', 'Ab5', 'C6', 'F6']): fx.add(e['t'] + i * .07, bell(n(nm), 1.2), 0.11, pan=(-.3 + .2 * i))
for e in ev('success2'):
    for i, nm in enumerate(['C6', 'F6']): fx.add(e['t'] + i * .08, bell(n(nm), .9), 0.1)
for e in ev('bell'): fx.add(e['t'], bell(n('C6'), .9), 0.07, pan=.2)
for e in ev('pop'):
    fx.add(e['t'], glide(hz(n('C5')), hz(n('C6')), .09), 0.16); fx.add(e['t'] + .08, bell(n('G6'), .7), 0.08)
for e in ev('react'): fx.add(e['t'], bell(n(['C6', 'Eb6', 'G6'][e['i']]), .6), 0.1, pan=(-.4 + .4 * e['i']))
for e in ev('swish'): fx.add(e['t'] - .1, swell(.14, 1500, 10000), 0.12)
for e in ev('impact'):
    k = int(SR * 1.6); t = np.arange(k) / SR
    fx.add(e['t'], np.sin(2 * np.pi * np.cumsum(36 + 60 * np.exp(-t / .07)) / SR) * np.exp(-t / .5), 0.5)
    fx.add(e['t'], swell(1.4, 2000, 12000, rise=False), 0.12)
    fx.add(e['t'] - .6, swell(.6, 400, 8000), 0.2)
    for i, nm in enumerate(['F5', 'C6', 'G6']): fx.add(e['t'] + i * .03, bell(n(nm), 1.6), 0.08, pan=(-.3 + .3 * i))

# ---- the room, the vinyl and the mix
def room(tr, wet, length=1.4, seed=1):
    r = np.random.default_rng(seed); k = int(SR * length); t = np.arange(k) / SR
    out = []
    for ch, s in ((tr.l, 0), (tr.r, 1)):
        ir = shape(r.standard_normal(k), lo=300, hi=6000) * np.exp(-t / (length / 5)); ir[: int(.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        m = len(ch) + k
        out.append(np.fft.irfft(np.fft.rfft(ch, m) * np.fft.rfft(ir, m), m)[: len(ch)] * wet)
    return out

tt = np.arange(N) / SR
# the chords start muffled (the group chat), open up at the reveal, and stay warm
opening = np.clip((tt - SC['reveal']) / (t_drop - SC['reveal']), 0, 1)
ep_l, ep_r = shape(ep.l, hi=5200), shape(ep.r, hi=5200)
ep_dl, ep_dr = shape(ep.l, hi=1100), shape(ep.r, hi=1100)
ep_l = (ep_dl * (1 - opening) * 1.0 + ep_l * opening) * duck
ep_r = (ep_dr * (1 - opening) * 1.0 + ep_r * opening) * duck
trem = 1 + 0.08 * np.sin(2 * np.pi * 4.5 * tt)
ep_l *= trem; ep_r *= (2 - trem)
bl, br = shape(bs.l, hi=1400) * duck, shape(bs.r, hi=1400) * duck
ml, mr = shape(mel.l, hi=5000), shape(mel.r, hi=5000)
crackle = shape(rng.standard_normal(N), lo=1500, hi=8000) * 0.004
pops = np.zeros(N); idx = rng.integers(0, N, int(TOTAL * 7)); pops[idx] = rng.uniform(-1, 1, len(idx)) * 0.05
vinyl = crackle + shape(pops, lo=800, hi=7000)
L = drums.l * .95 + bl + ep_l + ml + fx.l * 1.5 + vinyl
R = drums.r * .95 + br + ep_r + mr + fx.r * 1.5 + np.roll(vinyl, 311)
wet = Track(); wet.l = ep_l * .8 + ml + fx.l + drums.l * .12; wet.r = ep_r * .8 + mr + fx.r + drums.r * .12
wl, wr = room(wet, 0.22)
L += wl; R += wr
# fades: in over the first moment, out with the last chord
fade = np.clip(tt / 0.25, 0, 1) * np.clip((TOTAL - tt) / 1.6, 0, 1) ** 1.2
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = np.tanh(L / peak * 1.6) / np.tanh(1.6), np.tanh(R / peak * 1.6) / np.tanh(1.6)
out = (np.stack([L, R], 1)[: int(SR * TOTAL)] * 0.89 * 32767).astype(np.int16)
with wave.open('sound-short.wav' if SHORT else 'sound.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print('stems rms dB: drums %.1f bass %.1f keys %.1f tune %.1f fx %.1f' % (db(drums.l), db(bl), db(ep_l), db(ml), db(fx.l)))
print('written sound.wav', len(out) / SR, 's')
