#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مولّد هوية «أطلس كنترول» البصرية — لوجو بريميوم فاخر بدون أي مكتبات خارجية.

اللوجو: كرة أطلس (محور العالم) داخل حلقة ذهبية مائلة تعكس مدار السيطرة،
فوق خلفية كحلية عميقة متدرجة مع توهج قطبي — قوة، دقة، احتراف.

المخرجات:
  - public/icons/atlas-icon-{192,512}.png + apple-touch + maskable (PWA/ويب)
  - أيقونات أندرويد التكيفية: launcher + round + foreground + background بكل الكثافات
  - شاشات البداية splash.png بمقاسات land/port لكل الكثافات
  - XML الأيقونة التكيفية (mipmap-anydpi-v26)

قابل للتكرار: نفس المخرجات بايت-بايت في كل تشغيل (بذرة عشوائية ثابتة).
"""

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─────────────────────────────────────────────────────────────────────────
# PNG writer (بدون مكتبات)
# ─────────────────────────────────────────────────────────────────────────

def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, w: int, h: int, rgba: bytearray) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: none
        raw += rgba[y * stride : (y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print(f"  ✓ {os.path.relpath(path, ROOT)} ({len(png):,} bytes)")


def rgba_buf(w: int, h: int) -> bytearray:
    return bytearray(w * h * 4)


def put_px(buf, w, x, y, r, g, b, a=255):
    i = (y * w + x) * 4
    buf[i] = max(0, min(255, int(r)))
    buf[i + 1] = max(0, min(255, int(g)))
    buf[i + 2] = max(0, min(255, int(b)))
    buf[i + 3] = max(0, min(255, int(a)))


def smooth(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


# ─────────────────────────────────────────────────────────────────────────
# رسم اللوجو الرئيسي (512×512)
# ─────────────────────────────────────────────────────────────────────────

S = 512
CX, CY = S / 2, S / 2
RING_R = 196          # نصف قطر الحلقة الذهبية
RING_W = 17           # سماكة الحلقة
GLOBE_R = 148         # نصف قطر الكرة
LIGHT = (CX - 52, CY - 58)  # مصدر الإضاءة


def master_canvas() -> bytearray:
    buf = rgba_buf(S, S)
    for y in range(S):
        for x in range(S):
            # خلفية كحلية عميقة متدرجة قطرياً
            t = (x / S * 0.55 + y / S * 0.45)
            r = 7 + 9 * (1 - t)
            g = 11 + 13 * (1 - t)
            b = 22 + 26 * (1 - t)
            # توهج علوي ناعم
            gl = max(0.0, 1.0 - ((x - CX) ** 2 + (y - 70) ** 2) ** 0.5 / 330)
            r += 16 * gl * gl
            g += 20 * gl * gl
            b += 34 * gl * gl
            a = 255
            # زوايا مستديرة (نصف قطر 88) للأيقونة التقليدية
            corners = [
                (88, 88), (S - 88, 88), (88, S - 88), (S - 88, S - 88)
            ]
            for cxr, cyr in corners:
                dx = x - cxr
                dy = y - cyr
                inside_corner = (
                    (x < 88 or x > S - 88) and (y < 88 or y > S - 88)
                )
                if inside_corner:
                    d = (dx * dx + dy * dy) ** 0.5
                    if d > 88:
                        a = 0
                        break
                    elif d > 82:
                        a = min(a, int(255 * (88 - d) / 6))
            put_px(buf, S, x, y, r, g, b, a)

    # توهج قطبي ذهبي فوق قمة الكرة
    px, py = CX, CY - GLOBE_R - 6
    for y in range(max(0, int(py) - 46), min(S, int(py) + 46)):
        for x in range(max(0, int(px) - 46), min(S, int(px) + 46)):
            d = ((x - px) ** 2 + (y - py) ** 2) ** 0.5
            if d < 46:
                k = smooth(46, 4, d) ** 2 * 0.9
                i = (y * S + x) * 4
                if buf[i + 3] > 0:
                    buf[i] = min(255, int(buf[i] + 255 * k))
                    buf[i + 1] = min(255, int(buf[i + 1] + 215 * k))
                    buf[i + 2] = min(255, int(buf[i + 2] + 120 * k))

    # الكرة (كرة أطلس) بتظليل إشعاعي وحدود معتمة
    for y in range(S):
        for x in range(S):
            d = ((x - CX) ** 2 + (y - CY) ** 2) ** 0.5
            if d <= GLOBE_R + 2:
                dl = ((x - LIGHT[0]) ** 2 + (y - LIGHT[1]) ** 2) ** 0.5
                shade = smooth(GLOBE_R * 1.5, 0, dl)  # 1 قرب الضوء
                r = 22 + 70 * shade
                g = 30 + 88 * shade
                b = 74 + 132 * shade
                # تعتيم الحواف (limb darkening)
                limb = smooth(GLOBE_R, GLOBE_R * 0.72, d)
                r *= 0.55 + 0.45 * limb
                g *= 0.55 + 0.45 * limb
                b *= 0.6 + 0.4 * limb
                alpha = int(255 * smooth(GLOBE_R + 2, GLOBE_R - 1, d))
                i = (y * S + x) * 4
                ka = alpha / 255
                if alpha > 0 and buf[i + 3] > 0:
                    # مزج فوق الخلفية
                    buf[i] = int(buf[i] * (1 - ka) + r * ka)
                    buf[i + 1] = int(buf[i + 1] * (1 - ka) + g * ka)
                    buf[i + 2] = int(buf[i + 2] * (1 - ka) + b * ka)
                    buf[i + 3] = max(buf[i + 3], alpha)

    # خطوط الطول والعرض (شبكة كروية ذهبية خافتة)
    for y in range(S):
        for x in range(S):
            dx = (x - CX) / GLOBE_R
            dy = (y - CY) / GLOBE_R
            rr = dx * dx + dy * dy
            if rr > 1.0:
                continue
            hit = 0.0
            # خطوط طول: 3 قطوع ناقصة عمودية
            for rxk in (0.22, 0.58, 0.92):
                v = (dx / rxk) ** 2 + dy * dy
                hit = max(hit, smooth(0.008, 0.0, abs(v - 1.0)))
            # خطوط عرض: 2 قطع ناقص أفقي + خط الاستواء
            for ryk in (0.42, 0.86):
                v = (dy / ryk) ** 2 + dx * dx
                hit = max(hit, smooth(0.008, 0.0, abs(v - 1.0)))
            hit = max(hit, smooth(1.4, 0.0, abs(dy) * GLOBE_R))
            if hit > 0:
                i = (y * S + x) * 4
                if buf[i + 3] > 0:
                    k = hit * 0.5
                    buf[i] = min(255, int(buf[i] + 200 * k))
                    buf[i + 1] = min(255, int(buf[i + 1] + 170 * k))
                    buf[i + 2] = min(255, int(buf[i + 2] + 70 * k))

    # الحلقة الذهبية المائلة (مدار السيطرة)
    tilt_x, tilt_y = 1.0, 0.34  # إمالة بيضاوية خفيفة
    for y in range(S):
        for x in range(S):
            ex = (x - CX) / tilt_x
            ey = (y - CY) / tilt_y
            d = (ex * ex + ey * ey) ** 0.5
            band = smooth(RING_R + RING_W * 0.6, RING_R, d) * smooth(
                RING_R - RING_W * 0.6, RING_R, d
            )
            if band > 0:
                # لمعة ذهبية متدرجة بحسب الزاوية (أفتح أعلى اليمين)
                ang = (x - CX) * 0.8 + (y - CY) * 0.6
                shine = 0.55 + 0.45 * smooth(-RING_R, RING_R, ang)
                r = 96 + 150 * shine
                g = 74 + 128 * shine
                b = 22 + 62 * shine
                i = (y * S + x) * 4
                ka = band
                if buf[i + 3] > 0 or band > 0.5:
                    buf[i] = int(buf[i] * (1 - ka) + r * ka)
                    buf[i + 1] = int(buf[i + 1] * (1 - ka) + g * ka)
                    buf[i + 2] = int(buf[i + 2] * (1 - ka) + b * ka)
                    buf[i + 3] = min(255, buf[i + 3] + int(255 * band))

    # جوهرة القمة على الحلقة (علامة القوة)
    jx, jy = CX, CY - RING_R * tilt_y - 2
    for y in range(max(0, int(jy) - 14), min(S, int(jy) + 14)):
        for x in range(max(0, int(jx) - 14), min(S, int(jx) + 14)):
            d = ((x - jx) ** 2 + (y - jy) ** 2) ** 0.5
            if d < 9:
                k = smooth(9, 3, d)
                i = (y * S + x) * 4
                buf[i] = min(255, int(buf[i] * (1 - k) + 255 * k))
                buf[i + 1] = min(255, int(buf[i + 1] * (1 - k) + 240 * k))
                buf[i + 2] = min(255, int(buf[i + 2] * (1 - k) + 170 * k))
                buf[i + 3] = 255
    return buf


def transparent_logo() -> bytearray:
    """نفس اللوجو بدون خلفية (للأيقونة التكيفية foreground)."""
    src = master_canvas()
    buf = rgba_buf(S, S)
    for i in range(0, S * S * 4, 4):
        # شفّف الخلفية الكحلية: كل بكسل قريب من لون الخلفية يصبح شفافاً
        r, g, b = src[i], src[i + 1], src[i + 2]
        is_bg = b > r and b > g and r < 60 and g < 75 and b < 130
        if is_bg:
            continue
        buf[i], buf[i + 1], buf[i + 2], buf[i + 3] = r, g, b, src[i + 3]
    return buf


def scale_bilinear(src: bytearray, sw: int, sh: int, dw: int, dh: int) -> bytearray:
    buf = rgba_buf(dw, dh)
    kx, ky = sw / dw, sh / dh
    for y in range(dh):
        fy = min(sh - 1.001, (y + 0.5) * ky - 0.5)
        y0 = int(fy)
        ty = fy - y0
        for x in range(dw):
            fx = min(sw - 1.001, (x + 0.5) * kx - 0.5)
            x0 = int(fx)
            tx = fx - x0
            i00 = (y0 * sw + x0) * 4
            i10 = i00 + 4 if x0 + 1 < sw else i00
            i01 = i00 + sw * 4 if y0 + 1 < sh else i00
            i11 = i01 + 4 if x0 + 1 < sw else i01
            for c in range(4):
                a = src[i00 + c] * (1 - tx) + src[i10 + c] * tx
                b = src[i01 + c] * (1 - tx) + src[i11 + c] * tx
                buf[(y * dw + x) * 4 + c] = int(a * (1 - ty) + b * ty)
    return buf


def center_on(dst_size: int, src: bytearray, src_size: int, scale: float) -> bytearray:
    """ضع src في المنتصف بحجم scale من dst (للـ adaptive foreground)."""
    buf = rgba_buf(dst_size, dst_size)
    inner = int(dst_size * scale)
    scaled = scale_bilinear(src, src_size, src_size, inner, inner)
    off = (dst_size - inner) // 2
    for y in range(inner):
        for x in range(inner):
            si = (y * inner + x) * 4
            di = ((y + off) * dst_size + (x + off)) * 4
            if scaled[si + 3] > 0:
                buf[di : di + 4] = scaled[si : si + 4]
    return buf


def simple_bg(size: int, top, bottom) -> bytearray:
    buf = rgba_buf(size, size)
    for y in range(size):
        t = y / size
        r = top[0] + (bottom[0] - top[0]) * t
        g = top[1] + (bottom[1] - top[1]) * t
        b = top[2] + (bottom[2] - top[2]) * t
        for x in range(size):
            put_px(buf, size, x, y, r, g, b, 255)
    return buf


# ─────────────────────────────────────────────────────────────────────────
# شاشات البداية (splash)
# ─────────────────────────────────────────────────────────────────────────

def splash(w: int, h: int, logo: bytearray) -> bytearray:
    buf = rgba_buf(w, h)
    # خلفية متدرجة عمودية فاخرة
    for y in range(h):
        t = y / h
        r = 7 + 6 * (1 - t)
        g = 11 + 8 * (1 - t)
        b = 22 + 18 * (1 - t)
        for x in range(w):
            # توهج مركزي خلف اللوجو
            d = ((x - w / 2) ** 2 + (y - h / 2) ** 2) ** 0.5
            gl = max(0.0, 1.0 - d / (min(w, h) * 0.62))
            put_px(
                buf, w, x, y,
                r + 14 * gl * gl, g + 16 * gl * gl, b + 26 * gl * gl, 255,
            )
    # اللوجو في المنتصف (36% من أصغر بعد)
    lw = int(min(w, h) * 0.36)
    scaled = scale_bilinear(logo, S, S, lw, lw)
    ox, oy = (w - lw) // 2, (h - lw) // 2
    for y in range(lw):
        for x in range(lw):
            si = (y * lw + x) * 4
            a = scaled[si + 3] / 255
            if a <= 0:
                continue
            di = ((y + oy) * w + (x + ox)) * 4
            buf[di] = int(buf[di] * (1 - a) + scaled[si] * a)
            buf[di + 1] = int(buf[di + 1] * (1 - a) + scaled[si + 1] * a)
            buf[di + 2] = int(buf[di + 2] * (1 - a) + scaled[si + 2] * a)
            buf[di + 3] = 255
    # خط توهج سفلي (لمسة بريميوم)
    for y in range(h - 3, h):
        for x in range(w):
            put_px(buf, w, x, y, 139, 124, 246, 90)
    return buf


SPLASHES = {
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (960, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 960),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
}

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
FG_DENSITIES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def main() -> None:
    print("🎨 توليد هوية أطلس كنترول البصرية…")
    master = master_canvas()
    fg = transparent_logo()

    # PWA / ويب
    pub = os.path.join(ROOT, "public", "icons")
    write_png(os.path.join(pub, "atlas-icon-512.png"), S, S, master)
    write_png(os.path.join(pub, "atlas-icon-192.png"), 192, 192,
              scale_bilinear(master, S, S, 192, 192))
    write_png(os.path.join(pub, "atlas-apple-touch-icon.png"), 180, 180,
              scale_bilinear(master, S, S, 180, 180))
    # maskable: اللوجو داخل منطقة آمنة (80%) فوق خلفية كاملة
    mask_bg = simple_bg(512, (13, 18, 38), (7, 11, 22))
    inner = center_on(512, fg, S, 0.72)
    for i in range(0, len(mask_bg), 4):
        a = inner[i + 3] / 255
        if a > 0:
            mask_bg[i] = int(mask_bg[i] * (1 - a) + inner[i] * a)
            mask_bg[i + 1] = int(mask_bg[i + 1] * (1 - a) + inner[i + 1] * a)
            mask_bg[i + 2] = int(mask_bg[i + 2] * (1 - a) + inner[i + 2] * a)
    write_png(os.path.join(pub, "atlas-maskable-512.png"), 512, 512, mask_bg)

    # أندرويد — launcher + round (legacy)
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    for folder, size in DENSITIES.items():
        ic = scale_bilinear(master, S, S, size, size)
        write_png(os.path.join(res, folder, "ic_launcher.png"), size, size, ic)
        write_png(os.path.join(res, folder, "ic_launcher_round.png"), size, size, ic)

    # أندرويد — adaptive icons
    for folder, size in FG_DENSITIES.items():
        fgp = center_on(size, fg, S, 0.58)
        write_png(os.path.join(res, folder, "ic_launcher_foreground.png"), size, size, fgp)
        bgp = simple_bg(size, (16, 22, 46), (7, 11, 22))
        write_png(os.path.join(res, folder, "ic_launcher_background.png"), size, size, bgp)

    anydpi = os.path.join(res, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi, name), "w", encoding="utf-8") as f:
            f.write(adaptive)
        print(f"  ✓ mipmap-anydpi-v26/{name}")

    # شاشات البداية
    for folder, (w, h) in SPLASHES.items():
        sp = splash(w, h, master)
        write_png(os.path.join(res, folder, "splash.png"), w, h, sp)

    print("✅ اكتملت هوية أطلس كنترول البصرية.")


if __name__ == "__main__":
    main()
