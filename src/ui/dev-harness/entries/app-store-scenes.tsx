import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { leagueStandings, quickResolveM2NationalCup } from '../../../game';
import { m2LeagueViewModel } from '../../../application/m2-league-view-model';
import { squadTrainingViewModel } from '../../../application/view-models';
import { loadLaunchContent } from '../../../content';
import { M2LeagueScreen } from '../../screens/M2LeagueScreen';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';
import { CareerEventsReel } from './career-events';
import { ClubBusinessReel } from './club-business';
import { contractRenewalEntry } from './contract-renewal';
import { FinancialReportCase } from './financial-report';
import { liveMatchControlsEntry } from './live-match-controls';
import { PlayerRequestsReel } from './player-requests';
import { MatchScreen } from '../../../render/MatchScreen';
import { powerMatchShowcaseHome } from '../../../render/power-match-showcase';

const CASES = [
  ['heroes-change-matches', 'Heroes Change Matches'],
  ['contract-renewals', 'Contract Renewals'],
  ['coach-live', 'Coach Live'],
  ['train-what-matters', 'Train What Matters'],
  ['facilities-pay-off', 'Facilities Pay Off'],
  ['story-every-week', 'Stories with Consequences'],
  ['player-requests', 'Player Requests'],
  ['sponsors-want-more', 'Sponsors Want More'],
  ['five-divisions-cup', '5 Divisions + Cup'],
  ['financial-report', 'Financial Report'],
] as const;

function PlayerProfileScene() {
  const { width } = useWindowDimensions();
  const career = useMemo(() => devHarnessCareerAtWeek(3, 12), []);
  const playerId = career.players.find(
    (player) => player.clubId === career.userClubId && player.role === 'MID',
  )?.id;
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const viewModel = useMemo(
    () => squadTrainingViewModel(career, loadLaunchContent(), playerId),
    [career, playerId],
  );
  return (
    <SquadTrainingScreen
      viewModel={viewModel}
      selectedPlayerId={playerId}
      onSelectPlayer={() => {}}
      onTrainDrill={() => {}}
      onTrainDrillBatch={() => {}}
      onBuyDrillUpgrade={() => {}}
      lastDrillResult={null}
      trainingPoints={career.trainingPoints}
      squadSort={squadSort}
      onChangeSquadSort={setSquadSort}
      reduceMotion
      initialScrollY={width >= 600 ? 1200 : 1700}
    />
  );
}

function HeroShowcaseScene() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        paddingTop: width >= 600 ? insets.top : 0,
        transform: [{ translateY: width < 600 ? -20 : 0 }],
      }}
    >
      <MatchScreen
        seed={20260893}
        home={powerMatchShowcaseHome('FIRE_TORCH')}
        powerMatchQa={{ power: 'FIRE_TORCH', manual: false }}
        controlledTeam={0}
        onOpenSettings={() => {}}
        onDone={() => {}}
      />
    </View>
  );
}

function FacilitiesScene() {
  const { width } = useWindowDimensions();
  return (
    <ClubBusinessReel
      caseId="d2-partial"
      initialTab="facility"
      storeFacilities
      initialScrollY={width >= 600 ? 0 : 1550}
    />
  );
}

function SponsorsScene() {
  const { width } = useWindowDimensions();
  return (
    <ClubBusinessReel
      caseId="d4-offers"
      initialScrollY={width >= 600 ? 750 : 850}
    />
  );
}

function CompetitionScene() {
  const { width } = useWindowDimensions();
  const career = useMemo(() => devHarnessCareerAtWeek(2, 5), []);
  if (career.m2 === undefined) throw new Error('Store Cup scene needs M2');
  const cupCareer = quickResolveM2NationalCup(career.m2);
  const viewModel = m2LeagueViewModel({
    career: cupCareer,
    season: career.season,
    week: career.week,
    phase: career.phase,
    activeStandings: leagueStandings(career),
    leagueFixtures: career.fixtures,
    players: career.players,
    statLines: career.seasonStatLines,
  });
  return (
    <M2LeagueScreen
      viewModel={viewModel}
      onSelectDivision={() => {}}
      initialSubTab="cup"
      forceWideCupBracket={width >= 600}
    />
  );
}

function AppStoreScene({ caseId }: { readonly caseId: string }) {
  switch (caseId) {
    case 'heroes-change-matches':
      return <HeroShowcaseScene />;
    case 'contract-renewals':
      return contractRenewalEntry.render('hero-cliff');
    case 'coach-live':
      return liveMatchControlsEntry.render('mid-match');
    case 'train-what-matters':
      return <PlayerProfileScene />;
    case 'facilities-pay-off':
      return <FacilitiesScene />;
    case 'story-every-week':
      return <CareerEventsReel caseId="target-player" storeMedia />;
    case 'player-requests':
      return <PlayerRequestsReel caseId="tradeoff" storeMedia />;
    case 'sponsors-want-more':
      return <SponsorsScene />;
    case 'five-divisions-cup':
      return <CompetitionScene />;
    case 'financial-report':
      return <FinancialReportCase caseId="facilities" storeMedia />;
    default:
      throw new Error(`Unknown App Store scene: ${caseId}`);
  }
}

export const appStoreScenesEntry: DevHarnessEntry = Object.freeze({
  id: 'app-store-scenes',
  group: 'Store',
  title: 'App Store scenes',
  summary: 'The ten clean, deterministic native marketing captures.',
  cases: Object.freeze(
    CASES.map(([id, label]) => Object.freeze({ id, label })),
  ),
  render: (caseId: string) => (
    <View style={{ flex: 1, backgroundColor: '#241f2e' }}>
      <AppStoreScene caseId={caseId} />
    </View>
  ),
});
