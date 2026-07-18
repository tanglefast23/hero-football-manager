import * as simMatch from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { quickResultForFixture, resolveMatchday } from '../matchday';
import type { FixtureResult, LeagueFixture } from '../types';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(
  id: string,
  homeClubId = ROVERS.id,
  awayClubId = UNITED.id,
  matchSeed = 42,
): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId,
    awayClubId,
    matchSeed,
    status: 'scheduled',
  };
}

describe('quickResultForFixture', () => {
  test('returns the same score for the same fixture and teams', () => {
    const scheduled = fixture('fixture-1');

    expect(quickResultForFixture(scheduled, TEAMS)).toEqual(quickResultForFixture(scheduled, TEAMS));
  });

  test('auto-fires heroes for both teams regardless of venue', () => {
    const runMatch = jest.spyOn(simMatch, 'runMatch').mockReturnValue({ score: [3, 2], events: [] });

    try {
      expect(quickResultForFixture(fixture('auto-fire', UNITED.id, ROVERS.id, 77), TEAMS)).toEqual({
        fixtureId: 'auto-fire',
        homeGoals: 3,
        awayGoals: 2,
      });
      expect(runMatch).toHaveBeenCalledTimes(1);
      expect(runMatch).toHaveBeenCalledWith(77, UNITED, ROVERS, [], {
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'FIRE_WHEN_READY',
      });
    } finally {
      runMatch.mockRestore();
    }
  });

  test('validates fixture state, match seed, and both teams', () => {
    expect(() => quickResultForFixture({ ...fixture('played'), status: 'played' }, TEAMS)).toThrow('scheduled');
    expect(() => quickResultForFixture({ ...fixture('scored'), score: { homeGoals: 1, awayGoals: 0 } }, TEAMS))
      .toThrow('unplayed');
    expect(() => quickResultForFixture({ ...fixture('bad-seed'), matchSeed: -1 }, TEAMS)).toThrow('uint32');
    expect(() => quickResultForFixture(fixture('missing', 'unknown'), TEAMS)).toThrow('missing sim team');

    const tenPlayerTeam = { ...ROVERS, players: ROVERS.players.slice(0, 10) };
    expect(() => quickResultForFixture(fixture('short'), { ...TEAMS, [ROVERS.id]: tenPlayerTeam }))
      .toThrow('exactly 11 players');

    const duplicateIdTeam = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) => (
        index === 1 ? { ...player, id: ROVERS.players[0].id } : player
      )),
    };
    expect(() => quickResultForFixture(fixture('duplicate-player'), {
      ...TEAMS,
      [ROVERS.id]: duplicateIdTeam,
    })).toThrow('player IDs must be unique');

    const invalidRoleTeam = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) => (
        index === 1 ? { ...player, role: 'SWEEPER' as TeamDef['players'][number]['role'] } : player
      )),
    };
    expect(() => quickResultForFixture(fixture('invalid-role'), {
      ...TEAMS,
      [ROVERS.id]: invalidRoleTeam,
    })).toThrow('invalid role');
  });
});

describe('resolveMatchday', () => {
  test('preserves a supplied watched result and quick-resolves every other fixture in order', () => {
    const fixtures = [
      fixture('watched', ROVERS.id, UNITED.id, 7),
      fixture('quick', UNITED.id, ROVERS.id, 8),
    ];
    const watched: FixtureResult = { fixtureId: 'watched', homeGoals: 9, awayGoals: 8 };

    const results = resolveMatchday(fixtures, TEAMS, [watched]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(watched);
    expect(results[1]).toEqual(quickResultForFixture(fixtures[1], TEAMS));
    expect(results.map(result => result.fixtureId)).toEqual(['watched', 'quick']);
  });

  test('rejects unknown, duplicate, and malformed supplied results before simulation', () => {
    const fixtures = [fixture('fixture-1')];
    const valid: FixtureResult = { fixtureId: 'fixture-1', homeGoals: 1, awayGoals: 0 };

    expect(() => resolveMatchday(fixtures, TEAMS, [{ ...valid, fixtureId: 'unknown' }])).toThrow('unknown fixture');
    expect(() => resolveMatchday(fixtures, TEAMS, [valid, { ...valid }])).toThrow('duplicate supplied');
    expect(() => resolveMatchday(fixtures, TEAMS, [{ ...valid, homeGoals: -1 }])).toThrow('non-negative integer');
    expect(() => resolveMatchday(fixtures, TEAMS, [{ ...valid, awayGoals: 1.5 }])).toThrow('non-negative integer');
    expect(() => resolveMatchday(fixtures, TEAMS, [{ ...valid, homeGoals: Number.NaN }])).toThrow('non-negative integer');
    expect(() => resolveMatchday(fixtures, TEAMS, [{
      ...valid,
      homeGoals: Number.MAX_SAFE_INTEGER + 1,
    }])).toThrow('non-negative integer');
  });

  test('rejects duplicate fixture IDs and missing teams even for supplied results', () => {
    const scheduled = fixture('fixture-1');
    const supplied: FixtureResult = { fixtureId: scheduled.id, homeGoals: 1, awayGoals: 0 };

    expect(() => resolveMatchday([scheduled, { ...scheduled }], TEAMS, [supplied])).toThrow('duplicate fixture ID');
    expect(() => resolveMatchday([scheduled], { [ROVERS.id]: ROVERS }, [supplied])).toThrow('missing sim team');
  });

  test('does not mutate fixture, team, or supplied-result inputs', () => {
    const fixtures = [
      fixture('watched', ROVERS.id, UNITED.id, 10),
      fixture('quick', UNITED.id, ROVERS.id, 11),
    ];
    const supplied: FixtureResult[] = [{ fixtureId: 'watched', homeGoals: 2, awayGoals: 1 }];
    const fixturesBefore = JSON.stringify(fixtures);
    const teamsBefore = JSON.stringify(TEAMS);
    const suppliedBefore = JSON.stringify(supplied);

    resolveMatchday(fixtures, TEAMS, supplied);

    expect(JSON.stringify(fixtures)).toBe(fixturesBefore);
    expect(JSON.stringify(TEAMS)).toBe(teamsBefore);
    expect(JSON.stringify(supplied)).toBe(suppliedBefore);
  });
});
