import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { SuperTrainingCelebration } from './components/SuperTrainingCelebration';
import { DrillSceneOverlay, drillActivityId } from '../render/DrillSceneOverlay';
import { playDrillResultSfx, playSuperTrainingSfx, playManagementActionSfx } from '../render/management-sfx';
import { playManagementHaptic } from '../render/haptics';
import { useLayoutMode } from './layout/use-layout-mode';
import type { DrillResultViewModel, TrainingSlotStatOption } from './models';
import { PixelText } from './components/PixelText';

export interface TrainingDrillModalProps {
  playerId: string;
  playerName: string;
  playerRole: 'GK' | 'DEF' | 'MID' | 'FWD';
  playerLookId?: string;
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

/** 'scene' plays the drill, then SUPER fireworks, then the injury card. */
type ResultStage = 'scene' | 'super' | 'injury' | null;

/**
 * The whole training loop lives here: tap a stat, the drill resolves instantly,
 * and a sprite scene shows the player performing it while the stat counts up.
 * A SUPER session adds a fireworks takeover, a lost injury gamble adds the OUT
 * card, and then the popup returns so the buttons stay live for the next tap.
 */
export function TrainingDrillModal({
  playerId,
  playerName,
  playerRole,
  playerLookId,
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
  const [stage, setStage] = useState<ResultStage>(null);
  const streakRef = useRef(0);
  // Seeded from the store's current sequence, not 0: dismissing the popup unmounts
  // this component, so a fresh ref would treat the last result as new and replay
  // its scene, sound and haptic on reopen without a tap or any TP spent.
  const seenSequenceRef = useRef(lastDrillResult?.sequence ?? 0);

  // Reset the pitch streak whenever the popup moves to another player.
  useEffect(() => {
    streakRef.current = 0;
  }, [playerId]);

  useEffect(() => {
    const result = lastDrillResult;
    if (result === null || result.playerId !== playerId) return;
    if (result.sequence === seenSequenceRef.current) return;
    seenSequenceRef.current = result.sequence;

    streakRef.current += 1;
    if (result.isSuper) {
      playSuperTrainingSfx();
      playManagementHaptic('hero');
    } else {
      playDrillResultSfx(streakRef.current);
    }

    setActiveResult(result);
    setStage('scene');
  }, [lastDrillResult, playerId]);

  // Advances the presentation once the current beat finishes or is skipped.
  // The next stage is derived outside the updater — a setState updater must be
  // pure, and React may invoke it more than once. Memoised so the drill scene's
  // effect does not tear down and restart its animation on every parent render.
  const advanceStage = useCallback(() => {
    const next: ResultStage = stage === 'scene' && activeResult?.isSuper
      ? 'super'
      : (stage === 'scene' || stage === 'super') && activeResult?.injury !== undefined
        ? 'injury'
        : null;
    setStage(next);
    if (next === null) setActiveResult(null);
  }, [stage, activeResult]);

  const resultOption = activeResult === null
    ? undefined
    : options.find(option => option.pathId === activeResult.pathId);
  const riskTone = injuryRiskPercent >= 25 ? 'red' : 'amber';
  const injured = injuryWeeks > 0;
  const owedHere = promiseGate !== undefined && promiseGate.playerId === playerId;
  const blockedByPromise = promiseGate !== undefined && promiseGate.playerId !== playerId;
  const conditionBadge = conditionBadgeStyle(condition);

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
          <View
            accessibilityViewIsModal
            className={wide
              ? 'w-full max-w-[560px] overflow-hidden border-2 border-b-4 border-ink bg-paper'
              : 'w-full overflow-hidden border-2 border-b-4 border-ink bg-paper'}
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-pixel text-sm uppercase text-blue-dark">Drills</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink" numberOfLines={1}>{playerName}</Text>
              </View>
              <View className="mr-3 items-end">
                <Text className="font-pixel text-sm uppercase text-ink/50">TP</Text>
                <Text className="font-pixel text-lg text-ink">{trainingPoints}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close training for ${playerName}`}
                onPress={onDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-pixel text-lg text-ink">×</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap items-center gap-2 border-b border-ink/20 bg-white px-4 py-2">
              <View className="border border-gold-dark bg-gold-light px-2 py-1">
                <Text className="font-pixel text-sm uppercase text-ink">
                  ★ SUPER chance {superChancePercent}%
                </Text>
              </View>
              {owedHere ? (
                <View className="border-2 border-blue-dark bg-blue-light px-2 py-1">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">
                    Promise · {promiseGate.remaining} owed
                  </Text>
                </View>
              ) : null}
              <View className={conditionBadge.box}>
                <Text className={conditionBadge.text}>
                  Cond {condition}%
                </Text>
              </View>
              {injuryRiskPercent > 0 ? (
                <View className={riskTone === 'red'
                  ? 'border-2 border-stamp bg-red-light px-2 py-1'
                  : 'border border-gold-dark bg-gold-light px-2 py-1'}
                >
                  <Text className={riskTone === 'red'
                    ? 'font-pixel text-sm uppercase text-stamp'
                    : 'font-pixel text-sm uppercase text-gold-dark'}
                  >
                    ⚠ {injuryRiskPercent}% injury risk
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
              {blockedByPromise ? (
                <View className="border-2 border-b-4 border-blue-dark bg-blue-light p-4">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">
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
                      className="mt-3 min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4 py-2"
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
                  const isResultRow = stage === null && activeResult?.pathId === option.pathId;
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
                        <PixelText className="text-base uppercase text-ink" numberOfLines={1}>
                          {option.drillName}
                          <Text className="font-mono text-sm text-ink/60"> ({option.tpCost} TP)</Text>
                        </PixelText>
                        <Text className="mt-0.5 font-mono text-sm text-ink/60" numberOfLines={1}>
                          {option.currentValue} {option.shortCode}
                          {!injured && !option.affordable && !option.atSafetyCeiling ? ' · Not enough TP' : ''}
                        </Text>
                      </View>
                      <Text className="font-mono text-base text-ink" numberOfLines={1}>
                        +{option.gain} {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {injured ? (
                <View className="mt-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
                  <Text className="font-pixel text-base uppercase text-red-dark">
                    OUT · {injuryWeeks} {injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                  </Text>
                  <Text className="mt-1 text-sm text-ink/70">No training until they recover.</Text>
                </View>
              ) : null}
            </ScrollView>

            {stage === 'scene' && activeResult !== null && resultOption !== undefined ? (
              <DrillSceneOverlay
                playerId={playerId}
                playerName={playerName}
                role={playerRole}
                lookId={playerLookId}
                activityId={drillActivityId(activeResult.pathId)}
                drillName={resultOption.drillName}
                shortCode={resultOption.shortCode}
                before={activeResult.before}
                after={activeResult.after}
                isSuper={activeResult.isSuper}
                reduceMotion={reduceMotion}
                onComplete={advanceStage}
              />
            ) : null}

            {stage === 'super' && activeResult !== null ? (
              <SuperTrainingCelebration
                gainLabel={`+${activeResult.after - activeResult.before} ${resultOption?.shortCode ?? activeResult.attribute.toUpperCase()}`}
                reduceMotion={reduceMotion}
                onComplete={advanceStage}
              />
            ) : null}

            {stage === 'injury' && activeResult?.injury !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${playerName} got injured, out ${activeResult.injury.recoveryWeeks} weeks. Tap to continue.`}
                onPress={() => {
                  playManagementActionSfx('warning');
                  advanceStage();
                }}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.injuryBackdrop}>
                  <View className="border-2 border-b-4 border-red-dark bg-red-light px-5 py-4">
                    <Text className="text-center font-pixel text-xl uppercase text-red-dark">Pulled up!</Text>
                    <Text className="mt-2 text-center font-pixel text-base uppercase text-ink">
                      OUT · {activeResult.injury.recoveryWeeks} {activeResult.injury.recoveryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                    </Text>
                    <Text className="mt-2 text-center text-sm text-ink/70">
                      The drill still counted — then something went twang.
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Condition badge shifts white → grey → yellow → red as fatigue climbs. */
function conditionBadgeStyle(condition: number): { box: string; text: string } {
  if (condition < 30) {
    return {
      box: 'border-2 border-stamp bg-red-light px-2 py-1',
      text: 'font-pixel text-sm uppercase text-stamp',
    };
  }
  if (condition < 50) {
    return {
      box: 'border border-gold-dark bg-gold-light px-2 py-1',
      text: 'font-pixel text-sm uppercase text-gold-dark',
    };
  }
  if (condition < 70) {
    return {
      box: 'border border-ink/30 bg-paper-dark px-2 py-1',
      text: 'font-pixel text-sm uppercase text-ink/70',
    };
  }
  return {
    box: 'border border-ink/30 bg-white px-2 py-1',
    text: 'font-pixel text-sm uppercase text-ink',
  };
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
