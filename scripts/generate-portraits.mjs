// Generates the complete 24x29 management portrait pool. Do not hand-edit
// portraits.json; change player-art-roster.mjs and rerun this script.
import { writeFileSync } from 'node:fs';
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
const sprites = {};
for (const look of looks) for (const expression of expressions) {
  sprites[`${look.id}:${expression}`] = makePortrait(look, expression);
}
validateSprites(sprites);
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../src/render/sprites');
writeFileSync(
  resolve(directory, 'portraits.json'),
  `${JSON.stringify({ cell: PORTRAIT_CELL, palette: PLAYER_PALETTE, sprites }, null, 2)}\n`,
);
writeFileSync(
  resolve(directory, 'player-look-manifest.json'),
  `${JSON.stringify(PLAYER_LOOK_MANIFEST, null, 2)}\n`,
);
console.log(`wrote ${Object.keys(sprites).length} portraits for ${looks.length} unique player looks`);

function validateSprites(candidateSprites) {
  if (Object.keys(PLAYER_PALETTE).length > 24) throw new Error('player palette exceeds 24 keys');
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
