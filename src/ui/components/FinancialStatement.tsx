import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import type { LedgerLineReveal } from '../../game/types';
import {
  playLedgerSpin,
  playLedgerThunk,
  playSurgeIgnition,
  stopAllFinancialReportSfx,
  stopLedgerSpin,
  stopSurgeBed,
} from '../../render/financial-report-sfx';
import {
  DEFAULT_MACHINE_TIMINGS,
  createMachine,
  slotPhaseForRow,
} from '../financial-statement-machine';
import type {
  MachineConfig,
  MachineState,
  RowPhase,
} from '../financial-statement-machine';
import { createStatementRuntime } from '../financial-statement-runtime';
import type { StatementRuntime } from '../financial-statement-runtime';
import type { PostMatchLedgerLineViewModel } from '../models';
import { LedgerRowIcons } from './LedgerRowIcons';
import { PaperPanel, formatCurrency } from './Scorecard';
import { PixelText } from './PixelText';
import { SlotAmount } from './SlotAmount';
import { SurgeBanner } from './SurgeBanner';
import { useCopy, type CopyFn } from '../../i18n';

/**
 * The star of the Financial Report: the statement whose rows reveal
 * slot-machine style, one at a time, driven by the pure statement machine.
 * This shell renders machine snapshots, executes nothing itself, and feeds
 * digit-settle callbacks and taps back in as events — the sequencing logic
 * stays headless-tested in financial-statement-machine.ts.
 */

export interface FinancialStatementProps {
  lines: readonly PostMatchLedgerLineViewModel[];
  netAmount: number;
  settlementSeason: number;
  settlementWeek: number;
  reduceMotion: boolean;
  /**
   * Bumped by the caller to fast-forward the reveal from outside the panel —
   * the same beat a tap on the statement produces. Lets the report's own
   * Continue button spend its first press on the animation instead of leaving.
   */
  skipSignal?: number;
  /** Reports whether the reveal is still running, so a caller can offer that. */
  onRunningChange?: (running: boolean) => void;
}

const AMOUNT_COLORS = { income: '#265b30', expense: '#a83440', neutral: '#241f2e' };
const WASH_BASE = '#fde68a';
const WASH_SWEEP = '#fdba74';

