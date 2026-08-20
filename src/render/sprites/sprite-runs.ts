// Pure pixel-run math over a sprite sheet, with the sheet passed in rather
// than imported. That parameter is the whole point: the title screen binds it
// to the 14 KB `title-sprites.json` subset while the in-game surfaces bind it
// to the full 1.98 MB `sprites.json`, which stays out of the web first load.
//
// No React Native / Skia / Expo imports, no Math.random / Date.now.

import {
  kitResolvedColor,
  type KitBand,
  type KitPrefix,
  type KitSideRewrite,
} from './club-kit';

export interface MatchSpriteSheet {
  readonly cell: { readonly w: number; readonly h: number };
  readonly palette: Readonly<Record<string, string | null>>;
  readonly sprites: Readonly<Record<string, readonly string[]>>;
}

/** `portraits.json`. Same shape as the match sheet, different cell. */
export interface PortraitSheetData {
  readonly cell: { readonly w: number; readonly h: number };
  readonly palette: Readonly<Record<string, string | null>>;
  readonly sprites: Readonly<Record<string, readonly string[]>>;
}

/** What `pixel-sheets.ts` and its web override both hand out. */
export interface PixelSheets {
  readonly sprites: MatchSpriteSheet;
  readonly portraits: PortraitSheetData;
}

export interface MatchSpriteRun {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: string;
}

/** Recolours a sprite's rows, token by token, by their palette luminance. */
function recolourByLuminance(
  sheet: MatchSpriteSheet,
  rows: readonly string[],
  fallback: string,
  pick: (luminance: number) => string,
): readonly string[] {
  return rows.map((row) =>
    [...row]
      .map((token) => {
        if (token === '.') return '.';
        const color = sheet.palette[token];
        if (color === null || color === undefined) return fallback;
        const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
        if (!match) return fallback;
        const red = Number.parseInt(match[1], 16);
        const green = Number.parseInt(match[2], 16);
        const blue = Number.parseInt(match[3], 16);
        return pick((299 * red + 587 * green + 114 * blue) / 1000);
      })
      .join(''),
  );
}

export function spriteRows(
  sheet: MatchSpriteSheet,
  spriteKey: string,
): readonly string[] {
  if (spriteKey.endsWith(':ignited')) {
    return recolourByLuminance(
      sheet,
      baseRows(sheet, spriteKey, ':ignited'),
      'F',
      (luminance) => {
        if (luminance < 70) return 'K';
        if (luminance < 145) return 'o';
        if (luminance < 215) return 'F';
        return 'A';
      },
    );
  }
  if (spriteKey.endsWith(':webbed')) {
    return recolourByLuminance(
      sheet,
      baseRows(sheet, spriteKey, ':webbed'),
      'G',
      (luminance) => {
        if (luminance < 70) return 'K';
        if (luminance < 125) return 'g';
        if (luminance < 190) return 'G';
        if (luminance < 235) return 'w';
        return 'W';
      },
    );
  }
  const rows = sheet.sprites[spriteKey];
  if (rows === undefined) throw new Error(`unknown sprite ${spriteKey}`);
  return rows;
}

function baseRows(
  sheet: MatchSpriteSheet,
  spriteKey: string,
  suffix: string,
): readonly string[] {
  const ordinaryKey = spriteKey.slice(0, -suffix.length);
  const ordinaryRows = sheet.sprites[ordinaryKey];
  if (ordinaryRows === undefined)
    throw new Error(`unknown sprite ${spriteKey}`);
  return ordinaryRows;
}

/** Rows of an authored 24x30 player cell that hold the shirt. */
const SPRITE_JERSEY_BAND: KitBand = { top: 16, bottom: 23 };
const SPRITE_KIT_TOKENS: Readonly<
  Record<KitPrefix, readonly [string, string, string]>
> = { r: ['r', 'R', 'E'], u: ['b', 'B', 'C'] };

export function spriteRuns(
  sheet: MatchSpriteSheet,
  spriteKey: string,
  kit?: KitSideRewrite,
): MatchSpriteRun[] {
  const rows = spriteRows(sheet, spriteKey);
  const runs: MatchSpriteRun[] = [];
  const prefix: KitPrefix = spriteKey.startsWith('u:') ? 'u' : 'r';
  const colorAt = (token: string, y: number, x: number) =>
    kitResolvedColor(
      sheet.palette,
      token,
      y,
      x,
      SPRITE_JERSEY_BAND,
      SPRITE_KIT_TOKENS[prefix],
      kit,
    );

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      // Collapsed on the RESOLVED colour, not on the token: a stripe puts two
      // colours on the same token inside one row.
      const color = colorAt(row[x], y, x);
      if (color === null || color === undefined) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && colorAt(row[end], y, end) === color) end += 1;
      runs.push({ id: `${spriteKey}-${y}-${x}`, x, y, width: end - x, color });
      x = end;
    }
  });

  return runs;
}
