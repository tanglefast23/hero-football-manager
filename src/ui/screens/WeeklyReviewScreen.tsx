import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WeeklyReviewViewModel } from '../models';
import {
  ActionButton,
  PaperPanel,
  formatCompactNumber,
  formatCurrency,
} from '../components/Scorecard';
import { ChalkboardBackdrop, StageSection } from '../components/ChalkboardStage';
import { useLayoutMode } from '../layout/use-layout-mode';
import { FacilityCompletionCard } from '../components/FacilityCompletionCard';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { countUpValue } from '../count-up';
import { PixelText } from '../components/PixelText';

export interface WeeklyReviewScreenProps {
  viewModel: WeeklyReviewViewModel;
  onContinue: () => void;
  animationsReady?: boolean;
  reduceMotion?: boolean;
  textScale?: TextScale;
}

export function WeeklyReviewScreen({
  viewModel,
  onContinue,
  animationsReady = true,
  reduceMotion = false,
  textScale = 1,
}: WeeklyReviewScreenProps) {
  const wide = useLayoutMode() === 'twoColumn';
  const [balanceAnimationsComplete, setBalanceAnimationsComplete] = useState(reduceMotion);
  const balanceAnimationsStarted = reduceMotion || animationsReady;
  const balanceComplete = reduceMotion || balanceAnimationsComplete;

  // Backstop, not a gate: the count-ups land themselves in about a second, but
  // they run on requestAnimationFrame, which stalls while the app is
  // backgrounded. This lands the final figures either way.
  useEffect(() => {
    if (!balanceAnimationsStarted || balanceComplete) return undefined;
    const timeout = setTimeout(() => setBalanceAnimationsComplete(true), 2800);
    return () => clearTimeout(timeout);
  }, [balanceAnimationsStarted, balanceComplete]);

  const moneyCard = (
    <WeeklyBalanceCard
      label="Money"
      startingAmount={viewModel.cashBefore}
      currentAmount={viewModel.cashAfter}
      netAmount={viewModel.netAmount}
      started={balanceAnimationsStarted}
      complete={balanceComplete}
      kind="money"
    />
  );

  const cashMovement = (
    <View className="flex-row items-center justify-between border-2 border-ink bg-ink px-3 py-2.5">
      <Text className="font-pixel text-sm uppercase text-paper/75">Cash movement</Text>
      <Text className="font-mono text-base text-paper">
        {formatCurrency(viewModel.cashBefore)} →{' '}
        <AnimatedCount
          from={viewModel.cashBefore}
          to={viewModel.cashAfter}
          started={balanceAnimationsStarted}
          complete={balanceComplete}
          format={value => formatCurrency(value)}
        />
      </Text>
    </View>
  );

  const statement = (
    <PaperPanel kicker="Accounts office" title="Weekly statement" stamp="Recorded">
      {viewModel.ledger.map(line => (
        <View key={line.id} className="flex-row items-center border-b border-ink/10 py-2.5 last:border-b-0">
          <Text className="flex-1 text-ink" style={scaledBody(textScale)}>{line.label}</Text>
          <Text className={line.amount < 0
            ? 'font-mono text-base text-stamp'
            : line.amount > 0
              ? 'font-mono text-base text-pitch-ink'
              : 'font-mono text-base text-ink'}>
            {formatCurrency(line.amount, true)}
          </Text>
        </View>
      ))}
    </PaperPanel>
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className={wide ? 'w-full max-w-[1180px] self-center px-4 pb-7 pt-4' : 'w-full px-4 pb-7 pt-4'}>
          <View className="border-b-2 border-paper/15 pb-3">
            <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Weekly review</Text>
            <Text className="mt-1 font-pixel text-xl uppercase text-white">{viewModel.completedWeekLabel}</Text>
            <Text className="mt-2 font-pixel text-sm uppercase text-paper/75">{viewModel.clubName}</Text>
          </View>

          {viewModel.facilityCompletion ? (
            <FacilityCompletionCard
              completion={viewModel.facilityCompletion}
              reduceMotion={reduceMotion}
            />
          ) : null}

          {wide ? (
            <View className="mt-5 flex-row items-start gap-6">
              <View className="flex-1 gap-2">
                <View className="flex-row">{moneyCard}</View>
                {cashMovement}
              </View>
              <View className="flex-1">{statement}</View>
            </View>
          ) : (
            <>
              <View className="mt-3 flex-row">{moneyCard}</View>
              <View className="mt-3">{cashMovement}</View>
              <View className="mt-5">{statement}</View>
            </>
          )}
        </View>
      </ScrollView>

      <View className="border-t-[6px] border-white bg-ink/25 p-3">
        <View className={wide ? 'w-full max-w-[1180px] self-center' : 'w-full'}>
          {/* Leaving is the skip. This press used to be eaten while the
              count-ups ran, so the button played its chime and the week never
              started — a dead button, since nothing here is worth holding a
              manager on. Skipping elsewhere is its own labelled control. */}
          <ActionButton
            label={`Start ${viewModel.nextWeekLabel}  ▸`}
            accessibilityLabel={`Finish the weekly review and start ${viewModel.nextWeekLabel}`}
            onPress={onContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

type WeeklyBalanceKind = 'money' | 'training-points';

function WeeklyBalanceCard({
  label,
  startingAmount,
  currentAmount,
  netAmount,
  started,
  complete,
  kind,
}: {
  label: string;
  startingAmount: number;
  currentAmount: number;
  netAmount: number;
  started: boolean;
  complete: boolean;
  kind: WeeklyBalanceKind;
}) {
  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-3 py-2">
      <PixelText className="text-right text-sm uppercase text-ink/50">{label}</PixelText>
      <AnimatedBalanceAmount
        from={startingAmount}
        to={currentAmount}
        started={started}
        complete={complete}
        kind={kind}
      />
      <View className="mt-2 border-t border-ink/20 pt-2">
        <PixelText className="text-right text-sm uppercase text-ink/50">
          {kind === 'money' ? 'Net' : 'Net TP'}
        </PixelText>
        <AnimatedNetAmount amount={netAmount} started={started} complete={complete} kind={kind} />
      </View>
    </View>
  );
}

function AnimatedNetAmount({
  amount,
  started,
  complete,
  kind,
}: {
  amount: number;
  started: boolean;
  complete: boolean;
  kind: WeeklyBalanceKind;
}) {
  const { value: displayAmount, impact } = useCelebratoryNumber(0, amount, started, complete, 850);

  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        transform: [{
          scale: impact.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] }),
        }],
      }}
    >
      <Text
        accessible
        accessibilityLabel={`Net ${amount < 0 ? 'minus' : amount > 0 ? 'plus' : ''} ${Math.abs(amount)} ${kind === 'money' ? 'dollars' : 'training points'}`}
        className={amount < 0
          ? 'mt-1 text-right font-mono text-xl text-stamp'
          : 'mt-1 text-right font-mono text-xl text-pitch-ink'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {displayAmount > 0 ? '+' : displayAmount < 0 ? '−' : ''}
        {kind === 'money' ? '$' : ''}
        {formatCompactNumber(Math.abs(displayAmount))}
        {kind === 'training-points' ? ' TP' : ''}
      </Text>
    </Animated.View>
  );
}

