import {
  AWAKENING_PIXEL_PALETTE as P,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const BUZZING_SHIN_GUARD_BLOCKS = [
  // Straps and tight buzz marks frame one centered guard.
  [2, 9, 24, 3, P.greyShadow],
  [3, 9, 21, 1, P.greyLight],
  [2, 21, 24, 3, P.greyShadow],
  [3, 21, 21, 1, P.greyBase],
  [1, 5, 5, 2, P.blueLight],
  [1, 15, 4, 2, P.white],
  [1, 27, 5, 2, P.blueLight],
  [22, 4, 5, 2, P.white],
  [23, 15, 4, 2, P.blueLight],
  [22, 28, 5, 2, P.white],

  // Stepped lower point gives the protective shell a handmade silhouette.
  [9, 2, 10, 3, P.blueShadow],
  [7, 4, 14, 21, P.blueShadow],
  [9, 24, 10, 5, P.blueShadow],
  [11, 28, 6, 3, P.blueShadow],
  [10, 4, 8, 3, P.blueLight],
  [9, 7, 10, 16, P.blueBase],
  [9, 7, 3, 11, P.blueLight],
  [16, 15, 3, 8, P.blueShadow],
  [10, 23, 8, 3, P.blueBase],
  [12, 26, 5, 3, P.blueBase],

  // Cream signal blocks race down the inner surface.
  [13, 8, 4, 3, P.cream],
  [11, 11, 4, 3, P.cream],
  [14, 14, 4, 3, P.cream],
  [12, 17, 4, 3, P.cream],
  [13, 8, 2, 1, P.white],
  [16, 15, 2, 1, P.goldLight],
  [8, 30, 13, 2, P.ink, 0.18],
] as const satisfies readonly AwakeningPixelBlock[];

export function BuzzingShinGuardVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={28}
      height={32}
      blocks={BUZZING_SHIN_GUARD_BLOCKS}
      scale={2}
    />
  );
}
