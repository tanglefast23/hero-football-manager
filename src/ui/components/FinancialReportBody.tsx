import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import type { PostMatchViewModel } from '../models';
import { FinancialStatement } from './FinancialStatement';
import { Metric, SectionLabel, formatSignedCompactNumber } from './Scorecard';
import { PixelText } from './PixelText';
import { useCopy } from '../../i18n';

/**
 * The Financial Report's inner composition — the statement star on top, then
 * the concurrent sections (spec §8): TP/Fans count-ups and attention updates,
 * each animating on its own clock from mount, never waiting for the slot
 * machine. Shared verbatim by the modal and the dev harness so QA exercises the
 * production composition.
 */

export interface FinancialReportBodyProps {
  viewModel: PostMatchViewModel;
  reduceMotion: boolean;
  /** Passed straight to the statement — see FinancialStatementProps. */
  skipSignal?: number;
  onStatementRunningChange?: (running: boolean) => void;
}

export function FinancialReportBody({
  viewModel,
  reduceMotion,
  skipSignal,
  onStatementRunningChange,
}: FinancialReportBodyProps) {
  const t = useCopy();
  return (
    <View>
      <FinancialStatement
        lines={viewModel.ledger}
        netAmount={viewModel.netAmount}
        settlementSeason={viewModel.settlementSeason}
        settlementWeek={viewModel.settlementWeek}
        reduceMotion={reduceMotion}
        {...(skipSignal === undefined ? {} : { skipSignal })}
        {...(onStatementRunningChange === undefined
          ? {}
          : { onRunningChange: onStatementRunningChange })}
      />

      <EntranceView delayMs={0} reduceMotion={reduceMotion} className="mt-6">
        <SectionLabel
          eyebrow={t('financialReport.dressingRoom')}
          title={t('financialReport.whatMoved')}
        />
        <View className="flex-row gap-2">
          <Metric
            label={t('financialReport.tpChange')}
            value={
              <CountUpText
                value={viewModel.trainingPointsGained}
                format={(amount) => formatSignedCompactNumber(t, amount)}
                colorClass={
                  viewModel.trainingPointsGained < 0
                    ? 'text-red-dark'
                    : 'text-pitch-ink'
                }
              />
            }
            tone={viewModel.trainingPointsGained < 0 ? 'negative' : 'positive'}
          />
          <Metric
            label={t('financialReport.fans')}
            value={
              <CountUpText
                value={viewModel.fanDelta}
                format={(amount) => formatSignedCompactNumber(t, amount)}
                colorClass={
                  viewModel.fanDelta < 0 ? 'text-red-dark' : 'text-pitch-ink'
                }
              />
            }
            tone={viewModel.fanDelta < 0 ? 'negative' : 'positive'}
          />
        </View>
      </EntranceView>

      {viewModel.updates.length > 0 ? (
        <View className="mt-5">
          <SectionLabel
            eyebrow={t('financialReport.clubDesk')}
            title={t('financialReport.whatNeedsAttention')}
          />
          <View className="gap-2">
            {viewModel.updates.map((update, index) => (
              <EntranceView
                key={update.id}
                delayMs={160 + 80 * index}
                reduceMotion={reduceMotion}
                wiggle={update.tone === 'warning'}
              >
                <View
                  className={
                    update.tone === 'warning'
                      ? 'border-2 border-b-4 border-red-dark bg-red-light p-3'
                      : update.tone === 'positive'
                        ? 'border-2 border-b-4 border-pitch-dark bg-pitch-light p-3'
                        : 'border-2 border-b-4 border-blue-dark bg-blue-light p-3'
                  }
                >
                  <PixelText className="text-base uppercase text-ink">
                    {update.title}
                  </PixelText>
                  <Text className="mt-1 text-sm text-ink/70">
                    {update.detail}
                  </Text>
                </View>
              </EntranceView>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Slide-up entrance; warning cards add one attention wiggle after arriving. */
function EntranceView({
  children,
  delayMs,
  reduceMotion,
  wiggle = false,
  className,
}: {
  children: ReactNode;
  delayMs: number;
  reduceMotion: boolean;
  wiggle?: boolean;
  className?: string;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const steps: Animated.CompositeAnimation[] = [
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        delay: delayMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ];
    if (wiggle) {
      steps.push(
        Animated.timing(tilt, {
          toValue: 1,
          duration: 75,
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: -1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0,
          duration: 75,
          useNativeDriver: true,
        }),
      );
    }
    const sequence = Animated.sequence(steps);
    sequence.start();
    return () => sequence.stop();
  }, [delayMs, progress, reduceMotion, tilt, wiggle]);
  return (
    // NativeWind ignores className on Animated views: spacing classes live on
    // a plain outer View and the animated wrapper handles motion only.
    <View className={className}>
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            {
              rotate: tilt.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-3deg', '3deg'],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function CountUpText({
  value,
  format,
  colorClass,
}: {
  value: number;
  format: (amount: number) => string;
  colorClass: string;
}) {
  return (
    <Text
      className={`font-mono text-base ${colorClass}`}
      accessibilityLabel={format(value)}
      numberOfLines={1}
    >
      {format(value)}
    </Text>
  );
}
