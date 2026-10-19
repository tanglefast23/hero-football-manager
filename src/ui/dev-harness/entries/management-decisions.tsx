import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { marketViewModel } from '../../../application/market-view-model';
import {
  careerMarketViewModelSource,
  careerMarketScoutOptions,
} from '../../../application/market-source-adapter';
import { m2LeagueViewModel } from '../../../application/m2-league-view-model';
import { advanceM2NationalCup } from '../../../game/m2-career';
import { leagueStandings } from '../../../game/career';
import { startCareerScoutMission } from '../../../game/market-career';
import type { GameState } from '../../../game/types';
import { copyFor } from '../../../i18n';
import {
  ConfirmationSheet,
  type ConfirmationRequest,
} from '../../components/ConfirmationSheet';
import { MarketScreen } from '../../screens/MarketScreen';
import { M2LeagueScreen } from '../../screens/M2LeagueScreen';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

const t = copyFor('en');

function ScoutDates({ week }: { readonly week: number }) {
  const [state, setState] = useState<GameState>(() =>
    devHarnessCareerAtWeek(2, week, 711),
  );
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(
    null,
  );
  const [sent, setSent] = useState<string>();
  const source = careerMarketViewModelSource(state);
  const view = marketViewModel(source);
  return (
    <View style={{ flex: 1 }}>
      {sent === undefined ? null : (
        <Text accessibilityRole="alert">{sent}</Text>
      )}
      <MarketScreen
        viewModel={view}
        requestedSection="SCOUT"
        reduceMotion
        onStartScoutMission={(optionId) => {
          const choice = view.scouting.choices.find(
            (row) => row.id === optionId,
          )!;
          const start = () => {
            const option = careerMarketScoutOptions(state).find(
              (row) => row.id === optionId,
            )!;
            const transaction = startCareerScoutMission(
              state,
              state.market!,
              option.region,
              option.focus,
              source.division,
              source.highestDivisionReached ?? source.division,
            );
            setState({ ...transaction.state, market: transaction.market });
            setSent(
              `Purchased ${transaction.market.activeScoutMission!.id}: ${choice.returnWeekLabel}`,
            );
            setConfirmation(null);
          };
          if (!choice.returnsOutsideWindow) start();
          else
            setConfirmation({
              title: t('confirm.lateScout.title'),
              detail: `${choice.returnWeekLabel}. ${choice.windowFitLabel}`,
              confirmLabel: t('confirm.lateScout.confirm'),
              cancelLabel: t('confirm.lateScout.cancel'),
              onConfirm: start,
            });
        }}
        onOpenScoutReport={() => {}}
        onDismissScoutReport={() => {}}
        onBuyDetailedScoutReport={() => {}}
        onTransferAction={() => {}}
        onHireCoach={() => {}}
        onSignYouth={() => {}}
        onDeclineYouth={() => {}}
        onSubmitContractOffer={() => {}}
        onCloseNegotiation={() => {}}
      />
      <ConfirmationSheet
        confirmation={confirmation}
        reduceMotion
        onCancel={() => setConfirmation(null)}
        onConfirm={() => confirmation?.onConfirm()}
      />
    </View>
  );
}

function CupResults() {
  const view = useMemo(() => {
    const state = devHarnessCareerAtWeek(1, 10, 42);
    const m2 = state.m2!;
    const cup = m2.nationalCups[0];
    const career = advanceM2NationalCup(
      m2,
      cup.rounds.at(-1)!.fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 0,
        winnerClubId: fixture.homeClubId,
      })),
    );
    return m2LeagueViewModel({
      career,
      season: 1,
      week: 10,
      phase: 'manage',
      activeStandings: leagueStandings(state),
    });
  }, []);
  return (
    <M2LeagueScreen
      viewModel={view}
      onSelectDivision={() => {}}
      initialSubTab="cup"
    />
  );
}

export const managementDecisionsEntry: DevHarnessEntry = {
  id: 'management-decisions',
  group: 'Club',
  title: 'Scout dates and Cup results',
  summary:
    'Production screens with exact scout dates and winner-only abstract ties.',
  cases: [
    { id: 'scout-opening', label: 'Scout W2' },
    { id: 'scout-late', label: 'Scout W16' },
    { id: 'cup-results', label: 'Cup winners' },
  ],
  render: (caseId) =>
    caseId === 'cup-results' ? (
      <CupResults />
    ) : (
      <ScoutDates key={caseId} week={caseId === 'scout-late' ? 16 : 2} />
    ),
};
