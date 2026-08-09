import { createLaunchCareerSetup } from '../launch';
import { projectedSeasonEndContractPromiseHeroLimit } from '../contract-promise-projection';
import { createCareer, startNextSeason } from '../../game/career';
import { careerContractPromiseHeroLimit } from '../../game/contract-promises';
import { currentUserDivision } from '../../game/m2-career';
import type { GameState } from '../../game/types';

describe('season-end contract promise projection', () => {
  it('projects the fourth Hero License during the D2 promotion review', () => {
    const initial = createCareer(createLaunchCareerSetup(20260810));
    let state: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.clubId === initial.userClubId
          ? {
              ...player,
              age: 18,
              contractSeasonsRemaining: 8,
              retirementAge: 40,
              retirementAnnounced: false,
              retirementAnnouncementSeason: undefined,
            }
          : player,
      ),
    };
    for (const expectedDivision of [4, 3, 2] as const) {
      state = startNextSeason(completedSeasonForUser(state));
      expect(currentUserDivision(state.m2!)).toBe(expectedDivision);
    }
    state = completedSeasonForUser(state);

    expect(careerContractPromiseHeroLimit(state)).toBe(3);
    expect(projectedSeasonEndContractPromiseHeroLimit(state)).toBe(4);
  });
});

function completedSeasonForUser(state: GameState): GameState {
  return {
    ...state,
    phase: 'season-end',
    fixtures: state.fixtures.map((fixture) =>
      fixture.season === state.season
        ? {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? { homeGoals: 3, awayGoals: 0 }
                : fixture.awayClubId === state.userClubId
                  ? { homeGoals: 0, awayGoals: 3 }
                  : { homeGoals: 0, awayGoals: 0 },
          }
        : fixture,
    ),
  };
}
