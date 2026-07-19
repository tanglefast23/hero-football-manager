// Generates src/render/sprites/sprites.json — the 24x30 "heroic chibi"
// match-day cast (spec: docs/superpowers/specs/2026-07-19-match-day-character-
// art-quality-pass-design.md). All 22 players (both teams), keepers, and the
// 2-frame run cycle are composed from a shared body + a per-player feature()
// switch, then auto-outlined. The emitted JSON is authoritative and always
// regenerable — NEVER hand-edit it; change the cast here and re-run:
//   node scripts/generate-sprites.mjs
//
// Render-only data: sprites never feed the sim, so editing them needs no
// ENGINE_VERSION bump. Palette must stay within 24 keys (loader/test budget).
// The ball sprite (6x6) is preserved verbatim, not composed.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const W = 24, H = 30;

// 23 colours + '.' = 24 palette keys (loadSpriteSheet budget). Team hues kept
// as designed (Rovers red #e8433f, United blue #3f6fd8); shadow/light built
// around them. Skin ramp runs deep->light for squad diversity.
const PALETTE = {
  '.': null,
  K: '#241f2e',                                          // ink: outlines, pupils, boot outline
  d: '#8a4f38', m: '#a86a42', n: '#cf9268', S: '#eab48c', L: '#f7d7ba', // skin ramp (deep->light)
  h: '#6a4326', H: '#8a5a30', J: '#a9743d',              // hair (brown); h doubles as deep-skin shadow
  g: '#7d7887', G: '#b9b4c2',                            // hair (grey)
  F: '#ff6a00',                                          // Flint fire tip
  o: '#7a2731', r: '#c22f2c', R: '#e8433f', E: '#f2938c', // red kit (Rovers)
  b: '#2f55b8', B: '#3f6fd8', C: '#a3c8f0',              // blue kit (United; outline via ink)
  w: '#d9d5cf', W: '#ffffff',                            // white: shorts/socks/eyes/boots
  T: '#1d9e75', A: '#ba7517',                            // GK kits (teal / amber)
};

// ---- pixel-grid helpers ----
const grid = () => Array.from({ length: H }, () => Array(W).fill('.'));
const set = (g, x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
const rect = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c); };

// auto-outline: any '.' 4-adjacent to a painted (non-ink) cell becomes ink 'K',
// giving a clean 1px silhouette without hand-placing edge pixels.
function outline(g) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && nx < W && ny >= 0 && ny < H && g[ny][nx] !== '.' && g[ny][nx] !== 'K';
    });
    if (near) add.push([x, y]);
  }
  add.forEach(([x, y]) => (g[y][x] = 'K'));
}

// Four skin tones spanning the human range, built from a 6-step brown ramp
// (deep-skin shadow reuses hair-dark 'h'). Ethnicity reads via skin + hair only
// — never facial-feature caricature, which at 12px would be crude/stereotyping.
const SKIN = {
  fair:  { sh: 'n', base: 'S', hi: 'L' }, // European
  warm:  { sh: 'm', base: 'n', hi: 'S' }, // East/SE Asian, Latino, Mediterranean
  brown: { sh: 'd', base: 'm', hi: 'n' }, // South Asian, Middle Eastern
  deep:  { sh: 'h', base: 'd', hi: 'm' }, // African, Afro-Caribbean
};
const HAIR = {
  brown: { d: 'h', b: 'H', l: 'J' }, dark: { d: 'K', b: 'h', l: 'H' },
  grey: { d: 'g', b: 'g', l: 'G' }, fire: { d: 'o', b: 'R', l: 'F' },
};

