import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { ClubFinancesViewModel } from '../models';

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
}

export function ClubFinancesScreen({
  viewModel,
  onOpenLedgerLine,
  onBuildTrainingGround,
}: ClubFinancesScreenProps) {
  const facility = viewModel.trainingGround;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Accounts office</Text>
          <Text className="mt-1 text-lg font-bold uppercase text-paper">Club finances</Text>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>

      <PaperPanel kicker="Cash position" title="The board’s bottom line" stamp="Current" className="mt-5">
        <View className="flex-row gap-2">
          <Metric label="Balance" value={formatCompactNumber(viewModel.resources.money)} />
          <Metric
            label="Weekly net"
            value={`${viewModel.weeklyNet > 0 ? '+' : ''}${formatCompactNumber(viewModel.weeklyNet)}`}
            tone={viewModel.weeklyNet < 0 ? 'negative' : 'positive'}
          />
          <Metric label="Projected" value={formatCompactNumber(viewModel.projectedBalance)} />
        </View>
        {viewModel.wageSubsidyLabel ? (
          <View className="mt-3 border border-emerald-700 bg-emerald-100 px-3 py-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              {viewModel.wageSubsidyLabel}
            </Text>
          </View>
        ) : null}
      </PaperPanel>

      <View className="mt-6">
        <SectionLabel eyebrow="Itemized statement" title="Every coin accounted for" />
        <View className="border-2 border-paper/30 bg-ink-soft">
          <View className="flex-row border-b border-paper/20 px-3 py-2">
            <Text className="flex-1 text-xs font-bold uppercase tracking-wide text-paper/50">Entry</Text>
            <Text className="text-right text-xs font-bold uppercase tracking-wide text-paper/50">Amount</Text>
          </View>
          {viewModel.ledger.map(line => {
            const amountClass = line.kind === 'income'
              ? 'text-emerald-300'
              : line.kind === 'expense'
                ? 'text-red-300'
                : 'text-paper';
            return (
              <Pressable
                key={line.id}
                accessibilityRole={onOpenLedgerLine ? 'button' : 'text'}
                accessibilityLabel={`${line.label}, ${line.amount > 0 ? 'plus ' : ''}${formatCompactNumber(line.amount)}`}
                disabled={!onOpenLedgerLine}
                onPress={() => onOpenLedgerLine?.(line.id)}
                className="min-h-11 flex-row items-center border-b border-paper/10 px-3 py-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="flex-1 text-sm text-paper">{line.label}</Text>
                <Text className={`font-mono text-sm font-bold ${amountClass}`}>
                  {line.amount > 0 ? '+' : ''}{formatCompactNumber(line.amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-6">
        <SectionLabel eyebrow="One big call" title="Training Ground" right={<StatusChip label="Facility 01" />} />
        <PaperPanel kicker="Works order" title="Turn mud into momentum" stamp={facility.built ? 'Built' : 'Decision'}>
          <View className="flex-row items-center gap-4 border-y-2 border-ink py-4">
            <View className="h-16 w-16 items-center justify-center border-2 border-emerald-900 bg-pitch">
              <View className="h-10 w-10 border-2 border-paper/80">
                <View className="absolute left-1/2 top-0 h-full w-px bg-paper/70" />
                <View className="absolute left-0 top-1/2 h-px w-full bg-paper/70" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold uppercase text-ink">Training Ground · Level 1</Text>
              <Text className="mt-2 text-xs leading-4 text-ink/60">
                A proper weekly practice base. Small, dependable improvement without adding another management chore.
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Build cost" value={formatCompactNumber(facility.cost)} tone="negative" />
            <Metric label="Weekly return" value={`+${facility.weeklyTrainingPoints} TP`} tone="positive" />
          </View>
          <Text className="mt-3 text-xs font-bold uppercase tracking-wide text-ink/50">
            M1 offer: 8,000 cost · +5 TP every week
          </Text>
          <View className="mt-3">
            <ActionButton
              label={facility.built ? 'Training Ground built' : 'Approve build · 8,000'}
              accessibilityLabel={facility.built ? 'Training Ground is already built' : 'Build the Training Ground for 8,000 money'}
              onPress={onBuildTrainingGround}
              disabled={facility.built || !facility.affordable}
            />
          </View>
          {!facility.built && !facility.affordable ? (
            <Text className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-stamp">
              Insufficient balance
            </Text>
          ) : null}
        </PaperPanel>
      </View>
    </ScrollView>
  );
}
