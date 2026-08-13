import { attemptShot, shotFlightTick } from '../../sim/engine';
import { GOAL_CENTER_X } from '../../sim/geometry';
import { performSubstitution } from '../../sim/substitutions';
import * as simMatch from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { MatchEvent, MatchState, TeamDef } from '../../sim/types';
import {
  controlledMatchOptions,
  queueControlledAutoSubstitution,
} from '../match-policy';
import {
  goalsFrom,
  productionResultFromMatch,
  quickMatchForFixture,
  quickResultForFixture,
  resolveMatchday,
} from '../matchday';
import type { FixtureResult, LeagueFixture } from '../types';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function withEmergencyBench(team: TeamDef): TeamDef {
  const benchIndexes = [1, 2, 5, 6, 9] as const;
  return {
    ...team,
    players: team.players.map((player) =>
      player.role === 'GK' ? player : { ...player, startingCondition: 20 },
    ),
    bench: benchIndexes.map((playerIndex, benchIndex) => ({
      ...team.players[playerIndex],
      id: `${team.id}-bench-${benchIndex}`,
      name: `${team.players[playerIndex].name} Reserve ${benchIndex + 1}`,
      startingCondition: 100,
    })),
  };
}

/**
 * The minimum MatchState surface quickMatchForFixture reads from an
 * already-finished match: phase (so the tick loop never runs), the flat
 * 22-slot players array (home 0-10, away 11-21), events, score, and the decoy
 * clone pair the contribution fold resolves entities 22 and 23 through.
 */
