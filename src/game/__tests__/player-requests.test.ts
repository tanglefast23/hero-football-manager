import { loadLaunchContent } from '../../content';
import { createLaunchCareerSetup } from '../../application/launch';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { createCareer } from '../career';
import { careerDifficulty } from '../difficulty';
import { runHeadlessFullCareer } from '../headless';
import { playerLoyalty } from '../loyalty';
import { buildCareerTeamDef } from '../squad';
import { trainPlayerInstantly } from '../training';
import {
  DEFAULT_PLAYER_REQUEST_STATE,
  STAR_FAME_THRESHOLD,
  absenceWeeksFor,
  advancePlayerRequests,
  canAffordRequest,
  drillMultiplierPercent,
  eligibleAskers,
  pickAsker,
  requestChancePercent,
  requestDefinition,
  requestMoneyCost,
  resolvePlayerRequest,
  requestTarget,
  resolutionDeltas,
  starQualifiers,
  tickRequestEffects,
  totalAskerWeight,
  weightForPlayer,
} from '../player-requests';
import { SEASON_WEEKS, type CareerPlayer, type GameState } from '../types';

/**
 * Tests may read content; production `src/game/*` may not. Every entry point
 * takes the catalog as an argument, so this is the only place in the request
 * tests that touches the loader.
 */
const CATALOG = loadLaunchContent().playerRequests;

function player(overrides: Partial<CareerPlayer> & { id: string }): CareerPlayer {
  return {
    clubId: 'user-club',
    name: overrides.id,
    role: 'FWD',
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    licensed: false,
    weeklyWage: 500,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 60,
    injuryWeeks: 0,
    seasonsAtClub: 2,
    fame: 0,
    condition: 100,
    ...overrides,
  } as CareerPlayer;
}

const COZY = { minWeeks: 8, guaranteeWeeks: 12, starMinWeeks: 6, starGuaranteeWeeks: 10 };

describe('requestChancePercent', () => {
  it('is zero before the minimum gap', () => {
    expect(requestChancePercent(0, COZY, false, 25)).toBe(0);
    expect(requestChancePercent(7, COZY, false, 25)).toBe(0);
  });

  it('opens at the base chance on the minimum week', () => {
    expect(requestChancePercent(8, COZY, false, 25)).toBe(25);
  });

  it('reaches certainty on the guarantee week and stays there', () => {
    expect(requestChancePercent(12, COZY, false, 25)).toBe(100);
    expect(requestChancePercent(40, COZY, false, 25)).toBe(100);
  });

  it('rises rather than jumping, so a wait reads as patience running out', () => {
    const ramp = [9, 10, 11].map(week => requestChancePercent(week, COZY, false, 25));

    expect(ramp[0]).toBeGreaterThan(25);
    expect(ramp[1]).toBeGreaterThan(ramp[0]);
    expect(ramp[2]).toBeGreaterThan(ramp[1]);
    expect(ramp[2]).toBeLessThan(100);
  });

  it('uses the tighter star window when a star is on the books', () => {
    expect(requestChancePercent(6, COZY, true, 25)).toBe(25);
    expect(requestChancePercent(10, COZY, true, 25)).toBe(100);
    // The same week is likelier with a star than without one.
    expect(requestChancePercent(9, COZY, true, 25))
      .toBeGreaterThan(requestChancePercent(9, COZY, false, 25));
  });

  it('rejects a negative dry-week count', () => {
    expect(() => requestChancePercent(-1, COZY, false, 25)).toThrow('nonnegative');
  });
});

describe('starQualifiers', () => {
  const league = (season: number, playerId: string, goals: number) => ({
    season,
    playerId,
    competition: 'league' as const,
    goals,
  });
  const statLines = [
    league(2, 'a', 9),
    league(2, 'b', 12),
    league(2, 'c', 4),
    league(1, 'd', 30),
  ];

  it('names the top two scorers in the division this season', () => {
    expect(starQualifiers(statLines, 2, 2)).toEqual(['b', 'a']);
  });

  it('ignores other seasons and goalless players', () => {
    expect(starQualifiers(statLines, 2, 5)).toEqual(['b', 'a', 'c']);
    expect(starQualifiers([league(2, 'e', 0)], 2, 2)).toEqual([]);
  });

  it('ignores cup goals, so the board stays a division board', () => {
    const withCup = [
      league(2, 'a', 9),
      { season: 2, playerId: 'f', competition: 'cup' as const, goals: 40 },
    ];
    expect(starQualifiers(withCup, 2, 2)).toEqual(['a']);
  });

  it('sums a mid-season transfer\'s rows into the one player he is', () => {
    const transferred = [
      league(2, 'a', 9),
      // Two league rows, one per club, the way stat lines are keyed.
      league(2, 'b', 5),
      league(2, 'b', 6),
    ];
    expect(starQualifiers(transferred, 2, 1)).toEqual(['b']);
  });
});

describe('weightForPlayer', () => {
  it('is 1 for an anonymous player', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 10 }), [])).toBe(1);
  });

  it('doubles for a famous player', () => {
    expect(weightForPlayer(player({ id: 'a', fame: STAR_FAME_THRESHOLD }), [])).toBe(2);
  });

  it('doubles for a division goal leader', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 10 }), ['a'])).toBe(2);
  });

  it('compounds to 4 for a famous goal leader', () => {
    expect(weightForPlayer(player({ id: 'a', fame: STAR_FAME_THRESHOLD }), ['a'])).toBe(4);
  });
});

