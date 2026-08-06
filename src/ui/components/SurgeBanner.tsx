import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { PixelText } from './PixelText';
import { formatCurrency } from './Scorecard';
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
  /** What the surge added versus a typical week — shown beside the headline. */
  bonusAmount: number;
}

export interface SurgeBannerProps {
  queue: readonly SurgeBannerEvent[];
  settlementSeason: number;
  settlementWeek: number;
  onShown: (rowId: string) => void;
  reduceMotion: boolean;
}

const HOLD_MS = 3000;
const FADE_MS = 200;
const SPRITE_PX = FINANCE_SPRITE_CELL * FINANCE_SPRITE_SCALE;
/** The surged row's permanent tint — the banner's bonus wears the same fire. */
const BONUS_COLOR = '#b45309';

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

  const bonusLabel = head.bonusAmount > 0 ? `+${formatCurrency(head.bonusAmount)}` : null;

  return (
    // items-center: the card shrink-wraps its content instead of spanning the
    // panel (owner revision, 2026-08-06).
    <View pointerEvents="none" className="absolute inset-x-4 top-1/4 items-center">
      {/* NativeWind ignores className on Animated views: the animated wrapper
          is style-only and the plain View inside carries the card look. */}
      <Animated.View
        accessibilityRole="alert"
        accessibilityLabel={bonusLabel === null ? headline : `${headline} ${bonusLabel} extra`}
        style={{ opacity, transform: [{ rotate: '-3deg' }, { scale }] }}
      >
        <View className="items-center border-2 border-b-4 border-ink bg-paper px-4 py-3">
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
          <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
            <PixelText
              className={attendance
                ? 'text-base uppercase text-red-dark'
                : 'text-base uppercase text-pitch-ink'}
            >
              {headline}
            </PixelText>
            {bonusLabel === null ? null : (
              <PixelText className="text-base uppercase" style={{ color: BONUS_COLOR }}>
                {bonusLabel}
              </PixelText>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
