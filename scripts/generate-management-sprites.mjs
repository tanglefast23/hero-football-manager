import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE = {
  '.': null, K: '#241f2e', k: '#493d50', W: '#fff5dc', C: '#f4e7c5', c: '#d4bd91',
  D: '#6f5033', B: '#315a86', b: '#1f3e63', R: '#bb4b45', r: '#74332f',
  G: '#65a86f', g: '#356840', Y: '#f2c94c', y: '#b88424', P: '#8c65a8',
  p: '#59446d', S: '#f7d7ba', s: '#c98662', M: '#bd7c56', m: '#7f4935',
  N: '#8a4f38', n: '#5c3329', H: '#43332e', h: '#241d1a', A: '#c5c1ca',
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const COACHES = JSON.parse(readFileSync(
  resolve(scriptDirectory, '../src/game/coach-identities.json'),
  'utf8',
));

const FACILITIES = [
  'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
  'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
  'fan-shop', 'stadium-stand',
];

const COACH_WARDROBES = [
  'suit-tie',
  'suit-open-collar',
  'blazer-turtleneck',
  'cardigan-shirt',
  'sweater-shirt',
  'quarter-zip',
  'training-polo',
  'club-tracksuit',
  'training-shell',
  'padded-gilet',
  'padded-coat',
  'rain-jacket',
  'overcoat-scarf',
];

const DARK_ACCENT = { B: 'b', R: 'r', G: 'g', Y: 'y', P: 'p' };

function grid(w, h) { return Array.from({ length: h }, () => Array(w).fill('.')); }
function set(g, x, y, v) { if (g[y]?.[x] !== undefined) g[y][x] = v; }
function rect(g, x0, y0, x1, y1, v) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(g, x, y, v);
}
function line(g, x0, y0, x1, y1, v) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) set(g, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), v);
}
function outline(g) {
  const copy = g.map(row => [...row]);
  for (let y = 0; y < g.length; y += 1) for (let x = 0; x < g[y].length; x += 1) {
    if (copy[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => copy[y + dy]?.[x + dx] !== undefined && copy[y + dy][x + dx] !== '.')) set(g, x, y, 'K');
  }
}
function rows(g) { outline(g); return g.map(row => row.join('')); }

function coach({ id, age, skin, hair, feature, accent, wardrobe }, joy) {
  const g = grid(24, 29);
  rect(g, 6, 4, 17, 14, skin); rect(g, 7, 3, 16, 15, skin);
  rect(g, 8, 8, 9, 9, 'K'); rect(g, 14, 8, 15, 9, 'K');
  if (joy) { set(g, 9, 9, skin); set(g, 15, 9, skin); rect(g, 10, 12, 13, 13, 'W'); }
  else rect(g, 11, 12, 12, 12, 'K');
  coachBody(g, wardrobe, accent, skin);
  hairFeature(g, feature, hair, skin);
  ageFace(g, age, skin, feature);
  return [`coach:${id}:${joy ? 'joy' : 'rest'}`, rows(g)];
}

