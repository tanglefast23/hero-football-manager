#!/usr/bin/env node
// Generates the three M0 app-icon concepts for Hero Football Manager.
// Each concept is authored as a pixel map (rows-of-chars + palette, same shape as
// src/render/sprites/sprites.json) at 64x64, then nearest-neighbor upscaled to
// 1024/180/120px PNGs written to art/icons/. No external deps — see png.mjs.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'art', 'icons');
const N = 64; // native authoring resolution for every concept

// ---------------------------------------------------------------------------
// Grid: a mutable NxN character canvas with pixel-art drawing primitives.
// ---------------------------------------------------------------------------
class Grid {
  constructor(n, bg) {
    this.n = n;
    this.cells = new Array(n * n).fill(bg);
  }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }
  set(x, y, ch) {
    x = Math.round(x); y = Math.round(y);
    if (this.inBounds(x, y)) this.cells[y * this.n + x] = ch;
  }
  get(x, y) { return this.inBounds(x, y) ? this.cells[y * this.n + x] : null; }

  circle(cx, cy, r, ch) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, ch);
      }
    }
  }

  ring(cx, cy, rInner, rOuter, ch) {
    const ri2 = rInner * rInner, ro2 = rOuter * rOuter;
    for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
      for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
        const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= ri2 && d2 <= ro2) this.set(x, y, ch);
      }
    }
  }

  // "Stadium" shape: every point within r of the segment (x0,y0)-(x1,y1).
  capsule(x0, y0, x1, y1, r, ch) {
    const minX = Math.floor(Math.min(x0, x1) - r), maxX = Math.ceil(Math.max(x0, x1) + r);
    const minY = Math.floor(Math.min(y0, y1) - r), maxY = Math.ceil(Math.max(y0, y1) + r);
    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = x0 + t * dx, py = y0 + t * dy;
        const ddx = x - px, ddy = y - py;
        if (ddx * ddx + ddy * ddy <= r * r) this.set(x, y, ch);
      }
    }
  }

  // Like capsule(), but the radius interpolates linearly from r0 to r1 along
  // the segment — limbs that narrow toward hands/feet read as far more
  // dynamic than uniform-width tubes, and a tapered tip is unmistakably a
  // limb rather than another round prop sitting next to it.
  taperCapsule(x0, y0, r0, x1, y1, r1, ch) {
    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx * dx + dy * dy || 1;
    const maxR = Math.max(r0, r1);
    const minX = Math.floor(Math.min(x0, x1) - maxR), maxX = Math.ceil(Math.max(x0, x1) + maxR);
    const minY = Math.floor(Math.min(y0, y1) - maxR), maxY = Math.ceil(Math.max(y0, y1) + maxR);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = x0 + t * dx, py = y0 + t * dy;
        const r = r0 + (r1 - r0) * t;
        const ddx = x - px, ddy = y - py;
        if (ddx * ddx + ddy * ddy <= r * r) this.set(x, y, ch);
      }
    }
  }

  // Even-odd scanline polygon fill. `chOrFn` may be a char or (x,y) => char.
  polygon(points, chOrFn) {
    const ys = points.map((p) => p[1]);
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.n - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
        for (let x = xa; x <= xb; x++) {
          this.set(x, y, typeof chOrFn === 'function' ? chOrFn(x, y) : chOrFn);
        }
      }
    }
  }

  maskWhere(pred) {
    const m = new Uint8Array(this.n * this.n);
    for (let i = 0; i < this.cells.length; i++) m[i] = pred(this.cells[i]) ? 1 : 0;
    return m;
  }
  paintMask(mask, ch) {
    for (let i = 0; i < this.cells.length; i++) if (mask[i]) this.cells[i] = ch;
  }
  // Circular dilation by `thickness` px (includes the source mask itself).
  dilate(mask, thickness) {
    const n = this.n, out = new Uint8Array(n * n), t2 = thickness * thickness;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (mask[y * n + x]) { out[y * n + x] = 1; continue; }
        outer: for (let dy = -thickness; dy <= thickness; dy++) {
          for (let dx = -thickness; dx <= thickness; dx++) {
            if (dx * dx + dy * dy > t2) continue;
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < n && yy < n && mask[yy * n + xx]) { out[y * n + x] = 1; break outer; }
          }
        }
      }
    }
    return out;
  }
  toRows() {
    const rows = [];
    for (let y = 0; y < this.n; y++) rows.push(this.cells.slice(y * this.n, (y + 1) * this.n).join(''));
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Shared drawing helpers
// ---------------------------------------------------------------------------

// Filled axis-aligned ellipse — the building block for organic blobby shapes
// (flame lobes, ball dimples) where a plain circle would look too mechanical.
function blob(grid, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) grid.set(x, y, ch);
    }
  }
}

