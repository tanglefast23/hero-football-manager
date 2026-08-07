import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPERHERO_HOMAGE_IDENTITIES } from './player-art-roster.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portraits = json('src/render/sprites/portraits.json');
const match = json('src/render/sprites/sprites.json');
const coaches = json('src/render/sprites/management-sprites.json');
const manifest = json('src/render/sprites/player-look-manifest.json');
const coachIdentities = json('src/game/coach-identities.json');

const width = 1392;
const fieldIds = manifest.field;
const goalkeeperIds = manifest.goalkeeper;
const playerIds = [...fieldIds, ...goalkeeperIds];
const playerColumns = 12;
const playerCard = { w: 112, h: 98 };
const playerOrigin = { x: 24, y: 110 };
const playerRows = Math.ceil(playerIds.length / playerColumns);
const coachOriginY = playerOrigin.y + playerRows * playerCard.h + 76;
const coachColumns = 8;
const coachCard = { w: 168, h: 100 };
const coachRows = Math.ceil(coachIdentities.length / coachColumns);
const height = coachOriginY + coachRows * coachCard.h + 72;

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  '<rect width="100%" height="100%" fill="#f4f1ea"/>',
  '<text x="24" y="38" font-family="monospace" font-size="24" font-weight="bold" fill="#241f2e">HERO FOOTBALL MANAGER · CHARACTER ROSTER</text>',
  `<text x="24" y="70" font-family="monospace" font-size="16" fill="#3f6fb5">${playerIds.length} PLAYER IDENTITIES · ${Object.keys(portraits.sprites).length} EXPRESSIVE PORTRAITS · CORRESPONDING MATCH SPRITES</text>`,
  '<text x="24" y="101" font-family="monospace" font-size="15" font-weight="bold" fill="#241f2e">PLAYERS — PORTRAIT + HOME-KIT RUN SPRITE</text>',
];

playerIds.forEach((id, index) => {
  const column = index % playerColumns;
  const row = Math.floor(index / playerColumns);
  const x = playerOrigin.x + column * playerCard.w;
  const y = playerOrigin.y + row * playerCard.h;
  const goalkeeper = goalkeeperIds.includes(id);
  parts.push(`<rect x="${x}" y="${y}" width="104" height="90" fill="#ffffff" stroke="#241f2e" stroke-width="2"/>`);
  parts.push(`<rect x="${x + 4}" y="${y + 4}" width="96" height="66" fill="${goalkeeper ? '#f7d894' : '#a3c8f0'}"/>`);
  parts.push(sprite(portraits.sprites[`${id}:rest`], portraits.palette, x + 5, y + 7, 2));
  parts.push(sprite(match.sprites[`r:${id}:run0`], match.palette, x + 53, y + 6, 2));
  parts.push(`<text x="${x + 52}" y="${y + 84}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#241f2e">${id.toUpperCase()} · ${goalkeeper ? 'GK' : 'FIELD'}</text>`);
});

parts.push(`<text x="24" y="${coachOriginY - 42}" font-family="monospace" font-size="15" font-weight="bold" fill="#241f2e">COACHES — 32 UNIQUE STAFF, HIRING AGES 30–60</text>`);
parts.push(`<text x="24" y="${coachOriginY - 18}" font-family="monospace" font-size="13" fill="#3f6fb5">13 TOUCHLINE WARDROBES · AGE-BAND DETAILS · NO PLAYER-PORTRAIT REUSE</text>`);

coachIdentities.forEach((coach, index) => {
  const column = index % coachColumns;
  const row = Math.floor(index / coachColumns);
  const x = 24 + column * coachCard.w;
  const y = coachOriginY + row * coachCard.h;
  parts.push(`<rect x="${x}" y="${y}" width="160" height="92" fill="#ffffff" stroke="#241f2e" stroke-width="2"/>`);
  parts.push(`<rect x="${x + 4}" y="${y + 4}" width="56" height="64" fill="#a3c8f0"/>`);
  parts.push(sprite(coaches.sprites[`coach:${coach.id}:rest`], coaches.palette, x + 8, y + 6, 2));
  parts.push(`<text x="${x + 66}" y="${y + 27}" font-family="monospace" font-size="11" font-weight="bold" fill="#241f2e">${escapeXml(coach.name.toUpperCase())}</text>`);
  parts.push(`<text x="${x + 66}" y="${y + 47}" font-family="monospace" font-size="12" fill="#3f6fb5">AGE ${coach.age}</text>`);
  parts.push(`<text x="${x + 66}" y="${y + 67}" font-family="monospace" font-size="8" fill="#6b6675">${coach.wardrobe.replaceAll('-', ' ').toUpperCase()}</text>`);
});

