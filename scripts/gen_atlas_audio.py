#!/usr/bin/env python3
"""حزمة أطلس الصوتية — مولّد حزمة صوتية حقيقية ≥100 ميجابايت.

Every file is REAL 44.1kHz 16-bit stereo PCM WAV audio (no filler bytes):
- 20 long ambient tracks (~4 min each, layered drones/arpeggios/noise beds)
- 10 short system stingers (~3 s)
- 3 UI sounds
- 1 pre-mixed ambient loop (~2 min)
≈ 105-115 MB total, deterministic, reproducible (pure stdlib).
"""
import math
import os
import struct
import wave

SR = 44100
OUT = "android/app/src/main/assets/atlas-audio"
os.makedirs(OUT, exist_ok=True)

ROOT = 110.0  # A2 — atlas base tone
TRACK_SECONDS = 240  # 4 min ambient tracks
LOOP_SECONDS = 120   # 2 min premixed loop


def write_wav(name, samples_l, samples_r, gain=0.9):
    """Write 16-bit stereo WAV. samples_* are lists of floats -1..1."""
    peak = max(1e-9, max(abs(s) for s in samples_l + samples_r))
    g = min(1.0, gain / peak)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for lo, ro in zip(samples_l, samples_r):
            frames += struct.pack("<hh", int(lo * g * 32767), int(ro * g * 32767))
        w.writeframes(bytes(frames))
    return os.path.getsize(path)


def env_ad(t, dur, a=0.01, r=0.6):
    """Attack/decay envelope, t in seconds."""
    if t < a:
        return t / a
    rel = dur - t
    if rel < r:
        return max(0.0, rel / r)
    return 1.0


def sine(f, t):
    return math.sin(2 * math.pi * f * t)


def tri(f, t):
    return 2 / math.pi * math.asin(math.sin(2 * math.pi * f * t))


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1.0


def render_ambient(seed, seconds=TRACK_SECONDS):
    """Layered premium ambient: drone + slow arpeggio + air noise + shimmer."""
    import random
    rng = random.Random(seed)
    n = int(SR * seconds)
    drone_f = ROOT * (2 ** (rng.randint(-5, 7) / 12))
    fifth = drone_f * 1.5
    octave = drone_f * 2.0
    arp_notes = [drone_f * 2 ** (x / 12) for x in (0, 3, 7, 10, 12, 15)]
    arp_period = rng.uniform(6.0, 9.0)
    noise_amp = rng.uniform(0.008, 0.02)
    lp_state = 0.0
    lp_alpha = 0.02
    l, r = [], []
    for i in range(n):
        t = i / SR
        # slow global swell
        swell = 0.55 + 0.45 * math.sin(2 * math.pi * t / rng.uniform(40, 70))
        # drones (detuned pair for width)
        d1 = 0.30 * sine(drone_f, t) + 0.22 * tri(fifth, t) + 0.16 * sine(octave, t)
        d2 = 0.30 * sine(drone_f * 1.003, t) + 0.20 * tri(fifth * 0.997, t)
        # arpeggio ping
        step = int(t / arp_period)
        note_f = arp_notes[step % len(arp_notes)]
        tl = t - step * arp_period
        pl = env_ad(tl, 2.2, a=0.005, r=1.8) * 0.14 * sine(note_f * 2, tl)
        pr = env_ad(tl, 2.2, a=0.005, r=1.8) * 0.14 * sine(note_f * 2.01, tl)
        # filtered air noise
        ns = (rng.random() * 2 - 1)
        lp_state += lp_alpha * (ns - lp_state)
        # shimmer (very slow high tone)
        sh = 0.05 * sine(drone_f * 8.02, t) * (0.5 + 0.5 * math.sin(2 * math.pi * t / 23.0))
        mono = d1 * swell + d2 * swell + pl + pr + lp_state * noise_amp + sh
        l.append(mono)
        r.append(mono * 0.96 + 0.04 * (d2 * swell))
    return l, r


