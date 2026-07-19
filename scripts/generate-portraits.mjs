// Generates src/render/sprites/portraits.json — 24x29 head-and-shoulders
// portraits for the 22 cast, each in three expressions (rest / joy / ko), per
// the art bible's "base head + eye/mouth overlay" portrait spec (docs/11).
// Shares the chibi head vocabulary (face/cap/feature/SKIN/HAIR/ROSTER) with
// scripts/generate-sprites.mjs — keep the two ROSTER/SKIN tables in sync.
// The emitted JSON is authoritative and always regenerable — NEVER hand-edit;
// re-run:  node scripts/generate-portraits.mjs
//
// Not yet wired into any screen (foundation only). Expressions are pure
// eye/mouth swaps over a fixed head: joy = ^_^ + grin, ko = X-eyes + gritted.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const W = 24, H = 29;
const PALETTE = {
  '.': null, K: '#241f2e',
  d: '#8a4f38', m: '#a86a42', n: '#cf9268', S: '#eab48c', L: '#f7d7ba', // skin ramp (deep->light)
  h: '#6a4326', H: '#8a5a30', J: '#a9743d',              // hair (brown); h doubles as deep-skin shadow
  g: '#7d7887', G: '#b9b4c2', F: '#ff6a00',
  o: '#7a2731', r: '#c22f2c', R: '#e8433f', E: '#f2938c', // red kit (Rovers)
  b: '#2f55b8', B: '#3f6fd8', C: '#a3c8f0',              // blue kit (United)
  w: '#d9d5cf', W: '#ffffff', T: '#1d9e75', A: '#ba7517', // white + GK kits
};
const grid = () => Array.from({ length: H }, () => Array(W).fill('.'));
const set = (g, x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
const rect = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c); };
function outline(g) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && nx < W && ny >= 0 && ny < H && g[ny][nx] !== '.' && g[ny][nx] !== 'K'; })) add.push([x, y]);
  }
  add.forEach(([x, y]) => (g[y][x] = 'K'));
}
const SKIN = {
  fair:  { sh: 'n', base: 'S', hi: 'L' }, // European
  warm:  { sh: 'm', base: 'n', hi: 'S' }, // East/SE Asian, Latino, Mediterranean
  brown: { sh: 'd', base: 'm', hi: 'n' }, // South Asian, Middle Eastern
  deep:  { sh: 'h', base: 'd', hi: 'm' }, // African, Afro-Caribbean
};
const HAIR = { brown: { d: 'h', b: 'H', l: 'J' }, dark: { d: 'K', b: 'h', l: 'H' }, grey: { d: 'g', b: 'g', l: 'G' }, fire: { d: 'o', b: 'R', l: 'F' } };

