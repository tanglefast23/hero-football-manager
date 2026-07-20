import { useEffect, useMemo, useState } from 'react';
import { Canvas, Rect } from '@shopify/react-native-skia';
import portraitData from '../../render/sprites/portraits.json';
import { blinkRows } from '../portrait-blink';
import { useReducedMotion } from '../use-reduced-motion';
import { playerLookId } from '../../render/sprites/player-look';

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
  lookId?: string;
  expression?: PortraitExpression;
  /** App-level reduced-motion preference; merged with the OS setting. */
  reduceMotion?: boolean;
}

/** A crisp, deterministic cast portrait selected from the shipped pixel sheet. */
export function PixelPortrait({
  playerId,
  role,
  lookId,
  expression = 'rest',
  reduceMotion = false,
}: PixelPortraitProps) {
  const spriteKey = useMemo(
    () => portraitKey(playerId, role, expression, lookId),
    [expression, lookId, playerId, role],
  );
  const blinkVariant = useMemo(() => {
    const rows = sheet.sprites[spriteKey];
    return rows === undefined ? null : blinkRows(rows);
  }, [spriteKey]);

  const reduce = useReducedMotion(reduceMotion);
  const canBlink = blinkVariant !== null && !reduce;
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!canBlink) {
      setBlinking(false);
      return undefined;
    }
    let openTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      // Randomize per portrait so a screen full of faces doesn't blink in sync.
      const delay = 2600 + Math.random() * 3400;
      openTimer = setTimeout(() => {
        setBlinking(true);
        closeTimer = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [canBlink, spriteKey]);

  const runs = useMemo(() => {
    const rows = blinking && blinkVariant ? blinkVariant : spriteRows(spriteKey);
    return pixelRuns(rows, blinking ? `${spriteKey}:blink` : spriteKey);
  }, [spriteKey, blinking, blinkVariant]);

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
  lookId?: string,
): string {
  return `${playerLookId(playerId, role, lookId)}:${expression}`;
}

function spriteRows(spriteKey: string): string[] {
  const rows = sheet.sprites[spriteKey];
  if (rows === undefined) throw new Error(`unknown portrait sprite ${spriteKey}`);
  return rows;
}

function pixelRuns(rows: string[], idPrefix: string): PixelRun[] {
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
