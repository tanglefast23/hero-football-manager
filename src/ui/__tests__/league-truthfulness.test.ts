import { createCareer, CUP_SETTLEMENT_WEEKS } from '../../game';
import { createLaunchCareerSetup } from '../../application/launch';
import {
  homeViewModel,
  leagueTableViewModel,
} from '../../application/view-models';
import { copyFor } from '../../i18n';

describe('management UI truthfulness view models', () => {
  it('maps the current played fixtures into the full live league table', () => {
    const initial = createCareer(createLaunchCareerSetup(413));
    const userFixture = initial.fixtures.find(
      (fixture) =>
        fixture.season === 1 &&
        (fixture.homeClubId === initial.userClubId ||
          fixture.awayClubId === initial.userClubId),
    );
    if (userFixture === undefined)
      throw new Error('launch career has no user fixture');

    const career = {
      ...initial,
      fixtures: initial.fixtures.map((fixture) =>
        fixture.id === userFixture.id
          ? {
              ...fixture,
              status: 'played' as const,
              score:
                fixture.homeClubId === initial.userClubId
                  ? { homeGoals: 2, awayGoals: 0 }
                  : { homeGoals: 0, awayGoals: 2 },
            }
          : fixture,
      ),
    };

    const viewModel = leagueTableViewModel(career);
    const user = viewModel.rows.find((row) => row.isUserClub);

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
    const fixture = career.fixtures.find(
      (candidate) => candidate.id === initialHome.nextFixture.id,
    );
    if (fixture === undefined)
      throw new Error('home view does not reference a real fixture');

    expect(initialHome.nextFixture.matchdayReady).toBe(false);
    expect(
      homeViewModel({ ...career, week: fixture.week, phase: 'matchday' })
        .nextFixture.matchdayReady,
    ).toBe(true);
  });

  it('shows how far away the next match is on the home desk', () => {
    const career = createCareer(createLaunchCareerSetup(924));
    const firstFixture = career.fixtures.find(
      (fixture) =>
        fixture.season === 1 &&
        fixture.week === 3 &&
        (fixture.homeClubId === career.userClubId ||
          fixture.awayClubId === career.userClubId),
    );
    if (firstFixture === undefined)
      throw new Error('launch career has no Week 3 user fixture');

    const afterOpeningMatch = {
      ...career,
      week: 3,
      fixtures: career.fixtures.map((fixture) =>
        fixture.id === firstFixture.id
          ? {
              ...fixture,
              status: 'played' as const,
              score: { homeGoals: 0, awayGoals: 1 },
            }
          : fixture,
      ),
    };

    expect(homeViewModel(afterOpeningMatch)).toMatchObject({
      nextMatchTimingLabel: 'In 1 week',
      isCurrentGameWeek: false,
    });
    expect(
      homeViewModel({
        ...career,
        week: firstFixture.week,
        phase: 'matchday',
      }),
    ).toMatchObject({
      nextMatchTimingLabel: 'This week',
      isCurrentGameWeek: true,
    });
  });

  it('does not mark an overdue scheduled fixture as the current game week', () => {
    const career = createCareer(createLaunchCareerSetup(924));
    const userFixtures = career.fixtures
      .filter(
        (fixture) =>
          fixture.season === career.season &&
          (fixture.homeClubId === career.userClubId ||
            fixture.awayClubId === career.userClubId),
      )
      .sort(
        (left, right) => left.week - right.week || left.round - right.round,
      );
    const staleFixture = userFixtures[0];
    const futureFixture = userFixtures[1];
    if (staleFixture === undefined || futureFixture === undefined) {
      throw new Error('launch career needs at least two user fixtures');
    }

    const currentWeek = 2;
    const viewModel = homeViewModel({
      ...career,
      week: currentWeek,
      fixtures: career.fixtures.map((fixture) => {
        if (fixture.id === staleFixture.id) {
          return {
            ...fixture,
            week: currentWeek - 1,
            status: 'scheduled' as const,
          };
        }
        if (fixture.id === futureFixture.id) {
          return {
            ...fixture,
            week: currentWeek + 4,
            status: 'scheduled' as const,
          };
        }
        if (
          fixture.homeClubId === career.userClubId ||
          fixture.awayClubId === career.userClubId
        ) {
          return { ...fixture, status: 'played' as const };
        }
        return fixture;
      }),
    });

    expect(viewModel.nextFixture.id).toBe(futureFixture.id);
    expect(viewModel.nextMatchTimingLabel).toBe('In 4 weeks');
    expect(viewModel.isCurrentGameWeek).toBe(false);
  });

  it('marks a current Hero Cup tie as game week and shows that matchup', () => {
    const career = createCareer(createLaunchCareerSetup(2));
    const cupWeek = CUP_SETTLEMENT_WEEKS[0];
    const viewModel = homeViewModel({
      ...career,
      week: cupWeek,
      phase: 'manage',
    });

    expect(viewModel.isCurrentGameWeek).toBe(true);
    expect(viewModel.nextMatchTimingLabel).toBe('This week');
    expect(viewModel.nextFixture.competition).toBe('Hero Cup · Play-in');
    expect(viewModel.nextFixture.id).toContain('-cup-');
  });

  /**
   * The round came straight off the matchday as the engine's control value, so
   * the line read "Heldenpokal · Play-in" — a translated sentence with an
   * English word dropped into it. The cup's name was already localised, which
   * is what made the seam so visible.
   */
  it('names the cup round in German on the German desk', () => {
    const career = createCareer(createLaunchCareerSetup(3));
    const cupWeek = CUP_SETTLEMENT_WEEKS[0];
    const viewModel = homeViewModel(
      { ...career, week: cupWeek, phase: 'manage' },
      copyFor('de'),
    );

    expect(viewModel.nextFixture.competition).toBe('Heldenpokal · Vorrunde');
  });
});