describe('eligibleAskers', () => {
  const roster = [
    player({ id: 'fit' }),
    player({ id: 'injured', injuryWeeks: 2 }),
    player({ id: 'away', awayWeeks: 1 }),
    player({ id: 'new', seasonsAtClub: 0 }),
    player({ id: 'listed', transferRequested: true }),
    player({ id: 'previous' }),
  ];

  it('excludes injured, away and the previous asker', () => {
    const ids = eligibleAskers(roster, {
      lastAskingPlayerId: 'previous',
      minSeasonsAtClub: 0,
      absence: false,
    }).map(candidate => candidate.id);

    expect(ids).toContain('fit');
    expect(ids).not.toContain('injured');
    expect(ids).not.toContain('away');
    expect(ids).not.toContain('previous');
  });

  /**
   * Wanting a move and wanting a new gym are different things.
   *
   * This exclusion used to exist and it starved the feature: a measured six
   * seasons leaves 14–15 of a 16-man squad genuinely listed by season 3, which
   * silenced the tab for 43–52% of settled weeks even when every request was
   * granted on sight. A listed player asking is also the only way the manager
   * can talk him round, since granting pays morale toward his withdrawal line.
   */
  it('lets a transfer-listed player ask', () => {
    const ids = eligibleAskers(roster, { minSeasonsAtClub: 0, absence: false })
      .map(candidate => candidate.id);

    expect(ids).toContain('listed');
  });

  it('excludes a player in their first season at the club', () => {
    const ids = eligibleAskers(roster, { minSeasonsAtClub: 1, absence: false })
      .map(candidate => candidate.id);

    expect(ids).not.toContain('new');
    expect(ids).toContain('fit');
  });

  it('never sends away the only fit goalkeeper', () => {
    const squad = [player({ id: 'keeper', role: 'GK' }), player({ id: 'striker' })];

    expect(eligibleAskers(squad, { minSeasonsAtClub: 0, absence: true }).map(c => c.id))
      .toEqual(['striker']);
  });

  it('does let a backed-up goalkeeper go away', () => {
    const squad = [
      player({ id: 'keeper', role: 'GK' }),
      player({ id: 'reserve-keeper', role: 'GK' }),
    ];

    expect(eligibleAskers(squad, { minSeasonsAtClub: 0, absence: true }).map(c => c.id))
      .toEqual(['keeper', 'reserve-keeper']);
  });

  it('counts an injured backup keeper as no backup at all', () => {
    const squad = [
      player({ id: 'keeper', role: 'GK' }),
      player({ id: 'reserve-keeper', role: 'GK', injuryWeeks: 3 }),
    ];

    expect(eligibleAskers(squad, { minSeasonsAtClub: 0, absence: true }).map(c => c.id))
      .toEqual([]);
  });

  it('excludes a starter whose absence the lineup cannot survive', () => {
    // A bare-eleven roster can reach here through player sales. Granting leave
    // to any starter then throws inside lineup repair, so the ask must never be
    // offered in the first place.
    const squad = [player({ id: 'starter' }), player({ id: 'reserve' })];

    const ids = eligibleAskers(squad, {
      minSeasonsAtClub: 0,
      absence: true,
      lineupSurvivesAbsence: candidate => candidate.id !== 'starter',
    }).map(candidate => candidate.id);

    expect(ids).toEqual(['reserve']);
  });

  it('ignores the lineup check for a request that keeps the player home', () => {
    const squad = [player({ id: 'starter' }), player({ id: 'reserve' })];

    const ids = eligibleAskers(squad, {
      minSeasonsAtClub: 0,
      absence: false,
      lineupSurvivesAbsence: () => false,
    }).map(candidate => candidate.id);

    expect(ids).toEqual(['starter', 'reserve']);
  });
});

describe('pickAsker', () => {
  it('is deterministic for the same roll and respects weight', () => {
    const roster = [player({ id: 'a' }), player({ id: 'b', fame: STAR_FAME_THRESHOLD })];

    expect(totalAskerWeight(roster, [])).toBe(3);
    expect(pickAsker(roster, [], 0)?.id).toBe('a');
    expect(pickAsker(roster, [], 1)?.id).toBe('b');
    expect(pickAsker(roster, [], 2)?.id).toBe('b');
  });

  it('returns undefined for an empty pool', () => {
    expect(pickAsker([], [], 0)).toBeUndefined();
  });
});

describe('requestMoneyCost', () => {
  const context = { playerWeeklyWage: 1400, squadWeeklyWageBill: 20000 };

  it('prices an individual ask off that player\'s wage', () => {
    expect(requestMoneyCost({ kind: 'MONEY_PLAYER', wageMultiple: 3 }, context)).toBe(4200);
  });

  it('prices a squad ask off the whole wage bill', () => {
    expect(requestMoneyCost({ kind: 'MONEY_SQUAD', billMultiplePercent: 50 }, context)).toBe(10000);
  });

  it('is undefined for a cost that is not money', () => {
    expect(requestMoneyCost({ kind: 'ABSENCE', weeks: 2 }, context)).toBeUndefined();
    expect(requestMoneyCost({ kind: 'CONDITION_SQUAD', amount: 10 }, context)).toBeUndefined();
  });

  it('never returns zero, so a grant is never silently free', () => {
    expect(requestMoneyCost(
      { kind: 'MONEY_SQUAD', billMultiplePercent: 30 },
      { playerWeeklyWage: 0, squadWeeklyWageBill: 1 },
    )).toBe(1);
  });
});

