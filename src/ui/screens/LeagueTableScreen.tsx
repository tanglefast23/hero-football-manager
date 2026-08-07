import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Metric, PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
import { LeagueTableRow } from '../components/LeagueTableRow';
import { takeLeagueRowShifts } from '../league-table-motion';
import { EmptyDocket } from '../components/EmptyDocket';
import { LeagueFixtureRow } from '../components/LeagueFixtureRow';
import type { LeagueTableViewModel } from '../models';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { InfoTip } from '../components/InfoTip';
import {
  HEADER_MAX_FONT_MULTIPLIER,
  LEAGUE_COLUMN_WIDTH,
  type LeagueColumn,
} from '../league-table-columns';

/** What each abbreviated column means, reachable by tapping the heading. */
const TABLE_COLUMN_EXPLAINER: Readonly<Record<LeagueColumn, string>> = {
  position: 'Where the club sits in the division right now.',
  played: 'League matches played so far this season.',
  won: 'Matches won. Three points each.',
  drawn: 'Matches drawn. One point each.',
  lost: 'Matches lost. No points.',
  goalDifference: 'Goals scored minus goals conceded. It separates clubs level on points.',
  points: 'Three for a win, one for a draw. The top two are promoted.',
};

const TABLE_HEADERS: readonly {
  column: Exclude<LeagueColumn, 'position'>;
  /**
   * The `col.*` key, not the label.
   *
   * These are layout tokens rather than prose: each one has to fit a fixed cell
   * whose width was measured from the font, so a locale DECLARES a short form
   * (Spanish "PJ", German "SP") instead of translating "Played" and hoping.
   * `gates.test.ts` measures every locale's forms against the columns.
   */
  key: string;
  name: string;
}[] = [
  { column: 'played', key: 'col.league.played', name: 'Played' },
  { column: 'won', key: 'col.league.won', name: 'Won' },
  { column: 'drawn', key: 'col.league.drawn', name: 'Drawn' },
  { column: 'lost', key: 'col.league.lost', name: 'Lost' },
  { column: 'goalDifference', key: 'col.league.goalDifference', name: 'Goal difference' },
  { column: 'points', key: 'col.league.points', name: 'Points' },
];

/** Points, not rem-based classes. See league-table-columns.ts. */
const tableColumns = StyleSheet.create({
  position: { width: LEAGUE_COLUMN_WIDTH.position, flexShrink: 0 },
  played: { width: LEAGUE_COLUMN_WIDTH.played, flexShrink: 0 },
  won: { width: LEAGUE_COLUMN_WIDTH.won, flexShrink: 0 },
  drawn: { width: LEAGUE_COLUMN_WIDTH.drawn, flexShrink: 0 },
  lost: { width: LEAGUE_COLUMN_WIDTH.lost, flexShrink: 0 },
  goalDifference: { width: LEAGUE_COLUMN_WIDTH.goalDifference, flexShrink: 0 },
  points: { width: LEAGUE_COLUMN_WIDTH.points, flexShrink: 0 },
});
import { useDesktopContentStyle } from '../layout/DesktopClamp';
import { useCopy } from '../../i18n';

export interface LeagueTableScreenProps {
  viewModel: LeagueTableViewModel;
  /** Rows settle into place instead of sliding when motion is reduced. */
  reduceMotion?: boolean;
}

