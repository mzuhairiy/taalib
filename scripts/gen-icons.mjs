// One-shot PNG icon generator for Taalib — pure Node, no deps.
// Draws a "T" glyph in cream on a navy square. Replace with branded art later.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const NAVY = [0x1a, 0x23, 0x40];
const CREAM = [0xec, 0xef, 0xe8];
const GOLD = [0xd4, 0xa0, 0x17];

// CRC-32 table
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
const crc32 = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
};

function makePNG(size, drawFn) {
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const rgb = drawFn(x, y, size);
    const i = (y * size + x) * 3;
    pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
  }
  // Add PNG filter byte (0 = None) at the start of each scanline
  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Draws a simple geometric mark: cream rounded square with navy "T" cutout + gold horizon strip.
function markPainter(opts = {}) {
  const { padding = 0, bg = NAVY, fg = CREAM, accent = GOLD } = opts;
  return (x, y, size) => {
    const p = Math.floor(size * padding);
    const inner = size - p * 2;
    const lx = x - p, ly = y - p;
    if (lx < 0 || ly < 0 || lx >= inner || ly >= inner) return bg;

    // rounded cream card
    const r = Math.floor(inner * 0.14);
    const inCorner = (cx, cy, rr) => {
      const dx = Math.max(0, Math.abs(lx - cx) - 0);
      const dy = Math.max(0, Math.abs(ly - cy) - 0);
      return dx * dx + dy * dy > rr * rr;
    };
    const nearCorner =
      (lx < r && ly < r && (lx - r) ** 2 + (ly - r) ** 2 > r * r) ||
      (lx >= inner - r && ly < r && (lx - (inner - r - 1)) ** 2 + (ly - r) ** 2 > r * r) ||
      (lx < r && ly >= inner - r && (lx - r) ** 2 + (ly - (inner - r - 1)) ** 2 > r * r) ||
      (lx >= inner - r && ly >= inner - r && (lx - (inner - r - 1)) ** 2 + (ly - (inner - r - 1)) ** 2 > r * r);
    if (nearCorner) return bg;

    // gold horizon
    const horizonY = Math.floor(inner * 0.80);
    const horizonH = Math.max(2, Math.floor(inner * 0.03));
    if (ly >= horizonY && ly < horizonY + horizonH) return accent;

    // navy "T" glyph (crossbar + stem)
    const barY = Math.floor(inner * 0.28);
    const barH = Math.max(4, Math.floor(inner * 0.10));
    const barX1 = Math.floor(inner * 0.22);
    const barX2 = Math.floor(inner * 0.78);
    if (ly >= barY && ly < barY + barH && lx >= barX1 && lx < barX2) return bg;

    const stemX1 = Math.floor(inner * 0.44);
    const stemX2 = Math.floor(inner * 0.56);
    const stemY2 = Math.floor(inner * 0.74);
    if (ly >= barY && ly < stemY2 && lx >= stemX1 && lx < stemX2) return bg;

    return fg;
  };
}

const sizes = [
  { name: "icon-192.png", size: 192, opts: { padding: 0 } },
  { name: "icon-512.png", size: 512, opts: { padding: 0 } },
  { name: "icon-maskable.png", size: 512, opts: { padding: 0.12 } },
  { name: "apple-touch-icon.png", size: 180, opts: { padding: 0 } }
];
for (const s of sizes) {
  writeFileSync(resolve(OUT, s.name), makePNG(s.size, markPainter(s.opts)));
  console.log("wrote", s.name, s.size);
}

// Favicon as SVG
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="9" fill="#1A2340"/>
  <rect x="9" y="9" width="46" height="46" rx="6" fill="#ECEFE8"/>
  <rect x="14" y="18" width="36" height="6" fill="#1A2340"/>
  <rect x="28" y="18" width="8" height="30" fill="#1A2340"/>
  <rect x="9" y="46" width="46" height="2" fill="#D4A017"/>
</svg>`;
writeFileSync(resolve(OUT, "favicon.svg"), favicon);
console.log("wrote favicon.svg");
