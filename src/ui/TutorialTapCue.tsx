import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface TutorialTapCueProps {
  label?: string;
  detail: string;
  direction?: 'up' | 'down';
  style?: StyleProp<ViewStyle>;
}

/** A non-blocking, Kairosoft-style prompt anchored beside the real control. */
export function TutorialTapCue({
  label = 'Tap here',
  detail,
  direction = 'down',
  style,
}: TutorialTapCueProps) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [bounce]);

  const travel = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'down' ? [-3, 6] : [3, -6],
  });

  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityRole="text"
      pointerEvents="none"
      style={[styles.anchor, style]}
    >
      <Animated.View style={[styles.cue, { transform: [{ translateY: travel }] }]}>
        {direction === 'up' ? <Text style={styles.arrow}>▲</Text> : null}
        <View style={styles.labelShadow}>
          <View style={styles.labelFrame}>
            <Text className="text-center font-pixel text-sm uppercase text-white">{label}</Text>
            <Text className="mt-1 text-center font-mono text-[10px] uppercase text-white/90">
              {detail}
            </Text>
          </View>
        </View>
        {direction === 'down' ? <Text style={styles.arrow}>▼</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 146,
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
