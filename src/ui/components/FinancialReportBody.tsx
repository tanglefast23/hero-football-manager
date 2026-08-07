import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { countUpValue } from '../count-up';
import type { PostMatchViewModel } from '../models';
import { FinancialStatement } from './FinancialStatement';
import { Metric, SectionLabel, formatCompactNumber } from './Scorecard';
import { PixelText } from './PixelText';
import { PostMatchBuzzCard } from './PostMatchBuzzCard';
import { useCopy } from '../../i18n';

/**
 * The Financial Report's inner composition — the statement star on top, then
 * the concurrent sections (spec §8): TP/Fans count-ups, the buzz card, and
 * the attention updates, each animating on its own clock from mount, never
 * waiting for the slot machine. Shared verbatim by the modal and the dev
 * harness so QA exercises the production composition.
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
            value={(
              <CountUpText
                value={viewModel.trainingPointsGained}
                format={amount => `${amount > 0 ? '+' : ''}${formatCompactNumber(amount)}`}
                reduceMotion={reduceMotion}
                colorClass={viewModel.trainingPointsGained < 0 ? 'text-red-dark' : 'text-pitch-ink'}
              />
            )}
            tone={viewModel.trainingPointsGained < 0 ? 'negative' : 'positive'}
          />
          <Metric
            label={t('financialReport.fans')}
            value={(
              <CountUpText
                value={viewModel.fanDelta}
                format={amount => `${amount > 0 ? '+' : ''}${formatCompactNumber(amount)}`}
                reduceMotion={reduceMotion}
                colorClass={viewModel.fanDelta < 0 ? 'text-red-dark' : 'text-pitch-ink'}
              />
            )}
            tone={viewModel.fanDelta < 0 ? 'negative' : 'positive'}
          />
        </View>
      </EntranceView>

      {viewModel.buzz === undefined ? null : (
        <EntranceView delayMs={80} reduceMotion={reduceMotion} className="mt-5">
          <PostMatchBuzzCard buzz={viewModel.buzz} />
        </EntranceView>
      )}

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
                  className={update.tone === 'warning'
                    ? 'border-2 border-b-4 border-red-dark bg-red-light p-3'
                    : update.tone === 'positive'
                      ? 'border-2 border-b-4 border-pitch-dark bg-pitch-light p-3'
                      : 'border-2 border-b-4 border-blue-dark bg-blue-light p-3'}
                >
                  <PixelText className="text-base uppercase text-ink">{update.title}</PixelText>
                  <Text className="mt-1 text-sm text-ink/70">{update.detail}</Text>
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
        Animated.timing(tilt, { toValue: 1, duration: 75, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -1, duration: 150, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 75, useNativeDriver: true }),
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
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** Counts up over ~600 ms with a small bounce on landing. */
function CountUpText({
  value,
  format,
  reduceMotion,
  colorClass,
}: {
  value: number;
  format: (amount: number) => string;
  reduceMotion: boolean;
  colorClass: string;
}) {
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const bounce = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      setShown(value);
      return undefined;
    }
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = (timestamp - startedAt) / 600;
      setShown(countUpValue(value, progress));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
        return;
      }
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.08, duration: 90, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [bounce, reduceMotion, value]);
  return (
    <Animated.View style={{ transform: [{ scale: bounce }], alignSelf: 'flex-start' }}>
      <Text className={`font-mono text-base ${colorClass}`} accessibilityLabel={format(value)} numberOfLines={1}>
        {format(shown)}
      </Text>
    </Animated.View>
  );
}