function coachBody(g, wardrobe, accent, skin) {
  const dark = DARK_ACCENT[accent];
  const trousers = () => {
    rect(g, 5, 26, 9, 27, 'k');
    rect(g, 14, 26, 18, 27, 'k');
  };
  const jacket = (body = accent, sleeve = body) => {
    rect(g, 6, 17, 17, 26, body);
    rect(g, 4, 19, 6, 25, sleeve);
    rect(g, 17, 19, 19, 25, sleeve);
  };

  if (wardrobe === 'suit-tie') {
    jacket(accent);
    rect(g, 9, 17, 14, 24, 'W');
    line(g, 7, 17, 10, 22, dark); line(g, 16, 17, 13, 22, dark);
    rect(g, 11, 19, 12, 24, 'K'); set(g, 10, 18, 'K'); set(g, 13, 18, 'K');
    trousers();
  } else if (wardrobe === 'suit-open-collar') {
    jacket(accent);
    rect(g, 9, 17, 14, 24, 'W');
    line(g, 7, 17, 10, 22, dark); line(g, 16, 17, 13, 22, dark);
    set(g, 10, 18, 'K'); set(g, 13, 18, 'K'); rect(g, 11, 19, 12, 20, skin);
    trousers();
  } else if (wardrobe === 'blazer-turtleneck') {
    jacket(accent);
    rect(g, 9, 16, 14, 25, 'k'); rect(g, 10, 16, 13, 18, 'K');
    line(g, 7, 17, 10, 22, dark); line(g, 16, 17, 13, 22, dark);
    trousers();
  } else if (wardrobe === 'cardigan-shirt') {
    jacket('C', accent);
    rect(g, 6, 17, 9, 26, accent); rect(g, 14, 17, 17, 26, accent);
    line(g, 7, 17, 11, 22, accent); line(g, 16, 17, 12, 22, accent);
    rect(g, 11, 21, 12, 26, 'C');
    set(g, 11, 22, 'K'); set(g, 11, 25, 'K');
    rect(g, 6, 25, 17, 26, dark); trousers();
  } else if (wardrobe === 'sweater-shirt') {
    jacket(accent);
    rect(g, 8, 17, 15, 18, 'W'); set(g, 9, 19, 'W'); set(g, 14, 19, 'W');
    line(g, 8, 18, 11, 21, dark); line(g, 15, 18, 12, 21, dark);
    rect(g, 6, 25, 17, 26, dark); trousers();
  } else if (wardrobe === 'quarter-zip') {
    jacket(accent);
    rect(g, 8, 16, 15, 19, dark); rect(g, 10, 17, 13, 18, accent);
    rect(g, 11, 18, 12, 22, 'W'); set(g, 12, 22, 'K');
    rect(g, 6, 24, 17, 25, dark); trousers();
  } else if (wardrobe === 'training-polo') {
    rect(g, 6, 17, 17, 26, accent);
    rect(g, 4, 19, 7, 22, accent); rect(g, 16, 19, 19, 22, accent);
    rect(g, 5, 23, 6, 25, skin); rect(g, 17, 23, 18, 25, skin);
    line(g, 8, 17, 11, 20, dark); line(g, 15, 17, 12, 20, dark);
    rect(g, 11, 19, 12, 22, 'W'); set(g, 12, 21, 'K');
    rect(g, 6, 25, 17, 26, dark); trousers();
  } else if (wardrobe === 'club-tracksuit') {
    jacket(dark, accent);
    rect(g, 7, 16, 16, 19, dark); rect(g, 11, 17, 12, 26, 'W');
    line(g, 5, 19, 7, 25, 'W'); line(g, 18, 19, 16, 25, 'W');
    rect(g, 7, 23, 10, 25, accent); rect(g, 13, 23, 16, 25, accent);
    set(g, 8, 20, 'Y'); trousers();
  } else if (wardrobe === 'training-shell') {
    jacket(accent, dark);
    rect(g, 7, 16, 16, 19, dark); rect(g, 11, 17, 12, 26, 'K');
    line(g, 6, 19, 11, 23, 'W'); line(g, 17, 19, 12, 23, 'W');
    rect(g, 6, 24, 9, 25, dark); rect(g, 14, 24, 17, 25, dark);
    trousers();
  } else if (wardrobe === 'padded-gilet') {
    jacket('k', 'k');
    rect(g, 7, 16, 16, 26, accent); rect(g, 9, 16, 14, 18, dark);
    rect(g, 11, 18, 12, 26, 'K');
    for (const y of [20, 23]) rect(g, 7, y, 16, y, dark);
    trousers();
  } else if (wardrobe === 'padded-coat') {
    rect(g, 5, 16, 18, 27, accent); rect(g, 3, 18, 6, 26, accent); rect(g, 17, 18, 20, 26, accent);
    rect(g, 8, 15, 15, 19, dark); rect(g, 11, 18, 12, 27, 'K');
    for (const y of [20, 23, 26]) rect(g, 5, y, 18, y, dark);
  } else if (wardrobe === 'rain-jacket') {
    rect(g, 5, 16, 18, 27, accent); rect(g, 3, 19, 6, 26, dark); rect(g, 17, 19, 20, 26, dark);
    line(g, 6, 17, 9, 15, dark); line(g, 17, 17, 14, 15, dark); rect(g, 9, 15, 14, 18, dark);
    rect(g, 11, 17, 12, 27, 'W');
    line(g, 6, 22, 9, 24, dark); line(g, 17, 22, 14, 24, dark);
  } else if (wardrobe === 'overcoat-scarf') {
    rect(g, 5, 17, 18, 27, 'k'); rect(g, 3, 19, 6, 26, 'k'); rect(g, 17, 19, 20, 26, 'k');
    rect(g, 8, 16, 15, 20, accent); rect(g, 10, 19, 13, 27, accent);
    set(g, 8, 22, 'A'); set(g, 15, 22, 'A'); set(g, 8, 25, 'A'); set(g, 15, 25, 'A');
  } else {
    throw new Error(`unknown coach wardrobe ${wardrobe}`);
  }
}

