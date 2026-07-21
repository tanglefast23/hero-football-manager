// Generates the complete 24x30 match-day player pool. Every visual identity
// has both home and away kit variants; goalkeeper identities also have two
// ready poses. Do not hand-edit sprites.json.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREATED_PLAYER_LOOKS,
  FIELD_PLAYER_LOOKS,
  GOALKEEPER_LOOKS,
  PLAYER_CELL,
  PLAYER_PALETTE,
  makeMatchPlayer,
} from './player-art-roster.mjs';

const sprites = {};
for (const side of ['r', 'u']) {
  for (const look of FIELD_PLAYER_LOOKS) {
    sprites[`${side}:${look.id}:run0`] = makeMatchPlayer(look, side, 0);
    sprites[`${side}:${look.id}:run1`] = makeMatchPlayer(look, side, 1);
  }
  for (const look of GOALKEEPER_LOOKS) {
    sprites[`${side}:${look.id}:run0`] = makeMatchPlayer(look, side, 0);
    sprites[`${side}:${look.id}:run1`] = makeMatchPlayer(look, side, 1);
    sprites[`${side}:${look.id}:ready0`] = makeMatchPlayer(look, side, 0, 0);
    sprites[`${side}:${look.id}:ready1`] = makeMatchPlayer(look, side, 0, 1);
  }
}
for (const side of ['r', 'u']) for (const look of CREATED_PLAYER_LOOKS) {
  sprites[`${side}:${look.id}:run0`] = makeMatchPlayer(look, side, 0);
  sprites[`${side}:${look.id}:run1`] = makeMatchPlayer(look, side, 1);
}
sprites.ball = ['.KKKK.', 'KWWWWK', 'KWKKWK', 'KWWWWK', 'KWWWWK', '.KKKK.'];

validateSprites();
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/render/sprites/sprites.json');
writeFileSync(out, `${JSON.stringify({ cell: PLAYER_CELL, palette: PLAYER_PALETTE, sprites }, null, 2)}\n`);
console.log(`wrote ${Object.keys(sprites).length} base sprites for ${FIELD_PLAYER_LOOKS.length + GOALKEEPER_LOOKS.length + CREATED_PLAYER_LOOKS.length} unique player looks`);

function validateSprites() {
  if (Object.keys(PLAYER_PALETTE).length > 24) throw new Error('player palette exceeds 24 keys');
  for (const [key, rows] of Object.entries(sprites)) {
    const isBall = key === 'ball';
    const height = isBall ? 6 : PLAYER_CELL.h;
    const width = isBall ? 6 : PLAYER_CELL.w;
    if (rows.length !== height) throw new Error(`${key} has the wrong height`);
    for (const row of rows) {
      if (row.length !== width) throw new Error(`${key} has the wrong width`);
      for (const token of row) if (!(token in PLAYER_PALETTE)) throw new Error(`${key} uses ${token}`);
    }
  }
  for (const side of ['r', 'u']) for (const look of GOALKEEPER_LOOKS) {
    const keys = ['run0', 'ready0', 'ready1'].map(frame => `${side}:${look.id}:${frame}`);
    if (new Set(keys.map(key => JSON.stringify(sprites[key]))).size !== keys.length) {
      throw new Error(`${side}:${look.id} goalkeeper poses are not distinct`);
    }
  }
}
