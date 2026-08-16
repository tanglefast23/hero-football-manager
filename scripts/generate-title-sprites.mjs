// Extracts the handful of sprites the title screen's pop scene draws into
// `src/render/sprites/title-sprites.json`, so the title no longer imports the
// full 1.98 MB `sprites.json` and drag it into the web first load.
//
// EXTRACTS, never composes. `scripts/generate-sprites.mjs` has drifted from the
// checked-in sheet — regenerating reverts the committed hair ramp — so the
// checked-in `sprites.json` is the source of truth here, not the roster.
//
// The key list lives in `src/ui/components/title-sprite-keys.ts`, which also
// types the pop scenes' hero tables, so a look the subset does not carry is a
// compile error rather than a crash on the first screen a player sees.
// `src/render/sprites/__tests__/title-sprites.test.ts` holds this output to
// that list and to the full sheet.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sheetPath = resolve(here, '../src/render/sprites/sprites.json');
const keysPath = resolve(here, '../src/ui/components/title-sprite-keys.ts');
const outPath = resolve(here, '../src/render/sprites/title-sprites.json');

const sheet = JSON.parse(readFileSync(sheetPath, 'utf8'));

const declaration = /export const TITLE_SPRITE_KEYS = \[([^\]]*)\]/.exec(
  readFileSync(keysPath, 'utf8'),
);
if (declaration === null)
  throw new Error(`no TITLE_SPRITE_KEYS array in ${keysPath}`);
const keys = [...declaration[1].matchAll(/'([^']+)'/g)].map(
  (match) => match[1],
);
if (keys.length === 0) throw new Error('TITLE_SPRITE_KEYS is empty');

const sprites = {};
for (const key of keys) {
  const rows = sheet.sprites[key];
  if (rows === undefined) throw new Error(`unknown title sprite ${key}`);
  sprites[key] = rows;
}

writeFileSync(
  outPath,
  `${JSON.stringify({ cell: sheet.cell, palette: sheet.palette, sprites }, null, 2)}\n`,
);
console.log(`wrote ${keys.length} title sprites: ${keys.join(', ')}`);
