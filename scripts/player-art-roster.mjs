// Shared source of truth for player portraits and match-day sprites.
// The generators import this module so a player's face, hair, skin tone, and
// build stay identical between management screens and the pitch.

export const PLAYER_CELL = { w: 24, h: 30 };
export const PORTRAIT_CELL = { w: 24, h: 29 };

// 23 colours + transparency: the existing mobile atlas budget.
export const PLAYER_PALETTE = {
  '.': null,
  K: '#241f2e',
  d: '#8a4f38', m: '#a86a42', n: '#cf9268', S: '#eab48c', L: '#f7d7ba',
  h: '#6a4326', H: '#8a5a30', J: '#a9743d',
  g: '#7d7887', G: '#b9b4c2',
  F: '#ff6a00',
  o: '#7a2731', r: '#c22f2c', R: '#e8433f', E: '#f2938c',
  b: '#2f55b8', B: '#3f6fd8', C: '#a3c8f0',
  w: '#d9d5cf', W: '#ffffff',
  T: '#1d9e75', A: '#ba7517',
};

const SKIN = {
  fair: { sh: 'n', base: 'S', hi: 'L' },
  warm: { sh: 'm', base: 'n', hi: 'S' },
  brown: { sh: 'd', base: 'm', hi: 'n' },
  deep: { sh: 'h', base: 'd', hi: 'm' },
  created0: { sh: 'S', base: 'L', hi: 'L' },
  created1: { sh: 'n', base: 'S', hi: 'L' },
  created2: { sh: 'm', base: 'n', hi: 'S' },
  created3: { sh: 'd', base: 'm', hi: 'n' },
  created4: { sh: 'h', base: 'd', hi: 'm' },
  created5: { sh: 'h', base: 'h', hi: 'd' },
};

const HAIR = {
  // Natural black: a black mass with sparse warm highlights so it stays
  // readable against the dark outline without appearing brown overall.
  black: { d: 'K', b: 'K', l: 'h' },
  brown: { d: 'h', b: 'H', l: 'J' },
  dark: { d: 'K', b: 'h', l: 'H' },
  grey: { d: 'g', b: 'g', l: 'G' },
  blond: { d: 'A', b: 'J', l: 'W' },
  auburn: { d: 'o', b: 'H', l: 'J' },
  platinum: { d: 'g', b: 'G', l: 'W' },
  fire: { d: 'o', b: 'R', l: 'F' },
  electricblue: { d: 'b', b: 'B', l: 'C' },
  teal: { d: 'b', b: 'T', l: 'C' },
  hotpink: { d: 'o', b: 'R', l: 'E' },
  neonorange: { d: 'o', b: 'F', l: 'J' },
  bleachblond: { d: 'A', b: 'J', l: 'W' },
  bleachsilver: { d: 'g', b: 'G', l: 'W' },
};

const FACE_VARIANTS = [
  { shape: 'classic', eyes: 'normal', mouth: 'smile' },
  { shape: 'wide', eyes: 'beady', mouth: 'smile', brow: true },
  { shape: 'narrow', eyes: 'narrow', mouth: 'smile' },
  { shape: 'round', eyes: 'big', mouth: 'smile' },
  { shape: 'long', eyes: 'normal', mouth: 'smile' },
  { shape: 'classic', eyes: 'beady', mouth: 'smile' },
];

// The first twenty field looks and first two goalkeeper looks preserve the
// original named cast. The remaining looks form the large career pool.
const LEGACY_FIELD_LOOKS = [
  ['warm', 'dark', 'flattop', 'normal', 0],
  ['deep', 'dark', 'curls', 'normal', 3],
  ['brown', 'dark', 'shaved', 'muscular', 1],
  ['fair', 'brown', 'sidefringe', 'normal', 0],
  ['warm', 'dark', 'headband', 'normal', 2],
  ['fair', 'grey', 'grey', 'normal', 4],
  ['warm', 'dark', 'spiky', 'normal', 3],
  ['brown', 'dark', 'ponytail', 'normal', 2],
  ['fair', 'fire', 'fire', 'normal', 3],
  ['deep', 'dark', 'swept', 'slim', 2],
  ['fair', 'brown', 'blondtips', 'normal', 0],
  ['fair', 'brown', 'beard', 'muscular', 1],
  ['warm', 'dark', 'enforcer', 'muscular', 1],
  ['deep', 'dark', 'moustache', 'normal', 5],
  ['warm', 'dark', 'tuft', 'slim', 2],
  ['fair', 'brown', 'round', 'normal', 3],
  ['fair', 'grey', 'slatecrop', 'normal', 4],
  ['brown', 'dark', 'undercut', 'normal', 2],
  ['deep', 'dark', 'bull', 'muscular', 1],
  ['warm', 'dark', 'mohawk', 'normal', 3],
];

const EXTRA_FEATURES = [
  'afro', 'locs', 'boxbraids', 'topknot', 'buzzline', 'curtains', 'waves',
  'doublebun', 'longside', 'quiff', 'bandana', 'headwrap', 'fauxhawk',
  'sidebraid', 'curlhalo', 'highfade', 'crewcut', 'widowpeak', 'puffs',
  'braidcrown', 'sidepart', 'shag', 'microbraids', 'beadedlocs', 'wavecrest',
  'lowpony', 'templefade', 'bigfringe', 'softcrop', 'twists', 'baldstripe',
  'chinbeard', 'roundglasses', 'sportsvisor', 'hairclips', 'minibuns',
  'earstud', 'hoopearring', 'browscar', 'cheekscar', 'eyebrowslit',
  'bigforehead', 'highhairline', 'recedingtemples', 'shavedmohawk',
  'braidedmohawk', 'handlebarmoustache', 'goatee', 'sideburns',
  'browbandage', 'beautymark', 'thickheadband', 'cornrows', 'mullet',
  'dreadhawk', 'asymfringe', 'hightop', 'chinstrap', 'nosebridge',
  'doubleearstud',
];

const SKIN_SEQUENCE = ['deep', 'warm', 'brown', 'fair'];
// Career players default to believable natural colours. Statement dyes and
// bleach jobs are deliberately assigned below so they remain memorable and
// rare instead of appearing as random palette noise.
const HAIR_SEQUENCE = ['dark', 'brown', 'dark', 'brown', 'dark', 'auburn', 'brown', 'dark'];
const BUILD_SEQUENCE = ['normal', 'slim', 'muscular'];
const GENERATED_FIELD_LOOK_COUNT = 140;
const GENERATED_GOALKEEPER_LOOK_COUNT = 24;

function generatedLook(index, role, featurePool, salt) {
  const cycle = Math.floor(index / featurePool.length);
  return {
    role,
    skin: SKIN_SEQUENCE[(index * 3 + cycle + salt) % SKIN_SEQUENCE.length],
    hair: HAIR_SEQUENCE[(index * 5 + cycle * 2 + salt) % HAIR_SEQUENCE.length],
    feature: featurePool[index % featurePool.length],
    build: BUILD_SEQUENCE[(index * 7 + cycle + salt) % BUILD_SEQUENCE.length],
    face: (index * 5 + cycle * 3 + salt) % FACE_VARIANTS.length,
  };
}

