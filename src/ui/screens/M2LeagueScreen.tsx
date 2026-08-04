import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoTip } from '../components/InfoTip';
import {
  HEADER_MAX_FONT_MULTIPLIER,
  LEAGUE_COLUMN_WIDTH,
  type LeagueColumn,
} from '../league-table-columns';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type {
  M2CupFixtureViewModel,
  M2CupRoundViewModel,
  M2DivisionLevelViewModel,
  M2LeagueSubTab,
  M2LeagueViewModel,
} from '../m2-league-models';
import { Metric, PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
import { LeagueFixtureRow } from '../components/LeagueFixtureRow';
import {
  DivisionLeaderBoard,
  resolveSubTab,
  subTabLabel,
  visibleSubTabs,
} from '../components/DivisionLeaderBoard';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { ScreenTabs } from '../components/ScreenTabs';
import { useGuideAnchor } from '../use-guide-anchor';
import type { TutorialAnchorLayout } from '../tutorial-cue-position';
import { CupBracket } from '../components/CupBracket';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';

/**
 * What each abbreviated column means, in one sentence, reachable by tapping the
 * header itself. The table already carried a legend underneath — "P played · GD
 * goal difference · Pts points" — and it did not reach the reader who asked
 * what GD stood for: grey, small, and printed after the thing it explains.
 */
const LEAGUE_COLUMN_EXPLAINER: Readonly<Record<LeagueColumn, string>> = {
  position: 'Where the club sits in the division right now.',
  played: 'League matches played so far this season.',
  goalDifference: 'Goals scored minus goals conceded. It separates clubs level on points.',
  points: 'Three for a win, one for a draw. The top two are promoted.',
};

const LEAGUE_TABLE_HEADERS: readonly {
  column: Exclude<LeagueColumn, 'position'>;
  label: string;
  name: string;
}[] = [
  { column: 'played', label: 'P', name: 'Played' },
  { column: 'goalDifference', label: 'GD', name: 'Goal difference' },
  { column: 'points', label: 'PTS', name: 'Points' },
];

/**
 * Points, not Tailwind widths. `w-9` is 2.25rem and a rem is React Native's
 * 14pt, so it was 31.5pt and not the 36 its name implies — which is how "PTS"
 * came to wrap to "PT" over a lone "S". See league-table-columns.ts.
 */
const leagueColumns = StyleSheet.create({
  position: { width: LEAGUE_COLUMN_WIDTH.position, flexShrink: 0 },
  played: { width: LEAGUE_COLUMN_WIDTH.played, flexShrink: 0 },
  goalDifference: { width: LEAGUE_COLUMN_WIDTH.goalDifference, flexShrink: 0 },
  points: { width: LEAGUE_COLUMN_WIDTH.points, flexShrink: 0 },
});
import { useDesktopContentStyle } from '../layout/DesktopClamp';

export interface M2LeagueScreenProps {
  viewModel: M2LeagueViewModel;
  onSelectDivision: (division: M2DivisionLevelViewModel) => void;
  onSelectCupSeason?: (season: number) => void;
  onOpenCupFixture?: (fixtureId: string) => void;
  /** The board the inbox is sending the manager to, while that guide is live. */
  guideSubTab?: M2LeagueSubTab;
  /**
   * Reports where the guided sub-tab sits so the briefing can lift its scrim
   * off it. Bert talks about the Leaders board; without this the tab he means
   * sat under the same dimming as everything else he was not talking about.
   */
  onGuideSubTabAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
}

export function M2LeagueScreen({
  viewModel,
  onSelectDivision,
  onSelectCupSeason,
  onOpenCupFixture,
  guideSubTab,
  onGuideSubTabAnchorChange,
}: M2LeagueScreenProps) {
  const desktopContent = useDesktopContentStyle();
  const summary = viewModel.selectedDivisionSummary;
  const layoutMode = useLayoutMode();
  const [selectedSubTab, setSelectedSubTab] = useState<M2LeagueSubTab>('league');

  /**
   * The guide *selects* the tab rather than pinning it. Pinning would leave the
   * strip inert until the concierge focus cleared, which reads as a broken tab.
   */
  useEffect(() => {
    if (guideSubTab === undefined) return;
    setSelectedSubTab(guideSubTab);
  }, [guideSubTab]);

  const subTabs = visibleSubTabs(viewModel.availableTabs);
  const activeSubTab = resolveSubTab(viewModel.availableTabs, selectedSubTab);
  const guidedCup = guideSubTab === 'cup';
  const guidedSubTabAnchor = useGuideAnchor(
    guideSubTab !== undefined,
    onGuideSubTabAnchorChange,
  );

  const leagueSections: FlowSection[] = [
    {
      key: 'ladder',
      weight: 13,
      node: (
        <View>
          <SectionLabel eyebrow="The national ladder" title="Five divisions" />
          <View className="flex-row gap-1">
            {viewModel.divisions.map(division => (
              <Pressable
                key={division.level}
                accessibilityRole="button"
                accessibilityLabel={`${division.label}, average club strength ${division.averageStrength}${division.userDivision ? ', your division' : ''}`}
                accessibilityState={{ selected: division.selected }}
                onPress={() => onSelectDivision(division.level)}
                className={division.selected
                  ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                  : division.userDivision
                    ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                    : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1 py-2'}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.82 : 1,
                  transform: [{ translateY: pressed ? 2 : 0 }],
                })}
              >
                <Text className="font-pixel text-sm uppercase text-ink">{division.shortLabel}</Text>
                <Text className="mt-1 font-mono text-xs text-ink/60">AVG {division.averageStrength}</Text>
              </Pressable>
            ))}
          </View>

          <PaperPanel
            kicker={summary.userDivision ? 'Your division' : 'Division preview'}
            title={summary.label}
            stamp={summary.userDivision ? 'ACTIVE' : `AVG ${summary.averageStrength}`}
            className="mt-4"
          >
            <View className="flex-row gap-2">
              <Metric label="Clubs" value={String(summary.clubCount)} />
              <Metric label="Average club strength" value={String(summary.averageStrength)} />
              <Metric label="Club strength range" value={summary.strengthRangeLabel} />
            </View>
            <View className="mt-2 flex-row gap-2">
              <Metric label="Your squad strength" value={String(summary.userSquadStrength)} />
              <Metric
                label="Comparison"
                value={summary.comparisonLabel}
                tone={summary.comparisonTone === 'below' ? 'negative' : 'positive'}
              />
            </View>
            <Text className="mt-3 text-sm leading-5 text-ink/60">
              {summary.userDivision
                ? 'You currently play here. Finish in the top two to earn promotion.'
                : `Preview only. Your fixtures and table remain in ${viewModel.activeTable.divisionLabel}.`}
            </Text>
            <Text className="mt-2 text-xs leading-4 text-ink/50">
              Squad strength uses player attributes only. Form, condition, tactics, coaches, and hero powers can still change results.
            </Text>
          </PaperPanel>
        </View>
      ),
    },
    {
      key: 'standings',
      weight: 2 + viewModel.activeTable.rows.length,
      node: (
        <View>
          <SectionLabel
            eyebrow={viewModel.activeTable.divisionLabel}
            title="Current standings"
            right={<StatusChip label={viewModel.activeTable.rulesLabel} tone="success" />}
          />
          <View
            accessible
            accessibilityLabel={`${viewModel.activeTable.divisionLabel} live standings after ${viewModel.activeTable.matchesPlayed} matches`}
            className="border-2 border-b-4 border-ink bg-white"
          >
            {/* Every abbreviation here is tappable, because the legend under
                the table did not reach the reader who asked what GD meant —
                grey, small, and after the thing it explains. The register
                answers the same question at the header itself. */}
            <View className="flex-row border-b border-ink/20 px-2 py-2">
              <Text style={leagueColumns.position} className="font-mono text-sm text-ink/50">#</Text>
              <PixelText className="flex-1 text-sm uppercase text-ink/50">Club</PixelText>
              {LEAGUE_TABLE_HEADERS.map(header => (
                <InfoTip
                  key={header.label}
                  text={LEAGUE_COLUMN_EXPLAINER[header.column]}
                  align="right"
                  style={leagueColumns[header.column]}
                  accessibilityLabel={`${header.name}. ${LEAGUE_COLUMN_EXPLAINER[header.column]}`}
                >
                  <Text
                    className="w-full text-right font-mono text-sm text-ink/50"
                    maxFontSizeMultiplier={HEADER_MAX_FONT_MULTIPLIER}
                    numberOfLines={1}
                  >
                    {header.label}
                  </Text>
                </InfoTip>
              ))}
            </View>
            {viewModel.activeTable.rows.map(row => {
              const rowClass = row.isUserClub
                ? 'bg-blue-light'
                : row.movement === 'PROMOTION'
                  ? 'bg-pitch-light'
                  : row.movement === 'RELEGATION'
                    ? 'bg-red-light/40'
                    : '';
              return (
                <View
                  key={row.clubId}
                  accessible
                  accessibilityLabel={`${row.position}. ${row.clubName}.${row.isUserClub ? ' Your club.' : ''} Played ${row.played}, goal difference ${row.goalDifference}, ${row.points} points.${row.movement === 'PROMOTION' ? ' Promotion place.' : row.movement === 'RELEGATION' ? ' Relegation place.' : ''}`}
                  className={`min-h-11 flex-row items-center border-b border-ink/10 px-2 py-2 ${rowClass}`}
                >
                  <Text style={leagueColumns.position} className="font-mono text-base text-ink" numberOfLines={1}>{row.position}</Text>
                  <View className="flex-1 flex-row items-center pr-1">
                    <Text className={row.isUserClub ? 'flex-1 text-base font-bold text-ink' : 'flex-1 text-base text-ink'} numberOfLines={1}>
                      {row.clubName}
                    </Text>
                    {row.isUserClub ? (
                      <Text className="mr-1 font-pixel text-sm uppercase text-blue-dark">YOU</Text>
                    ) : null}
                    {row.movement !== 'NONE' ? (
                      <Text className={row.movement === 'PROMOTION' ? 'text-sm font-bold text-pitch-dark' : 'text-sm font-bold text-stamp'}>
                        {row.movement === 'PROMOTION' ? '↑' : '↓'}
                      </Text>
                    ) : null}
                  </View>
                  {/* numberOfLines guards the columns the arithmetic sizes: an
                      overflow clips rather than reflowing the row, which is how
                      "+10" came to render as "+1" over "0". */}
                  <Text style={leagueColumns.played} className="text-right font-mono text-sm text-ink/65" numberOfLines={1}>{row.played}</Text>
                  <Text style={leagueColumns.goalDifference} className="text-right font-mono text-sm text-ink/65" numberOfLines={1}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text style={leagueColumns.points} className="text-right font-mono text-base text-ink" numberOfLines={1}>{row.points}</Text>
                </View>
              );
            })}
          </View>
          <Text className="mt-2 text-xs text-ink/50">P played · GD goal difference · Pts points</Text>
        </View>
      ),
    },
    {
      key: 'fixtures',
      weight: 2 + Math.min(viewModel.leagueFixtures.length, 10),
      node: (
        <View>
          <SectionLabel
            eyebrow={viewModel.activeTable.divisionLabel}
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

  const cupSections: FlowSection[] = [
    {
      key: 'cup',
      weight: viewModel.cup.rounds.length > 0 ? 6 + 2 * viewModel.cup.rounds.length : 5,
      node: (
        <View
          className={guidedCup ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}
        >
          <SectionLabel
            eyebrow="All 50 clubs"
            title="Hero Cup"
            right={<StatusChip label={viewModel.cup.statusLabel} tone={viewModel.cup.championName ? 'hero' : 'normal'} />}
          />

          {viewModel.cup.seasonOptions.length > 1 ? (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {viewModel.cup.seasonOptions.map(option => (
                <Pressable
                  key={option.season}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} Hero Cup${option.championName ? `, won by ${option.championName}` : ''}`}
                  accessibilityState={{ selected: option.selected, disabled: onSelectCupSeason === undefined }}
                  disabled={onSelectCupSeason === undefined}
                  onPress={() => onSelectCupSeason?.(option.season)}
                  className={option.selected
                    ? 'min-h-11 min-w-14 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-3'
                    : 'min-h-11 min-w-14 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-3'}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ translateY: pressed ? 2 : 0 }],
                  })}
                >
                  <Text className="font-pixel text-sm uppercase text-ink">{option.label}</Text>
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
              {viewModel.cup.championName ? (
                <View className="mb-4 border-2 border-b-4 border-gold-dark bg-gold-light p-4">
                  <Text className="font-pixel text-sm uppercase text-gold-dark">Cup champions</Text>
                  <Text className="mt-1 font-pixel text-xl uppercase text-ink">
                    {viewModel.cup.championName}
                  </Text>
                  <Text className="mt-2 text-sm leading-5 text-ink/65">
                    Their road to the trophy is recorded round by round below.
                  </Text>
                </View>
              ) : (
                <View className="mb-4 border-2 border-b-4 border-blue-dark bg-blue-light p-3">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">Current desk</Text>
                  <Text className="mt-1 text-base font-bold text-ink">{viewModel.cup.currentRoundLabel}</Text>
                </View>
              )}

              <SectionLabel eyebrow={viewModel.cup.seasonLabel} title="Road to the final" />
              {/* The bracket carries the shape of the road; the round cards
                  below it stay for the play-in and for tapping into a tie the
                  manager can actually play. */}
              <View
                accessible
                accessibilityLabel={`${viewModel.cup.seasonLabel} Hero Cup bracket`}
                className="mb-4 border-2 border-ink bg-white p-2"
              >
                <CupBracket rounds={viewModel.cup.rounds} championName={viewModel.cup.championName} />
              </View>
              <View className="gap-4">
                {viewModel.cup.rounds
                  .filter(round => round.active || round.fixtures.some(fixture => fixture.playableNow))
                  .map(round => (
                    <CupRoundCard
                      key={round.round}
                      round={round}
                      onOpenCupFixture={onOpenCupFixture}
                    />
                  ))}
              </View>
            </>
          )}
        </View>
      ),
    },
  ];

  const leadersSections: FlowSection[] = viewModel.leaders.boards.map(board => ({
    key: `leaders-${board.categoryId}`,
    weight: 3 + board.entries.length,
    node: <DivisionLeaderBoard board={board} />,
  }));

  const sections = activeSubTab === 'cup'
    ? cupSections
    : activeSubTab === 'leaders'
      ? leadersSections
      : leagueSections;

  return (
    <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 32 }, desktopContent]}>
      <SectionFlow
        mode={layoutMode}
        header={
          <View className="mb-5">
            <View className="flex-row items-end justify-between gap-3">
              <View className="flex-1">
                <Text className="font-pixel text-sm uppercase text-blue-dark">Competition office</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink">{viewModel.title}</Text>
              </View>
              <View className="items-end gap-1">
                <StatusChip label={viewModel.userDivisionBadge} />
                <Text className="font-mono text-sm text-ink/50">{viewModel.seasonLabel}</Text>
              </View>
            </View>
            <ScreenTabs
              tabs={subTabs.map(tab => ({ id: tab, label: subTabLabel(tab) }))}
              activeId={activeSubTab}
              onSelect={setSelectedSubTab}
              anchor={guideSubTab === undefined ? undefined : {
                id: guideSubTab,
                ref: guidedSubTabAnchor.anchorRef,
                onLayout: guidedSubTabAnchor.scheduleMeasurement,
              }}
            />
          </View>
        }
        sections={sections}
      />
    </ScrollView>
  );
}

function CupRoundCard({
  round,
  onOpenCupFixture,
}: {
  round: M2CupRoundViewModel;
  onOpenCupFixture?: (fixtureId: string) => void;
}) {
  const complete = round.completedCount === round.matchCount;
  const outcomeTone = round.userOutcome === 'Eliminated'
    ? 'danger' as const
    : round.userOutcome === 'Champion'
      ? 'hero' as const
      : 'success' as const;
  const railClass = !round.drawn ? 'bg-grey-light' : complete ? 'bg-grey' : 'bg-blue';

  return (
    <View className="relative pl-4">
      <View className={`absolute bottom-0 left-0 top-0 w-1 ${railClass}`} />
      <View className={!round.drawn
        ? 'border-2 border-b-4 border-ink/30 bg-white p-3'
        : round.active
          ? 'border-2 border-b-4 border-blue-dark bg-blue-light p-3'
          : 'border-2 border-b-4 border-ink bg-paper p-3'}
      >
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text className="font-pixel text-sm uppercase text-blue-dark">Round {round.round}</Text>
            <Text className="mt-1 font-pixel text-lg uppercase text-ink">{round.label}</Text>
            <Text className="mt-1 font-mono text-sm text-ink/50">
              {round.completedCount}/{round.matchCount} matches complete
            </Text>
          </View>
          {round.userOutcome ? <StatusChip label={round.userOutcome} tone={outcomeTone} /> : <StatusChip label={round.statusLabel} />}
        </View>

        {round.byes.length > 0 ? (
          <View className="mb-3 border-2 border-dashed border-ink/30 bg-white p-2">
            <Text className="font-pixel text-sm uppercase text-ink/50">
              Through with a bye · {round.byes.length}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-1">
              {round.byes.map(bye => (
                <View
                  key={bye.clubName}
                  className={bye.involvesUserClub
                    ? 'border border-blue-dark bg-blue-light px-2 py-1'
                    : 'border border-ink/20 bg-paper px-2 py-1'}
                >
                  <Text className={bye.involvesUserClub ? 'text-sm font-bold text-ink' : 'text-sm text-ink/60'}>
                    {bye.clubName}{bye.involvesUserClub ? ' · YOU' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!round.drawn ? (
          <View className="border-2 border-dashed border-ink/20 bg-paper px-3 py-3">
            <Text className="text-sm leading-5 text-ink/50">
              {round.matchCount} {round.matchCount === 1 ? 'tie' : 'ties'} · opponents confirmed after the previous round
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {round.fixtures.map(fixture => (
              <CupTie
                key={fixture.id}
                fixture={fixture}
                onOpenCupFixture={onOpenCupFixture}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function CupTie({
  fixture,
  onOpenCupFixture,
}: {
  fixture: M2CupFixtureViewModel;
  onOpenCupFixture?: (fixtureId: string) => void;
}) {
  const disabled = onOpenCupFixture === undefined || !fixture.playableNow;
  return (
    <Pressable
      accessibilityRole={fixture.playableNow ? 'button' : 'text'}
      accessibilityLabel={`${fixture.homeClubName} ${fixture.scoreLabel} ${fixture.awayClubName}${fixture.winnerName ? `, ${fixture.winnerName} advanced` : ''}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onOpenCupFixture?.(fixture.id)}
      className={fixture.playableNow
        ? 'min-h-14 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-2 py-2'
        : fixture.involvesUserClub
          ? 'min-h-14 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-2 py-2'
          : 'min-h-14 flex-row items-center border-2 border-b-4 border-ink/50 bg-white px-2 py-2'}
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      <Text
        className={fixture.winnerName === fixture.homeClubName ? 'flex-1 text-sm font-bold text-ink' : 'flex-1 text-sm text-ink'}
        numberOfLines={2}
      >
        {fixture.homeClubName}{fixture.winnerName === fixture.homeClubName ? '  ✓' : ''}
      </Text>
      <View className="mx-2 min-w-12 border-2 border-ink bg-paper px-2 py-1">
        <Text className="text-center font-mono text-sm text-ink">{fixture.scoreLabel}</Text>
      </View>
      <Text
        className={fixture.winnerName === fixture.awayClubName ? 'flex-1 text-right text-sm font-bold text-ink' : 'flex-1 text-right text-sm text-ink'}
        numberOfLines={2}
      >
        {fixture.winnerName === fixture.awayClubName ? '✓  ' : ''}{fixture.awayClubName}
      </Text>
    </Pressable>
  );
}
