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
import { PaperPanel, formatCurrency } from './Scorecard';
import { PixelText } from './PixelText';
import { SlotAmount } from './SlotAmount';
import { SurgeBanner } from './SurgeBanner';

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
}: FinancialStatementProps) {
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
        <PaperPanel kicker="Accounts office" title="Match statement">
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
            accessibilityLabel={`Net cash change, ${netAmount > 0 ? 'plus ' : netAmount < 0 ? 'minus ' : ''}${formatCurrency(Math.abs(netAmount))}`}
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
              Net cash change
            </PixelText>
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
  const reveal = line.reveal;
  const surge = reveal?.surge === true;
  const washActive = surge
    && !reduceMotion
    && (runtime.phase === 'spinning' || runtime.phase === 'base');
  const chipVisible = reveal !== undefined
    && hasMultiplierBeat(reveal)
    && ['chip', 'multiplied', 'adjacency', 'complete'].includes(runtime.phase);
  const captionVisible = reveal?.source === 'merch'
    && reveal.adjacencyAmount > 0
    && ['adjacency', 'complete'].includes(runtime.phase);
  const handleSettled = useCallback((settleKey: number) => {
    onSettled(index, settleKey);
  }, [index, onSettled]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={rowAccessibilityLabel(line)}
      className="border-b border-ink/10 py-3 last:border-b-0"
      style={washActive ? { backgroundColor: WASH_BASE, marginHorizontal: -6, paddingHorizontal: 6 } : undefined}
    >
      {washActive ? <SweepingWash /> : null}
      <View className="flex-row items-center">
        <Text className="flex-1 text-base text-ink">
          {line.label}
          {suffixFor(reveal) === null ? null : (
            <Text className="text-ink/60">{suffixFor(reveal)}</Text>
          )}
        </Text>
        {chipVisible ? <MultiplierChip reveal={reveal!} reduceMotion={reduceMotion} /> : null}
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
      {captionVisible && reveal?.source === 'merch' ? (
        <Text className="mt-1 text-right text-xs text-ink/60">
          {`+${reveal.adjacencyPercent}% adjacency`}
        </Text>
      ) : null}
    </View>
  );
}

function hasMultiplierBeat(reveal: LedgerLineReveal): boolean {
  return reveal.source === 'merch' ? reveal.multiplierTimes > 1 : reveal.multiplierPercent > 100;
}

/** UI-only label suffix from the reveal — the persisted label stays clean. */
function suffixFor(reveal: LedgerLineReveal | undefined): string | null {
  if (reveal === undefined) return null;
  if (reveal.source === 'merch') {
    if (reveal.multiplierTimes < 2) return null;
    return ` · ${reveal.facilityCount} shop${reveal.facilityCount === 1 ? '' : 's'}`;
  }
  if (reveal.facilityCount < 1) return null;
  return ` · ${reveal.facilityCount} stand${reveal.facilityCount === 1 ? '' : 's'}`;
}

/**
 * Spec §12: the full math, available immediately — VoiceOver never waits for
 * reels, and identity reveals never narrate "times 1".
 */
function rowAccessibilityLabel(line: PostMatchLedgerLineViewModel): string {
  const money = (value: number) => formatCurrency(Math.abs(value));
  const sign = line.amount > 0 ? 'plus ' : line.amount < 0 ? 'minus ' : '';
  const reveal = line.reveal;
  if (reveal === undefined) return `${line.label}, ${sign}${money(line.amount)}`;
  const surgeNote = reveal.surge ? ' Surged this week.' : '';
  if (reveal.source === 'merch') {
    if (reveal.multiplierTimes < 2 && reveal.adjacencyAmount === 0) {
      return `${line.label}, ${sign}${money(line.amount)}.${surgeNote}`;
    }
    const times = reveal.multiplierTimes >= 2 ? `, times ${reveal.multiplierTimes}` : '';
    const adjacency = reveal.adjacencyAmount > 0
      ? `, plus ${reveal.adjacencyPercent} percent adjacency`
      : '';
    const shops = reveal.multiplierTimes >= 2
      ? `, ${reveal.facilityCount} shop${reveal.facilityCount === 1 ? '' : 's'}`
      : '';
    return `${line.label}${shops}. Base ${money(reveal.base)}${times}${adjacency}, total ${money(line.amount)}.${surgeNote}`;
  }
  if (reveal.multiplierPercent <= 100) {
    return `${line.label}, ${sign}${money(line.amount)}.${surgeNote}`;
  }
  const stands = reveal.facilityCount > 0
    ? `, ${reveal.facilityCount} stand${reveal.facilityCount === 1 ? '' : 's'}`
    : '';
  return `${line.label}${stands}. Base ${money(reveal.base)}, times ${reveal.multiplierPercent} percent, total ${money(line.amount)}.${surgeNote}`;
}

function MultiplierChip({ reveal, reduceMotion }: { reveal: LedgerLineReveal; reduceMotion: boolean }) {
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
  const label = reveal.source === 'merch' ? `×${reveal.multiplierTimes}` : `×${reveal.multiplierPercent}%`;
  return (
    // NativeWind does not process className on Animated views, so the
    // animated wrapper is style-only and a plain View carries the look.
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View className="mr-2 border-2 border-pitch-dark bg-pitch-light px-1">
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
          <Text className="font-pixel text-sm uppercase text-red-dark">Recorded</Text>
        </View>
      </Animated.View>
    </View>
  );
}