function fakeFulltimeMatch(
  score: [number, number],
  events: MatchEvent[],
): MatchState {
  return {
    phase: 'fulltime',
    score,
    events,
    decoyClones: [null, null],
    players: [...ROVERS.players, ...UNITED.players].map((def, index) => ({
      def,
      team: index < 11 ? 0 : 1,
    })),
    // Scorer resolution names players who have already left the pitch, so it
    // reads the match-owned team copies rather than the live 22.
    teams: [ROVERS, UNITED],
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

    expect(quickResultForFixture(scheduled, TEAMS)).toEqual(
      quickResultForFixture(scheduled, TEAMS),
    );
  });

  test('auto-fires heroes for both teams regardless of venue', () => {
    // quickResultForFixture delegates to quickMatchForFixture (createMatch +
    // tick), so the policy seam is createMatch. A fake already-fulltime state
    // keeps the sim out of a unit test about option plumbing.
    const createMatch = jest
      .spyOn(simMatch, 'createMatch')
      .mockReturnValue(fakeFulltimeMatch([3, 2], []));
    const envelopeFrom = jest
      .spyOn(simMatch, 'envelopeFrom')
      .mockReturnValue({} as never);

    try {
      expect(
        quickResultForFixture(
          fixture('auto-fire', UNITED.id, ROVERS.id, 77),
          TEAMS,
        ),
      ).toEqual({
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

  test('credits each goal to whoever held the shirt when it went in', () => {
    // GOAL events carry the scorer's stable id, stamped at shot launch, so a
    // substitution between two goals from the same slot cannot smear either
    // goal onto the wrong player. Slot 1 scores once before the swap and once
    // after it, so only time-correct attribution passes.
    const substitute = {
      ...ROVERS.players[1],
      id: 'rovers-substitute',
      name: 'Sub Striker',
    };
    const state = fakeFulltimeMatch(
      [2, 1],
      [
        {
          t: 10,
          kind: 'GOAL',
          by: 1,
          team: 0,
          scoredById: ROVERS.players[1].id,
        },
        {
          t: 15,
          kind: 'SUBSTITUTION',
          team: 0,
          player: 1,
          outPlayerId: ROVERS.players[1].id,
          inPlayerId: substitute.id,
        },
        { t: 20, kind: 'GOAL', by: 1, team: 0, scoredById: substitute.id },
        {
          t: 30,
          kind: 'GOAL',
          by: 12,
          team: 1,
          scoredById: UNITED.players[1].id,
        },
      ],
    );
    state.players[1] = { ...state.players[1], def: substitute };
    const createMatch = jest
      .spyOn(simMatch, 'createMatch')
      .mockReturnValue(state);
    const envelopeFrom = jest
      .spyOn(simMatch, 'envelopeFrom')
      .mockReturnValue({} as never);

    try {
      expect(quickResultForFixture(fixture('scorers'), TEAMS)).toMatchObject({
        homeGoals: 2,
        awayGoals: 1,
        scorerPlayerIds: [
          ROVERS.players[1].id,
          'rovers-substitute',
          UNITED.players[1].id,
        ],
      });
    } finally {
      createMatch.mockRestore();
      envelopeFrom.mockRestore();
    }
  });

  test('credits the shooter when the ball crossed after his replacement came on', () => {
    // Seed 23: the shot was struck at tick 135, the substitute came on at 136,
    // and the ball crossed at 144 — so the slot walk, which can only see where
    // the ball ENDED, gave the goal to a man who was on the bench when it was
    // hit. Engine m2.2 stamps the shooter's own id at the strike; it wins.
    const substitute = {
      ...ROVERS.players[1],
      id: 'rovers-substitute',
      name: 'Sub Striker',
    };
    const state = fakeFulltimeMatch(
      [1, 0],
      [
        {
          t: 136,
          kind: 'SUBSTITUTION',
          team: 0,
          player: 1,
          outPlayerId: ROVERS.players[1].id,
          inPlayerId: substitute.id,
        },
        {
          t: 144,
          kind: 'GOAL',
          by: 1,
          team: 0,
          scoredById: ROVERS.players[1].id,
        },
      ],
    );
    state.players[1] = { ...state.players[1], def: substitute };

    expect(goalsFrom(state)).toEqual([
      {
        playerId: ROVERS.players[1].id,
        name: ROVERS.players[1].name,
        tick: 144,
      },
    ]);
  });

  test('a real mid-flight substitution does not steal the goal end to end', () => {
    // The two tests above hand-build a GOAL event carrying `scoredById`, so
    // they only prove the READER. If the engine stopped stamping the shooter's
    // id they would both stay green while every player-visible surface — the
    // highlight, the scorer list, the season top-scorer table — went back to
    // crediting the substitute. This drives the real engine instead: strike a
    // shot, swap the shooter out while the ball is still travelling, and read
    // the id the settled fixture actually banks.
    const substitute = {
      ...ROVERS.players[1],
      id: 'rovers-late-sub',
      name: 'Late Sub',
    };
    const state = simMatch.createMatch(
      23,
      { ...ROVERS, bench: [substitute] },
      UNITED,
      { controlledTeam: 0 },
    );
    const slot = 10;
    const shooterId = state.players[slot].def.id;

    attemptShot(state, slot, 2000);
    if (state.ball.kind !== 'shot') throw new Error('no shot was produced');
    // keeperChecked skips the save roll, so no RNG decides whether this test
    // sees a GOAL at all.
    state.ball.targetX = GOAL_CENTER_X;
    state.ball.pos = { x: GOAL_CENTER_X, y: 300 };
    state.ball.vel = { x: 0, y: -300 };
    state.ball.z = 0;
    state.ball.vz = 0;
    state.ball.keeperChecked = true;

    expect(performSubstitution(state, 0, slot, substitute.id)).toBe(true);
    expect(state.players[slot].def.id).toBe(substitute.id);
    shotFlightTick(state);

    const scored = goalsFrom(state);
    expect(scored).toHaveLength(1);
    expect(scored[0].playerId).toBe(shooterId);
    expect(scored[0].playerId).not.toBe(substitute.id);
  });

  test('names the scorer even after he has left the pitch', () => {
    // The highlight reel labels goals by name, and a subbed-off scorer is no
    // longer in the live 22 — his name has to come from the team copies.
    const substitute = {
      ...ROVERS.players[1],
      id: 'rovers-substitute',
      name: 'Sub Striker',
    };
    const state = fakeFulltimeMatch(
      [1, 0],
      [
        {
          t: 10,
          kind: 'GOAL',
          by: 1,
          team: 0,
          scoredById: ROVERS.players[1].id,
        },
        {
          t: 15,
          kind: 'SUBSTITUTION',
          team: 0,
          player: 1,
          outPlayerId: ROVERS.players[1].id,
          inPlayerId: substitute.id,
        },
      ],
    );
    state.players[1] = { ...state.players[1], def: substitute };

    expect(goalsFrom(state)).toEqual([
      {
        playerId: ROVERS.players[1].id,
        name: ROVERS.players[1].name,
        tick: 10,
      },
    ]);
  });

  test('validates fixture state, match seed, and both teams', () => {
    expect(() =>
      quickResultForFixture({ ...fixture('played'), status: 'played' }, TEAMS),
    ).toThrow('scheduled');
    expect(() =>
      quickResultForFixture(
        { ...fixture('scored'), score: { homeGoals: 1, awayGoals: 0 } },
        TEAMS,
      ),
    ).toThrow('unplayed');
    expect(() =>
      quickResultForFixture({ ...fixture('bad-seed'), matchSeed: -1 }, TEAMS),
    ).toThrow('uint32');
    expect(() =>
      quickResultForFixture(fixture('missing', 'unknown'), TEAMS),
    ).toThrow('missing sim team');

    const tenPlayerTeam = { ...ROVERS, players: ROVERS.players.slice(0, 10) };
    expect(() =>
      quickResultForFixture(fixture('short'), {
        ...TEAMS,
        [ROVERS.id]: tenPlayerTeam,
      }),
    ).toThrow('exactly 11 players');

    const duplicateIdTeam = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) =>
        index === 1 ? { ...player, id: ROVERS.players[0].id } : player,
      ),
    };
    expect(() =>
      quickResultForFixture(fixture('duplicate-player'), {
        ...TEAMS,
        [ROVERS.id]: duplicateIdTeam,
      }),
    ).toThrow('player IDs must be unique');

    const invalidRoleTeam = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) =>
        index === 1
          ? { ...player, role: 'SWEEPER' as TeamDef['players'][number]['role'] }
          : player,
      ),
    };
    expect(() =>
      quickResultForFixture(fixture('invalid-role'), {
        ...TEAMS,
        [ROVERS.id]: invalidRoleTeam,
      }),
    ).toThrow('invalid role');
  });

  test('preserves the existing fully automatic replay when no user policy is supplied', () => {
    const scheduled = fixture('legacy-envelope', ROVERS.id, UNITED.id, 91);
    const quick = quickMatchForFixture(scheduled, TEAMS);
    const legacy = simMatch.createMatch(91, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    while (legacy.phase !== 'fulltime') simMatch.tick(legacy);

    expect(quick.replay).toEqual(simMatch.envelopeFrom(legacy));
    expect(quick.match.events).toEqual(legacy.events);
    expect(quick.result).toEqual(quickResultForFixture(scheduled, TEAMS));
  });
});