parts.push(`<text x="24" y="${height - 28}" font-family="monospace" font-size="13" fill="#6b6675">STYLE BIBLE: 24×29 PORTRAITS · 24×30 MATCH SPRITES · HARD PIXELS · UPPER-LEFT LIGHT · SHARED PALETTE</text>`);
parts.push('</svg>');

const output = resolve(root, 'art/roster-diversity-preview.svg');
writeFileSync(output, `${parts.join('\n')}\n`);
console.log(`wrote ${output} (${width}x${height})`);

const reviewedLooks = [
  { id: 'f05', label: 'BOWL CUT · ANGLED EYES · TOOTH SMILE' },
  { id: 'f74', label: 'LONG HAIR · ANGLED EYES' },
  { id: 'f81', label: 'SLEEK LONG HAIR · TOOTH SMILE' },
  { id: 'f82', label: 'TOP KNOT · ANGLED EYES · TOOTH SMILE' },
  { id: 'f110', label: 'NEAT CROP · ANGLED EYES · TOOTH SMILE' },
  { id: 'f134', label: 'SIDE PART · ANGLED EYES' },
];
const reviewWidth = 1200;
const reviewHeight = 590;
const reviewParts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${reviewWidth}" height="${reviewHeight}" viewBox="0 0 ${reviewWidth} ${reviewHeight}">`,
  '<rect width="100%" height="100%" fill="#f4f1ea"/>',
  '<text x="24" y="38" font-family="monospace" font-size="24" font-weight="bold" fill="#241f2e">SIX REVIEWED PLAYER REDESIGNS</text>',
  '<text x="24" y="68" font-family="monospace" font-size="14" fill="#3f6fb5">NATURAL BLACK HAIR · RESTING PORTRAIT · JOY PORTRAIT · CORRESPONDING MATCH SPRITE</text>',
];
reviewedLooks.forEach((look, index) => {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x = 24 + column * 392;
  const y = 86 + row * 238;
  reviewParts.push(`<rect x="${x}" y="${y}" width="376" height="220" fill="#ffffff" stroke="#241f2e" stroke-width="3"/>`);
  for (const offset of [14, 128, 242]) {
    reviewParts.push(`<rect x="${x + offset}" y="${y + 42}" width="104" height="128" fill="#a3c8f0"/>`);
  }
  reviewParts.push(sprite(portraits.sprites[`${look.id}:rest`], portraits.palette, x + 18, y + 48, 4));
  reviewParts.push(sprite(portraits.sprites[`${look.id}:joy`], portraits.palette, x + 132, y + 48, 4));
  reviewParts.push(sprite(match.sprites[`r:${look.id}:run0`], match.palette, x + 246, y + 46, 4));
  reviewParts.push(`<text x="${x + 188}" y="${y + 28}" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#241f2e">${look.id.toUpperCase()}</text>`);
  reviewParts.push(`<text x="${x + 188}" y="${y + 194}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#3f6fb5">${look.label}</text>`);
  reviewParts.push(`<text x="${x + 66}" y="${y + 212}" text-anchor="middle" font-family="monospace" font-size="10" fill="#6b6675">REST</text>`);
  reviewParts.push(`<text x="${x + 180}" y="${y + 212}" text-anchor="middle" font-family="monospace" font-size="10" fill="#6b6675">JOY</text>`);
  reviewParts.push(`<text x="${x + 294}" y="${y + 212}" text-anchor="middle" font-family="monospace" font-size="10" fill="#6b6675">MATCH</text>`);
});
reviewParts.push('</svg>');
const reviewOutput = resolve(root, 'art/player-redesign-preview.svg');
writeFileSync(reviewOutput, `${reviewParts.join('\n')}\n`);
console.log(`wrote ${reviewOutput} (${reviewWidth}x${reviewHeight})`);

