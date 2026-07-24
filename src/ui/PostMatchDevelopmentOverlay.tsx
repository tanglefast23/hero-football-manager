import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playTrainingStatDing } from '../render/management-sfx';
import { ActionButton, SectionLabel } from './components/Scorecard';
import { PixelPortrait } from './components/PixelPortrait';
import { FacilityCompletionCard } from './components/FacilityCompletionCard';
import { SfxPressable as Pressable } from './components/SfxPressable';
import type {
  AttributeGainViewModel,
  FacilityCompletionViewModel,
  PlayerDevelopmentViewModel,
} from './models';

export interface PostMatchDevelopmentOverlayProps {
  development: PlayerDevelopmentViewModel;
  onDismiss: () => void;
  reduceMotion?: boolean;
  facilityCompletion?: FacilityCompletionViewModel;
}

interface RevealStep {
  traineeIndex: number;
  gainIndex: number;
}

export function PostMatchDevelopmentOverlay({
  development,
  onDismiss,
  reduceMotion = false,
  facilityCompletion,
}: PostMatchDevelopmentOverlayProps) {
  const steps = useMemo<RevealStep[]>(() => development.focusedTrainees.flatMap(
    (trainee, traineeIndex) => trainee.gains.flatMap((gain, gainIndex) => (
      gain.delta > 0 ? [{ traineeIndex, gainIndex }] : []
    )),
  ), [development.focusedTrainees]);
  const [revealedCount, setRevealedCount] = useState(reduceMotion ? steps.length : 0);
  const [instantComplete, setInstantComplete] = useState(reduceMotion);
  const portraitReaction = useRef(new Animated.Value(1)).current;
  const revealDelayMs = Math.max(260, Math.min(560, Math.floor(3200 / Math.max(1, steps.length))));
  const sequenceComplete = revealedCount >= steps.length;
  const activeStep = steps.length === 0
    ? undefined
    : steps[Math.max(0, Math.min(steps.length - 1, revealedCount - 1))];
  const activeTraineeIndex = activeStep?.traineeIndex ?? 0;
  const activeTrainee = development.focusedTrainees[activeTraineeIndex];

  const revealEverything = useCallback(() => {
    setInstantComplete(true);
    setRevealedCount(steps.length);
  }, [steps.length]);

  useEffect(() => {
    if (reduceMotion) {
      setInstantComplete(true);
      setRevealedCount(steps.length);
      return undefined;
    }
    if (revealedCount >= steps.length) return undefined;
    const timeout = setTimeout(() => {
      playTrainingStatDing();
      setRevealedCount(count => Math.min(steps.length, count + 1));
    }, revealedCount === 0 ? Math.min(320, revealDelayMs) : revealDelayMs);
    return () => clearTimeout(timeout);
  }, [reduceMotion, revealDelayMs, revealedCount, steps.length]);

  useEffect(() => {
    if (reduceMotion || instantComplete || revealedCount === 0) {
      portraitReaction.setValue(1);
      return undefined;
    }
    portraitReaction.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(portraitReaction, {
        toValue: 0.72,
        damping: 7,
        stiffness: 240,
        mass: 0.65,
        useNativeDriver: true,
      }),
      Animated.spring(portraitReaction, {
        toValue: 1,
        damping: 6,
        stiffness: 180,
        mass: 0.68,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [instantComplete, portraitReaction, reduceMotion, revealedCount]);

  const handleRequestClose = sequenceComplete ? onDismiss : revealEverything;

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <SafeAreaView
        className="flex-1 justify-center px-3 py-4"
        style={{ backgroundColor: 'rgba(36,31,46,0.48)' }}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sequenceComplete ? 'Close player development' : 'Finish all stat animations'}
          className="absolute inset-0"
          onPress={handleRequestClose}
        />

        <View
          accessibilityViewIsModal
          className="w-full overflow-hidden border-2 border-b-4 border-ink bg-paper"
          style={{ maxHeight: '94%' }}
        >
          <View className="flex-row items-center justify-between border-b-2 border-ink bg-blue-light px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Training ground</Text>
              <Text className="mt-1 font-pixel text-xl uppercase text-ink">Stat boost!</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip player development and return Home"
              onPress={onDismiss}
              className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
            >
              <Text className="font-mono text-lg font-bold text-ink">×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 22 }}>
            {facilityCompletion ? (
              <FacilityCompletionCard completion={facilityCompletion} reduceMotion={reduceMotion} />
            ) : null}
            <SectionLabel
              eyebrow="Player development"
              title={sequenceComplete ? 'Boosts complete' : 'Getting stronger'}
              right={development.focusedTrainees.length > 1 ? (
                <View className="border-2 border-ink bg-violet px-2 py-1">
                  <Text className="font-mono text-sm font-bold text-paper">
                    {Math.min(activeTraineeIndex + 1, development.focusedTrainees.length)} / {development.focusedTrainees.length}
                  </Text>
                </View>
              ) : undefined}
            />

            {development.trainingSkippedWarning ? (
              <View className="mb-4 border-2 border-b-4 border-red-dark bg-red-light p-3">
                <Text className="font-mono text-sm font-bold uppercase text-red-dark">Training plan not completed</Text>
                <Text className="mt-1 text-base text-ink">{development.trainingSkippedWarning}</Text>
              </View>
            ) : null}

            {activeTrainee ? (
              <View className="items-center">
                <Animated.View
                  style={{
                    opacity: portraitReaction.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.72, 1, 1] }),
                    transform: [
                      { translateY: portraitReaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [5, -9, 0] }) },
                      { scale: portraitReaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.94, 1.09, 1] }) },
                      { rotate: portraitReaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: ['-2deg', '2deg', '0deg'] }) },
                    ],
                  }}
                >
                  <View className="border-2 border-b-4 border-ink bg-blue-light px-4 pt-3">
                    <PixelPortrait
                      playerId={activeTrainee.id}
                      role={activeTrainee.role}
                      lookId={activeTrainee.lookId}
                      expression="joy"
                    />
                  </View>
                </Animated.View>

                <Text className="mt-3 font-pixel text-xl uppercase text-ink">{activeTrainee.name}</Text>
                <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                  {activeTrainee.role} · Focus training
                </Text>

                <View className="mt-4 w-full flex-row flex-wrap justify-center gap-2">
                  {activeTrainee.gains.length > 0 ? activeTrainee.gains.map((gain, gainIndex) => {
                    const stepIndex = steps.findIndex(step => (
                      step.traineeIndex === activeTraineeIndex && step.gainIndex === gainIndex
                    ));
                    const revealed = stepIndex >= 0 && stepIndex < revealedCount;
                    return (
                      <CelebrationStat
                        key={gain.id}
                        gain={gain}
                        revealed={revealed}
                        highlighted={revealed && stepIndex === revealedCount - 1 && !instantComplete}
                        instant={instantComplete || reduceMotion}
                      />
                    );
                  }) : (
                    <View className="border-2 border-ink bg-white px-3 py-2">
                      <Text className="text-sm font-bold uppercase text-ink/60">Stats are at their training caps</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : development.trainingSkippedWarning === undefined ? (
              <View className="border-2 border-b-4 border-ink bg-white px-4 py-3">
                <Text className="text-center text-base text-ink/60">No focused player boosts this week.</Text>
              </View>
            ) : null}

            {!sequenceComplete ? (
              <Text className="mt-4 text-center font-mono text-sm uppercase text-ink/45">
                Tap once to finish every animation
              </Text>
            ) : null}
          </ScrollView>

          <View className="border-t-2 border-ink/20 bg-white p-3">
            <ActionButton
              label={sequenceComplete ? 'Back to Home  ▸' : 'Show all now  ▸'}
              accessibilityLabel={sequenceComplete ? 'Close player development and return Home' : 'Finish all stat animations now'}
              onPress={sequenceComplete ? onDismiss : revealEverything}
              variant={sequenceComplete ? 'primary' : 'action'}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CelebrationStat({
  gain,
  revealed,
  highlighted,
  instant,
}: {
  gain: AttributeGainViewModel;
  revealed: boolean;
  highlighted: boolean;
  instant: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(revealed ? gain.after : gain.before);
  const pop = useRef(new Animated.Value(revealed ? 1 : 0.78)).current;

  useEffect(() => {
    if (!revealed) {
      setDisplayValue(gain.before);
      pop.setValue(0.78);
      return undefined;
    }
    if (instant) {
      setDisplayValue(gain.after);
      pop.setValue(1);
      return undefined;
    }

    let frame = 0;
    let startedAt: number | null = null;
    const animateNumber = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 360);
      setDisplayValue(Math.round(gain.before + (gain.after - gain.before) * progress));
      if (progress < 1) frame = requestAnimationFrame(animateNumber);
    };
    frame = requestAnimationFrame(animateNumber);

    pop.setValue(0.68);
    const animation = Animated.sequence([
      Animated.spring(pop, {
        toValue: 1.18,
        damping: 6,
        stiffness: 260,
        mass: 0.55,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        damping: 7,
        stiffness: 190,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      cancelAnimationFrame(frame);
      animation.stop();
    };
  }, [gain.after, gain.before, gain.id, instant, pop, revealed]);

  return (
    <Animated.View
      accessible={revealed}
      accessibilityLabel={revealed ? `${gain.label} ${gain.before} to ${gain.after}, plus ${gain.delta}` : undefined}
      className={revealed
        ? 'min-w-32 border-2 border-b-4 border-pitch-dark bg-pitch-light px-3 py-2'
        : 'min-w-32 border-2 border-b-4 border-ink/20 bg-white px-3 py-2'}
      style={{
        opacity: revealed ? 1 : 0.3,
        transform: [{ scale: highlighted ? pop : 1 }],
      }}
    >
      <Text className={revealed
        ? 'font-mono text-sm font-bold uppercase text-pitch-dark'
        : 'font-mono text-sm font-bold uppercase text-ink/40'}>
        {gain.label}
      </Text>
      <View className="mt-1 flex-row items-baseline gap-1">
        <Text className="font-mono text-base text-ink/50">{gain.before} →</Text>
        <Text className={revealed
          ? 'font-mono text-xl font-bold text-pitch-dark'
          : 'font-mono text-xl font-bold text-ink/25'}>
          {revealed ? displayValue : '••'}
        </Text>
        <Animated.Text
          className="font-mono text-lg font-bold text-pitch-dark"
          style={{ opacity: revealed ? 1 : 0, transform: [{ scale: highlighted ? pop : 1 }] }}
        >
          +{gain.delta}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}
