// Portrait key + pixel-run math. The 1.36 MB `portraits.json` is NOT imported
// here: the sheet is passed in, so on web it can be a chunk fetched after
// first paint instead of 1.36 MB of object literal in front of it. The owner
// is `src/render/sprites/pixel-sheets.ts`.
import { playerLookId } from '../render/sprites/player-look';
import {
  kitResolvedColor,
  type KitSideRewrite,
} from '../render/sprites/club-kit';
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

/**
 * The shirt rows of a 24x29 portrait cell. Twelve rows, not the pitch sprite's
 * eight: a portrait is framed at the chest, so the jersey runs all the way to
 * the bottom outline.
 */
export const PORTRAIT_JERSEY_BAND = { top: 16, bottom: 27 } as const;

/** Shade, body, light. Portraits ship in the home kit only. */
const PORTRAIT_KIT_TOKENS = ['r', 'R', 'E'] as const;

const portraitPixelColor = (
  sheet: PortraitSheet,
  token: string,
  y: number,
  x: number,
  kit: KitSideRewrite | undefined,
) =>
  kitResolvedColor(
    sheet.palette,
    token,
    y,
    x,
    PORTRAIT_JERSEY_BAND,
    PORTRAIT_KIT_TOKENS,
    kit,
  );

export function portraitPixelRuns(
  sheet: PortraitSheet,
  rows: readonly string[],
  idPrefix: string,
  kit?: KitSideRewrite,
): PixelRun[] {
  const runs: PixelRun[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      // Runs collapse on the RESOLVED colour, not on the token: a stripe puts
      // two colours on the same token in one row, and collapsing by token would
      // paint the whole run in the first one.
      const color = portraitPixelColor(sheet, row[x], y, x, kit);
      if (color === null || color === undefined) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (
        end < row.length &&
        portraitPixelColor(sheet, row[end], y, end, kit) === color
      )
        end += 1;
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
