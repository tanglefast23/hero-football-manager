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
const FRAMES = ['run0', 'run1', 'back0', 'back1'];
const GOALKEEPER_IDS = ['r', 'u'].flatMap(side => (
  GOALKEEPER_LOOK_IDS.map(lookId => `${side}:${lookId}`)
));
const GOALKEEPER_FRAMES = ['ready0', 'ready1', 'backReady0', 'backReady1'];
const BALL_KEY = 'ball';
const BALL_SIZE = 6;
const SLIDE_FRAME_PATTERN = /:slide\d+(?::webbed)?$/;

const FRONT_FRAME_PATTERN = /:(run0|run1|ready0|ready1)$/;

function mostCommonToken(
  rows: readonly string[],
  fromRow: number,
  toRow: number,
  excluded: ReadonlySet<string>,
): string {
  const counts = new Map<string, number>();
  for (let row = fromRow; row <= Math.min(toRow, rows.length - 1); row += 1) {
    for (const token of rows[row]) {
      if (excluded.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'K';
}

// Boots live below the shorts hem, and are the only white/off-white pixels down
// there, so a boot is exactly a run of columns carrying W/w in this band.
const BOOT_BAND_TOP = 26;
const SOLE_FOR: Readonly<Record<string, string>> = { W: 'G', w: 'g' };

function bootColumnGroups(rows: readonly string[]): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  for (let column = 0; column < (rows[BOOT_BAND_TOP]?.length ?? 0); column += 1) {
    const isBoot = rows.slice(BOOT_BAND_TOP)
      .some(row => SOLE_FOR[row[column]] !== undefined);
    if (!isBoot) continue;
    const previous = groups[groups.length - 1];
    if (previous !== undefined && previous.end === column - 1) previous.end = column;
    else groups.push({ start: column, end: column });
  }
  return groups;
}

function bootBottomRow(rows: readonly string[], group: { start: number; end: number }): number {
  let bottom = -1;
  for (let row = BOOT_BAND_TOP; row < rows.length; row += 1) {
    for (let column = group.start; column <= group.end; column += 1) {
      if (SOLE_FOR[rows[row][column]] !== undefined) bottom = row;
    }
  }
  return bottom;
}

/**
 * Running away from the camera, the trailing boot is the near one: its heel is
 * up and the sole faces us, while the far boot shows only its heel. Just the
 * alternating-stride art carries that information (one boot lifted, one
 * planted), so the swap is a no-op on any look whose feet are still authored
 * level — those keep the front boots they always had.
 */
function withRearSoles(rows: readonly string[]): string[] {
  const groups = bootColumnGroups(rows);
  if (groups.length < 2) return [...rows];
  const bottoms = groups.map(group => bootBottomRow(rows, group));
  const nearest = Math.max(...bottoms);
  if (bottoms.every(bottom => bottom === nearest)) return [...rows];

  const soleColumns = groups
    .filter((_, index) => bottoms[index] === nearest)
    .flatMap(group => Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i));
  return rows.map((row, index) => {
    if (index < BOOT_BAND_TOP) return row;
    const tokens = [...row];
    for (const column of soleColumns) {
      const sole = SOLE_FOR[tokens[column]];
      if (sole !== undefined) tokens[column] = sole;
    }
    return tokens.join('');
  });
}

/**
 * The authored player sheet is front-facing. A vertical pitch also needs a
 * readable rear view for the side attacking toward the top goal. Preserve the
 * exact silhouette, hair, skin, kit, and stride, while replacing face and
 * shirt-front details with the back of the head and jersey, and turning the
 * near boot sole-side out. This runs once while the atlas is built, never
 * during a match frame.
 */
export function deriveBackFacingFrame(front: readonly string[]): string[] {
  const hair = mostCommonToken(front, 0, 6, new Set(['.', 'K']));
  const skin = mostCommonToken(front, 7, 14, new Set(['.', 'K', 'W', 'w']));
  const kit = mostCommonToken(front, 16, 23, new Set(['.', 'K', 'W', 'w', skin]));

  return withRearSoles(front.map((source, row) => {
    if (row < 7 || row > 23) return source;
    const tokens = [...source];
    const painted = tokens.flatMap((token, column) => token === '.' ? [] : [column]);
    if (painted.length < 2) return source;
    const first = painted[0];
    const last = painted[painted.length - 1];
    for (let column = first + 1; column < last; column += 1) {
      if (tokens[column] === '.') continue;
      if (row <= 12) tokens[column] = hair;
      else if (row <= 14) tokens[column] = skin;
      else if (tokens[column] === 'W' || tokens[column] === 'w') tokens[column] = kit;
    }
    return tokens.join('');
  }));
}

function backFrameName(frontFrame: string): string {
  if (frontFrame === 'run0') return 'back0';
  if (frontFrame === 'run1') return 'back1';
  if (frontFrame === 'ready0') return 'backReady0';
  return 'backReady1';
}

function withBackFacingSprites(sheet: SpriteSheet): SpriteSheet {
  const sprites = { ...sheet.sprites };
  for (const [key, rows] of Object.entries(sheet.sprites)) {
    const match = key.match(FRONT_FRAME_PATTERN);
    if (!match) continue;
    const visualId = key.slice(0, -match[0].length);
    sprites[`${visualId}:${backFrameName(match[1])}`] = deriveBackFacingFrame(rows);
  }
  return { ...sheet, sprites };
}

const WEBBED_SUFFIX = ':webbed';

/**
 * Web Trap is a body state, not a translucent wash. Build a palette-locked
 * monochrome copy of the exact current player frame so skin, hair, kit and
 * outline all read grey from head to toe without losing the real silhouette.
 */
export function webbedSpriteKey(spriteKey: string): string {
  return `${spriteKey}${WEBBED_SUFFIX}`;
}

function greyTokenFor(color: string | null): string {
  if (color === null) return '.';
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return 'Q';
  const red = Number.parseInt(match[1], 16);
  const green = Number.parseInt(match[2], 16);
  const blue = Number.parseInt(match[3], 16);
  const luminance = (299 * red + 587 * green + 114 * blue) / 1000;
  if (luminance < 70) return 'K';
  if (luminance < 125) return 'g';
  if (luminance < 190) return 'G';
  if (luminance < 235) return 'w';
  return 'W';
}

export function deriveWebbedFrame(
  rows: readonly string[],
  palette: Readonly<Record<string, string | null>>,
): string[] {
  return rows.map(row => [...row].map(token => (
    token === '.' ? '.' : greyTokenFor(palette[token] ?? null)
  )).join(''));
}

function withWebbedSprites(sheet: SpriteSheet): SpriteSheet {
  const sprites = { ...sheet.sprites };
  for (const [key, rows] of Object.entries(sheet.sprites)) {
    // A webbed player is rooted in the standing pose. Generating thousands of
    // impossible webbed slide frames bloats every match Atlas and the full
    // roster contract without adding a state the renderer can legitimately use.
    if (key === BALL_KEY || key.endsWith(WEBBED_SUFFIX) || SLIDE_FRAME_PATTERN.test(key)) continue;
    sprites[webbedSpriteKey(key)] = deriveWebbedFrame(rows, sheet.palette);
  }
  return { ...sheet, sprites };
}

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
  const sheet = withWebbedSprites(
    withSlideTackleSprites(withBackFacingSprites({ ...baseSheet, sprites: selectedSprites })),
  );

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
