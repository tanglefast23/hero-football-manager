#!/usr/bin/env node
// Generates the three M0 app-icon concepts for Hero Football Manager — round 2.
// Each concept is a HAND-AUTHORED 32x32 pixel map: 32 rows of 32 chars, each char
// a palette key. No drawing primitives (round 1's fillRect circles/gradients read
// as modern flat design, not NES/SNES pixel art). Authenticity rules enforced by
// validateConcept(): <=16 colors, every char mapped, exact 32x32. All pixels are
// opaque (iOS icons forbid alpha) — "background" chars map to real colors.
// Nearest-neighbor upscaled to 1024/180/120px PNGs in art/icons/. No external
// deps — see png.mjs.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'art', 'icons');
const N = 32; // native authoring resolution for every concept

// ---------------------------------------------------------------------------
// Concept A — Blazing Ball
// A chunky outlined soccer ball blazing in from the upper-left corner over a
// vertically striped pitch. Flame ramp is a discrete 4-step NES band
// (red -> orange -> gold -> pale core, hottest where it meets the ball),
// wrapped in a hard black outline. Ball: black ring, white fill, one shade
// step (lower-right crescent), three classic patches. Single-pixel gold sparks.
// ---------------------------------------------------------------------------
const CONCEPT_A = {
  palette: {
    G: '#2e7d3a', // dark pitch stripe
    g: '#3a8f4a', // light pitch stripe
    K: '#14100c', // hard black outline / ball patches
    w: '#f4efe4', // ball white
    s: '#c9c2b2', // ball shade step
    R: '#c94f2a', // flame band 1 (outermost, coolest)
    O: '#ff6a00', // flame band 2
    Y: '#f5c518', // flame band 3 / sparks
    H: '#ffe08a', // flame band 4 (core, hottest, hugs the ball)
  },
  rows: [
    'GKRKGGGGKRKgggggGGGGGGGGgggggggg',
    'KRRRKGGKRRRKggggGGGGGGGGgggggggg',
    'KRRRRKGKRROOKgggGGGGYGGGgggggggg',
    'KRRROKGKROOOKgggGGGGGGGGgggYgggg',
    'KRRROOOOOOOYYKggGGGGGGGGgggggggg',
    'GKRROOOOOYYYYYKgGGGGGGGGgggggggg',
    'GKROOOOYYYYYYYKgGGGGGGGGgggggggg',
    'GGKROOOYYYYYHHYKGGGGGGGGgggggggg',
    'KROOOOYYYYHHHHYKGGGGGGGGgggggggg',
    'GGKOOOYYYYHHHHHKGGGGGGGGgggggggg',
    'GGGKOOYYYHHHHHHHKKKKKKKKgggggggg',
    'GGGKOYYYHHHHHHKKKKwwwwwKKKgggggg',
    'GGGGKOYYHHHHHKKKwwwwwwKKKKKggggg',
    'GGGGKOYHHHHHKKwwwwwwwwwKKKwKgggg',
    'GGGYGKYYHHHKKKwwwwwwwwwwwKKKKggg',
    'GGGGGKYHHHHKKwwwwwwwwwwwwwwwKggg',
    'GGGGGGKYHHKKKwwwwwwwwwwwwwwwKKgg',
    'GGGGGGGKHKGKKKwwwwwKKwwwwwwwwKgg',
    'GGGGGGGGgggKKKKwwwKKKKwwwwwwwKgg',
    'GGGGGGGGgggKKKKwwKKKKKKwwwwssKgg',
    'GGGGGYGGgggKKKwwwKKKKKKwwsssKKgg',
    'GGGGGGGGgggKwwwwwwKKKKwwwsssKKgg',
    'GGGGGGGGgggKKwwwwwwwwwwwwsssKKgg',
    'GGGGGGGGggggKwwwwwwwwwwwssssKggg',
    'GGGGGGGGggggKKwwwKKKwwwssssKKggg',
    'GGGGGGGGYggggKwwKKKKwwsssssKgggg',
    'GGGGGGGGggggggKKwKKKsssssKKggggg',
    'GGGGGGGGgggggggKKKwssssKKKgggggg',
    'GGGGGGGGggggggggGKKKKKKKgggggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
    'GGGGGGGGgggggYggGGGGGGGGggYggggg',
    'GGGGGGGGggggggggGGGGGGGGgggggggg',
  ],
};

