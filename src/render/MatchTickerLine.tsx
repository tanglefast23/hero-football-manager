/**
 * One line of the live-match event ticker.
 *
 * The line carries no plate. What holds it off the pitch is a hard eight-way
 * ink ring around the glyphs plus one extruded copy dropped below them, which
 * together read as raised type rather than as text laid on grass. React Native
 * has no text stroke and a `Text` style carries at most one shadow, so both
 * effects are drawn as copies of the same string stacked under the fill.
 *
 * Motion is a single Reanimated crossing: the line enters at the left
 * touchline and leaves at the right. It freezes on a pause rather than
 * scrolling away behind a cut-in, and a line that is BORN into a pause (half
 * time, a team talk) never scrolls at all — it holds centred for its whole
 * life, because a ticker that started under a sheet would only be seen running
 * off at the far side.
 */
import { useEffect, useRef } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useMatchScreenStyles } from './match-screen-styles';
import type { MatchSpeed } from './match-speed';
import {
  EXTRUDE_OFFSETS,
  OUTLINE_OFFSETS,
  OUTLINE_OFFSETS_CHEAP,
  SHADOW_DROP_PX,
  tickerLaneTop,
  tickerRemainingDurationMs,
  tickerTranslateX,
} from './match-ticker';

export interface MatchTickerLineProps {
  readonly text: string;
  readonly tone: 'gold' | 'red' | 'blue';
  /** The footnote under a powered goal, set smaller than the goal line itself. */
  readonly small?: boolean;
  readonly lane: number;
  /** Travel distance. The line starts one pitch left of the frame and ends one right. */
  readonly pitchWidth: number;
  readonly lifeTicks: number;
  readonly speed: MatchSpeed;
  /**
   * Wall-clock crossing length, overriding the tick-derived one. Full time is
   * the only caller: sim ticks stop at the whistle, so that line's real life is
   * the screen's `FULLTIME_HOLD_MS` hold, which does not scale with speed.
   */
  readonly durationMs?: number;
  readonly paused: boolean;
  readonly reduceMotion: boolean;
  readonly reducedEffects: boolean;
}

export function MatchTickerLine({
  text,
  tone,
  small = false,
  lane,
  pitchWidth,
  lifeTicks,
  speed,
  durationMs,
  paused,
  reduceMotion,
  reducedEffects,
}: MatchTickerLineProps) {
  const styles = useMatchScreenStyles();
  const progress = useSharedValue(0);
  // Captured on the first render only: a line born behind a pause stays a
  // still line even after play resumes.
  const bornPaused = useRef(paused).current;
  const held = reduceMotion || reducedEffects || bornPaused;

  useEffect(() => {
    if (held) return;
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining =
      durationMs === undefined
        ? tickerRemainingDurationMs(progress.value, lifeTicks, speed)
        : Math.max(1, durationMs * Math.max(0, 1 - progress.value));
    progress.value = withTiming(1, {
      duration: remaining,
      easing: Easing.linear,
    });
  }, [held, paused, speed, lifeTicks, durationMs, progress]);

  const crossing = useAnimatedStyle(() => ({
    transform: [{ translateX: tickerTranslateX(progress.value, pitchWidth) }],
  }));

  const fill: StyleProp<TextStyle> = [
    styles.banner,
    tone === 'red' ? styles.bannerThreat : null,
    tone === 'blue' ? styles.bannerAction : null,
    small ? styles.bannerSmall : null,
  ];
  const ring = reducedEffects ? OUTLINE_OFFSETS_CHEAP : OUTLINE_OFFSETS;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tickerRow,
        held ? styles.tickerRowHeld : null,
        { top: tickerLaneTop(lane) },
        held ? null : crossing,
      ]}
    >
      <View style={styles.tickerGlyphs}>
        {/* The extrusion: a soft shadow at the bottom, then hard ink copies
          stepped up to the fill. Together they read as raised type rather than
          text printed on the grass. First casualty when the device asks for
          fewer effects — the ring stays, because that is legibility. */}
        {reducedEffects ? null : (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={1}
            style={[fill, styles.bannerShadow, { top: SHADOW_DROP_PX }]}
          >
            {text}
          </Text>
        )}
        {reducedEffects
          ? null
          : EXTRUDE_OFFSETS.map((drop) => (
              <Text
                key={`extrude-${drop}`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                numberOfLines={1}
                style={[fill, styles.bannerOutline, { top: drop }]}
              >
                {text}
              </Text>
            ))}
        {ring.map((offset) => (
          <Text
            key={`${offset.x},${offset.y}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={1}
            style={[fill, styles.bannerOutline, { left: offset.x, top: offset.y }]}
          >
            {text}
          </Text>
        ))}
        <Text numberOfLines={1} style={fill}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}
