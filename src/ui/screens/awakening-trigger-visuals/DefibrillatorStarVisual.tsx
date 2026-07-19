import {
  AWAKENING_PIXEL_PALETTE as palette,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const DEFIBRILLATOR_STAR_BLOCKS: readonly AwakeningPixelBlock[] = [
  [3, 22, 25, 1, palette.ink, 0.32],

  // Straight red sleeve, cuff, and fist support the right paddle.
  [29, 15, 3, 9, palette.ink],
  [30, 16, 2, 8, palette.redBase],
  [30, 16, 2, 2, palette.redLight],
  [26, 14, 5, 10, palette.ink],
  [27, 15, 3, 8, palette.cream],
  [22, 13, 6, 11, palette.ink],
  [23, 14, 4, 9, palette.skinBase],
  [23, 14, 4, 2, palette.skinLight],

  // Two correctly small paddles hold a clear gap around the energy pulse.
  [2, 7, 7, 10, palette.redShadow],
  [3, 8, 5, 7, palette.redBase],
  [3, 8, 4, 2, palette.redLight],
  [4, 15, 3, 2, palette.greyShadow],
  [5, 16, 2, 5, palette.greyBase],

  [24, 5, 7, 10, palette.blueShadow],
  [25, 6, 5, 7, palette.blueBase],
  [25, 6, 4, 2, palette.blueLight],
  [25, 13, 3, 2, palette.greyShadow],
  [25, 14, 2, 5, palette.greyBase],

  // A blocky star bridges the no-contact gap.
  [15, 3, 2, 4, palette.goldShadow],
  [12, 6, 8, 3, palette.goldShadow],
  [8, 9, 16, 6, palette.goldShadow],
  [6, 11, 4, 2, palette.goldShadow],
  [22, 10, 4, 3, palette.goldShadow],
  [12, 14, 8, 3, palette.goldShadow],
  [15, 17, 2, 4, palette.goldShadow],
  [15, 7, 2, 10, palette.goldBase],
  [11, 10, 11, 4, palette.goldBase],
  [12, 9, 5, 3, palette.goldLight],
  [10, 11, 6, 2, palette.goldLight],
  [14, 10, 5, 4, palette.white],

  // Thumb and three creases close over the right handle.
  [20, 13, 6, 4, palette.ink],
  [21, 14, 5, 2, palette.skinLight],
  [22, 17, 4, 1, palette.skinShadow],
  [22, 19, 4, 1, palette.skinShadow],
  [22, 21, 3, 1, palette.skinShadow],
];

export function DefibrillatorStarVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      scale={2}
      blocks={DEFIBRILLATOR_STAR_BLOCKS}
    />
  );
}