// A flame tongue: a chain of overlapping, shrinking, side-swaying blobs from
// base to tip. The blob-union approach gives naturally jagged/lobed edges
// (unlike a smoothly tapered stroke, which reads as a flat geometric shape).
// `band(y)` colors each blob by its ABSOLUTE y position, not local progress
// along this one tongue — so overlapping tongues still add up to one clean
// red-at-base -> gold-at-tip gradient instead of a patchwork.
function flameTongue(grid, baseX, baseY, tipX, tipY, baseWidth, segments, seed, band) {
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sway = Math.sin(t * Math.PI * 2.6 + seed) * baseWidth * 0.22 * Math.min(1, t * 1.6);
    const cx = baseX + (tipX - baseX) * t + sway;
    const cy = baseY + (tipY - baseY) * t;
    const shrink = Math.pow(1 - t, 0.9);
    const rx = Math.max(1.3, (baseWidth / 2) * shrink * (i % 2 === 0 ? 1 : 0.82));
    const ry = rx * 1.15;
    blob(grid, cx, cy, rx, ry, band(cy));
  }
}

function starPoints(cx, cy, rOuter, rInner, points, startDeg) {
  const pts = [];
  const step = Math.PI / points;
  const start = (startDeg * Math.PI) / 180;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = start + i * step;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function drawStar(grid, cx, cy, rOuter, rInner, points, startDeg, ch) {
  grid.polygon(starPoints(cx, cy, rOuter, rInner, points, startDeg), ch);
}

// A flame-tipped hair spike radiating from (cx,cy) starting at radius rBase.
// Drawn as two layered triangles (bigger outline, smaller gradient) so a clean
// dark rim appears automatically without a separate stroke pass.
function drawSpike(grid, cx, cy, rBase, length, angleDeg, outlineCh, band) {
  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad), dirY = Math.sin(rad);
  const perpX = -dirY, perpY = dirX;
  const halfW = 5, outerHalfW = halfW + 1.5;

  const oBaseX = cx + (rBase - 2) * dirX, oBaseY = cy + (rBase - 2) * dirY;
  const oTipX = cx + (rBase + length + 1.5) * dirX, oTipY = cy + (rBase + length + 1.5) * dirY;
  grid.polygon([
    [oBaseX + perpX * outerHalfW, oBaseY + perpY * outerHalfW],
    [oTipX, oTipY],
    [oBaseX - perpX * outerHalfW, oBaseY - perpY * outerHalfW],
  ], outlineCh);

  const baseX = cx + rBase * dirX, baseY = cy + rBase * dirY;
  const tipX = cx + (rBase + length) * dirX, tipY = cy + (rBase + length) * dirY;
  grid.polygon([
    [baseX + perpX * halfW, baseY + perpY * halfW],
    [tipX, tipY],
    [baseX - perpX * halfW, baseY - perpY * halfW],
  ], (x, y) => band(Math.max(0, Math.min(1, Math.hypot(x - baseX, y - baseY) / length))));
}

// A determined almond eye. `side` 'L' or 'R' controls which way the outer
// (pointed, raised) corner faces; the inner corner sits lower, toward the nose.
// Assumes the caller's palette defines 'w' (eye white) and 'p' (pupil).
function drawEye(grid, ex, ey, side) {
  const u = side === 'L' ? 1 : -1;
  const pts = [[-5, -0.5], [-2, -3.2], [3, -2.2], [4.5, 1.5], [2, 3], [-3, 2.4]]
    .map(([di, dv]) => [ex + u * di, ey + dv]);
  grid.polygon(pts, 'w');
  grid.circle(ex + u * 1.4, ey + 0.8, 2.1, 'p');
}

