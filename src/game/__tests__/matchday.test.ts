import * as simMatch from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { MatchEvent, MatchState, TeamDef } from '../../sim/types';
import { quickResultForFixture, resolveMatchday } from '../matchday';
import type { FixtureResult, LeagueFixture } from '../types';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

/**
 * The minimum MatchState surface quickMatchForFixture reads from an
 * already-finished match: phase (so the tick loop never runs), the flat
 * 22-slot players array (home 0-10, away 11-21), events, and score.
 */
function fakeFulltimeMatch(score: [number, number], events: MatchEvent[]): MatchState {
  return {
    phase: 'fulltime',
    score,
    events,
    players: [...ROVERS.players, ...UNITED.players].map((def, index) => ({
      def,
      team: index < 11 ? 0 : 1,
    })),
  } as unknown as MatchState;
}

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
    // quickResultForFixture delegates to quickMatchForFixture (createMatch +
    // tick), so the policy seam is createMatch. A fake already-fulltime state
    // keeps the sim out of a unit test about option plumbing.
    const createMatch = jest.spyOn(simMatch, 'createMatch').mockReturnValue(
      fakeFulltimeMatch([3, 2], []),
    );
    const envelopeFrom = jest.spyOn(simMatch, 'envelopeFrom').mockReturnValue({} as never);

    try {
      expect(quickResultForFixture(fixture('auto-fire', UNITED.id, ROVERS.id, 77), TEAMS)).toEqual({
        fixtureId: 'auto-fire',
        homeGoals: 3,
        awayGoals: 2,
      });
      expect(createMatch).toHaveBeenCalledTimes(1);
      expect(createMatch).toHaveBeenCalledWith(77, UNITED, ROVERS, {
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'FIRE_WHEN_READY',
      });
    } finally {
      createMatch.mockRestore();
      envelopeFrom.mockRestore();
    }
  });

  test('credits goals to the FINAL slot occupant, not the starting XI', () => {
    // The regression this guards: scorers used to resolve against the original
    // TeamDef, so after a substitution the replacement's goal was credited to
    // the player who had been subbed off. Slot 1 here is occupied by a
    // substitute at fulltime.
    const substitute = { ...ROVERS.players[1], id: 'rovers-substitute' };
    const state = fakeFulltimeMatch([2, 1], [
      { t: 10, kind: 'GOAL', by: 1, team: 0 },
      { t: 20, kind: 'GOAL', by: 1, team: 0 },
      { t: 30, kind: 'GOAL', by: 12, team: 1 },
    ]);
    state.players[1] = { ...state.players[1], def: substitute };
    const createMatch = jest.spyOn(simMatch, 'createMatch').mockReturnValue(state);
    const envelopeFrom = jest.spyOn(simMatch, 'envelopeFrom').mockReturnValue({} as never);

    try {
      expect(quickResultForFixture(fixture('scorers'), TEAMS)).toMatchObject({
        homeGoals: 2,
        awayGoals: 1,
        scorerPlayerIds: [
          'rovers-substitute',
          'rovers-substitute',
          UNITED.players[1].id,
        ],
      });
    } finally {
      createMatch.mockRestore();
      envelopeFrom.mockRestore();
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
