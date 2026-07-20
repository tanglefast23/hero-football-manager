// Generates the complete 24x29 management portrait pool. Do not hand-edit
// portraits.json; change player-art-roster.mjs and rerun this script.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELD_PLAYER_LOOKS,
  GOALKEEPER_LOOKS,
  PLAYER_LOOK_MANIFEST,
  PLAYER_PALETTE,
  PORTRAIT_CELL,
  makePortrait,
} from './player-art-roster.mjs';

const looks = [...FIELD_PLAYER_LOOKS, ...GOALKEEPER_LOOKS];
const expressions = ['rest', 'joy', 'ko'];
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const launchClubs = JSON.parse(readFileSync(resolve(scriptDirectory, '../content/clubs.json'), 'utf8')).clubs;
const launchAssignments = launchLookAssignments(launchClubs);
const playerLookManifest = {
  ...PLAYER_LOOK_MANIFEST,
  legacy: { ...PLAYER_LOOK_MANIFEST.legacy, ...launchAssignments },
};
const sprites = {};
for (const look of looks) for (const expression of expressions) {
  sprites[`${look.id}:${expression}`] = makePortrait(look, expression);
}
validateSprites(sprites);
const directory = resolve(scriptDirectory, '../src/render/sprites');
writeFileSync(
  resolve(directory, 'portraits.json'),
  `${JSON.stringify({ cell: PORTRAIT_CELL, palette: PLAYER_PALETTE, sprites }, null, 2)}\n`,
);
writeFileSync(
  resolve(directory, 'player-look-manifest.json'),
  `${JSON.stringify(playerLookManifest, null, 2)}\n`,
);
console.log(`wrote ${Object.keys(sprites).length} portraits for ${looks.length} unique player looks`);

function launchLookAssignments(clubs) {
  const mapping = {};
  let fieldIndex = 0;
  let goalkeeperIndex = 0;
  for (const club of clubs) for (const player of club.players) {
    const pool = player.role === 'GK' ? GOALKEEPER_LOOKS : FIELD_PLAYER_LOOKS;
    const index = player.role === 'GK' ? goalkeeperIndex++ : fieldIndex++;
    const look = pool[index];
    if (look === undefined) throw new Error(`not enough ${player.role === 'GK' ? 'goalkeeper' : 'field'} looks for launch rosters`);
    mapping[player.id] = look.id;
  }
  const assignedLooks = Object.values(mapping);
  if (new Set(assignedLooks).size !== assignedLooks.length) {
    throw new Error('launch player looks must all be unique');
  }
  return mapping;
}

function validateSprites(candidateSprites) {
  if (Object.keys(PLAYER_PALETTE).length > 24) throw new Error('player palette exceeds 24 keys');
  const structuralLooks = looks.map(look => (
    `${look.role}|${look.feature}|${look.face}|${look.build}|${look.eyes ?? ''}|${look.mouth ?? ''}`
  ));
  if (new Set(structuralLooks).size !== looks.length) {
    throw new Error('a palette swap alone cannot count as a unique player look');
  }
  const uniqueResting = new Set();
  for (const look of looks) {
    const expressionRows = expressions.map(expression => candidateSprites[`${look.id}:${expression}`]);
    if (new Set(expressionRows.map(rows => JSON.stringify(rows))).size !== expressions.length) {
      throw new Error(`${look.id} expressions are not distinct`);
    }
    uniqueResting.add(JSON.stringify(expressionRows[0]));
  }
  if (uniqueResting.size !== looks.length) throw new Error('player resting portraits must all be unique');
  for (const [key, rows] of Object.entries(candidateSprites)) {
    if (rows.length !== PORTRAIT_CELL.h) throw new Error(`${key} has the wrong height`);
    for (const row of rows) {
      if (row.length !== PORTRAIT_CELL.w) throw new Error(`${key} has the wrong width`);
      for (const token of row) if (!(token in PLAYER_PALETTE)) throw new Error(`${key} uses ${token}`);
    }
  }
}