const dyedLooks = [
  { id: 'f27', label: 'HOT PINK' },
  { id: 'f29', label: 'ELECTRIC BLUE' },
  { id: 'f33', label: 'TEAL' },
  { id: 'f64', label: 'VIVID ORANGE' },
  { id: 'f75', label: 'ELECTRIC BLUE' },
  { id: 'f92', label: 'HOT PINK' },
  { id: 'f124', label: 'TEAL' },
  { id: 'f135', label: 'HOT PINK' },
  { id: 'f23', label: 'BLEACH BLONDE' },
  { id: 'f65', label: 'BLEACH BLONDE' },
  { id: 'f95', label: 'BLEACH BLONDE' },
  { id: 'f45', label: 'BLEACHED SILVER' },
  { id: 'f89', label: 'BLEACHED SILVER' },
  { id: 'f125', label: 'BLEACHED SILVER' },
];
const dyedWidth = 1400;
const dyedHeight = 470;
const dyedParts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${dyedWidth}" height="${dyedHeight}" viewBox="0 0 ${dyedWidth} ${dyedHeight}">`,
  '<rect width="100%" height="100%" fill="#f4f1ea"/>',
  '<text x="24" y="38" font-family="monospace" font-size="24" font-weight="bold" fill="#241f2e">CURATED DYED-HAIR PLAYERS</text>',
  '<text x="24" y="66" font-family="monospace" font-size="14" fill="#3f6fb5">8 VIVID DYES · 3 BLEACH BLONDE · 3 BLEACHED SILVER · NATURAL COLOURS REMAIN THE BASELINE</text>',
];
dyedLooks.forEach((look, index) => {
  const column = index % 7;
  const row = Math.floor(index / 7);
  const x = 24 + column * 196;
  const y = 84 + row * 184;
  dyedParts.push(`<rect x="${x}" y="${y}" width="184" height="170" fill="#ffffff" stroke="#241f2e" stroke-width="3"/>`);
  dyedParts.push(`<rect x="${x + 10}" y="${y + 38}" width="76" height="94" fill="#a3c8f0"/>`);
  dyedParts.push(`<rect x="${x + 98}" y="${y + 38}" width="76" height="94" fill="#a3c8f0"/>`);
  dyedParts.push(sprite(portraits.sprites[`${look.id}:rest`], portraits.palette, x + 12, y + 42, 3));
  dyedParts.push(sprite(match.sprites[`r:${look.id}:run0`], match.palette, x + 100, y + 40, 3));
  dyedParts.push(`<text x="${x + 92}" y="${y + 25}" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#241f2e">${look.id.toUpperCase()}</text>`);
  dyedParts.push(`<text x="${x + 92}" y="${y + 153}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#3f6fb5">${look.label}</text>`);
});
dyedParts.push('</svg>');
const dyedOutput = resolve(root, 'art/dyed-hair-preview.svg');
writeFileSync(dyedOutput, `${dyedParts.join('\n')}\n`);
console.log(`wrote ${dyedOutput} (${dyedWidth}x${dyedHeight})`);

