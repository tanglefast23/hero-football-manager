import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const P = AWAKENING_PIXEL_PALETTE;

const WATER_BOTTLE_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Tipped bottle sits behind the fist, with a readable body, label, neck,
  // cap, and short stream instead of an ambiguous blue lightning shape.
  [10, 7, 9, 3, P.ink],
  [7, 9, 12, 6, P.ink],
  [5, 13, 10, 6, P.ink],
  [3, 17, 8, 5, P.ink],
  [1, 20, 5, 3, P.ink],
  [11, 8, 7, 2, P.blueLight],
  [8, 10, 10, 4, P.blueBase],
  [6, 14, 8, 4, P.blueBase],
  [4, 18, 6, 3, P.blueBase],
  [2, 21, 3, 1, P.blueLight],
  [13, 9, 5, 4, P.blueShadow],
  [10, 13, 4, 5, P.blueShadow],
  [7, 17, 3, 4, P.blueShadow],
  [9, 11, 6, 3, P.cream],
  [9, 11, 5, 1, P.white],
  [1, 22, 2, 1, P.blueLight],
  [0, 23, 1, 1, P.white],

  // A red teammate sleeve enters straight from the right. The white cuff,
  // narrow wrist, compact fist, thumb, and finger creases make the anatomy
  // legible at a glance while the fist visibly overlaps the bottle body.
  [27, 5, 5, 11, P.ink],
  [24, 7, 8, 9, P.ink],
  [28, 6, 4, 9, P.redBase],
  [25, 8, 6, 7, P.redBase],
  [26, 8, 5, 2, P.redLight],
  [23, 8, 4, 8, P.ink],
  [24, 9, 3, 6, P.cream],
  [21, 9, 4, 8, P.ink],
  [22, 10, 3, 6, P.skinBase],
  [16, 9, 7, 10, P.ink],
  [17, 10, 5, 8, P.skinBase],
  [17, 10, 4, 2, P.skinLight],
  [13, 10, 6, 4, P.ink],
  [14, 11, 5, 2, P.skinLight],
  [14, 13, 4, 2, P.skinBase],
  [17, 13, 5, 1, P.skinShadow],
  [16, 15, 6, 1, P.skinShadow],
  [16, 17, 5, 1, P.skinShadow],
];

export function WaterBottleVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      blocks={WATER_BOTTLE_BLOCKS}
      scale={2}
    />
  );
}
