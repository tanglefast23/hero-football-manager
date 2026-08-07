import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { TUTORIAL_TAP_CUE_WIDTH } from './tutorial-cue-position';
import { useReducedMotion } from './use-reduced-motion';
import { useCopy } from '../i18n';

export interface TutorialTapCueProps {
  label?: string;
  detail: string;
  direction?: 'up' | 'down';
  labelOffsetX?: number;
  style?: StyleProp<ViewStyle>;
  /** App-level Reduce Motion preference; the OS setting is honoured regardless. */
  reduceMotion?: boolean;
  /**
   * Makes the cue itself tappable, to be dismissed. Cues that point at a real
   * control stay untappable so they can never swallow the tap they are asking
   * for — only a cue with nothing beneath it takes this.
   */
  onDismiss?: () => void;
}

/** A non-blocking, Kairosoft-style prompt anchored beside the real control. */
export function TutorialTapCue({
  label,
  detail,
  direction = 'down',
  labelOffsetX = 0,
  style,
  reduceMotion = false,
  onDismiss,
}: TutorialTapCueProps) {
  const t = useCopy();
  const cueLabel = label ?? t('matchScreen.tapHere');
  const bounce = useRef(new Animated.Value(0)).current;
  // This was the one perpetual animation Reduce Motion could not stop: the
  // cue loops for as long as the tutorial step is on screen.
  const reduce = useReducedMotion(reduceMotion);

  useEffect(() => {
    if (reduce) {
      bounce.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 430,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 430,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bounce, reduce]);

  const travel = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'down' ? [-3, 6] : [3, -6],
  });

  const cue = (
    <Animated.View style={[styles.cue, { transform: [{ translateY: travel }] }]}>
      {direction === 'up' ? <Text style={styles.arrow}>▲</Text> : null}
      <View
        style={[
          styles.labelShadow,
          labelOffsetX === 0 ? null : { transform: [{ translateX: labelOffsetX }] },
        ]}
      >
        <View style={styles.labelFrame}>
          <Text className="text-center font-pixel text-sm uppercase text-white">{cueLabel}</Text>
          <Text className="mt-1 text-center font-mono text-[10px] uppercase text-white/90">
            {detail}
          </Text>
        </View>
      </View>
      {direction === 'down' ? <Text style={styles.arrow}>▼</Text> : null}
    </Animated.View>
  );

  if (onDismiss !== undefined) {
    return (
      // box-none, so only the label itself takes the tap and the anchor's
      // full-width empty margins stay transparent to whatever is under them.
      <View pointerEvents="box-none" style={[styles.anchor, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('app.a11y.tapToDismiss', { sentence: `${cueLabel}. ${detail}.` })}
          onPress={onDismiss}
        >
          {cue}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`${cueLabel}. ${detail}`}
      accessibilityRole="text"
      pointerEvents="none"
      style={[styles.anchor, style]}
    >
      {cue}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: TUTORIAL_TAP_CUE_WIDTH,
    zIndex: 40,
  },
  cue: { alignItems: 'center' },
  labelShadow: {
    width: '100%',
    paddingBottom: 4,
    paddingRight: 4,
    backgroundColor: '#241f2e',
    borderRadius: 10,
  },
  labelFrame: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#f4f1ea',
    borderRadius: 9,
    backgroundColor: '#3f6fb5',
  },
  arrow: {
    marginVertical: -3,
    color: '#edb54a',
    fontSize: 31,
    lineHeight: 33,
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
});
