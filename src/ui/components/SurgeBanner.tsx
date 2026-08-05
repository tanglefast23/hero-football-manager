import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { PixelText } from './PixelText';
import {
  CROWD_SPRITE_IDS,
  FINANCE_SPRITE_CELL,
  FINANCE_SPRITE_SCALE,
  financeSpriteRuns,
  pickMerchToys,
} from '../finance-pixel-art';

/**
 * The surge callout that pops over the statement (spec §7): EXTREME
 * ATTENDANCE! with the pixel crowd, TRENDING MERCHANDISE! with the week's
 * deterministic toy shelf. Shows the queue head only; each banner holds two
 * seconds and reports back so the machine can dequeue FIFO. It never blocks
 * touches, and later rows keep spinning beneath it.
 */

export interface SurgeBannerEvent {
  rowId: string;
  kind: 'attendance' | 'merch';
}

export interface SurgeBannerProps {
  queue: readonly SurgeBannerEvent[];
  settlementSeason: number;
  settlementWeek: number;
  onShown: (rowId: string) => void;
  reduceMotion: boolean;
}

const HOLD_MS = 2000;
const FADE_MS = 200;
const SPRITE_PX = FINANCE_SPRITE_CELL * FINANCE_SPRITE_SCALE;

export function SurgeBanner({
  queue,
  settlementSeason,
  settlementWeek,
  onShown,
  reduceMotion,
}: SurgeBannerProps) {
  const head = queue[0];
  const headRowId = head?.rowId;
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  // Keyed to the queue-head rowId: a queue change mid-display tears down this
  // banner's timers and animations before the next banner's effect starts.
  useEffect(() => {
    if (headRowId === undefined) return undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;
    if (reduceMotion) {
      // Fully static for its two seconds — information, not decoration.
      scale.setValue(1);
      opacity.setValue(1);
      holdTimer = setTimeout(() => onShownRef.current(headRowId), HOLD_MS);
    } else {
      scale.setValue(0.2);
      opacity.setValue(0);
      animation = Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]);
      animation.start();
      holdTimer = setTimeout(() => {
        animation = Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true });
        animation.start(({ finished }) => {
          if (finished) onShownRef.current(headRowId);
        });
      }, HOLD_MS);
    }
    return () => {
      if (holdTimer !== undefined) clearTimeout(holdTimer);
      animation?.stop();
    };
  }, [headRowId, reduceMotion, opacity, scale]);

  if (head === undefined) return null;
  const attendance = head.kind === 'attendance';
  const sprites = attendance
    ? [...CROWD_SPRITE_IDS]
    : pickMerchToys(settlementSeason, settlementWeek);
  const headline = attendance ? 'Extreme attendance!' : 'Trending merchandise!';

  return (
    <View pointerEvents="none" className="absolute inset-x-4 top-1/4">
      {/* NativeWind ignores className on Animated views: the animated wrapper
          is style-only and the plain View inside carries the card look. */}
      <Animated.View
        accessibilityRole="alert"
        accessibilityLabel={headline}
        style={{ opacity, transform: [{ rotate: '-3deg' }, { scale }] }}
      >
        <View className="items-center border-2 border-b-4 border-ink bg-paper px-3 py-3">
          <View style={{ flexDirection: 'row', gap: 4 }}>
          {sprites.map(spriteId => (
            <Canvas key={spriteId} style={{ width: SPRITE_PX, height: SPRITE_PX }}>
              {financeSpriteRuns(spriteId).map(run => (
                <Rect
                  key={run.id}
                  x={run.x * FINANCE_SPRITE_SCALE}
                  y={run.y * FINANCE_SPRITE_SCALE}
                  width={run.width * FINANCE_SPRITE_SCALE}
                  height={FINANCE_SPRITE_SCALE}
                  color={run.color}
                />
              ))}
            </Canvas>
          ))}
        </View>
          <PixelText
            className={attendance
              ? 'mt-2 text-base uppercase text-red-dark'
              : 'mt-2 text-base uppercase text-pitch-ink'}
          >
            {headline}
          </PixelText>
        </View>
      </Animated.View>
    </View>
  );
}
