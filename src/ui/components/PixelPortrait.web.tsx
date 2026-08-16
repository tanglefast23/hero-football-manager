import { useEffect, useMemo, useState } from 'react';
import { blinkRows } from '../portrait-blink';
import {
  PIXEL_PORTRAIT_SCALE,
  PORTRAIT_CELL,
  portraitPixelRuns,
  portraitSpriteKey,
  portraitSpriteRows,
  type PortraitExpression,
  type PortraitRole,
} from '../pixel-portrait-model';
import { usePixelSheets } from '../../render/sprites/use-pixel-sheets';
import { useReducedMotion } from '../use-reduced-motion';

export interface PixelPortraitProps {
  playerId: string;
  role: PortraitRole;
  lookId?: string;
  expression?: PortraitExpression;
  /** App-level reduced-motion preference; merged with the OS setting. */
  reduceMotion?: boolean;
  /** Pixels per sprite pixel; compact lineup cards use a smaller whole scale. */
  scale?: number;
}

/** Web portraits avoid one WebGL context per card, which can blank long rosters. */
export function PixelPortrait({
  playerId,
  role,
  lookId,
  expression = 'rest',
  reduceMotion = false,
  scale = PIXEL_PORTRAIT_SCALE,
}: PixelPortraitProps) {
  const pixel = Math.max(1, Math.round(scale));
  const spriteKey = useMemo(
    () => portraitSpriteKey(playerId, role, expression, lookId),
    [expression, lookId, playerId, role],
  );
  // The portrait sheet is its own chunk on web, prefetched by App at module
  // eval. `undefined` is the cold-start tick: draw the empty cell, at full
  // size, so the roster never reflows when the faces arrive.
  const sheets = usePixelSheets();
  const blinkVariant = useMemo(() => {
    const rows = sheets?.portraits.sprites[spriteKey];
    return rows === undefined ? null : blinkRows([...rows]);
  }, [sheets, spriteKey]);

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

  const colorPaths = useMemo(() => {
    if (sheets === undefined) return [];
    const rows =
      blinking && blinkVariant
        ? blinkVariant
        : portraitSpriteRows(sheets.portraits, spriteKey);
    const runs = portraitPixelRuns(sheets.portraits, rows, spriteKey);
    const commandsByColor = new Map<string, string[]>();
    for (const run of runs) {
      const commands = commandsByColor.get(run.color) ?? [];
      commands.push(`M${run.x} ${run.y}h${run.width}v1h-${run.width}z`);
      commandsByColor.set(run.color, commands);
    }
    return Array.from(commandsByColor, ([color, commands]) => ({
      color,
      path: commands.join(''),
    }));
  }, [blinkVariant, blinking, sheets, spriteKey]);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={PORTRAIT_CELL.w * pixel}
      height={PORTRAIT_CELL.h * pixel}
      viewBox={`0 0 ${PORTRAIT_CELL.w} ${PORTRAIT_CELL.h}`}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
    >
      {colorPaths.map(({ color, path }) => (
        <path key={color} d={path} fill={color} />
      ))}
    </svg>
  );
}
