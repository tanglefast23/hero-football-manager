import { createCareer } from '../../game';
import { copyFor } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('recent form match details', () => {
  it('keeps the match week beside its result for the hover tip', () => {
    const initial = createCareer(createLaunchCareerSetup(20260810));
    const fixture = initial.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const userAtHome = fixture.homeClubId === initial.userClubId;
    const played = {
      ...fixture,
      week: 27,
      status: 'played' as const,
      score: userAtHome
        ? { homeGoals: 2, awayGoals: 1 }
        : { homeGoals: 1, awayGoals: 2 },
    };

    expect(
      homeViewModel({ ...initial, week: 28, fixtures: [played] }).form,
    ).toEqual([{ result: 'W', week: 27 }]);
    expect(copyFor('en')('clubHome.form.weekWon', { week: 27 })).toBe(
      'Week 27. Won. 3 points.',
    );
  });
});