describe('absenceWeeksFor', () => {
  it('honours the authored weeks on Chairman', () => {
    expect(absenceWeeksFor(3, 'CHAIRMAN')).toBe(3);
  });

  it('caps at one week on Cozy', () => {
    expect(absenceWeeksFor(3, 'COZY')).toBe(1);
    expect(absenceWeeksFor(1, 'COZY')).toBe(1);
  });
});

describe('requestTarget', () => {
  it('treats squad money, condition and drills as squad-wide', () => {
    expect(requestTarget({ kind: 'MONEY_SQUAD', billMultiplePercent: 50 })).toBe('SQUAD');
    expect(requestTarget({ kind: 'CONDITION_SQUAD', amount: 10 })).toBe('SQUAD');
    expect(requestTarget({ kind: 'DRILL_SQUAD', multiplierPercent: 60, weeks: 2 })).toBe('SQUAD');
  });

  it('treats an individual ask as one player', () => {
    expect(requestTarget({ kind: 'MONEY_PLAYER', wageMultiple: 3 })).toBe('PLAYER');
    expect(requestTarget({ kind: 'ABSENCE', weeks: 2 })).toBe('PLAYER');
    expect(requestTarget({ kind: 'DRILL_PLAYER', multiplierPercent: 50, weeks: 4 })).toBe('PLAYER');
  });

  it('agrees with the shipped catalog on which requests hit everyone', () => {
    const squadIds = CATALOG.requests
      .filter(request => requestTarget(request.cost) === 'SQUAD')
      .map(request => request.id);

    expect(squadIds).toContain('squad-massage');
    expect(squadIds).toContain('one-big-night-out');
    expect(squadIds).not.toContain('the-car');
  });
});

