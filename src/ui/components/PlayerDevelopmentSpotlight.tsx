import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SfxPressable as Pressable } from './SfxPressable';
import type {
  AttributeGainViewModel,
  PlayerDevelopmentViewModel,
} from '../models';
import { PixelPortrait } from './PixelPortrait';

export interface PlayerDevelopmentSpotlightProps {
  development: PlayerDevelopmentViewModel;
  reduceMotion?: boolean;
  forceComplete?: boolean;
}

export function PlayerDevelopmentSpotlight({
  development,
  reduceMotion = false,
  forceComplete = false,
}: PlayerDevelopmentSpotlightProps) {
  const trainees = development.focusedTrainees;
  const [activeIndex, setActiveIndex] = useState(0);
  const [locallyComplete, setLocallyComplete] = useState(false);
  const reaction = useRef(new Animated.Value(1)).current;
  const complete = reduceMotion || forceComplete || locallyComplete;
  const activeTrainee = trainees[Math.min(activeIndex, Math.max(0, trainees.length - 1))];

  useEffect(() => {
    if (complete || trainees.length < 2) return undefined;
    const stepMs = Math.max(180, Math.floor(2100 / trainees.length));
    const interval = setInterval(() => {
      setActiveIndex(index => {
        if (index >= trainees.length - 1) {
          clearInterval(interval);
          return index;
        }
        return index + 1;
      });
    }, stepMs);
    return () => clearInterval(interval);
  }, [complete, trainees.length]);

  useEffect(() => {
    if (complete || activeTrainee === undefined) {
      reaction.setValue(1);
      return undefined;
    }
    reaction.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(reaction, {
        toValue: 0.72,
        damping: 7,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(reaction, {
        toValue: 1,
        damping: 6,
        stiffness: 170,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeTrainee?.id, complete, reaction]);

  useEffect(() => {
    if (complete) return undefined;
    const timeout = setTimeout(() => setLocallyComplete(true), 2800);
    return () => clearTimeout(timeout);
  }, [complete]);

  return (
    <Pressable
      accessibilityRole="summary"
      accessibilityLabel="Player development. Tap to finish the animations."
      onPress={() => setLocallyComplete(true)}
      className="items-center"
    >
      {development.trainingSkippedWarning ? (
        <View className="mb-4 w-full border-2 border-b-4 border-red-dark bg-red-light p-3">
          <Text className="font-mono text-sm font-bold uppercase text-red-dark">Training plan not completed</Text>
          <Text className="mt-1 text-base text-ink">{development.trainingSkippedWarning}</Text>
        </View>
      ) : null}

      {activeTrainee ? (
        <View className="w-full items-center">
          <Animated.View
            style={{
              opacity: reaction.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: reaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [16, -8, 0] }) },
                { scale: reaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.88, 1.08, 1] }) },
                { rotate: reaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: ['-2deg', '2deg', '0deg'] }) },
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
            {activeTrainee.role} · Focus training complete
          </Text>
          <View className="mt-3 flex-row flex-wrap justify-center gap-2 px-2">
            {activeTrainee.gains.length > 0 ? activeTrainee.gains.map(gain => (
              <CountedStat
                key={gain.id}
                gain={gain}
                complete={complete}
              />
            )) : (
              <View className="border-2 border-ink bg-white px-3 py-2">
                <Text className="text-sm font-bold uppercase text-ink/60">Current stats are at their training caps</Text>
              </View>
            )}
          </View>

          {trainees.length > 1 ? (
            <View className="mt-4 flex-row flex-wrap justify-center gap-1.5">
              {trainees.map((trainee, index) => (
                <Pressable
                  key={trainee.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${trainee.name}'s training gains`}
                  onPress={() => setActiveIndex(index)}
                  className={index === activeIndex
                    ? 'border-2 border-ink bg-violet px-2 py-1.5'
                    : 'border-2 border-ink/40 bg-white px-2 py-1.5'}
                >
                  <Text className={index === activeIndex
                    ? 'font-mono text-sm font-bold uppercase text-paper'
                    : 'font-mono text-sm font-bold uppercase text-ink/60'}>
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : development.trainingSkippedWarning === undefined ? (
        <View className="border-2 border-b-4 border-ink bg-white px-4 py-3">
          <Text className="text-center text-base text-ink/60">No focused trainees this week.</Text>
        </View>
      ) : null}

      {development.conditioning.length > 0 ? (
        <View className="mt-5 w-full border-y-2 border-ink/20 py-3">
          <Text className="text-center font-mono text-sm font-bold uppercase text-blue-dark">Squad conditioning</Text>
          {development.conditioning.map(item => (
            <Text key={item.id} className="mt-1 text-center text-base font-bold text-ink">
              {item.playerCount} player{item.playerCount === 1 ? '' : 's'} · {item.attributeLabel} +{item.gain}
            </Text>
          ))}
        </View>
      ) : null}

      {!complete ? (
        <Text className="mt-3 font-mono text-sm uppercase text-ink/40">Tap once to finish</Text>
      ) : null}
    </Pressable>
  );
}

function CountedStat({ gain, complete }: { gain: AttributeGainViewModel; complete: boolean }) {
  const [displayValue, setDisplayValue] = useState(complete ? gain.after : gain.before);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (complete) {
      setDisplayValue(gain.after);
      pop.setValue(1);
      return undefined;
    }
    setDisplayValue(gain.before);
    let frame = 0;
    let popped = false;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 520);
      setDisplayValue(Math.round(gain.before + (gain.after - gain.before) * progress));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else if (!popped) {
        popped = true;
        // Pop the chip as its number lands.
        Animated.sequence([
          Animated.spring(pop, { toValue: 1.18, damping: 6, stiffness: 260, mass: 0.6, useNativeDriver: true }),
          Animated.spring(pop, { toValue: 1, damping: 7, stiffness: 220, mass: 0.6, useNativeDriver: true }),
        ]).start();
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [complete, gain.after, gain.before, gain.id, pop]);

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <View
        accessible
        accessibilityLabel={`${gain.label} ${gain.before} to ${gain.after}, plus ${gain.delta}`}
        className="border-2 border-b-4 border-ink bg-white px-3 py-2"
      >
        <Text className="font-mono text-sm font-bold uppercase text-blue-dark">{gain.label}</Text>
        <View className="mt-1 flex-row items-baseline gap-1">
          <Text className="font-mono text-base text-ink/50">{gain.before} →</Text>
          <Text className="font-mono text-xl font-bold text-pitch-dark">{displayValue}</Text>
          <Text className="font-mono text-sm font-bold text-pitch-dark">(+{gain.delta})</Text>
        </View>
      </View>
    </Animated.View>
  );
}