writeFootballReferencePreview({
  filename: 'football-legends-preview.svg',
  title: '20 FOOTBALL-LEGEND SILHOUETTE HOMAGES',
  subtitle: 'DEVELOPMENT REFERENCES ONLY · FICTIONAL IN-GAME IDENTITIES · REST · JOY · MATCH',
  columns: 4,
  looks: [
    { id: 'f140', name: 'LIONEL MESSI', cue: 'CROP + BEARD' },
    { id: 'f141', name: 'PELÉ', cue: 'CLOSE CURL + BIG SMILE' },
    { id: 'f142', name: 'DIEGO MARADONA', cue: 'VOLUME CURLS' },
    { id: 'f143', name: 'CRISTIANO RONALDO', cue: 'GELLED QUIFF' },
    { id: 'f144', name: 'JOHAN CRUYFF', cue: '70S SHAG' },
    { id: 'f145', name: 'FRANZ BECKENBAUER', cue: 'FEATHERED PART' },
    { id: 'f146', name: 'ALFREDO DI STÉFANO', cue: 'SLICK BACK' },
    { id: 'f147', name: 'RONALDO NAZÁRIO', cue: '2002 CRESCENT' },
    { id: 'f148', name: 'ZINEDINE ZIDANE', cue: 'CLEAN BALD' },
    { id: 'f149', name: 'FERENC PUSKÁS', cue: 'THICK WAVE' },
    { id: 'f150', name: 'GARRINCHA', cue: 'SIDE WAVE' },
    { id: 'f151', name: 'MICHEL PLATINI', cue: 'CURLY PART' },
    { id: 'f152', name: 'PAOLO MALDINI', cue: 'LONG CENTRE PART' },
    { id: 'f153', name: 'XAVI HERNÁNDEZ', cue: 'TIDY FRINGE' },
    { id: 'f154', name: 'ANDRÉS INIESTA', cue: 'HIGH BALD' },
    { id: 'f155', name: 'GERD MÜLLER', cue: 'HEAVY 70S CROP' },
    { id: 'f156', name: 'EUSÉBIO', cue: 'TIGHT CURL' },
    { id: 'f157', name: 'RONALDINHO', cue: 'HEADBAND + BRAIDS' },
    { id: 'f158', name: 'MARCO VAN BASTEN', cue: 'DUTCH SWEEP' },
    { id: 'g24', name: 'LEV YASHIN', cue: 'BLACK KEEPER CAP', goalkeeper: true },
  ],
});

writeFootballReferencePreview({
  filename: 'current-stars-preview.svg',
  title: '9 CURRENT-STAR SILHOUETTE HOMAGES',
  subtitle: 'DEVELOPMENT REFERENCES ONLY · FICTIONAL IN-GAME IDENTITIES · REST · JOY · MATCH',
  columns: 3,
  looks: [
    { id: 'f159', name: 'OUSMANE DEMBÉLÉ', cue: 'CLOSE FADE' },
    { id: 'f160', name: 'LAMINE YAMAL', cue: 'YOUTH CURL FADE' },
    { id: 'f161', name: 'KYLIAN MBAPPÉ', cue: 'CLEAN BUZZ' },
    { id: 'f162', name: 'MOHAMED SALAH', cue: 'CURLS + BEARD' },
    { id: 'f163', name: 'RAPHINHA', cue: 'BLEACHED CROP' },
    { id: 'f164', name: 'VINÍCIUS JÚNIOR', cue: 'HIGH-FADE CURLS' },
    { id: 'f165', name: 'ERLING HAALAND', cue: 'BLOND LOW PONY' },
    { id: 'f166', name: 'JUDE BELLINGHAM', cue: 'TEXTURED FADE' },
    { id: 'f167', name: 'HARRY KANE', cue: 'SIDE CROP + STUBBLE' },
  ],
});

// Driven off the exported identities rather than a second hand-typed list, so
// the sheet can never disagree with the roster about who f173 is.
writeFootballReferencePreview({
  filename: 'superhero-homage-preview.svg',
  title: '15 SUPERHERO SILHOUETTE HOMAGES',
  subtitle: 'DEVELOPMENT REFERENCES ONLY · FICTIONAL IN-GAME IDENTITIES · HERO BUILD · REST · JOY · MATCH',
  columns: 5,
  looks: SUPERHERO_HOMAGE_IDENTITIES.map(hero => ({
    id: hero.id,
    name: hero.name.toUpperCase(),
    cue: `${hero.cue} · ${hero.power.replace(/_/g, ' ')}`,
  })),
  // The whole point of the hero build is that it reads bigger on the pitch, and
  // a sheet of heroes alone cannot show that — every card is the same size.
  comparison: [
    { id: 'f09', label: 'SLIM' },
    { id: 'f00', label: 'NORMAL' },
    { id: 'f02', label: 'MUSCULAR' },
    { id: 'f168', label: 'HERO' },
    { id: 'f176', label: 'HERO' },
    { id: 'f180', label: 'HERO' },
  ],
});

