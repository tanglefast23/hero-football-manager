import { memo, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { blinkRows } from '../portrait-blink';
import { useReducedMotion } from '../use-reduced-motion';
import {
  PIXEL_PORTRAIT_SCALE,
  PORTRAIT_CELL,
  portraitPixelRuns,
  portraitSpriteKey,
  portraitSpriteRows,
  type PortraitExpression,
  type PortraitRole,
} from '../pixel-portrait-model';
import { useClubKit } from '../club-kit-context';
import { usePixelSheets } from '../../render/sprites/use-pixel-sheets';

export interface PixelPortraitProps {
  /**
   * Draws the stock strip instead of the club's kit. For the handful of lists
   * that show OTHER clubs' players — the market's buy side and the rival
   * screens. The default is the club kit, because almost every portrait in the
   * game is one of your own.
   */
  stockKit?: boolean;
  playerId: string;
  role: PortraitRole;
  lookId?: string;
  expression?: PortraitExpression;
  /** App-level reduced-motion preference; merged with the OS setting. */
  reduceMotion?: boolean;
  /**
   * Pixels per sprite pixel. Whole numbers only — a fractional scale lands the
   * grid off the device pixel and smears a 1-bit face. Defaults to the sheet's
   * own PIXEL_PORTRAIT_SCALE.
   */
  scale?: number;
}

/** A crisp, deterministic cast portrait selected from the shipped pixel sheet. */
export const PixelPortrait = memo(function PixelPortrait({
  playerId,
  role,
  lookId,
  expression = 'rest',
  reduceMotion = false,
  scale = PIXEL_PORTRAIT_SCALE,
  stockKit = false,
}: PixelPortraitProps) {
  const pixel = Math.max(1, Math.round(scale));
  const { ownKit } = useClubKit();
  const spriteKey = useMemo(
    () => portraitSpriteKey(playerId, role, expression, lookId),
    [expression, lookId, playerId, role],
  );
  // Resident from the first render on native, where the sheet is in the one
  // bundle. `undefined` only happens on web's cold-start tick.
  const sheets = usePixelSheets();
  const blinkVariant = useMemo(() => {
    if (Platform.OS === 'ios') return null;
    const rows = sheets?.portraits.sprites[spriteKey];
    return rows === undefined ? null : blinkRows([...rows]);
  }, [sheets, spriteKey]);

  const reduce = useReducedMotion(reduceMotion);
  const canBlink = Platform.OS !== 'ios' && blinkVariant !== null && !reduce;
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
    if (sheets === undefined) return [];
    const rows =
      blinking && blinkVariant
        ? blinkVariant
        : portraitSpriteRows(sheets.portraits, spriteKey);
    // The run id doubles as the React key, so it must stay STABLE across the
    // blink: a `:blink`-prefixed id unmounted and remounted every Rect in the
    // Canvas twice per blink (open and close) instead of diffing in place.
    return portraitPixelRuns(
      sheets.portraits,
      rows,
      spriteKey,
      stockKit ? undefined : ownKit,
    );
  }, [sheets, spriteKey, blinking, blinkVariant, ownKit, stockKit]);

  return (
    <Canvas
      style={{
        width: PORTRAIT_CELL.w * pixel,
        height: PORTRAIT_CELL.h * pixel,
      }}
    >
      {runs.map((run) => (
        <Rect
          key={run.id}
          x={run.x * pixel}
          y={run.y * pixel}
          width={run.width * pixel}
          height={pixel}
          color={run.color}
        />
      ))}
    </Canvas>
  );
});
