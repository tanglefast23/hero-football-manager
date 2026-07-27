import { useEffect, useMemo, useState } from 'react';
import {
  Atlas,
  Canvas,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { buildFallbackAtlas, buildSpriteAtlas } from './sprites/buildAtlas';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { playerLookId } from './sprites/player-look';

/** The sheet's cell, and the only two frames a field player has. */
const CELL_WIDTH = 24;
const CELL_HEIGHT = 30;
const FALLBACK_SPRITE = 24;
/** How long each of the two run frames holds. */
const STEP_MS = 130;

export interface PlayerRunSpriteProps {
  playerId: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  /** Whole-number multiple of the 24×30 cell; fractional values blur the art. */
  scale?: number;
  /** False parks the sprite on its standing frame. */
  walking?: boolean;
  accessibilityLabel?: string;
}

/**
 * One match player, drawn outside the match.
 *
 * The pitch batches every sprite through a single Atlas call; a lone character
 * on a management screen has nothing to batch with, so this is the same atlas
 * and the same two-frame cycle sized to exactly one cell. Callers animate the
 * view itself — position, facing, lean — which keeps this component a still.
 */
export function PlayerRunSprite({
  playerId,
  role,
  lookId,
  scale = 4,
  walking = false,
  accessibilityLabel,
}: PlayerRunSpriteProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return undefined;
    }
    const timer = setInterval(() => setFrame(current => current + 1), STEP_MS);
    return () => clearInterval(timer);
  }, [walking]);

  const visualId = useMemo(
    () => `r:${playerLookId(playerId, role, lookId)}`,
    [playerId, role, lookId],
  );

  const atlas = useMemo(() => {
    try {
      return buildSpriteAtlas(Skia, [visualId]);
    } catch (error) {
      // A missing look is a cosmetic problem, not a reason to blank the screen.
      console.warn('PlayerRunSprite: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [visualId]);

  const sprites: SkRect[] = useMemo(() => {
    const cell = atlas.rectFor(`${visualId}:${frame % 2 === 0 ? 'run0' : 'run1'}`);
    return [Skia.XYWHRect(cell.x, cell.y, cell.w, cell.h)];
  }, [atlas, visualId, frame]);

  const transforms = useRSXformBuffer(1, transform => {
    'worklet';
    transform.set(scale, 0, 0, 0);
  });

  return (
    <Canvas
      accessibilityLabel={accessibilityLabel}
      style={{ width: CELL_WIDTH * scale, height: CELL_HEIGHT * scale }}
    >
      <Atlas
        image={atlas.image as SkImage}
        sprites={sprites}
        transforms={transforms}
        sampling={PIXEL_ART_SAMPLING}
      />
    </Canvas>
  );
}

export const PLAYER_SPRITE_CELL = { width: CELL_WIDTH, height: CELL_HEIGHT };