export function LeagueTableScreen({ viewModel, reduceMotion = false }: LeagueTableScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const pointsFromTop = viewModel.leaderPoints - viewModel.userPoints;
  const layoutMode = useLayoutMode();
  // The standings the player is about to see, compared with the ones they last
  // saw, so rows can slide in from their old places. Read once per distinct
  // table — re-opening the same week correctly animates nothing.
  const shiftsRef = useRef<Map<string, number>>(new Map());
  const shiftKeyRef = useRef<string | undefined>(undefined);
  const shiftKey = `${viewModel.divisionLabel}|${viewModel.seasonLabel}|${viewModel.weekLabel}`;
  if (shiftKeyRef.current !== shiftKey) {
    shiftKeyRef.current = shiftKey;
    shiftsRef.current = takeLeagueRowShifts(viewModel.divisionLabel, viewModel.rows);
  }
  const [rowHeight, setRowHeight] = useState(0);
  const handleRowLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    setRowHeight(current => (Math.abs(current - measured) < 0.5 ? current : measured));
  };

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
            {t('leagueTable.tiebreakNote')}</Text>
        </PaperPanel>
      ),
    },
    {
      key: 'table',
      weight: 2 + viewModel.rows.length,
      node: (
        <View>
          <SectionLabel
            eyebrow="Promotion race"
            title="Full league table"
            right={<StatusChip label="Top 2 go up" tone="success" />}
          />
          {viewModel.rows.length === 0 ? (
            <EmptyDocket
              title="Standings not published"
              detail="The competition office posts the table once the first round is played."
            />
          ) : (
          <View
            accessible
            accessibilityLabel={`${viewModel.divisionLabel} standings after ${viewModel.matchesPlayed} matches`}
            className="border-2 border-ink bg-white"
          >
            <View className="flex-row border-b border-ink/20 px-2 py-2">
              <Text style={tableColumns.position} className="font-mono text-[12px] text-ink/50">#</Text>
              <PixelText className="flex-1 text-[12px] uppercase text-ink/50">Club</PixelText>
              {TABLE_HEADERS.map(header => (
                <InfoTip
                  key={header.key}
                  text={TABLE_COLUMN_EXPLAINER[header.column]}
                  align="right"
                  style={tableColumns[header.column]}
                  accessibilityLabel={`${header.name}. ${TABLE_COLUMN_EXPLAINER[header.column]}`}
                >
                  <Text
                    className="w-full text-right font-mono text-[12px] text-ink/50"
                    maxFontSizeMultiplier={HEADER_MAX_FONT_MULTIPLIER}
                    numberOfLines={1}
                  >
                    {t(header.key)}
                  </Text>
                </InfoTip>
              ))}
            </View>
            {viewModel.rows.map(row => {
              const rowClass = row.isUserClub
                ? 'bg-blue-light'
                : row.inPromotionPlaces
                  ? 'bg-pitch-light'
                  : '';
              const primaryText = row.isUserClub ? 'text-ink' : 'text-ink';
              const secondaryText = row.isUserClub ? 'text-ink/70' : 'text-ink/65';
              return (
                <LeagueTableRow
                  key={row.clubId}
                  rowsMoved={shiftsRef.current.get(row.clubId) ?? 0}
                  rowHeight={rowHeight}
                  reduceMotion={reduceMotion}
                  standingsKey={shiftKey}
                  onLayout={row.position === 1 ? handleRowLayout : undefined}
                >
                <View
                  accessible
                  accessibilityLabel={`${row.position}. ${row.clubName}. Played ${row.played}, won ${row.won}, drawn ${row.drawn}, lost ${row.lost}, goal difference ${row.goalDifference}, ${row.points} points.`}
                  className={`min-h-11 flex-row items-center border-b border-ink/10 px-2 py-2 ${rowClass}`}
                >
                  <Text style={tableColumns.position} className={`font-mono text-base ${primaryText}`} numberOfLines={1}>{row.position}</Text>
                  <View className="flex-1 flex-row items-center pr-1">
                    <Text className={`flex-1 text-base ${row.isUserClub ? 'font-bold' : ''} ${primaryText}`} numberOfLines={1}>{row.clubName}</Text>
                    {row.inPromotionPlaces ? (
                      <Text className={row.isUserClub ? 'text-sm font-bold text-ink' : 'text-sm font-bold text-pitch-ink'}>↑</Text>
                    ) : null}
                  </View>
                  <Text style={tableColumns.played} className={`text-right font-mono text-[12px] ${secondaryText}`} numberOfLines={1}>{row.played}</Text>
                  <Text style={tableColumns.won} className={`text-right font-mono text-[12px] ${secondaryText}`} numberOfLines={1}>{row.won}</Text>
                  <Text style={tableColumns.drawn} className={`text-right font-mono text-[12px] ${secondaryText}`} numberOfLines={1}>{row.drawn}</Text>
                  <Text style={tableColumns.lost} className={`text-right font-mono text-[12px] ${secondaryText}`} numberOfLines={1}>{row.lost}</Text>
                  <Text style={tableColumns.goalDifference} className={`text-right font-mono text-[12px] ${secondaryText}`} numberOfLines={1}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text style={tableColumns.points} className={`text-right font-mono text-base ${primaryText}`} numberOfLines={1}>{row.points}</Text>
                </View>
                </LeagueTableRow>
              );
            })}
          </View>
          )}
          <View className="mt-4 flex-row items-center gap-4 border-2 border-ink bg-white px-3 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 bg-blue" />
              <Text className="text-sm text-ink/60">{t('leagueTable.yourClub')}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 bg-pitch-light" />
              <Text className="text-sm text-ink/60">{t('leagueTable.promotionPlace')}</Text>
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
          <SectionLabel
            eyebrow={viewModel.divisionLabel}
            title="Fixtures & results"
            right={<StatusChip label={`${viewModel.leagueFixtures.length} matches`} />}
          />
          {viewModel.leagueFixtures.length === 0 ? (
            <PaperPanel title="Schedule pending" kicker={viewModel.seasonLabel}>
              <Text className="text-sm leading-5 text-ink/60">
                {t('m2League.yourLeagueScheduleWill')}</Text>
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
    <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 28 }, desktopContent]}>
      <SectionFlow
        mode={layoutMode}
        header={
          <View className="mb-5 flex-row items-end justify-between">
            <View>
              <PixelText className="text-[12px] uppercase text-blue-dark">{t('leagueTable.competitionOffice')}</PixelText>
              <PixelText className="mt-1 text-[18px] uppercase text-ink">{viewModel.divisionLabel}</PixelText>
            </View>
            <View className="items-end gap-1">
              <StatusChip label={viewModel.seasonLabel} />
              <Text className="font-mono text-[12px] text-ink/50">{viewModel.weekLabel}</Text>
            </View>
          </View>
        }
        sections={sections}
      />
    </ScrollView>
  );
}