function face(g, sk, opts = {}) {
  rect(g, 6, 5, 17, 13, sk.base);
  set(g, 6, 5, '.'); set(g, 17, 5, '.'); set(g, 6, 13, '.'); set(g, 17, 13, '.');
  set(g, 5, 9, sk.base); set(g, 18, 9, sk.base); set(g, 5, 10, sk.sh); set(g, 18, 10, sk.sh);
  rect(g, 7, 6, 9, 7, sk.hi);
  rect(g, 15, 11, 17, 12, sk.sh); set(g, 16, 13, sk.sh); set(g, 15, 13, sk.sh);
  rect(g, 10, 14, 13, 14, sk.sh);
  const eye = opts.eyes || 'normal';
  if (eye === 'beady') { set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); }
  else if (eye === 'narrow') { set(g, 8, 9, 'K'); set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); set(g, 15, 9, 'K'); }
  else if (eye === 'big') { rect(g, 7, 7, 9, 10, 'W'); rect(g, 14, 7, 16, 10, 'W'); set(g, 8, 9, 'K'); set(g, 9, 9, 'K'); set(g, 15, 9, 'K'); set(g, 14, 9, 'K'); }
  else { rect(g, 8, 8, 9, 9, 'W'); rect(g, 14, 8, 15, 9, 'W'); set(g, 9, 9, 'K'); set(g, 14, 9, 'K'); }
  set(g, 11, 11, sk.sh); set(g, 12, 11, sk.sh);
  const mouth = opts.mouth || 'smile';
  if (mouth === 'grit') { rect(g, 9, 12, 14, 12, 'K'); set(g, 10, 12, 'W'); set(g, 12, 12, 'W'); }
  else if (mouth === 'grin') { rect(g, 9, 12, 14, 12, 'K'); rect(g, 10, 12, 13, 12, 'W'); }
  else { rect(g, 10, 12, 13, 12, 'K'); }
  if (opts.brow) rect(g, 7, 7, 16, 7, 'K');
}

function cap(g, hs, opts = {}) {
  const top = opts.top ?? 2;
  rect(g, 6, top + 2, 17, 6, hs.b);
  rect(g, 8, top, 15, top + 1, hs.b);
  rect(g, 7, top + 1, 16, top + 1, hs.b);
  rect(g, 7, top + 1, 9, top + 2, hs.l);
  rect(g, 6, 6, 17, 6, hs.d);
  set(g, 6, 7, hs.b); set(g, 17, 7, hs.b);
}

function legs(g, frame, sk) {
  const [lL, rL] = frame === 1 ? [8, 14] : [9, 13];
  rect(g, lL, 26, lL + 1, 27, sk.base); rect(g, rL, 26, rL + 1, 27, sk.base);
  set(g, lL, 27, sk.sh); set(g, rL + 1, 27, sk.sh);
  rect(g, lL, 28, lL + 1, 28, 'W'); rect(g, rL, 28, rL + 1, 28, 'W');
  rect(g, lL - 1, 29, lL + 1, 29, 'W'); rect(g, rL, 29, rL + 2, 29, 'W');
  set(g, lL - 1, 29, 'w'); set(g, rL + 2, 29, 'w');
}

function body(g, kit, build, frame, sk) {
  let L = 7, R = 16;
  if (build === 'muscular') { L = 6; R = 17; }
  if (build === 'slim') { L = 8; R = 15; }
  rect(g, L, 16, R, 23, kit.base);
  rect(g, L, 16, R, 16, kit.hi);
  rect(g, L, 17, L + 1, 22, kit.hi);
  rect(g, R, 18, R, 23, kit.sh);
  rect(g, L, 23, R, 23, kit.sh);
  rect(g, 10, 16, 13, 16, kit.sh);
  rect(g, L - 1, 16, L - 1, 18, kit.base); rect(g, R + 1, 16, R + 1, 18, kit.base);
  rect(g, L - 1, 19, L - 1, 21, sk.base); rect(g, R + 1, 19, R + 1, 21, sk.base);
  if (build === 'muscular') { set(g, L - 2, 17, kit.base); set(g, R + 2, 17, kit.base); set(g, L - 2, 18, sk.base); set(g, R + 2, 18, sk.base); }
  rect(g, 11, 19, 12, 20, 'W');
  rect(g, L, 24, R, 25, 'W'); rect(g, L, 25, R, 25, 'w');
  legs(g, frame, sk);
}

