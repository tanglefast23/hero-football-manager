import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from "./AwakeningPixelArt";

const P = AWAKENING_PIXEL_PALETTE;

const CATERPILLAR_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Blocky glow and ground contact.
  [4, 1, 8, 1, P.goldLight, 0.5],
  [2, 3, 1, 7, P.goldLight, 0.35],
  [13, 3, 1, 7, P.goldLight, 0.35],
  [4, 12, 9, 1, P.goldLight, 0.35],
  [3, 14, 11, 1, P.ink, 0.35],

  // Six stubby legs and the oversized, crooked antennae.
  [3, 10, 1, 3, P.turfShadow],
  [6, 11, 1, 3, P.turfShadow],
  [9, 11, 1, 3, P.turfShadow],
  [12, 10, 1, 3, P.turfShadow],
  [12, 2, 1, 4, P.turfShadow],
  [14, 1, 1, 5, P.turfShadow],
  [15, 1, 1, 1, P.turfLight],

  // Three glowing segments; the huge head gives the creature its chibi read.
  [2, 6, 5, 6, P.turfShadow],
  [3, 6, 3, 4, P.turfBase],
  [3, 6, 2, 2, P.turfLight],
  [5, 10, 1, 1, P.turfShadow],
  [6, 5, 5, 7, P.turfShadow],
  [7, 6, 3, 5, P.turfBase],
  [7, 6, 2, 2, P.turfLight],
  [9, 10, 1, 1, P.turfShadow],
  [10, 4, 6, 8, P.turfShadow],
  [11, 5, 4, 6, P.turfBase],
  [11, 5, 3, 2, P.turfLight],
  [14, 9, 1, 2, P.turfShadow],
  [13, 7, 1, 1, P.ink],
];

export function GlowingCaterpillarVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={16}
      height={16}
      blocks={CATERPILLAR_BLOCKS}
      scale={2}
    />
  );
}
