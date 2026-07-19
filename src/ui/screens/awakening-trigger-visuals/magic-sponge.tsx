import {
  AWAKENING_PIXEL_PALETTE,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from "./AwakeningPixelArt";

const P = AWAKENING_PIXEL_PALETTE;

const MAGIC_SPONGE_BLOCKS: readonly AwakeningPixelBlock[] = [
  // Violet block-sparkles establish magic without a smooth aura.
  [3, 3, 2, 6, P.violetShadow],
  [1, 5, 6, 2, P.violetShadow],
  [3, 4, 2, 3, P.violetLight],
  [10, 4, 1, 4, P.cream],
  [8, 5, 5, 1, P.cream],

  // Small wonky sponge with one proudly overgrown corner.
  [9, 11, 13, 2, P.goldShadow],
  [7, 13, 16, 8, P.goldShadow],
  [9, 21, 13, 2, P.goldShadow],
  [19, 9, 4, 6, P.goldShadow],
  [10, 12, 9, 2, P.goldLight],
  [8, 14, 14, 6, P.goldBase],
  [10, 20, 11, 1, P.goldBase],
  [20, 10, 2, 8, P.goldBase],
  [8, 14, 3, 5, P.goldLight],
  [19, 16, 3, 4, P.goldShadow],
  [12, 19, 9, 2, P.goldShadow],
  [12, 15, 2, 2, P.goldShadow],
  [17, 16, 2, 3, P.goldShadow],
  [10, 18, 1, 2, P.goldShadow],

  // Straight teammate sleeve, cuff, wrist, and compact fist replace the old
  // branch-like diagonal arm. The thumb and creases overlap the sponge edge.
  [28, 6, 4, 12, P.ink],
  [25, 8, 7, 10, P.ink],
  [29, 7, 3, 10, P.redBase],
  [26, 9, 5, 8, P.redBase],
  [26, 9, 5, 2, P.redLight],
  [23, 9, 4, 9, P.ink],
  [24, 10, 3, 7, P.cream],
  [21, 10, 4, 8, P.ink],
  [22, 11, 3, 6, P.skinBase],
  [18, 9, 6, 10, P.ink],
  [19, 10, 4, 8, P.skinBase],
  [19, 10, 3, 2, P.skinLight],
  [16, 10, 5, 4, P.ink],
  [17, 11, 4, 2, P.skinLight],
  [18, 13, 5, 1, P.skinShadow],
  [18, 15, 5, 1, P.skinShadow],
  [18, 17, 4, 1, P.skinShadow],

  [7, 21, 2, 2, P.blueLight],
  [22, 21, 2, 2, P.blueBase],
];

export interface MagicSpongeTriggerVisualProps {
  x: number;
  y: number;
}

export function MagicSpongeTriggerVisual({
  x,
  y,
}: MagicSpongeTriggerVisualProps) {
  return (
    <AwakeningPixelSprite
      x={x}
      y={y}
      width={32}
      height={24}
      blocks={MAGIC_SPONGE_BLOCKS}
      scale={2}
    />
  );
}
