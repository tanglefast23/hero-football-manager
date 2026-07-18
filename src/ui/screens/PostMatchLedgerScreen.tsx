import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { PostMatchViewModel } from '../models';

export interface PostMatchLedgerScreenProps {
  viewModel: PostMatchViewModel;
  onContinue: () => void;
  onReplayHighlight?: (highlightId: string) => void;
}

export function PostMatchLedgerScreen({
  viewModel,
  onContinue,
  onReplayHighlight,
}: PostMatchLedgerScreenProps) {
  const { result } = viewModel;
  const resultTone = result.outcomeLabel === 'WIN'
    ? 'success'
    : result.outcomeLabel === 'LOSS'
      ? 'danger'
      : 'normal';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="items-center py-3">
          <StatusChip label="Full time" tone={resultTone} />
          <Text className="mt-3 text-sm font-bold uppercase text-blue-dark">{result.competition}</Text>
          <View className="mt-4 flex-row items-center gap-4">
            <Text className="w-24 text-right text-base font-bold uppercase text-ink" numberOfLines={2}>{result.homeTeam}</Text>
            <View className="flex-row items-center border-2 border-ink bg-ink px-4 py-3">
              <Text className="font-mono text-3xl font-bold text-paper">{result.homeScore}</Text>
              <Text className="mx-3 font-mono text-xl text-paper/60">–</Text>
              <Text className="font-mono text-3xl font-bold text-paper">{result.awayScore}</Text>
            </View>
            <Text className="w-24 text-base font-bold uppercase text-ink" numberOfLines={2}>{result.awayTeam}</Text>
          </View>
          <View className="mt-4 -rotate-2 border-2 border-stamp px-4 py-2">
            <Text className="text-xl font-bold uppercase text-stamp">{result.outcomeLabel}</Text>
          </View>
          <Text className="mt-4 text-center text-base text-ink/70">{result.headline}</Text>
        </View>

        <PaperPanel kicker="Accounts office" title="Match statement" stamp="Filed" className="mt-5">
          <View className="border-y border-ink/30">
            {viewModel.ledger.map(line => {
              const color = line.kind === 'income'
                ? 'text-emerald-700'
                : line.kind === 'expense'
                  ? 'text-stamp'
                  : 'text-ink';
              return (
                <View key={line.id} className="flex-row items-center border-b border-ink/10 py-3 last:border-b-0">
                  <Text className="flex-1 text-base text-ink">{line.label}</Text>
                  <Text className={`font-mono text-base font-bold ${color}`}>
                    {line.amount > 0 ? '+' : ''}{formatCompactNumber(line.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="mt-3 flex-row items-center justify-between bg-ink px-3 py-3">
            <Text className="text-base font-bold uppercase text-paper">Net movement</Text>
            <Text className={viewModel.netAmount < 0 ? 'font-mono text-xl font-bold text-red-300' : 'font-mono text-xl font-bold text-emerald-300'}>
              {viewModel.netAmount > 0 ? '+' : ''}{formatCompactNumber(viewModel.netAmount)}
            </Text>
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
            <Metric label="Essence" value={`+${formatCompactNumber(viewModel.heroEssenceGained)}`} tone="hero" />
          </View>
        </View>

        {viewModel.highlights.length ? (
          <View className="mt-6">
            <SectionLabel eyebrow="Match tape" title="Highlights" />
            <View className="gap-2">
              {viewModel.highlights.map(highlight => (
                <Pressable
                  key={highlight.id}
                  accessibilityRole={onReplayHighlight ? 'button' : 'text'}
                  accessibilityLabel={`${highlight.minuteLabel}. ${highlight.description}`}
                  disabled={!onReplayHighlight}
                  onPress={() => onReplayHighlight?.(highlight.id)}
                  className="min-h-12 flex-row items-center border border-ink/25 bg-white px-3 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
                >
                  <Text className="w-12 font-mono text-base font-bold text-gold-dark">{highlight.minuteLabel}</Text>
                  <Text className="flex-1 text-base text-ink">{highlight.description}</Text>
                  {onReplayHighlight ? <Text className="font-mono text-base text-blue-dark">▶</Text> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t-2 border-ink/20 bg-white p-3">
        <ActionButton
          label="Back to the office  ▸"
          accessibilityLabel="Continue to club management"
          onPress={onContinue}
        />
      </View>
    </SafeAreaView>
  );
}
