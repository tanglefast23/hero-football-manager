import { useEffect, useMemo, useState } from 'react';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { blinkRows } from '../portrait-blink';
import { useReducedMotion } from '../use-reduced-motion';
import {
  PIXEL_PORTRAIT_SCALE,
  portraitPixelRuns,
  portraitSheet,
  portraitSpriteKey,
  portraitSpriteRows,
  type PortraitExpression,
  type PortraitRole,
} from '../pixel-portrait-model';

export interface PixelPortraitProps {
  playerId: string;
  role: PortraitRole;
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
    const rows = blinking && blinkVariant ? blinkVariant : portraitSpriteRows(spriteKey);
    // The run id doubles as the React key, so it must stay STABLE across the
    // blink: a `:blink`-prefixed id unmounted and remounted every Rect in the
    // Canvas twice per blink (open and close) instead of diffing in place.
    return portraitPixelRuns(rows, spriteKey);
  }, [spriteKey, blinking, blinkVariant]);

  return (
    <Canvas
      style={{
        width: portraitSheet.cell.w * PIXEL_PORTRAIT_SCALE,
        height: portraitSheet.cell.h * PIXEL_PORTRAIT_SCALE,
      }}
    >
      {runs.map(run => (
        <Rect
          key={run.id}
          x={run.x * PIXEL_PORTRAIT_SCALE}
          y={run.y * PIXEL_PORTRAIT_SCALE}
          width={run.width * PIXEL_PORTRAIT_SCALE}
          height={PIXEL_PORTRAIT_SCALE}
          color={run.color}
        />
      ))}
    </Canvas>
  );
}