function gkBody(g, kitBase, frame, sk, ready) {
  const L = 7, R = 16;
  rect(g, L, 16, R, 23, kitBase);
  rect(g, L, 16, R, 16, 'W');
  rect(g, 10, 16, 13, 16, 'K');
  rect(g, 11, 19, 12, 20, 'K');
  if (ready === undefined) {
    rect(g, L - 1, 16, L - 1, 18, kitBase); rect(g, R + 1, 16, R + 1, 18, kitBase);
    rect(g, L - 1, 19, L - 1, 20, 'W'); rect(g, R + 1, 19, R + 1, 20, 'W');
  } else {
    const spread = ready === 1 ? 3 : 2;
    rect(g, L - spread, 17, L - 1, 18, kitBase); rect(g, R + 1, 17, R + spread, 18, kitBase);
    rect(g, L - spread, 19, L - spread + 1, 20, 'W'); rect(g, R + spread - 1, 19, R + spread, 20, 'W');
  }
  rect(g, L, 24, R, 25, 'W'); rect(g, L, 25, R, 25, 'w');
  if (ready === undefined) legs(g, frame, sk);
  else {
    const off = ready === 1 ? 1 : 0;
    rect(g, 8 - off, 26, 9 - off, 27, sk.base); rect(g, 14 + off, 26, 15 + off, 27, sk.base);
    rect(g, 7 - off, 28, 9 - off, 28, 'W'); rect(g, 14 + off, 28, 16 + off, 28, 'W');
  }
}

