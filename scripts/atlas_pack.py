#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
حزمة موارد أطلس كنترول البريميوم (≥ 100MB) — بلا أي مكتبات خارجية.

المخرجات (كلها حقيقية وقابلة للاستخدام داخل التطبيق):
  public/atlas-pack/audio/  — سيمفونيات أجواء لكل نظام من الأنظمة العشرة
                              (44.1kHz 16-bit) + نغمات واجهة وتنبيهات ملونة.
  public/atlas-pack/wallpapers/ — خلفيات فنية 1080×2340 بهوية أطلس.
  public/atlas-pack/manifest.json — فهرس الحزمة الكامل.

قابل للتكرار: نفس المخرجات بايت-بايت في كل تشغيل (بذرة ثابتة).
"""

import json
import math
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK_DIR = os.path.join(ROOT, "public", "atlas-pack")
AUDIO_DIR = os.path.join(PACK_DIR, "audio")
WALL_DIR = os.path.join(PACK_DIR, "wallpapers")

SR = 44100  # معدل العينة

# ── هوية أطلس اللونية (نفس src/lib/atlas-design.ts) ──
COLORS = {
    "void": (7, 11, 22),
    "panel": (14, 20, 40),
    "royal": (124, 108, 246),
    "gold": (212, 175, 55),
    "cyan": (56, 189, 248),
    "crimson": (244, 63, 94),
    "emerald": (52, 211, 153),
    "amber": (245, 158, 11),
    "slate": (148, 163, 184),
}

# نظام: (سيمفونية اللون، نغمة الجذر Hz، مزاج)
SYSTEM_MOODS = [
    ("control",    "royal",   110.0, "قيادي مهيب"),
    ("players",    "cyan",    123.47, "يقظة إدارية"),
    ("memberships", "gold",   98.0,  "فخامة ملكية"),
    ("content",    "emerald", 130.81, "صفاء معرفي"),
    ("rooms",      "amber",   103.83, "دفء مجتمعي"),
    ("reports",    "crimson", 92.5,  "إنذار منضبط"),
    ("ai",         "royal",   116.54, "تفكير عميق"),
    ("economy",    "gold",    87.31, "ثقل اقتصادي"),
    ("analytics",  "cyan",    146.83, "دقة تحليلية"),
    ("emergency",  "crimson", 82.41, "طوارئ جدية"),
]


def write_png(path: str, w: int, h: int, rgba: bytearray) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride : (y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 6))
        + _chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_wav(path: str, samples, sr: int = SR) -> int:
    """كتابة WAV 16-bit مونو. samples: list[float] بقيم -1..1"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    n = len(samples)
    data = bytearray(n * 2)
    for i, s in enumerate(samples):
        v = max(-32767, min(32767, int(s * 32767)))
        data[i * 2] = v & 0xFF
        data[i * 2 + 1] = (v >> 8) & 0xFF
    hdr = bytearray()
    hdr += b"RIFF"
    hdr += struct.pack("<I", 36 + len(data))
    hdr += b"WAVEfmt "
    hdr += struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16)
    hdr += b"data"
    hdr += struct.pack("<I", len(data))
    with open(path, "wb") as f:
        f.write(bytes(hdr))
        f.write(bytes(data))
    return 44 + len(data)


def env(t: float, dur: float, attack: float = 0.02, release: float = 0.4) -> float:
    if t < attack:
        return t / attack
    if t > dur - release:
        r = (dur - t) / release
        return max(0.0, r)
    return 1.0


