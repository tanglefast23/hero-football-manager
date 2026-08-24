import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { SuperTrainingCelebration } from './components/SuperTrainingCelebration';
import { DrillGainReveal } from './components/DrillGainReveal';
import {
  DrillSceneOverlay,
  drillActivityId,
} from '../render/DrillSceneOverlay';
import { drillPresentationMs } from '../render/drill-presentation-timing';
import { BertFullBody } from './BertFullBody';
import { energyBand } from '../render/match-energy-ui';
import { INSTANT_DRILL_CONDITION_COST } from '../game/training';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import {
  playDrillCompleteSfx,
  playDrillResultSfx,
  playSuperTrainingSfx,
  playManagementActionSfx,
  playTrainingStatDing,
} from '../render/management-sfx';
import { playManagementHaptic } from '../render/haptics';
import { useLayoutMode } from './layout/use-layout-mode';
import type { DrillResultViewModel, TrainingSlotStatOption } from './models';
import { ManagementSprite } from './components/ManagementSprite';
import { PixelText } from './components/PixelText';
import {
  maximumAffordableTrainingRuns,
  maximumSafeTrainingRuns,
  maximumVisibleTrainingRuns,
  riskyTrainingRunCount,
} from './training-repeat';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';

export interface TrainingDrillModalProps {
  playerId: string;
  playerName: string;
  playerRole: 'GK' | 'DEF' | 'MID' | 'FWD';
  playerLookId?: string;
  options: readonly TrainingSlotStatOption[];
  superChancePercent: number;
  drillsUntilGuaranteedSuper: number;
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
   * Clears the request above once this popup has opened its confirmation.
   * Without it the request outlives the drill that answered it, and the effect
   * below re-fires on the next `options` identity — which every resolved drill
   * produces — reopening a spend confirmation the manager never asked for.
   */
  onQuickTrainConsumed?: () => void;
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
  /**
   * Resolves the drills still queued behind the one on screen, without their
   * presentations. Leaving early skips the animation, not the training.
   */
  onTrainDrillBatch: (playerId: string, pathId: string, runs: number) => void;
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

interface DrillBatch {
  readonly pathId: string;
  readonly total: number;
  readonly current: number;
  readonly remaining: number;
}

const REPEAT_PICKER_CELL_WIDTH = 48;
/** How long the drill list ignores presses after a presentation closes under it. */
const PRESENTATION_SETTLE_MS = drillPresentationMs(350);

function ordinaryVisibleGain(option: TrainingSlotStatOption): number {
  return Math.max(
    0,
    option.baseValueAfter - option.currentValue + option.trainingAdjustment,
  );
}

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
  drillsUntilGuaranteedSuper,
  injuryRiskPercent,
  condition,
  injuryWeeks,
  trainingPoints,
  lastDrillResult,
  quickTrainPathId,
  onQuickTrainConsumed,
  conditionWarningSeen = false,
  onConditionWarningShown,
  promiseGate,
  onSwitchToPromised,
  onTrainDrill,
  onTrainDrillBatch,
  onDismiss,
  reduceMotion = false,
  saveWarning = null,
}: TrainingDrillModalProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  // Phones get the bottom sheet; wide viewports get a centered dialog so the
  // picker never stretches across the whole desktop window.
  const wide = useLayoutMode() === 'twoColumn';
  const [activeResult, setActiveResult] = useState<DrillResultViewModel | null>(
    null,
  );
  const [stage, setStage] = useState<ResultStage>(null);
  // A drill you cannot afford stays tappable so it can say why. Silently doing
  // nothing reads as a broken button. `bert` puts the assistant in the card for
  // anything that is advice rather than a rule.
  const [notice, setNotice] = useState<{
    title: string;
    detail: string;
    bert?: boolean;
  } | null>(null);
  /**
   * The drill awaiting a yes. Nothing spends TP until this is confirmed —
   * training used to fire on the first tap, which made an accidental brush of
   * the list an irreversible spend.
   */
  const [pendingConfirm, setPendingConfirm] =
    useState<TrainingSlotStatOption | null>(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [confirmingHighRisk, setConfirmingHighRisk] = useState(false);
  const batchRef = useRef<DrillBatch | null>(null);
  const [batchProgress, setBatchProgress] = useState<Pick<
    DrillBatch,
    'current' | 'total'
  > | null>(null);
  const repeatScrollRef = useRef<ScrollView | null>(null);
  /**
   * Set only while the manager's own finger is moving the number row. Tapping a
   * number also scrolls the row to it, and on iOS a programmatic animated
   * scroll ends by firing onMomentumScrollEnd exactly like a flick does.
   * Ungated, that event re-read the count off wherever the row actually
   * stopped — and barely five cells fit the phone card, so every number past
   * those clamps short and the tapped 3 became 2 a third of a second later.
   */
  const draggingRepeatRef = useRef(false);
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
    batchRef.current = null;
    setBatchProgress(null);
  }, [playerId]);

  useEffect(() => {
    if (quickTrainPathId === undefined) return;
    const option = options.find(
      (candidate) => candidate.pathId === quickTrainPathId,
    );
    if (option === undefined) return;
    setPendingConfirm(option);
    setRepeatCount(1);
    setConfirmingHighRisk(false);
    // One tap, one confirmation. The request is spent here rather than left
    // standing, so the next resolved drill cannot re-trigger this effect.
    onQuickTrainConsumed?.();
  }, [onQuickTrainConsumed, options, quickTrainPathId]);

  useEffect(() => {
    if (pendingConfirm === null) return;
    const maximum = Math.max(
      1,
      Math.min(
        maximumAffordableTrainingRuns(trainingPoints, pendingConfirm.tpCost),
        maximumVisibleTrainingRuns(
          pendingConfirm.currentValue,
          ordinaryVisibleGain(pendingConfirm),
        ),
      ),
    );
    setRepeatCount((current) => Math.min(current, maximum));
  }, [pendingConfirm, trainingPoints]);

  useEffect(() => {
    const result = lastDrillResult;
    if (result === null || result.playerId !== playerId) return;
    if (result.sequence === seenSequenceRef.current) return;
    seenSequenceRef.current = result.sequence;

    streakRef.current += 1;
    playDrillCompleteSfx();
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

  const showPendingConditionWarning = useCallback(() => {
    if (!pendingRedWarningRef.current) return;
    pendingRedWarningRef.current = false;
    onConditionWarningShown?.();
    playManagementActionSfx('warning');
    setNotice({
      title: t('trainingDrill.bertHasAWord'),
      detail: t('trainingDrill.redConditionWarning', { player: playerName }),
      bert: true,
    });
    // `t` is deliberately not a dependency. `useCopy` returns a fresh function
    // every render, and this callback feeds `advanceStage`, whose identity the
    // drill scene's animation effect depends on — listing it would restart that
    // animation on any parent render. The language cannot change while a
    // full-screen modal is open, so the captured `t` cannot go stale.
  }, [onConditionWarningShown, playerName]);

  /**
   * When a skip tap ends the presentation, the drill list is suddenly back under
   * the finger. Tapped twice quickly, the second press landed on the row the
   * overlay had been covering and opened a drill nobody asked for. The list goes
   * deaf for a beat whenever a presentation closes, so the next drill needs a
   * fresh, deliberate tap — however the animation ended, on its own or skipped.
   */
  const presentationClosedAtRef = useRef(0);

  // Advances the presentation once the current beat finishes or is skipped.
  // The next stage is derived outside the updater — a setState updater must be
  // pure, and React may invoke it more than once. Memoised so the drill scene's
  // effect does not tear down and restart its animation on every parent render.
  const advanceStage = useCallback(() => {
    // One climax per drill: a SUPER session's fireworks already headline the
    // gain, so the "+N Stat" super is for every other result.
    const next: ResultStage =
      stage === 'scene'
        ? activeResult?.isSuper === true
          ? 'super'
          : 'reveal'
        : (stage === 'reveal' || stage === 'super') &&
            activeResult?.injury !== undefined
          ? 'injury'
          : null;
    setStage(next);
    // The doc-08 promise: the "+N Stat" reveal plays a short ding as the gain
    // lands. A SUPER result skips it — its celebration owns the moment.
    if (next === 'reveal') playTrainingStatDing();
    // The OUT card is the worst news the training loop delivers and it used to
    // arrive in silence, with the cue landing on the tap that dismissed it —
    // the drama mute, the paperwork loud.
    if (next === 'injury') {
      playManagementActionSfx('warning');
      playManagementHaptic('warning');
    }
    if (next === null) {
      presentationClosedAtRef.current = Date.now();
      setActiveResult(null);
      const batch = batchRef.current;
      if (
        batch !== null &&
        batch.remaining > 0 &&
        activeResult?.injury === undefined &&
        (activeResult?.displayedAfter ?? 0) < MAX_PLAYER_ATTRIBUTE
      ) {
        const nextBatch: DrillBatch = {
          ...batch,
          current: batch.current + 1,
          remaining: batch.remaining - 1,
        };
        batchRef.current = nextBatch;
        setBatchProgress({
          current: nextBatch.current,
          total: nextBatch.total,
        });
        onTrainDrill(playerId, nextBatch.pathId);
        return;
      }
      batchRef.current = null;
      setBatchProgress(null);
      showPendingConditionWarning();
    }
  }, [
    activeResult,
    onTrainDrill,
    playerId,
    showPendingConditionWarning,
    stage,
  ]);

  const startTrainingBatch = useCallback(
    (option: TrainingSlotStatOption, runs: number) => {
      const queuedRuns = Math.min(
        runs,
        maximumAffordableTrainingRuns(trainingPoints, option.tpCost),
        maximumVisibleTrainingRuns(
          option.currentValue,
          ordinaryVisibleGain(option),
        ),
      );
      if (queuedRuns < 1) return;
      const batch: DrillBatch = {
        pathId: option.pathId,
        total: queuedRuns,
        current: 1,
        remaining: queuedRuns - 1,
      };
      batchRef.current = batch;
      setBatchProgress({ current: 1, total: queuedRuns });
      setConfirmingHighRisk(false);
      setPendingConfirm(null);
      onTrainDrill(playerId, option.pathId);
    },
    [onTrainDrill, playerId, trainingPoints],
  );

  const dismiss = useCallback(() => {
    const batch = batchRef.current;
    batchRef.current = null;
    setBatchProgress(null);
    setConfirmingHighRisk(false);
    // Leaving early skips the presentation, not the training. The manager
    // confirmed the whole batch and its TP on the way in, so the drills behind
    // the one on screen still run — they just run without their cards. An
    // injury on the drill being watched still ends the batch, exactly as it
    // does when the manager sits through it.
    if (
      batch !== null &&
      batch.remaining > 0 &&
      activeResult?.injury === undefined &&
      (activeResult?.displayedAfter ?? 0) < MAX_PLAYER_ATTRIBUTE
    ) {
      onTrainDrillBatch(playerId, batch.pathId, batch.remaining);
    }
    onDismiss();
  }, [activeResult, onDismiss, onTrainDrillBatch, playerId]);

  const resultOption =
    activeResult === null
      ? undefined
      : options.find((option) => option.pathId === activeResult.pathId);
  const riskTone = injuryRiskPercent >= 25 ? 'red' : 'amber';
  const injured = injuryWeeks > 0;
  const owedHere =
    promiseGate !== undefined && promiseGate.playerId === playerId;
  const blockedByPromise =
    promiseGate !== undefined && promiseGate.playerId !== playerId;
  const conditionBadge = conditionBadgeStyle(condition);
  const maximumAffordableRuns =
    pendingConfirm === null
      ? 1
      : Math.max(
          1,
          Math.min(
            maximumAffordableTrainingRuns(
              trainingPoints,
              pendingConfirm.tpCost,
            ),
            maximumVisibleTrainingRuns(
              pendingConfirm.currentValue,
              ordinaryVisibleGain(pendingConfirm),
            ),
          ),
        );
  const maximumSafeRuns = maximumSafeTrainingRuns(condition);
  const selectedRiskyRuns = riskyTrainingRunCount(condition, repeatCount);
  const nextOrdinaryGain =
    pendingConfirm === null ? 0 : ordinaryVisibleGain(pendingConfirm);
  const visibleHeadroom =
    pendingConfirm === null
      ? 0
      : MAX_PLAYER_ATTRIBUTE - pendingConfirm.currentValue;
  const ordinaryBatchEstimate = Math.min(
    visibleHeadroom,
    repeatCount * nextOrdinaryGain,
  );
  const superGuaranteedInBatch = repeatCount >= drillsUntilGuaranteedSuper;
  const repeatOptions = Array.from(
    { length: maximumAffordableRuns },
    (_, index) => index + 1,
  );
  const selectRepeatCount = (runs: number, scroll = true) => {
    setRepeatCount(runs);
    if (scroll) {
      // The tap IS the decision. Clearing the flag first means the scroll it
      // starts — and any flick still decelerating underneath it — cannot be
      // read back as a second, later decision.
      draggingRepeatRef.current = false;
      repeatScrollRef.current?.scrollTo({
        x: (runs - 1) * REPEAT_PICKER_CELL_WIDTH,
        animated: !reduceMotion,
      });
    }
  };
  const selectRepeatOffset = (offsetX: number) => {
    if (!draggingRepeatRef.current) return;
    const index = Math.round(offsetX / REPEAT_PICKER_CELL_WIDTH);
    selectRepeatCount(
      Math.max(1, Math.min(maximumAffordableRuns, index + 1)),
      false,
    );
  };
  const repeatButton = (runs: number) => (
    <Pressable
      key={runs}
      accessibilityRole="button"
      accessibilityLabel={t('trainingDrill.a11y.runThisDrill', {
        n: runs,
        count: runs,
      })}
      accessibilityState={{ selected: repeatCount === runs }}
      onPress={() => selectRepeatCount(runs)}
      style={[
        styles.repeatOption,
        wide ? styles.repeatOptionWide : null,
        repeatCount === runs ? styles.repeatOptionSelected : null,
      ]}
    >
      <Text
        style={[
          styles.repeatOptionText,
          repeatCount === runs ? styles.repeatOptionTextSelected : null,
        ]}
      >
        {runs}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View
          accessibilityViewIsModal
          className={
            wide
              ? 'flex-1 items-center justify-center px-3 py-6'
              : 'flex-1 justify-end px-3 pb-3'
          }
        >
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
          >
            <View
              className="flex-1"
              style={{ backgroundColor: 'rgba(36,31,46,0.62)' }}
            />
          </Pressable>
          <View
            className={
              wide
                ? 'w-full max-w-[560px] overflow-hidden border-2 border-b-4 border-ink bg-paper'
                : 'w-full overflow-hidden border-2 border-b-4 border-ink bg-paper'
            }
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-pixel text-sm uppercase text-blue-dark">
                  {t('trainingDrill.drills')}
                </Text>
                {/* The position rides with the name: which drills are worth
                    buying depends on where they play, and the popup covers the
                    roster row that would otherwise tell you. */}
                <Text
                  className="mt-1 font-pixel text-xl uppercase text-ink"
                  numberOfLines={1}
                >
                  {playerName}
                  <Text className="font-pixel text-base uppercase text-blue-dark">
                    {' '}
                    {playerRole}
                  </Text>
                </Text>
              </View>
              <View className="mr-3 items-end">
                <Text className="font-pixel text-sm uppercase text-ink/50">
                  {t('trainingDrill.trainingPointsShort')}
                </Text>
                <Text className="font-pixel text-lg text-ink">
                  {trainingPoints}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('trainingDrill.a11y.closeTrainingFor', {
                  player: playerName,
                })}
                onPress={dismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
                // Explicit points: h-11 is 38.5pt on native, under the 44pt
                // touch-target contract — see ActionButton's minHeight.
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Text className="font-pixel text-lg text-ink">×</Text>
              </Pressable>
            </View>

            {saveWarning !== null && saveWarning !== undefined ? (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={t('trainingDrill.a11y.saveProblem', {
                  message: saveWarning,
                })}
                className="border-b-2 border-stamp bg-red-light px-4 py-2"
              >
                <Text className="font-pixel text-sm uppercase text-stamp">
                  {t('trainingDrill.yourClubIsNotSaving')}
                </Text>
                <Text className="mt-1 text-xs leading-4 text-ink/70">
                  {saveWarning}
                </Text>
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-2 border-b border-ink/20 bg-white px-4 py-2">
              <View className="flex-row items-center gap-1 border border-gold-dark bg-gold-light px-2 py-1">
                {/* Glyph-only node: ★ is in neither Silkscreen weight, so it
                    stands alone and falls back to the system face on purpose —
                    typed inside the pixel string it flipped the face mid-word. */}
                <Text className="text-sm text-ink">★</Text>
                <Text className="font-pixel text-sm uppercase text-ink">
                  {drillsUntilGuaranteedSuper === 1
                    ? t('trainingDrill.superGuaranteed')
                    : t('trainingDrill.superChancePercent', {
                        percent: superChancePercent,
                      })}
                </Text>
              </View>
              {owedHere ? (
                <View className="border-2 border-blue-dark bg-blue-light px-2 py-1">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">
                    {t('trainingDrill.promiseOwed', {
                      count: promiseGate.remaining,
                    })}
                  </Text>
                </View>
              ) : null}
              <View className={conditionBadge.box}>
                <Text className={conditionBadge.text}>
                  {t('trainingDrill.conditionPercent', { condition })}
                </Text>
              </View>
              {injuryRiskPercent > 0 ? (
                <View
                  className={
                    riskTone === 'red'
                      ? 'border-2 border-stamp bg-red-light px-2 py-1'
                      : 'border border-gold-dark bg-gold-light px-2 py-1'
                  }
                >
                  <Text
                    className={
                      riskTone === 'red'
                        ? 'font-pixel text-sm uppercase text-stamp'
                        : 'font-pixel text-sm uppercase text-gold-dark'
                    }
                  >
                    {/* Glyph-only node: ⚠ is in neither Silkscreen weight, so it
                        stands alone and falls back to the system face rather than
                        flipping the label's typeface mid-string. Keeping it inside
                        the translated string is what the glyph gate caught. */}
                    <Text>⚠ </Text>
                    {t('trainingDrill.injuryRiskPercent', {
                      percent: injuryRiskPercent,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            >
              {blockedByPromise ? (
                <View className="border-2 border-b-4 border-blue-dark bg-blue-light p-4">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">
                    {t('trainingDrill.remindsYou', {
                      player: promiseGate.playerName,
                    })}
                  </Text>
                  <Text className="mt-2 text-base font-bold text-ink">
                    {t('trainingDrill.promiseQuote', {
                      n: promiseGate.remaining,
                      count: promiseGate.remaining,
                    })}
                  </Text>
                  {onSwitchToPromised !== undefined ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('trainingDrill.trainInstead', {
                        player: promiseGate.playerName,
                      })}
                      onPress={() => onSwitchToPromised(promiseGate.playerId)}
                      className="mt-3 min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4 py-2"
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.65 : undefined,
                      })}
                    >
                      <Text className="font-pixel text-base uppercase text-white">
                        {t('trainingDrill.trainInstead', {
                          player: promiseGate.playerName,
                        })}
                        {/* ▸ is not in Silkscreen either — same deliberate fallback. */}
                        <Text> ▸</Text>
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View className="gap-2">
                {options.map((option) => {
                  const blocked =
                    injured || blockedByPromise || option.atSafetyCeiling;
                  const unaffordable = !blocked && !option.affordable;
                  const disabled = blocked;
                  const isResultRow =
                    stage === null && activeResult?.pathId === option.pathId;
                  return (
                    <Pressable
                      key={option.pathId}
                      accessibilityRole="button"
                      accessibilityLabel={t('trainingDrill.a11y.trainStatNow', {
                        player: playerName,
                        stat: option.label,
                      })}
                      accessibilityHint={
                        option.atSafetyCeiling
                          ? t('trainingDrill.a11y.atMaximum', {
                              stat: option.label,
                            })
                          : injured
                            ? t('trainingDrill.a11y.injuredCannotTrain', {
                                player: playerName,
                              })
                            : unaffordable
                              ? t('trainingDrill.a11y.costsTrainingPoints', {
                                  cost: option.tpCost,
                                  available: trainingPoints,
                                })
                              : t('trainingDrill.a11y.drillHint', {
                                  drill: option.drillName,
                                  cost: option.tpCost,
                                  value: option.currentValue,
                                  risk:
                                    injuryRiskPercent > 0
                                      ? ` ${t('trainingDrill.a11y.percentInjuryRisk', { percent: injuryRiskPercent })}`
                                      : '',
                                })
                      }
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        // A drill starts only from a still list: never through a
                        // presentation, and never on the tail of the tap that
                        // just dismissed one.
                        if (stage !== null) return;
                        if (
                          Date.now() - presentationClosedAtRef.current <
                          PRESENTATION_SETTLE_MS
                        )
                          return;
                        if (unaffordable) {
                          playManagementActionSfx('warning');
                          setNotice({
                            title: t('trainingDrill.notEnoughTp'),
                            detail: t('trainingDrill.notEnoughTpDetail', {
                              drill: option.drillName,
                              cost: option.tpCost,
                              available: trainingPoints,
                            }),
                          });
                          return;
                        }
                        setRepeatCount(1);
                        setConfirmingHighRisk(false);
                        setPendingConfirm(option);
                      }}
                      className={
                        disabled || unaffordable
                          ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'
                          : isResultRow
                            ? 'flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-3'
                            : 'flex-row items-center justify-between border-2 border-ink/30 bg-white px-3 py-3'
                      }
                      style={({ pressed }) => ({
                        opacity: pressed && !disabled ? 0.65 : undefined,
                      })}
                    >
                      {/* Desktop rows have the width to spare, so each drill gets
                          its prop — cone, target, glove. The phone sheet stays
                          text-only: there the row needs every point for the name,
                          the cost and the gain. Decorative, so the row's own
                          label is still all a screen reader hears. */}
                      {wide ? (
                        <View className="mr-3">
                          <ManagementSprite
                            spriteKey={`drill:${option.pathId}`}
                            width={32}
                          />
                        </View>
                      ) : null}
                      <View className="min-w-0 flex-1 pr-2">
                        <PixelText
                          className="text-base uppercase text-ink"
                          numberOfLines={1}
                        >
                          {option.drillName}
                          <Text className="font-mono text-sm text-ink/60">
                            {' '}
                            ({option.tpCost} TP)
                          </Text>
                        </PixelText>
                        <Text
                          className="mt-0.5 font-mono text-sm text-ink/60"
                          numberOfLines={1}
                        >
                          {option.currentValue} {option.shortCode}
                          {!injured &&
                          !option.affordable &&
                          !option.atSafetyCeiling
                            ? ` · ${t('trainingDrill.notEnoughTp')}`
                            : ''}
                        </Text>
                      </View>
                      <Text
                        className="font-mono text-base text-ink"
                        numberOfLines={1}
                      >
                        {option.atSafetyCeiling
                          ? t('trainingDrill.maximum')
                          : `+${option.gain} ${option.label}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {injured ? (
                <View className="mt-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
                  <Text className="font-pixel text-base uppercase text-red-dark">
                    {t('squadTraining.outForWeeks', {
                      n: injuryWeeks,
                      count: injuryWeeks,
                    })}
                  </Text>
                  <Text className="mt-1 text-sm text-ink/70">
                    {t('trainingDrill.noTrainingUntilTheyRecover')}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {stage === 'scene' &&
            activeResult !== null &&
            resultOption !== undefined ? (
              <DrillSceneOverlay
                playerId={playerId}
                playerName={playerName}
                role={playerRole}
                lookId={playerLookId}
                activityId={drillActivityId(activeResult.pathId)}
                drillName={`${resultOption.drillName}${batchProgress === null ? '' : ` · ${batchProgress.current}/${batchProgress.total}`}`}
                shortCode={resultOption.shortCode}
                before={activeResult.displayedBefore}
                after={activeResult.displayedAfter}
                isSuper={activeResult.isSuper}
                reduceMotion={reduceMotion}
                onComplete={advanceStage}
              />
            ) : null}

            {stage === 'reveal' && activeResult !== null ? (
              <DrillGainReveal
                gainLabel={`+${activeResult.displayedAfter - activeResult.displayedBefore} ${resultOption?.label ?? activeResult.attribute}`}
                reduceMotion={reduceMotion}
                onComplete={advanceStage}
              />
            ) : null}

            {stage === 'super' && activeResult !== null ? (
              <SuperTrainingCelebration
                gainLabel={`+${activeResult.displayedAfter - activeResult.displayedBefore} ${resultOption?.shortCode ?? activeResult.attribute.toUpperCase()}`}
                reduceMotion={reduceMotion}
                onComplete={advanceStage}
              />
            ) : null}

            {stage === 'injury' && activeResult?.injury !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('trainingDrill.a11y.gotInjured', {
                  player: playerName,
                  weeks: activeResult.injury.recoveryWeeks,
                })}
                // The cue now plays when the card appears; acknowledging it is
                // an ordinary tap and takes the ordinary click.
                onPress={advanceStage}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.injuryBackdrop}>
                  <View className="border-2 border-b-4 border-red-dark bg-red-light px-5 py-4">
                    <Text className="text-center font-pixel text-xl uppercase text-red-dark">
                      {t('trainingDrill.pulledUp')}
                    </Text>
                    <Text className="mt-2 text-center font-pixel text-base uppercase text-ink">
                      {t('squadTraining.outForWeeks', {
                        n: activeResult.injury.recoveryWeeks,
                        count: activeResult.injury.recoveryWeeks,
                      })}
                    </Text>
                    <Text className="mt-2 text-center text-sm text-ink/70">
                      {t('trainingDrill.theDrillStillCounted')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>

          {pendingConfirm !== null && !confirmingHighRisk ? (
            <View style={[styles.noticeLayer, styles.noticeCenter]}>
              <Pressable
                accessible={false}
                pressSfx="warning"
                onPress={() => setPendingConfirm(null)}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.noticeBackdrop} />
              </Pressable>
              <View
                className="w-[88%] max-w-[480px] overflow-hidden border-2 border-b-4 border-ink bg-paper"
                style={styles.confirmCard}
              >
                {/* On the busiest drills this card is taller than a phone's
                    popup, so the body scrolls and the buttons stay pinned
                    underneath it. A confirmation whose Cancel has been clipped
                    off the bottom is worse than no confirmation at all. */}
                <ScrollView
                  style={styles.confirmScroll}
                  contentContainerStyle={styles.confirmScrollContent}
                >
                  <PixelText className="text-sm uppercase tracking-wide text-blue-dark">
                    {t('trainingDrill.confirmTraining')}
                  </PixelText>
                  <PixelText
                    className="mt-1 text-xl uppercase text-ink"
                    numberOfLines={2}
                  >
                    {pendingConfirm.drillName}
                  </PixelText>
                  <Text className="mt-1 text-sm text-ink/60">
                    {playerName} · {playerRole}
                  </Text>

                  {/* Everything the decision needs, on one card: what it buys,
                      what it costs, and what it risks. */}
                  <View className="mt-3 gap-2">
                    <View className="flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-2">
                      <PixelText className="text-sm uppercase text-ink">
                        {t('trainingDrill.basePerDrill', {
                          label: pendingConfirm.label,
                        })}
                      </PixelText>
                      <Text className="font-pixel text-base text-ink">
                        +
                        {pendingConfirm.baseValueAfter -
                          pendingConfirm.currentValue}
                      </Text>
                    </View>
                    {/* What this player's own modifiers deliver — the result,
                        never the signed delta that produced it.

                        Three rules at once. It may never print a negative: a
                        thirty-year-old reading "VETERAN … -2" is being told off
                        for their age on a card whose job is to sell them a
                        session. It may never promise more than the count-up two
                        seconds later delivers, which is why the drop cannot
                        simply be hidden — the base line reconciles with the
                        drill row above, and this line is what actually lands.
                        And it looks the same for every position: a keeper's card
                        turning gold where a striker's is green made the keeper
                        read as the problem, which is the whole thing this
                        change set exists to stop.

                        The modifier names stay because they are the useful part
                        — they say *why* this player differs from the row above. */}
                    {/* The net difference this player's own modifiers make to
                        the line above — a number to add, not a total to read in
                        its place. Two boxes both showing a result made "+4" then
                        "+3" scan as +7.

                        Each name carries its own colour because the row mixes
                        directions: "Veteran + GK + Prodigy" is one modifier that
                        costs and two that pay, and a single colour across the
                        row cannot say which is which. The box takes the colour
                        of the net, so the summary and the detail can disagree —
                        a veteran with good archetypes reads red overall with two
                        green names inside it, which is the true story. */}
                    {pendingConfirm.trainingModifiers.length > 0 ||
                    pendingConfirm.trainingAdjustment !== 0 ? (
                      // The fill is a tint rather than the full colour. At full
                      // strength a green label on the red box measured 1.9:1 and
                      // on the green box 2.5:1, against the 4.5:1 a body of text
                      // needs — the second was only passable because the hues
                      // were close, not because it was legible.
                      <View
                        className={
                          pendingConfirm.trainingAdjustment >= 0
                            ? 'flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light/40 px-3 py-2'
                            : 'flex-row items-center justify-between border-2 border-red-dark bg-red-light/40 px-3 py-2'
                        }
                      >
                        <PixelText
                          className="min-w-0 flex-1 pr-2 text-xs uppercase text-ink"
                          numberOfLines={2}
                          adjustsFontSizeToFit
                        >
                          {t('trainingDrill.bonus')}{' '}
                          {/* Only the modifier that costs is coloured. Marking
                              the three that pay as well left every word
                              emphasised, which emphasises nothing, and forced a
                              green-on-red pairing no tint could rescue. The
                              bonuses are the expected case and read as ink. */}
                          {pendingConfirm.trainingModifiers.map(
                            (modifier, index) => (
                              <PixelText
                                key={modifier.label}
                                className={
                                  modifier.helps ? 'text-ink' : 'text-red-dark'
                                }
                              >
                                {index === 0 ? '' : ' + '}
                                {modifier.label}
                              </PixelText>
                            ),
                          )}
                        </PixelText>
                        <Text className="font-pixel text-base text-ink">
                          {pendingConfirm.trainingAdjustment >= 0 ? '+' : ''}
                          {pendingConfirm.trainingAdjustment}
                        </Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between border-2 border-blue-dark bg-blue-light px-3 py-2">
                      <PixelText className="text-xs uppercase text-blue-dark">
                        {repeatCount === 1
                          ? t('trainingDrill.nextOrdinaryResult')
                          : t('trainingDrill.ordinaryBatchEstimate')}
                      </PixelText>
                      <Text className="font-pixel text-base text-blue-dark">
                        {repeatCount === 1
                          ? `+${nextOrdinaryGain}`
                          : `~+${ordinaryBatchEstimate}`}
                      </Text>
                    </View>
                    {pendingConfirm.fractionalBonusBanks.length > 0 ? (
                      <View className="border border-ink/20 bg-paper-dark px-3 py-2">
                        {pendingConfirm.fractionalBonusBanks.map((bank) => (
                          <View
                            key={bank.label}
                            className="flex-row items-center justify-between"
                          >
                            <Text className="text-xs text-ink/60">
                              {bank.label}
                            </Text>
                            <Text className="font-mono text-xs text-ink">
                              {(Math.floor(bank.hundredths / 10) / 10).toFixed(
                                1,
                              )}{' '}
                              / 1.0
                            </Text>
                          </View>
                        ))}
                        <Text className="mt-1 text-xs leading-4 text-ink/55">
                          {t('trainingDrill.fractionalGainsSaved')}
                        </Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">
                        {t('trainingDrill.trainingPoints')}
                      </Text>
                      <Text
                        className={
                          pendingConfirm.affordable
                            ? 'font-mono text-sm text-ink'
                            : 'font-pixel text-sm text-stamp'
                        }
                      >
                        {t('trainingDrill.pointsOfAvailable', {
                          cost: pendingConfirm.tpCost * repeatCount,
                          available: trainingPoints,
                        })}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">
                        {t('trainingDrill.conditionAfter')}
                      </Text>
                      <Text className="font-mono text-sm text-ink">
                        {condition}% →{' '}
                        {Math.max(
                          0,
                          condition -
                            INSTANT_DRILL_CONDITION_COST * repeatCount,
                        )}
                        %
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">
                        {t('trainingDrill.injuryRisk')}
                      </Text>
                      <Text
                        className={
                          injuryRiskPercent > 0 || selectedRiskyRuns > 0
                            ? 'font-pixel text-sm text-stamp'
                            : 'font-mono text-sm text-ink'
                        }
                      >
                        {selectedRiskyRuns > 0
                          ? t('trainingDrill.riskyOfDrills', {
                              risky: selectedRiskyRuns,
                              total: repeatCount,
                            })
                          : injuryRiskPercent > 0
                            ? t('trainingDrill.percentEachDrill', {
                                percent: injuryRiskPercent,
                              })
                            : t('trainingDrill.none')}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="text-sm text-ink/60">
                        {t('trainingDrill.superChance')}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        {/* Glyph-only ★ node — not in Silkscreen, deliberate system fallback. */}
                        <Text className="text-sm text-gold-dark">★</Text>
                        <Text className="font-mono text-sm text-gold-dark">
                          {superGuaranteedInBatch
                            ? t('trainingDrill.superGuaranteedInBatch')
                            : t('trainingDrill.percentEach', {
                                percent: superChancePercent,
                              })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Open at the bottom: the footer's rule closes this section,
                      so a second one here would only double the line. */}
                  <View className="mt-4 border-t-2 border-ink/20 pt-3">
                    <View className="mb-2 flex-row items-center justify-between">
                      <PixelText className="text-xs uppercase tracking-wide text-ink/60">
                        {t('trainingDrill.runsInARow')}
                      </PixelText>
                      <View className="border-2 border-blue-dark bg-blue-light px-2 py-1">
                        <PixelText className="text-sm text-blue-dark">
                          {repeatCount}×
                        </PixelText>
                      </View>
                    </View>
                    {wide ? (
                      <View style={styles.repeatDesktopRow}>
                        {repeatOptions.map(repeatButton)}
                      </View>
                    ) : (
                      <ScrollView
                        ref={repeatScrollRef}
                        horizontal
                        bounces={false}
                        decelerationRate="fast"
                        snapToInterval={REPEAT_PICKER_CELL_WIDTH}
                        snapToAlignment="start"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.repeatScrollContent}
                        onScrollBeginDrag={() => {
                          draggingRepeatRef.current = true;
                        }}
                        onScrollEndDrag={(event) =>
                          selectRepeatOffset(event.nativeEvent.contentOffset.x)
                        }
                        onMomentumScrollEnd={(event) =>
                          selectRepeatOffset(event.nativeEvent.contentOffset.x)
                        }
                      >
                        {repeatOptions.map(repeatButton)}
                      </ScrollView>
                    )}
                    <Text className="mt-2 text-xs leading-4 text-ink/55">
                      {t('trainingDrill.eachRunKeepsIts')}
                    </Text>
                  </View>
                </ScrollView>

                <View className="flex-row gap-2 border-t-2 border-ink/20 px-4 py-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('trainingDrill.a11y.cancelTraining')}
                    onPress={() => setPendingConfirm(null)}
                    className="min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-white px-3"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.65 : undefined,
                    })}
                  >
                    <PixelText className="text-base uppercase text-ink">
                      {t('trainingDrill.cancel')}
                    </PixelText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      pendingConfirm.affordable
                        ? t('trainingDrill.a11y.runDrillForPoints', {
                            n: repeatCount,
                            drill: pendingConfirm.drillName,
                            count: repeatCount,
                            cost: pendingConfirm.tpCost * repeatCount,
                          })
                        : t('trainingDrill.a11y.notEnoughPointsFor', {
                            drill: pendingConfirm.drillName,
                          })
                    }
                    accessibilityState={{
                      disabled: !pendingConfirm.affordable,
                    }}
                    disabled={!pendingConfirm.affordable}
                    onPress={() => {
                      const chosen = pendingConfirm;
                      if (selectedRiskyRuns > 0) {
                        setConfirmingHighRisk(true);
                        return;
                      }
                      startTrainingBatch(chosen, repeatCount);
                    }}
                    className={
                      pendingConfirm.affordable
                        ? 'min-h-12 flex-[1.4] items-center justify-center border-2 border-b-4 border-ink bg-blue px-3'
                        : 'min-h-12 flex-[1.4] items-center justify-center border-2 border-ink/20 bg-ink/10 px-3'
                    }
                    style={({ pressed }) => ({
                      opacity:
                        pressed && pendingConfirm.affordable ? 0.65 : undefined,
                    })}
                  >
                    <PixelText
                      className={
                        pendingConfirm.affordable
                          ? 'text-base uppercase text-white'
                          : 'text-base uppercase text-ink/40'
                      }
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      numberOfLines={1}
                    >
                      {pendingConfirm.affordable
                        ? t('trainingDrill.trainTimes', { count: repeatCount })
                        : t('trainingDrill.notEnoughTp')}
                    </PixelText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {pendingConfirm !== null && confirmingHighRisk ? (
            <View style={[styles.noticeLayer, styles.noticeCenter]}>
              <Pressable
                accessible={false}
                onPress={() => setConfirmingHighRisk(false)}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.noticeBackdrop} />
              </Pressable>
              <View
                accessibilityRole="alert"
                accessibilityLabel={t('trainingDrill.a11y.highRiskSummary', {
                  risky: selectedRiskyRuns,
                  total: repeatCount,
                })}
                className="w-[88%] max-w-[420px] border-2 border-b-4 border-red-dark bg-paper p-4"
              >
                <PixelText className="text-sm uppercase tracking-wide text-red-dark">
                  {t('trainingDrill.safetyCheck')}
                </PixelText>
                <PixelText className="mt-2 text-xl uppercase leading-7 text-ink">
                  {t('trainingDrill.highRiskOfInjuryContinue')}
                </PixelText>
                <Text className="mt-3 text-sm leading-5 text-ink/70">
                  {t('trainingDrill.riskyRunsBody', {
                    risky: selectedRiskyRuns,
                    total: repeatCount,
                  })}
                </Text>

                <View className="mt-4 gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'trainingDrill.a11y.continueAllDespiteRisk',
                      { count: repeatCount },
                    )}
                    onPress={() =>
                      startTrainingBatch(pendingConfirm, repeatCount)
                    }
                    className="min-h-12 items-center justify-center border-2 border-b-4 border-red-dark bg-red px-3"
                  >
                    <PixelText className="text-center text-sm uppercase text-white">
                      {t('trainingDrill.continueAnyway', {
                        count: repeatCount,
                      })}
                    </PixelText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      maximumSafeRuns > 0
                        ? t('trainingDrill.a11y.continueMaxSafe', {
                            count: Math.min(repeatCount, maximumSafeRuns),
                          })
                        : t('trainingDrill.a11y.noDrillsWithoutRisk')
                    }
                    accessibilityState={{ disabled: maximumSafeRuns === 0 }}
                    disabled={maximumSafeRuns === 0}
                    onPress={() => {
                      const saferRuns = Math.min(repeatCount, maximumSafeRuns);
                      setRepeatCount(saferRuns);
                      startTrainingBatch(pendingConfirm, saferRuns);
                    }}
                    className={
                      maximumSafeRuns > 0
                        ? 'min-h-12 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue px-3'
                        : 'min-h-12 items-center justify-center border-2 border-ink/20 bg-ink/10 px-3'
                    }
                  >
                    <PixelText
                      className={
                        maximumSafeRuns > 0
                          ? 'text-center text-sm uppercase text-white'
                          : 'text-center text-sm uppercase text-ink/35'
                      }
                    >
                      {maximumSafeRuns > 0
                        ? t('trainingDrill.continueMaxSafe', {
                            count: Math.min(repeatCount, maximumSafeRuns),
                          })
                        : t('trainingDrill.noSafeDrillsAvailable')}
                    </PixelText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'trainingDrill.a11y.cancelAndReturnToTheNumberPicker',
                    )}
                    onPress={() => setConfirmingHighRisk(false)}
                    className="min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-white px-3"
                  >
                    <PixelText className="text-sm uppercase text-ink">
                      {t('trainingDrill.cancel')}
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
                  <PixelText
                    className={
                      notice.bert === true
                        ? 'text-center text-lg uppercase text-blue-dark'
                        : 'text-center text-lg uppercase text-stamp'
                    }
                  >
                    {notice.title}
                  </PixelText>
                  {notice.bert === true ? (
                    <View className="mt-2 items-center">
                      <BertFullBody pointing />
                    </View>
                  ) : null}
                  <Text className="mt-2 text-center text-sm leading-5 text-ink/75">
                    {notice.detail}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('trainingDrill.a11y.dismiss')}
                    onPress={() => setNotice(null)}
                    className="mt-4 min-h-11 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-6"
                  >
                    <PixelText className="text-base uppercase text-ink">
                      {t('trainingDrill.okay')}
                    </PixelText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
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

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    repeatDesktopRow: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    repeatScrollContent: {
      alignItems: 'center',
    },
    repeatOption: {
      width: REPEAT_PICKER_CELL_WIDTH - 4,
      minHeight: 48,
      marginHorizontal: 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: '#9a95a4',
      backgroundColor: '#ffffff',
    },
    repeatOptionSelected: {
      borderColor: '#2f55b8',
      backgroundColor: '#a3c8f0',
    },
    repeatOptionWide: {
      width: 42,
      minHeight: 44,
      marginHorizontal: 1,
    },
    repeatOptionText: {
      // The loaded Silkscreen bold cut — 'PixelFont' was never registered, so iOS
      // silently fell back to San Francisco. Tabular numerals per the doc-11
      // numerals rule (same pattern as SubstitutionBoard's counter).
      fontFamily: faces.display,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      color: '#7d7887',
    },
    repeatOptionTextSelected: {
      color: '#2f55b8',
    },
    // Sits above the drill scene and the injury card: it is the newest thing the
    // player did, so it owns the popup until dismissed. These layers are siblings
    // of the sheet rather than children of it — the sheet is `overflow-hidden` and
    // only as tall as its own content, which clipped the top and bottom off any
    // card taller than it.
    noticeLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
    },
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
      paddingVertical: 24,
    },
    // Shrinks to the space the layer above leaves it instead of overflowing it.
    confirmCard: { maxHeight: '100%', flexShrink: 1 },
    // flexGrow 0 keeps a short card at its content height; flexShrink 1 hands the
    // overflow to the scroller once it is taller than the screen allows.
    confirmScroll: { flexGrow: 0, flexShrink: 1 },
    confirmScrollContent: { padding: 16 },
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
