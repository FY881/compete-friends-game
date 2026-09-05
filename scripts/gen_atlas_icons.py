"""توليد لوجو «أطلس كنترول» الفاخر — PNG بدون PIL (stdlib فقط).

التصميم: قرص كحلي ملكي عميق + كرة أطلس (شبكة طول/عرض بنفسجية ملكية) +
خط استواء ذهبي + حلقة ذهبية خارجية + أشعة ذهبية رفيعة — هوية سيطرة بريميوم.
"""
import struct, zlib, os, math

def png_chunk(typ, data):
    c = typ + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def make_png(w, h, pixel_fn, path):
    rows = bytearray()
    for y in range(h):
        rows.append(0)  # filter: none
        for x in range(w):
            rows += bytes(pixel_fn(x, y, w, h))
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', ihdr)
           + png_chunk(b'IDAT', zlib.compress(bytes(rows), 9))
           + png_chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)

def base(x, y, s):
    t = (x + y) / (2.0 * s)
    return (int(9 + 16 * t), int(12 + 12 * t), int(28 + 40 * t), 255)

def atlas_logo(x, y, w, h):
    s = w  # مقياس يعتمد على العرض
    cx, cy = x - w / 2.0, y - h / 2.0
    d = math.hypot(cx, cy)
    gold = (0xd4, 0xaf, 0x37)
    gold_hi = (0xf0, 0xcd, 0x6a)
    royal = (0x8b, 0x7c, 0xf6)

    # حلقة ذهبية خارجية مزدوجة
    ring = w * 0.455
    if abs(d - ring) < w * 0.012:
        return gold_hi + (255,)
    if abs(d - ring * 0.965) < w * 0.004:
        return gold + (230,)

    if d < ring * 0.955:
        br, bg, bb, _ = base(x, y, s)
        # الكرة (نصف قطر 0.30w)
        globe = w * 0.30
        if d <= globe:
            # شبكة الطول والعرض
            step = w * 0.075
            lon = (cx % step) < (w * 0.008) or (cx % step) > step - (w * 0.008)
            lat = (y % step) < (w * 0.008) or (y % step) > step - (w * 0.008)
            # خط الاستواء الذهبي
            if abs(cy) < w * 0.012:
                return gold_hi + (255,)
            if lon or lat:
                return royal + (215,)
            # تظليل كروي
            shade = max(0.0, 1.0 - d / globe)
            return (int(br + 30 * shade + 14), int(bg + 34 * shade + 16), int(bb + 66 * shade + 34), 255)
        # قوس أفقي يحمل الكرة (ذراع أطلس)
        if abs(cy - w * 0.16) < w * 0.010 and abs(cx) < globe * 0.8:
            return gold + (235,)
        # أشعة مائلة رفيعة
        ang = math.degrees(math.atan2(cy, cx)) % 45
        if w * 0.33 < d < ring * 0.93 and ang < 0.9:
            return gold + (185,)
        return (br, bg, bb, 255)
    return base(x, y, s)

os.makedirs('public/icons', exist_ok=True)
for size, name in [(1024, 'atlas-icon-1024.png'), (512, 'atlas-icon-512.png'),
                   (192, 'atlas-icon-192.png'), (48, 'atlas-icon-48.png')]:
    n = make_png(size, size, atlas_logo, f'public/icons/{name}')
    print(f'{name}: {n} bytes')
print('OK')
