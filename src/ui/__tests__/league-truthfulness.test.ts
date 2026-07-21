import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../../application/launch';
import { homeViewModel, leagueTableViewModel } from '../../application/view-models';

describe('management UI truthfulness view models', () => {
  it('maps the current played fixtures into the full live league table', () => {
    const initial = createCareer(createLaunchCareerSetup(413));
    const userFixture = initial.fixtures.find(fixture =>
      fixture.season === 1 &&
      (fixture.homeClubId === initial.userClubId || fixture.awayClubId === initial.userClubId),
    );
    if (userFixture === undefined) throw new Error('launch career has no user fixture');

    const career = {
      ...initial,
      fixtures: initial.fixtures.map(fixture => fixture.id === userFixture.id
        ? {
            ...fixture,
            status: 'played' as const,
            score: fixture.homeClubId === initial.userClubId
              ? { homeGoals: 2, awayGoals: 0 }
              : { homeGoals: 0, awayGoals: 2 },
          }
        : fixture),
    };

    const viewModel = leagueTableViewModel(career);
    const user = viewModel.rows.find(row => row.isUserClub);

    expect(viewModel.rows).toHaveLength(10);
    expect(viewModel.matchesPlayed).toBe(1);
    expect(viewModel.matchesTotal).toBe(90);
    expect(user).toMatchObject({ position: 1, played: 1, won: 1, points: 3 });
    expect(viewModel.userPosition).toBe(1);
    expect(viewModel.leaderPoints).toBe(3);
  });

  it('only marks the fixture action ready during its actual matchday', () => {
    const career = createCareer(createLaunchCareerSetup(924));
    const initialHome = homeViewModel(career);
    const fixture = career.fixtures.find(candidate => candidate.id === initialHome.nextFixture.id);
    if (fixture === undefined) throw new Error('home view does not reference a real fixture');

    expect(initialHome.nextFixture.matchdayReady).toBe(false);
    expect(homeViewModel({ ...career, week: fixture.week, phase: 'matchday' }).nextFixture.matchdayReady)
      .toBe(true);
  });

  it('shows how far away the next match is on the home desk', () => {
    const career = createCareer(createLaunchCareerSetup(924));
    const firstFixture = career.fixtures.find(fixture =>
      fixture.season === 1 &&
      fixture.week === 5 &&
      (fixture.homeClubId === career.userClubId || fixture.awayClubId === career.userClubId),
    );
    if (firstFixture === undefined) throw new Error('launch career has no week five user fixture');

    const afterOpeningMatch = {
      ...career,
      week: 5,
      fixtures: career.fixtures.map(fixture => fixture.id === firstFixture.id
        ? {
            ...fixture,
            status: 'played' as const,
            score: { homeGoals: 0, awayGoals: 1 },
          }
        : fixture),
    };

    expect(homeViewModel(afterOpeningMatch).nextMatchTimingLabel).toBe('In 1 week');
    expect(homeViewModel({
      ...career,
      week: firstFixture.week,
      phase: 'matchday',
    }).nextMatchTimingLabel).toBe('This week');
  });
});
