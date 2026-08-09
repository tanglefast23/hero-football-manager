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
const rearHeads = Object.fromEntries(
  FIELD_PLAYER_LOOKS.flatMap((look) =>
    look.rearHead === undefined ? [] : [[look.id, look.rearHead]],
  ),
);
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
for (const side of ['r', 'u'])
  for (const look of CREATED_PLAYER_LOOKS) {
    sprites[`${side}:${look.id}:run0`] = makeMatchPlayer(look, side, 0);
    sprites[`${side}:${look.id}:run1`] = makeMatchPlayer(look, side, 1);
  }
// Six pixels across leaves a 4x4 interior, so the centre panel plus opposite
// corner partials is the most football a ball this size can carry: the corners
// were already cut by the outline, so filling them thickens the ring on the
// diagonal rather than squaring the ball off, and the other two stay white so
// it still reads light. All four corners filled makes a dark ring at 3.1x.
// Anything more than this needs an 8x8 sprite and a matching scale drop.
sprites.ball = ['.KKKK.', 'KKWWWK', 'KWKKWK', 'KWKKWK', 'KWWWKK', '.KKKK.'];

validateSprites();
const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/render/sprites/sprites.json',
);
writeFileSync(
  out,
  `${JSON.stringify({ cell: PLAYER_CELL, palette: PLAYER_PALETTE, rearHeads, sprites }, null, 2)}\n`,
);
console.log(
  `wrote ${Object.keys(sprites).length} base sprites for ${FIELD_PLAYER_LOOKS.length + GOALKEEPER_LOOKS.length + CREATED_PLAYER_LOOKS.length} unique player looks`,
);

function validateSprites() {
  if (Object.keys(PLAYER_PALETTE).length > 26)
    throw new Error('player palette exceeds 26 keys');
  for (const [lookId, style] of Object.entries(rearHeads)) {
    for (const token of [
      style.head,
      style.lower,
      ...(style.bands ?? []).map((band) => band.token),
    ]) {
      if (!(token in PLAYER_PALETTE))
        throw new Error(`${lookId} rear head uses ${token}`);
    }
    for (const band of style.bands ?? []) {
      if (!Number.isInteger(band.row) || band.row < 7 || band.row > 12) {
        throw new Error(`${lookId} rear head band row must be from 7 to 12`);
      }
    }
  }
  // The hero build and the hero face box are one decision, and `shape` is the
  // half that is easy to leave off: a look with only `build: 'hero'` renders a
  // 12-wide head on a 14-wide torso, which reads as a pinhead rather than as a
  // bug. Neither the sprites nor the portraits can distinguish that from a
  // deliberate `long` face after the fact, so the pairing is enforced here,
  // where the data is, and the sheets simply cannot be generated without it.
  for (const look of FIELD_PLAYER_LOOKS) {
    if ((look.build === 'hero') !== (look.shape === 'hero')) {
      throw new Error(
        `${look.id} sets only one of build:'hero' and shape:'hero'`,
      );
    }
  }
  for (const [key, rows] of Object.entries(sprites)) {
    const isBall = key === 'ball';
    const height = isBall ? 6 : PLAYER_CELL.h;
    const width = isBall ? 6 : PLAYER_CELL.w;
    if (rows.length !== height) throw new Error(`${key} has the wrong height`);
    for (const row of rows) {
      if (row.length !== width) throw new Error(`${key} has the wrong width`);
      for (const token of row)
        if (!(token in PLAYER_PALETTE)) throw new Error(`${key} uses ${token}`);
    }
  }
  for (const side of ['r', 'u'])
    for (const look of GOALKEEPER_LOOKS) {
      const keys = ['run0', 'ready0', 'ready1'].map(
        (frame) => `${side}:${look.id}:${frame}`,
      );
      if (
        new Set(keys.map((key) => JSON.stringify(sprites[key]))).size !==
        keys.length
      ) {
        throw new Error(`${side}:${look.id} goalkeeper poses are not distinct`);
      }
    }
}