// ---------------------------------------------------------------------------
// Concept A — Blazing Ball
// ---------------------------------------------------------------------------
function buildConceptA() {
  // g=pitch green, d=darker stripe, z=zone-glow ring, k=ball outline, w=ball fill
  // r/o/y/h = flame bands: deep red-orange -> orange -> gold -> hot core
  const palette = {
    g: '#2e7d3a', d: '#276b32', z: '#f5c518',
    k: '#14100c', w: '#f4efe4',
    r: '#c94f2a', o: '#ff6a00', y: '#f5c518', h: '#ffe08a',
  };
  const grid = new Grid(N, 'g');

  // deep pitch green with a subtle darker diagonal mow-stripe pattern
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) grid.set(x, y, Math.floor((x + y) / 8) % 2 === 0 ? 'g' : 'd');
  }

  // fire trailing in from the upper-left, sweeping behind the ball. Color is
  // banded by absolute height (deep red base -> gold/hot tip) so the whole
  // cluster reads as one gradient even though it's built from several
  // separate, overlapping tongues.
  const heightBand = (y) => (y > 46 ? 'r' : y > 27 ? 'o' : y > 10 ? 'y' : 'h');
  const tongues = [
    { base: [2, 63], tip: [30, 2], w: 22, seg: 10, seed: 0.3 },
    { base: [6, 52], tip: [37, 16], w: 16, seg: 8, seed: 2.4 },
    { base: [1, 36], tip: [20, 9], w: 13, seg: 7, seed: 4.1 },
    { base: [8, 14], tip: [3, -1], w: 8, seg: 4, seed: 1.2 },
  ];
  for (const tg of tongues) {
    flameTongue(grid, tg.base[0], tg.base[1], tg.tip[0], tg.tip[1], tg.w, tg.seg, tg.seed, heightBand);
  }
  for (const [ex, ey] of [[16, 5], [24, 2], [5, 22], [46, 3], [54, 9], [12, 44]]) grid.circle(ex, ey, 1, 'y');

  // ball, slightly above-and-right of center, with a thin gold zone-glow ring
  const bx = 34, by = 31, br = 18;
  grid.ring(bx, by, br + 3, br + 4, 'z');
  grid.circle(bx, by, br, 'k');
  grid.circle(bx, by, br - 2, 'w');
  for (const [dx, dy, r] of [[-4, -5, 5], [8, 6, 4], [-9, 8, 3.5], [2, 13, 3], [10, -6, 3]]) {
    grid.circle(bx + dx, by + dy, r, 'k');
  }

  return { rows: grid.toRows(), palette };
}

// ---------------------------------------------------------------------------
// Concept B — Hero Face (Dario Flint, FIRE_TORCH)
// ---------------------------------------------------------------------------
function buildConceptB() {
  // n=navy bg, x/g=burst dark/bright gold, o=outline (hair+brow, same ink)
  // r/f/t = hair bands: deep red-orange -> fire orange -> gold tip
  // s/d=skin/shade, w/p=eye white/pupil, m=mouth, u=blush, c/v=collar red/shade, k=collar trim
  const palette = {
    n: '#101418', x: '#ba7517', g: '#f5c518',
    o: '#3a2b23', r: '#c94f2a', f: '#ff6a00', t: '#f5c518',
    s: '#f5c99a', d: '#c98d5a',
    w: '#fbf6ec', p: '#1c1410',
    m: '#7a3f2a', u: '#e8836f',
    c: '#e8433f', v: '#c22f2c', k: '#f5c518',
  };
  const grid = new Grid(N, 'n');
  const cx = 32, cy = 28, rHead = 24;

  drawStar(grid, cx, cy, 34, 24, 10, -100, 'x');
  drawStar(grid, cx, cy, 30, 21, 10, -100, 'g');

  const hairBand = (t) => (t < 0.45 ? 'r' : t < 0.8 ? 'f' : 't');
  const spikeAngles = [-172, -152, -128, -104, -90, -76, -52, -28, -8];
  const spikeLens = [10, 15, 19, 23, 26, 23, 19, 15, 10];
  spikeAngles.forEach((deg, i) => drawSpike(grid, cx, cy, rHead - 3, spikeLens[i], deg, 'o', hairBand));

  grid.circle(cx, cy, rHead + 2, 'o'); // head border (also trims spike bases)
  grid.circle(cx, cy, rHead, 'd');               // shade base, full head
  grid.circle(cx - 4, cy - 2, rHead - 3, 's');    // lit skin, offset toward upper-left
  // leaves a soft shaded crescent on the lower-right instead of a hard split

  grid.capsule(13, 22, 23, 26, 2.6, 'o');
  grid.capsule(41, 26, 51, 22, 2.6, 'o');
  drawEye(grid, 21, 30, 'L');
  drawEye(grid, 43, 30, 'R');
  grid.circle(16, 36, 2.4, 'u');
  grid.circle(48, 36, 2.4, 'u');
  grid.capsule(26, 40, 36, 41, 1.6, 'm');
  grid.capsule(35, 41, 38, 39, 1.4, 'm');

  // kit collar hint at the very bottom edge, with a small V-neck notch
  grid.polygon([[4, 64], [23, 48], [30, 52], [34, 52], [41, 48], [60, 64]], 'o');
  grid.polygon([[6, 64], [24, 50], [30, 54], [34, 54], [40, 50], [58, 64]], 'c');
  grid.polygon([[6, 64], [24, 50], [27, 52], [10, 64]], 'v');
  grid.capsule(22, 50, 30, 54, 1.2, 'k');
  grid.capsule(34, 54, 40, 50, 1.2, 'k');

  return { rows: grid.toRows(), palette };
}

