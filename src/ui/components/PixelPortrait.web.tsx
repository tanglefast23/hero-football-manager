import { useEffect, useMemo, useState } from 'react';
import { blinkRows } from '../portrait-blink';
import {
  PIXEL_PORTRAIT_SCALE,
  portraitPixelRuns,
  portraitSheet,
  portraitSpriteKey,
  portraitSpriteRows,
  type PortraitExpression,
  type PortraitRole,
} from '../pixel-portrait-model';
import { useReducedMotion } from '../use-reduced-motion';

export interface PixelPortraitProps {
  playerId: string;
  role: PortraitRole;
  lookId?: string;
  expression?: PortraitExpression;
  /** App-level reduced-motion preference; merged with the OS setting. */
  reduceMotion?: boolean;
}

/** Web portraits avoid one WebGL context per card, which can blank long rosters. */
export function PixelPortrait({
  playerId,
  role,
  lookId,
  expression = 'rest',
  reduceMotion = false,
}: PixelPortraitProps) {
  const spriteKey = useMemo(
    () => portraitSpriteKey(playerId, role, expression, lookId),
    [expression, lookId, playerId, role],
  );
  const blinkVariant = useMemo(() => {
    const rows = portraitSheet.sprites[spriteKey];
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
    const rows = blinking && blinkVariant ? blinkVariant : portraitSpriteRows(spriteKey);
    const runs = portraitPixelRuns(rows, spriteKey);
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
  }, [blinkVariant, blinking, spriteKey]);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={portraitSheet.cell.w * PIXEL_PORTRAIT_SCALE}
      height={portraitSheet.cell.h * PIXEL_PORTRAIT_SCALE}
      viewBox={`0 0 ${portraitSheet.cell.w} ${portraitSheet.cell.h}`}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
    >
      {colorPaths.map(({ color, path }) => <path key={color} d={path} fill={color} />)}
    </svg>
  );
}