function ageFace(g, age, skin, feature) {
  const crease = skin === 'S' ? 's' : skin === 'M' ? 'm' : 'n';
  if (age >= 40) { set(g, 6, 12, crease); set(g, 17, 12, crease); }
  if (age >= 50) {
    set(g, 7, 10, crease); set(g, 16, 10, crease);
    if (!['headwrap', 'scarf-bun', 'flat-cap'].includes(feature)) {
      set(g, 6, 6, 'A'); set(g, 17, 6, 'A');
    }
  }
  if (age >= 57) { set(g, 10, 6, crease); set(g, 12, 6, crease); }
}

function hairFeature(g, feature, hair, skin) {
  const cap = () => { rect(g, 6, 3, 17, 6, hair); rect(g, 5, 5, 7, 9, hair); rect(g, 16, 5, 18, 9, hair); };
  if (feature === 'braid-crown') { cap(); rect(g, 7, 0, 16, 3, hair); for (let x = 7; x <= 16; x += 2) set(g, x, 0, 'A'); }
  else if (feature === 'round-glasses') { cap(); rect(g, 6, 7, 10, 11, 'K'); rect(g, 13, 7, 17, 11, 'K'); rect(g, 7, 8, 9, 10, skin); rect(g, 14, 8, 16, 10, skin); rect(g, 11, 9, 12, 9, 'K'); }
  else if (feature === 'high-pony') { cap(); rect(g, 15, 0, 18, 3, hair); rect(g, 18, 2, 20, 10, hair); }
  else if (feature === 'headwrap') { rect(g, 5, 2, 18, 7, 'P'); rect(g, 9, 0, 16, 3, 'p'); set(g, 18, 3, 'Y'); }
  else if (feature === 'square-bob') { rect(g, 5, 2, 18, 10, hair); rect(g, 7, 6, 16, 10, skin); }
  else if (feature === 'long-braid') { cap(); rect(g, 17, 8, 20, 22, hair); for (let y = 9; y < 22; y += 3) set(g, 18, y, 'A'); }
  else if (feature === 'pompadour') { rect(g, 4, 1, 17, 6, hair); rect(g, 7, 0, 15, 2, hair); rect(g, 6, 5, 17, 6, hair); rect(g, 10, 11, 13, 12, hair); }
  else if (feature === 'blunt-bob') { rect(g, 5, 2, 18, 8, hair); rect(g, 5, 7, 7, 13, hair); rect(g, 16, 7, 18, 13, hair); rect(g, 7, 6, 16, 6, 'K'); }
  else if (feature === 'curl-halo' || feature === 'wild-curls') { for (let y = 1; y <= 9; y += 2) for (let x = 4; x <= 19; x += 3) { set(g, x, y, hair); set(g, x + 1, y, hair); set(g, x, y + 1, hair); } }
  else if (feature === 'loc-bun') { cap(); rect(g, 9, 0, 15, 3, hair); for (let x = 5; x <= 18; x += 3) rect(g, x, 6, x + 1, 13, hair); }
  else if (feature === 'giant-beard') { cap(); rect(g, 5, 10, 18, 16, hair); rect(g, 9, 11, 14, 12, skin); rect(g, 10, 14, 13, 14, 'K'); }
  else if (feature === 'silver-pixie') { rect(g, 6, 2, 17, 6, hair); for (let x = 7; x <= 16; x += 3) set(g, x, 0, hair); }
  else if (feature === 'strong-brows') { rect(g, 7, 3, 16, 5, hair); rect(g, 7, 7, 10, 7, hair); rect(g, 13, 7, 16, 7, hair); }
  else if (feature === 'angle-glasses') { cap(); line(g, 6, 8, 10, 10, 'K'); line(g, 13, 10, 17, 8, 'K'); rect(g, 11, 9, 12, 9, 'K'); }
  else if (feature === 'salt-pepper-fade') { rect(g, 7, 2, 16, 6, hair); rect(g, 6, 5, 8, 8, 'A'); rect(g, 15, 5, 17, 8, 'A'); set(g, 10, 2, 'A'); set(g, 13, 3, 'A'); }
  else if (feature === 'side-shave-curls') { rect(g, 11, 2, 18, 7, hair); for (let x = 11; x <= 18; x += 2) set(g, x, 1, hair); rect(g, 5, 5, 10, 6, skin); rect(g, 5, 7, 6, 10, 'k'); }
  else if (feature === 'silver-roll') { rect(g, 5, 2, 18, 6, 'A'); rect(g, 4, 0, 13, 3, 'A'); rect(g, 5, 0, 10, 1, 'W'); }
  else if (feature === 'cat-eye-glasses') { cap(); line(g, 5, 8, 9, 7, 'K'); line(g, 9, 7, 10, 10, 'K'); line(g, 13, 10, 14, 7, 'K'); line(g, 14, 7, 18, 8, 'K'); rect(g, 11, 8, 12, 8, 'K'); }
  else if (feature === 'bald-moustache') { rect(g, 7, 3, 16, 5, skin); rect(g, 6, 5, 7, 9, hair); rect(g, 16, 5, 17, 9, hair); rect(g, 9, 11, 14, 12, hair); set(g, 9, 12, 'K'); set(g, 14, 12, 'K'); }
  else if (feature === 'shoulder-braid') { cap(); rect(g, 17, 7, 20, 24, hair); for (let y = 8; y <= 23; y += 3) set(g, 18, y, 'A'); }
  else if (feature === 'close-crop-beard') { rect(g, 7, 2, 16, 5, hair); for (let x = 8; x <= 15; x += 2) set(g, x, 2, 'A'); rect(g, 6, 11, 17, 15, hair); rect(g, 9, 11, 14, 12, skin); }
  else if (feature === 'white-streak') { cap(); line(g, 7, 2, 12, 6, 'A'); line(g, 8, 2, 13, 6, 'A'); }
  else if (feature === 'wavy-bob') { rect(g, 5, 2, 18, 10, hair); for (let y = 3; y <= 9; y += 3) { set(g, 4, y, 'A'); set(g, 19, y + 1, 'A'); } rect(g, 7, 6, 16, 10, skin); }
  else if (feature === 'scarf-bun') { rect(g, 6, 3, 17, 7, hair); rect(g, 10, 0, 15, 3, hair); rect(g, 5, 5, 18, 6, 'P'); set(g, 18, 7, 'p'); set(g, 19, 8, 'P'); }
  else if (feature === 'flat-cap') { rect(g, 5, 2, 17, 6, 'A'); rect(g, 4, 5, 19, 7, 'k'); rect(g, 6, 3, 10, 4, 'W'); }
  else if (feature === 'curly-pixie') { for (let y = 1; y <= 6; y += 2) for (let x = 6; x <= 17; x += 3) { set(g, x, y, hair); set(g, x + 1, y, hair); set(g, x, y + 1, hair); } set(g, 5, 5, hair); }
  else if (feature === 'half-rim-glasses') { cap(); rect(g, 6, 7, 10, 8, 'K'); rect(g, 13, 7, 17, 8, 'K'); set(g, 6, 9, 'K'); set(g, 17, 9, 'K'); rect(g, 11, 8, 12, 8, 'K'); }
  else if (feature === 'swept-silver') { rect(g, 6, 3, 16, 6, 'A'); rect(g, 3, 4, 7, 7, 'A'); rect(g, 7, 2, 12, 3, 'W'); }
  else if (feature === 'visor-crop') { rect(g, 7, 2, 16, 6, hair); rect(g, 5, 6, 18, 8, 'B'); rect(g, 6, 7, 17, 8, 'b'); }
  else if (feature === 'twin-braids') { cap(); rect(g, 4, 7, 6, 21, hair); rect(g, 17, 7, 19, 21, hair); for (let y = 8; y <= 20; y += 4) { set(g, 5, y, 'A'); set(g, 18, y, 'A'); } }
  else { cap(); set(g, 6, 4, 'Y'); set(g, 18, 5, 'Y'); set(g, 5, 6, 'Y'); set(g, 17, 3, 'Y'); }
}

