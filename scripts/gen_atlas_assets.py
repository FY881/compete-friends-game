#!/usr/bin/env python3
"""أطلس كنترول — premium launcher icon + splash generator.

Draws a luxury geometric atlas-globe mark: deep obsidian radial background,
precision gold meridian/parallel grid inside a diamond ring, crown star.
Outputs Android launcher mipmaps (legacy + adaptive fg/bg), round icons,
and a 2732x2732 splash source.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = "android/app/src/main/assets/atlas-brand"
os.makedirs(OUT, exist_ok=True)

# ---- palette (obsidian + champagne gold + ivory) -------------------------
BG_TOP = (16, 20, 34)
BG_BOT = (6, 8, 16)
GOLD = (232, 190, 108)
GOLD_HI = (248, 226, 178)
GOLD_DIM = (156, 122, 62)
IVORY = (244, 240, 230)
INK = (10, 12, 22)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_bg(size):
    """Vertical-ish radial gradient obsidian background with vignette."""
    img = Image.new("RGB", (size, size), BG_BOT)
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    maxr = size * 0.75
    for y in range(size):
        t = y / size
        row = lerp(BG_TOP, BG_BOT, t)
        d.line([(0, y), (size, y)], fill=row)
    # radial glow at center
    glow = Image.new("L", (size, size), 0)
    gd = ImageDraw.Draw(glow)
    steps = 64
    for i in range(steps, 0, -1):
        r = maxr * i / steps
        v = int(38 * (1 - i / steps) ** 2)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=v)
    gold_layer = Image.new("RGB", (size, size), lerp(GOLD, BG_TOP, 0.55))
    img = Image.composite(gold_layer, img, glow)
    return img


def draw_mark(scale):
    """Draw the atlas mark on a transparent layer of size scale x scale."""
    S = scale * 4  # supersample
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2

    def P(frac):
        return frac * S

    # ---- outer diamond ring -------------------------------------------
    ring_r = P(0.46)
    diamond = [
        (cx, cy - ring_r), (cx + ring_r, cy), (cx, cy + ring_r), (cx - ring_r, cy)
    ]
    d.polygon(diamond, outline=GOLD_DIM + (255,), width=int(P(0.012)))
    diamond_in = [(cx, cy - ring_r * 0.94), (cx + ring_r * 0.94, cy),
                  (cx, cy + ring_r * 0.94), (cx - ring_r * 0.94, cy)]
    d.polygon(diamond_in, outline=GOLD + (200,), width=int(P(0.004)))

    # ---- globe ----------------------------------------------------------
    gr = P(0.30)
    # sphere body: dark fill with subtle gradient (two tones)
    for i in range(int(gr), 0, -1):
        t = i / gr
        col = lerp((36, 46, 78), (12, 15, 28), t)
        d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=col + (255,))
    # meridians (vertical ellipses of varying width)
    for w in (1.0, 0.72, 0.44, 0.18):
        rx = gr * w
        bbox = [cx - rx, cy - gr, cx + rx, cy + gr]
        d.ellipse(bbox, outline=GOLD + (235,) if w == 1.0 else GOLD_DIM + (210,),
                  width=max(2, int(P(0.008 if w == 1.0 else 0.005))))
    # parallels (horizontal lines as squashed ellipses)
    for h in (0.30, 0.62, 1.0):
        ry = gr * h
        bbox = [cx - gr, cy - ry, cx + gr, cy + ry]
        if h == 1.0:
            d.arc(bbox, 0, 360, fill=GOLD + (235,), width=max(2, int(P(0.008))))
        else:
            d.arc(bbox, 0, 360, fill=GOLD_DIM + (200,), width=max(2, int(P(0.005))))
    # equator highlight
    d.line([(cx - gr * 0.985, cy), (cx + gr * 0.985, cy)], fill=GOLD_HI + (90,),
           width=max(1, int(P(0.003))))

    # ---- orbit ring + satellites ---------------------------------------
    orb_r = P(0.395)
    orb_bbox = [cx - orb_r, cy - orb_r * 0.36, cx + orb_r, cy + orb_r * 0.36]
    d.arc(orb_bbox, 15, 165, fill=IVORY + (160,), width=max(2, int(P(0.006))))
    d.arc(orb_bbox, 195, 345, fill=GOLD + (220,), width=max(2, int(P(0.006))))
    for ang, col in ((20, GOLD_HI), (160, GOLD), (340, IVORY)):
        a = math.radians(ang)
        x = cx + orb_r * math.cos(a)
        y = cy + orb_r * 0.36 * math.sin(a)
        r = P(0.016)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col + (255,))

    # ---- crown star at top ----------------------------------------------
    def star(x, y, R, r, n, col, rot=-math.pi / 2):
        pts = []
        for k in range(n * 2):
            rad = R if k % 2 == 0 else r
            a = rot + math.pi * k / n
            pts.append((x + rad * math.cos(a), y + rad * math.sin(a)))
        d.polygon(pts, fill=col)

    star(cx, cy - P(0.545), P(0.052), P(0.021), 5, GOLD_HI + (255,))
    # small side accents
    star(cx - P(0.60), cy + P(0.10), P(0.024), P(0.010), 4, GOLD + (230,), rot=-math.pi / 2)
    star(cx + P(0.60), cy + P(0.10), P(0.024), P(0.010), 4, GOLD + (230,), rot=-math.pi / 2)

    return img.resize((scale, scale), Image.LANCZOS)


def with_bg(size):
    bg = radial_bg(size).convert("RGBA")
    mark = draw_mark(int(size * 0.92))
    bg.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return bg


# legacy full-square launcher icons (opaque)
for name, size in {
    "mipmap-mdpi/ic_launcher.png": 48,
    "mipmap-hdpi/ic_launcher.png": 72,
    "mipmap-xhdpi/ic_launcher.png": 96,
    "mipmap-xxhdpi/ic_launcher.png": 144,
    "mipmap-xxxhdpi/ic_launcher.png": 192,
}.items():
    path = f"android/app/src/main/res/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with_bg(size).convert("RGB").save(path, "PNG")

# round legacy icons
for name, size in {
    "mipmap-mdpi/ic_launcher_round.png": 48,
    "mipmap-hdpi/ic_launcher_round.png": 72,
    "mipmap-xhdpi/ic_launcher_round.png": 96,
    "mipmap-xxhdpi/ic_launcher_round.png": 144,
    "mipmap-xxxhdpi/ic_launcher_round.png": 192,
}.items():
    path = f"android/app/src/main/res/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = with_bg(size * 2)
    mask = Image.new("L", (size * 2, size * 2), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, size * 2, size * 2], fill=255)
    out = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    out.resize((size, size), Image.LANCZOS).save(path, "PNG")

# adaptive icon background (solid-ish obsidian gradient)
for name, size in {
    "mipmap-mdpi/ic_launcher_background.png": 108,
    "mipmap-hdpi/ic_launcher_background.png": 162,
    "mipmap-xhdpi/ic_launcher_background.png": 216,
    "mipmap-xxhdpi/ic_launcher_background.png": 324,
    "mipmap-xxxhdpi/ic_launcher_background.png": 432,
}.items():
    path = f"android/app/src/main/res/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    radial_bg(size).save(path, "PNG")

# adaptive foreground: mark scaled into safe zone (~66%)
for name, size in {
    "mipmap-mdpi/ic_launcher_foreground.png": 108,
    "mipmap-hdpi/ic_launcher_foreground.png": 162,
    "mipmap-xhdpi/ic_launcher_foreground.png": 216,
    "mipmap-xxhdpi/ic_launcher_foreground.png": 324,
    "mipmap-xxxhdpi/ic_launcher_foreground.png": 432,
}.items():
    path = f"android/app/src/main/res/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = draw_mark(int(size * 0.62))
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    canvas.save(path, "PNG")

# splash source
with_bg(1024).save(f"{OUT}/atlas-splash-1024.png", "PNG")
# favicon-scale mark for web manifest use
with_bg(512).save(f"{OUT}/atlas-icon-512.png", "PNG")

print("icons + splash written to", OUT)