describe('production user-match adapter', () => {
  test('orders participants by entry and resolves powers to the event-time shirt owner', () => {
    const substitute = {
      ...ROVERS.players[9],
      id: 'rovers-fire-substitute',
      name: 'Ash Ember',
    };
    const home = { ...ROVERS, bench: [substitute] };
    const scheduled = fixture('production-facts');
    const state = fakeFulltimeMatch(
      [0, 0],
      [
        {
          t: 10,
          kind: 'POWER_FIRED',
          player: 9,
          power: 'FIRE_TORCH',
          strength: 1,
        },
        {
          t: 11,
          kind: 'SUBSTITUTION',
          team: 0,
          player: 9,
          outPlayerId: ROVERS.players[9].id,
          inPlayerId: substitute.id,
        },
        {
          t: 12,
          kind: 'POWER_FIRED',
          player: 9,
          power: 'FIRE_TORCH',
          strength: 1,
        },
        {
          t: 13,
          kind: 'POWER_FIRED',
          player: 9,
          power: 'FIRE_TORCH',
          strength: 1,
        },
      ],
    );
    state.seed = scheduled.matchSeed;
    state.teams = [home, UNITED];
    state.players[9] = { ...state.players[9], def: substitute };

    const production = productionResultFromMatch(scheduled, state, ROVERS.id);

    expect(production.fixtureResult).toEqual({
      fixtureId: scheduled.id,
      homeGoals: 0,
      awayGoals: 0,
      scorerPlayerIds: [],
    });
    expect(production.participantPlayerIds).toEqual([
      ...ROVERS.players.map((player) => player.id),
      substitute.id,
    ]);
    expect(production.powerFiredPlayerIds).toEqual([
      ROVERS.players[9].id,
      substitute.id,
    ]);
  });

  test('rejects a watched state from the wrong fixture rather than attributing it', () => {
    const scheduled = fixture('right-fixture', ROVERS.id, UNITED.id, 42);
    const state = fakeFulltimeMatch([0, 0], []);
    state.seed = 43;

    expect(() =>
      productionResultFromMatch(scheduled, state, ROVERS.id),
    ).toThrow('match seed does not match');
  });
});

