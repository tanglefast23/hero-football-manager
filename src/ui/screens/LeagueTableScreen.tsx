import { ScrollView, Text, View } from 'react-native';
import { Metric, PaperPanel, StatusChip } from '../components/Scorecard';
import { StageSection } from '../components/ChalkboardStage';
import { LeagueFixtureRow } from '../components/LeagueFixtureRow';
import type { LeagueTableViewModel } from '../models';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';

export interface LeagueTableScreenProps {
  viewModel: LeagueTableViewModel;
}

export function LeagueTableScreen({ viewModel }: LeagueTableScreenProps) {
  const pointsFromTop = viewModel.leaderPoints - viewModel.userPoints;
  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
    {
      key: 'standing',
      weight: 5,
      node: (
        <PaperPanel kicker="Current standing" title={`Position ${viewModel.userPosition}`} stamp="Live">
          <View className="flex-row gap-2">
            <Metric label="Points" value={String(viewModel.userPoints)} />
            <Metric label="From top" value={pointsFromTop === 0 ? 'Leader' : `${pointsFromTop} pts`} />
            <Metric label="Matches played" value={`${viewModel.matchesPlayed}/${viewModel.matchesTotal}`} />
          </View>
          <Text className="mt-3 text-sm leading-4 text-ink/55">
            Calculated from played fixtures only. Ties sort by goal difference, goals scored, then the league tiebreaker.
          </Text>
        </PaperPanel>
      ),
    },
    {
      key: 'table',
      weight: 2 + viewModel.rows.length,
      node: (
        <View>
          <StageSection
            eyebrow="Promotion race"
            title="Full league table"
            right={<StatusChip label="Top 2 go up" tone="success" />}
          />
          <View
            accessible
            accessibilityLabel={`${viewModel.divisionLabel} standings after ${viewModel.matchesPlayed} matches`}
            className="border-2 border-ink bg-white"
          >
            <View className="flex-row border-b border-ink/20 px-2 py-2">
              <Text className="w-7 text-sm font-bold text-ink/50">#</Text>
              <Text className="flex-1 text-sm font-bold uppercase text-ink/50">Club</Text>
              <Text className="w-7 text-right font-mono text-sm font-bold text-ink/50">P</Text>
              <Text className="w-7 text-right font-mono text-sm font-bold text-ink/50">W</Text>
              <Text className="w-7 text-right font-mono text-sm font-bold text-ink/50">D</Text>
              <Text className="w-7 text-right font-mono text-sm font-bold text-ink/50">L</Text>
              <Text className="w-9 text-right font-mono text-sm font-bold text-ink/50">GD</Text>
              <Text className="w-9 text-right font-mono text-sm font-bold text-ink/50">PTS</Text>
            </View>
            {viewModel.rows.map(row => {
              const rowClass = row.isUserClub
                ? 'bg-violet-light'
                : row.inPromotionPlaces
                  ? 'bg-pitch-light'
                  : '';
              const primaryText = row.isUserClub ? 'text-ink' : 'text-ink';
              const secondaryText = row.isUserClub ? 'text-ink/70' : 'text-ink/65';
              return (
                <View
                  key={row.clubId}
                  accessible
                  accessibilityLabel={`${row.position}. ${row.clubName}. Played ${row.played}, won ${row.won}, drawn ${row.drawn}, lost ${row.lost}, goal difference ${row.goalDifference}, ${row.points} points.`}
                  className={`min-h-11 flex-row items-center border-b border-ink/10 px-2 py-2 ${rowClass}`}
                >
                  <Text className={`w-7 font-mono text-base font-bold ${primaryText}`}>{row.position}</Text>
                  <View className="flex-1 flex-row items-center pr-1">
                    <Text className={`flex-1 text-base ${row.isUserClub ? 'font-bold' : ''} ${primaryText}`} numberOfLines={1}>{row.clubName}</Text>
                    {row.inPromotionPlaces ? (
                      <Text className={row.isUserClub ? 'text-sm font-bold text-ink' : 'text-sm font-bold text-pitch-dark'}>↑</Text>
                    ) : null}
                  </View>
                  <Text className={`w-7 text-right font-mono text-sm ${secondaryText}`}>{row.played}</Text>
                  <Text className={`w-7 text-right font-mono text-sm ${secondaryText}`}>{row.won}</Text>
                  <Text className={`w-7 text-right font-mono text-sm ${secondaryText}`}>{row.drawn}</Text>
                  <Text className={`w-7 text-right font-mono text-sm ${secondaryText}`}>{row.lost}</Text>
                  <Text className={`w-9 text-right font-mono text-sm ${secondaryText}`}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text className={`w-9 text-right font-mono text-base font-bold ${primaryText}`}>{row.points}</Text>
                </View>
              );
            })}
          </View>
          <View className="mt-4 flex-row items-center gap-4 border-2 border-ink bg-white px-3 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 bg-violet" />
              <Text className="text-sm text-ink/60">Your club</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 bg-pitch-light" />
              <Text className="text-sm text-ink/60">Promotion place</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      key: 'fixtures',
      weight: 2 + Math.min(viewModel.leagueFixtures.length, 10),
      node: (
        <View>
          <StageSection
            eyebrow={viewModel.divisionLabel}
            title="Fixtures & results"
            right={<StatusChip label={`${viewModel.leagueFixtures.length} matches`} />}
          />
          {viewModel.leagueFixtures.length === 0 ? (
            <PaperPanel title="Schedule pending" kicker={viewModel.seasonLabel}>
              <Text className="text-sm leading-5 text-ink/60">
                Your league schedule will appear here when the competition office publishes it.
              </Text>
            </PaperPanel>
          ) : (
            <View className="gap-2">
              {viewModel.leagueFixtures.map(fixture => (
                <LeagueFixtureRow key={fixture.id} fixture={fixture} />
              ))}
            </View>
          )}
        </View>
      ),
    },
  ];

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <SectionFlow
        mode={layoutMode}
        header={
          <View className="mb-5 flex-row items-end justify-between">
            <View>
              <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Competition office</Text>
              <Text className="mt-1 font-pixel text-xl uppercase text-white">{viewModel.divisionLabel}</Text>
            </View>
            <View className="items-end gap-1">
              <StatusChip label={viewModel.seasonLabel} />
              <Text className="font-mono text-sm text-paper/70">{viewModel.weekLabel}</Text>
            </View>
          </View>
        }
        sections={sections}
      />
    </ScrollView>
  );
}
