import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { FocusDrillViewModel, SquadTrainingViewModel } from '../models';

export interface SquadTrainingScreenProps {
  viewModel: SquadTrainingViewModel;
  onSelectPlayer: (playerId: string) => void;
  onTogglePlayerAssignment: (playerId: string) => void;
  onToggleDrill: (drillId: string) => void;
  onApplyTraining: () => void;
}

function drillSelectionClass(drill: FocusDrillViewModel): string {
  if (!drill.available) return 'border-paper/20 bg-ink-soft opacity-40';
  if (drill.selected) return 'border-ink bg-signal';
  return 'border-paper/30 bg-ink-soft';
}

export function SquadTrainingScreen({
  viewModel,
  onSelectPlayer,
  onTogglePlayerAssignment,
  onToggleDrill,
  onApplyTraining,
}: SquadTrainingScreenProps) {
  const selectedPlayer = viewModel.players.find(player => player.id === viewModel.selectedPlayerId);
  const assigned = new Set(viewModel.assignedPlayerIds);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Squad room</Text>
          <Text className="mt-1 text-lg font-bold uppercase text-paper">Roster & training</Text>
        </View>
        <View className="flex-row gap-2">
          <Metric label="Money" value={formatCompactNumber(viewModel.resources.money)} />
          <Metric label="TP" value={formatCompactNumber(viewModel.resources.trainingPoints)} />
        </View>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Team register"
          title={`${viewModel.players.length} players`}
          right={<StatusChip label={`${viewModel.assignedPlayerIds.length} assigned`} />}
        />
        <View className="border-2 border-paper/30 bg-ink-soft">
          <View className="flex-row border-b border-paper/20 px-3 py-2">
            <Text className="w-10 text-xs font-bold uppercase text-paper/50">Role</Text>
            <Text className="flex-1 text-xs font-bold uppercase text-paper/50">Player</Text>
            <Text className="w-10 text-right text-xs font-bold uppercase text-paper/50">OVR</Text>
            <Text className="w-12 text-right text-xs font-bold uppercase text-paper/50">Fit</Text>
            <Text className="w-10 text-right text-xs font-bold uppercase text-paper/50">Plan</Text>
          </View>
          {viewModel.players.map(player => {
            const selected = player.id === viewModel.selectedPlayerId;
            const isAssigned = assigned.has(player.id);
            return (
              <View
                key={player.id}
                className={selected ? 'flex-row items-center border-b border-ink/20 bg-paper px-3 py-2' : 'flex-row items-center border-b border-paper/10 px-3 py-2'}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open summary for ${player.name}`}
                  onPress={() => onSelectPlayer(player.id)}
                  className="min-h-11 flex-1 flex-row items-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
                >
                  <Text className={selected ? 'w-10 font-mono text-xs font-bold text-ink' : 'w-10 font-mono text-xs font-bold text-sky'}>{player.role}</Text>
                  <View className="flex-1 pr-2">
                    <Text className={selected ? 'text-sm font-bold text-ink' : 'text-sm font-bold text-paper'} numberOfLines={1}>{player.name}</Text>
                    {player.powerName ? (
                      <Text className="mt-1 text-xs font-bold uppercase text-amber-600" numberOfLines={1}>★ {player.powerName}</Text>
                    ) : (
                      <Text className={selected ? 'mt-1 text-xs text-ink/50' : 'mt-1 text-xs text-paper/40'}>{player.contractLabel}</Text>
                    )}
                  </View>
                  <Text className={selected ? 'w-10 text-right font-mono text-sm font-bold text-ink' : 'w-10 text-right font-mono text-sm font-bold text-paper'}>{player.overall}</Text>
                  <Text className={player.condition < 30 ? 'w-12 text-right font-mono text-sm font-bold text-stamp' : selected ? 'w-12 text-right font-mono text-sm text-ink' : 'w-12 text-right font-mono text-sm text-paper'}>{player.condition}%</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Assign ${player.name} to selected focus drills`}
                  accessibilityState={{ checked: isAssigned }}
                  onPress={() => onTogglePlayerAssignment(player.id)}
                  className={isAssigned ? 'ml-2 h-9 w-9 items-center justify-center border-2 border-ink bg-signal' : 'ml-2 h-9 w-9 items-center justify-center border border-paper/30'}
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
                >
                  <Text className={isAssigned ? 'font-mono text-sm font-bold text-ink' : 'font-mono text-sm text-paper/40'}>{isAssigned ? '✓' : '+'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {selectedPlayer ? (
        <PaperPanel
          kicker="Player file"
          title={selectedPlayer.name}
          stamp={selectedPlayer.licensed ? 'Licensed' : selectedPlayer.role}
          className="mt-5"
        >
          <View className="flex-row gap-2">
            <Metric label="Overall" value={String(selectedPlayer.overall)} />
            <Metric
              label="Condition"
              value={`${selectedPlayer.condition}%`}
              tone={selectedPlayer.condition < 30 ? 'negative' : 'positive'}
            />
            <Metric label="Wage / wk" value={formatCompactNumber(selectedPlayer.weeklyWage)} />
          </View>
          <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/20 pt-3">
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-wide text-ink/50">Contract</Text>
              <Text className="mt-1 text-sm font-bold text-ink">{selectedPlayer.contractLabel}</Text>
            </View>
            {selectedPlayer.powerName ? <StatusChip label={selectedPlayer.powerName} tone="hero" /> : null}
          </View>
          <View className="mt-3 border border-ink/20 bg-paper-dark/40 px-3 py-2">
            <Text className="text-center text-xs font-bold uppercase tracking-wide text-ink/50">
              Full player card expands with M2
            </Text>
          </View>
        </PaperPanel>
      ) : null}

      <View className="mt-6">
        <SectionLabel
          eyebrow="Weekly plan"
          title="Focus drills"
          right={<StatusChip label={`${viewModel.selectedDrillCount} / ${viewModel.maxDrills}`} selected={viewModel.selectedDrillCount > 0} />}
        />
        <Text className="mb-3 text-xs leading-4 text-paper/50">
          Pick up to {viewModel.maxDrills}. Pair each selected drill with one assigned player.
        </Text>
        <View className="gap-2">
          {viewModel.drills.map(drill => (
            <Pressable
              key={drill.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${drill.name}. ${drill.gainLabel}. Costs ${drill.moneyCost} money and ${drill.trainingPointCost} training points.`}
              accessibilityState={{ checked: drill.selected, disabled: !drill.available }}
              disabled={!drill.available}
              onPress={() => onToggleDrill(drill.id)}
              className={`min-h-16 flex-row items-center border-2 p-3 ${drillSelectionClass(drill)}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
            >
              <View className={drill.selected ? 'mr-3 h-8 w-8 items-center justify-center border-2 border-ink bg-paper' : 'mr-3 h-8 w-8 items-center justify-center border border-paper/30'}>
                <Text className={drill.selected ? 'font-mono text-sm font-bold text-ink' : 'font-mono text-sm text-paper/40'}>{drill.selected ? '✓' : '+'}</Text>
              </View>
              <View className="flex-1 pr-3">
                <Text className={drill.selected ? 'text-sm font-bold uppercase text-ink' : 'text-sm font-bold uppercase text-paper'}>{drill.name}</Text>
                <Text className={drill.selected ? 'mt-1 text-xs text-ink/60' : 'mt-1 text-xs text-paper/50'}>{drill.focusLabel} · {drill.gainLabel}</Text>
              </View>
              <View className="items-end">
                <Text className={drill.selected ? 'font-mono text-xs font-bold text-ink' : 'font-mono text-xs text-paper'}>{formatCompactNumber(drill.moneyCost)} M</Text>
                <Text className={drill.selected ? 'mt-1 font-mono text-xs font-bold text-ink' : 'mt-1 font-mono text-xs text-sky'}>{drill.trainingPointCost} TP</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <PaperPanel kicker="Plan total" title="Ready for the whistle?" className="mt-5">
        <View className="flex-row gap-2">
          <Metric label="Players" value={String(viewModel.assignedPlayerIds.length)} />
          <Metric label="Money cost" value={formatCompactNumber(viewModel.totalMoneyCost)} tone="negative" />
          <Metric label="TP cost" value={formatCompactNumber(viewModel.totalTrainingPointCost)} tone="negative" />
        </View>
        <View className="mt-3">
          <ActionButton
            label="Lock weekly plan"
            accessibilityLabel="Apply the selected weekly training plan"
            onPress={onApplyTraining}
            disabled={!viewModel.canApply}
          />
        </View>
      </PaperPanel>
    </ScrollView>
  );
}
