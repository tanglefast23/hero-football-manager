import {
  AWAKENING_PIXEL_PALETTE as P,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

export interface StrongManStrongDrinkTriggerVisualProps {
  x: number;
  y: number;
}

const STRONG_DRINK_BLOCKS = [
  // Player-scale amber bottle, lit from its upper-left edge.
  [25, 2, 6, 2, P.redShadow],
  [26, 2, 4, 1, P.redLight],
  [24, 4, 8, 5, P.woodShadow],
  [22, 8, 12, 4, P.woodShadow],
  [21, 11, 14, 18, P.woodShadow],
  [26, 5, 4, 3, P.woodBase],
  [24, 9, 8, 3, P.woodBase],
  [23, 12, 10, 15, P.woodBase],
  [23, 12, 3, 10, P.woodLight],
  [30, 16, 3, 11, P.woodShadow],
  [24, 27, 8, 1, P.woodShadow],
  [21, 29, 14, 2, P.ink, 0.18],

  // Tiny block-built SM / SD brand remains legible at 2x.
  [25, 17, 7, 10, P.cream],
  [25, 18, 2, 1, P.redShadow],
  [25, 19, 1, 1, P.redShadow],
  [25, 20, 2, 1, P.redShadow],
  [26, 21, 1, 1, P.redShadow],
  [25, 22, 2, 1, P.redShadow],
  [28, 18, 1, 5, P.redBase],
  [31, 18, 1, 5, P.redBase],
  [29, 19, 1, 1, P.redBase],
  [30, 19, 1, 1, P.redBase],
  [25, 24, 2, 1, P.redShadow],
  [25, 25, 1, 1, P.redShadow],
  [25, 26, 2, 1, P.redShadow],
  [28, 24, 1, 3, P.redBase],
  [29, 24, 2, 1, P.redBase],
  [31, 25, 1, 1, P.redBase],
  [29, 26, 2, 1, P.redBase],

  // Straight red sleeve, cuff, wrist, and compact fist grip the bottle.
  [0, 11, 8, 12, P.ink],
  [1, 12, 7, 10, P.redBase],
  [1, 12, 7, 2, P.redLight],
  [7, 11, 5, 12, P.ink],
  [8, 12, 3, 10, P.cream],
  [10, 11, 6, 12, P.ink],
  [11, 12, 4, 10, P.skinBase],
  [11, 12, 4, 2, P.skinLight],
  [14, 9, 9, 15, P.ink],
  [15, 10, 7, 13, P.skinBase],
  [15, 10, 5, 2, P.skinLight],
  [20, 10, 6, 4, P.ink],
  [21, 11, 5, 2, P.skinLight],
  [20, 14, 6, 1, P.skinShadow],
  [20, 17, 6, 1, P.skinShadow],
  [20, 20, 5, 1, P.skinShadow],
] as const satisfies readonly AwakeningPixelBlock[];

export function StrongManStrongDrinkTriggerVisual({
  x,
  y,
}: StrongManStrongDrinkTriggerVisualProps) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={36}
      height={32}
      blocks={STRONG_DRINK_BLOCKS}
      scale={2}
    />
  );
}