function facility(type, level) {
  const g = grid(32, 32);
  rect(g, 3, 27, 28, 29, 'G'); rect(g, 5, 12, 26, 26, 'C'); rect(g, 7, 14, 24, 25, 'W');
  line(g, 4, 12, 15, 5, 'R'); line(g, 15, 5, 27, 12, 'R'); rect(g, 5, 11, 26, 13, 'r');
  rect(g, 13, 20, 18, 26, 'D'); rect(g, 7, 17, 10, 21, 'B'); rect(g, 21, 17, 24, 21, 'B');
  if (level >= 2) { rect(g, 2, 18, 5, 26, 'c'); rect(g, 26, 18, 29, 26, 'c'); set(g, 28, 16, 'Y'); }
  if (level >= 3) { rect(g, 12, 7, 19, 10, 'Y'); rect(g, 14, 8, 17, 9, 'W'); line(g, 27, 12, 29, 4, 'k'); set(g, 30, 4, 'Y'); }
  facilityMark(g, type);
  return [`facility:${type}:l${level}`, rows(g)];
}

function facilityMark(g, type) {
  if (type === 'training-pitch' || type === 'youth-field') { rect(g, 8, 22, 23, 25, 'G'); rect(g, 10, 19, 21, 22, 'W'); rect(g, 11, 20, 20, 22, '.'); }
  else if (type === 'gym') { rect(g, 9, 19, 22, 21, 'K'); rect(g, 7, 17, 9, 23, 'k'); rect(g, 22, 17, 24, 23, 'k'); }
  else if (type === 'tech-center') { rect(g, 9, 17, 22, 23, 'B'); rect(g, 11, 19, 20, 21, 'b'); rect(g, 14, 24, 17, 25, 'K'); }
  else if (type === 'shooting-range') { rect(g, 11, 16, 20, 25, 'W'); rect(g, 13, 18, 18, 23, 'R'); rect(g, 15, 20, 16, 21, 'Y'); }
  else if (type === 'keeper-court') { rect(g, 9, 17, 22, 24, 'W'); rect(g, 10, 18, 21, 24, '.'); line(g, 10, 18, 21, 24, 'A'); line(g, 21, 18, 10, 24, 'A'); }
  else if (type === 'medical-bay') { rect(g, 13, 16, 18, 25, 'R'); rect(g, 9, 19, 22, 22, 'R'); }
  else if (type === 'dorm') { rect(g, 8, 20, 23, 24, 'B'); rect(g, 9, 18, 13, 20, 'W'); rect(g, 8, 24, 9, 26, 'D'); rect(g, 22, 24, 23, 26, 'D'); }
  else if (type === 'scout-office') { rect(g, 9, 18, 13, 23, 'b'); rect(g, 18, 18, 22, 23, 'b'); rect(g, 13, 20, 18, 21, 'K'); }
  else if (type === 'coaching-office') { rect(g, 9, 16, 22, 23, 'G'); line(g, 11, 21, 20, 18, 'W'); set(g, 16, 19, 'Y'); }
  else if (type === 'fan-shop') { for (let x = 7; x <= 24; x += 4) rect(g, x, 16, x + 1, 20, x % 8 === 3 ? 'B' : 'R'); rect(g, 8, 21, 23, 24, 'Y'); }
  else if (type === 'stadium-stand') { for (let y = 17; y <= 24; y += 3) rect(g, 7, y, 24, y + 1, y % 2 ? 'B' : 'R'); line(g, 24, 16, 27, 7, 'k'); }
}