function AnimatedBalanceAmount({
  from,
  to,
  started,
  complete,
  kind,
}: {
  from: number;
  to: number;
  started: boolean;
  complete: boolean;
  kind: WeeklyBalanceKind;
}) {
  const { value, impact } = useCelebratoryNumber(from, to, started, complete, 1050);
  const movementClass = to < from
    ? 'text-stamp'
    : to > from
      ? 'text-pitch-ink'
      : 'text-ink';
  return (
    <Animated.View
      style={{
        transform: [
          { scale: impact.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
          { translateY: impact.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        ],
      }}
    >
      <Text
        accessibilityLabel={`${kind === 'money' ? 'Money' : 'Training points'} ${from} to ${to}`}
        className={`mt-1 text-right font-mono text-xl ${movementClass}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {kind === 'money' ? formatCurrency(value) : `${formatCompactNumber(value)} TP`}
      </Text>
    </Animated.View>
  );
}

/** Spins an inline number from `from` to `to` (used for the cash/TP movement bars). */
function AnimatedCount({
  from,
  to,
  started,
  complete,
  format,
}: {
  from: number;
  to: number;
  started: boolean;
  complete: boolean;
  format: (value: number) => string;
}) {
  const { value } = useCelebratoryNumber(from, to, started, complete, 900);

  return <>{format(value)}</>;
}

function useCelebratoryNumber(
  from: number,
  to: number,
  started: boolean,
  complete: boolean,
  durationMs: number,
): { value: number; impact: Animated.Value } {
  const [value, setValue] = useState(complete ? to : from);
  const impact = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (complete) {
      setValue(to);
      impact.setValue(0);
      return undefined;
    }
    setValue(from);
    impact.setValue(0);
    if (!started) return undefined;
    let frame = 0;
    let landingAnimation: Animated.CompositeAnimation | undefined;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / durationMs);
      setValue(from + countUpValue(to - from, progress));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
        return;
      }
      landingAnimation = Animated.sequence([
        Animated.timing(impact, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.spring(impact, {
          toValue: 0,
          damping: 7,
          stiffness: 230,
          mass: 0.55,
          useNativeDriver: true,
        }),
      ]);
      landingAnimation.start();
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      landingAnimation?.stop();
    };
  }, [complete, durationMs, from, impact, started, to]);

  return { value, impact };
}
