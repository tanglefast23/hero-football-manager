#!/usr/bin/env node
// Generates the three M0 app-icon concepts for Hero Football Manager — round 3
// (ball-centric trio; user picked Concept A "Caped Ball" on 2026-07-18, which
// main() also exports to assets/icon.png). Each concept is a HAND-AUTHORED
// 32x32 pixel map: 32 rows of 32 chars, each char a palette key. No drawing
// primitives. Authenticity rules enforced by validateConcept(): <=16 colors,
// every char mapped, exact 32x32. All pixels are opaque (iOS icons forbid
// alpha) — "background" chars map to real colors. Nearest-neighbor upscaled
// to 1024/180/120px PNGs in art/icons/. No external deps — see png.mjs.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'art', 'icons');
const N = 32; // native authoring resolution for every concept

// ---------------------------------------------------------------------------
// Concept A — Caped Ball
// The ball IS the hero: chunky outlined soccer ball (center pentagon + five
// rim-straddling partials + shade crescent) wearing a red hero cape, knotted
// at the top-left rim, billowing off to the left with a pointed trailing edge.
// 3-step cape ramp: light-red highlight, red base, dark-red underside. Navy
// background, single-pixel gold sparks. 8 colors.
//
// Patch layout (owner note 2026-08-06: it needed to read as a real football,
// not a white ball with one spot). Six patches, spaced around the ball like a
// truncated icosahedron does: the center pentagon, then partials straddling
// the rim at up-left, up-right, right, lower-right and lower-left. The left
// rim carries none because the cape covers it — which is also what a cape
// would really do. Every partial merges with the outline where it crosses the
// edge; that IS the read at 32px, an inboard spot with a one-pixel white gap
// just looks like noise.
// ---------------------------------------------------------------------------
const CONCEPT_A = {
  palette: {
    n: '#101418', // navy background
    K: '#14100c', // hard black outline / ball patches
    w: '#f4efe4', // ball white
    s: '#c9c2b2', // ball shade step
    Y: '#f5c518', // gold sparks
    R: '#e8433f', // cape base
    P: '#f2836b', // cape highlight step
    D: '#b02420', // cape shade step
  },
  rows: [
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnYnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnYnnn',
    'nnnnnnnnnnnnnnKKKnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnKPRKnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnKRRKKKKKKKKnnnnnnnn',
    'nnnnnnnnnnnKRRKKKKwwwwwKKKnnnnnn',
    'nnnnnnnnKPPRRRKKwwwwwKKKKKKnnnnn',
    'nnnnnKPPPRRRRKwwwwwwwwKKKwwKnnnn',
    'nnnKPPPRRRRRKKwwwwwwwwwwwKKKKnnn',
    'nKPPPRRRRRRDKwwwwwwwwwwwwwwwKnnn',
    'nKPPRRRRRRDKKwwwwwwwwwwKKKKwKKnn',
    'KRRRRRRRRDDKwwwwwwwKKwwKKKKwwKnn',
    'KRRRRRRRDDDKwwwwwwKKKKwwKKKssKnn',
    'KRRRRRRDDDKKwwwwwKKKKKKwwwsssKnn',
    'KRRRRRDDKnnKwwwwwKKKKKKwwwsssKnn',
    'KRRDDDDKnnnKwwwwwwKKKKwwKKKssKnn',
    'KDKnKDKnnnnKKwwwwwwwwwwKKKssKKnn',
    'nnnnnnnnnnnnKwwwwwwwwwwKKKssKnnn',
    'nnnnnnnnnnnnKKwwwKKKwwwssssKKnnn',
    'nnnnnnnnnnnnnKwwKKKKwwsssssKnnnn',
    'nnnnnnnnnnnnnnKKwKKKsssssKKnnnnn',
    'nnnnnnnnnnnnnnnKKKwssssKKKnnnnnn',
    'nnnnnnnnnnnnnnnnnKKKKKKKnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnYnnnnnnnnnnnnnnYnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
  ],
};

