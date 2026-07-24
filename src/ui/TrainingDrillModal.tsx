import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { SuperTrainingCelebration } from './components/SuperTrainingCelebration';
import { playDrillResultSfx, playSuperTrainingSfx, playManagementActionSfx } from '../render/management-sfx';
import { useLayoutMode } from './layout/use-layout-mode';
import type { DrillResultViewModel, TrainingSlotStatOption } from './models';

const COUNT_UP_MS = 520;

export interface TrainingDrillModalProps {
  playerId: string;
  playerName: string;
  options: readonly TrainingSlotStatOption[];
  superChancePercent: number;
  injuryRiskPercent: number;
  condition: number;
  injuryWeeks: number;
  trainingPoints: number;
  /** The latest tap's resolution; ignored unless it belongs to this player. */
  lastDrillResult: DrillResultViewModel | null;
  /** Set while a promised player is owed drills: only they may train. */
  promiseGate?: { playerId: string; playerName: string; remaining: number };
  /** Jumps the popup to the promised player when their reminder is tapped. */
  onSwitchToPromised?: (playerId: string) => void;
  onTrainDrill: (playerId: string, pathId: string) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
}

/**
 * The whole training loop lives here now: tap a stat, the drill resolves
 * instantly, the result animates in place, and the buttons stay live for the
 * next tap. SUPER sessions take the popup over with fireworks; a lost injury
 * gamble interrupts with the OUT card.
 */
