import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SfxPressable as Pressable } from './SfxPressable';
import { playDrillGainRevealSfx } from '../../render/management-sfx';

export const DRILL_GAIN_REVEAL_MS = 1_400;
const REDUCED_MOTION_GAIN_REVEAL_MS = 700;
const SPOKE_COUNT = 12;

export interface DrillGainRevealProps {
  /** The headline in full words, e.g. "+9 Shooting". */
  gainLabel: string;
  reduceMotion?: boolean;
  onComplete: () => void;
}

/**
 * The drill's payoff. Once the number has finished climbing, the gain takes over
 * the whole popup as a broadcast-style super: burst lines sweep out, the plate
 * punches in, and it lands on its own hit. Tapping anywhere ends it early.
 */
export function DrillGainReveal({
  gainLabel,
  reduceMotion = false,
  onComplete,
}: DrillGainRevealProps) {
  const punch = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const burst = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const completedRef = useRef(false);
  const completeOnce = useRef(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }).current;

  useEffect(() => {
    playDrillGainRevealSfx();
    if (reduceMotion) {
      const held = setTimeout(completeOnce, REDUCED_MOTION_GAIN_REVEAL_MS);
      return () => clearTimeout(held);
    }
    const plate = Animated.spring(punch, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    });
    const rays = Animated.timing(burst, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    plate.start();
    rays.start();
    const held = setTimeout(completeOnce, DRILL_GAIN_REVEAL_MS);
    return () => {
      clearTimeout(held);
      plate.stop();
      rays.stop();
    };
  }, [burst, completeOnce, punch, reduceMotion]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gainLabel}. Tap to continue.`}
      onPress={completeOnce}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.backdrop}>
        {reduceMotion ? null : (
          <View pointerEvents="none" style={styles.burstLayer}>
            {Array.from({ length: SPOKE_COUNT }, (_, index) => {
              const angle = (index / SPOKE_COUNT) * 360;
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.spoke,
                    {
                      opacity: burst.interpolate({
                        inputRange: [0, 0.25, 1],
                        outputRange: [0, 0.9, 0],
                      }),
                      transform: [
                        { rotate: `${angle}deg` },
                        {
                          translateY: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-8, -104],
                          }),
                        },
                        {
                          scaleY: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.4, 1.6],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        <Animated.View
          style={[
            styles.plateShadow,
            reduceMotion ? null : {
              opacity: punch,
              transform: [{
                scale: punch.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              }],
            },
          ]}
        >
          <View style={styles.plate}>
            <Text style={styles.kicker}>Session gain</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.headline}>
              {gainLabel.toUpperCase()}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(36,31,46,0.9)',
    zIndex: 30,
  },
  burstLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  spoke: {
    position: 'absolute',
    width: 6,
    height: 40,
    borderRadius: 3,
    backgroundColor: '#f6c744',
  },
  plateShadow: {
    paddingRight: 6,
    paddingBottom: 8,
    backgroundColor: '#18131f',
  },
  plate: {
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#3f8a4a',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  kicker: {
    color: '#d9f0d2',
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 8,
    color: '#ffffff',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 34,
    letterSpacing: 1,
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
});
