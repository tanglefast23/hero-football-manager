import { Pressable, ScrollView, Text, View } from 'react-native';
import { Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type { ClubAlertViewModel, HomeViewModel } from '../models';

export interface ClubHomeScreenProps {
  viewModel: HomeViewModel;
  onOpenFixture: (fixtureId: string) => void;
  onOpenAlert: (alertId: string) => void;
  onOpenLeague: () => void;
  onOpenFinances: () => void;
}

function alertPalette(tone: ClubAlertViewModel['tone']): string {
  if (tone === 'urgent') return 'border-stamp bg-red-100';
  if (tone === 'event') return 'border-amber-500 bg-amber-100';
  return 'border-sky bg-sky';
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
      <View className="mb-5 flex-row items-end justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Good morning, boss</Text>
          <Text className="mt-1 text-lg font-bold uppercase text-paper">{viewModel.managerName}</Text>
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

      <PaperPanel kicker="Next assignment" title={fixture.competition} stamp={fixture.weekLabel}>
        <View className="border-y-2 border-ink py-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-right text-lg font-bold uppercase text-ink" numberOfLines={2}>
              {fixture.homeTeam}
            </Text>
            <View className="bg-ink px-3 py-2">
              <Text className="font-mono text-sm font-bold text-signal">VS</Text>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fixture.matchdayReady
            ? `Open match day for ${fixture.homeTeam} versus ${fixture.awayTeam}`
            : `Next fixture is ${fixture.homeTeam} versus ${fixture.awayTeam}. Advance to its match week to prepare.`}
          accessibilityState={{ disabled: !fixture.matchdayReady }}
          disabled={!fixture.matchdayReady}
          onPress={() => onOpenFixture(fixture.id)}
          className={fixture.matchdayReady
            ? 'mt-3 min-h-11 flex-row items-center justify-between bg-signal px-3 py-2'
            : 'mt-3 min-h-11 flex-row items-center justify-between border border-ink/20 bg-paper-dark px-3 py-2 opacity-60'}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
        >
          <Text className="text-sm font-bold uppercase tracking-widest text-ink">
            {fixture.matchdayReady ? 'Prepare match day' : 'Advance to fixture week'}
          </Text>
          <Text className="font-mono text-lg font-bold text-ink">{fixture.matchdayReady ? '▸' : '·'}</Text>
        </Pressable>
      </PaperPanel>

      <View className="mt-6">
        <SectionLabel eyebrow="Club pulse" title="Resources" />
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
            <View className="border border-paper/20 bg-ink-soft p-4">
              <Text className="text-sm text-paper/60">Desk clear. The board is suspiciously quiet.</Text>
            </View>
          ) : viewModel.alerts.map(alert => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}. ${alert.detail}`}
              onPress={() => onOpenAlert(alert.id)}
              className={`min-h-14 flex-row items-center justify-between border-2 p-3 ${alertPalette(alert.tone)}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold uppercase text-ink">{alert.title}</Text>
                <Text className="mt-1 text-xs leading-4 text-ink/60" numberOfLines={2}>{alert.detail}</Text>
              </View>
              <Text className="font-mono text-lg font-bold text-ink">›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-6">
        <SectionLabel eyebrow="Division five" title="Table snapshot" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full league table"
          onPress={onOpenLeague}
          className="border-2 border-paper/30 bg-ink-soft"
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
        >
          <View className="flex-row border-b border-paper/20 px-3 py-2">
            <Text className="w-8 text-xs font-bold text-paper/50">#</Text>
            <Text className="flex-1 text-xs font-bold uppercase text-paper/50">Club</Text>
            <Text className="w-8 text-right font-mono text-xs font-bold text-paper/50">P</Text>
            <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">GD</Text>
            <Text className="w-10 text-right font-mono text-xs font-bold text-paper/50">PTS</Text>
          </View>
          {viewModel.table.map(row => (
            <View
              key={row.clubName}
              className={row.clubName === viewModel.clubName ? 'flex-row bg-signal px-3 py-2' : 'flex-row px-3 py-2'}
            >
              <Text className={row.clubName === viewModel.clubName ? 'w-8 font-mono text-sm font-bold text-ink' : 'w-8 font-mono text-sm text-paper'}>{row.position}</Text>
              <Text className={row.clubName === viewModel.clubName ? 'flex-1 text-sm font-bold text-ink' : 'flex-1 text-sm text-paper'} numberOfLines={1}>{row.clubName}</Text>
              <Text className={row.clubName === viewModel.clubName ? 'w-8 text-right font-mono text-sm font-bold text-ink' : 'w-8 text-right font-mono text-sm text-paper'}>{row.played}</Text>
              <Text className={row.clubName === viewModel.clubName ? 'w-10 text-right font-mono text-sm font-bold text-ink' : 'w-10 text-right font-mono text-sm text-paper'}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
              <Text className={row.clubName === viewModel.clubName ? 'w-10 text-right font-mono text-sm font-bold text-ink' : 'w-10 text-right font-mono text-sm text-paper'}>{row.points}</Text>
            </View>
          ))}
        </Pressable>
      </View>
    </ScrollView>
  );
}
