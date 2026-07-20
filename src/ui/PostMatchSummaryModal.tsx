import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  playMatchStatementSfx,
  stopMatchStatementSfx,
} from '../render/management-sfx';
import { countUpValue } from './count-up';
import { SfxPressable as Pressable } from './components/SfxPressable';
import type { PostMatchViewModel } from './models';
import {
  ActionButton,
  Metric,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCompactNumber,
  formatCurrency,
} from './components/Scorecard';

export interface PostMatchSummaryModalProps {
  viewModel: PostMatchViewModel;
  onDismiss: () => void;
  reduceMotion?: boolean;
}

export function PostMatchSummaryModal({
  viewModel,
  onDismiss,
  reduceMotion = false,
}: PostMatchSummaryModalProps) {
  const [animationsComplete, setAnimationsComplete] = useState(reduceMotion);
  const motionOff = reduceMotion || animationsComplete;
  const resultTone = viewModel.result.outcomeLabel === 'WIN'
    ? 'success'
    : viewModel.result.outcomeLabel === 'LOSS'
      ? 'danger'
      : 'normal';

  useEffect(() => {
    playMatchStatementSfx();
    return () => stopMatchStatementSfx();
  }, []);

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close match summary"
          className="flex-1 justify-end px-3 pb-3"
          style={{ backgroundColor: 'rgba(36,31,46,0.62)' }}
          onPress={onDismiss}
        >
          <Pressable
            accessibilityViewIsModal
            className="w-full overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
            onPress={() => {}}
            onTouchStart={() => setAnimationsComplete(true)}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Back at the office</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink">Match summary</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close match summary"
                onPress={onDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-mono text-lg font-bold text-ink">×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
              <View className="flex-row items-center justify-center gap-3">
                <Text className="max-w-28 flex-1 text-right text-base font-bold uppercase text-ink" numberOfLines={2}>
                  {viewModel.result.homeTeam}
                </Text>
                <View className="flex-row items-center border-2 border-ink bg-ink px-3 py-2">
                  <Text className="font-mono text-xl font-bold text-paper">{viewModel.result.homeScore}</Text>
                  <Text className="mx-2 font-mono text-base text-paper/60">–</Text>
                  <Text className="font-mono text-xl font-bold text-paper">{viewModel.result.awayScore}</Text>
                </View>
                <Text className="max-w-28 flex-1 text-base font-bold uppercase text-ink" numberOfLines={2}>
                  {viewModel.result.awayTeam}
                </Text>
              </View>
              <View className="mt-3 items-center border-b-2 border-ink/15 pb-4">
                <StatusChip label={viewModel.result.outcomeLabel} tone={resultTone} />
              </View>

              {viewModel.updates.length > 0 ? (
                <View className="mt-5">
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
                  </View>
                </View>
              ) : null}

              <PaperPanel kicker="Accounts office" title="Match statement" stamp="Recorded" className="mt-5">
                <View className="border-y border-ink/30">
                  {viewModel.ledger.map((line, index) => (
                    <View key={line.id} className="flex-row items-center border-b border-ink/10 py-3 last:border-b-0">
                      <Text className="flex-1 text-base text-ink">{line.label}</Text>
                      <CountUpAmount
                        amount={line.amount}
                        delay={index * 120}
                        reduceMotion={motionOff}
                        color={line.amount > 0 ? '#3f8a4a' : line.amount < 0 ? '#a83440' : '#241f2e'}
                      />
                    </View>
                  ))}
                </View>
                <View className={viewModel.netAmount < 0
                  ? 'mt-3 flex-row items-center justify-between border-2 border-red-dark bg-red-light px-3 py-3'
                  : viewModel.netAmount > 0
                    ? 'mt-3 flex-row items-center justify-between border-2 border-pitch-dark bg-pitch-light px-3 py-3'
                    : 'mt-3 flex-row items-center justify-between border-2 border-blue-dark bg-blue-light px-3 py-3'}>
                  <Text className={viewModel.netAmount < 0
                    ? 'text-base font-bold uppercase text-red-dark'
                    : viewModel.netAmount > 0
                      ? 'text-base font-bold uppercase text-pitch-dark'
                      : 'text-base font-bold uppercase text-blue-dark'}>
                    Net cash change
                  </Text>
                  <CountUpAmount
                    amount={viewModel.netAmount}
                    delay={viewModel.ledger.length * 120}
                    reduceMotion={motionOff}
                    color={viewModel.netAmount < 0 ? '#a83440' : viewModel.netAmount > 0 ? '#3f8a4a' : '#3f6fb5'}
                    large
                  />
                </View>
              </PaperPanel>

              <View className="mt-6">
                <SectionLabel eyebrow="Dressing room" title="What moved" />
                <View className="flex-row gap-2">
                  <Metric label="TP earned" value={`+${formatCompactNumber(viewModel.trainingPointsGained)}`} tone="positive" />
                  <Metric
                    label="Fans"
                    value={`${viewModel.fanDelta > 0 ? '+' : ''}${formatCompactNumber(viewModel.fanDelta)}`}
                    tone={viewModel.fanDelta < 0 ? 'negative' : 'positive'}
                  />
                </View>
              </View>

            </ScrollView>

            <View className="border-t-2 border-ink/20 bg-white p-3">
              <ActionButton
                label="Continue  ▸"
                accessibilityLabel="Continue past the match statement"
                onPress={onDismiss}
              />
            </View>
          </Pressable>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function CountUpAmount({
  amount,
  delay,
  reduceMotion,
  color,
  large = false,
}: {
  amount: number;
  delay: number;
  reduceMotion: boolean;
  color: string;
  large?: boolean;
}) {
  const [displayAmount, setDisplayAmount] = useState(reduceMotion ? amount : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayAmount(amount);
      return undefined;
    }
    let frame = 0;
    let startedAt: number | null = null;
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startedAt === null) startedAt = timestamp;
        const progress = (timestamp - startedAt) / 450;
        setDisplayAmount(countUpValue(amount, progress));
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [amount, delay, reduceMotion]);

  return (
    <Text
      accessible
      accessibilityLabel={`${amount > 0 ? 'plus ' : amount < 0 ? 'minus ' : ''}${formatCurrency(Math.abs(amount))}`}
      className={large ? 'font-mono text-xl font-bold' : 'font-mono text-base font-bold'}
      style={{ color }}
    >
      {formatCurrency(displayAmount, true)}
    </Text>
  );
}