function face(g, sk, opts = {}) {
  rect(g, 6, 5, 17, 13, sk.base);
  set(g, 6, 5, '.'); set(g, 17, 5, '.'); set(g, 6, 13, '.'); set(g, 17, 13, '.');
  set(g, 5, 9, sk.base); set(g, 18, 9, sk.base); set(g, 5, 10, sk.sh); set(g, 18, 10, sk.sh);
  rect(g, 7, 6, 9, 7, sk.hi);
  rect(g, 15, 11, 17, 12, sk.sh); set(g, 16, 13, sk.sh); set(g, 15, 13, sk.sh);
  rect(g, 10, 14, 13, 14, sk.sh); rect(g, 10, 15, 13, 15, sk.sh);
  const eye = opts.eyes || 'normal';
  if (eye === 'beady') { set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); }
  else if (eye === 'narrow') { rect(g, 8, 9, 9, 9, 'K'); rect(g, 14, 9, 15, 9, 'K'); }
  else if (eye === 'big') { rect(g, 7, 7, 9, 10, 'W'); rect(g, 14, 7, 16, 10, 'W'); set(g, 8, 9, 'K'); set(g, 9, 9, 'K'); set(g, 15, 9, 'K'); set(g, 14, 9, 'K'); }
  else if (eye === 'happy') { set(g, 7, 9, 'K'); set(g, 8, 8, 'K'); set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); set(g, 15, 8, 'K'); set(g, 16, 9, 'K'); }
  else if (eye === 'x') {
    set(g, 7, 8, 'K'); set(g, 9, 8, 'K'); set(g, 8, 9, 'K'); set(g, 7, 10, 'K'); set(g, 9, 10, 'K');
    set(g, 14, 8, 'K'); set(g, 16, 8, 'K'); set(g, 15, 9, 'K'); set(g, 14, 10, 'K'); set(g, 16, 10, 'K');
  } else { rect(g, 8, 8, 9, 9, 'W'); rect(g, 14, 8, 15, 9, 'W'); set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); }
  set(g, 11, 11, sk.sh); set(g, 12, 11, sk.sh);
  const mouth = opts.mouth || 'smile';
  if (mouth === 'grit') { rect(g, 9, 12, 14, 12, 'K'); set(g, 10, 12, 'W'); set(g, 12, 12, 'W'); }
  else if (mouth === 'grin') { rect(g, 9, 12, 14, 12, 'K'); rect(g, 10, 12, 13, 12, 'W'); }
  else { rect(g, 10, 12, 13, 12, 'K'); }
  if (opts.brow) rect(g, 7, 7, 16, 7, 'K');
}
function cap(g, hs, opts = {}) {
  const top = opts.top ?? 2;
  rect(g, 6, top + 2, 17, 6, hs.b); rect(g, 8, top, 15, top + 1, hs.b); rect(g, 7, top + 1, 16, top + 1, hs.b);
  rect(g, 7, top + 1, 9, top + 2, hs.l); rect(g, 6, 6, 17, 6, hs.d); set(g, 6, 7, hs.b); set(g, 17, 7, hs.b);
}
function feature(g, kind, hs, sk) {
  switch (kind) {
    case 'flattop': rect(g, 6, 1, 17, 5, hs.b); rect(g, 7, 1, 9, 2, hs.l); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'curls': rect(g, 5, 2, 18, 6, hs.b); [6, 8, 10, 12, 14, 16].forEach((x) => set(g, x, 1, hs.b)); [5, 7, 9, 11, 13, 15, 17].forEach((x) => set(g, x, 2, hs.l)); rect(g, 6, 6, 17, 6, hs.d); set(g, 5, 7, hs.b); set(g, 18, 7, hs.b); break;
    case 'shaved': rect(g, 7, 3, 16, 4, sk.base); rect(g, 6, 5, 17, 5, sk.base); rect(g, 6, 8, 6, 10, hs.d); rect(g, 17, 8, 17, 10, hs.d); break;
    case 'sidefringe': rect(g, 6, 2, 17, 5, hs.b); rect(g, 6, 6, 12, 7, hs.b); rect(g, 7, 2, 10, 3, hs.l); rect(g, 13, 6, 17, 6, hs.d); break;
    case 'headband': rect(g, 6, 2, 17, 4, hs.b); rect(g, 6, 5, 17, 5, 'R'); rect(g, 7, 2, 9, 3, hs.l); break;
    case 'grey': cap(g, hs); break;
    case 'spiky': rect(g, 6, 4, 17, 6, hs.b); [7, 9, 11, 13, 15].forEach((x) => { set(g, x, 1, hs.b); set(g, x, 2, hs.l); set(g, x, 3, hs.b); }); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'ponytail': cap(g, hs); rect(g, 18, 5, 19, 8, hs.b); set(g, 19, 6, hs.l); break;
    case 'fire': rect(g, 6, 5, 17, 6, 'o'); [7, 9, 11, 13, 15].forEach((x) => { set(g, x, 0, 'F'); set(g, x, 1, 'F'); set(g, x, 2, 'F'); set(g, x, 3, 'R'); set(g, x, 4, 'R'); }); rect(g, 6, 5, 17, 5, 'R'); break;
    case 'swept': rect(g, 6, 3, 15, 6, hs.b); rect(g, 4, 5, 6, 7, hs.b); rect(g, 7, 3, 11, 4, hs.l); rect(g, 6, 6, 15, 6, hs.d); break;
    case 'blondtips': cap(g, hs); rect(g, 8, 2, 15, 2, 'W'); set(g, 7, 3, 'W'); set(g, 16, 3, 'W'); break;
    case 'beard': cap(g, hs); rect(g, 6, 11, 17, 14, hs.b); rect(g, 10, 12, 13, 12, 'K'); rect(g, 6, 11, 6, 13, hs.d); rect(g, 17, 11, 17, 13, hs.d); break;
    case 'enforcer': rect(g, 6, 2, 17, 4, hs.b); rect(g, 6, 5, 17, 5, hs.d); rect(g, 5, 12, 18, 14, sk.sh); [6, 8, 10, 12, 14, 16].forEach((x) => set(g, x, 13, hs.d)); break;
    case 'moustache': cap(g, hs); rect(g, 10, 11, 13, 11, 'K'); break;
    case 'tuft': rect(g, 8, 3, 15, 6, hs.b); rect(g, 11, 1, 12, 2, hs.b); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'round': cap(g, hs); set(g, 7, 11, 'E'); set(g, 16, 11, 'E'); break;
    case 'slatecrop': rect(g, 6, 3, 17, 6, hs.b); rect(g, 7, 3, 10, 4, hs.l); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'undercut': rect(g, 7, 2, 16, 6, hs.b); rect(g, 8, 2, 11, 3, hs.l); set(g, 6, 7, sk.base); set(g, 17, 7, sk.base); rect(g, 7, 6, 16, 6, hs.d); break;
    case 'bull': cap(g, hs, { top: 3 }); rect(g, 5, 2, 6, 4, hs.b); rect(g, 17, 2, 18, 4, hs.b); set(g, 5, 1, hs.l); set(g, 18, 1, hs.l); break;
    case 'mohawk': set(g, 6, 7, sk.base); set(g, 17, 7, sk.base); rect(g, 10, 0, 13, 6, hs.b); rect(g, 11, 0, 12, 3, hs.l); rect(g, 10, 6, 13, 6, hs.d); break;
    default: cap(g, hs);
  }
}
// head-and-shoulders bust (kit + collar + crest), rows 16-28
function bust(g, kit) {
  rect(g, 9, 16, 14, 16, kit.base);
  rect(g, 7, 17, 16, 17, kit.base);
  rect(g, 5, 18, 18, 18, kit.base);
  rect(g, 3, 19, 20, 19, kit.base);
  rect(g, 2, 20, 21, 28, kit.base);
  rect(g, 2, 20, 3, 27, kit.hi);
  rect(g, 20, 21, 21, 28, kit.sh);
  rect(g, 2, 28, 21, 28, kit.sh);
  rect(g, 10, 16, 13, 17, kit.sh);
  rect(g, 10, 24, 13, 26, 'W'); set(g, 11, 25, kit.sh); set(g, 12, 25, kit.sh);
}

