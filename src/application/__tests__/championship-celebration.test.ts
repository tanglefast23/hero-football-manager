import { createLaunchCareerSetup } from '../launch';
import { createCareer } from '../../game';
import {
  championshipCelebrationFlag,
  championshipCelebrationViewModel,
  completeChampionshipCelebration,
  hasPendingChampionshipCelebration,
} from '../championship-celebration';

function championState() {
  const state = createCareer(createLaunchCareerSetup(777));
  const fixtures = state.fixtures.map(fixture => {
    const userIsHome = fixture.homeClubId === state.userClubId;
    const userIsAway = fixture.awayClubId === state.userClubId;
    return {
      ...fixture,
      status: 'played' as const,
      score: userIsHome
        ? { homeGoals: 2, awayGoals: 0 }
        : userIsAway
          ? { homeGoals: 0, awayGoals: 2 }
          : { homeGoals: 0, awayGoals: 0 },
    };
  });
  return {
    ...state,
    week: 30,
    phase: 'season-end' as const,
    fixtures,
    seasonGoalTallies: [
      { season: 1, playerId: 'bramble-rovers-p10', goals: 12 },
      { season: 1, playerId: 'bramble-rovers-p13', goals: 9 },
    ],
  };
}

describe('league championship celebration', () => {
  it('selects the actual leading scorer and includes the rest of the squad', () => {
    const state = championState();
    const finalFixture = state.fixtures
      .filter(fixture => fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
      .sort((left, right) => right.week - left.week)[0]!;
    const finalMatchSide = finalFixture.homeClubId === state.userClubId ? 'r' : 'u';

    expect(hasPendingChampionshipCelebration(state)).toBe(true);
    expect(championshipCelebrationViewModel(state, 'Bert Rudge')).toMatchObject({
      clubName: 'Bramble Rovers',
      assistantName: 'Bert Rudge',
      star: {
        id: 'bramble-rovers-p10',
        goals: 12,
        hasRecordedGoals: true,
        spriteKey: `${finalMatchSide}9:run0`,
      },
      squad: expect.arrayContaining([
        expect.objectContaining({ id: 'bramble-rovers-p13' }),
      ]),
    });
    expect(championshipCelebrationViewModel(state, 'Bert Rudge').squad)
      .toHaveLength(state.players.filter(player => player.clubId === state.userClubId).length - 1);
  });

  it('uses the same atlas characters as the final match lineup', () => {
    const state = championState();
    const viewModel = championshipCelebrationViewModel(state, 'Bert Rudge');
    const players = [viewModel.star, ...viewModel.squad];
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const finalFixture = state.fixtures
      .filter(fixture => fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
      .sort((left, right) => right.week - left.week)[0]!;
    const side = finalFixture.homeClubId === state.userClubId ? 'r' : 'u';

    lineup.playerIds.forEach((playerId, slot) => {
      expect(players.find(player => player.id === playerId)?.spriteKey)
        .toBe(`${side}${slot}:run0`);
    });
  });

  it('marks each season celebration once without changing the league result', () => {
    const state = championState();
    const completed = completeChampionshipCelebration(state);

    expect(completed.eventFlags).toContain(championshipCelebrationFlag(1));
    expect(hasPendingChampionshipCelebration(completed)).toBe(false);
    expect(completeChampionshipCelebration(completed)).toBe(completed);
  });

  it('does not trigger for a club that did not win the division', () => {
    const state = championState();
    const losingFixtures = state.fixtures.map(fixture => {
      if (fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId) {
        return fixture;
      }
      return {
        ...fixture,
        score: fixture.homeClubId === state.userClubId
          ? { homeGoals: 0, awayGoals: 3 }
          : { homeGoals: 3, awayGoals: 0 },
      };
    });

    expect(hasPendingChampionshipCelebration({ ...state, fixtures: losingFixtures })).toBe(false);
  });
});
