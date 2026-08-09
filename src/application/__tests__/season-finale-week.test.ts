import {
  activeCareerMatchday,
  createCareer,
  SEASON_WEEKS,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

/**
 * The season ends on a match, not on a dead week.
 *
 * Before the final round was pinned to Week 30 the league finished in Week 28,
 * and the last two weeks had nothing to play. The desk still headed its card
 * "Next match" and filled it with the club against "Season Review", which is
 * the copy that started this: a fixture card promising a fixture the calendar
 * did not have.
 */
function career(seed: number): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

describe('the last week of the season', () => {
  it('has the final league round on it', () => {
    const state = career(1);
    const lastFixtureWeek = state.fixtures
      .filter((fixture) => fixture.season === state.season)
      .reduce((latest, fixture) => Math.max(latest, fixture.week), 0);

    expect(lastFixtureWeek).toBe(SEASON_WEEKS);
    expect(activeCareerMatchday({ ...state, week: SEASON_WEEKS })?.kind).toBe(
      'league',
    );
  });

  it('shows the match on the desk instead of a season review', () => {
    const state = { ...career(1), week: SEASON_WEEKS };
    const view = homeViewModel(state);
    const matchday = activeCareerMatchday(state)!;

    expect(view.nextFixture.id).toBe(matchday.fixture.id);
    expect(view.nextFixture.id).not.toBe('season-complete');
    expect(view.nextFixture.awayTeam).not.toBe('Season Review');
    expect(view.isCurrentGameWeek).toBe(true);
  });

  it('stamps the card "Final game" rather than "This week"', () => {
    expect(
      homeViewModel({ ...career(1), week: SEASON_WEEKS }).nextMatchTimingLabel,
    ).toBe('Final game');
  });

  it('still stamps an ordinary match week "This week"', () => {
    const state = career(1);
    const ordinary = state.fixtures.find(
      (fixture) =>
        fixture.season === state.season &&
        fixture.week < SEASON_WEEKS &&
        (fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId),
    )!;
    expect(
      homeViewModel({ ...state, week: ordinary.week }).nextMatchTimingLabel,
    ).toBe('This week');
  });
});