describe('resolutionDeltas', () => {
  it('grants an individual request on Chairman', () => {
    expect(resolutionDeltas('GRANTED', 'PLAYER', 'CHAIRMAN')).toEqual({
      asker: { loyalty: 5, morale: 5 },
      squad: { loyalty: 0, morale: 0 },
    });
  });

  it('grants a squad request as a squad bump plus the asker\'s own', () => {
    expect(resolutionDeltas('GRANTED', 'SQUAD', 'CHAIRMAN')).toEqual({
      asker: { loyalty: 5, morale: 5 },
      squad: { loyalty: 2, morale: 5 },
    });
  });

  it('refuses harder on Chairman than on Cozy', () => {
    expect(resolutionDeltas('REFUSED', 'PLAYER', 'CHAIRMAN').asker)
      .toEqual({ loyalty: -5, morale: -8 });
    expect(resolutionDeltas('REFUSED', 'PLAYER', 'COZY').asker)
      .toEqual({ loyalty: -3, morale: -4 });
  });

  it('charges a lapse at exactly the refusal rate', () => {
    // The second-week inbox notice prints the number, so the manager was told.
    // A discount would make silence cheaper than deciding.
    expect(resolutionDeltas('LAPSED', 'PLAYER', 'CHAIRMAN'))
      .toEqual(resolutionDeltas('REFUSED', 'PLAYER', 'CHAIRMAN'));
    expect(resolutionDeltas('LAPSED', 'SQUAD', 'COZY'))
      .toEqual(resolutionDeltas('REFUSED', 'SQUAD', 'COZY'));
  });

  it('never rewards a refusal on either difficulty', () => {
    for (const difficulty of ['COZY', 'CHAIRMAN'] as const) {
      for (const target of ['PLAYER', 'SQUAD'] as const) {
        const deltas = resolutionDeltas('REFUSED', target, difficulty);
        expect(deltas.asker.loyalty).toBeLessThan(0);
        expect(deltas.asker.morale).toBeLessThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Resolution: the part that moves money, legs and lineups.
// ---------------------------------------------------------------------------

/**
 * Deliberately does not fast-forward the season. Sidecars are stamped with the
 * season they were built for (`youthIntake.season` is validated against the
 * active one), so bumping `state.season` alone produces a state the codec
 * rightly refuses for a reason that has nothing to do with requests.
 */
function requestFixture(requestId: string): GameState {
  const base = createCareer(createLaunchCareerSetup(20260801));
  const roster = base.players.filter(player => player.clubId === base.userClubId);
  const asker = roster[1];
  const club = base.clubs.find(candidate => candidate.id === base.userClubId)!;
  const definition = requestDefinition(CATALOG, requestId);
  const costAmount = requestMoneyCost(definition.cost, {
    playerWeeklyWage: asker.weeklyWage,
    squadWeeklyWageBill: club.weeklyWages,
  });

  return {
    ...base,
    week: 8,
    players: base.players.map(player => (player.clubId !== base.userClubId
      ? player
      : { ...player, morale: 60, condition: 100 })),
    playerRequests: {
      ...DEFAULT_PLAYER_REQUEST_STATE,
      pending: {
        requestId,
        playerId: asker.id,
        askedSeason: base.season,
        askedWeek: 8,
        ...(costAmount === undefined ? {} : { costAmount }),
        warned: false,
      },
    },
  };
}

const askerOf = (state: GameState) => state.playerRequests!.pending!.playerId;
const cashOf = (state: GameState) =>
  state.clubs.find(club => club.id === state.userClubId)!.cash;

describe('resolvePlayerRequest', () => {
  it('grants a money request, charging cash and lifting loyalty and morale', () => {
    const state = requestFixture('gold-boots');
    const cost = state.playerRequests!.pending!.costAmount!;
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === askerOf(state))!;
    const before = state.players.find(p => p.id === askerOf(state))!;

    expect(cashOf(next)).toBe(cashOf(state) - cost);
    expect(playerLoyalty(asker, next.careerSeed))
      .toBe(playerLoyalty(before, state.careerSeed) + 5);
    expect(asker.morale).toBe(65);
    expect(next.playerRequests!.pending).toBeUndefined();
    expect(next.playerRequests!.weeksSinceRequest).toBe(0);
    expect(next.playerRequests!.history[0].resolution).toBe('GRANTED');
    expect(next.playerRequests!.lastAskingPlayerId).toBe(asker.id);
  });

  it('records the spend as a player-request cash transaction', () => {
    const state = requestFixture('gold-boots');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const entry = (next.cashTransactions ?? []).at(-1)!;

    // recordCashTransaction stamps balanceAfter from the club's current cash and
    // mutates nothing, so charging has to happen first or the ledger lies.
    expect(entry.kind).toBe('player-request');
    expect(entry.amount).toBe(-state.playerRequests!.pending!.costAmount!);
    expect(entry.balanceAfter).toBe(cashOf(next));
  });

  it('caps a Bahamas fortnight at one week on Cozy', () => {
    const state = requestFixture('bahamas-fortnight');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');

    expect(next.players.find(p => p.id === askerOf(state))!.awayWeeks).toBe(1);
    expect(cashOf(next)).toBe(cashOf(state));
  });

  it('honours the full two weeks on Chairman', () => {
    const state = { ...requestFixture('bahamas-fortnight'), difficulty: 'CHAIRMAN' as const };
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');

    expect(next.players.find(p => p.id === askerOf(state))!.awayWeeks).toBe(2);
  });

  it('takes an away starter out of the XI immediately', () => {
    const state = requestFixture('bahamas-fortnight');
    const asker = askerOf(state);
    const started: GameState = {
      ...state,
      lineups: state.lineups.map(lineup => (lineup.clubId === state.userClubId
        ? { ...lineup, playerIds: [lineup.playerIds[0], asker, ...lineup.playerIds.slice(2)
            .filter(id => id !== asker)].slice(0, 11) }
        : lineup)),
    };
    const next = resolvePlayerRequest(started, CATALOG, 'GRANTED');

    expect(next.lineups.find(l => l.clubId === next.userClubId)!.playerIds).not.toContain(asker);
    // The guard in buildCareerTeamDef is what would otherwise throw on Saturday.
    expect(() => buildCareerTeamDef(next, next.userClubId)).not.toThrow();
  });

  it('grants a squad condition request against every squad player', () => {
    const state = requestFixture('one-big-night-out');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');

    for (const player of next.players.filter(p => p.clubId === next.userClubId)) {
      expect(player.condition).toBe(90);
    }
  });

  it('applies a themed grant bonus alongside the cost', () => {
    const state = requestFixture('squad-massage');
    const drained: GameState = {
      ...state,
      players: state.players.map(p => (p.clubId === state.userClubId
        ? { ...p, condition: 70 }
        : p)),
    };
    const next = resolvePlayerRequest(drained, CATALOG, 'GRANTED');

    for (const player of next.players.filter(p => p.clubId === next.userClubId)) {
      expect(player.condition).toBe(78);
    }
  });

  it('lifts the whole squad on a granted squad request, and the asker most', () => {
    const state = requestFixture('bbq-at-my-place');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === askerOf(state))!;
    const other = next.players.find(
      p => p.clubId === next.userClubId && p.id !== askerOf(state),
    )!;

    expect(playerLoyalty(asker, next.careerSeed) - playerLoyalty(
      state.players.find(p => p.id === asker.id)!, state.careerSeed,
    )).toBe(7);
    expect(playerLoyalty(other, next.careerSeed) - playerLoyalty(
      state.players.find(p => p.id === other.id)!, state.careerSeed,
    )).toBe(2);
  });

  it('refuses without spending cash and drops loyalty and morale', () => {
    const state = requestFixture('gold-boots');
    const next = resolvePlayerRequest(state, CATALOG, 'REFUSED');
    const asker = next.players.find(p => p.id === askerOf(state))!;

    expect(cashOf(next)).toBe(cashOf(state));
    expect(asker.morale).toBe(56);
    expect(next.playerRequests!.history[0].resolution).toBe('REFUSED');
    expect(next.playerRequests!.history[0].costAmount).toBeUndefined();
  });

  it('records a drill request as a bounded effect, never a contract promise', () => {
    const state = requestFixture('my-own-guru');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === askerOf(state))!;

    expect(asker.contractPromise).toBeUndefined();
    expect(next.playerRequests!.effects).toContainEqual({
      kind: 'DRILL_PLAYER',
      playerId: asker.id,
      weeksRemaining: 4,
      multiplierPercent: 50,
    });
  });

  it('adds no effect when a drill request is refused', () => {
    const next = resolvePlayerRequest(requestFixture('my-own-guru'), CATALOG, 'REFUSED');

    expect(next.playerRequests!.effects).toEqual([]);
  });

  it('refuses to grant what the club cannot pay for', () => {
    const state = requestFixture('the-car');
    const broke: GameState = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(() => resolvePlayerRequest(broke, CATALOG, 'GRANTED')).toThrow('cannot afford');
    expect(() => resolvePlayerRequest(broke, CATALOG, 'REFUSED')).not.toThrow();
  });

  it('throws when there is nothing pending', () => {
    const state = requestFixture('gold-boots');
    const empty: GameState = {
      ...state,
      playerRequests: { ...state.playerRequests!, pending: undefined },
    };

    expect(() => resolvePlayerRequest(empty, CATALOG, 'GRANTED')).toThrow('no pending request');
  });

  it('leaves a save the codec still accepts', () => {
    const next = resolvePlayerRequest(requestFixture('gold-boots'), CATALOG, 'GRANTED');

    expect(() => parseStoredGameState(serializeGameState(next))).not.toThrow();
  });
});

describe('canAffordRequest', () => {
  it('is false when the club cannot pay in full', () => {
    const state = requestFixture('the-car');
    const broke: GameState = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(canAffordRequest(broke)).toBe(false);
  });

  it('is true for a request with no money cost even at zero cash', () => {
    const state = requestFixture('bahamas-fortnight');
    const broke: GameState = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(canAffordRequest(broke)).toBe(true);
  });
});

describe('tickRequestEffects', () => {
  it('counts every effect down and drops the expired ones', () => {
    expect(tickRequestEffects([
      { kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 },
      { kind: 'DRILL_PLAYER', playerId: 'a', weeksRemaining: 1, multiplierPercent: 50 },
    ])).toEqual([
      { kind: 'DRILL_SQUAD', weeksRemaining: 1, multiplierPercent: 60 },
    ]);
  });

  it('is a no-op on an empty list', () => {
    expect(tickRequestEffects([])).toEqual([]);
  });
});

describe('drillMultiplierPercent', () => {
  it('is 100 with no effects', () => {
    expect(drillMultiplierPercent([], 'a')).toBe(100);
  });

  it('applies a squad effect to everyone', () => {
    expect(drillMultiplierPercent(
      [{ kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 }],
      'a',
    )).toBe(60);
  });

  it('applies a player effect only to that player', () => {
    const effects = [{
      kind: 'DRILL_PLAYER' as const,
      playerId: 'a',
      weeksRemaining: 2,
      multiplierPercent: 50,
    }];

    expect(drillMultiplierPercent(effects, 'a')).toBe(50);
    expect(drillMultiplierPercent(effects, 'b')).toBe(100);
  });

  it('compounds a stacked squad and player effect', () => {
    expect(drillMultiplierPercent([
      { kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 },
      { kind: 'DRILL_PLAYER', playerId: 'a', weeksRemaining: 2, multiplierPercent: 50 },
    ], 'a')).toBe(30);
  });
});

describe('request drill effects in real training', () => {
  it('reduces the gain a drill produces while a personal effect is live', () => {
    const state = requestFixture('my-own-guru');
    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const penalised: GameState = {
      ...state,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        effects: [{
          kind: 'DRILL_PLAYER',
          playerId: target.id,
          weeksRemaining: 4,
          multiplierPercent: 50,
        }],
      },
    };

    const full = trainPlayerInstantly(state, target.id, 'sprints');
    const halved = trainPlayerInstantly(penalised, target.id, 'sprints');

    expect(halved.after - halved.before).toBeLessThan(full.after - full.before);
  });

  it('leaves a player untouched by someone else\'s personal effect', () => {
    const state = requestFixture('my-own-guru');
    const squad = state.players.filter(p => p.clubId === state.userClubId);
    const other: GameState = {
      ...state,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        effects: [{
          kind: 'DRILL_PLAYER',
          playerId: squad[0].id,
          weeksRemaining: 4,
          multiplierPercent: 50,
        }],
      },
    };

    const baseline = trainPlayerInstantly(state, squad[1].id, 'sprints');
    const unaffected = trainPlayerInstantly(other, squad[1].id, 'sprints');

    expect(unaffected.after - unaffected.before).toBe(baseline.after - baseline.before);
  });

  it('never lets a compounded penalty make a drill worth nothing', () => {
    const state = requestFixture('my-own-guru');
    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const crushed: GameState = {
      ...state,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        effects: [
          { kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 },
          { kind: 'DRILL_PLAYER', playerId: target.id, weeksRemaining: 4, multiplierPercent: 50 },
        ],
      },
    };

    const result = trainPlayerInstantly(crushed, target.id, 'sprints');
    expect(result.after).toBeGreaterThan(result.before);
  });
});

