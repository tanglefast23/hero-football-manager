import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { PixelText } from './PixelText';
import {
  CROWD_SPRITE_IDS,
  CUP_ROW_SPRITE_IDS,
  FINANCE_SPRITE_CELL,
  FINANCE_SPRITE_SCALE,
  financeSpriteRuns,
} from '../finance-pixel-art';
import { playMatchDayCallSfx, stopMatchDayCallSfx } from '../../render/management-sfx';

/**
 * The match-week callout: the same pixel card the Financial Report pops for
 * EXTREME ATTENDANCE, reused for the other half of the week. It lands once, as
 * the manager reaches the desk on a week with a fixture, holds for the call,
 * and goes.
 *
 * Deliberately the same shape and the same crowd as the surge banner — the game
 * only needs one visual language for "something is happening today", and a
 * second card style would make two announcements read as two systems.
 *
 * A Hero Cup week swaps the crowd for the cup cabinet and the fanfare for the
 * tannoy bugle: same card, same width, same five sprites, so the competition is
 * legible — and audible — before the line is read.
 *
 * It never blocks touches: the desk stays workable underneath while it holds.
 */

export interface MatchDayBannerProps {
  headline: string;
  accessibilityLabel: string;
  /** A cup tie draws trophies where a league week draws the crowd. */
  isCup: boolean;
  /** Called once the card has finished — the caller clears it and it unmounts. */
  onShown: () => void;
  reduceMotion: boolean;
}

/** Long enough to read twice, and longer than either match-day call. */
const HOLD_MS = 3300;
const FADE_MS = 250;
const SPRITE_PX = FINANCE_SPRITE_CELL * FINANCE_SPRITE_SCALE;

export function MatchDayBanner({
  headline,
  accessibilityLabel,
  isCup,
  onShown,
  reduceMotion,
}: MatchDayBannerProps) {
  const strip = isCup ? CUP_ROW_SPRITE_IDS : CROWD_SPRITE_IDS;
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;
    playMatchDayCallSfx(isCup);
    if (reduceMotion) {
      // Fully static for its hold — information, not decoration.
      scale.setValue(1);
      opacity.setValue(1);
      holdTimer = setTimeout(() => onShownRef.current(), HOLD_MS);
    } else {
      scale.setValue(0.2);
      opacity.setValue(0);
      animation = Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]);
      animation.start();
      holdTimer = setTimeout(() => {
        animation = Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        });
        animation.start(({ finished }) => {
          if (finished) onShownRef.current();
        });
      }, HOLD_MS);
    }
    return () => {
      if (holdTimer !== undefined) clearTimeout(holdTimer);
      animation?.stop();
      // The card can leave early — a tab change, a tap into the fixture — and a
      // call still playing over the team sheet is the loudest kind of stale.
      stopMatchDayCallSfx();
    };
  }, [isCup, reduceMotion, opacity, scale]);

  return (
    // items-center: the card shrink-wraps its content instead of spanning the
    // screen, matching the surge banner it borrows its look from.
    <View pointerEvents="none" className="absolute inset-x-4 top-1/4 items-center">
      {/* NativeWind ignores className on Animated views: the animated wrapper
          is style-only and the plain View inside carries the card look. */}
      <Animated.View
        accessibilityRole="alert"
        accessibilityLabel={accessibilityLabel}
        style={{ opacity, transform: [{ rotate: '-3deg' }, { scale }] }}
      >
        <View className="items-center border-2 border-b-4 border-ink bg-paper px-4 py-3">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {/* Keyed by slot, not by sprite: the cabinet repeats the small and
                medium cups either side of the grand one. */}
            {strip.map((spriteId, slot) => (
              <Canvas key={`${slot}:${spriteId}`} style={{ width: SPRITE_PX, height: SPRITE_PX }}>
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
          <View className="mt-2 flex-row items-center">
            <PixelText className="text-base uppercase text-blue-dark">{headline}</PixelText>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