// ---------------------------------------------------------------------------
// Concept C — Power Strike
// ---------------------------------------------------------------------------
function buildConceptC() {
  // g/n=pitch/dark split, s=silhouette, o=gold outline (also the POW/burst gold)
  // k/w=ball outline/fill, l=speed lines, p=POW white
  const palette = {
    g: '#2e7d3a', n: '#101418',
    s: '#000000', o: '#f5c518',
    k: '#14100c', w: '#f4efe4', l: '#eef1f5',
    p: '#fbf6ec',
  };
  const grid = new Grid(N, 'g');

  // split background: pitch green (majority) over a dark band, gentle diagonal
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) grid.set(x, y, y < 44 + x * 0.09 ? 'g' : 'n');
  }

  // comic impact burst, drawn first so the figure/ball sit in front of it
  drawStar(grid, 47, 10, 10, 4.5, 7, -100, 'o');
  drawStar(grid, 47, 10, 7.3, 3.2, 7, -100, 'p');

  // silhouette: a big chibi head, a compact torso, ONE dramatic two-segment
  // kicking leg (the whole story of the pose), and a short trailing leg + arm
  // to ground it — deliberately few, bold shapes rather than many thin limbs,
  // which is what let earlier drafts blur into an unreadable mass at 60px.
  // Union the parts into a mask, then ring it with a dilated gold outline:
  // paint the (bigger) halo first, the (smaller) body mask second — the ring
  // left uncovered by the body IS the outline.
  const body = new Grid(N, null);
  body.circle(14, 20, 10, 'X');                      // head (big, chibi)
  body.taperCapsule(24, 32, 4.5, 30, 38, 5, 'X');     // torso, held clear of the head —
                                                       // the dilated halo below bridges the
                                                       // 1px gap into a gold "neck" band so
                                                       // head and body read as two distinct
                                                       // shapes instead of one fused blob
  body.taperCapsule(24, 32, 3.4, 14, 41, 2.2, 'X');   // balance arm, tapers to a hand
  body.taperCapsule(30, 38, 5, 20, 48, 3, 'X');       // trailing leg, tapers to a foot
  body.taperCapsule(30, 38, 6.5, 42, 25, 5, 'X');     // kicking thigh
  body.taperCapsule(42, 25, 5, 47, 11, 2.4, 'X');     // kicking shin, tapers to a foot point
  const mask = body.maskWhere((ch) => ch === 'X');
  const halo = grid.dilate(mask, 2);
  grid.paintMask(halo, 'o');
  grid.paintMask(mask, 's');

  // ball beyond the kicking foot (near-touch, not buried behind it — the
  // tapered foot is now clearly smaller than the ball, so they don't read as
  // two balls), plus a few speed lines trailing its flight in from off-frame
  grid.circle(52, 9, 6, 'k');
  grid.circle(52, 9, 4.3, 'w');
  grid.circle(50, 7, 1.7, 'k');
  grid.circle(54, 11, 1.3, 'k');
  grid.capsule(58, 1, 63, 6, 1, 'l');
  grid.capsule(60, 8, 64, 13, 1, 'l');
  grid.capsule(58, 14, 62, 18, 1, 'l');

  return { rows: grid.toRows(), palette };
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
    ['concept-a', buildConceptA()],
    ['concept-b', buildConceptB()],
    ['concept-c', buildConceptC()],
  ];
  const sizes = [[1024, ''], [180, '-180'], [120, '-120']];
  const report = [];

  for (const [name, { rows, palette }] of concepts) {
    const native = rasterizeRows(rows, palette);
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
