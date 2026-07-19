import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from "./AwakeningPixelArt";

const P = AWAKENING_PIXEL_PALETTE;

const SUPER_SNEEZE_BLOCKS: readonly AwakeningPixelBlock[] = [
  // A soft, scalloped sneeze cloud: five joined puffs with a grey edge,
  // warm-white body, and bright crown instead of hard impact spikes.
  [0, 9, 3, 5, P.greyShadow],
  [2, 7, 4, 9, P.greyShadow],
  [5, 5, 5, 12, P.greyShadow],
  [9, 6, 5, 11, P.greyShadow],
  [13, 9, 4, 7, P.greyShadow],
  [1, 10, 3, 3, P.cream],
  [3, 8, 4, 7, P.cream],
  [6, 6, 5, 10, P.cream],
  [10, 7, 4, 9, P.cream],
  [14, 10, 2, 5, P.cream],
  [4, 8, 4, 2, P.white],
  [7, 6, 4, 2, P.white],
  [10, 8, 3, 1, P.white],
  [4, 14, 10, 2, P.greyLight],

  // Three horizontal motion trails make the puff read as a sneeze burst.
  [15, 6, 7, 1, P.greyLight],
  [17, 9, 6, 1, P.cream],
  [16, 13, 7, 1, P.greyLight],
  [19, 16, 4, 1, P.cream],

  // Small crooked smelling-salt jar with an oversized shifted stopper.
  [24, 5, 6, 3, P.greyShadow],
  [23, 8, 7, 3, P.greyShadow],
  [22, 10, 8, 10, P.greyShadow],
  [25, 5, 4, 1, P.greyLight],
  [24, 8, 5, 2, P.greyBase],
  [23, 11, 6, 8, P.greyBase],
  [23, 11, 3, 3, P.greyLight],
  [28, 13, 1, 6, P.greyShadow],
  [24, 14, 4, 3, P.blueBase],
  [24, 14, 3, 1, P.blueLight],
  [27, 16, 1, 1, P.blueShadow],
  [25, 11, 1, 1, P.white],

  // A straight sleeve and fist enter from the right and close over the jar.
  [29, 14, 3, 10, P.ink],
  [27, 15, 5, 9, P.ink],
  [30, 15, 2, 8, P.redBase],
  [28, 16, 4, 7, P.redBase],
  [28, 16, 4, 2, P.redLight],
  [25, 15, 4, 8, P.ink],
  [26, 16, 3, 6, P.cream],
  [22, 13, 5, 9, P.ink],
  [23, 14, 3, 7, P.skinBase],
  [23, 14, 3, 2, P.skinLight],
  [20, 13, 5, 4, P.ink],
  [21, 14, 4, 2, P.skinLight],
  [22, 17, 4, 1, P.skinShadow],
  [22, 19, 4, 1, P.skinShadow],
  [22, 21, 3, 1, P.skinShadow],
];

export interface SmellingSaltSuperSneezeTriggerVisualProps {
  x: number;
  y: number;
}

export function SmellingSaltSuperSneezeTriggerVisual({
  x,
  y,
}: SmellingSaltSuperSneezeTriggerVisualProps) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      blocks={SUPER_SNEEZE_BLOCKS}
      scale={2}
    />
  );
}