function headDna(look) {
  return `${look.skin}|${look.hair}|${look.feature}|${look.face}`;
}

const generatedFieldPlayerLooks = [
  ...LEGACY_FIELD_LOOKS.map(([skin, hair, feature, build, face], index) => ({
    id: `f${String(index).padStart(2, '0')}`,
    role: 'field', skin, hair, feature, build, face,
  })),
  ...Array.from({ length: GENERATED_FIELD_LOOK_COUNT - LEGACY_FIELD_LOOKS.length }, (_, offset) => {
    const index = offset + LEGACY_FIELD_LOOKS.length;
    return {
      ...generatedLook(offset, 'field', EXTRA_FEATURES, 0),
      id: `f${String(index).padStart(2, '0')}`,
    };
  }),
];

// Owner-reviewed replacements for six faces that read oddly in the roster
// contact sheet. These stay in the shared generator so portrait expressions
// and every match-day pose retain the exact same identity.
const REVIEWED_ASIAN_FIELD_LOOKS = {
  f05: {
    skin: 'fair', hair: 'black', feature: 'bowlcut', build: 'normal', face: 2,
    eyes: 'angled-small', mouth: 'toothsmile',
  },
  f74: {
    skin: 'warm', hair: 'black', feature: 'longstraight', build: 'slim', face: 0,
    eyes: 'angled', mouth: 'smile',
  },
  f81: {
    skin: 'fair', hair: 'black', feature: 'sleeklong', build: 'normal', face: 3,
    eyes: 'angled-small', mouth: 'toothsmile',
  },
  f82: {
    skin: 'warm', hair: 'black', feature: 'topknot', build: 'slim', face: 5,
    eyes: 'angled', mouth: 'toothsmile',
  },
  f110: {
    skin: 'fair', hair: 'black', feature: 'softcrop', build: 'normal', face: 2,
    eyes: 'angled-small', mouth: 'toothsmile',
  },
  f134: {
    skin: 'fair', hair: 'black', feature: 'sidepart', build: 'muscular', face: 4,
    eyes: 'angled', mouth: 'smile',
  },
};

const CURATED_HAIR_COLOUR_BY_ID = {
  // Bright, intentionally dyed looks.
  f27: 'hotpink',
  f29: 'electricblue',
  f33: 'teal',
  f64: 'neonorange',
  f75: 'electricblue',
  f92: 'hotpink',
  f124: 'teal',
  f135: 'hotpink',
  // Scarcer bleach treatments.
  f23: 'bleachblond',
  f65: 'bleachblond',
  f95: 'bleachblond',
  f45: 'bleachsilver',
  f89: 'bleachsilver',
  f125: 'bleachsilver',
};

const baseFieldPlayerLooks = generatedFieldPlayerLooks.map(look => ({
  ...look,
  ...(REVIEWED_ASIAN_FIELD_LOOKS[look.id] ?? {}),
  ...(CURATED_HAIR_COLOUR_BY_ID[look.id]
    ? { hair: CURATED_HAIR_COLOUR_BY_ID[look.id] }
    : {}),
}));

