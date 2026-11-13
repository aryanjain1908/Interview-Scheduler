# Warm, light corporate bed: pad chords, plucked arpeggio, soft bass, gentle kick and shaker.
import numpy as np, wave, os, sys
SR = 44100
LEN = float(sys.argv[1]) if len(sys.argv) > 1 else 60.0
BPM = 112.0
beat = 60.0 / BPM
bar = beat * 4
N = int(SR * LEN)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# Cmaj9, Am9, Fmaj9, Gsus/G  (midi)
CH = [[45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [48, 55, 59, 62, 64], [43, 50, 55, 57, 59]]
BASS = [33, 29, 36, 31]

def add(buf, start, sig):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    buf[i:j] += sig[: j - i]

def pad(freq, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for k, a in [(1, 1), (2, 0.35), (3, 0.12), (4, 0.06)]:
        s += a * np.sin(2 * np.pi * freq * k * t + rng.uniform(0, 6))
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.9)
    return s * env * amp * (1 + 0.08 * np.sin(2 * np.pi * 0.25 * t))

def pluck(freq, amp, dur=0.9):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t) + 0.08 * np.sin(2 * np.pi * 3 * freq * t)
    return s * np.exp(-t * 5.5) * np.minimum(1, t / 0.004) * amp

def kick(amp):
    t = np.arange(int(0.35 * SR)) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * amp

def shaker(amp):
    n = rng.normal(0, 1, int(0.09 * SR))
    n = np.diff(np.concatenate([[0], n]))  # crude high-pass
    t = np.arange(len(n)) / SR
    return n * np.exp(-t * 45) * amp

def bassnote(freq, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    return s * np.minimum(1, t / 0.02) * np.exp(-t * 1.2) * amp

nbars = int(LEN / bar) + 1
ARP = [0, 2, 3, 4, 3, 2, 1, 2]
for b in range(nbars):
    t0 = b * bar
    ch = CH[b % 4]
    for m in ch:
        p = pad(hz(m), bar + 0.6, 0.055)
        add(L, t0, p * 0.9); add(R, t0 + 0.012, p)
    if t0 >= 2.0:
        for e in range(8):
            m = ch[ARP[e]] + 12
            amp = 0.075 if e % 2 == 0 else 0.05
            pl = pluck(hz(m), amp)
            pan = 0.35 if e % 2 else -0.35
            add(L, t0 + e * beat / 2, pl * (1 - pan)); add(R, t0 + e * beat / 2 + 0.008, pl * (1 + pan))
    if t0 >= 6.0:
        bn = bassnote(hz(BASS[b % 4]), bar, 0.16)
        add(L, t0, bn); add(R, t0, bn)
    if 6.0 <= t0 < LEN - 5:
        for q in range(4):
            if q in (0, 2):
                k = kick(0.22); add(L, t0 + q * beat, k); add(R, t0 + q * beat, k)
            sh = shaker(0.035)
            add(L, t0 + q * beat + beat / 2, sh * 0.8); add(R, t0 + q * beat + beat / 2 + 0.01, sh)

# simple stereo room: a couple of quiet early reflections
for buf in (L, R):
    for d, g in [(0.083, 0.22), (0.161, 0.13), (0.27, 0.07)]:
        k = int(d * SR); buf[k:] += buf[:-k] * g

t = np.arange(N) / SR
fade = np.minimum(1, t / 1.5) * np.clip((LEN - t) / 4.0, 0, 1)
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L /= peak / 0.6; R /= peak / 0.6
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music.wav")
with wave.open(p, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print("ok", p)