// Cast — mirrors the ROSTER in scripts/generate-sprites.mjs (skin/hair/feature).
const ROSTER = [
  { id: 'r0', team: 'rovers', gk: true, skin: 'fair', hair: 'brown', feature: 'gk' },
  { id: 'r1', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'flattop' },
  { id: 'r2', team: 'rovers', skin: 'deep', hair: 'dark', feature: 'curls' },
  { id: 'r3', team: 'rovers', skin: 'brown', hair: 'dark', feature: 'shaved' },
  { id: 'r4', team: 'rovers', skin: 'fair', hair: 'brown', feature: 'sidefringe' },
  { id: 'r5', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'headband' },
  { id: 'r6', team: 'rovers', skin: 'fair', hair: 'grey', feature: 'grey' },
  { id: 'r7', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'spiky' },
  { id: 'r8', team: 'rovers', skin: 'brown', hair: 'dark', feature: 'ponytail' },
  { id: 'r9', team: 'rovers', skin: 'fair', hair: 'fire', feature: 'fire' },
  { id: 'r10', team: 'rovers', skin: 'deep', hair: 'dark', feature: 'swept' },
  { id: 'u0', team: 'united', gk: true, skin: 'brown', hair: 'dark', feature: 'gk' },
  { id: 'u1', team: 'united', skin: 'fair', hair: 'brown', feature: 'blondtips' },
  { id: 'u2', team: 'united', skin: 'fair', hair: 'brown', feature: 'beard' },
  { id: 'u3', team: 'united', skin: 'warm', hair: 'dark', feature: 'enforcer' },
  { id: 'u4', team: 'united', skin: 'deep', hair: 'dark', feature: 'moustache' },
  { id: 'u5', team: 'united', skin: 'warm', hair: 'dark', feature: 'tuft' },
  { id: 'u6', team: 'united', skin: 'fair', hair: 'brown', feature: 'round' },
  { id: 'u7', team: 'united', skin: 'fair', hair: 'grey', feature: 'slatecrop' },
  { id: 'u8', team: 'united', skin: 'brown', hair: 'dark', feature: 'undercut' },
  { id: 'u9', team: 'united', skin: 'deep', hair: 'dark', feature: 'bull' },
  { id: 'u10', team: 'united', skin: 'warm', hair: 'dark', feature: 'mohawk' },
];
function baseOpts(feat) {
  const o = {};
  if (feat === 'enforcer') { o.eyes = 'beady'; o.brow = true; o.mouth = 'grit'; }
  if (feat === 'shaved') o.brow = true;
  if (feat === 'slatecrop') o.eyes = 'narrow';
  if (feat === 'round') o.mouth = 'grin';
  if (feat === 'fire' || feat === 'spiky') o.eyes = 'big';
  return o;
}
function portrait(spec, expr) {
  const g = grid();
  const sk = SKIN[spec.skin], hs = HAIR[spec.hair];
  const kit = spec.gk
    ? (spec.team === 'rovers' ? { base: 'T', hi: 'T', sh: 'K' } : { base: 'A', hi: 'A', sh: 'K' })
    : (spec.team === 'rovers' ? { sh: 'r', base: 'R', hi: 'E' } : { sh: 'b', base: 'B', hi: 'C' });
  const opts = baseOpts(spec.feature);
  if (expr === 'joy') { opts.eyes = 'happy'; opts.mouth = 'grin'; }
  if (expr === 'ko') { opts.eyes = 'x'; opts.mouth = 'grit'; }
  face(g, sk, opts);
  feature(g, spec.gk ? 'grey' : spec.feature, hs, sk); // keepers wear a plain cap
  bust(g, kit);
  outline(g);
  return g.map((row) => row.join(''));
}

