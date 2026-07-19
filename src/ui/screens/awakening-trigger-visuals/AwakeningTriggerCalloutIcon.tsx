import { Canvas } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import type { AwakeningCutsceneViewModel } from '../../models';
import {
  AWAKENING_PIXEL_PALETTE as P,
  AwakeningPixelSprite,
  type AwakeningPixelBlock,
} from './AwakeningPixelArt';

type TriggerVisual = AwakeningCutsceneViewModel['triggerVisual'];

const CALLOUT_ART = {
  caterpillar: [
    [4, 13, 16, 1, P.ink, 0.28],
    [5, 7, 4, 5, P.turfShadow], [6, 6, 3, 4, P.turfLight],
    [9, 6, 5, 6, P.turfShadow], [10, 6, 4, 4, P.turfBase],
    [14, 7, 5, 5, P.turfShadow], [15, 7, 3, 3, P.turfLight],
    [17, 7, 1, 1, P.ink], [17, 4, 1, 3, P.turfShadow], [19, 5, 1, 2, P.turfShadow],
    [6, 12, 1, 2, P.turfShadow], [11, 12, 1, 2, P.turfShadow], [16, 12, 1, 2, P.turfShadow],
  ],
  water: [
    [5, 14, 14, 1, P.ink, 0.28],
    [7, 2, 8, 2, P.blueShadow], [8, 1, 6, 1, P.blueLight],
    [5, 4, 12, 9, P.blueShadow], [6, 4, 10, 8, P.blueBase],
    [7, 5, 6, 2, P.blueLight], [7, 10, 8, 2, P.blueShadow],
    [18, 6, 2, 2, P.blueLight], [20, 9, 2, 2, P.blueBase], [18, 12, 2, 2, P.blueLight],
  ],
  cpr: [
    [3, 13, 18, 1, P.ink, 0.28],
    [2, 4, 7, 3, P.redShadow], [4, 6, 7, 3, P.redBase],
    [15, 4, 7, 3, P.blueShadow], [13, 6, 7, 3, P.blueBase],
    [8, 8, 8, 5, P.skinShadow], [9, 8, 6, 3, P.skinLight],
    [11, 2, 2, 4, P.goldBase], [9, 3, 6, 2, P.goldLight],
  ],
  sponge: [
    [4, 13, 16, 1, P.ink, 0.28],
    [4, 3, 16, 9, P.goldShadow], [5, 3, 14, 7, P.goldBase],
    [6, 4, 10, 2, P.goldLight], [8, 7, 2, 2, P.goldShadow], [15, 6, 2, 2, P.goldShadow],
    [4, 12, 2, 3, P.blueLight], [18, 11, 2, 3, P.blueBase],
  ],
  sneeze: [
    [3, 14, 18, 1, P.ink, 0.28],
    [4, 6, 5, 5, P.skinShadow], [5, 5, 4, 4, P.skinLight],
    [10, 5, 3, 3, P.cream], [14, 3, 2, 2, P.cream], [15, 9, 3, 3, P.greyLight],
    [18, 7, 4, 7, P.violetShadow], [19, 8, 3, 5, P.violetBase], [19, 6, 3, 2, P.greyLight],
  ],
  ice: [
    [4, 14, 16, 1, P.ink, 0.28],
    [4, 3, 16, 10, P.blueShadow], [5, 3, 14, 8, P.blueBase],
    [6, 4, 8, 2, P.blueLight], [11, 5, 2, 6, P.cream], [8, 7, 8, 2, P.cream],
    [2, 4, 2, 2, P.goldLight], [20, 9, 2, 2, P.goldBase],
  ],
  drink: [
    [6, 14, 13, 1, P.ink, 0.28],
    [10, 1, 5, 2, P.redShadow], [9, 3, 7, 3, P.woodShadow],
    [7, 6, 11, 8, P.woodShadow], [8, 6, 9, 7, P.woodBase],
    [9, 7, 5, 2, P.woodLight], [10, 9, 5, 3, P.cream], [11, 10, 3, 1, P.redBase],
    [18, 7, 2, 5, P.goldBase],
  ],
  sprinkler: [
    [5, 14, 16, 1, P.ink, 0.28],
    [12, 8, 4, 6, P.greyShadow], [9, 7, 10, 3, P.greyShadow], [10, 7, 8, 2, P.greyLight],
    [2, 3, 3, 2, P.blueLight], [5, 5, 3, 2, P.blueBase], [19, 4, 3, 2, P.blueLight],
    [3, 9, 2, 2, P.blueBase], [20, 9, 2, 2, P.blueBase],
  ],
  'shin-guard': [
    [5, 14, 14, 1, P.ink, 0.28],
    [8, 2, 9, 12, P.blueShadow], [9, 2, 7, 10, P.blueBase],
    [10, 3, 5, 2, P.blueLight], [11, 6, 3, 4, P.cream],
    [4, 4, 3, 2, P.goldLight], [18, 5, 3, 2, P.goldBase], [4, 10, 3, 2, P.goldBase], [18, 11, 3, 2, P.goldLight],
  ],
  meteor: [
    [4, 14, 17, 1, P.ink, 0.28],
    [2, 3, 5, 3, P.redShadow], [5, 5, 6, 3, P.redBase], [8, 7, 6, 3, P.goldBase], [11, 8, 5, 3, P.goldLight],
    [14, 7, 7, 7, P.woodShadow], [15, 7, 5, 6, P.woodBase], [16, 8, 2, 2, P.woodLight],
  ],
  ball: [
    [5, 14, 14, 1, P.ink, 0.28],
    [6, 2, 12, 12, P.greyShadow], [5, 5, 14, 6, P.greyShadow],
    [7, 3, 10, 10, P.cream], [6, 6, 12, 4, P.cream], [8, 3, 5, 2, P.white],
    [10, 6, 4, 4, P.ink], [7, 10, 3, 2, P.greyBase], [15, 4, 2, 3, P.greyBase],
  ],
  confetti: [
    [3, 14, 18, 1, P.ink, 0.28],
    [3, 8, 9, 5, P.redShadow], [4, 8, 7, 3, P.redBase], [11, 6, 4, 7, P.goldShadow],
    [14, 2, 2, 3, P.blueLight], [18, 4, 2, 2, P.redLight], [21, 1, 2, 2, P.goldLight],
    [17, 9, 2, 3, P.violetLight], [21, 11, 2, 2, P.turfLight],
  ],
  feather: [
    [4, 14, 16, 1, P.ink, 0.28],
    [5, 11, 15, 2, P.greyShadow], [8, 8, 11, 2, P.greyBase], [11, 5, 8, 2, P.greyLight],
    [7, 8, 4, 3, P.blueShadow], [11, 5, 5, 3, P.blueBase], [15, 3, 4, 3, P.blueLight],
    [18, 2, 2, 3, P.cream],
  ],
  thermometer: [
    [7, 14, 11, 1, P.ink, 0.28],
    [10, 2, 5, 10, P.greyShadow], [11, 2, 3, 9, P.cream],
    [12, 6, 1, 7, P.redBase], [9, 10, 7, 4, P.redShadow], [10, 10, 5, 3, P.redBase],
    [16, 3, 4, 1, P.goldLight], [16, 6, 3, 1, P.goldBase], [16, 9, 4, 1, P.goldLight],
  ],
  defibrillator: [
    [3, 14, 18, 1, P.ink, 0.28],
    [2, 4, 7, 7, P.redShadow], [3, 4, 5, 5, P.redBase], [5, 10, 3, 4, P.greyLight],
    [15, 4, 7, 7, P.blueShadow], [16, 4, 5, 5, P.blueBase], [16, 10, 3, 4, P.greyLight],
    [11, 2, 2, 5, P.goldLight], [9, 6, 4, 2, P.goldBase], [11, 8, 2, 4, P.goldLight],
  ],
} as const satisfies Record<TriggerVisual, readonly AwakeningPixelBlock[]>;

export function AwakeningTriggerCalloutIcon({ visual }: { visual: TriggerVisual }) {
  return (
    <Canvas pointerEvents="none" style={styles.canvas}>
      <AwakeningPixelSprite
        x={12}
        y={8}
        width={24}
        height={16}
        blocks={CALLOUT_ART[visual]}
        scale={1}
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { width: 24, height: 16 },
});