// Development references use famous football silhouettes, but the shipped
// characters remain fictional: no real names, badges, kit designs, or exact
// portrait copies. Each homage exaggerates one era-defining visual cue.
const FOOTBALL_HOMAGE_FIELD_LOOKS = [
  { id: 'f140', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-cropbeard', build: 'normal', face: 3, mouth: 'toothsmile' },
  { id: 'f141', role: 'field', skin: 'deep', hair: 'black', feature: 'icon-closecurl', build: 'normal', face: 0, mouth: 'toothsmile' },
  { id: 'f142', role: 'field', skin: 'warm', hair: 'black', feature: 'icon-volumecurls', build: 'muscular', face: 3, eyes: 'beady', mouth: 'toothsmile' },
  { id: 'f143', role: 'field', skin: 'warm', hair: 'black', feature: 'icon-gelquiff', build: 'muscular', face: 4, eyes: 'narrow', mouth: 'toothsmile' },
  { id: 'f144', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-shag70s', build: 'slim', face: 4, eyes: 'narrow' },
  { id: 'f145', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-featherpart', build: 'normal', face: 0 },
  { id: 'f146', role: 'field', skin: 'fair', hair: 'dark', feature: 'icon-slickback', build: 'muscular', face: 4 },
  { id: 'f147', role: 'field', skin: 'brown', hair: 'black', feature: 'icon-crescentfringe', build: 'muscular', face: 3, eyes: 'normal', mouth: 'toothsmile' },
  { id: 'f148', role: 'field', skin: 'warm', hair: 'black', feature: 'icon-cleanbald', build: 'normal', face: 4, eyes: 'beady' },
  { id: 'f149', role: 'field', skin: 'fair', hair: 'dark', feature: 'icon-thickwave', build: 'muscular', face: 1 },
  { id: 'f150', role: 'field', skin: 'brown', hair: 'black', feature: 'icon-sidewave', build: 'slim', face: 2 },
  { id: 'f151', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-curlypart', build: 'normal', face: 4 },
  { id: 'f152', role: 'field', skin: 'warm', hair: 'dark', feature: 'icon-centrelong', build: 'muscular', face: 4, eyes: 'narrow' },
  { id: 'f153', role: 'field', skin: 'warm', hair: 'black', feature: 'icon-tidyfringe', build: 'normal', face: 0, eyes: 'beady' },
  { id: 'f154', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-highbald', build: 'slim', face: 1, eyes: 'beady' },
  { id: 'f155', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-heavy70s', build: 'muscular', face: 1 },
  { id: 'f156', role: 'field', skin: 'deep', hair: 'black', feature: 'icon-tightcurl', build: 'muscular', face: 0, mouth: 'toothsmile' },
  { id: 'f157', role: 'field', skin: 'brown', hair: 'black', feature: 'icon-headbandbraids', build: 'slim', face: 4, mouth: 'toothsmile' },
  { id: 'f158', role: 'field', skin: 'fair', hair: 'brown', feature: 'icon-dutchsweep', build: 'slim', face: 4 },
  { id: 'f159', role: 'field', skin: 'deep', hair: 'black', feature: 'star-closefade', build: 'slim', face: 2, mouth: 'toothsmile' },
  { id: 'f160', role: 'field', skin: 'brown', hair: 'black', feature: 'star-youthcurlfade', build: 'slim', face: 3, eyes: 'big', mouth: 'toothsmile' },
  { id: 'f161', role: 'field', skin: 'deep', hair: 'black', feature: 'star-cleanbuzz', build: 'muscular', face: 3, eyes: 'beady', mouth: 'toothsmile' },
  { id: 'f162', role: 'field', skin: 'warm', hair: 'black', feature: 'star-curlybeard', build: 'muscular', face: 1, mouth: 'toothsmile' },
  { id: 'f163', role: 'field', skin: 'brown', hair: 'bleachblond', feature: 'star-bleachcrop', build: 'slim', face: 2, mouth: 'toothsmile' },
  { id: 'f164', role: 'field', skin: 'deep', hair: 'black', feature: 'star-highfadecurls', build: 'slim', face: 3, eyes: 'beady', mouth: 'toothsmile' },
  { id: 'f165', role: 'field', skin: 'fair', hair: 'bleachblond', feature: 'star-blondlowpony', build: 'muscular', face: 4, eyes: 'narrow' },
  { id: 'f166', role: 'field', skin: 'brown', hair: 'black', feature: 'star-texturedfade', build: 'muscular', face: 0, mouth: 'toothsmile' },
  { id: 'f167', role: 'field', skin: 'fair', hair: 'brown', feature: 'star-sidecropstubble', build: 'muscular', face: 4 },
];

export const FIELD_PLAYER_LOOKS = [
  ...baseFieldPlayerLooks,
  ...FOOTBALL_HOMAGE_FIELD_LOOKS,
];

const CREATED_HAIRSTYLES = [
  'flattop', 'curls', 'shaved', 'sidefringe', 'ponytail', 'afro', 'mohawk',
  'braidcrown', 'twists', 'topknot',
];
const CREATED_KIT_ACCENT_COUNT = 4;

// The first-hire paper doll is deliberately separate from the career roster.
// Every combination keeps the same face and body; only the selected skin,
// hairstyle, or kit accent is allowed to change.
export const CREATED_PLAYER_LOOKS = Array.from({ length: 6 * CREATED_HAIRSTYLES.length * CREATED_KIT_ACCENT_COUNT }, (_, index) => {
  const skinTone = Math.floor(index / (CREATED_HAIRSTYLES.length * CREATED_KIT_ACCENT_COUNT));
  const hairstyle = Math.floor((index % (CREATED_HAIRSTYLES.length * CREATED_KIT_ACCENT_COUNT)) / CREATED_KIT_ACCENT_COUNT);
  const kitAccent = index % CREATED_KIT_ACCENT_COUNT;
  return {
    id: `c${String(index).padStart(3, '0')}`,
    role: 'field',
    skin: `created${skinTone}`,
    hair: 'black',
    feature: CREATED_HAIRSTYLES[hairstyle],
    build: 'normal',
    face: 0,
    eyes: 'normal',
    mouth: 'smile',
    kitAccent,
  };
});

const GOALKEEPER_EXTRA_FEATURES = [...new Set([
  'curls', 'shaved', 'sidefringe', 'headband', 'ponytail', 'swept', 'undercut',
  ...EXTRA_FEATURES,
])];
const goalkeeperLooks = [
  { id: 'g00', role: 'goalkeeper', skin: 'fair', hair: 'brown', feature: 'cap', build: 'normal', face: 0 },
  { id: 'g01', role: 'goalkeeper', skin: 'brown', hair: 'dark', feature: 'cap', build: 'slim', face: 5 },
];
const usedHeadDna = new Set([...FIELD_PLAYER_LOOKS, ...goalkeeperLooks].map(headDna));
for (let offset = 0; goalkeeperLooks.length < GENERATED_GOALKEEPER_LOOK_COUNT; offset += 1) {
  const candidate = generatedLook(offset, 'goalkeeper', GOALKEEPER_EXTRA_FEATURES, 11);
  if (usedHeadDna.has(headDna(candidate))) continue;
  usedHeadDna.add(headDna(candidate));
  goalkeeperLooks.push({
    ...candidate,
    id: `g${String(goalkeeperLooks.length).padStart(2, '0')}`,
  });
}
export const GOALKEEPER_LOOKS = [
  ...goalkeeperLooks,
  { id: 'g24', role: 'goalkeeper', skin: 'fair', hair: 'black', feature: 'icon-keepercap', build: 'normal', face: 4, eyes: 'beady' },
];

export const PLAYER_LOOK_MANIFEST = {
  field: FIELD_PLAYER_LOOKS.map(look => look.id),
  goalkeeper: GOALKEEPER_LOOKS.map(look => look.id),
  created: CREATED_PLAYER_LOOKS.map(look => look.id),
  legacy: {
    r0: 'g00', u0: 'g01',
    r1: 'f00', r2: 'f01', r3: 'f02', r4: 'f03', r5: 'f04',
    r6: 'f05', r7: 'f06', r8: 'f07', r9: 'f08', r10: 'f09',
    u1: 'f10', u2: 'f11', u3: 'f12', u4: 'f13', u5: 'f14',
    u6: 'f15', u7: 'f16', u8: 'f17', u9: 'f18', u10: 'f19',
  },
};

function grid(height) {
  return Array.from({ length: height }, () => Array(PLAYER_CELL.w).fill('.'));
}

function set(g, x, y, value) {
  if (g[y]?.[x] !== undefined) g[y][x] = value;
}

function rect(g, x0, y0, x1, y1, value) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(g, x, y, value);
}

function line(g, x0, y0, x1, y1, value) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let index = 0; index <= steps; index += 1) {
    set(
      g,
      Math.round(x0 + (x1 - x0) * index / steps),
      Math.round(y0 + (y1 - y0) * index / steps),
      value,
    );
  }
}

function outline(g) {
  const add = [];
  for (let y = 0; y < g.length; y += 1) for (let x = 0; x < PLAYER_CELL.w; x += 1) {
    if (g[y][x] !== '.') continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const value = g[y + dy]?.[x + dx];
      return value !== undefined && value !== '.' && value !== 'K';
    });
    if (near) add.push([x, y]);
  }
  add.forEach(([x, y]) => { g[y][x] = 'K'; });
}

function face(g, sk, variantIndex, expression = 'rest', appearance = {}) {
  const variant = FACE_VARIANTS[variantIndex % FACE_VARIANTS.length];
  const shape = appearance.shape ?? variant.shape;
  const bounds = shape === 'wide'
    ? { left: 5, right: 18, top: 5, bottom: 14 }
    : shape === 'narrow'
      ? { left: 7, right: 16, top: 5, bottom: 13 }
      : shape === 'round'
        ? { left: 6, right: 17, top: 4, bottom: 14 }
        : shape === 'long'
          ? { left: 6, right: 17, top: 4, bottom: 15 }
          : { left: 6, right: 17, top: 5, bottom: 13 };
  rect(g, bounds.left, bounds.top, bounds.right, bounds.bottom, sk.base);
  set(g, bounds.left, bounds.top, '.'); set(g, bounds.right, bounds.top, '.');
  set(g, bounds.left, bounds.bottom, '.'); set(g, bounds.right, bounds.bottom, '.');
  set(g, bounds.left - 1, 9, sk.base); set(g, bounds.right + 1, 9, sk.base);
  set(g, bounds.left - 1, 10, sk.sh); set(g, bounds.right + 1, 10, sk.sh);
  rect(g, Math.max(7, bounds.left + 1), bounds.top + 1, Math.min(9, bounds.right - 1), bounds.top + 2, sk.hi);
  rect(g, Math.max(15, bounds.left + 1), 11, bounds.right, 12, sk.sh);
  set(g, 15, 13, sk.sh); set(g, 16, 13, sk.sh);
  rect(g, 10, Math.min(15, bounds.bottom + 1), 13, Math.min(15, bounds.bottom + 1), sk.sh);

  const eyes = expression === 'joy'
    ? 'happy'
    : expression === 'ko'
      ? 'x'
      : appearance.eyes ?? variant.eyes;
  if (eyes === 'beady') {
    set(g, 9, 9, 'K'); set(g, 14, 9, 'K');
  } else if (eyes === 'narrow') {
    rect(g, 8, 9, 9, 9, 'K'); rect(g, 14, 9, 15, 9, 'K');
  } else if (eyes === 'big') {
    rect(g, 7, 7, 9, 10, 'W'); rect(g, 14, 7, 16, 10, 'W');
    rect(g, 8, 9, 9, 10, 'K'); rect(g, 14, 9, 15, 10, 'K');
  } else if (eyes === 'angled-small') {
    set(g, 8, 8, 'K'); set(g, 9, 9, 'K');
    set(g, 15, 8, 'K'); set(g, 14, 9, 'K');
  } else if (eyes === 'angled') {
    set(g, 7, 8, 'K'); set(g, 8, 9, 'K'); set(g, 9, 9, 'K');
    set(g, 16, 8, 'K'); set(g, 15, 9, 'K'); set(g, 14, 9, 'K');
  } else if (eyes === 'happy') {
    set(g, 7, 9, 'K'); set(g, 8, 8, 'K'); set(g, 9, 9, 'K');
    set(g, 14, 9, 'K'); set(g, 15, 8, 'K'); set(g, 16, 9, 'K');
  } else if (eyes === 'x') {
    for (const [x, y] of [[7, 8], [9, 8], [8, 9], [7, 10], [9, 10], [14, 8], [16, 8], [15, 9], [14, 10], [16, 10]]) set(g, x, y, 'K');
  } else {
    rect(g, 8, 8, 9, 9, 'W'); rect(g, 14, 8, 15, 9, 'W');
    set(g, 9, 9, 'K'); set(g, 14, 9, 'K');
  }
  set(g, 11, 11, sk.sh); set(g, 12, 11, sk.sh);
  const mouth = expression === 'joy'
    ? 'grin'
    : expression === 'ko'
      ? 'grit'
      : appearance.mouth ?? variant.mouth;
  if (mouth === 'grit') {
    rect(g, 9, 12, 14, 12, 'K'); set(g, 10, 12, 'W'); set(g, 12, 12, 'W');
  } else if (mouth === 'grin') {
    rect(g, 9, 12, 14, 12, 'K'); rect(g, 10, 12, 13, 12, 'W');
  } else if (mouth === 'toothsmile') {
    rect(g, 9, 12, 14, 13, 'K'); rect(g, 10, 12, 13, 12, 'W');
    set(g, 11, 13, sk.sh); set(g, 12, 13, sk.sh);
  } else {
    rect(g, 10, 12, 13, 12, 'K');
  }
  if (variant.brow) {
    rect(g, 7, 7, 10, 7, 'K'); rect(g, 13, 7, 16, 7, 'K');
  }
}

function cap(g, hs, top = 2) {
  rect(g, 6, top + 2, 17, 6, hs.b); rect(g, 8, top, 15, top + 1, hs.b);
  rect(g, 7, top + 1, 16, top + 1, hs.b); rect(g, 7, top + 1, 9, top + 2, hs.l);
  rect(g, 6, 6, 17, 6, hs.d); set(g, 6, 7, hs.b); set(g, 17, 7, hs.b);
}

function curls(g, hs, left = 5, right = 18) {
  rect(g, left, 2, right, 6, hs.b);
  for (let x = left + 1; x < right; x += 2) set(g, x, 1, hs.b);
  for (let x = left; x <= right; x += 2) set(g, x, 2, hs.l);
  rect(g, 6, 6, 17, 6, hs.d); set(g, left, 7, hs.b); set(g, right, 7, hs.b);
}

// One silhouette move per look. Repeated feature families are paired with a
// different face shape, skin ramp, and build in the roster above.
function feature(g, kind, hs, sk) {
  switch (kind) {
    case 'cap': cap(g, hs); break;
    case 'flattop': rect(g, 6, 1, 17, 5, hs.b); rect(g, 7, 1, 9, 2, hs.l); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'curls': curls(g, hs); break;
    case 'shaved': rect(g, 7, 3, 16, 4, sk.base); rect(g, 6, 5, 17, 5, sk.base); rect(g, 6, 8, 6, 10, hs.d); rect(g, 17, 8, 17, 10, hs.d); break;
    case 'sidefringe': rect(g, 6, 2, 17, 5, hs.b); rect(g, 6, 6, 12, 7, hs.b); rect(g, 7, 2, 10, 3, hs.l); break;
    case 'headband': cap(g, hs); rect(g, 6, 5, 17, 5, 'R'); break;
    case 'grey': cap(g, hs); break;
    case 'spiky': rect(g, 6, 4, 17, 6, hs.b); for (let x = 7; x <= 15; x += 2) { set(g, x, 1, hs.b); set(g, x, 2, hs.l); set(g, x, 3, hs.b); } break;
    case 'ponytail': cap(g, hs); rect(g, 18, 5, 20, 10, hs.b); set(g, 20, 7, hs.l); break;
    case 'fire': rect(g, 6, 5, 17, 6, 'o'); for (let x = 7; x <= 15; x += 2) { rect(g, x, 0, x, 2, 'F'); rect(g, x, 3, x, 4, 'R'); } rect(g, 6, 5, 17, 5, 'R'); break;
    case 'swept': rect(g, 6, 3, 15, 6, hs.b); rect(g, 4, 5, 6, 7, hs.b); rect(g, 7, 3, 11, 4, hs.l); break;
    case 'blondtips': cap(g, hs); rect(g, 8, 2, 15, 2, 'W'); set(g, 7, 3, 'W'); set(g, 16, 3, 'W'); break;
    case 'beard': cap(g, hs); rect(g, 6, 11, 17, 14, hs.b); rect(g, 10, 12, 13, 12, 'K'); break;
    case 'enforcer': rect(g, 6, 2, 17, 5, hs.b); rect(g, 5, 12, 18, 14, sk.sh); for (let x = 6; x <= 16; x += 2) set(g, x, 13, hs.d); break;
    case 'moustache': cap(g, hs); rect(g, 9, 11, 14, 11, hs.d); set(g, 9, 12, hs.b); set(g, 14, 12, hs.b); break;
    case 'tuft': rect(g, 8, 3, 15, 6, hs.b); rect(g, 11, 0, 12, 2, hs.b); break;
    case 'round': cap(g, hs); set(g, 7, 11, 'E'); set(g, 16, 11, 'E'); break;
    case 'slatecrop': rect(g, 6, 3, 17, 6, hs.b); rect(g, 7, 3, 10, 4, hs.l); break;
    case 'undercut': rect(g, 7, 2, 16, 6, hs.b); rect(g, 8, 2, 11, 3, hs.l); rect(g, 7, 6, 16, 6, hs.d); break;
    case 'bull': cap(g, hs, 3); rect(g, 5, 2, 6, 4, hs.b); rect(g, 17, 2, 18, 4, hs.b); set(g, 5, 1, hs.l); set(g, 18, 1, hs.l); break;
    case 'mohawk': rect(g, 10, 0, 13, 6, hs.b); rect(g, 11, 0, 12, 3, hs.l); break;
    case 'afro': curls(g, hs, 3, 20); rect(g, 3, 5, 5, 11, hs.b); rect(g, 18, 5, 20, 11, hs.b); break;
    case 'locs': cap(g, hs); for (let x = 5; x <= 18; x += 3) rect(g, x, 5, x + 1, 13 + (x % 2), hs.b); break;
    case 'boxbraids': cap(g, hs); for (let x = 4; x <= 19; x += 3) { rect(g, x, 5, x, 14, hs.b); set(g, x, 8, hs.l); } break;
    case 'topknot': cap(g, hs); rect(g, 9, 0, 14, 3, hs.b); rect(g, 10, 0, 13, 1, hs.l); break;
    case 'bowlcut': rect(g, 6, 1, 17, 6, hs.b); rect(g, 5, 4, 18, 7, hs.b); rect(g, 5, 7, 7, 11, hs.b); rect(g, 16, 7, 18, 11, hs.b); rect(g, 7, 6, 16, 7, hs.d); rect(g, 7, 2, 10, 3, hs.l); break;
    case 'longstraight': cap(g, hs); rect(g, 4, 6, 6, 16, hs.b); rect(g, 17, 6, 19, 16, hs.b); rect(g, 5, 12, 7, 16, hs.d); rect(g, 16, 12, 18, 16, hs.d); set(g, 5, 7, hs.l); break;
    case 'sleeklong': rect(g, 6, 2, 17, 6, hs.b); rect(g, 6, 2, 10, 3, hs.l); rect(g, 5, 5, 7, 15, hs.b); rect(g, 16, 5, 19, 16, hs.b); line(g, 11, 2, 14, 6, sk.base); set(g, 18, 10, hs.l); break;
    case 'buzzline': rect(g, 7, 3, 16, 6, hs.d); rect(g, 7, 3, 14, 4, hs.b); rect(g, 8, 5, 15, 5, sk.base); break;
    case 'curtains': cap(g, hs); rect(g, 10, 4, 10, 8, sk.base); rect(g, 13, 4, 13, 8, sk.base); rect(g, 7, 6, 9, 9, hs.b); rect(g, 14, 6, 16, 9, hs.b); break;
    case 'waves': rect(g, 6, 3, 17, 6, hs.b); for (let x = 7; x <= 16; x += 3) set(g, x, 4, hs.l); break;
    case 'doublebun': cap(g, hs); rect(g, 3, 1, 7, 5, hs.b); rect(g, 16, 1, 20, 5, hs.b); set(g, 4, 2, hs.l); set(g, 17, 2, hs.l); break;
    case 'longside': cap(g, hs); rect(g, 4, 6, 6, 15, hs.b); rect(g, 17, 6, 19, 12, hs.b); break;
    case 'quiff': rect(g, 5, 2, 17, 6, hs.b); rect(g, 4, 0, 12, 3, hs.b); rect(g, 5, 0, 9, 1, hs.l); break;
    case 'bandana': cap(g, hs); rect(g, 5, 5, 18, 6, 'W'); rect(g, 18, 6, 21, 7, 'W'); break;
    case 'headwrap': rect(g, 5, 2, 18, 7, hs.b); rect(g, 9, 0, 16, 3, hs.l); set(g, 18, 3, 'W'); break;
    case 'fauxhawk': rect(g, 7, 4, 16, 6, hs.d); for (let y = 0; y <= 5; y += 1) rect(g, 11, y, 13, y, y % 2 ? hs.b : hs.l); break;
    case 'sidebraid': cap(g, hs); rect(g, 18, 6, 20, 16, hs.b); for (let y = 7; y <= 15; y += 3) set(g, 19, y, hs.l); break;
    case 'curlhalo': curls(g, hs, 4, 19); set(g, 3, 7, hs.b); set(g, 20, 7, hs.b); break;
    case 'highfade': rect(g, 8, 1, 15, 5, hs.b); rect(g, 6, 5, 17, 6, hs.d); rect(g, 9, 1, 12, 2, hs.l); break;
    case 'crewcut': rect(g, 7, 2, 16, 5, hs.b); for (let x = 8; x <= 15; x += 2) set(g, x, 2, hs.l); break;
    case 'widowpeak': cap(g, hs); set(g, 11, 7, hs.b); set(g, 12, 8, hs.b); break;
    case 'puffs': cap(g, hs); rect(g, 2, 3, 6, 8, hs.b); rect(g, 17, 3, 21, 8, hs.b); set(g, 3, 4, hs.l); set(g, 18, 4, hs.l); break;
    case 'braidcrown': cap(g, hs); rect(g, 7, 0, 16, 3, hs.b); for (let x = 7; x <= 16; x += 2) set(g, x, 0, hs.l); break;
    case 'sidepart': cap(g, hs); rect(g, 6, 2, 10, 3, hs.l); rect(g, 11, 2, 11, 6, sk.base); break;
    case 'shag': cap(g, hs); rect(g, 4, 5, 6, 11, hs.b); rect(g, 17, 5, 19, 13, hs.b); set(g, 5, 12, hs.l); break;
    case 'microbraids': cap(g, hs); for (let x = 5; x <= 18; x += 2) { rect(g, x, 6, x, 13, hs.b); set(g, x, 10, hs.l); } break;
    case 'beadedlocs': cap(g, hs); for (let x = 4; x <= 19; x += 3) { rect(g, x, 6, x + 1, 14, hs.b); set(g, x, 13, 'W'); } break;
    case 'wavecrest': rect(g, 5, 3, 18, 6, hs.b); rect(g, 4, 1, 10, 4, hs.b); rect(g, 5, 1, 8, 2, hs.l); break;
    case 'lowpony': cap(g, hs); rect(g, 18, 8, 20, 14, hs.b); rect(g, 19, 12, 21, 16, hs.b); break;
    case 'templefade': rect(g, 8, 2, 15, 6, hs.b); rect(g, 6, 5, 8, 8, hs.d); rect(g, 15, 5, 17, 8, hs.d); break;
    case 'bigfringe': cap(g, hs); rect(g, 5, 5, 13, 9, hs.b); rect(g, 5, 8, 9, 10, hs.l); break;
    case 'softcrop': rect(g, 7, 3, 16, 6, hs.b); set(g, 8, 2, hs.b); set(g, 12, 2, hs.l); set(g, 15, 2, hs.b); break;
    case 'twists': cap(g, hs); for (let x = 6; x <= 17; x += 3) { rect(g, x, 1, x + 1, 6, hs.b); set(g, x, 1, hs.l); } break;
    case 'baldstripe': rect(g, 6, 4, 17, 6, hs.b); rect(g, 11, 2, 12, 6, sk.base); rect(g, 6, 7, 7, 11, hs.d); rect(g, 16, 7, 17, 11, hs.d); break;
    case 'chinbeard': cap(g, hs); rect(g, 9, 13, 14, 15, hs.b); set(g, 8, 12, hs.d); set(g, 15, 12, hs.d); break;
    case 'roundglasses': cap(g, hs); rect(g, 6, 7, 10, 11, 'K'); rect(g, 13, 7, 17, 11, 'K'); rect(g, 7, 8, 9, 10, sk.base); rect(g, 14, 8, 16, 10, sk.base); rect(g, 11, 9, 12, 9, 'K'); break;
    case 'sportsvisor': cap(g, hs); rect(g, 6, 7, 17, 10, 'K'); rect(g, 7, 8, 16, 9, 'C'); break;
    case 'hairclips': cap(g, hs); set(g, 5, 6, 'W'); set(g, 6, 5, 'W'); set(g, 17, 4, 'W'); set(g, 18, 5, 'W'); break;
    case 'minibuns': cap(g, hs); rect(g, 5, 0, 8, 3, hs.b); rect(g, 15, 0, 18, 3, hs.b); break;
    case 'earstud': cap(g, hs); set(g, 18, 10, 'W'); set(g, 19, 10, 'A'); break;
    case 'hoopearring': cap(g, hs); set(g, 18, 10, 'A'); set(g, 19, 11, 'A'); set(g, 18, 12, 'A'); break;
    case 'browscar': cap(g, hs); set(g, 8, 7, sk.sh); set(g, 9, 6, sk.hi); set(g, 10, 5, sk.sh); break;
    case 'cheekscar': cap(g, hs); set(g, 15, 10, sk.hi); set(g, 16, 11, sk.sh); set(g, 17, 12, sk.hi); break;
    case 'eyebrowslit': cap(g, hs); rect(g, 7, 7, 10, 7, hs.d); set(g, 9, 7, sk.base); break;
    case 'bigforehead': rect(g, 7, 0, 16, 3, hs.b); rect(g, 8, 0, 11, 1, hs.l); set(g, 6, 4, hs.b); set(g, 17, 4, hs.b); break;
    case 'highhairline': rect(g, 6, 1, 17, 4, hs.b); rect(g, 9, 4, 14, 6, sk.base); set(g, 6, 5, hs.d); set(g, 17, 5, hs.d); break;
    case 'recedingtemples': rect(g, 8, 2, 15, 4, hs.b); rect(g, 5, 4, 8, 8, hs.b); rect(g, 15, 4, 18, 8, hs.b); rect(g, 9, 4, 14, 6, sk.base); break;
    case 'shavedmohawk': rect(g, 10, 0, 13, 6, hs.b); rect(g, 11, 0, 12, 3, hs.l); set(g, 6, 6, hs.d); set(g, 17, 6, hs.d); break;
    case 'braidedmohawk': for (let y = 0; y <= 6; y += 2) { rect(g, 10, y, 13, y + 1, hs.b); set(g, 11, y, hs.l); } set(g, 6, 6, hs.d); set(g, 17, 6, hs.d); break;
    case 'handlebarmoustache': cap(g, hs); rect(g, 8, 11, 15, 11, hs.d); set(g, 7, 12, hs.b); set(g, 16, 12, hs.b); set(g, 6, 13, hs.l); set(g, 17, 13, hs.l); break;
    case 'goatee': cap(g, hs); rect(g, 10, 13, 13, 15, hs.b); set(g, 9, 12, hs.d); set(g, 14, 12, hs.d); break;
    case 'sideburns': cap(g, hs); rect(g, 5, 7, 6, 13, hs.b); rect(g, 17, 7, 18, 13, hs.b); break;
    case 'browbandage': cap(g, hs); rect(g, 7, 7, 10, 8, 'W'); set(g, 8, 7, 'w'); break;
    case 'beautymark': cap(g, hs); set(g, 16, 11, hs.d); break;
    case 'thickheadband': cap(g, hs); rect(g, 5, 5, 18, 6, 'C'); set(g, 5, 6, 'B'); set(g, 18, 5, 'B'); break;
    case 'cornrows': for (let x = 6; x <= 17; x += 2) { line(g, x, 1, x - 1, 7, hs.b); set(g, x, 2, hs.l); } rect(g, 5, 6, 18, 7, hs.d); break;
    case 'mullet': cap(g, hs); rect(g, 4, 6, 6, 15, hs.b); rect(g, 17, 6, 19, 15, hs.b); rect(g, 6, 13, 8, 16, hs.l); break;
    case 'dreadhawk': rect(g, 10, 0, 13, 6, hs.b); for (let x = 8; x <= 15; x += 3) rect(g, x, 4, x + 1, 12, hs.b); set(g, 9, 8, hs.l); set(g, 15, 10, hs.l); break;
    case 'asymfringe': cap(g, hs); rect(g, 5, 5, 12, 9, hs.b); line(g, 6, 8, 11, 5, hs.l); break;
    case 'hightop': rect(g, 6, 0, 17, 6, hs.b); rect(g, 7, 0, 10, 2, hs.l); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'chinstrap': cap(g, hs); rect(g, 6, 12, 7, 14, hs.b); rect(g, 16, 12, 17, 14, hs.b); rect(g, 8, 14, 15, 15, hs.b); break;
    case 'nosebridge': cap(g, hs); rect(g, 7, 8, 10, 10, 'K'); rect(g, 13, 8, 16, 10, 'K'); rect(g, 11, 9, 12, 9, 'K'); set(g, 9, 9, 'C'); set(g, 14, 9, 'C'); break;
    case 'doubleearstud': cap(g, hs); set(g, 5, 10, 'W'); set(g, 18, 10, 'W'); set(g, 5, 11, 'A'); set(g, 18, 11, 'A'); break;
    case 'icon-cropbeard': cap(g, hs, 3); line(g, 8, 3, 14, 2, hs.l); rect(g, 6, 11, 7, 13, hs.d); rect(g, 16, 11, 17, 13, hs.d); rect(g, 8, 13, 15, 14, hs.b); break;
    case 'icon-closecurl': curls(g, hs, 6, 17); set(g, 8, 1, hs.l); set(g, 12, 1, hs.l); set(g, 16, 2, hs.l); break;
    case 'icon-volumecurls': curls(g, hs, 3, 20); rect(g, 3, 5, 5, 11, hs.b); rect(g, 18, 5, 20, 11, hs.b); set(g, 4, 12, hs.l); set(g, 19, 12, hs.l); break;
    case 'icon-gelquiff': rect(g, 7, 4, 16, 6, hs.d); rect(g, 8, 1, 17, 5, hs.b); rect(g, 6, 0, 12, 3, hs.b); line(g, 7, 0, 12, 2, hs.l); break;
    case 'icon-shag70s': cap(g, hs); rect(g, 4, 5, 6, 12, hs.b); rect(g, 17, 5, 19, 13, hs.b); set(g, 4, 13, hs.l); set(g, 18, 14, hs.l); break;
    case 'icon-featherpart': cap(g, hs); line(g, 11, 2, 11, 6, sk.base); line(g, 7, 2, 10, 4, hs.l); line(g, 12, 3, 16, 2, hs.l); set(g, 18, 6, hs.b); break;
    case 'icon-slickback': rect(g, 6, 2, 17, 6, hs.b); line(g, 6, 3, 14, 1, hs.l); rect(g, 15, 1, 18, 4, hs.b); rect(g, 6, 6, 17, 6, hs.d); break;
    case 'icon-crescentfringe': rect(g, 8, 1, 15, 4, sk.base); rect(g, 7, 4, 16, 6, sk.base); set(g, 8, 1, '.'); set(g, 15, 1, '.'); rect(g, 8, 2, 10, 2, sk.hi); set(g, 6, 6, hs.d); set(g, 17, 6, hs.d); rect(g, 8, 4, 13, 4, hs.b); rect(g, 10, 5, 14, 5, hs.b); set(g, 13, 6, hs.b); break;
    case 'icon-cleanbald': rect(g, 8, 2, 15, 4, sk.base); rect(g, 7, 4, 16, 6, sk.base); set(g, 8, 2, '.'); set(g, 15, 2, '.'); rect(g, 8, 3, 10, 3, sk.hi); set(g, 6, 6, hs.d); set(g, 17, 6, hs.d); break;
    case 'icon-thickwave': cap(g, hs); rect(g, 5, 2, 12, 4, hs.b); line(g, 5, 2, 10, 1, hs.l); rect(g, 5, 6, 7, 10, hs.d); set(g, 18, 7, hs.b); break;
    case 'icon-sidewave': rect(g, 6, 3, 17, 6, hs.b); rect(g, 5, 2, 11, 4, hs.b); line(g, 6, 2, 10, 3, hs.l); set(g, 6, 7, hs.d); set(g, 17, 7, hs.d); break;
    case 'icon-curlypart': curls(g, hs, 5, 18); line(g, 11, 1, 12, 5, sk.base); set(g, 7, 2, hs.l); set(g, 16, 1, hs.l); break;
    case 'icon-centrelong': cap(g, hs); rect(g, 4, 5, 6, 16, hs.b); rect(g, 17, 5, 19, 16, hs.b); line(g, 11, 2, 12, 7, sk.base); set(g, 5, 13, hs.l); set(g, 18, 11, hs.l); break;
    case 'icon-tidyfringe': rect(g, 6, 2, 17, 6, hs.b); rect(g, 7, 2, 10, 3, hs.l); rect(g, 6, 6, 13, 7, hs.b); set(g, 13, 7, hs.d); break;
    case 'icon-highbald': rect(g, 8, 1, 15, 4, sk.base); rect(g, 7, 4, 16, 6, sk.base); set(g, 8, 1, '.'); set(g, 15, 1, '.'); rect(g, 8, 2, 10, 2, sk.hi); rect(g, 6, 5, 6, 10, hs.d); rect(g, 17, 5, 17, 10, hs.d); break;
    case 'icon-heavy70s': cap(g, hs); rect(g, 5, 5, 7, 12, hs.b); rect(g, 16, 5, 18, 12, hs.b); rect(g, 6, 12, 7, 14, hs.d); rect(g, 16, 12, 17, 14, hs.d); line(g, 7, 2, 12, 1, hs.l); break;
    case 'icon-tightcurl': curls(g, hs, 6, 17); for (let x = 7; x <= 16; x += 3) set(g, x, 3, hs.d); rect(g, 6, 6, 17, 7, hs.d); break;
    case 'icon-headbandbraids': cap(g, hs); rect(g, 5, 5, 18, 6, 'W'); for (let x = 4; x <= 19; x += 3) { rect(g, x, 6, x + 1, 15, hs.b); set(g, x, 10, hs.l); } break;
    case 'icon-dutchsweep': rect(g, 6, 3, 17, 6, hs.b); rect(g, 4, 2, 13, 5, hs.b); line(g, 5, 2, 11, 1, hs.l); set(g, 4, 6, hs.b); set(g, 17, 7, hs.d); break;
    case 'icon-keepercap': rect(g, 5, 2, 18, 6, hs.b); rect(g, 7, 0, 16, 3, hs.b); rect(g, 4, 6, 19, 7, hs.d); rect(g, 9, 1, 12, 1, 'W'); break;
    case 'star-closefade': rect(g, 8, 2, 15, 5, hs.b); rect(g, 6, 5, 17, 6, hs.d); for (let x = 8; x <= 15; x += 2) set(g, x, 2, hs.l); set(g, 6, 7, sk.sh); set(g, 17, 7, sk.sh); break;
    case 'star-youthcurlfade': curls(g, hs, 7, 16); rect(g, 6, 5, 7, 7, hs.d); rect(g, 16, 5, 17, 7, hs.d); set(g, 8, 1, hs.l); set(g, 12, 0, hs.b); set(g, 15, 1, hs.l); break;
    case 'star-cleanbuzz': rect(g, 8, 2, 15, 4, sk.base); rect(g, 7, 4, 16, 6, sk.base); rect(g, 8, 2, 15, 2, hs.d); for (let x = 8; x <= 15; x += 2) set(g, x, 3, hs.d); set(g, 6, 6, hs.d); set(g, 17, 6, hs.d); break;
    case 'star-curlybeard': curls(g, hs, 5, 18); rect(g, 6, 11, 7, 13, hs.d); rect(g, 16, 11, 17, 13, hs.d); rect(g, 8, 13, 15, 15, hs.b); rect(g, 9, 11, 14, 11, hs.d); break;
    case 'star-bleachcrop': rect(g, 8, 1, 15, 5, hs.b); rect(g, 6, 5, 17, 6, hs.d); for (let x = 8; x <= 15; x += 2) set(g, x, 1, hs.l); set(g, 7, 4, hs.l); break;
    case 'star-highfadecurls': curls(g, hs, 7, 16); rect(g, 6, 5, 7, 7, hs.d); rect(g, 16, 5, 17, 7, hs.d); for (let x = 8; x <= 15; x += 3) set(g, x, 2, hs.l); break;
    case 'star-blondlowpony': cap(g, hs); rect(g, 18, 7, 20, 13, hs.b); rect(g, 19, 12, 21, 16, hs.b); rect(g, 20, 14, 21, 16, hs.l); line(g, 7, 2, 13, 1, hs.l); break;
    case 'star-texturedfade': rect(g, 7, 4, 16, 6, hs.d); for (let x = 7; x <= 16; x += 3) { rect(g, x, 1, x + 1, 5, hs.b); set(g, x, 1, hs.l); } set(g, 6, 6, sk.sh); set(g, 17, 6, sk.sh); break;
    case 'star-sidecropstubble': cap(g, hs); line(g, 11, 2, 11, 6, sk.base); line(g, 7, 2, 10, 3, hs.l); rect(g, 6, 12, 7, 13, hs.d); rect(g, 16, 12, 17, 13, hs.d); rect(g, 9, 14, 14, 14, hs.d); break;
    default: cap(g, hs); break;
  }
}

function legs(g, frame, sk) {
  const [left, right] = frame === 1 ? [8, 14] : [9, 13];
  rect(g, left, 26, left + 1, 27, sk.base); rect(g, right, 26, right + 1, 27, sk.base);
  set(g, left, 27, sk.sh); set(g, right + 1, 27, sk.sh);
  rect(g, left, 28, left + 1, 28, 'W'); rect(g, right, 28, right + 1, 28, 'W');
  rect(g, left - 1, 29, left + 1, 29, 'W'); rect(g, right, 29, right + 2, 29, 'W');
  set(g, left - 1, 29, 'w'); set(g, right + 2, 29, 'w');
}

const CREATED_KIT_ACCENTS = ['W', 'C', 'A', 'T'];

function fieldBody(g, side, build, frame, sk, kitAccent) {
  const kit = side === 'r' ? { sh: 'r', base: 'R', hi: 'E' } : { sh: 'b', base: 'B', hi: 'C' };
  let left = 7; let right = 16;
  if (build === 'muscular') { left = 6; right = 17; }
  if (build === 'slim') { left = 8; right = 15; }
  rect(g, left, 16, right, 23, kit.base); rect(g, left, 16, right, 16, kit.hi);
  rect(g, left, 17, left + 1, 22, kit.hi); rect(g, right, 18, right, 23, kit.sh);
  rect(g, left, 23, right, 23, kit.sh); rect(g, 10, 16, 13, 16, kit.sh);
  rect(g, left - 1, 16, left - 1, 18, kit.base); rect(g, right + 1, 16, right + 1, 18, kit.base);
  rect(g, left - 1, 19, left - 1, 21, sk.base); rect(g, right + 1, 19, right + 1, 21, sk.base);
  if (build === 'muscular') { set(g, left - 2, 17, kit.base); set(g, right + 2, 17, kit.base); set(g, left - 2, 18, sk.base); set(g, right + 2, 18, sk.base); }
  const accent = CREATED_KIT_ACCENTS[kitAccent];
  if (accent !== undefined) {
    rect(g, left, 16, right, 16, accent);
    rect(g, left, 17, left + 1, 22, accent);
  }
  rect(g, 11, 19, 12, 20, 'W'); rect(g, left, 24, right, 25, 'W'); rect(g, left, 25, right, 25, 'w');
  legs(g, frame, sk);
}

function goalkeeperBody(g, side, frame, sk, ready) {
  const kit = side === 'r' ? 'T' : 'A';
  rect(g, 7, 16, 16, 23, kit); rect(g, 7, 16, 16, 16, 'W');
  rect(g, 10, 16, 13, 16, 'K'); rect(g, 11, 19, 12, 20, 'K');
  if (ready === undefined) {
    rect(g, 6, 16, 6, 18, kit); rect(g, 17, 16, 17, 18, kit);
    rect(g, 6, 19, 6, 20, 'W'); rect(g, 17, 19, 17, 20, 'W');
  } else {
    const spread = ready === 1 ? 3 : 2;
    rect(g, 7 - spread, 17, 6, 18, kit); rect(g, 17, 17, 16 + spread, 18, kit);
    rect(g, 7 - spread, 19, 8 - spread, 20, 'W'); rect(g, 15 + spread, 19, 16 + spread, 20, 'W');
  }
  rect(g, 7, 24, 16, 25, 'W'); rect(g, 7, 25, 16, 25, 'w');
  if (ready === undefined) legs(g, frame, sk);
  else {
    const offset = ready === 1 ? 1 : 0;
    rect(g, 8 - offset, 26, 9 - offset, 27, sk.base); rect(g, 14 + offset, 26, 15 + offset, 27, sk.base);
    rect(g, 7 - offset, 28, 9 - offset, 28, 'W'); rect(g, 14 + offset, 28, 16 + offset, 28, 'W');
  }
}

function portraitBust(g, role, kitAccent) {
  const kit = role === 'goalkeeper'
    ? { sh: 'K', base: 'T', hi: 'T' }
    : { sh: 'r', base: 'R', hi: 'E' };
  rect(g, 9, 16, 14, 16, kit.base); rect(g, 7, 17, 16, 17, kit.base);
  rect(g, 5, 18, 18, 18, kit.base); rect(g, 3, 19, 20, 19, kit.base);
  rect(g, 2, 20, 21, 28, kit.base); rect(g, 2, 20, 3, 27, kit.hi);
  rect(g, 20, 21, 21, 28, kit.sh); rect(g, 2, 28, 21, 28, kit.sh);
  rect(g, 10, 16, 13, 17, kit.sh); rect(g, 10, 24, 13, 26, 'W');
  set(g, 11, 25, kit.sh); set(g, 12, 25, kit.sh);
  const accent = CREATED_KIT_ACCENTS[kitAccent];
  if (accent !== undefined) {
    rect(g, 7, 17, 16, 17, accent);
    rect(g, 2, 20, 3, 27, accent);
    set(g, 11, 25, accent); set(g, 12, 25, accent);
  }
}

export function makePortrait(look, expression) {
  const g = grid(PORTRAIT_CELL.h);
  const sk = SKIN[look.skin]; const hs = HAIR[look.hair];
  face(g, sk, look.face, expression, look); feature(g, look.feature, hs, sk); portraitBust(g, look.role, look.kitAccent);
  outline(g);
  return g.map(row => row.join(''));
}

export function makeMatchPlayer(look, side, frame, ready) {
  const g = grid(PLAYER_CELL.h);
  const sk = SKIN[look.skin]; const hs = HAIR[look.hair];
  face(g, sk, look.face, 'rest', look); feature(g, look.feature, hs, sk);
  if (look.role === 'goalkeeper') goalkeeperBody(g, side, frame, sk, ready);
  else fieldBody(g, side, look.build, frame, sk, look.kitAccent);
  outline(g);
  return g.map(row => row.join(''));
}
