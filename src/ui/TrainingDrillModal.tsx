import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { SuperTrainingCelebration } from './components/SuperTrainingCelebration';
import { DrillGainReveal } from './components/DrillGainReveal';
import { DrillSceneOverlay, drillActivityId } from '../render/DrillSceneOverlay';
import { BertFullBody } from './AssistantGuideOverlay';
import { energyBand } from '../render/match-energy-ui';
import { INSTANT_DRILL_CONDITION_COST } from '../game/training';
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
  /**
   * Quick Train: the stat the manager tapped in the player file. The popup
   * opens straight onto that drill's confirmation instead of the list.
   */
  quickTrainPathId?: string;
  /**
   * True once Bert has explained the condition gamble. It is one lesson per
   * career, not one per player: after that a red-lined squad is the manager's
   * own call to make.
   */
  conditionWarningSeen?: boolean;
  /** Retires the lesson for good. */
  onConditionWarningShown?: () => void;
  /** Set while a promised player is owed drills: only they may train. */
  promiseGate?: { playerId: string; playerName: string; remaining: number };
  /** Jumps the popup to the promised player when their reminder is tapped. */
  onSwitchToPromised?: (playerId: string) => void;
  onTrainDrill: (playerId: string, pathId: string) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
  /**
   * The store's save warning, surfaced INSIDE this modal: drill taps are the
   * highest-frequency save trigger and a native Modal covers the app-level
   * banner, so without this strip a player could keep training a career that
   * exists only in memory and never see the alert.
   */
  saveWarning?: string | null;
}

/**
 * 'scene' plays the drill and counts the stat up, then the gain takes the screen
 * — SUPER sessions get the fireworks, everything else gets the "+N Stat" super —
 * and an injury card follows if the gamble was lost.
 */