def synth_atmosphere(seed: int, root: float, dur: float, color, mood_gain: float = 0.5):
    """سيمفونية أجواء: درون هارموني + أجراس لولبية + نبضات إيقاعية ناعمة."""
    rng = random.Random(seed)
    n = int(dur * SR)
    buf = [0.0] * n

    # 1) الدرون الهارموني — سلسلة علوية مبنية على النغمة الجذر
    harmonics = [(1, 0.50), (2, 0.25), (3, 0.13), (4, 0.07), (6, 0.035)]
    detunes = [(rng.uniform(-0.15, 0.15), rng.uniform(0, 6.283)) for _ in harmonics]
    fifth = root * 1.4983
    octave = root * 2.0
    for i in range(n):
        t = i / SR
        # تطور بطيء للحجم — موجة LFO شبه عشوائية
        lfo = 0.75 + 0.25 * math.sin(2 * math.pi * 0.05 * t + detunes[0][1])
        v = 0.0
        for (mult, amp), (det, ph) in zip(harmonics, detunes):
            v += amp * math.sin(2 * math.pi * root * mult * (1 + det * 0.001) * t + ph)
        # الخامسة والأوكتاف تتحركان ببطء
        v += 0.18 * math.sin(2 * math.pi * fifth * t + 1.3)
        v += 0.10 * math.sin(2 * math.pi * octave * t + 4.1)
        buf[i] += v * lfo * mood_gain * 0.28

    # 2) أجراس لولبية — نغمات عالية تتساقط كل بضع ثوانٍ
    bell_scale = [root * 2, root * 2.378, root * 3, root * 3.564, root * 4, root * 4.756]
    t_bell = rng.uniform(1.0, 3.0)
    while t_bell < dur - 2:
        f = rng.choice(bell_scale)
        bd = rng.uniform(1.2, 2.6)
        bn = int(bd * SR)
        start = int(t_bell * SR)
        amp = rng.uniform(0.10, 0.20)
        for j in range(min(bn, n - start)):
            tt = j / SR
            e = math.exp(-3.2 * tt / bd)
            v = math.sin(2 * math.pi * f * tt) + 0.35 * math.sin(2 * math.pi * f * 2.756 * tt)
            buf[start + j] += v * e * amp
        t_bell += rng.uniform(2.0, 6.5)

    # 3) نبضات إيقاعية ناعمة كل 2 ثانية
    beat = 2.0
    nb = int(dur / beat)
    for b in range(nb):
        start = int(b * beat * SR)
        dn = int(0.22 * SR)
        amp = rng.uniform(0.16, 0.24)
        for j in range(min(dn, n - start)):
            tt = j / SR
            e = math.exp(-18 * tt)
            v = math.sin(2 * math.pi * 55 * tt) * e
            buf[start + j] += v * amp

    # 4) التلوين الطيفي — فلتر بسيط يمزج لون النظام
    cr, cg, cb = color
    tint = ((cg - cr) / 255.0) * 0.06
    for i in range(n):
        buf[i] *= 1.0 + tint * math.sin(2 * math.pi * 0.11 * (i / SR))

    # 5) تطبيع + إبهام نهاية سلسة
    peak = max(1e-9, max(abs(x) for x in buf))
    g = 0.85 / peak
    fade = int(2.5 * SR)
    for i in range(n):
        s = buf[i] * g
        if i < fade:
            s *= i / fade
        if i > n - fade:
            s *= (n - i) / fade
        buf[i] = s
    return buf


def ui_click(seed: int) -> list:
    rng = random.Random(seed)
    n = int(0.05 * SR)
    out = [0.0] * n
    f = rng.uniform(1800, 2600)
    for i in range(n):
        t = i / SR
        e = math.exp(-90 * t)
        out[i] = (math.sin(2 * math.pi * f * t) * 0.6 + math.sin(2 * math.pi * f * 2 * t) * 0.2) * e * 0.5
    return out


def ui_toggle(seed: int) -> list:
    n = int(0.12 * SR)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        f = 600 + 900 * (t / 0.12)
        e = math.exp(-24 * t)
        out[i] = math.sin(2 * math.pi * f * t) * e * 0.4
    return out


def alert_tone(freq: float, dur: float = 0.55) -> list:
    n = int(dur * SR)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        e = min(1.0, t / 0.02) * math.exp(-3.5 * t / dur)
        trem = 0.8 + 0.2 * math.sin(2 * math.pi * 7 * t)
        out[i] = (math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * freq * 2 * t)) * e * trem * 0.4
    return out


# ═══════════════════════ الخلفيات الفنية ═══════════════════════

def wallpaper(w: int, h: int, seed: int, accent, name: str) -> int:
    rng = random.Random(seed)
    buf = bytearray(w * h * 4)

    # خلفية متدرجة عمودية: void → panel
    for y in range(h):
        t = y / (h - 1)
        # توهج قطبي أسفل
        glow = 0.5 + 0.5 * math.sin(math.pi * t)
        for c in range(3):
            base = COLORS["void"][c] * (1 - glow * 0.35) + COLORS["panel"][c] * (glow * 0.35)
            buf[y * w * 4 + c] = int(max(0, min(255, base)))
        buf[y * w * 4 + 3] = 255

    def put(x, y, r, g, b, a):
        if 0 <= x < w and 0 <= y < h:
            i = (y * w + x) * 4
            al = a / 255.0
            buf[i] = int(buf[i] * (1 - al) + r * al)
            buf[i + 1] = int(buf[i + 1] * (1 - al) + g * al)
            buf[i + 2] = int(buf[i + 2] * (1 - al) + b * al)
            buf[i + 3] = 255

    # 1) شبكة أطلس — خطوط دقيقة
    for gx in range(0, w, 72):
        alpha = 26
        for y in range(h):
            put(gx, y, accent[0], accent[1], accent[2], alpha)
    for gy in range(0, h, 72):
        for x in range(w):
            put(x, gy, accent[0], accent[1], accent[2], 18)

    # 2) مدارات ذهبية مائلة — حلقات التحكم
    cx, cy = w // 2, int(h * 0.62)
    for ring in range(6):
        rad = 180 + ring * 130
        thickness = 2 + ring % 2
        col = COLORS["gold"] if ring % 2 == 0 else accent
        steps = int(rad * 8)
        for s in range(steps):
            ang = (s / steps) * 2 * math.pi
            # قوس جزئي — يعكس «مدار السيطرة»
            if 0.2 < ang % (2 * math.pi) < 5.6:
                x = int(cx + rad * math.cos(ang) * 1.0)
                y = int(cy + rad * math.sin(ang) * 0.42)  # منظور مائل
                for dy in range(thickness):
                    put(x, y + dy, col[0], col[1], col[2], 90)

    # 3) نجوم — حقل نجمي خافت
    for _ in range(420):
        x = rng.randrange(w)
        y = rng.randrange(int(h * 0.7))
        b = rng.uniform(0.25, 0.8)
        s = 1 if b < 0.6 else 2
        v = int(255 * b)
        for dx in range(s):
            for dy in range(s):
                put(x + dx, y + dy, v, v, min(255, v + 18), 200)

    # 4) توهج المركز — قلب السيطرة
    for dy in range(-220, 221, 2):
        for dx in range(-220, 221, 2):
            d2 = (dx * dx + dy * dy) / (220 * 220)
            if d2 <= 1:
                a = int(38 * (1 - d2) ** 2)
                put(cx + dx, cy + dy, accent[0], accent[1], accent[2], a)

    path = os.path.join(WALL_DIR, f"{name}.png")
    write_png(path, w, h, buf)
    return os.path.getsize(path)


