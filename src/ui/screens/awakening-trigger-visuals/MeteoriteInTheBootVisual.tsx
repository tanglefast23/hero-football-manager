import {
  AWAKENING_PIXEL_PALETTE as P,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const METEORITE_IN_BOOT_BLOCKS = [
  // Stubby leather boot with one oversized, wonky toe.
  [18, 9, 10, 13, P.woodShadow],
  [15, 19, 14, 10, P.woodShadow],
  [26, 21, 9, 8, P.woodShadow],
  [15, 27, 20, 4, P.woodShadow],
  [20, 11, 6, 10, P.woodBase],
  [17, 21, 11, 6, P.woodBase],
  [27, 23, 6, 4, P.woodBase],
  [20, 11, 2, 7, P.woodLight],
  [17, 21, 8, 2, P.woodLight],
  [28, 23, 4, 1, P.woodLight],
  [30, 26, 3, 1, P.woodShadow],
  [17, 27, 15, 2, P.woodBase],
  [18, 9, 10, 4, P.woodShadow],
  [20, 10, 6, 2, P.ink],
  [20, 15, 8, 2, P.cream],
  [18, 18, 8, 2, P.cream],

  // Fallen warm meteor and close sparks keep both props in one vignette.
  [5, 20, 10, 9, P.greyShadow],
  [7, 20, 6, 7, P.greyBase],
  [7, 20, 3, 2, P.greyLight],
  [12, 24, 2, 3, P.greyShadow],
  [7, 25, 2, 2, P.white],
  [2, 16, 3, 3, P.goldBase],
  [8, 12, 2, 4, P.goldLight],
  [14, 16, 3, 2, P.goldBase],
  [3, 25, 2, 2, P.goldLight],
  [4, 29, 31, 3, P.ink, 0.22],
  [8, 28, 23, 2, P.turfLight],
] as const satisfies readonly AwakeningPixelBlock[];

export function MeteoriteInTheBootVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={36}
      height={32}
      blocks={METEORITE_IN_BOOT_BLOCKS}
      scale={2}
    />
  );
}