// ---------------------------------------------------------------------------
// The weekly tick.
// ---------------------------------------------------------------------------

/** A career that actually has the catalog baked in, so requests can open. */
function tickingCareer(): GameState {
  const base = createCareer({
    ...createLaunchCareerSetup(20260801),
    playerRequestRules: CATALOG,
  });
  // Stands in for the season transition that would have incremented tenure.
  // Without it every fixture below sits behind the minSeasonsAtClub gate and
  // the tick tests would pass by never opening anything.
  return {
    ...base,
    players: base.players.map(player => (player.clubId === base.userClubId
      ? { ...player, seasonsAtClub: (player.seasonsAtClub ?? 0) + 1 }
      : player)),
  };
}

/**
 * Moves a fixture career to a later season with its sidecars in step.
 *
 * Spreading `season` alone produces a state the codec rightly refuses:
 * `youthIntake` is stamped with the season it was built for and validated
 * against the active one. That has nothing to do with requests, so the helper
 * keeps them together rather than letting an unrelated invariant fail the test.
 */
function atSeason(state: GameState, season: number): GameState {
  return {
    ...state,
    season,
    ...(state.youthIntake === undefined
      ? {}
      : { youthIntake: { ...state.youthIntake, season } }),
  };
}

describe('advancePlayerRequests', () => {
  it('does nothing at all when the catalog was never baked in', () => {
    // This is what turns the feature off for the balance harness and the audit
    // probes: they build a setup and drop the catalog from it.
    const { playerRequestRules: _dropped, ...setup } = createLaunchCareerSetup(20260801);
    const bare = createCareer(setup);

    expect(advancePlayerRequests(atSeason(bare, 3), true).playerRequests).toBeUndefined();
  });

  it('opens nothing before the start season', () => {
    const early = { ...tickingCareer(), season: 1, week: 30 };

    expect(advancePlayerRequests(early, true).playerRequests?.pending).toBeUndefined();
  });

  it('never offers a cost the calendar cannot collect', () => {
    // Week 30 is past the last league round and past every cup week, so leave
    // and a squad condition hit both cost exactly nothing. A request still
    // opens — the roll succeeded — but it has to be one the club can be
    // charged for.
    const empty: GameState = {
      ...atSeason(tickingCareer(), 3),
      week: 30,
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };
    const pending = advancePlayerRequests(empty, true).playerRequests?.pending;

    expect(pending).toBeDefined();
    expect(requestDefinition(CATALOG, pending!.requestId).cost.kind)
      .not.toBe('ABSENCE');
    expect(requestDefinition(CATALOG, pending!.requestId).cost.kind)
      .not.toBe('CONDITION_SQUAD');
  });

  it('still offers leave in a week with football ahead of it', () => {
    // The same setup a fortnight earlier, where the league is still running.
    // Without this the guard above could pass by never offering leave at all.
    const kinds = new Set<string>();
    for (let week = 6; week <= 20; week += 1) {
      const live: GameState = {
        ...atSeason(tickingCareer(), 3),
        week,
        playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
      };
      const pending = advancePlayerRequests(live, true).playerRequests?.pending;
      if (pending !== undefined) {
        kinds.add(requestDefinition(CATALOG, pending.requestId).cost.kind);
      }
    }

    expect(kinds.has('ABSENCE')).toBe(true);
  });

  it('counts down away weeks every settled week', () => {
    const base = tickingCareer();
    const away: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, awayWeeks: 2 } : p)),
    };

    expect(advancePlayerRequests(away, true).players[0].awayWeeks).toBe(1);
  });

  it('ticks leave and effects but opens nothing on the season-end path', () => {
    const base = tickingCareer();
    const loaded: GameState = {
      ...atSeason(base, 3),
      players: base.players.map((p, i) => (i === 0 ? { ...p, awayWeeks: 2 } : p)),
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };
    const next = advancePlayerRequests(loaded, false);

    expect(next.players[0].awayWeeks).toBe(1);
    expect(next.playerRequests!.pending).toBeUndefined();
  });

  it('eventually opens a request once the drought passes the guarantee', () => {
    const base = tickingCareer();
    const overdue: GameState = {
      ...atSeason(base, 3),
      week: 10,
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };
    const next = advancePlayerRequests(overdue, true);

    expect(next.playerRequests!.pending).toBeDefined();
    expect(next.playerRequests!.weeksSinceRequest).toBe(41);
  });

  it('never offers a bare-eleven squad a leave request it cannot survive', () => {
    // With no bench at all, every player is a starter with no replacement, so
    // every absence request would throw inside lineup repair on Grant. A
    // catalog of nothing but absence requests must therefore open nothing.
    const base = tickingCareer();
    const starters = new Set(
      base.lineups.find(lineup => lineup.clubId === base.userClubId)!.playerIds,
    );
    const bareEleven: GameState = {
      ...atSeason(base, 3),
      week: 10,
      players: base.players.filter(candidate => (
        candidate.clubId !== base.userClubId || starters.has(candidate.id)
      )),
      playerRequestRules: {
        ...CATALOG,
        requests: CATALOG.requests.filter(request => request.cost.kind === 'ABSENCE'),
      },
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };

    expect(advancePlayerRequests(bareEleven, true).playerRequests!.pending).toBeUndefined();
  });

  it('is save-stable: the same week resolves to the same asker and request', () => {
    const base = tickingCareer();
    const overdue: GameState = {
      ...atSeason(base, 3),
      week: 10,
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };

    const first = advancePlayerRequests(overdue, true).playerRequests!.pending!;
    const reloaded = parseStoredGameState(serializeGameState(overdue));
    const second = advancePlayerRequests(reloaded, true).playerRequests!.pending!;

    expect(second).toEqual(first);
  });

  it('never opens a second request while one is pending', () => {
    const base = tickingCareer();
    const busy: GameState = {
      ...atSeason(base, 3),
      week: 10,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        weeksSinceRequest: 40,
        pending: {
          requestId: 'gold-boots',
          playerId: base.players.find(p => p.clubId === base.userClubId)!.id,
          askedSeason: 3,
          askedWeek: 10,
          costAmount: 1200,
          warned: false,
        },
      },
    };

    expect(advancePlayerRequests(busy, true).playerRequests!.pending!.requestId)
      .toBe('gold-boots');
  });

  it('warns in the second week and lapses in the third', () => {
    const base = tickingCareer();
    const asker = base.players.find(p => p.clubId === base.userClubId)!;
    const pending = {
      requestId: 'gold-boots',
      playerId: asker.id,
      askedSeason: 3,
      askedWeek: 10,
      costAmount: 1200,
      warned: false,
    };
    const withPending = (week: number, warned: boolean): GameState => ({
      ...atSeason(base, 3),
      week,
      players: base.players.map(p => (p.clubId === base.userClubId
        ? { ...p, morale: 60 }
        : p)),
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, pending: { ...pending, warned } },
    });

    expect(advancePlayerRequests(withPending(11, false), true).playerRequests!.pending!.warned)
      .toBe(true);

    const lapsed = advancePlayerRequests(withPending(12, true), true);
    expect(lapsed.playerRequests!.pending).toBeUndefined();
    expect(lapsed.playerRequests!.history[0].resolution).toBe('LAPSED');
    // A lapse costs exactly what a refusal costs; the notice printed the number.
    expect(lapsed.players.find(p => p.id === asker.id)!.morale).toBe(56);
  });

  it('cancels silently when the asker has left the club', () => {
    const base = tickingCareer();
    const asker = base.players.find(p => p.clubId === base.userClubId)!;
    const sold: GameState = {
      ...atSeason(base, 3),
      players: base.players.filter(p => p.id !== asker.id),
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        pending: {
          requestId: 'gold-boots',
          playerId: asker.id,
          askedSeason: 3,
          askedWeek: 10,
          warned: false,
        },
      },
    };
    const next = advancePlayerRequests(sold, true);

    expect(next.playerRequests!.pending).toBeUndefined();
    expect(next.playerRequests!.history).toHaveLength(0);
  });

  /**
   * The inverse of the rule this used to assert.
   *
   * A pending ask survived everything except its author asking for a transfer,
   * which meant a bad fortnight between the ask and the answer quietly voided a
   * card the manager was still looking at. Leaving the club is now the only
   * thing that invalidates one.
   */
  it('keeps the ask alive when the asker asks for a transfer', () => {
    const base = tickingCareer();
    const asker = base.players.find(p => p.clubId === base.userClubId)!;
    const listed: GameState = {
      ...atSeason(base, 3),
      players: base.players.map(p => (p.id === asker.id ? { ...p, transferRequested: true } : p)),
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        pending: {
          requestId: 'gold-boots',
          playerId: asker.id,
          askedSeason: 3,
          askedWeek: 10,
          warned: false,
        },
      },
    };

    expect(advancePlayerRequests(listed, true).playerRequests!.pending)
      .toMatchObject({ requestId: 'gold-boots', playerId: asker.id });
  });
});