export function FinancialStatement({
  lines,
  netAmount,
  settlementSeason,
  settlementWeek,
  reduceMotion,
  skipSignal = 0,
  onRunningChange,
}: FinancialStatementProps) {
  const t = useCopy();
  const config = useMemo<MachineConfig>(() => ({
    rows: lines.map(line => ({
      id: line.id,
      amount: line.amount,
      ...(line.reveal === undefined ? {} : { reveal: line.reveal }),
    })),
    netAmount,
    timings: DEFAULT_MACHINE_TIMINGS,
    reduceMotion,
    // The statement mounts once per report; the config is frozen at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const [machine, setMachine] = useState<MachineState>(() => createMachine(config));
  const runtimeRef = useRef<StatementRuntime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createStatementRuntime({
      config,
      audio: {
        playSpin: playLedgerSpin,
        stopSpin: stopLedgerSpin,
        playThunk: playLedgerThunk,
        playSurgeIgnition,
        stopSurgeBed,
        stopAll: stopAllFinancialReportSfx,
      },
      onState: setMachine,
    });
  }

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime?.dispatch({ type: 'start' });
    return () => runtime?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback(() => {
    runtimeRef.current?.dispatch({ type: 'tap' });
  }, []);

  // Zero is the resting value, never a request: mounting must not skip the
  // reveal the panel exists to play.
  //
  // `skipAll`, not `tap`: a tap on the panel lands one group and moves on,
  // which is the reveal walking forward. The caller bumping this signal is on
  // their way out and wants the numbers they never got to see — the net total
  // most of all — so this ends the whole statement in one beat.
  useEffect(() => {
    if (skipSignal === 0) return;
    runtimeRef.current?.dispatch({ type: 'skipAll' });
  }, [skipSignal]);

  // Through a ref so an inline callback from the caller cannot re-fire this on
  // every render — the report is reported on status changes only.
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  useEffect(() => {
    onRunningChangeRef.current?.(machine.status === 'running');
  }, [machine.status]);

  const handleRowSettled = useCallback((index: number, settleKey: number) => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    runtime.dispatch({
      type: 'amountSettled',
      generation: runtime.getState().generation,
      target: 'row',
      index,
      settleKey,
    });
  }, []);

  const handleNetSettled = useCallback((settleKey: number) => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    runtime.dispatch({
      type: 'amountSettled',
      generation: runtime.getState().generation,
      target: 'net',
      index: 0,
      settleKey,
    });
  }, []);

  const handleStampSettled = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    runtime.dispatch({ type: 'stampSettled', generation: runtime.getState().generation });
  }, []);

  const handleBannerShown = useCallback((rowId: string) => {
    runtimeRef.current?.dispatch({ type: 'bannerShown', rowId });
  }, []);

  const netTone = netAmount > 0 ? 'income' : netAmount < 0 ? 'expense' : 'neutral';
  const netRuntime = machine.net;

  return (
    <View>
      <Pressable accessible={false} onPress={handleTap}>
        <PaperPanel
          kicker={t('financialStatement.accountsOffice')}
          title={t('financialStatement.matchStatement')}
        >
          <View className="border-y border-ink/30">
            {lines.map((line, index) => (
              <StatementRow
                key={line.id}
                line={line}
                runtime={machine.rows[index]}
                index={index}
                reduceMotion={reduceMotion}
                onSettled={handleRowSettled}
              />
            ))}
          </View>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={t(
              netAmount > 0
                ? 'financialStatement.a11y.netCashChangePlus'
                : netAmount < 0
                  ? 'financialStatement.a11y.netCashChangeMinus'
                  : 'financialStatement.a11y.netCashChange',
              { amount: formatCurrency(Math.abs(netAmount)) },
            )}
            className={netAmount < 0
              ? 'mt-3 flex-row items-center justify-between border-2 border-red-dark bg-red-light px-3 py-3'
              : netAmount > 0
                ? 'mt-3 flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-3'
                : 'mt-3 flex-row items-center justify-between border-2 border-blue-dark bg-blue-light px-3 py-3'}
          >
            <PixelText className={netAmount < 0
              ? 'text-base uppercase text-red-dark'
              : netAmount > 0
                ? 'text-base uppercase text-pitch-ink'
                : 'text-base uppercase text-blue-dark'}>
              {t('financialStatement.netCashChange')}</PixelText>
            <SlotAmount
              value={netRuntime.shownValue}
              finalValue={netAmount}
              phase={netRuntime.phase === 'pending'
                ? 'pending'
                : netRuntime.phase === 'spinning' ? 'spinning' : 'settled'}
              settleMode={netRuntime.settleMode}
              settleKey={netRuntime.settleKey}
              tone={netTone}
              surge={false}
              large
              reduceMotion={reduceMotion}
              onSettled={handleNetSettled}
            />
          </View>
        </PaperPanel>
      </Pressable>
      <RecordedStamp phase={machine.stampPhase} onSlammed={handleStampSettled} />
      <SurgeBanner
        queue={machine.bannerQueue}
        settlementSeason={settlementSeason}
        settlementWeek={settlementWeek}
        onShown={handleBannerShown}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

interface RowRuntimeSnapshot {
  phase: RowPhase;
  shownValue: number;
  settleKey: number;
  settleMode: 'land' | 'odometer' | 'adjacency' | 'instant';
}

function StatementRow({
  line,
  runtime,
  index,
  reduceMotion,
  onSettled,
}: {
  line: PostMatchLedgerLineViewModel;
  runtime: RowRuntimeSnapshot;
  index: number;
  reduceMotion: boolean;
  onSettled: (index: number, settleKey: number) => void;
}) {
  const t = useCopy();
  const reveal = line.reveal;
  const surge = reveal?.surge === true;
  const washActive = surge
    && !reduceMotion
    && (runtime.phase === 'spinning' || runtime.phase === 'base');
  const chipVisible = reveal !== undefined
    && hasMultiplierBeat(reveal)
    && ['chip', 'multiplied', 'adjacency', 'complete'].includes(runtime.phase);
  const adjacencyBadgeVisible = reveal?.source === 'merch'
    && reveal.adjacencyAmount > 0
    && ['adjacency', 'complete'].includes(runtime.phase);
  const handleSettled = useCallback((settleKey: number) => {
    onSettled(index, settleKey);
  }, [index, onSettled]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={rowAccessibilityLabel(line, t)}
      className="border-b border-ink/10 py-3 last:border-b-0"
      style={washActive ? { backgroundColor: WASH_BASE, marginHorizontal: -6, paddingHorizontal: 6 } : undefined}
    >
      {washActive ? <SweepingWash /> : null}
      <View className="flex-row items-center">
        {/* The label, its pictures and the bonuses it earned wrap together as
            one run. A single Text plus a floating sprite pinned the building to
            the right edge the moment the label took two lines, where it read as
            part of the amount. The written count ("· 3 shops") is gone from the
            screen — `🏪×3` is the same fact in less space — but VoiceOver still
            hears it through `rowAccessibilityLabel`, which has no icons to read. */}
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center">
          <Text className="text-base text-ink">{line.label}</Text>
          {line.icons === undefined ? null : <LedgerRowIcons icons={line.icons} />}
          {/* Every bonus the buildings earned, beside the buildings that earned
              it. They used to be split: the ×N chip rode next to the amount,
              and the shop's adjacency was a grey caption on the line below,
              which a manager with one shop read as no bonus at all. Each still
              mounts on its own beat, so it animates in as its row calculates. */}
          {chipVisible ? (
            <BonusBadge label={multiplierLabel(reveal!)} reduceMotion={reduceMotion} />
          ) : null}
          {adjacencyBadgeVisible && reveal?.source === 'merch' ? (
            <BonusBadge label={`+${reveal.adjacencyPercent}%`} reduceMotion={reduceMotion} />
          ) : null}
        </View>
        <SlotAmount
          value={runtime.shownValue}
          finalValue={line.amount}
          phase={slotPhaseForRow(runtime.phase)}
          settleMode={runtime.settleMode}
          settleKey={runtime.settleKey}
          settleDurationMs={runtime.settleMode === 'adjacency'
            ? DEFAULT_MACHINE_TIMINGS.adjacencyMs
            : DEFAULT_MACHINE_TIMINGS.odometerMs}
          tone={line.kind}
          surge={surge}
          reduceMotion={reduceMotion}
          onSettled={handleSettled}
        />
      </View>
    </View>
  );
}

function hasMultiplierBeat(reveal: LedgerLineReveal): boolean {
  return reveal.source === 'merch' ? reveal.multiplierTimes > 1 : reveal.multiplierPercent > 100;
}

/**
 * "2 shops" / "1 stand", spoken only.
 *
 * It used to print beside the label too, until the icon strip started drawing
 * the same count as `🏪×3` and the row said it twice. Both sides still count
 * from one: a manager with a single Fan Shop needs the building named as much
 * as one with three, and VoiceOver reads no sprites at all.
 */
function facilityCount(reveal: LedgerLineReveal, t: CopyFn): string {
  const key = reveal.source === 'merch'
    ? 'financialStatement.shopCount'
    : 'financialStatement.standCount';
  return t(key, { n: reveal.facilityCount, count: reveal.facilityCount });
}

/**
 * Spec §12: the full math, available immediately — VoiceOver never waits for
 * reels, and identity reveals never narrate "times 1".
 */
function rowAccessibilityLabel(line: PostMatchLedgerLineViewModel, t: CopyFn): string {
  const money = (value: number) => formatCurrency(Math.abs(value));
  // "plus"/"minus" are spoken words, so the signed amount is a catalog string
  // rather than a prefix glued onto a number.
  const signed = line.amount === 0
    ? money(line.amount)
    : t(
      line.amount > 0
        ? 'financialStatement.a11y.plusAmount'
        : 'financialStatement.a11y.minusAmount',
      { amount: money(line.amount) },
    );
  const reveal = line.reveal;
  if (reveal === undefined) {
    return t('financialStatement.a11y.rowPlain', { label: line.label, amount: signed });
  }
  const surgeNote = reveal.surge ? ` ${t('financialStatement.a11y.surgedThisWeek')}` : '';
  // The count the sighted row shows, spoken the same way — a row that reads
  // "1 shop" on screen must not be announced as a bare amount.
  const count = reveal.facilityCount >= 1 ? `, ${facilityCount(reveal, t)}` : '';
  if (reveal.source === 'merch') {
    if (reveal.multiplierTimes < 2 && reveal.adjacencyAmount === 0) {
      return t('financialStatement.a11y.rowAmount', {
        label: line.label, count, amount: signed, surge: surgeNote,
      });
    }
    const times = reveal.multiplierTimes >= 2
      ? `, ${t('financialStatement.a11y.timesFragment', { times: reveal.multiplierTimes })}`
      : '';
    const adjacency = reveal.adjacencyAmount > 0
      ? `, ${t('financialStatement.a11y.adjacencyFragment', { percent: reveal.adjacencyPercent })}`
      : '';
    return t('financialStatement.a11y.rowMerchBreakdown', {
      label: line.label,
      count,
      base: money(reveal.base),
      times,
      adjacency,
      total: money(line.amount),
      surge: surgeNote,
    });
  }
  if (reveal.multiplierPercent <= 100) {
    return t('financialStatement.a11y.rowAmount', {
      label: line.label, count, amount: signed, surge: surgeNote,
    });
  }
  return t('financialStatement.a11y.rowBreakdown', {
    label: line.label,
    count,
    base: money(reveal.base),
    percent: reveal.multiplierPercent,
    total: money(line.amount),
    surge: surgeNote,
  });
}

/**
 * What the buildings multiplied by.
 *
 * Both badges speak percent. A shop line used to read "×3" beside a stand line
 * reading "×200%", so the two multipliers on one statement looked like two
 * different kinds of arithmetic — and the shop, on the larger multiple, looked
 * like the smaller number.
 */
function multiplierLabel(reveal: LedgerLineReveal): string {
  return reveal.source === 'merch'
    ? `×${reveal.multiplierTimes * 100}%`
    : `×${reveal.multiplierPercent}%`;
}

/**
 * One bonus the club's buildings earned, riding beside the facility sprite.
 *
 * Mounted by its own beat rather than shown from the start, so it arrives with
 * the numbers it explains: it slides in from the left of where it lands, which
 * on a row that reads left-to-right reads as coming out of the sprite.
 */
function BonusBadge({ label, reduceMotion }: { label: string; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);
  return (
    // NativeWind does not process className on Animated views, so the
    // animated wrapper is style-only and a plain View carries the look.
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}
    >
      <View className="ml-2 shrink-0 border-2 border-pitch-dark bg-pitch-light px-1">
        <Text className="font-mono text-xs text-pitch-ink">{label}</Text>
      </View>
    </Animated.View>
  );
}

