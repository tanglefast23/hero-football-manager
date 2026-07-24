import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SfxPressable as Pressable } from './SfxPressable';

const CONFETTI_COLORS = ['#f6c744', '#d94f52', '#5b3a91', '#f4f1ea', '#63c56b', '#62b5e5'];
export const SUPER_CELEBRATION_MS = 2000;

export interface SuperTrainingCelebrationProps {
  /** The multiplied gain headline, e.g. "+5 PAC". */
  gainLabel: string;
  reduceMotion?: boolean;
  onComplete: () => void;
}

/**
 * ~2s absolute-fill takeover played inside the drill popup when a SUPER
 * session lands: confetti, two fireworks, and the big animated words.
 * Tapping anywhere ends it early.
 */
export function SuperTrainingCelebration({
  gainLabel,
  reduceMotion = false,
  onComplete,
}: SuperTrainingCelebrationProps) {
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const fireworkProgress = useRef(new Animated.Value(0)).current;
  const titleProgress = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const completeOnce = useRef(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }).current;

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(completeOnce, 600);
      return () => clearTimeout(timer);
    }
    const confetti = Animated.timing(confettiProgress, {
      toValue: 1,
      duration: SUPER_CELEBRATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const fireworks = Animated.loop(
      Animated.timing(fireworkProgress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      { iterations: 3, resetBeforeIteration: true },
    );
    const title = Animated.spring(titleProgress, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    });
    confetti.start();
    fireworks.start();
    title.start();
    const timer = setTimeout(completeOnce, SUPER_CELEBRATION_MS);
    return () => {
      clearTimeout(timer);
      confetti.stop();
      fireworks.stop();
      title.stop();
    };
  }, [completeOnce, confettiProgress, fireworkProgress, reduceMotion, titleProgress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Super training session, ${gainLabel}. Tap to continue.`}
      onPress={completeOnce}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.backdrop}>
        {reduceMotion ? null : makeConfetti(320).map(piece => (
          <Animated.View
            key={piece.id}
            style={[
              styles.confetti,
              {
                left: piece.left,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
                opacity: confettiProgress.interpolate({
                  inputRange: [0, 0.1, 0.9, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: confettiProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [piece.top, 460],
                    }),
                  },
                  {
                    rotate: confettiProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${piece.turns * 360}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
        {reduceMotion ? null : (
          <>
            <Firework progress={fireworkProgress} color="#f6c744" left={60} top={90} radius={44} />
            <Firework progress={fireworkProgress} color="#62b5e5" left={250} top={140} radius={38} />
          </>
        )}
        <Animated.View
          style={[
            styles.titleCard,
            reduceMotion ? null : {
              opacity: titleProgress,
              transform: [{
                scale: titleProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              }],
            },
          ]}
        >
          <Text className="text-center font-pixel text-2xl uppercase text-gold" style={styles.titleGlow}>
            Super training
          </Text>
          <Text className="text-center font-pixel text-2xl uppercase text-gold" style={styles.titleGlow}>
            session!
          </Text>
          <View className="mt-3 items-center">
            <View className="border-2 border-b-4 border-ink bg-gold px-4 py-2">
              <Text className="font-pixel text-xl uppercase text-ink">1.5× · {gainLabel}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function Firework({
  progress,
  color,
  left,
  top,
  radius,
}: {
  progress: Animated.Value;
  color: string;
  left: number;
  top: number;
  radius: number;
}) {
  return (
    <View style={{ position: 'absolute', left, top }} pointerEvents="none">
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return (
          <Animated.View
            key={index}
            style={[
              styles.fireworkSpark,
              {
                backgroundColor: color,
                opacity: progress.interpolate({
                  inputRange: [0, 0.18, 0.82, 1],
                  outputRange: [0, 1, 0.8, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos(angle) * radius],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * radius],
                    }),
                  },
                  { rotate: `${(angle * 180) / Math.PI + 90}deg` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function makeConfetti(width: number) {
  return Array.from({ length: 36 }, (_, index) => ({
    id: `super-confetti-${index}`,
    left: (index * 73) % Math.max(1, width),
    top: -40 - ((index * 47) % 200),
    width: 5 + (index % 3) * 2,
    height: 9 + (index % 4) * 2,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    turns: 2 + (index % 4),
  }));
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,31,46,0.88)',
    zIndex: 30,
  },
  titleCard: { paddingHorizontal: 18 },
  titleGlow: {
    textShadowColor: '#d94f52',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  confetti: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(36,31,46,0.25)' },
  fireworkSpark: { position: 'absolute', width: 4, height: 14, borderRadius: 2 },
});