def render_stinger(freq_ratio, seconds=3.0):
    """Premium stinger: rising fifth + gold chime + sub hit."""
    n = int(SR * seconds)
    base = ROOT * 2 * freq_ratio
    l, r = [], []
    for i in range(n):
        t = i / SR
        e = env_ad(t, seconds, a=0.004, r=1.4)
        rise_f = base * (1.0 + 0.5 * min(1.0, t / seconds))
        v = 0.5 * sine(rise_f, t)
        v += 0.25 * sine(rise_f * 1.5, t) * env_ad(t, seconds * 0.6, 0.002, 0.8)
        v += 0.2 * tri(base * 4, t) * env_ad(max(0.0, t - 0.12), seconds, 0.002, 1.0)
        v += 0.3 * sine(base / 2, t) * env_ad(t, 0.5, 0.001, 0.45)
        echo = 0.12 * sine(rise_f, max(0.0, t - 0.18)) * env_ad(max(0.0, t - 0.18), seconds, 0.001, 1.0)
        v += echo
        l.append(v * e)
        r.append(v * e * 0.97)
    return l, r


def render_ui(kind):
    n = int(SR * (0.16 if kind == "tap" else 0.5))
    l, r = [], []
    base = {"tap": 880.0, "ok": 660.0, "fail": 220.0}[kind]
    for i in range(n):
        t = i / SR
        if kind == "tap":
            v = 0.5 * sine(base, t) * env_ad(t, 0.16, 0.001, 0.15)
        elif kind == "ok":
            v = 0.4 * sine(base, t) * env_ad(t, 0.25, 0.001, 0.2)
            v += 0.4 * sine(base * 1.25, max(0.0, t - 0.09)) * env_ad(max(0.0, t - 0.09), 0.25, 0.001, 0.2)
        else:
            v = 0.45 * saw(base, t) * env_ad(t, 0.5, 0.002, 0.45)
        l.append(v)
        r.append(v)
    return l, r


total = 0

# 20 long ambient tracks (~96 MB)
for i in range(20):
    name = f"ambient-{i + 1:02d}.wav"
    sz = write_wav(name, *render_ambient(1000 + i * 37), gain=0.82)
    total += sz
    print(f"{name}: {sz / 1e6:.1f} MB")

# 10 system stingers (~2.6 MB) — distinct tone per system
for i, ratio in enumerate((1.0, 1.05, 1.12, 1.19, 1.26, 1.33, 1.41, 1.5, 1.59, 1.68)):
    name = f"system-{i + 1:02d}-" + [
        "control", "players", "memberships", "content", "rooms",
        "reports", "ai", "economy", "analytics", "emergency"][i] + ".wav"
    sz = write_wav(name, *render_stinger(ratio), gain=0.9)
    total += sz
    print(f"{name}: {sz / 1e6:.1f} MB")

# UI sounds
for name, data in (
    ("ui-tap.wav", render_ui("tap")),
    ("ui-success.wav", render_ui("ok")),
    ("ui-fail.wav", render_ui("fail")),
):
    sz = write_wav(name, *data, gain=0.85)
    total += sz
    print(f"{name}: {sz / 1e3:.0f} KB")

# premixed ambient loop (~21 MB)
l1, r1 = render_ambient(7, LOOP_SECONDS)
l2, r2 = render_ambient(999, LOOP_SECONDS)
mix_l = [0.6 * a + 0.4 * b for a, b in zip(l1, l2)]
mix_r = [0.6 * a + 0.4 * b for a, b in zip(r1, r2)]
sz = write_wav("ambient-mix.wav", mix_l, mix_r, gain=0.8)
total += sz
print(f"ambient-mix.wav: {sz / 1e6:.1f} MB")

print(f"TOTAL: {total / 1e6:.1f} MB across {os.listdir(OUT).__len__()} files")
