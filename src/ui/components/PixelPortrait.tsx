import { useMemo } from 'react';
import { Canvas, Rect } from '@shopify/react-native-skia';
import portraitData from '../../render/sprites/portraits.json';

type PortraitExpression = 'rest' | 'joy' | 'ko';

interface PortraitSheet {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

interface PixelRun {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
}

const sheet = portraitData as PortraitSheet;
const PIXEL_SCALE = 5;

export interface PixelPortraitProps {
  playerId: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  expression?: PortraitExpression;
}

/** A crisp, deterministic cast portrait selected from the shipped pixel sheet. */
export function PixelPortrait({
  playerId,
  role,
  expression = 'rest',
}: PixelPortraitProps) {
  const spriteKey = useMemo(
    () => portraitKey(playerId, role, expression),
    [expression, playerId, role],
  );
  const runs = useMemo(() => pixelRuns(spriteKey), [spriteKey]);

  return (
    <Canvas
      style={{
        width: sheet.cell.w * PIXEL_SCALE,
        height: sheet.cell.h * PIXEL_SCALE,
      }}
    >
      {runs.map(run => (
        <Rect
          key={run.id}
          x={run.x * PIXEL_SCALE}
          y={run.y * PIXEL_SCALE}
          width={run.width * PIXEL_SCALE}
          height={PIXEL_SCALE}
          color={run.color}
        />
      ))}
    </Canvas>
  );
}

function portraitKey(
  playerId: string,
  role: PixelPortraitProps['role'],
  expression: PortraitExpression,
): string {
  if (role === 'GK') return `r0:${expression}`;
  const slot = 1 + (stableHash(playerId) % 10);
  return `r${slot}:${expression}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pixelRuns(spriteKey: string): PixelRun[] {
  const rows = sheet.sprites[spriteKey];
  if (rows === undefined) throw new Error(`unknown portrait sprite ${spriteKey}`);
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