// ---------------------------------------------------------------------------
// Concept B — Masked Ball
// The game's premise in one image: the ball is SECRETLY a superhero. A red
// domino mask with pointed wings wraps the ball, white slit eyes glare out,
// a smirk below. Patches simplified so the mask owns the face: one
// rim-straddling partial above the mask, shade crescent below. Striped pitch
// background with gold sparks. 8 colors.
// ---------------------------------------------------------------------------
const CONCEPT_B = {
  palette: {
    G: '#2e7d3a', // dark pitch stripe
    g: '#3a8f4a', // light pitch stripe
    K: '#14100c', // hard black outline / mask edges / smirk
    w: '#f4efe4', // ball white / mask eye slits
    s: '#c9c2b2', // ball shade step
    R: '#e8433f', // mask red
    D: '#c22f2c', // mask shade step
    Y: '#f5c518', // sparks
  },
  rows: [
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggYgggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGYGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGKKKKKKKgggggggg',
    'GGGGGGGGgggggggKKKwwwKKKKKgggggg',
    'GGGGGGGGggggggKKwwwwwwKKwKKggggg',
    'GGGGGGGGgggggKwwwwwwwwwwwwwKgggg',
    'GGGGGGGGggggKKwwwwwwwwwwwwwKKggg',
    'GGGGGGGGggKKKKKKKKKKKKKKKKKKKKKg',
    'GGGGGGGGgKRRRRRRRRRRRRRRRRRRRRKg',
    'GGGGGGGGggKRRRwwwwRRRRRwwwwRRKgg',
    'GGGGGGGGggKRRRwKKwRRRRRwKKwRRKgg',
    'GGGGGGGGgggKDDDDDDDDDDDDDDDDDKgg',
    'GGGGGGGGgggKKKKKKKKKKKKKKKKKKKgg',
    'GGGGGGGGgggKwwwwwwwwwwwwwwwssKgg',
    'GGGGGGGGgggKKwwwwwwwwKwwwsssKKgg',
    'GGGGGGGGggggKwwwKKKKKwwwssssKggg',
    'GGYGGGGGggggKKwwwKKKwwwssssKKggg',
    'GGGGGGGGgggggKwwKKKKwwsssssKgggg',
    'GGGGGGGGggggggKKwKKKssssssKKgYgg',
    'GGGGGGGGgggggggKKKwwsssssKKggggg',
    'GGGGGGGGggggggggGKKKKKKKgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
  ],
};

// ---------------------------------------------------------------------------
// Concept C — Impact Ball
// The ball punches through a comic-book impact burst: four thick K-outlined
// star spikes (gold, pale at the base where they meet the ball), diagonal
// gold dashes between them, two white speed dashes. Clean centered ball on
// navy. 2-step burst ramp, no fire anywhere. 6 colors.
// ---------------------------------------------------------------------------
const CONCEPT_C = {
  palette: {
    n: '#101418', // navy background
    K: '#14100c', // hard black outline / ball patches
    w: '#f4efe4', // ball white / speed dashes
    s: '#c9c2b2', // ball shade step
    Y: '#f5c518', // burst gold
    H: '#ffe08a', // burst pale step (spike bases)
  },
  rows: [
    'nnnnnnnnnnnnnnnKYKnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnKYKnnnnnnnnnnnnnn',
    'nnwwwnnnnnnnnnKYYYKnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnKYYYKnnnnnnnnnnnnn',
    'nnnnnnYnnnnnnKYYYYYKnnnnnnYnnnnn',
    'nnnnnnnYnnnnnKYHHHYKnnnnnYnnnnnn',
    'nnnnnnnnYnnnnKHHHHHKnnnnYnnnnnnn',
    'nnnnnnnnnnnnnKHHHHHKnnnnnnnnnnnn',
    'nnnnnnnnnnnnnKKKKKKKnnnnnnnnnnnn',
    'nnnnnnnnnnnnKKwwwwwKKnnnnnnnnnnn',
    'nnnnnnnnnnKKwwwwwwKKKKKnnnnnnnnn',
    'nnnnnnnnnnKwwwwwwwwwKKwKnnnnnnnn',
    'nnnnnnnnnKwwwwwwwwwwwwwKnnnnnnnn',
    'nnnnnnnnnKwwwwwwwwwwwwwKnnnnnnnn',
    'nnnnKKKKKwwwwwKKKwwwwwwwKKKKKnnn',
    'nKYYYHHHKwwwwKKKKKwwwwwwKHHYYYKn',
    'KYYYHHHHKwwwwKKKKKwwwwwwKHHHYYYK',
    'nKYYYHHHKwwwwwKKKwwwwwssKHHYYYKn',
    'nnnnKKKKKwwwwwwwwwwwwsssKKKKKnnn',
    'nnnnnnnnnKwwwwwwwwwwsssKnnnnnnnn',
    'nnnnnnnnnKwwwwwwwwwssssKnnnnnnnn',
    'nnnnnnnnnnKwKKwwssssssKnnnnnnnnn',
    'nnnnnnnnnnKKKKwwsssssKKnnnnnnnnn',
    'nnnnnnnnnnnnKKwssssKKnnnnnnnnnnn',
    'nnnnnnnnnnnnnKKKKKKKnnnnnnnnnnnn',
    'nnnnnnnnnnnnnKHHHHHKnnnnnnnnnnnn',
    'YnnnnnnnnnnnnKYHHHYKnnnnYnnnnnnn',
    'nnnnnnnYnnnnnnKYYYKnnnnnYnnnnnnn',
    'nnnnnnYnnnnnnnKYYYKnnnnnnYnnnnnn',
    'nnnnnnnnnnnnnnnKYKnnnnnnnnnwwwnn',
    'nnnnnnnnnnnnnnnKYKnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
  ],
};

