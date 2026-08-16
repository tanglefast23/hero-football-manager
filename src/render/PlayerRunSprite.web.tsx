import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { playerLookId } from './sprites/player-look';
import { spriteRuns } from './sprites/sprite-runs';
import { usePixelSheets } from './sprites/use-pixel-sheets';

const CELL_WIDTH = 24;
const CELL_HEIGHT = 30;
const STEP_MS = 130;

export interface PlayerRunSpriteProps {
  playerId: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  side?: 'home' | 'away';
  scale?: number;
  walking?: boolean;
  accessibilityLabel?: string;
}

/** Web draws one sprite with positioned pixel runs instead of loading CanvasKit. */
export function PlayerRunSprite({
  playerId,
  role,
  lookId,
  side = 'home',
  scale = 4,
  walking = false,
  accessibilityLabel,
}: PlayerRunSpriteProps) {
  const pixel = Math.max(1, Math.round(scale));
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return undefined;
    }
    const timer = setInterval(
      () => setFrame((current) => current + 1),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [walking]);

  const spriteKey = useMemo(() => {
    const visualId = `${side === 'home' ? 'r' : 'u'}:${playerLookId(
      playerId,
      role,
      lookId,
    )}`;
    return `${visualId}:${frame % 2 === 0 ? 'run0' : 'run1'}`;
  }, [frame, lookId, playerId, role, side]);
  // The sheet is its own chunk on web, prefetched by App at module eval, so it
  // is resident well before any walk-on renders. `undefined` is the cold-start
  // tick: draw the empty cell rather than throw.
  const sheets = usePixelSheets();
  const runs = useMemo(() => {
    if (sheets === undefined) return [];
    try {
      return spriteRuns(sheets.sprites, spriteKey);
    } catch (error) {
      console.warn('PlayerRunSprite: sprite unavailable', error);
      return spriteRuns(sheets.sprites, 'r:f00:run0');
    }
  }, [sheets, spriteKey]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        position: 'relative',
        width: CELL_WIDTH * pixel,
        height: CELL_HEIGHT * pixel,
      }}
    >
      {runs.map((run) => (
        <View
          key={run.id}
          style={{
            position: 'absolute',
            left: run.x * pixel,
            top: run.y * pixel,
            width: run.width * pixel,
            height: pixel,
            backgroundColor: run.color,
          }}
        />
      ))}
    </View>
  );
}

// Literals, matching the native file. Reading them off the sheet would make
// this module's own export wait for a chunk that has not arrived yet.
export const PLAYER_SPRITE_CELL = { width: CELL_WIDTH, height: CELL_HEIGHT };
