import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WeeklyReviewViewModel } from '../models';
import {
  ActionButton,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCompactNumber,
  formatCurrency,
} from '../components/Scorecard';
import { PlayerDevelopmentSpotlight } from '../components/PlayerDevelopmentSpotlight';
import { FacilityCompletionCard } from '../components/FacilityCompletionCard';

export interface WeeklyReviewScreenProps {
  viewModel: WeeklyReviewViewModel;
  onContinue: () => void;
  reduceMotion?: boolean;
}

export function WeeklyReviewScreen({
  viewModel,
  onContinue,
  reduceMotion = false,
}: WeeklyReviewScreenProps) {
  const [animationsComplete, setAnimationsComplete] = useState(reduceMotion);
  const complete = reduceMotion || animationsComplete;

  useEffect(() => {
    if (complete) return undefined;
    const timeout = setTimeout(() => setAnimationsComplete(true), 2800);
    return () => clearTimeout(timeout);
  }, [complete]);

  const finishAnimations = () => {
    if (!complete) setAnimationsComplete(true);
  };

  const continueOrFinish = () => {
    if (complete) onContinue();
    else setAnimationsComplete(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onTouchStart={finishAnimations}
      >
        <View className="border-b-2 border-ink pb-3">
          <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Weekly review</Text>
          <Text className="mt-1 font-pixel text-xl uppercase text-ink">{viewModel.completedWeekLabel}</Text>
          <Text className="mt-2 text-sm font-bold uppercase text-ink/50">{viewModel.clubName}</Text>
        </View>

        {viewModel.facilityCompletion ? (
          <FacilityCompletionCard
            completion={viewModel.facilityCompletion}
            reduceMotion={reduceMotion}
          />
        ) : null}

        <View className="mt-3 flex-row gap-2">
          <WeeklyBalanceCard
            label="Money"
            currentAmount={viewModel.cashAfter}
            netAmount={viewModel.netAmount}
            complete={complete}
            kind="money"
          />
          <WeeklyBalanceCard
            label="TP"
            currentAmount={viewModel.trainingPointsAfter}
            netAmount={viewModel.netTrainingPoints}
            complete={complete}
            kind="training-points"
          />
        </View>

        <View className="mt-3 gap-2">
          <View className="flex-row items-center justify-between border-2 border-ink bg-ink px-3 py-2.5">
            <Text className="text-sm font-bold uppercase text-paper/70">Cash movement</Text>
            <Text className="font-mono text-base font-bold text-paper">
              {formatCurrency(viewModel.cashBefore)} →{' '}
              <AnimatedCount
                from={viewModel.cashBefore}
                to={viewModel.cashAfter}
                complete={complete}
                format={value => formatCurrency(value)}
              />
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-2 border-ink bg-blue-dark px-3 py-2.5">
            <Text className="text-sm font-bold uppercase text-paper/70">TP movement</Text>
            <Text className="font-mono text-base font-bold text-paper">
              {formatCompactNumber(viewModel.trainingPointsBefore)} →{' '}
              <AnimatedCount
                from={viewModel.trainingPointsBefore}
                to={viewModel.trainingPointsAfter}
                complete={complete}
                format={value => `${formatCompactNumber(value)} TP`}
              />
            </Text>
          </View>
        </View>

        <View className="min-h-96 justify-center pt-5">
          <SectionLabel eyebrow="Training ground" title="Player development" />
          <PlayerDevelopmentSpotlight
            development={viewModel.development}
            reduceMotion={reduceMotion}
            forceComplete={complete}
          />
        </View>

        <PaperPanel kicker="Accounts office" title="Weekly statement" stamp="Recorded" className="mt-5">
          {viewModel.ledger.map(line => (
            <View key={line.id} className="flex-row items-center border-b border-ink/10 py-2.5 last:border-b-0">
              <Text className="flex-1 text-base text-ink">{line.label}</Text>
              <Text className={line.amount < 0
                ? 'font-mono text-base font-bold text-stamp'
                : line.amount > 0
                  ? 'font-mono text-base font-bold text-pitch-dark'
                  : 'font-mono text-base font-bold text-ink'}>
                {formatCurrency(line.amount, true)}
              </Text>
            </View>
          ))}
        </PaperPanel>

        {viewModel.updates.length > 0 || viewModel.nextFixture !== undefined ? (
          <View className="mt-7">
            <SectionLabel eyebrow="Club desk" title="What needs attention" />
            <View className="gap-2">
              {viewModel.updates.map(update => (
                <View
                  key={update.id}
                  className={update.tone === 'warning'
                    ? 'border-2 border-b-4 border-red-dark bg-red-light p-3'
                    : update.tone === 'positive'
                      ? 'border-2 border-b-4 border-pitch-dark bg-pitch-light p-3'
                      : 'border-2 border-b-4 border-blue-dark bg-blue-light p-3'}
                >
                  <Text className="text-base font-bold uppercase text-ink">{update.title}</Text>
                  <Text className="mt-1 text-sm text-ink/70">{update.detail}</Text>
                </View>
              ))}

              {viewModel.nextFixture ? (
                <View className="border-2 border-b-4 border-ink bg-white p-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1">
                      <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Next fixture</Text>
                      <Text className="mt-1 text-base font-bold uppercase text-ink">
                        {viewModel.nextFixture.homeTeam} vs {viewModel.nextFixture.awayTeam}
                      </Text>
                    </View>
                    <StatusChip label={viewModel.nextFixture.weekLabel} />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t-2 border-ink/20 bg-white p-3">
        <ActionButton
          label={`Start ${viewModel.nextWeekLabel}  ▸`}
          accessibilityLabel={`Finish the weekly review and start ${viewModel.nextWeekLabel}`}
          onPress={continueOrFinish}
        />
      </View>
    </SafeAreaView>
  );
}

type WeeklyBalanceKind = 'money' | 'training-points';

function WeeklyBalanceCard({
  label,
  currentAmount,
  netAmount,
  complete,
  kind,
}: {
  label: string;
  currentAmount: number;
  netAmount: number;
  complete: boolean;
  kind: WeeklyBalanceKind;
}) {
  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-3 py-2">
      <Text className="text-right text-sm font-bold uppercase text-ink/50">{label}</Text>
      <Text
        className="mt-1 text-right font-mono text-xl font-bold text-ink"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {kind === 'money'
          ? formatCurrency(currentAmount)
          : `${formatCompactNumber(currentAmount)} TP`}
      </Text>
      <View className="mt-2 border-t border-ink/20 pt-2">
        <Text className="text-right text-sm font-bold uppercase text-ink/50">
          {kind === 'money' ? 'Net' : 'Net TP'}
        </Text>
        <AnimatedNetAmount amount={netAmount} complete={complete} kind={kind} />
      </View>
    </View>
  );
}

function AnimatedNetAmount({
  amount,
  complete,
  kind,
}: {
  amount: number;
  complete: boolean;
  kind: WeeklyBalanceKind;
}) {
  const [displayAmount, setDisplayAmount] = useState(complete ? amount : 0);

  useEffect(() => {
    if (complete) {
      setDisplayAmount(amount);
      return undefined;
    }
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 850);
      setDisplayAmount(Math.round(amount * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [amount, complete]);

  return (
    <Text
      accessible
      accessibilityLabel={`Net ${amount < 0 ? 'minus' : amount > 0 ? 'plus' : ''} ${Math.abs(amount)} ${kind === 'money' ? 'dollars' : 'training points'}`}
      className={amount < 0
        ? 'mt-1 text-right font-mono text-xl font-bold text-stamp'
        : 'mt-1 text-right font-mono text-xl font-bold text-pitch-dark'}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {displayAmount > 0 ? '+' : displayAmount < 0 ? '−' : ''}
      {kind === 'money' ? '$' : ''}
      {formatCompactNumber(Math.abs(displayAmount))}
      {kind === 'training-points' ? ' TP' : ''}
    </Text>
  );
}

/** Spins an inline number from `from` to `to` (used for the cash/TP movement bars). */
function AnimatedCount({
  from,
  to,
  complete,
  format,
}: {
  from: number;
  to: number;
  complete: boolean;
  format: (value: number) => string;
}) {
  const [value, setValue] = useState(complete ? to : from);

  useEffect(() => {
    if (complete) {
      setValue(to);
      return undefined;
    }
    setValue(from);
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [complete, from, to]);

  return <>{format(value)}</>;
}