// ---------------------------------------------------------------------------
// Validation: exact 32x32, every char in the palette, <=16 colors per concept.
// ---------------------------------------------------------------------------
function validateConcept(name, { rows, palette }) {
  if (rows.length !== N)
    throw new Error(`${name}: expected ${N} rows, got ${rows.length}`);
  const keys = new Set(Object.keys(palette));
  if (keys.size > 16)
    throw new Error(`${name}: ${keys.size} palette entries (max 16)`);
  for (const key of keys) {
    if (!/^#[0-9a-f]{6}$/.test(palette[key]))
      throw new Error(`${name}: bad hex for '${key}'`);
  }
  const used = new Set();
  rows.forEach((row, y) => {
    if (row.length !== N)
      throw new Error(
        `${name}: row ${y} is ${row.length} chars, expected ${N}`,
      );
    for (let x = 0; x < N; x++) {
      const ch = row[x];
      if (!keys.has(ch))
        throw new Error(`${name}: unknown char '${ch}' at (${x},${y})`);
      used.add(ch);
    }
  });
  for (const key of keys) {
    if (!used.has(key))
      throw new Error(`${name}: palette entry '${key}' is never used`);
  }
}

// ---------------------------------------------------------------------------
// Rasterization, upscaling, PNG I/O, and self-validation
// ---------------------------------------------------------------------------
function rasterizeRows(rows, palette) {
  const n = rows.length;
  const buf = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) {
    const row = rows[y];
    for (let x = 0; x < n; x++) {
      const hex = palette[row[x]];
      if (!hex)
        throw new Error(`missing palette entry for '${row[x]}' at (${x},${y})`);
      const i = (y * n + x) * 4;
      buf[i] = parseInt(hex.slice(1, 3), 16);
      buf[i + 1] = parseInt(hex.slice(3, 5), 16);
      buf[i + 2] = parseInt(hex.slice(5, 7), 16);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function upscaleNearest(buf, srcN, destN) {
  const out = Buffer.alloc(destN * destN * 4);
  const scale = destN / srcN;
  for (let y = 0; y < destN; y++) {
    const sy = Math.min(srcN - 1, Math.floor(y / scale));
    for (let x = 0; x < destN; x++) {
      const sx = Math.min(srcN - 1, Math.floor(x / scale));
      const si = (sy * srcN + sx) * 4,
        di = (y * destN + x) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = 255;
    }
  }
  return out;
}

function assertOpaque(buf, label) {
  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] !== 255)
      throw new Error(
        `${label}: non-opaque pixel (alpha=${buf[i]}) at byte ${i}`,
      );
  }
}

