// Pure TS sprite-sheet loader + atlas layout math. No React Native / Skia / Expo imports,
// no Math.random / Date.now — safe to unit test headless.
import sheetData from './sprites.json';

export interface SpriteSheet {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

const PLAYER_IDS = [
  'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10',
  'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10',
];
const FRAMES = ['run0', 'run1'];
const GOALKEEPER_IDS = ['r0', 'u0'];
const GOALKEEPER_FRAMES = ['ready0', 'ready1'];
const BALL_KEY = 'ball';
const BALL_SIZE = 6;

function requiredKeys(): string[] {
  const keys: string[] = [];
  for (const id of PLAYER_IDS) for (const frame of FRAMES) keys.push(`${id}:${frame}`);
  for (const id of GOALKEEPER_IDS) for (const frame of GOALKEEPER_FRAMES) keys.push(`${id}:${frame}`);
  keys.push(BALL_KEY);
  return keys;
}

/**
 * Loads and validates the sprite sheet. Throws with a specific message on any
 * structural violation: missing required sprite, wrong row count/width, or a
 * character used in a sprite row that isn't a palette key.
 */
export function loadSpriteSheet(): SpriteSheet {
  const sheet = sheetData as SpriteSheet;

  if (!sheet.cell || sheet.cell.w <= 0 || sheet.cell.h <= 0) {
    throw new Error('loadSpriteSheet: sheet.cell must have positive w/h');
  }
  if (!sheet.palette || !('.' in sheet.palette)) {
    throw new Error('loadSpriteSheet: palette must define the transparent "." key');
  }

  for (const key of requiredKeys()) {
    if (!(key in sheet.sprites)) {
      throw new Error(`loadSpriteSheet: missing required sprite "${key}"`);
    }
  }

  for (const [key, rows] of Object.entries(sheet.sprites)) {
    const isBall = key === BALL_KEY;
    const expectedH = isBall ? BALL_SIZE : sheet.cell.h;
    const expectedW = isBall ? BALL_SIZE : sheet.cell.w;

    if (rows.length !== expectedH) {
      throw new Error(`loadSpriteSheet: sprite "${key}" has ${rows.length} rows, expected ${expectedH}`);
    }
    rows.forEach((row, i) => {
      if (row.length !== expectedW) {
        throw new Error(
          `loadSpriteSheet: sprite "${key}" row ${i} has width ${row.length}, expected ${expectedW}`
        );
      }
      for (const ch of row) {
        if (!(ch in sheet.palette)) {
          throw new Error(`loadSpriteSheet: sprite "${key}" row ${i} uses char "${ch}" not present in palette`);
        }
      }
    });
  }

  return sheet;
}

export interface AtlasLayout {
  cols: number;
  rows: number;
  rectFor(key: string): { x: number; y: number; w: number; h: number };
}

/**
 * Deterministic grid layout: sprite keys sorted alphabetically, assigned to a
 * fixed 8-column grid using the sheet's cell size for slot positioning. Each
 * rect's w/h reflects the sprite's own pixel dimensions (so the 6x6 ball sits
 * tightly in the top-left corner of its 16x20 slot, not stretched to fill it).
 * Pure math — no Skia/RN dependency, safe to unit test.
 */
export function atlasLayout(sheet: SpriteSheet): AtlasLayout {
  const keys = Object.keys(sheet.sprites).sort();
  const cols = 8;
  const rows = Math.ceil(keys.length / cols);
  const cellW = sheet.cell.w;
  const cellH = sheet.cell.h;
  const indexOf = new Map(keys.map((k, i) => [k, i]));

  function rectFor(key: string): { x: number; y: number; w: number; h: number } {
    const i = indexOf.get(key);
    if (i === undefined) {
      throw new Error(`atlasLayout: unknown sprite key "${key}"`);
    }
    const col = i % cols;
    const row = Math.floor(i / cols);
    const frame = sheet.sprites[key];
    const h = frame.length;
    const w = h > 0 ? frame[0].length : 0;
    return { x: col * cellW, y: row * cellH, w, h };
  }

  return { cols, rows, rectFor };
}