type ResultStage = 'scene' | 'reveal' | 'super' | 'injury' | null;

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
  quickTrainPathId,
  conditionWarningSeen = false,
  onConditionWarningShown,
  promiseGate,
  onSwitchToPromised,
  onTrainDrill,
  onDismiss,
  reduceMotion = false,
  saveWarning = null,
}: TrainingDrillModalProps) {
  // Phones get the bottom sheet; wide viewports get a centered dialog so the
  // picker never stretches across the whole desktop window.
  const wide = useLayoutMode() === 'twoColumn';
  const [activeResult, setActiveResult] = useState<DrillResultViewModel | null>(null);
  const [stage, setStage] = useState<ResultStage>(null);
  // A drill you cannot afford stays tappable so it can say why. Silently doing
  // nothing reads as a broken button. `bert` puts the assistant in the card for
  // anything that is advice rather than a rule.
  const [notice, setNotice] = useState<{ title: string; detail: string; bert?: boolean } | null>(null);
  /**
   * The drill awaiting a yes. Nothing spends TP until this is confirmed —
   * training used to fire on the first tap, which made an accidental brush of
   * the list an irreversible spend.
   */
  const [pendingConfirm, setPendingConfirm] = useState<TrainingSlotStatOption | null>(null);
  // Bert warns once per CAREER, and only after the result has finished playing —
  // interrupting the drill scene with a lecture would bury the gain.
  const pendingRedWarningRef = useRef(false);
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
    if (quickTrainPathId === undefined) return;
    const option = options.find(candidate => candidate.pathId === quickTrainPathId);
    if (option !== undefined) setPendingConfirm(option);
  }, [options, quickTrainPathId]);

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

    if (energyBand(condition) === 'red' && !conditionWarningSeen) {
      pendingRedWarningRef.current = true;
    }

    setActiveResult(result);
    setStage('scene');
    // `condition` is a dependency so the warning reads the post-drill value; the
    // sequence guard above makes any extra run a no-op.
  }, [condition, conditionWarningSeen, lastDrillResult, playerId]);

  // Advances the presentation once the current beat finishes or is skipped.
  // The next stage is derived outside the updater — a setState updater must be
  // pure, and React may invoke it more than once. Memoised so the drill scene's
  // effect does not tear down and restart its animation on every parent render.
  const advanceStage = useCallback(() => {
    // One climax per drill: a SUPER session's fireworks already headline the
    // gain, so the "+N Stat" super is for every other result.
    const next: ResultStage = stage === 'scene'
      ? (activeResult?.isSuper === true ? 'super' : 'reveal')
      : (stage === 'reveal' || stage === 'super') && activeResult?.injury !== undefined
        ? 'injury'
        : null;
    setStage(next);
    if (next === null) {
      setActiveResult(null);
      if (pendingRedWarningRef.current) {
        pendingRedWarningRef.current = false;
        onConditionWarningShown?.();
        playManagementActionSfx('warning');
        setNotice({
          title: 'Bert has a word',
          detail: `${playerName} is in the red. Push them again and you're gambling on an injury — and an injured player sits out for weeks.`,
          bert: true,
        });
      }
    }
  }, [stage, activeResult, onConditionWarningShown, playerName]);

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
                {/* The position rides with the name: which drills are worth
                    buying depends on where they play, and the popup covers the
                    roster row that would otherwise tell you. */}
                <Text className="mt-1 font-pixel text-xl uppercase text-ink" numberOfLines={1}>
                  {playerName}
                  <Text className="font-pixel text-base uppercase text-blue-dark">  {playerRole}</Text>
                </Text>
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

            {saveWarning !== null && saveWarning !== undefined ? (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={`Save problem: ${saveWarning}`}
                className="border-b-2 border-stamp bg-red-light px-4 py-2"
              >
                <Text className="font-pixel text-sm uppercase text-stamp">Your club is not saving</Text>
                <Text className="mt-1 text-xs leading-4 text-ink/70">{saveWarning}</Text>
              </View>
            ) : null}

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
                  const blocked = injured || blockedByPromise || option.atSafetyCeiling;
                  const unaffordable = !blocked && !option.affordable;
                  const disabled = blocked;
                  const isResultRow = stage === null && activeResult?.pathId === option.pathId;
                  return (
                    <Pressable
                      key={option.pathId}
                      accessibilityRole="button"
                      accessibilityLabel={`Train ${playerName} in ${option.label} now`}
                      accessibilityHint={injured
                        ? `${playerName} is injured and cannot train.`
                        : unaffordable
                          ? `Costs ${option.tpCost} training points. You have ${trainingPoints}.`
                          : `${option.drillName}. Costs ${option.tpCost} training points and happens right away. Currently ${option.currentValue}.${injuryRiskPercent > 0 ? ` ${injuryRiskPercent} percent injury risk.` : ''}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        if (unaffordable) {
                          playManagementActionSfx('warning');
                          setNotice({
                            title: 'Not enough TP',
                            detail: `${option.drillName} costs ${option.tpCost} TP and you have ${trainingPoints}. Advance the week to earn more.`,
                          });
                          return;
                        }
                        setPendingConfirm(option);
                      }}
                      className={disabled || unaffordable
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

            {stage === 'reveal' && activeResult !== null ? (
              <DrillGainReveal
                gainLabel={`+${activeResult.after - activeResult.before} ${resultOption?.label ?? activeResult.attribute}`}
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

            {pendingConfirm !== null ? (
              <View style={[styles.noticeLayer, styles.noticeCenter]}>
                <Pressable
                  accessible={false}
                  onPress={() => setPendingConfirm(null)}
                  style={StyleSheet.absoluteFill}
                >
                  <View style={styles.noticeBackdrop} />
                </Pressable>
                <View className="w-[88%] max-w-[380px] border-2 border-b-4 border-ink bg-paper p-4">
                  <PixelText className="text-sm uppercase tracking-wide text-blue-dark">
                    Confirm training
                  </PixelText>
                  <PixelText className="mt-1 text-xl uppercase text-ink" numberOfLines={2}>
                    {pendingConfirm.drillName}
                  </PixelText>
                  <Text className="mt-1 text-sm text-ink/60">
                    {playerName} · {playerRole}
                  </Text>

                  {/* Everything the decision needs, on one card: what it buys,
                      what it costs, and what it risks. */}
                  <View className="mt-3 gap-2">
                    <View className="flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-2">
                      <PixelText className="text-sm uppercase text-ink">{pendingConfirm.label}</PixelText>
                      <Text className="font-pixel text-base text-ink">
                        {pendingConfirm.currentValue} → {pendingConfirm.currentValue + pendingConfirm.gain}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">Training points</Text>
                      <Text className={pendingConfirm.affordable
                        ? 'font-mono text-sm text-ink'
                        : 'font-pixel text-sm text-stamp'}>
                        {pendingConfirm.tpCost} of {trainingPoints}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">Condition after</Text>
                      <Text className="font-mono text-sm text-ink">
                        {condition}% → {Math.max(0, condition - INSTANT_DRILL_CONDITION_COST)}%
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">Injury risk</Text>
                      <Text className={injuryRiskPercent > 0
                        ? 'font-pixel text-sm text-stamp'
                        : 'font-mono text-sm text-ink'}>
                        {injuryRiskPercent > 0 ? `${injuryRiskPercent}%` : 'None'}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">SUPER chance</Text>
                      <Text className="font-mono text-sm text-gold-dark">★ {superChancePercent}%</Text>
                    </View>
                  </View>

                  <View className="mt-4 flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancel training"
                      onPress={() => setPendingConfirm(null)}
                      className="min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-white px-3"
                      style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
                    >
                      <PixelText className="text-base uppercase text-ink">Cancel</PixelText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={pendingConfirm.affordable
                        ? `Train ${pendingConfirm.drillName} for ${pendingConfirm.tpCost} training points`
                        : `Not enough training points for ${pendingConfirm.drillName}`}
                      accessibilityState={{ disabled: !pendingConfirm.affordable }}
                      disabled={!pendingConfirm.affordable}
                      onPress={() => {
                        const chosen = pendingConfirm;
                        setPendingConfirm(null);
                        onTrainDrill(playerId, chosen.pathId);
                      }}
                      className={pendingConfirm.affordable
                        ? 'min-h-12 flex-[1.4] items-center justify-center border-2 border-b-4 border-ink bg-blue px-3'
                        : 'min-h-12 flex-[1.4] items-center justify-center border-2 border-ink/20 bg-ink/10 px-3'}
                      style={({ pressed }) => ({ opacity: pressed && pendingConfirm.affordable ? 0.65 : undefined })}
                    >
                      <PixelText className={pendingConfirm.affordable
                        ? 'text-base uppercase text-white'
                        : 'text-base uppercase text-ink/40'}>
                        {pendingConfirm.affordable ? 'Train ▸' : 'Not enough TP'}
                      </PixelText>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

            {notice !== null ? (
              <View style={styles.noticeLayer}>
                {/* Backdrop and card are siblings, not nested pressables, so a tap
                    on the card never falls through to the dismiss handler. */}
                <Pressable
                  accessible={false}
                  onPress={() => setNotice(null)}
                  style={StyleSheet.absoluteFill}
                >
                  <View style={styles.noticeBackdrop} />
                </Pressable>
                <View pointerEvents="box-none" style={styles.noticeCenter}>
                  <View
                    accessibilityRole="alert"
                    accessibilityLabel={`${notice.title}. ${notice.detail}`}
                    className="w-full max-w-[340px] border-2 border-b-4 border-ink bg-paper px-5 py-4"
                  >
                    <PixelText className={notice.bert === true
                      ? 'text-center text-lg uppercase text-blue-dark'
                      : 'text-center text-lg uppercase text-stamp'}
                    >
                      {notice.title}
                    </PixelText>
                    {notice.bert === true ? (
                      <View className="mt-2 items-center">
                        <BertFullBody pointing />
                      </View>
                    ) : null}
                    <Text className="mt-2 text-center text-sm leading-5 text-ink/75">{notice.detail}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                      onPress={() => setNotice(null)}
                      className="mt-4 min-h-11 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-6"
                    >
                      <PixelText className="text-base uppercase text-ink">Okay</PixelText>
                    </Pressable>
                  </View>
                </View>
              </View>
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
  // Sits above the drill scene and the injury card: it is the newest thing the
  // player did, so it owns the popup until dismissed.
  noticeLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  noticeBackdrop: { flex: 1, backgroundColor: 'rgba(36,31,46,0.78)' },
  noticeCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
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