/**
 * The half of `tuning.cadence` that had never run.
 *
 * `hasStar` used to be true from season 2 of every career ever played: the star
 * threshold was 50, fame saturated at 99, and the whole first eleven cleared it
 * inside one season. The non-star row of the cadence table was therefore
 * unreachable in a real game — a shipped tuning knob that could only ever be
 * read by a unit test.
 *
 * This plays real seasons rather than stamping a season number onto a fresh
 * squad, because the fresh squad is exactly what could not prove it: its fame
 * is zero, so it reads as starless whatever the threshold is.
 */
describe('the star gate divides a real career in two', () => {
  it('runs the non-star cadence for its first seasons and the star one after', () => {
    const hasStar = (state: GameState): boolean => state.players
      .filter(candidate => candidate.clubId === state.userClubId)
      .some(candidate => weightForPlayer(
        candidate,
        starQualifiers(state.seasonStatLines ?? [], state.season, CATALOG.tuning.starGoalRank),
        CATALOG.tuning.starFameThreshold,
      ) > 1);

    // The catalog is attached here for the same reason the dev harness attaches
    // it: `createLaunchCareerSetup` never carries one, so a career built without
    // this line has requests switched off at the first line of the draw.
    const played = (seasons: number): GameState => runHeadlessFullCareer(
      { ...createLaunchCareerSetup(20260801), playerRequestRules: CATALOG },
      seasons,
    );
    const early = played(3);
    const late = played(7);

    expect(hasStar(early)).toBe(false);
    expect(hasStar(late)).toBe(true);
    // And the starless seasons are not silent ones: the slower row still deals
    // requests, which is the thing an unreachable branch could never show.
    expect(early.playerRequests!.history.length).toBeGreaterThan(0);
  }, 120_000);
});

