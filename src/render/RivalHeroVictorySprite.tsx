import { useEffect, useMemo } from 'react';
import {
  Atlas,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { RivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { playRivalHeroLaugh, stopRivalHeroLaugh } from './rival-hero-voice';

/** Four-point-eight seconds total, with the final 1.5 seconds reserved for fade. */
export const FULLTIME_RIVAL_VICTORY_HOLD_MS = 4800;
export const FULLTIME_RIVAL_VICTORY_FADE_MS = 1500;
export const FULLTIME_RIVAL_VICTORY_FADE_AT_MS =
  FULLTIME_RIVAL_VICTORY_HOLD_MS - FULLTIME_RIVAL_VICTORY_FADE_MS;
export const FULLTIME_RIVAL_VICTORY_REDUCED_HOLD_MS = 2200;

const LAUGH_DELAY_MS = 450;
const JUMP_CYCLE_MS = 520;
const JUMP_HEIGHT = 12;
const CELL_WIDTH = 24;
const CELL_HEIGHT = 30;

export function RivalHeroVictorySprite({
  heroId,
  image,
  sprite,
  pitchWidth,
  pitchHeight,
  drawScale,
  reduceMotion,
}: {
  heroId: RivalHeroIntroHeroId;
  image: SkImage;
  sprite: SkRect;
  pitchWidth: number;
  pitchHeight: number;
  drawScale: number;
  reduceMotion: boolean;
}) {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = 0;
    if (!reduceMotion) {
      bounce.value = withRepeat(
        withTiming(1, {
          duration: JUMP_CYCLE_MS,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }
    const laughTimer = setTimeout(
      () => playRivalHeroLaugh(heroId),
      LAUGH_DELAY_MS,
    );
    return () => {
      clearTimeout(laughTimer);
      cancelAnimation(bounce);
      stopRivalHeroLaugh();
    };
  }, [bounce, heroId, reduceMotion]);

  const sprites = useMemo(() => [sprite], [sprite]);
  const transforms = useRSXformBuffer(1, (transform) => {
    'worklet';
    const wave = Math.sin(bounce.value * Math.PI * 2);
    const lift = reduceMotion ? 0 : Math.max(0, wave) * JUMP_HEIGHT * drawScale;
    transform.set(
      drawScale,
      0,
      pitchWidth / 2 - (CELL_WIDTH * drawScale) / 2,
      pitchHeight * 0.58 - (CELL_HEIGHT * drawScale) / 2 - lift,
    );
  });

  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      sampling={PIXEL_ART_SAMPLING}
    />
  );
}
