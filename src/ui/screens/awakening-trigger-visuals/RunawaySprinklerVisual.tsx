import {
  AWAKENING_PIXEL_PALETTE as P,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const RUNAWAY_SPRINKLER_BLOCKS = [
  // One precise, exaggerated staircase jet aims across the card.
  [3, 7, 7, 4, P.blueShadow],
  [9, 9, 6, 4, P.blueShadow],
  [14, 11, 6, 4, P.blueShadow],
  [19, 13, 6, 4, P.blueShadow],
  [24, 15, 5, 4, P.blueShadow],
  [4, 7, 5, 1, P.white],
  [10, 9, 4, 1, P.blueLight],
  [15, 11, 4, 1, P.blueLight],
  [20, 13, 4, 1, P.blueBase],
  [3, 14, 2, 3, P.blueLight],
  [9, 16, 2, 2, P.white],
  [16, 18, 3, 2, P.blueBase],

  // Wonky head, post, and foot stay compact and self-contained.
  [24, 14, 10, 7, P.greyShadow],
  [27, 12, 7, 9, P.greyShadow],
  [25, 16, 7, 3, P.greyBase],
  [25, 16, 5, 1, P.greyLight],
  [31, 18, 2, 3, P.greyShadow],
  [28, 20, 5, 9, P.greyShadow],
  [29, 21, 3, 7, P.greyBase],
  [29, 21, 1, 5, P.greyLight],
  [24, 27, 11, 3, P.greyShadow],
  [27, 27, 6, 1, P.greyLight],
  [23, 30, 13, 2, P.ink, 0.2],
] as const satisfies readonly AwakeningPixelBlock[];

export function RunawaySprinklerVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={36}
      height={32}
      blocks={RUNAWAY_SPRINKLER_BLOCKS}
      scale={2}
    />
  );
}
