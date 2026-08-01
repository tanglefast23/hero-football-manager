import { contributionsFrom } from '../../game/match-contributions';
import { goalsFrom } from '../../game/matchday';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

/**
 * The store builds its own FixtureResult from a watched MatchState instead of
 * going through fixtureResultFrom. This asserts the two agree, which is the
 * property that keeps watched and Quick Result leaderboards identical.
 */
describe('watched match contributions', () => {
  it('produces contributions consistent with the scorer list', () => {
    const match = createMatch(4242, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    while (match.phase !== 'fulltime') tick(match);

    const scorers = goalsFrom(match).map(goal => goal.playerId);
    const contributions = contributionsFrom(match);
    const goalsByPlayer = new Map<string, number>();
    for (const row of contributions) {
      if (row.goals > 0) goalsByPlayer.set(row.playerId, row.goals);
    }
    const expected = new Map<string, number>();
    for (const id of scorers) expected.set(id, (expected.get(id) ?? 0) + 1);

    expect(scorers.length).toBeGreaterThan(0);
    expect(goalsByPlayer).toEqual(expected);
    expect(contributions.reduce((sum, row) => sum + row.saves, 0)).toBeGreaterThan(0);
  });
});