// one pronounced feature per player, at silhouette level (docs/11 Rule 1)
function feature(g, kind, hs, sk) {
  switch (kind) {
    case 'flattop': rect(g, 6, 1, 17, 5, hs.b); rect(g, 7, 1, 9, 2, hs.l); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'curls':
      rect(g, 5, 2, 18, 6, hs.b); [6, 8, 10, 12, 14, 16].forEach((x) => set(g, x, 1, hs.b));
      [5, 7, 9, 11, 13, 15, 17].forEach((x) => set(g, x, 2, hs.l)); rect(g, 6, 6, 17, 6, hs.d);
      set(g, 5, 7, hs.b); set(g, 18, 7, hs.b); break;
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

function player(spec, frame) {
  const g = grid();
  const sk = SKIN[spec.skin], hs = HAIR[spec.hair];
  const kit = spec.team === 'rovers' ? { sh: 'r', base: 'R', hi: 'E' } : { sh: 'b', base: 'B', hi: 'C' };
  if (spec.gk) {
    const kb = spec.team === 'rovers' ? 'T' : 'A';
    face(g, sk, { eyes: 'normal', mouth: 'smile' }); cap(g, hs); gkBody(g, kb, frame, sk, spec.ready);
  } else {
    const fopts = {};
    if (spec.feature === 'enforcer') { fopts.eyes = 'beady'; fopts.brow = true; fopts.mouth = 'grit'; }
    if (spec.feature === 'shaved') fopts.brow = true;
    if (spec.feature === 'slatecrop') fopts.eyes = 'narrow';
    if (spec.feature === 'round') fopts.mouth = 'grin';
    if (spec.feature === 'fire' || spec.feature === 'spiky') fopts.eyes = 'big';
    face(g, sk, fopts); feature(g, spec.feature, hs, sk); body(g, kit, spec.build || 'normal', frame, sk);
  }
  outline(g);
  return g.map((row) => row.join(''));
}

// Roster = the designed cast (mirrors src/sim/teams.ts slot order). Each entry
// picks skin tone, hair colour, and the one pronounced feature. Star signatures
// are load-bearing (guarded by src/render/sprites/__tests__/sprites.test.ts):
// r9 Flint fire hair, u3 Bould muscular build, r0/u0 distinct GK kits.
const ROSTER = [
  { id: 'r0', team: 'rovers', gk: true, skin: 'fair', hair: 'brown', feature: 'gk' },       // Sam Mitts
  { id: 'r1', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'flattop' },             // Ed Stone
  { id: 'r2', team: 'rovers', skin: 'deep', hair: 'dark', feature: 'curls' },               // Bo Hedges
  { id: 'r3', team: 'rovers', skin: 'brown', hair: 'dark', feature: 'shaved' },             // Max Tanko
  { id: 'r4', team: 'rovers', skin: 'fair', hair: 'brown', feature: 'sidefringe' },         // Ty Brooks
  { id: 'r5', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'headband' },            // Gio Marsh
  { id: 'r6', team: 'rovers', skin: 'fair', hair: 'grey', feature: 'grey' },                // Ken Ash
  { id: 'r7', team: 'rovers', skin: 'warm', hair: 'dark', feature: 'spiky' },               // Leo Quick (E.Asian)
  { id: 'r8', team: 'rovers', skin: 'brown', hair: 'dark', feature: 'ponytail' },           // Ravi Chan (S.Asian)
  { id: 'r9', team: 'rovers', skin: 'fair', hair: 'fire', feature: 'fire' },                // Dario Flint *
  { id: 'r10', team: 'rovers', skin: 'deep', hair: 'dark', feature: 'swept', build: 'slim' }, // Zip Vela
  { id: 'u0', team: 'united', gk: true, skin: 'brown', hair: 'dark', feature: 'gk' },       // Vic Palm
  { id: 'u1', team: 'united', skin: 'fair', hair: 'brown', feature: 'blondtips' },          // Ali Frost
  { id: 'u2', team: 'united', skin: 'fair', hair: 'brown', feature: 'beard' },              // Jon Crag
  { id: 'u3', team: 'united', skin: 'warm', hair: 'dark', feature: 'enforcer', build: 'muscular' }, // Rex Bould *
  { id: 'u4', team: 'united', skin: 'deep', hair: 'dark', feature: 'moustache' },           // Nik Vale
  { id: 'u5', team: 'united', skin: 'warm', hair: 'dark', feature: 'tuft', build: 'slim' }, // Oz Reeds
  { id: 'u6', team: 'united', skin: 'fair', hair: 'brown', feature: 'round' },              // Cal Dunn
  { id: 'u7', team: 'united', skin: 'fair', hair: 'grey', feature: 'slatecrop' },           // Ian Slate
  { id: 'u8', team: 'united', skin: 'brown', hair: 'dark', feature: 'undercut' },           // Uri Kemp
  { id: 'u9', team: 'united', skin: 'deep', hair: 'dark', feature: 'bull', build: 'muscular' }, // Abe Torro
  { id: 'u10', team: 'united', skin: 'warm', hair: 'dark', feature: 'mohawk' },             // Moe Lyle (E.Asian)
];

const sprites = {};
for (const s of ROSTER) {
  sprites[`${s.id}:run0`] = player(s, 0);
  sprites[`${s.id}:run1`] = player(s, 1);
  if (s.gk) {
    sprites[`${s.id}:ready0`] = player({ ...s, ready: 0 }, 0);
    sprites[`${s.id}:ready1`] = player({ ...s, ready: 1 }, 0);
  }
}
sprites.ball = ['.KKKK.', 'KWWWWK', 'KWKKWK', 'KWWWWK', 'KWWWWK', '.KKKK.']; // unchanged 6x6

// ---- validation (mirrors loadSpriteSheet + sprites.test.ts invariants) ----
if (Object.keys(PALETTE).length > 24) throw new Error(`palette ${Object.keys(PALETTE).length} keys > 24`);
for (const [k, rows] of Object.entries(sprites)) {
  const isBall = k === 'ball';
  const eh = isBall ? 6 : H, ew = isBall ? 6 : W;
  if (rows.length !== eh) throw new Error(`${k}: ${rows.length} rows != ${eh}`);
  rows.forEach((row, i) => {
    if (row.length !== ew) throw new Error(`${k} row ${i}: width ${row.length} != ${ew}`);
    for (const ch of row) if (!(ch in PALETTE)) throw new Error(`${k} row ${i}: char '${ch}' not in palette`);
  });
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const id of ['r0', 'u0']) {
  if (eq(sprites[`${id}:ready0`], sprites[`${id}:run0`]) || eq(sprites[`${id}:ready1`], sprites[`${id}:run0`]) || eq(sprites[`${id}:ready0`], sprites[`${id}:ready1`]))
    throw new Error(`${id}: goalkeeper poses must be distinct`);
}
if (!(sprites['r9:run0'].join('') + sprites['r9:run1'].join('')).includes('F')) throw new Error('Flint lost his fire hair');

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/render/sprites/sprites.json');
writeFileSync(out, JSON.stringify({ cell: { w: W, h: H }, palette: PALETTE, sprites }, null, 2) + '\n');
console.log(`wrote ${out}\n  ${Object.keys(sprites).length} sprites, ${Object.keys(PALETTE).length} palette keys, cell ${W}x${H}`);
