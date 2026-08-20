import { loadLaunchContent } from '../../content';
import {
  advanceWeek,
  createCareer,
  type GameState,
  type SponsorContractSnapshot,
} from '../../game';
import { buildSeasonRecap } from '../../game/season-recap';
import { copyFor } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { seasonEndViewModel } from '../view-models';

describe('season-end Club Business presentation', () => {
  it('presents the real Week 30 Chairman sponsor outcomes', () => {
    const settled = advanceWeek(week30ChairmanCareer());

    expect(settled).toMatchObject({ season: 3, week: 30, phase: 'season-end' });
    expect(
      settled.clubBusiness.sponsorship.activeContracts.map(
        (contract) => contract.objectiveOutcome,
      ),
    ).toEqual([
      { met: true, settledSeason: 3, actualBonus: 800 },
      { met: false, settledSeason: 3, actualBonus: 0 },
    ]);
    const viewModel = seasonEndViewModel(settled, loadLaunchContent(), 1);
    expect(viewModel.clubBusinessSettlement).toEqual({
      objectiveResults: [
        {
          contractId: 'wins-contract',
          sponsorName: 'Northstar Tools',
          objectiveLabel: 'Win 1 league match',
          met: true,
          actualBonus: 800,
        },
        {
          contractId: 'goals-contract',
          sponsorName: 'Moonshot Insurance',
          objectiveLabel: 'Score 99 league goals',
          met: false,
          actualBonus: 0,
        },
      ],
      objectiveBonusTotal: 800,
      actualPayoutTotal: 800,
    });
  });

  it('translates saved Hero of the Season power ids', () => {
    const initial = createCareer(createLaunchCareerSetup(20260807));
    const hero = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!;
    const recap = buildSeasonRecap(initial);
    const state: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map((player) =>
        player.id === hero.id
          ? { ...player, power: 'SHADOW_MARK' as const, licensed: true }
          : player,
      ),
      seasonRecaps: [
        {
          ...recap,
          heroOfSeason: {
            playerId: hero.id,
            playerName: hero.name,
            label: 'Hero of the Season',
            detail: 'SHADOW MARK made the difference',
            labelKey: 'recap.award.heroOfSeason',
            labelParams: { power: 'SHADOW MARK' },
          },
        },
      ],
    };

    const award = seasonEndViewModel(
      state,
      loadLaunchContent(),
      1,
      copyFor('es'),
    ).recap?.awards.find((candidate) => candidate.playerId === hero.id);

    expect(award?.detail).toContain('Marca Sombra');
    expect(award?.detail).not.toContain('SHADOW MARK');
  });
});

function week30ChairmanCareer(): GameState {
  const initial = createCareer(
    createLaunchCareerSetup(20260805, undefined, undefined, 'CHAIRMAN'),
  );
  const contracts: SponsorContractSnapshot[] = [
    {
      contractId: 'wins-contract',
      sponsorContentId: 'northstar-tools',
      sponsorName: 'Northstar Tools',
      offerLine: 'Build something worth cheering for.',
      season: 3,
      slot: 0,
      nominalMonthlyFee: 4_001,
      provisional: false,
      objective: {
        kind: 'LEAGUE_WINS',
        label: 'Win 1 league match',
        target: 1,
        nominalBonus: 1_001,
      },
    },
    {
      contractId: 'goals-contract',
      sponsorContentId: 'moonshot-insurance',
      sponsorName: 'Moonshot Insurance',
      offerLine: 'Big dreams deserve a safety net.',
      season: 3,
      slot: 1,
      nominalMonthlyFee: 3_999,
      provisional: false,
      objective: {
        kind: 'LEAGUE_GOALS',
        label: 'Score 99 league goals',
        target: 99,
        nominalBonus: 999,
      },
    },
  ];
  let assignedUserWin = false;

  return {
    ...initial,
    season: 3,
    week: 30,
    phase: 'manage',
    difficulty: 'CHAIRMAN',
    clubs: initial.clubs.map((club) =>
      club.id === initial.userClubId
        ? { ...club, cash: 1_000_000, sponsorMonthlyFee: 8_000 }
        : club,
    ),
    fixtures: initial.fixtures.map((fixture) => {
      const userIsHome = fixture.homeClubId === initial.userClubId;
      const userIsAway = fixture.awayClubId === initial.userClubId;
      const giveUserWin = !assignedUserWin && (userIsHome || userIsAway);
      if (giveUserWin) assignedUserWin = true;
      return {
        ...fixture,
        season: 3,
        status: 'played' as const,
        score: giveUserWin
          ? {
              homeGoals: userIsHome ? 2 : 0,
              awayGoals: userIsAway ? 2 : 0,
            }
          : { homeGoals: 0, awayGoals: 0 },
      };
    }),
    m2: {
      ...initial.m2!,
      highestDivisionReached: 3,
    },
    clubBusiness: {
      ...initial.clubBusiness,
      sponsorship: {
        activeContracts: contracts,
        offers: [],
        portfolioSeason: 3,
        offerSeason: 3,
      },
      pendingUserMatchImpacts: [],
    },
  };
}