const sprites = {};
for (const s of ROSTER) for (const e of ['rest', 'joy', 'ko']) sprites[`${s.id}:${e}`] = portrait(s, e);

// validation
if (Object.keys(PALETTE).length > 24) throw new Error(`palette ${Object.keys(PALETTE).length} keys > 24`);
for (const [k, rows] of Object.entries(sprites)) {
  if (rows.length !== H) throw new Error(`${k}: ${rows.length} rows != ${H}`);
  rows.forEach((row, i) => {
    if (row.length !== W) throw new Error(`${k} row ${i}: width ${row.length} != ${W}`);
    for (const ch of row) if (!(ch in PALETTE)) throw new Error(`${k} row ${i}: char '${ch}' not in palette`);
  });
}
for (const s of ROSTER) {
  const [a, b2, c] = ['rest', 'joy', 'ko'].map((e) => JSON.stringify(sprites[`${s.id}:${e}`]));
  if (a === b2 || a === c || b2 === c) throw new Error(`${s.id}: expressions must be distinct`);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/render/sprites/portraits.json');
writeFileSync(out, JSON.stringify({ cell: { w: W, h: H }, palette: PALETTE, sprites }, null, 2) + '\n');
console.log(`wrote ${out}\n  ${Object.keys(sprites).length} portraits, ${Object.keys(PALETTE).length} palette keys, cell ${W}x${H}`);
