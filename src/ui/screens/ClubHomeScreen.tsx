import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { ClubAlertViewModel, HomeViewModel } from '../models';

/** Full-card tint per alert tone — bible palette only, never off-palette Tailwind hues. */
function alertPalette(tone: ClubAlertViewModel['tone']): string {
  if (tone === 'urgent') return 'border-red-dark bg-red-light';
  if (tone === 'event') return 'border-violet-dark bg-violet-light';
  return 'border-blue-dark bg-blue-light';
}

export interface ClubHomeScreenProps {
  viewModel: HomeViewModel;
  onOpenFixture: (fixtureId: string) => void;
  onOpenAlert: (alertId: string) => void;
  onOpenLeague: () => void;
  onOpenFinances: () => void;
}

export function ClubHomeScreen({
  viewModel,
  onOpenFixture,
  onOpenAlert,
  onOpenLeague,
  onOpenFinances,
}: ClubHomeScreenProps) {
  const fixture = viewModel.nextFixture;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="font-mono text-xs font-bold uppercase tracking-[2px] text-sky">Good morning, boss</Text>
          <Text className="mt-1 text-lg font-bold uppercase tracking-wide text-paper">{viewModel.managerName}</Text>
        </View>
        <View className="items-end">
          <Text className="text-xs uppercase tracking-wide text-paper/50">Recent form</Text>
          <View className="mt-2 flex-row gap-1">
            {viewModel.form.map((result, index) => (
              <StatusChip
                key={`${result}-${index}`}
                label={result}
                tone={result === 'W' ? 'success' : result === 'L' ? 'danger' : 'normal'}
              />
            ))}
          </View>
        </View>
      </View>

      {/* pixel divider */}
      <View className="my-5 h-0.5 bg-paper/15" />

      <PaperPanel kicker="Next assignment" title={fixture.competition} stamp={fixture.weekLabel}>
        <View className="border-y-2 border-ink py-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-right text-lg font-bold uppercase text-ink" numberOfLines={2}>
              {fixture.homeTeam}
            </Text>
            <View className="border-2 border-ink bg-ink px-3 py-2">
              <Text className="font-mono text-sm font-bold text-paper">VS</Text>
            </View>
            <Text className="flex-1 text-lg font-bold uppercase text-ink" numberOfLines={2}>
              {fixture.awayTeam}
            </Text>
          </View>
          <View className="mt-3 flex-row justify-center gap-2">
            <StatusChip label={fixture.venueLabel} />
            <StatusChip
              label={`${fixture.opponentHeroCount} rival hero${fixture.opponentHeroCount === 1 ? '' : 'es'}`}
              tone="hero"
            />
          </View>
        </View>
        <View className="mt-4">
          <ActionButton
            label={fixture.matchdayReady ? 'Prepare match day  ▸' : 'Advance to fixture week'}
            accessibilityLabel={fixture.matchdayReady
              ? `Open match day for ${fixture.homeTeam} versus ${fixture.awayTeam}`
              : `Next fixture is ${fixture.homeTeam} versus ${fixture.awayTeam}. Advance to its match week to prepare.`}
            onPress={() => onOpenFixture(fixture.id)}
            disabled={!fixture.matchdayReady}
            variant="action"
          />
        </View>
      </PaperPanel>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Club pulse"
          title="Resources"
          right={<Text className="font-mono text-xs font-bold uppercase tracking-wide text-sky">Ledger ›</Text>}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open club finances"
          onPress={onOpenFinances}
          className="flex-row gap-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
        >
          <Metric label="Money" value={formatCompactNumber(viewModel.resources.money)} />
          <Metric label="TP" value={formatCompactNumber(viewModel.resources.trainingPoints)} />
          <Metric label="Essence" value={formatCompactNumber(viewModel.resources.heroEssence)} tone="hero" />
        </Pressable>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Inbox"
          title="Needs your call"
          right={<StatusChip label={`${viewModel.alerts.length} open`} tone={viewModel.alerts.length ? 'danger' : 'normal'} />}
        />
        <View className="gap-2">
          {viewModel.alerts.length === 0 ? (
            <View className="border-2 border-b-4 border-paper/20 bg-ink-soft p-4">
              <Text className="text-sm text-paper/60">Desk clear. The board is suspiciously quiet.</Text>
            </View>
          ) : viewModel.alerts.map(alert => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}. ${alert.detail}`}
              onPress={() => onOpenAlert(alert.id)}
              className={`min-h-14 flex-row items-center justify-between border-2 border-b-4 p-3 ${alertPalette(alert.tone)}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold uppercase text-ink">{alert.title}</Text>
                <Text className="mt-1 text-xs leading-4 text-ink/70" numberOfLines={2}>{alert.detail}</Text>
              </View>
              <Text className="font-mono text-lg font-bold text-ink">›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Division five"
          title="Table snapshot"
          right={<Text className="font-mono text-xs font-bold uppercase tracking-wide text-sky">Table ›</Text>}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full league table"
          onPress={onOpenLeague}
          className="border-2 border-b-4 border-paper/30 bg-ink-soft"
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
        >
          <View className="flex-row border-b-2 border-paper/20 px-3 py-2">
            <Text className="w-8 font-mono text-xs font-bold text-paper/50">#</Text>
            <Text className="flex-1 text-xs font-bold uppercase text-paper/50">Club</Text>
            <Text className="w-8 text-right font-mono text-xs font-bold text-paper/50">P</Text>
            <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">GD</Text>
            <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">PTS</Text>
          </View>
          {viewModel.table.map(row => {
            const isUser = row.clubName === viewModel.clubName;
            return (
              <View
                key={row.clubName}
                className={isUser ? 'flex-row bg-paper px-3 py-2' : 'flex-row px-3 py-2'}
              >
                <Text className={isUser ? 'w-8 font-mono text-sm font-bold text-ink' : 'w-8 font-mono text-sm text-paper'}>{row.position}</Text>
                <Text className={isUser ? 'flex-1 text-sm font-bold text-ink' : 'flex-1 text-sm text-paper'} numberOfLines={1}>{row.clubName}</Text>
                <Text className={isUser ? 'w-8 text-right font-mono text-sm font-bold text-ink' : 'w-8 text-right font-mono text-sm text-paper'}>{row.played}</Text>
                <Text className={isUser ? 'w-10 text-right font-mono text-sm font-bold text-ink' : 'w-10 text-right font-mono text-sm text-paper'}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                <Text className={isUser ? 'w-10 text-right font-mono text-sm font-bold text-ink' : 'w-10 text-right font-mono text-sm text-paper'}>{row.points}</Text>
              </View>
            );
          })}
        </Pressable>
      </View>
    </ScrollView>
  );
}