/**
 * WHICH row of `tuning.cadence` a starless squad is actually timed by.
 *
 * The test above proves a young squad reads as starless and still gets asked.
 * It cannot prove the asking is on the SLOWER schedule, because both rows deal
 * requests — swap the branch and it still passes. So this one holds the clock
 * still at a chosen number of dry weeks and sweeps a whole season of rolls,
 * which turns a probability into a count. The two rows overlap everywhere
 * except in the windows below, and those are where the count separates:
 *
 *   at `starMinWeeks`      a star squad may be asked; a starless one cannot be
 *   at `starGuaranteeWeeks` a star squad is always asked; a starless one is not
 *   at `guaranteeWeeks`    a starless squad is always asked
 *
 * A career measured through the real weekly settlement is in
 * `src/audit/__tests__/player-request-cadence-probe.test.ts`; the numbers here
 * are the same ones it watches arrive.
 */
describe('the non-star cadence times a starless squad', () => {
  /** Every week of a season, so one held clock produces a whole season of rolls. */
  const SWEPT_WEEKS = Array.from({ length: SEASON_WEEKS }, (_, index) => index + 1);
  const CADENCE = CATALOG.tuning.cadence[careerDifficulty(tickingCareer())];

  /**
   * How many of a season's weeks open a request when the drought is held at
   * `weeksSinceRequest` dry weeks. Stored minus one, because the draw
   * increments the clock before it reads it.
   */
  function opensPerSeason(dryWeeks: number, starred: boolean): number {
    const base = tickingCareer();
    const squad = base.players.filter(player => player.clubId === base.userClubId);
    const starId = squad[0].id;
    const players = base.players.map(player => {
      if (player.clubId !== base.userClubId) return player;
      // Zeroed rather than trusted: a launch roster that starts anyone above the
      // threshold would make the starless half of this test vacuous.
      return { ...player, fame: starred && player.id === starId
        ? CATALOG.tuning.starFameThreshold
        : 0 };
    });

    return SWEPT_WEEKS.filter(week => advancePlayerRequests({
      ...atSeason(base, 3),
      week,
      players,
      // Empty on purpose: a top-scorer qualifier is the other half of `hasStar`,
      // and this test is about the fame half.
      seasonStatLines: [],
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: dryWeeks - 1 },
    }, true).playerRequests!.pending !== undefined).length;
  }

  it('stays silent through the weeks a star squad would already be asking in', () => {
    expect(opensPerSeason(CADENCE.starMinWeeks, false)).toBe(0);
    expect(opensPerSeason(CADENCE.minWeeks - 1, false)).toBe(0);
    expect(opensPerSeason(CADENCE.starMinWeeks, true)).toBeGreaterThan(0);
  });

  it('reaches certainty on its own guarantee week, not the star one', () => {
    expect(opensPerSeason(CADENCE.starGuaranteeWeeks, true)).toBe(SEASON_WEEKS);
    expect(opensPerSeason(CADENCE.starGuaranteeWeeks, false)).toBeLessThan(SEASON_WEEKS);
    expect(opensPerSeason(CADENCE.guaranteeWeeks, false)).toBe(SEASON_WEEKS);
  });

  /**
   * The starless squad waits longer for the same certainty. Stated as a total
   * across the shared window rather than week by week, because the ramp is
   * eased and a single week can tie.
   */
  it('asks less often than a star squad across the weeks they share', () => {
    const shared = [CADENCE.minWeeks, CADENCE.starGuaranteeWeeks];
    const total = (starred: boolean): number => shared
      .reduce((sum, dryWeeks) => sum + opensPerSeason(dryWeeks, starred), 0);

    expect(total(false)).toBeLessThan(total(true));
  });
});

describe('the tenure gate lets a real season-2 squad ask', () => {
  it('excludes a first-season squad and admits it after a season transition', () => {
    // seasonsAtClub starts at 0 and is incremented by mergeCareerPlayer at each
    // season transition (src/game/m2-career.ts). The shipped minimum of 1 is
    // therefore "has been here through a rollover" — which every launch player
    // satisfies by season 2, when requests begin. This asserts both halves,
    // because a value the squad can never reach would leave the tab empty for
    // an entire career with nothing failing to say so.
    const fresh = createCareer(createLaunchCareerSetup(20260801));
    const freshRoster = fresh.players.filter(p => p.clubId === fresh.userClubId);
    const gate = { minSeasonsAtClub: CATALOG.tuning.minSeasonsAtClub, absence: false };

    expect(eligibleAskers(freshRoster, gate)).toHaveLength(0);

    const tenured = freshRoster.map(player => ({
      ...player,
      seasonsAtClub: (player.seasonsAtClub ?? 0) + 1,
    }));
    expect(eligibleAskers(tenured, gate).length).toBeGreaterThan(0);
  });
});
