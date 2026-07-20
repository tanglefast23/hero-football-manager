import { ScrollView, Text, View } from 'react-native';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type {
  M2DivisionLevelViewModel,
  M2LeagueViewModel,
} from '../m2-league-models';
import { Metric, PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';

export interface M2LeagueScreenProps {
  viewModel: M2LeagueViewModel;
  onSelectDivision: (division: M2DivisionLevelViewModel) => void;
  onSelectCupSeason?: (season: number) => void;
  onOpenCupFixture?: (fixtureId: string) => void;
}

export function M2LeagueScreen({
  viewModel,
  onSelectDivision,
  onSelectCupSeason,
  onOpenCupFixture,
}: M2LeagueScreenProps) {
  const summary = viewModel.selectedDivisionSummary;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Competition office</Text>
          <Text className="mt-1 font-pixel text-xl uppercase text-ink">{viewModel.title}</Text>
        </View>
        <View className="items-end gap-1">
          <StatusChip label={viewModel.userDivisionBadge} tone="hero" />
          <Text className="font-mono text-sm text-ink/50">{viewModel.seasonLabel}</Text>
        </View>
      </View>

      <View className="mt-5">
        <SectionLabel eyebrow="The national ladder" title="Five divisions" />
        <View className="flex-row gap-1">
          {viewModel.divisions.map(division => (
            <Pressable
              key={division.level}
              accessibilityRole="button"
              accessibilityLabel={`${division.label}, average strength ${division.averageStrength}${division.userDivision ? ', your division' : ''}`}
              accessibilityState={{ selected: division.selected }}
              onPress={() => onSelectDivision(division.level)}
              className={division.selected
                ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-gold px-1 py-2'
                : division.userDivision
                  ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                  : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1 py-2'}
            >
              <Text className="font-pixel text-sm uppercase text-ink">{division.shortLabel}</Text>
              <Text className="mt-1 font-mono text-sm text-ink/60">{division.averageStrength}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PaperPanel
        kicker={summary.userDivision ? 'Your division' : 'League scout report'}
        title={summary.label}
        stamp={summary.userDivision ? 'ACTIVE' : `AVG ${summary.averageStrength}`}
        className="mt-4"
      >
        <View className="flex-row gap-2">
          <Metric label="Clubs" value={String(summary.clubCount)} />
          <Metric label="Average" value={String(summary.averageStrength)} />
          <Metric label="Strength band" value={summary.strengthRangeLabel} />
        </View>
        <Text className="mt-3 text-sm leading-5 text-ink/60">
          {summary.userDivision
            ? 'Your live results are filed below. Promotion and relegation move whole clubs without rewriting their squads.'
            : `This is the season-level scouting view. Your live fixtures remain in ${viewModel.activeTable.divisionLabel}.`}
        </Text>
      </PaperPanel>

      <View className="mt-6">
        <SectionLabel
          eyebrow={viewModel.activeTable.divisionLabel}
          title="Your live table"
          right={<StatusChip label={viewModel.activeTable.rulesLabel} tone="success" />}
        />
        <View
          accessible
          accessibilityLabel={`${viewModel.activeTable.divisionLabel} live standings after ${viewModel.activeTable.matchesPlayed} matches`}
          className="border-2 border-b-4 border-ink bg-white"
        >
          <View className="flex-row border-b border-ink/20 px-2 py-2">
            <Text className="w-7 text-sm font-bold text-ink/50">#</Text>
            <Text className="flex-1 text-sm font-bold uppercase text-ink/50">Club</Text>
            <Text className="w-7 text-right font-mono text-sm font-bold text-ink/50">P</Text>
            <Text className="w-9 text-right font-mono text-sm font-bold text-ink/50">GD</Text>
            <Text className="w-9 text-right font-mono text-sm font-bold text-ink/50">PTS</Text>
          </View>
          {viewModel.activeTable.rows.map(row => {
            const rowClass = row.isUserClub
              ? 'bg-gold'
              : row.movement === 'PROMOTION'
                ? 'bg-pitch-light'
                : row.movement === 'RELEGATION'
                  ? 'bg-red-light/40'
                  : '';
            return (
              <View
                key={row.clubId}
                accessible
                accessibilityLabel={`${row.position}. ${row.clubName}. Played ${row.played}, goal difference ${row.goalDifference}, ${row.points} points.`}
                className={`min-h-11 flex-row items-center border-b border-ink/10 px-2 py-2 ${rowClass}`}
              >
                <Text className="w-7 font-mono text-base font-bold text-ink">{row.position}</Text>
                <View className="flex-1 flex-row items-center pr-1">
                  <Text className={row.isUserClub ? 'flex-1 text-base font-bold text-ink' : 'flex-1 text-base text-ink'} numberOfLines={1}>
                    {row.clubName}
                  </Text>
                  {row.movement !== 'NONE' ? (
                    <Text className={row.movement === 'PROMOTION' ? 'text-sm font-bold text-pitch-dark' : 'text-sm font-bold text-stamp'}>
                      {row.movement === 'PROMOTION' ? '↑' : '↓'}
                    </Text>
                  ) : null}
                </View>
                <Text className="w-7 text-right font-mono text-sm text-ink/65">{row.played}</Text>
                <Text className="w-9 text-right font-mono text-sm text-ink/65">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                <Text className="w-9 text-right font-mono text-base font-bold text-ink">{row.points}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="mt-7">
        <SectionLabel
          eyebrow="All 50 clubs"
          title="National Cup"
          right={<StatusChip label={viewModel.cup.statusLabel} tone={viewModel.cup.championName ? 'hero' : 'normal'} />}
        />

        {viewModel.cup.seasonOptions.length > 1 ? (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {viewModel.cup.seasonOptions.map(option => (
              <Pressable
                key={option.season}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} National Cup${option.championName ? `, won by ${option.championName}` : ''}`}
                accessibilityState={{ selected: option.selected, disabled: onSelectCupSeason === undefined }}
                disabled={onSelectCupSeason === undefined}
                onPress={() => onSelectCupSeason?.(option.season)}
                className={option.selected
                  ? 'min-h-11 min-w-14 items-center justify-center border-2 border-b-4 border-ink bg-gold px-3'
                  : 'min-h-11 min-w-14 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-3'}
              >
                <Text className="font-mono text-sm font-bold uppercase text-ink">{option.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!viewModel.cup.available ? (
          <PaperPanel kicker={viewModel.cup.seasonLabel} title={viewModel.cup.currentRoundLabel} stamp="PENDING">
            <Text className="text-sm leading-5 text-ink/60">
              The competition office will draw 50 clubs into a play-in, then a clean 32-club bracket.
            </Text>
          </PaperPanel>
        ) : (
          <>
            <PaperPanel
              kicker={viewModel.cup.seasonLabel}
              title={viewModel.cup.championName ?? viewModel.cup.currentRoundLabel}
              stamp={viewModel.cup.championName ? 'CHAMPION' : 'LIVE'}
            >
              {viewModel.cup.championName ? (
                <Text className="mb-3 text-base font-bold text-gold-dark">
                  {viewModel.cup.championName} lifted the National Cup.
                </Text>
              ) : null}
              <View className="gap-2">
                {viewModel.cup.currentRoundFixtures.map(fixture => (
                  <Pressable
                    key={fixture.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${fixture.homeClubName} ${fixture.scoreLabel} ${fixture.awayClubName}`}
                    accessibilityState={{ disabled: onOpenCupFixture === undefined || !fixture.playableNow }}
                    disabled={onOpenCupFixture === undefined || !fixture.playableNow}
                    onPress={() => onOpenCupFixture?.(fixture.id)}
                    className={fixture.playableNow
                      ? 'min-h-14 flex-row items-center border-2 border-b-4 border-ink bg-gold px-3 py-2'
                      : fixture.involvesUserClub
                        ? 'min-h-14 flex-row items-center border-2 border-b-4 border-ink bg-gold/50 px-3 py-2'
                      : 'min-h-14 flex-row items-center border-2 border-b-4 border-ink bg-paper px-3 py-2'}
                  >
                    <Text className={fixture.winnerName === fixture.homeClubName ? 'flex-1 text-base font-bold text-ink' : 'flex-1 text-base text-ink'} numberOfLines={1}>
                      {fixture.homeClubName}
                    </Text>
                    <View className="mx-2 min-w-12 border-2 border-ink bg-white px-2 py-1">
                      <Text className="text-center font-mono text-sm font-bold text-ink">{fixture.scoreLabel}</Text>
                    </View>
                    <Text className={fixture.winnerName === fixture.awayClubName ? 'flex-1 text-right text-base font-bold text-ink' : 'flex-1 text-right text-base text-ink'} numberOfLines={1}>
                      {fixture.awayClubName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </PaperPanel>

            <View className="mt-5">
              <SectionLabel eyebrow="Cup archive" title="Round history" />
              <View className="border-2 border-b-4 border-ink bg-white">
                {viewModel.cup.history.map(round => (
                  <View key={round.round} className="min-h-12 flex-row items-center border-b border-ink/10 px-3 py-2">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-ink">{round.label}</Text>
                      <Text className="mt-1 font-mono text-sm text-ink/50">{round.completedCount}/{round.matchCount} ties filed</Text>
                    </View>
                    {round.userOutcome ? <StatusChip label={round.userOutcome} tone={round.userOutcome === 'Eliminated' ? 'danger' : 'success'} /> : null}
                    {!round.userOutcome ? <Text className="font-mono text-sm font-bold uppercase text-ink/50">{round.statusLabel}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