function writeFootballReferencePreview({ filename, title, subtitle, columns, looks, comparison }) {
  const card = { w: 300, h: 210 };
  const width = 24 + columns * card.w;
  const rows = Math.ceil(looks.length / columns);
  const stripHeight = comparison === undefined ? 0 : 190;
  const height = 84 + rows * card.h + 20 + stripHeight;
  const previewParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#f4f1ea"/>',
    `<text x="24" y="38" font-family="monospace" font-size="24" font-weight="bold" fill="#241f2e">${escapeXml(title)}</text>`,
    `<text x="24" y="66" font-family="monospace" font-size="13" fill="#3f6fb5">${escapeXml(subtitle)}</text>`,
  ];
  looks.forEach((look, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 24 + column * card.w;
    const y = 84 + row * card.h;
    const background = look.goalkeeper ? '#f7d894' : '#a3c8f0';
    previewParts.push(`<rect x="${x}" y="${y}" width="288" height="196" fill="#ffffff" stroke="#241f2e" stroke-width="3"/>`);
    for (const offset of [10, 106, 202]) {
      previewParts.push(`<rect x="${x + offset}" y="${y + 38}" width="76" height="94" fill="${background}"/>`);
    }
    previewParts.push(sprite(portraits.sprites[`${look.id}:rest`], portraits.palette, x + 12, y + 42, 3));
    previewParts.push(sprite(portraits.sprites[`${look.id}:joy`], portraits.palette, x + 108, y + 42, 3));
    previewParts.push(sprite(match.sprites[`r:${look.id}:run0`], match.palette, x + 204, y + 40, 3));
    previewParts.push(`<text x="${x + 144}" y="${y + 24}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#241f2e">${escapeXml(`${look.name} · ${look.id.toUpperCase()}`)}</text>`);
    previewParts.push(`<text x="${x + 144}" y="${y + 154}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#3f6fb5">${escapeXml(look.cue)}</text>`);
    previewParts.push(`<text x="${x + 48}" y="${y + 178}" text-anchor="middle" font-family="monospace" font-size="9" fill="#6b6675">REST</text>`);
    previewParts.push(`<text x="${x + 144}" y="${y + 178}" text-anchor="middle" font-family="monospace" font-size="9" fill="#6b6675">JOY</text>`);
    previewParts.push(`<text x="${x + 240}" y="${y + 178}" text-anchor="middle" font-family="monospace" font-size="9" fill="#6b6675">MATCH</text>`);
  });
  if (comparison !== undefined) {
    const stripY = 84 + rows * card.h + 12;
    previewParts.push(`<rect x="24" y="${stripY}" width="${width - 48}" height="166" fill="#ffffff" stroke="#241f2e" stroke-width="3"/>`);
    previewParts.push(`<text x="44" y="${stripY + 28}" font-family="monospace" font-size="13" font-weight="bold" fill="#241f2e">SAME SCALE — THE HERO BUILD BESIDE THE THREE ORDINARY BUILDS</text>`);
    const slot = Math.floor((width - 88) / comparison.length);
    comparison.forEach((entry, index) => {
      const x = 44 + index * slot;
      previewParts.push(`<rect x="${x}" y="${stripY + 42}" width="96" height="90" fill="${entry.label === 'HERO' ? '#f7d894' : '#a3c8f0'}"/>`);
      previewParts.push(sprite(match.sprites[`r:${entry.id}:run0`], match.palette, x + 12, stripY + 44, 3));
      previewParts.push(`<text x="${x + 48}" y="${stripY + 152}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="${entry.label === 'HERO' ? '#c22f2c' : '#6b6675'}">${entry.label} · ${entry.id.toUpperCase()}</text>`);
    });
  }
  previewParts.push('</svg>');
  const previewOutput = resolve(root, `art/${filename}`);
  writeFileSync(previewOutput, `${previewParts.join('\n')}\n`);
  console.log(`wrote ${previewOutput} (${width}x${height})`);
}

function json(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function sprite(rows, palette, originX, originY, scale) {
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const token = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === token) end += 1;
      const color = palette[token];
      if (color) rects.push(`<rect x="${originX + x * scale}" y="${originY + y * scale}" width="${(end - x) * scale}" height="${scale}" fill="${color}"/>`);
      x = end;
    }
  });
  return rects.join('');
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
