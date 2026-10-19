import { createLaunchCareerSetup } from '../../application/launch';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { conditionedRatingD64 } from '../../sim/contest';
import { createMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import {
  CUP_SETTLEMENT_WEEKS,
  activeCareerMatchday,
  completeMatchday,
  createCareer,
} from '../career';
import type { ProductionFixtureResult } from '../matchday';
import {
  PENALTY_EQUAL_CONVERSION_65536,
  penaltyConversion65536,
  penaltyFullTimeFromMatch,
  penaltyShootoutProblem,
  penaltyShootoutSeed,
  resolvePenaltyShootout,
  type PenaltyFullTime,
  type PenaltyShootout,
  type PenaltySide,
  type PenaltyTaker,
} from '../penalties';
import type { FixtureResult, GameState } from '../types';

function taker(
  playerId: string,
  sho: number,
  ref = 40,
  role: PenaltyTaker['role'] = 'MID',
  condition = 100,
): PenaltyTaker {
  return { playerId, name: playerId, role, sho, ref, condition };
}

function side(prefix: string, sho: number, keeperRef: number): PenaltySide {
  return {
    takers: [
      taker(`${prefix}-gk`, 20, keeperRef, 'GK'),
      ...Array.from({ length: 10 }, (_, index) =>
        taker(`${prefix}-${index + 1}`, sho),
      ),
    ],
    keeperId: `${prefix}-gk`,
  };
}

function monteCarlo(fullTime: PenaltyFullTime, runs = 4000) {
  let homeWins = 0;
  let kicks = 0;
  let scored = 0;
  for (let seed = 1; seed <= runs; seed += 1) {
    const shootout = resolvePenaltyShootout(seed * 2654435761, fullTime);
    if (shootout.winner === 'home') homeWins += 1;
    kicks += shootout.kicks.length;
    scored += shootout.kicks.filter((kick) => kick.scored).length;
  }
  return { homeWinRate: homeWins / runs, conversion: scored / kicks };
}

describe('Cup penalty shootouts', () => {
  test('converts 75% at an even contest, bounded to 55%..95%', () => {
    expect(penaltyConversion65536(taker('a', 60), taker('k', 0, 60))).toBe(
      PENALTY_EQUAL_CONVERSION_65536,
    );
    const best = penaltyConversion65536(taker('a', 999), taker('k', 0, 1));
    const worst = penaltyConversion65536(taker('a', 1), taker('k', 0, 999));
    expect(best).toBeLessThanOrEqual(Math.ceil(0.95 * 65536));
    expect(worst).toBeGreaterThanOrEqual(Math.floor(0.55 * 65536));
  });

  test('moves with shooting, reflexes and full-time condition', () => {
    const keeper = taker('k', 0, 80, 'GK');
    expect(penaltyConversion65536(taker('a', 120), keeper)).toBeGreaterThan(
      penaltyConversion65536(taker('a', 80), keeper),
    );
    expect(
      penaltyConversion65536(taker('a', 80), taker('k', 0, 120, 'GK')),
    ).toBeLessThan(penaltyConversion65536(taker('a', 80), keeper));
    expect(
      penaltyConversion65536(taker('a', 80, 40, 'MID', 40), keeper),
    ).toBeLessThan(penaltyConversion65536(taker('a', 80), keeper));
  });

  test('is a coin flip between equal sides and favours the stronger one', () => {
    const even = monteCarlo({
      home: side('h', 80, 80),
      away: side('a', 80, 80),
    });
    expect(Math.abs(even.homeWinRate - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(even.conversion - 0.75)).toBeLessThan(0.02);

    const stronger = monteCarlo({
      home: side('h', 140, 120),
      away: side('a', 80, 80),
    });
    expect(stronger.homeWinRate).toBeGreaterThan(0.6);
  });

  test('replays the same kicks for the same seed and squads', () => {
    const fullTime = { home: side('h', 90, 70), away: side('a', 70, 90) };
    expect(resolvePenaltyShootout(12345, fullTime)).toEqual(
      resolvePenaltyShootout(12345, fullTime),
    );
  });

  test('follows the legal order and finish for every seed', () => {
    const fullTime: PenaltyFullTime = {
      home: side('h', 90, 70),
      // A dismissed player leaves ten: the home side drops its weakest taker.
      away: {
        takers: side('a', 70, 90).takers.slice(0, 10),
        keeperId: 'a-gk',
      },
    };
    for (let seed = 1; seed <= 500; seed += 1) {
      const shootout = resolvePenaltyShootout(seed * 7919, fullTime);
      expect(penaltyShootoutProblem(shootout)).toBeUndefined();
      const home = shootout.kicks.filter((kick) => kick.side === 'home');
      const away = shootout.kicks.filter((kick) => kick.side === 'away');
      expect(
        new Set(home.map((kick) => kick.takerId)).size,
      ).toBeLessThanOrEqual(10);
      expect(home.every((kick) => kick.keeperId === 'a-gk')).toBe(true);
      expect(away.every((kick) => kick.keeperId === 'h-gk')).toBe(true);
      if (home.length >= 10) expect(home[9].takerId).toBe('h-gk');
      if (away.length >= 10) expect(away[9].takerId).toBe('a-gk');
      expect(shootout.winner === 'home').toBe(
        shootout.homeGoals > shootout.awayGoals,
      );
    }
  });

  test('orders outfield takers by conditioned shooting, keeper last', () => {
    const fullTime: PenaltyFullTime = {
      home: {
        takers: [
          taker('h-gk', 99, 60, 'GK'),
          taker('h-b', 70),
          taker('h-a', 70),
          taker('h-tired', 95, 40, 'FWD', 10),
          taker('h-top', 90),
        ],
        keeperId: 'h-gk',
      },
      away: side('a', 60, 60),
    };
    const expected = fullTime.home.takers
      .filter((entry) => entry.playerId !== 'h-gk')
      .slice()
      .sort(
        (left, right) =>
          conditionedRatingD64(right.sho, right.condition) -
            conditionedRatingD64(left.sho, left.condition) ||
          left.playerId.localeCompare(right.playerId),
      )
      .map((entry) => entry.playerId);
    // The equal 70s keep stable id order; the keeper always kicks last.
    expect(expected.indexOf('h-a')).toBeLessThan(expected.indexOf('h-b'));
    for (let seed = 1; seed <= 200; seed += 1) {
      const order = resolvePenaltyShootout(seed, fullTime)
        .kicks.filter((kick) => kick.side === 'home')
        .map((kick) => kick.takerId);
      expect(order.slice(0, 4)).toEqual(expected.slice(0, order.length));
      if (order.length >= 5) expect(order[4]).toBe('h-gk');
    }
  });

  test('refuses kick lists that could not have happened', () => {
    const legal = resolvePenaltyShootout(4242, {
      home: side('h', 80, 80),
      away: side('a', 80, 80),
    });
    const broken = (patch: Partial<PenaltyShootout>): PenaltyShootout => ({
      ...legal,
      ...patch,
    });
    expect(
      penaltyShootoutProblem(broken({ homeGoals: legal.homeGoals + 1 })),
    ).toBeDefined();
    expect(
      penaltyShootoutProblem(broken({ kicks: legal.kicks.slice(0, -1) })),
    ).toBeDefined();
    expect(
      penaltyShootoutProblem(
        broken({ kicks: [...legal.kicks, legal.kicks[0], legal.kicks[1]] }),
      ),
    ).toBeDefined();
    expect(
      penaltyShootoutProblem(
        broken({
          kicks: legal.kicks.map((kick, index) =>
            index === 2 ? { ...kick, takerId: legal.kicks[0].takerId } : kick,
          ),
        }),
      ),
    ).toBeDefined();
  });

  test('reads the full-time pitch without second-half speech lifts or dismissed players', () => {
    const bench = { ...ROVERS.players[7], id: 'r-sub', name: 'Sub' };
    const home: TeamDef = { ...ROVERS, bench: [bench] };
    const match = createMatch(7, home, UNITED, { controlledTeam: 0 });
    match.phase = 'fulltime';
    // A half-time speech replaces the def with lifted attributes.
    match.players[3].def = {
      ...match.players[3].def,
      attrs: { ...match.players[3].def.attrs, sho: 999 },
    };
    match.players[5].outReason = 'redcard';
    match.players[7].def = { ...bench, attrs: { ...bench.attrs, sho: 999 } };
    match.players[2].condition = 41;

    const fullTime = penaltyFullTimeFromMatch(match);
    const ids = fullTime.home.takers.map((entry) => entry.playerId);
    expect(fullTime.home.keeperId).toBe(ROVERS.players[0].id);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain(ROVERS.players[5].id);
    expect(ids).toContain('r-sub');
    expect(
      fullTime.home.takers.find(
        (entry) => entry.playerId === ROVERS.players[3].id,
      )?.sho,
    ).toBe(ROVERS.players[3].attrs.sho);
    expect(
      fullTime.home.takers.find((entry) => entry.playerId === 'r-sub')?.sho,
    ).toBe(bench.attrs.sho);
    expect(
      fullTime.home.takers.find(
        (entry) => entry.playerId === ROVERS.players[2].id,
      )?.condition,
    ).toBe(41);
    expect(fullTime.away.takers).toHaveLength(11);
  });

  describe('Cup settlement', () => {
    function levelCupTie(): {
      state: GameState;
      fixtureResult: FixtureResult;
      production: ProductionFixtureResult;
    } {
      const initial = createCareer(createLaunchCareerSetup(17));
      const state: GameState = {
        ...initial,
        week: CUP_SETTLEMENT_WEEKS[0],
        phase: 'matchday',
      };
      const fixture = activeCareerMatchday(state)!.fixture;
      const fixtureResult: FixtureResult = {
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 1,
      };
      const starterIds = state.lineups.find(
        (lineup) => lineup.clubId === state.userClubId,
      )!.playerIds;
      return {
        state,
        fixtureResult,
        production: {
          fixtureResult,
          goals: [],
          participantPlayerIds: starterIds,
          powerFiredPlayerIds: [],
          penaltyFullTime: {
            home: side(fixture.homeClubId, 80, 80),
            away: side(fixture.awayClubId, 80, 80),
          },
        },
      };
    }

    const cupFixture = (state: GameState, id: string) =>
      state
        .m2!.nationalCups.flatMap((cup) => cup.rounds)
        .flatMap((round) => round.fixtures)
        .find((candidate) => candidate.id === id)!;

    test('saves the kicks and takes the winner from them', () => {
      const { state, fixtureResult, production } = levelCupTie();
      const settled = completeMatchday(state, [fixtureResult], production);
      const saved = cupFixture(settled, fixtureResult.fixtureId);
      const expected = resolvePenaltyShootout(
        penaltyShootoutSeed(state.careerSeed, saved),
        production.penaltyFullTime!,
      );
      expect(saved.penalties).toEqual({
        homeGoals: expected.homeGoals,
        awayGoals: expected.awayGoals,
        kicks: expected.kicks,
      });
      expect(saved.winnerClubId).toBe(
        expected.winner === 'home' ? saved.homeClubId : saved.awayClubId,
      );
      expect(completeMatchday(state, [fixtureResult], production)).toEqual(
        settled,
      );

      const reloaded = parseStoredGameState(serializeGameState(settled));
      expect(cupFixture(reloaded, fixtureResult.fixtureId).penalties).toEqual(
        saved.penalties,
      );
      const tampered = JSON.parse(serializeGameState(settled));
      for (const cup of tampered.career?.m2?.nationalCups ??
        tampered.m2.nationalCups) {
        for (const round of cup.rounds) {
          for (const candidate of round.fixtures) {
            if (candidate.id === fixtureResult.fixtureId)
              candidate.penalties.homeGoals += 1;
          }
        }
      }
      expect(() => parseStoredGameState(JSON.stringify(tampered))).toThrow();
    });

    test('keeps the historical seed rule, with no kicks, without full-time squads', () => {
      const { state, fixtureResult, production } = levelCupTie();
      const { penaltyFullTime: _omitted, ...legacy } = production;
      const settled = completeMatchday(state, [fixtureResult], legacy);
      const saved = cupFixture(settled, fixtureResult.fixtureId);
      expect(saved.penalties).toBeUndefined();
      expect(saved.winnerClubId).toBeDefined();
      expect(
        cupFixture(
          parseStoredGameState(serializeGameState(settled)),
          fixtureResult.fixtureId,
        ).penalties,
      ).toBeUndefined();
    });
  });
});
