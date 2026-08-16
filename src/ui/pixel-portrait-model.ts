// Portrait key + pixel-run math. The 1.36 MB `portraits.json` is NOT imported
// here: the sheet is passed in, so on web it can be a chunk fetched after
// first paint instead of 1.36 MB of object literal in front of it. The owner
// is `src/render/sprites/pixel-sheets.ts`.
import { playerLookId } from '../render/sprites/player-look';
import type { PortraitSheetData } from '../render/sprites/sprite-runs';

export type PortraitExpression = 'rest' | 'joy' | 'ko';
export type PortraitRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PortraitSheet = PortraitSheetData;

export interface PixelRun {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
}

export const PIXEL_PORTRAIT_SCALE = 5;

/**
 * The portrait cell, as a literal. Reading it off the sheet would make a
 * portrait's own box wait for a chunk that has not arrived yet, and the roster
 * would reflow when it did. Held to `portraits.json` by `portraits.test.ts`.
 */
export const PORTRAIT_CELL = { w: 24, h: 29 };

export function portraitSpriteKey(
  playerId: string,
  role: PortraitRole,
  expression: PortraitExpression,
  lookId?: string,
): string {
  return `${playerLookId(playerId, role, lookId)}:${expression}`;
}

export function portraitSpriteRows(
  sheet: PortraitSheet,
  spriteKey: string,
): readonly string[] {
  const rows = sheet.sprites[spriteKey];
  if (rows === undefined)
    throw new Error(`unknown portrait sprite ${spriteKey}`);
  return rows;
}

export function portraitPixelRuns(
  sheet: PortraitSheet,
  rows: readonly string[],
  idPrefix: string,
): PixelRun[] {
  const runs: PixelRun[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const paletteKey = row[x];
      const color = sheet.palette[paletteKey];
      if (color === null || color === undefined) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === paletteKey) end += 1;
      runs.push({
        id: `${idPrefix}-${y}-${x}`,
        x,
        y,
        width: end - x,
        color,
      });
      x = end;
    }
  });

  return runs;
}
