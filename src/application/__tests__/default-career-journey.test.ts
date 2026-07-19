import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  advanceWeek,
  applyCareerTraining,
  awakenCreatedPlayer,
  beginStoryOnboarding,
  buildCareerTeamDef,
  buildTrainingGround,
  completeFirstOnboardingMatch,
  completeMatchday,
  completeStoryOnboarding,
  createCareer,
  fixturesForCurrentWeek,
  releaseCareerPlayer,
  renewCareerPlayer,
  startNextSeason,
  type GameState,
} from '../../game';
import { mulberry32 } from '../../sim/rng';
import { createLaunchCareerSetup } from '../launch';
import { seasonEndViewModel } from '../view-models';

describe('default two-season career journey', () => {
  it('reaches Season 2 after the shipped facility/training path and either contract choice', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let state = beginStoryOnboarding(createCareer(createLaunchCareerSetup(24680)));
    state = addCreatedPlayer(state, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    state = buildTrainingGround(state);
    state = applyCareerTraining(state, ['bramble-rovers-p13'], [sprint]);
    state = playToSeasonBoundary(state);

    const userClub = state.clubs.find(club => club.id === state.userClubId)!;
    const expired = state.players.filter(player =>
      player.clubId === state.userClubId && player.contractSeasonsRemaining === 0,
    );
    expect(state.phase).toBe('season-end');
    expect(userClub.cash).toBeGreaterThanOrEqual(0);
    expect(expired.map(player => player.id)).toEqual(['bramble-rovers-created-player']);
    expect(seasonEndViewModel(state, content, 1).canContinue).toBe(false);

    const renewed = renewCareerPlayer(state, expired[0].id, 4, 1);
    expect(renewed.clubs.find(club => club.id === state.userClubId)?.cash).toBe(userClub.cash);
    expect(renewed.players.find(player => player.id === expired[0].id)?.weeklyWage).toBe(720);
    expect(seasonEndViewModel(renewed, content, 1).canContinue).toBe(true);
    const seasonTwo = startNextSeason(renewed);
    expect(seasonTwo).toMatchObject({ season: 2, week: 1, phase: 'manage' });
    expect(playToSeasonBoundary(seasonTwo)).toMatchObject({ season: 2, phase: 'complete' });

    const released = releaseCareerPlayer(state, expired[0].id);
    expect(released.players.some(player => player.id === expired[0].id)).toBe(false);
    expect(() => buildCareerTeamDef(released, released.userClubId)).not.toThrow();
    expect(seasonEndViewModel(released, content, 1).canContinue).toBe(true);
    expect(startNextSeason(released)).toMatchObject({ season: 2, week: 1, phase: 'manage' });
  });
});

function playToSeasonBoundary(initial: GameState): GameState {
  let state = initial;
  while (state.phase !== 'season-end' && state.phase !== 'complete') {
    state = advanceWeek(state);
    if (state.phase !== 'matchday') continue;
    const fixtures = fixturesForCurrentWeek(state);
    const firstFixtureId = state.onboarding?.firstFixtureId;
    state = completeMatchday(state, fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    })));
    if (state.onboarding?.stage === 'first-match' && firstFixtureId !== undefined) {
      state = completeFirstOnboardingMatch(state, firstFixtureId);
      state = completeStoryOnboarding(
        awakenCreatedPlayer(state, 'CHEMICAL', mulberry32(99)),
      );
    }
  }
  return state;
}
