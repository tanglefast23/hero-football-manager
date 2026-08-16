import { memo, useMemo } from 'react';
import { Canvas, Rect } from '@shopify/react-native-skia';
import {
  titleMatchSpriteRuns,
  titleMatchSpriteSheet,
} from '../title-match-sprite-model';
import type { TitleSpriteKey } from './title-sprite-keys';

export interface TitleMatchSpriteProps {
  /**
   * Constrained to the title subset on purpose: the title draws its sprites
   * synchronously from `title-sprites.json`, so a key outside that 14 KB file
   * has to fail at compile time, not on the first screen a player sees.
   */
  readonly spriteKey: TitleSpriteKey;
  readonly scale?: number;
}

/** A real live-match sprite, enlarged without smoothing for the title scene. */
export const TitleMatchSprite = memo(function TitleMatchSprite({
  spriteKey,
  scale = 2.5,
}: TitleMatchSpriteProps) {
  const runs = useMemo(() => titleMatchSpriteRuns(spriteKey), [spriteKey]);

  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: titleMatchSpriteSheet.cell.w * scale,
        height: titleMatchSpriteSheet.cell.h * scale,
      }}
    >
      {runs.map((run) => (
        <Rect
          key={run.id}
          x={run.x * scale}
          y={run.y * scale}
          width={run.width * scale}
          height={scale}
          color={run.color}
          antiAlias={false}
        />
      ))}
    </Canvas>
  );
});