// ---------------------------------------------------------------------------
// Concept B — Hero Face (Dario Flint, FIRE_TORCH)
// Ranked best of round 1; same composition rebuilt as hand-placed pixels.
// Big chibi close-up on navy with gold corner/side burst rays. Fire-spike hair
// in a strict 3-step ramp (red roots -> orange -> gold tips), angry angled
// brows, inward-focused 2x2 pupils, shouting mouth, one skin shade step, red
// V-neck kit collar with gold trim. Hard dark outline around the whole head.
// ---------------------------------------------------------------------------
const CONCEPT_B = {
  palette: {
    n: '#101418', // navy background
    x: '#ba7517', // burst ray, dark step
    Y: '#f5c518', // burst ray bright / hair tips / collar trim
    K: '#1c1410', // hard outline / brows / pupils
    R: '#c94f2a', // hair roots (band 1)
    O: '#ff6a00', // hair mid (band 2)
    s: '#f5c99a', // skin base
    d: '#c98d5a', // skin shade step
    w: '#fbf6ec', // eye white
    m: '#7a3f2a', // mouth interior
    c: '#e8433f', // kit collar red
    v: '#c22f2c', // kit collar shade / inner V
  },
  rows: [
    'YYYYxxnnnnnnnnKYYKnnnnnnnnxxYYYY',
    'YYYxxnnnnKYKnnKYYKnnKYKnnnnxxYYY',
    'YYxxnnnnnKYYKnKYYKnKYYKnnnnnxxYY',
    'YxxnnnnnKYYYKKYYYYKKYYYKnnnnnxxY',
    'xxnnnnnnKYYYOOYYYYOOYYYKnnnnnnxx',
    'xnnnKYYYOOOOOOOOOOOOOOOOYYYKnnnx',
    'nnnKYYOOOOORRRRRRRRRROOOOOYYKnnn',
    'nnnnKOOOORRRRRRRRRRRRRRROOOKnnnn',
    'nnnnnKORRRRRRRRRRRRRRRRROKnnnnnn',
    'nnnnnKRRRRRRRRRRRRRRRRRRRKnnnnnn',
    'nnnnnKRRRRRRRRRRRRRRRRRRRKnnnnnn',
    'nnnnnKRRRRRRRRRRRRRRRRRRRKnnnnnn',
    'nnnnnKRRRRsssRRRRRRsssRRRKnnnnnn',
    'nnnnnKsRRKKKKssRRssKKKKRRssKnnnn',
    'xxnnnKssssssKKKssssKKKsssssKnnxx',
    'YYYnnKssswwwwsssssswwwwssssKnYYY',
    'YYYnnKssswwKKssssssKKwwssddKnYYY',
    'xxnnnKssswwKKssssssKKwwssddKnnxx',
    'nnnnnKssssssssssssssssssdddKnnnn',
    'nnnnnKssssssssssssssssssdddKnnnn',
    'nnnnnnKssssssKKKKKKsssssddKnnnnn',
    'nnnnnnKssssssKmmmmKsssssddKnnnnn',
    'nnnnnnnKssssssKKKKssssdddKnnnnnn',
    'nnnnnnnKssssssssssssssdddKnnnnnn',
    'nnnnnnnnKssssssssssssddddKnnnnnn',
    'nnnnnnnnnKsssssssssssddKnnnnnnnn',
    'nnnnnnnnnnnKssssssdddKnnnnnnnnnn',
    'nnnKKKKKKKKKKKKKKKKKKKKKKKKKKnnn',
    'nnKcccccccccYYvvvvvvvYYcccccKnnn',
    'nKccccccccccccYYvvvvYYcccccccKnn',
    'KccccccccccccccYYYYcccccccccccnK',
    'KvvcccccccccccccccccccccccccvvvK',
  ],
};