describe('Quick Result policy B parity', () => {
  const formation = '3-5-2' as const;
  const benchRovers = withEmergencyBench(ROVERS);
  const benchUnited = withEmergencyBench(UNITED);

  test.each([
    {
      label: 'home, Auto Subs off',
      userHome: true,
      autoSubs: false,
      benches: true,
    },
    {
      label: 'away, Auto Subs off',
      userHome: false,
      autoSubs: false,
      benches: true,
    },
    {
      label: 'home, Auto Subs on',
      userHome: true,
      autoSubs: true,
      benches: true,
    },
    {
      label: 'away, Auto Subs on',
      userHome: false,
      autoSubs: true,
      benches: true,
    },
    { label: 'home, no bench', userHome: true, autoSubs: true, benches: false },
  ])(
    'matches the watched zero-input path: $label',
    ({ userHome, autoSubs, benches }) => {
      const user = benches ? benchRovers : ROVERS;
      const opponent = benches ? benchUnited : UNITED;
      const home = userHome ? user : opponent;
      const away = userHome ? opponent : user;
      const scheduled = fixture(
        `policy-b-${userHome ? 'home' : 'away'}-${autoSubs ? 'on' : 'off'}-${benches ? 'bench' : 'bare'}`,
        home.id,
        away.id,
        404,
      );
      const teams = { [home.id]: home, [away.id]: away };
      const controlledTeam: 0 | 1 = userHome ? 0 : 1;

      // MatchScreen may catch up several engine ticks in one presentation frame.
      // Auto Subs must still run after each actual tick, not once after the batch.
      const watched = simMatch.createMatch(
        scheduled.matchSeed,
        home,
        away,
        controlledMatchOptions(controlledTeam, formation),
      );
      const catchUpFrames = [5, 3, 1, 4, 2] as const;
      let frame = 0;
      while (watched.phase !== 'fulltime') {
        const ticksThisFrame = catchUpFrames[frame % catchUpFrames.length];
        for (let step = 0; step < ticksThisFrame; step += 1) {
          simMatch.tick(watched);
          queueControlledAutoSubstitution(watched, autoSubs);
        }
        frame += 1;
      }

      const quick = quickMatchForFixture(scheduled, teams, {
        userClubId: user.id,
        initialFormation: formation,
        autoSubs,
      });

      expect(quick.replay).toEqual(simMatch.envelopeFrom(watched));
      expect(quick.match.score).toEqual(watched.score);
      expect(quick.match.events).toEqual(watched.events);
      expect(quick.match.substitutionsUsed).toEqual(watched.substitutionsUsed);
      expect(
        quick.match.players.map((player) => ({
          id: player.def.id,
          condition: player.condition,
          outReason: player.outReason,
        })),
      ).toEqual(
        watched.players.map((player) => ({
          id: player.def.id,
          condition: player.condition,
          outReason: player.outReason,
        })),
      );
      expect(quick.production).toEqual(
        productionResultFromMatch(scheduled, watched, user.id),
      );
      const controlledInputs = quick.replay.inputs.filter(
        (input) => input.kind === 'SUBSTITUTE',
      );
      expect(controlledInputs.length > 0).toBe(autoSubs && benches);
    },
  );
});

