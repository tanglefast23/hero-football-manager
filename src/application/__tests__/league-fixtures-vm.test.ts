import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { leagueTableViewModel } from '../view-models';

describe('season-1 league fixtures view model', () => {
  it('exposes the season schedule with played results first-class', () => {
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

    expect(viewModel.leagueFixtures.length).toBeGreaterThan(0);
    expect(viewModel.leagueFixtures[0]).toEqual(expect.objectContaining({
      weekLabel: expect.any(String),
      scoreLabel: expect.any(String),
      status: expect.stringMatching(/SCHEDULED|PLAYED/),
    }));

    const playedFixture = viewModel.leagueFixtures.find(fixture => fixture.id === userFixture.id);
    expect(playedFixture).toMatchObject({
      status: 'PLAYED',
      result: 'WIN',
      scoreLabel: '2-0',
    });
  });
});
