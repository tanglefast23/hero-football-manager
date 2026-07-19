import {
  AWAKENING_PIXEL_PALETTE as palette,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const CHOSEN_FEATHER_BLOCKS: readonly AwakeningPixelBlock[] = [
  [5, 22, 14, 1, palette.ink, 0.28],

  // Wide, tapered plume: violet upper barbs and blue lower barbs flank a
  // clearly visible diagonal quill instead of forming a key-shaped blob.
  [18, 2, 3, 2, palette.violetShadow],
  [15, 3, 7, 3, palette.violetShadow],
  [12, 5, 9, 4, palette.violetShadow],
  [9, 8, 10, 5, palette.violetShadow],
  [7, 11, 9, 5, palette.blueShadow],
  [5, 15, 8, 5, palette.blueShadow],
  [16, 4, 5, 2, palette.violetLight],
  [13, 6, 7, 3, palette.violetBase],
  [10, 9, 8, 3, palette.violetBase],
  [8, 12, 7, 3, palette.blueBase],
  [6, 16, 6, 3, palette.blueBase],
  [13, 6, 4, 2, palette.blueLight],
  [9, 11, 4, 2, palette.blueLight],

  // Notched barb ends keep the feather airy rather than solid.
  [19, 5, 3, 1, palette.cream],
  [17, 8, 3, 1, palette.cream],
  [15, 11, 3, 1, palette.cream],
  [7, 14, 3, 1, palette.cream],
  [5, 18, 3, 1, palette.cream],

  // Bright shaft continues below the plume as a narrow quill.
  [17, 5, 2, 2, palette.cream],
  [15, 7, 2, 2, palette.cream],
  [13, 9, 2, 2, palette.cream],
  [11, 11, 2, 2, palette.cream],
  [9, 13, 2, 2, palette.cream],
  [7, 15, 2, 2, palette.cream],
  [5, 17, 2, 3, palette.goldLight],
  [3, 19, 3, 2, palette.goldBase],
  [2, 21, 3, 1, palette.goldShadow],

  [21, 3, 2, 2, palette.goldLight],
  [21, 8, 1, 2, palette.white],
];

export function ChosenFeatherVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={24}
      height={24}
      scale={2}
      blocks={CHOSEN_FEATHER_BLOCKS}
    />
  );
}
