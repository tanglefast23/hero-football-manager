import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { SeasonEndViewModel } from '../models';

export interface SeasonEndScreenProps {
  viewModel: SeasonEndViewModel;
  onSelectContractTerm: (playerId: string, term: 1 | 2 | 3) => void;
  onRenewContract: (playerId: string, term: 1 | 2 | 3) => void;
  onPrimaryAction: () => void;
}

export function SeasonEndScreen({
  viewModel,
  onSelectContractTerm,
  onRenewContract,
  onPrimaryAction,
}: SeasonEndScreenProps) {
  const contract = viewModel.expiredContract;
  const outcomeTone = viewModel.outcomeLabel === 'CHAMPIONS' || viewModel.outcomeLabel === 'PROMOTED'
    ? 'success'
    : viewModel.outcomeLabel === 'RELEGATED'
      ? 'danger'
      : 'normal';

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View className="items-center py-3">
          <Text className="text-xs font-bold uppercase tracking-[3px] text-sky">Season filed</Text>
          <Text className="mt-2 text-2xl font-bold uppercase tracking-wide text-paper">{viewModel.seasonLabel}</Text>
          <View className="mt-4 rotate-2 border-2 border-stamp px-5 py-3">
            <Text className="text-lg font-bold uppercase tracking-[2px] text-stamp">{viewModel.outcomeLabel}</Text>
          </View>
          <Text className="mt-5 text-center text-lg font-bold uppercase text-paper">{viewModel.headline}</Text>
          <Text className="mt-2 max-w-sm text-center text-sm leading-5 text-paper/60">{viewModel.summary}</Text>
          <View className="mt-4 flex-row gap-2">
            <StatusChip label={`Finished #${viewModel.finalPosition}`} tone={outcomeTone} />
            <StatusChip label={`Prize ${formatCompactNumber(viewModel.prizeMoney)}`} />
          </View>
        </View>

        <View className="mt-6">
          <SectionLabel eyebrow="Final whistle" title="League table" />
          <View className="border-2 border-paper/30 bg-ink-soft">
            <View className="flex-row border-b border-paper/20 px-3 py-2">
              <Text className="w-8 text-xs font-bold text-paper/50">#</Text>
              <Text className="flex-1 text-xs font-bold uppercase text-paper/50">Club</Text>
              <Text className="w-8 text-right font-mono text-xs font-bold text-paper/50">P</Text>
              <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">GD</Text>
              <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">PTS</Text>
            </View>
            {viewModel.table.map(row => {
              const rowClass = row.isUserClub
                ? 'bg-signal'
                : row.promoted
                  ? 'bg-emerald-950'
                  : '';
              const textClass = row.isUserClub ? 'text-ink' : 'text-paper';
              return (
                <View key={row.clubId} className={`flex-row px-3 py-2 ${rowClass}`}>
                  <Text className={`w-8 font-mono text-sm font-bold ${textClass}`}>{row.position}</Text>
                  <View className="flex-1 flex-row items-center pr-2">
                    <Text className={`flex-1 text-sm ${row.isUserClub ? 'font-bold' : ''} ${textClass}`} numberOfLines={1}>{row.clubName}</Text>
                    {row.promoted ? <Text className={row.isUserClub ? 'text-xs font-bold text-ink' : 'text-xs font-bold text-emerald-300'}>↑</Text> : null}
                  </View>
                  <Text className={`w-8 text-right font-mono text-sm ${textClass}`}>{row.played}</Text>
                  <Text className={`w-10 text-right font-mono text-sm ${textClass}`}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text className={`w-10 text-right font-mono text-sm font-bold ${textClass}`}>{row.points}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {contract ? (
          <View className="mt-6">
            <SectionLabel eyebrow="Before the doors close" title="Expired contract" right={<StatusChip label={contract.decision} tone={contract.decision === 'pending' ? 'danger' : 'success'} />} />
            <PaperPanel
              kicker={contract.powerName ? 'Hero agent meeting' : 'Renewal meeting'}
              title={contract.playerName}
              stamp={contract.powerName ?? contract.role}
              className={contract.isHeroWageCliff ? 'bg-amber-100' : undefined}
            >
              <View className="flex-row items-center gap-3 border-y-2 border-ink py-4">
                <View className="h-14 w-14 items-center justify-center border-2 border-ink bg-ink">
                  <Text className="font-mono text-sm font-bold text-paper">{contract.role}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink/50">Weekly wage request</Text>
                  <View className="mt-2 flex-row items-center gap-2">
                    {contract.isHeroWageCliff ? (
                      <Text className="font-mono text-sm font-bold text-ink/40 line-through">
                        {formatCompactNumber(contract.currentWeeklyWage)}
                      </Text>
                    ) : null}
                    <Text className="font-mono text-lg font-bold text-stamp">
                      {formatCompactNumber(contract.quotedWeeklyWage)}
                    </Text>
                    {contract.isHeroWageCliff ? <StatusChip label="Hero rate" tone="hero" /> : null}
                  </View>
                </View>
              </View>

              {contract.isHeroWageCliff ? (
                <View className="mt-3 border-2 border-amber-600 bg-signal/40 p-3">
                  <Text className="text-xs font-bold uppercase tracking-wide text-amber-800">The bargain years are over</Text>
                  <Text className="mt-1 text-xs leading-4 text-ink/60">
                    The awakening never changed this contract. Renewal does—and the agent knows exactly what a hero is worth.
                  </Text>
                </View>
              ) : null}

              {contract.decision === 'pending' ? (
                <>
                  <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-ink/50">Contract length</Text>
                  <View className="mt-2 flex-row gap-2">
                    {contract.termOptions.map(term => {
                      const selected = contract.selectedTerm === term;
                      return (
                        <Pressable
                          key={term}
                          accessibilityRole="radio"
                          accessibilityLabel={`${term} season contract`}
                          accessibilityState={{ selected }}
                          onPress={() => onSelectContractTerm(contract.playerId, term)}
                          className={selected ? 'min-h-11 flex-1 items-center justify-center border-2 border-ink bg-signal' : 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-paper-dark'}
                          style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
                        >
                          <Text className="font-mono text-sm font-bold text-ink">{term}</Text>
                          <Text className="mt-1 text-xs font-bold uppercase text-ink/50">Season{term === 1 ? '' : 's'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View className="mt-3">
                    <ActionButton
                      label="Renew deal"
                      accessibilityLabel={`Renew ${contract.playerName} for ${contract.selectedTerm} seasons`}
                      onPress={() => onRenewContract(contract.playerId, contract.selectedTerm)}
                      disabled={!contract.canAfford}
                    />
                  </View>
                  <Text className="mt-2 text-center text-xs text-ink/50">
                    Player release and transfer negotiation arrive with the M2 market.
                  </Text>
                  {!contract.canAfford ? (
                    <Text className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-stamp">
                      Club cannot afford this renewal
                    </Text>
                  ) : null}
                </>
              ) : (
                <View className="mt-3 flex-row gap-2">
                  <Metric label="Decision" value="Renewed" />
                  <Metric label="Next wage" value={formatCompactNumber(contract.quotedWeeklyWage)} />
                </View>
              )}
            </PaperPanel>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t-2 border-sky/30 bg-ink-soft p-3">
        <ActionButton
          label={viewModel.sliceComplete ? 'Finish M1 review  ▸' : 'Begin next season  ▸'}
          accessibilityLabel={viewModel.sliceComplete ? 'Finish the two-season M1 review' : 'Begin the next season'}
          onPress={onPrimaryAction}
          disabled={!viewModel.canContinue}
        />
        {!viewModel.canContinue ? (
          <Text className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-stamp">
            Resolve the expired contract first
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
