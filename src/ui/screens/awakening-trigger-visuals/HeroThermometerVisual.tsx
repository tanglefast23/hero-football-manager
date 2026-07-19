import {
  AWAKENING_PIXEL_PALETTE as palette,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const HERO_THERMOMETER_BLOCKS: readonly AwakeningPixelBlock[] = [
  [4, 22, 25, 1, palette.ink, 0.32],

  // A straight sleeved hand supports the thermometer from the left.
  [0, 16, 7, 8, palette.ink],
  [0, 17, 6, 7, palette.redBase],
  [0, 17, 6, 2, palette.redLight],
  [5, 15, 5, 9, palette.ink],
  [6, 16, 3, 8, palette.cream],
  [8, 14, 6, 10, palette.ink],
  [9, 15, 4, 8, palette.skinBase],
  [9, 15, 4, 2, palette.skinLight],

  // Hand-scale digital thermometer with a comically swollen sensor bulb.
  [9, 4, 17, 1, palette.greyShadow],
  [7, 5, 21, 11, palette.greyShadow],
  [9, 16, 17, 2, palette.greyShadow],
  [9, 6, 17, 9, palette.cream],
  [10, 5, 13, 2, palette.white],
  [9, 7, 2, 6, palette.greyLight],
  [24, 7, 3, 8, palette.greyBase],
  [11, 14, 14, 2, palette.greyBase],

  [11, 8, 14, 6, palette.ink],
  [12, 9, 1, 5, palette.goldLight],
  [14, 9, 1, 5, palette.goldLight],
  [13, 11, 1, 1, palette.goldLight],
  [15, 9, 3, 1, palette.goldLight],
  [15, 10, 1, 4, palette.goldLight],
  [16, 11, 2, 1, palette.goldLight],
  [16, 13, 2, 1, palette.goldLight],
  [18, 9, 2, 1, palette.goldLight],
  [18, 10, 1, 4, palette.goldLight],
  [20, 10, 1, 2, palette.goldLight],
  [19, 11, 2, 1, palette.goldLight],
  [20, 12, 1, 2, palette.goldLight],
  [21, 9, 3, 1, palette.goldLight],
  [21, 10, 1, 3, palette.goldLight],
  [23, 10, 1, 3, palette.goldLight],
  [21, 13, 3, 1, palette.goldLight],

  [27, 9, 3, 4, palette.greyShadow],
  [29, 6, 3, 2, palette.redShadow],
  [28, 8, 4, 8, palette.redShadow],
  [29, 16, 3, 2, palette.redShadow],
  [29, 8, 2, 7, palette.redBase],
  [29, 7, 2, 2, palette.redLight],

  // Thumb and finger creases overlap the left handle.
  [7, 12, 7, 4, palette.ink],
  [8, 13, 6, 2, palette.skinLight],
  [9, 17, 4, 1, palette.skinShadow],
  [9, 19, 4, 1, palette.skinShadow],
  [9, 21, 3, 1, palette.skinShadow],
];

export function HeroThermometerVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      scale={2}
      blocks={HERO_THERMOMETER_BLOCKS}
    />
  );
}
