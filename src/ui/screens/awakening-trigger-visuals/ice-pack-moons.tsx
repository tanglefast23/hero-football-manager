import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const P = AWAKENING_PIXEL_PALETTE;

const ICE_PACK_MOONS_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Large left crescent, assembled as a chunky C instead of a curve.
  [3, 2, 5, 1, P.goldShadow],
  [1, 3, 3, 6, P.goldShadow],
  [3, 9, 5, 1, P.goldShadow],
  [6, 3, 2, 2, P.goldShadow],
  [6, 7, 2, 2, P.goldShadow],
  [4, 3, 2, 1, P.goldLight],
  [2, 4, 1, 4, P.goldLight],
  [3, 8, 3, 1, P.goldBase],

  // Smaller moon and a few square orbit pips.
  [26, 3, 4, 1, P.greyShadow],
  [25, 4, 2, 5, P.greyShadow],
  [26, 9, 4, 1, P.greyShadow],
  [28, 4, 2, 2, P.greyShadow],
  [28, 8, 2, 1, P.greyShadow],
  [26, 4, 1, 4, P.cream],
  [27, 8, 1, 1, P.greyLight],
  [10, 2, 2, 1, P.blueLight],
  [14, 1, 1, 2, P.blueLight],
  [20, 2, 2, 1, P.blueLight],
  [23, 5, 1, 2, P.blueBase],

  // The ice pack has an absurdly large drooping knot on its left side.
  [8, 7, 6, 5, P.blueShadow],
  [6, 10, 5, 9, P.blueShadow],
  [9, 9, 17, 12, P.blueShadow],
  [24, 12, 4, 9, P.blueShadow],
  [11, 21, 15, 1, P.blueShadow],
  [9, 8, 4, 3, P.blueBase],
  [7, 11, 3, 7, P.blueBase],
  [10, 10, 15, 10, P.blueBase],
  [25, 13, 2, 7, P.blueBase],

  // Upper-left chill sheen and lower-right compressed shadow.
  [10, 10, 10, 2, P.blueLight],
  [10, 12, 3, 6, P.blueLight],
  [23, 13, 2, 7, P.blueShadow],
  [13, 18, 12, 2, P.blueShadow],

  // A block-built snowflake on the pack face.
  [16, 12, 2, 6, P.cream],
  [14, 14, 6, 2, P.cream],
  [14, 12, 1, 2, P.cream],
  [19, 12, 1, 2, P.cream],
  [14, 17, 1, 2, P.cream],
  [19, 17, 1, 2, P.cream],

  // A straight sleeved arm and compact cupped fist hold the pack's right edge.
  [29, 8, 3, 12, P.ink],
  [27, 10, 5, 10, P.ink],
  [30, 9, 2, 10, P.redBase],
  [28, 11, 4, 8, P.redBase],
  [28, 11, 4, 2, P.redLight],
  [25, 10, 4, 10, P.ink],
  [26, 11, 3, 8, P.cream],
  [22, 9, 5, 11, P.ink],
  [23, 10, 3, 9, P.skinBase],
  [23, 10, 3, 2, P.skinLight],
  [20, 11, 5, 4, P.ink],
  [21, 12, 4, 2, P.skinLight],
  [22, 14, 4, 1, P.skinShadow],
  [22, 16, 4, 1, P.skinShadow],
  [22, 18, 3, 1, P.skinShadow],
];

export interface IcePackMoonsTriggerVisualProps {
  x: number;
  y: number;
}

export function IcePackMoonsTriggerVisual({
  x,
  y,
}: IcePackMoonsTriggerVisualProps) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      blocks={ICE_PACK_MOONS_BLOCKS}
      scale={2}
    />
  );
}
