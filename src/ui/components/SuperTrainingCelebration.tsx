import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SfxPressable as Pressable } from './SfxPressable';
import {
  playSuperCelebrationSfx,
  playSuperTrainingYaySfx,
  stopSuperCelebrationSfx,
} from '../../render/management-sfx';
import { drillPresentationMs } from '../../render/drill-presentation-timing';
import { useCopy } from '../../i18n';

const CONFETTI_COLORS = [
  '#f6c744',
  '#d94f52',
  '#5b3a91',
  '#f4f1ea',
  '#63c56b',
  '#62b5e5',
];
/** A SUPER session is the rarest thing in a training week; it gets held. */
export const SUPER_CELEBRATION_MS = drillPresentationMs(3_400);
const REDUCED_MOTION_SUPER_CELEBRATION_MS = drillPresentationMs(800);
/** Four bursts, staggered — one shared clock made them all pop in unison. */
const FIREWORK_DELAYS_MS = [0, 260, 620, 980].map(drillPresentationMs);

export interface SuperTrainingCelebrationProps {
  /** The multiplied gain headline, e.g. "+5 PAC". */
  gainLabel: string;
  reduceMotion?: boolean;
  onComplete: () => void;
}

/**
 * ~2.72s absolute-fill takeover played inside the drill popup when a SUPER
 * session lands: confetti, two fireworks, and the big animated words.
 * Tapping anywhere ends it early.
 */
export function SuperTrainingCelebration({
  gainLabel,
  reduceMotion = false,
  onComplete,
}: SuperTrainingCelebrationProps) {
  const t = useCopy();
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const fireworkProgress = useRef(
    FIREWORK_DELAYS_MS.map(() => new Animated.Value(0)),
  ).current;
  const titleProgress = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const completeOnce = useRef(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // The cheer lands as the takeover leaves, whether it played out or was
    // tapped away — and the jingle underneath it ends here rather than ringing
    // on over the screen behind.
    stopSuperCelebrationSfx();
    playSuperTrainingYaySfx();
    onComplete();
  }).current;

  // The level-up jingle, for as long as the takeover is up. Started in its own
  // effect so the reduced-motion path — which keeps the payoff and drops only
  // the animation — still gets it.
  useEffect(() => {
    playSuperCelebrationSfx();
    // A takeover closed without completing (the drill popup dismissed out from
    // under it) must not leave the celebration jingle playing.
    return () => stopSuperCelebrationSfx();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(
        completeOnce,
        REDUCED_MOTION_SUPER_CELEBRATION_MS,
      );
      return () => clearTimeout(timer);
    }
    const confetti = Animated.timing(confettiProgress, {
      toValue: 1,
      duration: SUPER_CELEBRATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const fireworks = Animated.parallel(
      fireworkProgress.map((value, index) =>
        Animated.sequence([
          Animated.delay(FIREWORK_DELAYS_MS[index]),
          Animated.loop(
            Animated.timing(value, {
              toValue: 1,
              duration: drillPresentationMs(700),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            { iterations: 3, resetBeforeIteration: true },
          ),
        ]),
      ),
    );
    const title = Animated.spring(titleProgress, {
      toValue: 1,
      friction: 6.25,
      tension: 141,
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
  }, [
    completeOnce,
    confettiProgress,
    fireworkProgress,
    reduceMotion,
    titleProgress,
  ]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('superTraining.a11y.session', { gain: gainLabel })}
      onPress={completeOnce}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.backdrop}>
        {reduceMotion
          ? null
          : makeConfetti(320).map((piece) => (
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
                          // Further to fall, so a longer hold does not turn into slow-motion.
                          outputRange: [piece.top, 660],
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
            <Firework
              progress={fireworkProgress[0]}
              color="#f6c744"
              left={52}
              top={74}
              radius={52}
            />
            <Firework
              progress={fireworkProgress[1]}
              color="#62b5e5"
              left={258}
              top={126}
              radius={44}
            />
            <Firework
              progress={fireworkProgress[2]}
              color="#63c56b"
              left={132}
              top={228}
              radius={40}
            />
            <Firework
              progress={fireworkProgress[3]}
              color="#d94f52"
              left={286}
              top={286}
              radius={46}
            />
          </>
        )}
        <Animated.View
          style={[
            styles.titleCard,
            reduceMotion
              ? null
              : {
                  opacity: titleProgress,
                  transform: [
                    {
                      scale: titleProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                },
          ]}
        >
          <Text
            className="text-center font-pixel text-3xl uppercase text-gold"
            style={styles.titleGlow}
          >
            {t('superTraining.title')}
          </Text>
          <Text
            className="text-center font-pixel text-3xl uppercase text-gold"
            style={styles.titleGlow}
          >
            session!
          </Text>
          <View className="mt-4 items-center">
            <View className="border-[3px] border-b-[6px] border-ink bg-gold px-6 py-3">
              <Text className="font-pixel text-2xl uppercase text-ink">
                1.5× · {gainLabel}
              </Text>
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
  return Array.from({ length: 52 }, (_, index) => ({
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
  confetti: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(36,31,46,0.25)',
  },
  fireworkSpark: {
    position: 'absolute',
    width: 4,
    height: 14,
    borderRadius: 2,
  },
});
