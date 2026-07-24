import spriteData from '../render/sprites/sprites.json';

interface MatchSpriteSheet {
  readonly cell: { readonly w: number; readonly h: number };
  readonly palette: Readonly<Record<string, string | null>>;
  readonly sprites: Readonly<Record<string, readonly string[]>>;
}

export interface MatchSpriteRun {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: string;
}

export const titleMatchSpriteSheet = spriteData as MatchSpriteSheet;

export function titleMatchSpriteRows(spriteKey: string): readonly string[] {
  if (spriteKey.endsWith(':ignited')) {
    const ordinaryKey = spriteKey.slice(0, -':ignited'.length);
    const ordinaryRows = titleMatchSpriteSheet.sprites[ordinaryKey];
    if (ordinaryRows === undefined) throw new Error(`unknown title match sprite ${spriteKey}`);
    return ordinaryRows.map(row => [...row].map(token => {
      if (token === '.') return '.';
      const color = titleMatchSpriteSheet.palette[token];
      if (color === null || color === undefined) return 'F';
      const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
      if (!match) return 'F';
      const red = Number.parseInt(match[1], 16);
      const green = Number.parseInt(match[2], 16);
      const blue = Number.parseInt(match[3], 16);
      const luminance = (299 * red + 587 * green + 114 * blue) / 1000;
      if (luminance < 70) return 'K';
      if (luminance < 145) return 'o';
      if (luminance < 215) return 'F';
      return 'A';
    }).join(''));
  }
  if (spriteKey.endsWith(':webbed')) {
    const ordinaryKey = spriteKey.slice(0, -':webbed'.length);
    const ordinaryRows = titleMatchSpriteSheet.sprites[ordinaryKey];
    if (ordinaryRows === undefined) throw new Error(`unknown title match sprite ${spriteKey}`);
    return ordinaryRows.map(row => [...row].map(token => {
      if (token === '.') return '.';
      const color = titleMatchSpriteSheet.palette[token];
      if (color === null || color === undefined) return 'G';
      const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
      if (!match) return 'G';
      const red = Number.parseInt(match[1], 16);
      const green = Number.parseInt(match[2], 16);
      const blue = Number.parseInt(match[3], 16);
      const luminance = (299 * red + 587 * green + 114 * blue) / 1000;
      if (luminance < 70) return 'K';
      if (luminance < 125) return 'g';
      if (luminance < 190) return 'G';
      if (luminance < 235) return 'w';
      return 'W';
    }).join(''));
  }
  const rows = titleMatchSpriteSheet.sprites[spriteKey];
  if (rows === undefined) throw new Error(`unknown title match sprite ${spriteKey}`);
  return rows;
}

export function titleMatchSpriteRuns(spriteKey: string): MatchSpriteRun[] {
  const rows = titleMatchSpriteRows(spriteKey);
  const runs: MatchSpriteRun[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const paletteKey = row[x];
      const color = titleMatchSpriteSheet.palette[paletteKey];
      if (color === null || color === undefined) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === paletteKey) end += 1;
      runs.push({
        id: `${spriteKey}-${y}-${x}`,
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
