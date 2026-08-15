/**
 * Generates PWA/Capacitor app icons for "تحدّي العقول".
 *
 * Design: rounded teal gradient square + bold white "؟" glyph. The "؟" is the
 * brand contour from public/logo.svg, thickened into a bold outline via a
 * per-pixel distance field (no native image deps; PNG encoded with zlib).
 *
 * Run: bun scripts/generate-icons.mjs  (or node)
 */
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

const SIZE = 512;
const GLYPH_STROKE = 27; // half the white stroke thickness in px
// The brand "؟" contour spans roughly (37..476) in both axes; scale it down
// to ~62% and center it so the glyph sits comfortably inside the canvas.
const GLYPH_SCALE = 0.62;
const GLYPH_OFFSET = (SIZE - (476 - 37) * 0.62) / 2;
const DOT = { x: 178, y: 362, r: 38 };

const TEAL_TOP = [20, 184, 166]; // #14b8a6
const TEAL_BOTTOM = [15, 118, 110]; // #0f766e
const WHITE = [255, 255, 255];

// ── PNG encoder ──────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

// ── Brand "؟" contour from the SVG ───────────────────────────────────────
const svg = readFileSync(join(ROOT, "public", "logo.svg"), "utf8");
const pathRe = /<path\s+d="([^"]+)"\s+fill="([^"]+)"(?:\s+transform="translate\(([\d.-]+),([\d.-]+)\)")?/g;
const paths = [];
let m;
while ((m = pathRe.exec(svg)) !== null) {
  paths.push({ d: m[1], fill: m[2], tx: m[3] ? parseFloat(m[3]) : 0, ty: m[4] ? parseFloat(m[4]) : 0 });
}

function parseCommands(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const cmds = [];
  let i = 0;
  while (i < tokens.length) {
    const c = tokens[i++];
    if (c === "M") cmds.push({ c, x: +tokens[i++], y: +tokens[i++] });
    else if (c === "C")
      cmds.push({ c, c1x: +tokens[i++], c1y: +tokens[i++], c2x: +tokens[i++], c2y: +tokens[i++], x: +tokens[i++], y: +tokens[i++] });
    else if (c === "Z") cmds.push({ c });
    else throw new Error(`Unsupported SVG command: ${c}`);
  }
  return cmds;
}

/** Flatten cubic beziers into line segments, applying a final transform. */
function flatten(cmds, tx, ty, xf) {
  const segs = [];
  let cur = null;
  let start = null;
  for (const cmd of cmds) {
    if (cmd.c === "M") {
      cur = { x: cmd.x, y: cmd.y };
      start = cur;
    } else if (cmd.c === "C" && cur) {
      const p0 = cur;
      const p3 = { x: cmd.x, y: cmd.y };
      const N = 48;
      let prev = p0;
      for (let s = 1; s <= N; s++) {
        const t = s / N;
        const u = 1 - t;
        const x = u ** 3 * p0.x + 3 * u * u * t * cmd.c1x + 3 * u * t * t * cmd.c2x + t ** 3 * p3.x;
        const y = u ** 3 * p0.y + 3 * u * u * t * cmd.c1y + 3 * u * t * t * cmd.c2y + t ** 3 * p3.y;
        segs.push([xf(prev.x + tx), xf(prev.y + ty), xf(x + tx), xf(y + ty)]);
        prev = { x, y };
      }
      cur = p3;
    } else if (cmd.c === "Z" && cur && start) {
      segs.push([xf(cur.x + tx), xf(cur.y + ty), xf(start.x + tx), xf(start.y + ty)]);
      cur = start;
    }
  }
  return segs;
}

// The "؟" subpath is the part of the white square path that follows its first
// close (the square), i.e. "M37 46 … Z".
const whiteSquare = paths.find((p) => p.fill.toLowerCase() === "#fdfdfd");
const qmarkD = whiteSquare.d.slice(whiteSquare.d.indexOf("Z") + 1);
const qmarkSegs = flatten(parseCommands(qmarkD + " Z"), 0, 0, (v) => v);

// ── Geometry helpers ─────────────────────────────────────────────────────
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function insideRoundedRect(px, py, W, H, r) {
  const cx = Math.min(Math.max(px, r), W - r);
  const cy = Math.min(Math.max(py, r), H - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// ── Render ───────────────────────────────────────────────────────────────
function renderIcon({ rounded = true, glyphScale = 1, glyphOffset = 0 } = {}) {
  const rgba = Buffer.alloc(SIZE * SIZE * 4); // transparent
  const xf = glyphScale === 1 ? (v) => v : (v) => glyphScale * v + glyphOffset;
  const r = rounded ? 112 : 0; // maskable = full-bleed

  const glyphSegs = qmarkSegs.map(([x1, y1, x2, y2]) => [
    xf(x1), xf(y1), xf(x2), xf(y2),
  ]);
  const dot = {
    x: xf(DOT.x),
    y: xf(DOT.y),
    r: DOT.r * glyphScale,
  };

  for (let y = 0; y < SIZE; y++) {
    const py = y + 0.5;
    const t = py / SIZE;
    const tr = Math.round(TEAL_TOP[0] + (TEAL_BOTTOM[0] - TEAL_TOP[0]) * t);
    const tg = Math.round(TEAL_TOP[1] + (TEAL_BOTTOM[1] - TEAL_TOP[1]) * t);
    const tb = Math.round(TEAL_TOP[2] + (TEAL_BOTTOM[2] - TEAL_TOP[2]) * t);
    for (let x = 0; x < SIZE; x++) {
      const px = x + 0.5;
      const inBg = r === 0 || insideRoundedRect(px, py, SIZE, SIZE, r);
      if (!inBg) continue;
      const dxp = px - dot.x;
      const dyp = py - dot.y;
      const inDot = dxp * dxp + dyp * dyp <= dot.r * dot.r;
      let white = inDot;
      if (!white) {
        for (const [x1, y1, x2, y2] of glyphSegs) {
          if (distToSeg(px, py, x1, y1, x2, y2) <= GLYPH_STROKE) {
            white = true;
            break;
          }
        }
      }
      const i = (y * SIZE + x) * 4;
      if (white) {
        rgba[i] = WHITE[0];
        rgba[i + 1] = WHITE[1];
        rgba[i + 2] = WHITE[2];
      } else {
        rgba[i] = tr;
        rgba[i + 1] = tg;
        rgba[i + 2] = tb;
      }
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function downscale(rgba, from, to) {
  const out = Buffer.alloc(to * to * 4);
  const scale = from / to;
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      const sx = x * scale + scale / 2 - 0.5;
      const sy = y * scale + scale / 2 - 0.5;
      const x0 = Math.max(0, Math.min(from - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(from - 1, Math.floor(sy)));
      const x1 = Math.min(from - 1, x0 + 1);
      const y1 = Math.min(from - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const v =
          rgba[(y0 * from + x0) * 4 + c] * (1 - fx) * (1 - fy) +
          rgba[(y0 * from + x1) * 4 + c] * fx * (1 - fy) +
          rgba[(y1 * from + x0) * 4 + c] * (1 - fx) * fy +
          rgba[(y1 * from + x1) * 4 + c] * fx * fy;
        out[(y * to + x) * 4 + c] = Math.round(v);
      }
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

const regular = renderIcon({ rounded: true, glyphScale: GLYPH_SCALE, glyphOffset: GLYPH_OFFSET });
const maskable = renderIcon({ rounded: false, glyphScale: GLYPH_SCALE * 0.85, glyphOffset: GLYPH_OFFSET * 0.85 + SIZE * 0.075 });

const targets = [
  ["icon-512.png", regular, 512, null],
  ["icon-192.png", regular, 512, 192],
  ["apple-touch-icon.png", regular, 512, 180],
  ["icon-maskable-512.png", maskable, 512, null],
];

for (const [name, src, from, to] of targets) {
  const size = to ?? from;
  const data = to ? downscale(src, from, to) : src;
  const png = encodePNG(size, size, data);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`✓ public/icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