// Independent re-parse of a written PNG file: signature, IHDR, and a full
// inflate + unfilter pass so the opacity check runs against the actual bytes
// on disk, not just the buffer we encoded from.
function decodePNG(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('bad PNG signature');
  let offset = 8,
    width,
    height,
    bitDepth,
    colorType;
  const idatParts = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (width == null) throw new Error('missing IHDR chunk');
  if (bitDepth !== 8 || colorType !== 6)
    throw new Error(
      `expected 8-bit RGBA, got depth=${bitDepth} type=${colorType}`,
    );
  const raw = inflateSync(Buffer.concat(idatParts));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    if (raw[rowStart] !== 0)
      throw new Error(`unexpected filter type ${raw[rowStart]} on row ${y}`);
    raw.copy(pixels, y * stride, rowStart + 1, rowStart + 1 + stride);
  }
  return { width, height, bitDepth, colorType, pixels };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const concepts = [
    ['concept-a', CONCEPT_A],
    ['concept-b', CONCEPT_B],
    ['concept-c', CONCEPT_C],
  ];
  const sizes = [
    [1024, ''],
    [180, '-180'],
    [120, '-120'],
  ];
  const report = [];

  for (const [name, concept] of concepts) {
    validateConcept(name, concept);
    const native = rasterizeRows(concept.rows, concept.palette);
    assertOpaque(native, `${name} native`);
    for (const [size, suffix] of sizes) {
      const upscaled = upscaleNearest(native, N, size);
      assertOpaque(upscaled, `${name}${suffix} pre-encode`);
      const png = encodePNG(size, size, upscaled);
      const filePath = path.join(OUT_DIR, `${name}${suffix}.png`);
      writeFileSync(filePath, png);

      const onDisk = readFileSync(filePath);
      const decoded = decodePNG(onDisk);
      if (decoded.width !== size || decoded.height !== size) {
        throw new Error(
          `${filePath}: expected ${size}x${size}, got ${decoded.width}x${decoded.height}`,
        );
      }
      for (let i = 3; i < decoded.pixels.length; i += 4) {
        if (decoded.pixels[i] !== 255)
          throw new Error(
            `${filePath}: non-opaque pixel on re-parse at byte ${i}`,
          );
      }
      report.push(
        `  ${name}${suffix}.png: ${size}x${size}, ${onDisk.length}B, signature OK, opaque OK (re-parsed)`,
      );
    }
  }

  console.log(
    `Generated ${concepts.length * sizes.length} PNGs in ${OUT_DIR}:`,
  );
  console.log(report.join('\n'));

  // -------------------------------------------------------------------------
  // Shipped app icon — the user's 2026-07-18 pick: Concept A "Caped Ball".
  // app.json already points at assets/icon.png; this is the only writer of
  // that file, so the choice is recorded in code and regeneration stays
  // deterministic. Exact x32 nearest-neighbor upscale, opaque-verified twice
  // (pre-encode and re-parsed from disk) — iOS icons must have no alpha.
  // -------------------------------------------------------------------------
  const shippedNative = rasterizeRows(CONCEPT_A.rows, CONCEPT_A.palette);
  const writeShipped = (relativePath, size) => {
    const filePath = path.join(__dirname, '..', '..', ...relativePath);
    const upscaled = upscaleNearest(shippedNative, N, size);
    assertOpaque(upscaled, `${relativePath.join('/')} pre-encode`);
    writeFileSync(filePath, encodePNG(size, size, upscaled));
    const decoded = decodePNG(readFileSync(filePath));
    if (decoded.width !== size || decoded.height !== size) {
      throw new Error(
        `${filePath}: expected ${size}x${size}, got ${decoded.width}x${decoded.height}`,
      );
    }
    for (let i = 3; i < decoded.pixels.length; i += 4) {
      if (decoded.pixels[i] !== 255)
        throw new Error(
          `${filePath}: non-opaque pixel on re-parse at byte ${i}`,
        );
    }
    return filePath;
  };

  // The native app icon, plus the iPad PWA's home-screen and manifest icons.
  // They were once cut from assets/icon.png by hand with `sips`, which both
  // resampled the pixel art smooth and let them fall a redraw behind; taking
  // all four off the same 32x32 map with the same nearest-neighbour upscale
  // keeps every surface showing the same ball.
  const shippedPaths = [
    writeShipped(['assets', 'icon.png'], 1024),
    writeShipped(['public', 'apple-touch-icon.png'], 180),
    writeShipped(['public', 'icon-192.png'], 192),
    writeShipped(['public', 'icon-512.png'], 512),
  ];
  console.log(
    'Exported shipped icon (Concept A "Caped Ball", user pick 2026-07-18):',
  );
  console.log(shippedPaths.map((filePath) => `  ${filePath}`).join('\n'));
}

main();