function worksite() {
  const g = grid(32, 32); rect(g, 3, 27, 28, 29, 'G'); rect(g, 6, 21, 25, 26, 'c');
  line(g, 7, 22, 12, 10, 'D'); line(g, 24, 22, 19, 10, 'D'); rect(g, 10, 12, 21, 14, 'D');
  for (let x = 5; x <= 26; x += 4) { rect(g, x, 23, x + 1, 27, 'Y'); set(g, x + 1, 24, 'K'); }
  return ['facility:worksite', rows(g)];
}

const sprites = Object.fromEntries([
  ...COACHES.flatMap(spec => [coach(spec, false), coach(spec, true)]),
  ...FACILITIES.flatMap(type => [1, 2, 3].map(level => facility(type, level))),
  worksite(),
]);

if (COACHES.length !== 32) throw new Error(`expected 32 curated coaches, received ${COACHES.length}`);
for (const spec of COACHES) {
  if (!Number.isInteger(spec.age) || spec.age < 30 || spec.age > 60) {
    throw new Error(`${spec.id} coach age must be 30 to 60`);
  }
  if (!COACH_WARDROBES.includes(spec.wardrobe)) {
    throw new Error(`${spec.id} has unknown coach wardrobe ${spec.wardrobe}`);
  }
}
const usedWardrobes = new Set(COACHES.map(spec => spec.wardrobe));
if (usedWardrobes.size !== COACH_WARDROBES.length) {
  throw new Error(`expected all ${COACH_WARDROBES.length} coach wardrobes to be represented`);
}
const restingCoaches = COACHES.map(spec => JSON.stringify(sprites[`coach:${spec.id}:rest`]));
if (new Set(restingCoaches).size !== COACHES.length) throw new Error('coach resting portraits must all be unique');

for (const [key, spriteRows] of Object.entries(sprites)) for (const row of spriteRows) for (const char of row) {
  if (!(char in PALETTE)) throw new Error(`${key} uses unknown palette key ${char}`);
}

const out = resolve(scriptDirectory, '../src/render/sprites/management-sprites.json');
writeFileSync(out, `${JSON.stringify({ palette: PALETTE, sprites }, null, 2)}\n`);
console.log(`wrote ${out} (${Object.keys(sprites).length} management sprites)`);
