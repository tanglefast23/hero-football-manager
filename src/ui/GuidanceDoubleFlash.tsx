import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export type GuidanceNudgeTarget =
  | 'home-tab'
  | 'squad-tab'
  | 'training-plan'
  | 'training-ground-alert'
  | 'training-ground-facility'
  | 'head-coach-market'
  | 'advance-week'
  | 'coaching-office'
  | 'youth-intake';

export interface GuidanceDoubleFlashProps {
  /** A larger value restarts the cue from its first flash. */
  readonly trigger?: number;
  /** Plays a positive trigger once when a newly revealed control mounts. */
  readonly playOnMount?: boolean;
  readonly reduceMotion?: boolean;
  readonly className?: string;
}

/**
 * A local, pointer-transparent nudge over one required control.
 *
 * The parent changes only `trigger`; the native opacity animation owns both
 * flashes. This keeps animation frames out of App state and out of large lists
 * such as the squad register. A new press stops and restarts the current run.
 */
export function GuidanceDoubleFlash({
  trigger,
  playOnMount = false,
  reduceMotion = false,
  className,
}: GuidanceDoubleFlashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const previousTriggerRef = useRef(trigger);
  const firstRunRef = useRef(true);

  useEffect(() => {
    const previousTrigger = previousTriggerRef.current;
    previousTriggerRef.current = trigger;
    const firstRun = firstRunRef.current;
    firstRunRef.current = false;
    opacity.stopAnimation();
    opacity.setValue(0);
    // A control mounted after the press receives the current token as its first
    // value. It did not exist for that press, so do not replay a stale cue each
    // time the manager changes tabs and remounts it.
    if (
      trigger === undefined ||
      trigger <= 0 ||
      (firstRun && !playOnMount) ||
      (!firstRun &&
        (previousTrigger === undefined || trigger <= previousTrigger))
    )
      return undefined;

    const show = (duration: number) =>
      Animated.timing(opacity, {
        toValue: 0.72,
        duration,
        useNativeDriver: true,
      });
    const hide = (duration: number) =>
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      });
    const flashOnce = () => Animated.sequence([show(80), hide(110)]);
    const animation = reduceMotion
      ? Animated.sequence([show(0), Animated.delay(500), hide(0)])
      : Animated.sequence([flashOnce(), Animated.delay(70), flashOnce()]);

    animation.start();
    return () => {
      animation.stop();
      opacity.setValue(0);
    };
  }, [opacity, playOnMount, reduceMotion, trigger]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}
    >
      {/* NativeWind does not style Animated.View in this project. Keep layout
          and colour on a plain child, and animate only the wrapper opacity. */}
      <View
        className={`flex-1 border-4 border-gold-dark bg-gold-light ${className ?? ''}`}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 50 },
});