describe('resolveMatchday', () => {
  test('preserves a supplied watched result and quick-resolves every other fixture in order', () => {
    const fixtures = [
      fixture('watched', ROVERS.id, UNITED.id, 7),
      fixture('quick', UNITED.id, ROVERS.id, 8),
    ];
    const watched: FixtureResult = {
      fixtureId: 'watched',
      homeGoals: 9,
      awayGoals: 8,
    };

    const results = resolveMatchday(fixtures, TEAMS, [watched]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(watched);
    expect(results[1]).toEqual(quickResultForFixture(fixtures[1], TEAMS));
    expect(results.map((result) => result.fixtureId)).toEqual([
      'watched',
      'quick',
    ]);
  });

  test('rejects unknown, duplicate, and malformed supplied results before simulation', () => {
    const fixtures = [fixture('fixture-1')];
    const valid: FixtureResult = {
      fixtureId: 'fixture-1',
      homeGoals: 1,
      awayGoals: 0,
    };

    expect(() =>
      resolveMatchday(fixtures, TEAMS, [{ ...valid, fixtureId: 'unknown' }]),
    ).toThrow('unknown fixture');
    expect(() =>
      resolveMatchday(fixtures, TEAMS, [valid, { ...valid }]),
    ).toThrow('duplicate supplied');
    expect(() =>
      resolveMatchday(fixtures, TEAMS, [{ ...valid, homeGoals: -1 }]),
    ).toThrow('non-negative integer');
    expect(() =>
      resolveMatchday(fixtures, TEAMS, [{ ...valid, awayGoals: 1.5 }]),
    ).toThrow('non-negative integer');
    expect(() =>
      resolveMatchday(fixtures, TEAMS, [{ ...valid, homeGoals: Number.NaN }]),
    ).toThrow('non-negative integer');
    expect(() =>
      resolveMatchday(fixtures, TEAMS, [
        {
          ...valid,
          homeGoals: Number.MAX_SAFE_INTEGER + 1,
        },
      ]),
    ).toThrow('non-negative integer');
  });

  test('rejects duplicate fixture IDs and missing teams even for supplied results', () => {
    const scheduled = fixture('fixture-1');
    const supplied: FixtureResult = {
      fixtureId: scheduled.id,
      homeGoals: 1,
      awayGoals: 0,
    };

    expect(() =>
      resolveMatchday([scheduled, { ...scheduled }], TEAMS, [supplied]),
    ).toThrow('duplicate fixture ID');
    expect(() =>
      resolveMatchday([scheduled], { [ROVERS.id]: ROVERS }, [supplied]),
    ).toThrow('missing sim team');
  });

  test('does not mutate fixture, team, or supplied-result inputs', () => {
    const fixtures = [
      fixture('watched', ROVERS.id, UNITED.id, 10),
      fixture('quick', UNITED.id, ROVERS.id, 11),
    ];
    const supplied: FixtureResult[] = [
      { fixtureId: 'watched', homeGoals: 2, awayGoals: 1 },
    ];
    const fixturesBefore = JSON.stringify(fixtures);
    const teamsBefore = JSON.stringify(TEAMS);
    const suppliedBefore = JSON.stringify(supplied);

    resolveMatchday(fixtures, TEAMS, supplied);

    expect(JSON.stringify(fixtures)).toBe(fixturesBefore);
    expect(JSON.stringify(TEAMS)).toBe(teamsBefore);
    expect(JSON.stringify(supplied)).toBe(suppliedBefore);
  });
});
