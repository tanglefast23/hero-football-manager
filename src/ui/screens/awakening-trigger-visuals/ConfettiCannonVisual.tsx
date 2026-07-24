import {
  AWAKENING_PIXEL_PALETTE as palette,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const CONFETTI_CANNON_BLOCKS: readonly AwakeningPixelBlock[] = [
  [1, 23, 16, 1, palette.ink, 0.32],

  // A straight red sleeve, cuff, wrist, and compact fist hold the stock.
  [0, 17, 7, 7, palette.ink],
  [0, 18, 6, 6, palette.redBase],
  [0, 18, 6, 2, palette.redLight],
  [5, 16, 5, 8, palette.ink],
  [6, 17, 3, 7, palette.cream],
  [8, 15, 6, 9, palette.ink],
  [9, 16, 4, 7, palette.skinBase],
  [9, 16, 4, 2, palette.skinLight],

  // Wonky stair-step party cannon, with a mouth almost as wide as its barrel.
  [8, 15, 5, 5, palette.redShadow],
  [11, 12, 5, 6, palette.redShadow],
  [14, 9, 5, 6, palette.redShadow],
  [17, 5, 6, 11, palette.redShadow],
  [9, 16, 3, 3, palette.redBase],
  [12, 13, 3, 4, palette.redBase],
  [15, 10, 3, 4, palette.redBase],
  [17, 7, 4, 8, palette.redBase],
  [9, 15, 3, 1, palette.redLight],
  [12, 12, 3, 1, palette.redLight],
  [15, 9, 3, 1, palette.redLight],
  [18, 6, 3, 2, palette.redLight],
  [21, 7, 2, 8, palette.ink],

  // Thumb and three dark creases cross the stock so the grip reads clearly.
  [11, 14, 6, 4, palette.ink],
  [12, 15, 5, 2, palette.skinLight],
  [11, 18, 4, 1, palette.skinShadow],
  [11, 20, 4, 1, palette.skinShadow],
  [11, 22, 3, 1, palette.skinShadow],

  // Compact burst; the bent gold strip is the one piece that remains.
  [23, 5, 3, 2, palette.goldLight],
  [25, 2, 2, 2, palette.blueLight],
  [28, 4, 1, 3, palette.redLight],
  [30, 1, 2, 2, palette.blueLight],
  [24, 9, 2, 2, palette.blueBase],
  [28, 9, 3, 2, palette.goldShadow],
  [29, 10, 2, 4, palette.goldShadow],
  [28, 9, 2, 1, palette.goldLight],
  [29, 11, 1, 2, palette.goldBase],
  [25, 13, 2, 2, palette.blueBase],
];

export function ConfettiCannonVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      scale={2}
      blocks={CONFETTI_CANNON_BLOCKS}
    />
  );
}
