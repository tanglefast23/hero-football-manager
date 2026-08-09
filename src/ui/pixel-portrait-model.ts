import portraitData from '../render/sprites/portraits.json';
import { playerLookId } from '../render/sprites/player-look';

export type PortraitExpression = 'rest' | 'joy' | 'ko';
export type PortraitRole = 'GK' | 'DEF' | 'MID' | 'FWD';

interface PortraitSheet {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

export interface PixelRun {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
}

export const portraitSheet = portraitData as PortraitSheet;
export const PIXEL_PORTRAIT_SCALE = 5;

export function portraitSpriteKey(
  playerId: string,
  role: PortraitRole,
  expression: PortraitExpression,
  lookId?: string,
): string {
  return `${playerLookId(playerId, role, lookId)}:${expression}`;
}

export function portraitSpriteRows(spriteKey: string): string[] {
  const rows = portraitSheet.sprites[spriteKey];
  if (rows === undefined)
    throw new Error(`unknown portrait sprite ${spriteKey}`);
  return rows;
}

export function portraitPixelRuns(
  rows: string[],
  idPrefix: string,
): PixelRun[] {
  const runs: PixelRun[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const paletteKey = row[x];
      const color = portraitSheet.palette[paletteKey];
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