// ---------------------------------------------------------------------------
// Concept C — Power Strike (fully colored this round)
// Round 1's kicking-player subject kept, but full color: a caped chibi hero in
// the red kit flies feet-first, fist forward, boot planted on the ball's
// underside with thin gold impact spikes and pale contact sparks. A gold cape
// streams behind with pointed trailing edge. White motion dashes, navy sky,
// striped pitch, white touchline slicing the lower-right corner.
// ---------------------------------------------------------------------------
const CONCEPT_C = {
  palette: {
    n: '#101418', // navy sky
    g: '#3a8f4a', // light pitch stripe
    G: '#2e7d3a', // dark pitch stripe
    K: '#14100c', // hard black outline / boots
    s: '#f5c99a', // skin
    h: '#4a2e1a', // hair
    c: '#e8433f', // kit red (shirt, socks)
    w: '#f4efe4', // white (shorts, ball, touchline, motion dashes)
    q: '#c9c2b2', // ball shade step
    Y: '#f5c518', // gold (cape, burst spikes)
    x: '#c99a12', // cape shade step
    H: '#ffe08a', // impact spark pixels
  },
  rows: [
    'nnnnnnnnnnnnnnnnnnnnYnnnnnYnnnnY',
    'nnnnnnnnnnHnnnnnnnnnYYnnnYYYnnYn',
    'nnnnnnnnnnnnnnnnnnnnnYYnnnnnnnnn',
    'nnnnnHnnnnnnnnnnnnnnnnnnKKKKKnnn',
    'nnnnnnnnnnnnnnnnnnnnnnnKKwwwKKnn',
    'nnnnnnnnnnnnnnnnnnnnnnKKwwwwwKKn',
    'nnnnnnnnnnnnnnnnnnnYYnKwwKKwwwKn',
    'nnnnnnnnnnnnnnnnnnnnnnKwwKKwwwKn',
    'nnnnnnnnnnnnnnnnnnnnnnKwwwwwqqKn',
    'nnnnnnnnKKKKKnnnnnnnnHKKwwqqqKKn',
    'nnnnnnnKhhhhhKnnnnnnnnnKKqqqKKnn',
    'nnnnnnKhhhhhhhKnnnnnnKKKKKKKKnnn',
    'gggggKhhhhsssssKKKKKKKKccKKggggg',
    'gwwwgKhhhsssKKsKccccwwwKKKgHgggg',
    'gggggKhhssssKKsKccccwwwKgggggggg',
    'gggggKsssssssKsKccccwwwKgggggggg',
    'wwwggKsssssssssKKKKKKKKggggggggg',
    'ggggggKssssssKYYKgKssKgggggggggg',
    'gggggggKsssssKYYYKggKccKgggggggg',
    'GGGGGGGGKKKKKYYYKGGGGGKKKGGGGGGG',
    'GwwGGGKYYYYYYYxKGGGGGGGGGGGGGGGG',
    'GGGGKYYYYYxxKGGGGGGGGGGGGGGGGGGG',
    'GGGKYYxxxKGGGGGGGGGGGGGGGGGGGGGG',
    'GGGKxKGKxKGGGGGGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    'gggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggwww',
    'ggggggggggggggggggggggggggwwwggg',
    'gggggggggggggggggggggggwwwgggggg',
    'ggggggggggggggggggggwwwggggggggg',
  ],
};

// ---------------------------------------------------------------------------
// Validation: exact 32x32, every char in the palette, <=16 colors per concept.
// ---------------------------------------------------------------------------
function validateConcept(name, { rows, palette }) {
  if (rows.length !== N) throw new Error(`${name}: expected ${N} rows, got ${rows.length}`);
  const keys = new Set(Object.keys(palette));
  if (keys.size > 16) throw new Error(`${name}: ${keys.size} palette entries (max 16)`);
  for (const key of keys) {
    if (!/^#[0-9a-f]{6}$/.test(palette[key])) throw new Error(`${name}: bad hex for '${key}'`);
  }
  const used = new Set();
  rows.forEach((row, y) => {
    if (row.length !== N) throw new Error(`${name}: row ${y} is ${row.length} chars, expected ${N}`);
    for (let x = 0; x < N; x++) {
      const ch = row[x];
      if (!keys.has(ch)) throw new Error(`${name}: unknown char '${ch}' at (${x},${y})`);
      used.add(ch);
    }
  });
  for (const key of keys) {
    if (!used.has(key)) throw new Error(`${name}: palette entry '${key}' is never used`);
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
      if (!hex) throw new Error(`missing palette entry for '${row[x]}' at (${x},${y})`);
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
      const si = (sy * srcN + sx) * 4, di = (y * destN + x) * 4;
      out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = 255;
    }
  }
  return out;
}

function assertOpaque(buf, label) {
  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] !== 255) throw new Error(`${label}: non-opaque pixel (alpha=${buf[i]}) at byte ${i}`);
  }
}

// Independent re-parse of a written PNG file: signature, IHDR, and a full
// inflate + unfilter pass so the opacity check runs against the actual bytes
// on disk, not just the buffer we encoded from.
function decodePNG(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('bad PNG signature');
  let offset = 8, width, height, bitDepth, colorType;
  const idatParts = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (width == null) throw new Error('missing IHDR chunk');
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`expected 8-bit RGBA, got depth=${bitDepth} type=${colorType}`);
  const raw = inflateSync(Buffer.concat(idatParts));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    if (raw[rowStart] !== 0) throw new Error(`unexpected filter type ${raw[rowStart]} on row ${y}`);
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
  const sizes = [[1024, ''], [180, '-180'], [120, '-120']];
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
        throw new Error(`${filePath}: expected ${size}x${size}, got ${decoded.width}x${decoded.height}`);
      }
      for (let i = 3; i < decoded.pixels.length; i += 4) {
        if (decoded.pixels[i] !== 255) throw new Error(`${filePath}: non-opaque pixel on re-parse at byte ${i}`);
      }
      report.push(`  ${name}${suffix}.png: ${size}x${size}, ${onDisk.length}B, signature OK, opaque OK (re-parsed)`);
    }
  }

  console.log(`Generated ${concepts.length * sizes.length} PNGs in ${OUT_DIR}:`);
  console.log(report.join('\n'));
}

main();
