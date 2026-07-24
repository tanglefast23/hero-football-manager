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
  animationsStarted?: boolean;
  onStatAreaLayout?: (offsetY: number) => void;
  reduceMotion?: boolean;
}

export function PlayerDevelopmentSpotlight({
  development,
  animationsStarted = true,
  onStatAreaLayout,
  reduceMotion = false,
}: PlayerDevelopmentSpotlightProps) {
  const trainees = development.focusedTrainees;
  const [locallyComplete, setLocallyComplete] = useState(false);
  const spotlightOffsetY = useRef(0);
  const listOffsetY = useRef(0);
  const firstCardOffsetY = useRef(0);
  const firstStatRowOffsetY = useRef<number | null>(null);
  const reaction = useRef(new Animated.Value(1)).current;
  const complete = reduceMotion || locallyComplete;
  const reportStatAreaLayout = () => {
    if (firstStatRowOffsetY.current === null) return;
    onStatAreaLayout?.(
      spotlightOffsetY.current
      + listOffsetY.current
      + firstCardOffsetY.current
      + firstStatRowOffsetY.current,
    );
  };

  useEffect(() => {
    if (!animationsStarted || complete || trainees.length === 0) {
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
  }, [animationsStarted, complete, reaction, trainees.length]);

  useEffect(() => {
    if (!animationsStarted || complete) return undefined;
    const timeout = setTimeout(() => setLocallyComplete(true), 1400);
    return () => clearTimeout(timeout);
  }, [animationsStarted, complete]);

  return (
    <Pressable
      accessibilityRole="summary"
      accessibilityLabel={animationsStarted
        ? 'Player development. Tap to finish the animations.'
        : 'Player development.'}
      onPress={() => {
        if (animationsStarted) setLocallyComplete(true);
      }}
      onLayout={event => {
        spotlightOffsetY.current = event.nativeEvent.layout.y;
        reportStatAreaLayout();
      }}
      className="items-center"
    >
      {development.trainingSkippedWarning ? (
        <View className="mb-4 w-full border-2 border-b-4 border-red-dark bg-red-light p-3">
          <Text className="font-mono text-sm font-bold uppercase text-red-dark">Training plan not completed</Text>
          <Text className="mt-1 text-base text-ink">{development.trainingSkippedWarning}</Text>
        </View>
      ) : null}

      {trainees.length > 0 ? (
        <View
          className="w-full gap-3"
          onLayout={event => {
            listOffsetY.current = event.nativeEvent.layout.y;
            reportStatAreaLayout();
          }}
        >
          {trainees.map((trainee, index) => (
            <Animated.View
              key={trainee.id}
              style={{
                opacity: reaction.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: reaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [16, -8, 0] }) },
                  { scale: reaction.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.88, 1.04, 1] }) },
                ],
              }}
              onLayout={index === 0
                ? event => {
                    firstCardOffsetY.current = event.nativeEvent.layout.y;
                    reportStatAreaLayout();
                  }
                : undefined}
            >
              <View className="w-full flex-row items-center border-2 border-b-4 border-ink bg-white p-3">
                <View className="border-2 border-ink bg-blue-light px-2 pt-2">
                  <PixelPortrait
                    playerId={trainee.id}
                    role={trainee.role}
                    lookId={trainee.lookId}
                    expression="joy"
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-pixel text-xl uppercase text-ink">{trainee.name}</Text>
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                    {trainee.role} · Focus training complete
                  </Text>
                  <View
                    className="mt-2 flex-row flex-wrap gap-2"
                    onLayout={index === 0
                      ? event => {
                          firstStatRowOffsetY.current = event.nativeEvent.layout.y;
                          reportStatAreaLayout();
                        }
                      : undefined}
                  >
                    {trainee.gains.length > 0 ? trainee.gains.map(gain => (
                      <CountedStat
                        key={gain.id}
                        gain={gain}
                        started={animationsStarted}
                        complete={complete}
                      />
                    )) : (
                      <View className="border-2 border-ink bg-white px-3 py-2">
                        <Text className="text-sm font-bold uppercase text-ink/60">No focused stat gain this week</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
      ) : development.trainingSkippedWarning === undefined ? (
        <View className="border-2 border-b-4 border-ink bg-white px-4 py-3">
          <Text className="text-center text-base text-ink/60">No focused trainees this week.</Text>
        </View>
      ) : null}

      {animationsStarted && !complete ? (
        <Text className="mt-3 font-mono text-sm uppercase text-paper/60">Tap once to finish</Text>
      ) : null}
    </Pressable>
  );
}

function CountedStat({
  gain,
  started,
  complete,
}: {
  gain: AttributeGainViewModel;
  started: boolean;
  complete: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(complete ? gain.after : gain.before);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (complete) {
      setDisplayValue(gain.after);
      pop.setValue(1);
      return undefined;
    }
    setDisplayValue(gain.before);
    pop.setValue(1);
    if (!started) return undefined;
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
  }, [complete, gain.after, gain.before, gain.id, pop, started]);

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
