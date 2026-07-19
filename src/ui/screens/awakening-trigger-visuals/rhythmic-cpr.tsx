import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from "./AwakeningPixelArt";

const P = AWAKENING_PIXEL_PALETTE;

const RHYTHMIC_CPR_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Centered chest pad sits below the stacked hands.
  [8, 15, 16, 8, P.greyShadow],
  [9, 15, 13, 6, P.greyBase],
  [9, 15, 9, 2, P.greyLight],
  [21, 18, 2, 4, P.greyShadow],
  [14, 18, 4, 1, P.cream],
  [15, 17, 2, 3, P.cream],

  // Two cropped forearms belong to one responder above the vignette.
  [7, 0, 6, 10, P.woodShadow],
  [9, 7, 6, 7, P.woodShadow],
  [8, 0, 4, 9, P.skinBase],
  [9, 0, 3, 3, P.skinLight],
  [10, 8, 4, 5, P.skinBase],
  [13, 10, 2, 3, P.skinShadow],
  [20, 0, 6, 10, P.woodShadow],
  [17, 7, 6, 7, P.woodShadow],
  [21, 0, 4, 9, P.skinBase],
  [21, 0, 3, 3, P.skinLight],
  [18, 8, 4, 5, P.skinBase],
  [18, 10, 2, 3, P.skinShadow],

  // Exaggerated stacked hands contact each other and the pad.
  [10, 13, 12, 6, P.woodShadow],
  [11, 14, 10, 4, P.skinBase],
  [11, 14, 7, 1, P.skinLight],
  [19, 16, 2, 2, P.skinShadow],
  [11, 10, 12, 6, P.woodShadow],
  [12, 11, 10, 4, P.skinBase],
  [12, 11, 7, 1, P.skinLight],
  [20, 13, 2, 2, P.skinShadow],

  // Crisp dark creases separate the stacked palms and visible fingers.
  [12, 15, 10, 1, P.woodShadow],
  [14, 12, 1, 3, P.woodShadow],
  [17, 12, 1, 3, P.woodShadow],
  [20, 12, 1, 3, P.woodShadow],
  [13, 16, 1, 2, P.woodShadow],
  [16, 16, 1, 2, P.woodShadow],
  [19, 16, 1, 2, P.woodShadow],
];

export interface RhythmicCprTriggerVisualProps {
  x: number;
  y: number;
}

export function RhythmicCprTriggerVisual({
  x,
  y,
}: RhythmicCprTriggerVisualProps) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      blocks={RHYTHMIC_CPR_BLOCKS}
      scale={2}
    />
  );
}
