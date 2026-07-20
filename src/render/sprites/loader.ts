// Pure TS sprite-sheet loader + atlas layout math. No React Native / Skia / Expo imports,
// no Math.random / Date.now — safe to unit test headless.
import sheetData from './sprites.json';
import { FIELD_PLAYER_LOOK_IDS, GOALKEEPER_LOOK_IDS } from './player-look';
import {
  SLIDE_TACKLE_CELL,
  SLIDE_TACKLE_FRAME_COUNT,
  slideTackleSpriteFrame,
  withSlideTackleSprites,
} from './slide-tackle';

export interface SpriteSheet {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

const PLAYER_IDS = ['r', 'u'].flatMap(side => [
  ...FIELD_PLAYER_LOOK_IDS.map(lookId => `${side}:${lookId}`),
  ...GOALKEEPER_LOOK_IDS.map(lookId => `${side}:${lookId}`),
]);
const FRAMES = ['run0', 'run1'];
const GOALKEEPER_IDS = ['r', 'u'].flatMap(side => (
  GOALKEEPER_LOOK_IDS.map(lookId => `${side}:${lookId}`)
));
const GOALKEEPER_FRAMES = ['ready0', 'ready1'];
const BALL_KEY = 'ball';
const BALL_SIZE = 6;
const SLIDE_FRAME_PATTERN = /:slide\d+$/;

// Keep every source rect away from its neighbours. This prevents transformed
// sprites from ever sampling a shoe/hair pixel from the next atlas cell.
export const ATLAS_GUTTER = 1;

function requiredKeys(playerIds: readonly string[]): string[] {
  const keys: string[] = [];
  for (const id of playerIds) for (const frame of FRAMES) keys.push(`${id}:${frame}`);
  for (const id of playerIds.filter(candidate => GOALKEEPER_IDS.includes(candidate))) {
    for (const frame of GOALKEEPER_FRAMES) keys.push(`${id}:${frame}`);
  }
  for (const id of playerIds) {
    for (let frame = 0; frame < SLIDE_TACKLE_FRAME_COUNT; frame += 1) {
      keys.push(`${id}:${slideTackleSpriteFrame(frame)}`);
    }
  }
  keys.push(BALL_KEY);
  return keys;
}

/**
 * Loads and validates the sprite sheet. Throws with a specific message on any
 * structural violation: missing required sprite, wrong row count/width, or a
 * character used in a sprite row that isn't a palette key.
 */
export function loadSpriteSheet(visualIds: readonly string[] = PLAYER_IDS): SpriteSheet {
  const baseSheet = sheetData as SpriteSheet;

  if (!baseSheet.cell || baseSheet.cell.w <= 0 || baseSheet.cell.h <= 0) {
    throw new Error('loadSpriteSheet: sheet.cell must have positive w/h');
  }
  if (!baseSheet.palette || !('.' in baseSheet.palette)) {
    throw new Error('loadSpriteSheet: palette must define the transparent "." key');
  }

  // Validate the authored pack before deriving action art so malformed source
  // sprites fail at their own key rather than inside the pose generator.
  for (const [key, rows] of Object.entries(baseSheet.sprites)) {
    const isBall = key === BALL_KEY;
    const expectedH = isBall ? BALL_SIZE : baseSheet.cell.h;
    const expectedW = isBall ? BALL_SIZE : baseSheet.cell.w;
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
        if (!(ch in baseSheet.palette)) {
          throw new Error(`loadSpriteSheet: sprite "${key}" row ${i} uses char "${ch}" not present in palette`);
        }
      }
    });
  }

  const uniqueVisualIds = [...new Set(visualIds)];
  for (const id of uniqueVisualIds) {
    if (!baseSheet.sprites[`${id}:run0`] || !baseSheet.sprites[`${id}:run1`]) {
      throw new Error(`loadSpriteSheet: unknown player visual ID "${id}"`);
    }
  }
  const selectedSprites: Record<string, string[]> = { [BALL_KEY]: baseSheet.sprites[BALL_KEY] };
  for (const id of uniqueVisualIds) for (const [key, rows] of Object.entries(baseSheet.sprites)) {
    if (key.startsWith(`${id}:`)) selectedSprites[key] = rows;
  }
  const sheet = withSlideTackleSprites({ ...baseSheet, sprites: selectedSprites });

  for (const key of requiredKeys(uniqueVisualIds)) {
    if (!(key in sheet.sprites)) {
      throw new Error(`loadSpriteSheet: missing required sprite "${key}"`);
    }
  }

  for (const [key, rows] of Object.entries(sheet.sprites)) {
    const isBall = key === BALL_KEY;
    const isSlideFrame = SLIDE_FRAME_PATTERN.test(key);
    const expectedH = isBall ? BALL_SIZE : isSlideFrame ? SLIDE_TACKLE_CELL.h : sheet.cell.h;
    const expectedW = isBall ? BALL_SIZE : isSlideFrame ? SLIDE_TACKLE_CELL.w : sheet.cell.w;

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
  slotW: number;
  slotH: number;
  rectFor(key: string): { x: number; y: number; w: number; h: number };
}

/**
 * Deterministic grid layout: sprite keys sorted alphabetically, assigned to a
 * fixed 8-column grid with a transparent gutter around every cell. Each
 * rect's w/h reflects the sprite's own pixel dimensions (so the 6x6 ball sits
 * tightly in the top-left corner of its 16x20 slot, not stretched to fill it).
 * Pure math — no Skia/RN dependency, safe to unit test.
 */
export function atlasLayout(sheet: SpriteSheet): AtlasLayout {
  const keys = Object.keys(sheet.sprites).sort();
  const cols = 8;
  const rows = Math.ceil(keys.length / cols);
  const maxFrameWidth = Math.max(...Object.values(sheet.sprites).map(frame => frame[0]?.length ?? 0));
  const maxFrameHeight = Math.max(...Object.values(sheet.sprites).map(frame => frame.length));
  const slotW = maxFrameWidth + ATLAS_GUTTER * 2;
  const slotH = maxFrameHeight + ATLAS_GUTTER * 2;
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
    return {
      x: col * slotW + ATLAS_GUTTER,
      y: row * slotH + ATLAS_GUTTER,
      w,
      h,
    };
  }

  return { cols, rows, slotW, slotH, rectFor };
}
