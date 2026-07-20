import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE = {
  '.': null, K: '#241f2e', k: '#493d50', W: '#fff5dc', C: '#f4e7c5', c: '#d4bd91',
  D: '#6f5033', B: '#315a86', b: '#1f3e63', R: '#bb4b45', r: '#74332f',
  G: '#65a86f', g: '#356840', Y: '#f2c94c', y: '#b88424', P: '#8c65a8',
  p: '#59446d', S: '#f7d7ba', s: '#c98662', M: '#bd7c56', m: '#7f4935',
  N: '#8a4f38', n: '#5c3329', H: '#43332e', h: '#241d1a', A: '#c5c1ca',
};

const COACHES = [
  ['amara-okafor', 'N', 'H', 'braid-crown', 'Y'],
  ['kenji-sato', 'S', 'A', 'round-glasses', 'B'],
  ['valentina-cruz', 'M', 'H', 'high-pony', 'R'],
  ['imani-adeyemi', 'N', 'H', 'headwrap', 'P'],
  ['freja-lindholm', 'S', 'A', 'square-bob', 'G'],
  ['priya-nair', 'M', 'H', 'long-braid', 'Y'],
  ['mateo-silva', 'M', 'D', 'pompadour', 'R'],
  ['hana-park', 'S', 'H', 'blunt-bob', 'B'],
  ['leila-haddad', 'M', 'H', 'curl-halo', 'P'],
  ['nia-thompson', 'N', 'H', 'loc-bun', 'G'],
  ['tomas-ferreira', 'M', 'H', 'giant-beard', 'R'],
  ['aiko-tanaka', 'S', 'A', 'silver-pixie', 'B'],
  ['sibusiso-dlamini', 'N', 'H', 'strong-brows', 'Y'],
  ['sofia-rossi', 'S', 'D', 'wild-curls', 'G'],
  ['jamal-rahman', 'M', 'H', 'angle-glasses', 'P'],
  ['mei-chen', 'S', 'H', 'hair-pins', 'R'],
];

const FACILITIES = [
  'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
  'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
  'fan-shop', 'stadium-stand', 'hero-lab',
];

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

function coach([id, skin, hair, feature, accent], joy) {
  const g = grid(24, 29);
  rect(g, 6, 4, 17, 14, skin); rect(g, 7, 3, 16, 15, skin);
  rect(g, 8, 8, 9, 9, 'K'); rect(g, 14, 8, 15, 9, 'K');
  if (joy) { set(g, 9, 9, skin); set(g, 15, 9, skin); rect(g, 10, 12, 13, 13, 'W'); }
  else rect(g, 11, 12, 12, 12, 'K');
  rect(g, 5, 17, 18, 27, accent); rect(g, 8, 17, 15, 27, 'C');
  rect(g, 10, 17, 13, 24, 'W'); rect(g, 11, 20, 12, 25, 'K');
  rect(g, 4, 19, 6, 25, accent); rect(g, 17, 19, 19, 25, accent);
  rect(g, 5, 26, 9, 27, 'k'); rect(g, 14, 26, 18, 27, 'k');
  hairFeature(g, feature, hair, skin);
  return [`coach:${id}:${joy ? 'joy' : 'rest'}`, rows(g)];
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
  else if (type === 'hero-lab') { rect(g, 9, 15, 22, 25, 'P'); line(g, 15, 15, 12, 21, 'Y'); line(g, 12, 21, 18, 20, 'Y'); line(g, 18, 20, 15, 25, 'Y'); }
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

for (const [key, spriteRows] of Object.entries(sprites)) for (const row of spriteRows) for (const char of row) {
  if (!(char in PALETTE)) throw new Error(`${key} uses unknown palette key ${char}`);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/render/sprites/management-sprites.json');
writeFileSync(out, `${JSON.stringify({ palette: PALETTE, sprites }, null, 2)}\n`);
console.log(`wrote ${out} (${Object.keys(sprites).length} management sprites)`);
