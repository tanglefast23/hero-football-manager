import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Metric, PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
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
const TABLE_COLUMN_EXPLAINER_KEY: Readonly<Record<LeagueColumn, string>> = {
  position: 'leagueTable.explainer.position',
  played: 'leagueTable.explainer.played',
  won: 'leagueTable.explainer.won',
  drawn: 'leagueTable.explainer.drawn',
  lost: 'leagueTable.explainer.lost',
  goalDifference: 'leagueTable.explainer.goalDifference',
  points: 'leagueTable.explainer.points',
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
  /** The unabbreviated name, spoken by the screen reader — never drawn. */
  nameKey: string;
}[] = [
  { column: 'played', key: 'col.league.played', nameKey: 'leagueTable.headerName.played' },
  { column: 'won', key: 'col.league.won', nameKey: 'leagueTable.headerName.won' },
  { column: 'drawn', key: 'col.league.drawn', nameKey: 'leagueTable.headerName.drawn' },
  { column: 'lost', key: 'col.league.lost', nameKey: 'leagueTable.headerName.lost' },
  {
    column: 'goalDifference',
    key: 'col.league.goalDifference',
    nameKey: 'leagueTable.headerName.goalDifference',
  },
  { column: 'points', key: 'col.league.points', nameKey: 'leagueTable.headerName.points' },
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
}

export function LeagueTableScreen({ viewModel }: LeagueTableScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const pointsFromTop = viewModel.leaderPoints - viewModel.userPoints;
  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
    {
      key: 'standing',
      weight: 5,
      node: (
        <PaperPanel
          kicker={t('leagueTable.currentStanding')}
          title={t('leagueTable.position', { position: viewModel.userPosition })}
          stamp={t('leagueTable.live')}
        >
          <View className="flex-row gap-2">
            <Metric label={t('leagueTable.points')} value={String(viewModel.userPoints)} />
            <Metric
              label={t('leagueTable.fromTop')}
              value={pointsFromTop === 0
                ? t('leagueTable.leader')
                : t('leagueTable.pointsBehind', { points: pointsFromTop })}
            />
            <Metric label={t('leagueTable.matchesPlayed')} value={`${viewModel.matchesPlayed}/${viewModel.matchesTotal}`} />
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
            eyebrow={t('leagueTable.promotionRace')}
            title={t('leagueTable.fullLeagueTable')}
            right={<StatusChip label={t('leagueTable.topTwoGoUp')} tone="success" />}
          />
          {viewModel.rows.length === 0 ? (
            <EmptyDocket
              title={t('leagueTable.standingsNotPublished')}
              detail={t('leagueTable.standingsNotPublishedDetail')}
            />
          ) : (
          <View
            accessible
            accessibilityLabel={t('leagueTable.a11y.divisionStandings', {
              division: viewModel.divisionLabel,
              matches: viewModel.matchesPlayed,
            })}
            className="border-2 border-ink bg-white"
          >
            <View className="flex-row border-b border-ink/20 px-2 py-2">
              <Text style={tableColumns.position} className="font-mono text-[12px] text-ink/50">{t('col.league.position')}</Text>
              {/* Safe to translate: this is the flexible name column, and it is
                  deliberately absent from `LEAGUE_HEADER_ADVANCE_EM`, so it does
                  not participate in the measured-width gate the way P/GD/PTS do. */}
              <PixelText className="flex-1 text-[12px] uppercase text-ink/50">{t('col.league.club')}</PixelText>
              {TABLE_HEADERS.map(header => (
                <InfoTip
                  key={header.key}
                  text={t(TABLE_COLUMN_EXPLAINER_KEY[header.column])}
                  align="right"
                  style={tableColumns[header.column]}
                  accessibilityLabel={t('leagueTable.a11y.columnExplainer', {
                    name: t(header.nameKey),
                    explainer: t(TABLE_COLUMN_EXPLAINER_KEY[header.column]),
                  })}
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
                <View
                  key={row.clubId}
                  accessible
                  accessibilityLabel={t('leagueTable.a11y.row', {
                    position: row.position,
                    club: row.clubName,
                    played: row.played,
                    won: row.won,
                    drawn: row.drawn,
                    lost: row.lost,
                    goalDifference: row.goalDifference,
                    points: row.points,
                  })}
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
            title={t('leagueTable.fixturesAndResults')}
            right={<StatusChip label={t('leagueTable.matchCount', { count: viewModel.leagueFixtures.length })} />}
          />
          {viewModel.leagueFixtures.length === 0 ? (
            <PaperPanel title={t('leagueTable.schedulePending')} kicker={viewModel.seasonLabel}>
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