export function TrainingDrillModal({
  playerId,
  playerName,
  options,
  superChancePercent,
  injuryRiskPercent,
  condition,
  injuryWeeks,
  trainingPoints,
  lastDrillResult,
  promiseGate,
  onSwitchToPromised,
  onTrainDrill,
  onDismiss,
  reduceMotion = false,
}: TrainingDrillModalProps) {
  // Phones get the bottom sheet; wide viewports get a centered dialog so the
  // picker never stretches across the whole desktop window.
  const wide = useLayoutMode() === 'twoColumn';
  const [activeResult, setActiveResult] = useState<DrillResultViewModel | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [injuryCardVisible, setInjuryCardVisible] = useState(false);
  const [countedValue, setCountedValue] = useState<number | null>(null);
  const streakRef = useRef(0);
  const seenSequenceRef = useRef(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  // Reset the pitch streak whenever the popup moves to another player.
  useEffect(() => {
    streakRef.current = 0;
  }, [playerId]);

  useEffect(() => {
    const result = lastDrillResult;
    if (result === null || result.playerId !== playerId) return;
    if (result.sequence === seenSequenceRef.current) return;
    seenSequenceRef.current = result.sequence;
    setActiveResult(result);
    setInjuryCardVisible(result.injury !== undefined);

    streakRef.current += 1;
    if (result.isSuper) {
      playSuperTrainingSfx();
      if (Platform.OS !== 'web') Vibration.vibrate(180);
      setCelebrating(true);
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
    } else {
      playDrillResultSfx(streakRef.current);
    }

    // Count the stat up from before to after with a landing pop.
    if (reduceMotion) {
      setCountedValue(result.after);
      return;
    }
    setCountedValue(result.before);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / COUNT_UP_MS);
      setCountedValue(Math.round(result.before + (result.after - result.before) * progress));
      if (progress >= 1) {
        clearInterval(timer);
        Animated.sequence([
          Animated.spring(pop, { toValue: 1.25, friction: 4, useNativeDriver: true }),
          Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]).start();
      }
    }, 40);
    return () => clearInterval(timer);
  }, [lastDrillResult, playerId, pop, reduceMotion, shake]);

  const resultOption = activeResult === null
    ? undefined
    : options.find(option => option.pathId === activeResult.pathId);
  const riskTone = injuryRiskPercent >= 25 ? 'red' : 'amber';
  const injured = injuryWeeks > 0;
  const owedHere = promiseGate !== undefined && promiseGate.playerId === playerId;
  const blockedByPromise = promiseGate !== undefined && promiseGate.playerId !== playerId;

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <View className={wide ? 'flex-1 items-center justify-center px-3 py-6' : 'flex-1 justify-end px-3 pb-3'}>
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
          >
            <View className="flex-1" style={{ backgroundColor: 'rgba(36,31,46,0.62)' }} />
          </Pressable>
          <Animated.View
            accessibilityViewIsModal
            className={wide
              ? 'w-full max-w-[560px] overflow-hidden border-2 border-b-4 border-ink bg-paper'
              : 'w-full overflow-hidden border-2 border-b-4 border-ink bg-paper'}
            style={{
              maxHeight: '92%',
              transform: [{
                translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
              }],
            }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Instant training</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink" numberOfLines={1}>{playerName}</Text>
              </View>
              <View className="mr-3 items-end">
                <Text className="font-mono text-sm font-bold uppercase text-ink/50">TP</Text>
                <Text className="font-pixel text-lg text-ink">{trainingPoints}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close training for ${playerName}`}
                onPress={onDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-mono text-lg font-bold text-ink">×</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap items-center gap-2 border-b border-ink/20 bg-white px-4 py-2">
              <View className="border border-gold-dark bg-gold-light px-2 py-1">
                <Text className="font-mono text-sm font-bold uppercase text-ink">
                  ★ SUPER chance {superChancePercent}%
                </Text>
              </View>
              {owedHere ? (
                <View className="border-2 border-violet-dark bg-violet-light px-2 py-1">
                  <Text className="font-mono text-sm font-bold uppercase text-violet-dark">
                    Promise · {promiseGate.remaining} owed
                  </Text>
                </View>
              ) : null}
              <View className="border border-ink/30 bg-paper px-2 py-1">
                <Text
                  className={condition < 30
                    ? 'font-mono text-sm font-bold uppercase text-stamp'
                    : 'font-mono text-sm font-bold uppercase text-ink'}
                >
                  Cond {condition}%
                </Text>
              </View>
              {injuryRiskPercent > 0 ? (
                <View className={riskTone === 'red'
                  ? 'border-2 border-stamp bg-red-light px-2 py-1'
                  : 'border border-gold-dark bg-gold-light px-2 py-1'}
                >
                  <Text className={riskTone === 'red'
                    ? 'font-mono text-sm font-bold uppercase text-stamp'
                    : 'font-mono text-sm font-bold uppercase text-gold-dark'}
                  >
                    ⚠ {injuryRiskPercent}% injury risk
                  </Text>
                </View>
              ) : null}
            </View>

            {activeResult !== null && resultOption !== undefined && !celebrating ? (
              <View
                className={activeResult.isSuper
                  ? 'flex-row items-center justify-between border-b-2 border-gold-dark bg-gold-light px-4 py-3'
                  : 'flex-row items-center justify-between border-b-2 border-pitch-dark bg-pitch-light px-4 py-3'}
              >
                <Text className="font-mono text-base font-bold uppercase text-ink">
                  {activeResult.isSuper ? '★ SUPER · ' : ''}{resultOption.label}
                </Text>
                <View className="flex-row items-baseline gap-2">
                  <Animated.Text
                    className="font-pixel text-2xl text-ink"
                    style={{ transform: [{ scale: pop }] }}
                  >
                    {countedValue ?? activeResult.after}
                  </Animated.Text>
                  <Text className="font-mono text-base font-bold text-pitch-dark">
                    +{activeResult.after - activeResult.before}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
              {blockedByPromise ? (
                <View className="border-2 border-b-4 border-violet-dark bg-violet-light p-4">
                  <Text className="font-mono text-sm font-bold uppercase text-violet-dark">
                    {promiseGate.playerName} reminds you
                  </Text>
                  <Text className="mt-2 text-base font-bold text-ink">
                    “Boss! You promised me the next {promiseGate.remaining} drill{promiseGate.remaining === 1 ? '' : 's'}.”
                  </Text>
                  {onSwitchToPromised !== undefined ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Train ${promiseGate.playerName} instead`}
                      onPress={() => onSwitchToPromised(promiseGate.playerId)}
                      className="mt-3 min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-violet px-4 py-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
                    >
                      <Text className="font-pixel text-base uppercase text-white">
                        Train {promiseGate.playerName} instead ▸
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View className="gap-2">
                {options.map(option => {
                  const disabled = injured || blockedByPromise || option.atSafetyCeiling || !option.affordable;
                  const isResultRow = activeResult?.pathId === option.pathId && !celebrating;
                  return (
                    <Pressable
                      key={option.pathId}
                      accessibilityRole="button"
                      accessibilityLabel={`Train ${playerName} in ${option.label} now`}
                      accessibilityHint={injured
                        ? `${playerName} is injured and cannot train.`
                        : `${option.drillName}. Costs ${option.tpCost} training points and happens right away. Currently ${option.currentValue}.${injuryRiskPercent > 0 ? ` ${injuryRiskPercent} percent injury risk.` : ''}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => onTrainDrill(playerId, option.pathId)}
                      className={disabled
                        ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'
                        : isResultRow
                          ? 'flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-3'
                          : 'flex-row items-center justify-between border-2 border-ink/30 bg-white px-3 py-3'}
                      style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.65 : undefined })}
                    >
                      <View className="min-w-0 flex-1 pr-2">
                        <Text className="text-base font-bold uppercase text-ink" numberOfLines={1}>
                          {option.drillName}
                          <Text className="font-mono text-sm text-ink/60"> ({option.tpCost} TP)</Text>
                        </Text>
                        <Text className="mt-0.5 font-mono text-sm font-bold text-ink/60" numberOfLines={1}>
                          {option.currentValue} {option.shortCode}
                          {!injured && !option.affordable && !option.atSafetyCeiling ? ' · Not enough TP' : ''}
                        </Text>
                      </View>
                      <Text className="font-mono text-base font-bold text-ink" numberOfLines={1}>
                        +{option.gain} {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {injured ? (
                <View className="mt-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
                  <Text className="font-mono text-base font-bold uppercase text-red-dark">
                    OUT · {injuryWeeks} {injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                  </Text>
                  <Text className="mt-1 text-sm text-ink/70">No training until they recover.</Text>
                </View>
              ) : null}
            </ScrollView>

            {celebrating && activeResult !== null ? (
              <SuperTrainingCelebration
                gainLabel={`+${activeResult.after - activeResult.before} ${resultOption?.shortCode ?? activeResult.attribute.toUpperCase()}`}
                reduceMotion={reduceMotion}
                onComplete={() => setCelebrating(false)}
              />
            ) : null}

            {injuryCardVisible && !celebrating && activeResult?.injury !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${playerName} got injured, out ${activeResult.injury.recoveryWeeks} weeks. Tap to continue.`}
                onPress={() => {
                  playManagementActionSfx('warning');
                  setInjuryCardVisible(false);
                }}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.injuryBackdrop}>
                  <View className="border-2 border-b-4 border-red-dark bg-red-light px-5 py-4">
                    <Text className="text-center font-pixel text-xl uppercase text-red-dark">Pulled up!</Text>
                    <Text className="mt-2 text-center font-mono text-base font-bold uppercase text-ink">
                      OUT · {activeResult.injury.recoveryWeeks} {activeResult.injury.recoveryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                    </Text>
                    <Text className="mt-2 text-center text-sm text-ink/70">
                      The drill still counted — then something went twang.
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  injuryBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(36,31,46,0.78)',
    zIndex: 25,
  },
});
