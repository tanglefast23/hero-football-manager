import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { playerLookId } from './sprites/player-look';
import {
  titleMatchSpriteRuns,
  titleMatchSpriteSheet,
} from '../ui/title-match-sprite-model';

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
  const runs = useMemo(() => {
    try {
      return titleMatchSpriteRuns(spriteKey);
    } catch (error) {
      console.warn('PlayerRunSprite: sprite unavailable', error);
      return titleMatchSpriteRuns('r:f00:run0');
    }
  }, [spriteKey]);

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

export const PLAYER_SPRITE_CELL = {
  width: titleMatchSpriteSheet.cell.w,
  height: titleMatchSpriteSheet.cell.h,
};