/** The surge wash: a warm band sweeping the row while its reels burn. */
function SweepingWash() {
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (width === 0) return undefined;
    const loop = Animated.loop(Animated.timing(sweep, {
      toValue: 1,
      duration: 600,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [sweep, width]);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: width * 0.4,
            backgroundColor: WASH_SWEEP,
            opacity: 0.35,
            transform: [{
              translateX: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [-width * 0.4, width * 1.4],
              }),
            }],
          }}
        />
      ) : null}
    </View>
  );
}

function RecordedStamp({
  phase,
  onSlammed,
}: {
  phase: 'hidden' | 'slamming' | 'complete';
  onSlammed: () => void;
}) {
  const t = useCopy();
  const progress = useRef(new Animated.Value(0)).current;
  const onSlammedRef = useRef(onSlammed);
  onSlammedRef.current = onSlammed;
  useEffect(() => {
    if (phase !== 'slamming') return undefined;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onSlammedRef.current();
    });
    return () => animation.stop();
  }, [phase, progress]);
  if (phase === 'hidden') return null;
  const scale = phase === 'complete'
    ? 1
    : progress.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] });
  const rotate = phase === 'complete'
    ? '4deg'
    : progress.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '4deg'] });
  return (
    <View pointerEvents="none" className="absolute right-3 top-3">
      <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
        <View className="border-2 border-b-4 border-stamp bg-red-light/40 px-2 py-1">
          <Text className="font-pixel text-sm uppercase text-red-dark">{t('financialStatement.recorded')}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
