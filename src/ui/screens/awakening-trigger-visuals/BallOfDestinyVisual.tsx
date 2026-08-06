import {
  AWAKENING_PIXEL_PALETTE as palette,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

const BALL_OF_DESTINY_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Uphill motion trail and ground shadow sit behind a recognizable football.
  [6, 21, 18, 2, palette.ink, 0.3],
  [21, 16, 4, 2, palette.greyShadow],
  [24, 13, 4, 2, palette.greyBase],
  [27, 10, 3, 2, palette.greyLight],
  [29, 7, 2, 2, palette.goldLight],

  // Round stepped silhouette with a white leather face.
  [9, 3, 8, 1, palette.ink],
  [6, 4, 14, 2, palette.ink],
  [4, 6, 18, 12, palette.ink],
  [6, 18, 14, 2, palette.ink],
  [9, 20, 8, 1, palette.ink],
  [9, 4, 8, 1, palette.white],
  [7, 5, 12, 2, palette.cream],
  [5, 7, 16, 10, palette.cream],
  [7, 17, 12, 2, palette.greyLight],
  [9, 19, 8, 1, palette.greyBase],
  [6, 7, 6, 2, palette.white],

  // Classic central pentagon, surrounding panels, and short seam pixels. The
  // surrounding panels are ink, like the middle one: in grey they read as
  // smudges on a white ball rather than as the black panels of a football.
  // Each is held one pixel inside the face so the cream rim survives — a panel
  // that reaches the outline just thickens it and the ball stops looking round.
  [11, 8, 5, 2, palette.ink],
  [10, 10, 7, 5, palette.ink],
  [12, 15, 3, 2, palette.ink],
  [11, 5, 4, 2, palette.ink],
  [6, 10, 3, 3, palette.ink],
  [17, 7, 3, 3, palette.ink],
  [17, 15, 3, 2, palette.ink],
  [7, 15, 3, 2, palette.ink],
  [8, 10, 2, 1, palette.greyBase],
  [16, 10, 2, 1, palette.greyBase],
  [9, 14, 2, 1, palette.greyBase],
  [15, 14, 2, 1, palette.greyBase],
  [12, 9, 2, 2, palette.greyShadow],
  [11, 10, 2, 2, palette.white],
];

export function BallOfDestinyVisual({ x, y }: { x: number; y: number }) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      scale={2}
      blocks={BALL_OF_DESTINY_BLOCKS}
    />
  );
}