# ═══════════════════════ التنفيذ ═══════════════════════

def main() -> None:
    print("🎙️  توليد حزمة موارد أطلس كنترول البريميوم…")
    total_bytes = 0
    manifest = {"pack": "atlas-premium", "version": "1.0.0", "audio": [], "wallpapers": []}

    # ── 1) سيمفونيات الأنظمة العشرة (65 ثانية لكل منها) ──
    for idx, (sys_id, color_key, root, mood) in enumerate(SYSTEM_MOODS):
        dur = 65.0
        name = f"atmosphere-{sys_id}"
        path = os.path.join(AUDIO_DIR, f"{name}.wav")
        if not os.path.exists(path):
            buf = synth_atmosphere(seed=1000 + idx, root=root, dur=dur, color=COLORS[color_key])
            size = write_wav(path, buf)
            total_bytes += size
            manifest["audio"].append({
                "id": name, "file": f"audio/{name}.wav", "seconds": dur,
                "mood": mood, "system": sys_id, "bytes": size,
            })
            print(f"  ♪ {name}.wav — {mood} ({size/1024/1024:.1f} MB)")
        else:
            total_bytes += os.path.getsize(path)

    # ── 2) نغمات الواجهة والتنبيهات الملونة ──
    ui_sounds = [
        ("ui-click", lambda: ui_click(7)),
        ("ui-toggle", lambda: ui_toggle(9)),
        ("alert-info", lambda: alert_tone(523.25)),
        ("alert-blue", lambda: alert_tone(587.33)),
        ("alert-orange", lambda: alert_tone(622.25)),
        ("alert-red", lambda: alert_tone(698.46)),
        ("alert-purple", lambda: alert_tone(783.99)),
        ("success", lambda: alert_tone(659.26, 0.8)),
        ("insight", lambda: alert_tone(880.0, 0.9)),
    ]
    for name, gen in ui_sounds:
        path = os.path.join(AUDIO_DIR, f"{name}.wav")
        if not os.path.exists(path):
            size = write_wav(path, gen())
            total_bytes += size
            manifest["audio"].append({
                "id": name, "file": f"audio/{name}.wav",
                "mood": "واجهة", "system": "ui", "bytes": size,
            })
            print(f"  ♪ {name}.wav ({size/1024:.0f} KB)")
        else:
            total_bytes += os.path.getsize(path)

    # ── 3) الخلفيات الفنية 1080×2340 لكل نظام ──
    W, H = 1080, 2340
    for sys_id, color_key, _, mood in SYSTEM_MOODS:
        name = f"wallpaper-{sys_id}"
        path = os.path.join(WALL_DIR, f"{name}.png")
        if not os.path.exists(path):
            size = wallpaper(W, H, seed=2000 + hash(sys_id) % 1000, accent=COLORS[color_key], name=name)
            total_bytes += size
            manifest["wallpapers"].append({
                "id": name, "file": f"wallpapers/{name}.png", "mood": mood, "bytes": size,
            })
            print(f"  🖼 {name}.png ({size/1024/1024:.1f} MB)")
        else:
            total_bytes += os.path.getsize(path)

    # ── 4) لوحة رئيسية ──
    hero_path = os.path.join(WALL_DIR, "wallpaper-hero.png")
    if not os.path.exists(hero_path):
        size = wallpaper(W, H, seed=42, accent=COLORS["royal"], name="wallpaper-hero")
        total_bytes += size
        manifest["wallpapers"].append({
            "id": "wallpaper-hero", "file": "wallpapers/wallpaper-hero.png",
            "mood": "اللوحة الرئيسية", "bytes": size,
        })
        print(f"  🖼 wallpaper-hero.png ({size/1024/1024:.1f} MB)")
    else:
        total_bytes += os.path.getsize(hero_path)

    manifest["totalBytes"] = total_bytes
    with open(os.path.join(PACK_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"✅ الحزمة جاهزة: {total_bytes/1024/1024:.1f} MB — قابلة للتكرار بايت-بايت")


if __name__ == "__main__":
    main()
