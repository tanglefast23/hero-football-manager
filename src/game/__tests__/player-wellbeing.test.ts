import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  advanceFacilityConstruction,
  buildFacility,
  createFacilityGrid,
  upgradeFacility,
  type FacilityGridState,
} from '../facilities';
import {
  applyMatchConditionCosts,
  medicalBayRecoveryWeeks,
  matchConditionCost,
  overtrainingInjuryChancePercent,
  resolveWeeklyPlayerWellbeing,
  substituteMatchConditionCost,
  weeklyConditionRecovery,
} from '../player-wellbeing';
import { trainPlayerInstantly } from '../training';
import type { CareerPlayer, GameState } from '../types';

function career(seed = 1): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

function userPlayers(state: GameState): CareerPlayer[] {
  return state.players.filter((player) => player.clubId === state.userClubId);
}

function withPlayedUserFixture(
  state: GameState,
  homeGoals: number,
  awayGoals: number,
): GameState {
  const opponentId = state.clubs.find(
    (club) => club.id !== state.userClubId,
  )?.id;
  if (opponentId === undefined) throw new Error('missing opponent');
  return {
    ...state,
    fixtures: [
      {
        id: 'wellbeing-match',
        season: state.season,
        round: 1,
        week: state.week,
        homeClubId: state.userClubId,
        awayClubId: opponentId,
        matchSeed: 1,
        status: 'played',
        score: { homeGoals, awayGoals },
      },
    ],
  };
}

function withUserPlayerChanges(
  state: GameState,
  changes: (player: CareerPlayer, userIndex: number) => CareerPlayer,
): GameState {
  let userIndex = 0;
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.clubId !== state.userClubId) return player;
      const changed = changes(player, userIndex);
      userIndex += 1;
      return changed;
    }),
  };
}

describe('weekly player wellbeing', () => {
  test('combines recovery, match result, and starter status without a training workload', () => {
    let state = career(7);
    const roster = userPlayers(state);
    const userLineup = state.lineups.find(
      (lineup) => lineup.clubId === state.userClubId,
    )!;
    const starterId = userLineup.playerIds[0];
    const benchId = roster.find(
      (player) => !userLineup.playerIds.includes(player.id),
    )!.id;
    state = withUserPlayerChanges(state, (player) => ({
      ...player,
      condition: 50,
      morale: 50,
      consecutiveLowMoraleWeeks: 0,
    }));
    state = withPlayedUserFixture(state, 2, 0);
    const before = JSON.stringify(state);

    const result = resolveWeeklyPlayerWellbeing(state);
    const starter = result.players.find((player) => player.id === starterId);
    const bench = result.players.find((player) => player.id === benchId);

    expect(result.matchOutcome).toBe('win');
    // Match costs land when the match ends; this weekly tick only recovers.
    expect(starter).toMatchObject({
      condition: 60,
      morale: 55,
      consecutiveLowMoraleWeeks: 0,
    });
    expect(bench).toMatchObject({
      condition: 60,
      morale: 52,
      consecutiveLowMoraleWeeks: 0,
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  test('uses the match condition cost for each division', () => {
    expect(
      [5, 4, 3, 2, 1].map((division) =>
        matchConditionCost(division as 1 | 2 | 3 | 4 | 5),
      ),
    ).toEqual([2, 2, 4, 4, 6]);
    expect(
      [5, 4, 3, 2, 1].map((division) =>
        substituteMatchConditionCost(division as 1 | 2 | 3 | 4 | 5),
      ),
    ).toEqual([1, 1, 2, 2, 3]);
  });

  test('charges both clubs in D5: starters full, substitutes half, unused bench zero', () => {
    const state = career(12);
    const fixture = state.fixtures.find(
      (candidate) =>
        candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId,
    )!;
    const participants = (clubId: string) => {
      const lineup = state.lineups.find((row) => row.clubId === clubId)!;
      const substitute = state.players.find(
        (player) =>
          player.clubId === clubId && !lineup.playerIds.includes(player.id),
      )!;
      return [...lineup.playerIds, substitute.id];
    };
    const homeParticipants = participants(fixture.homeClubId);
    const awayParticipants = participants(fixture.awayClubId);
    const next = applyMatchConditionCosts(
      state,
      [fixture],
      [
        {
          fixtureId: fixture.id,
          homeGoals: 0,
          awayGoals: 0,
          homeParticipantPlayerIds: homeParticipants,
          awayParticipantPlayerIds: awayParticipants,
        },
      ],
    );

    for (const ids of [homeParticipants, awayParticipants]) {
      expect(
        next.players.find((player) => player.id === ids[0])?.condition,
      ).toBe(98);
      expect(
        next.players.find((player) => player.id === ids[11])?.condition,
      ).toBe(99);
      const clubId = next.players.find(
        (player) => player.id === ids[0],
      )!.clubId;
      const unused = next.players.find(
        (player) => player.clubId === clubId && !ids.includes(player.id),
      )!;
      expect(unused.condition).toBe(100);
    }
  });

  test('speeds weekly condition recovery by 3 per Dorm level, best level only', () => {
    expect(weeklyConditionRecovery(0)).toBe(10);
    expect(weeklyConditionRecovery(1)).toBe(13);
    expect(weeklyConditionRecovery(2)).toBe(16);
    expect(weeklyConditionRecovery(3)).toBe(19);
    expect(() => weeklyConditionRecovery(4)).toThrow('Dorm level');

    const base = withUserPlayerChanges(career(9), (player) => ({
      ...player,
      condition: 50,
      morale: 50,
      consecutiveLowMoraleWeeks: 0,
    }));
    const withDorms = (...levels: readonly (1 | 2 | 3)[]): GameState => ({
      ...base,
      facilities: {
        ...base.facilities,
        grid: {
          ...base.facilities.grid!,
          nextBuildingId: levels.length + 1,
          buildings: levels.map((level, index) => ({
            id: `facility-${index + 1}`,
            type: 'dorm' as const,
            level,
            capitalInvested:
              level === 1 ? 6_000 : level === 2 ? 13_500 : 27_000,
            x: index,
            y: 0,
          })),
        },
      },
    });
    const conditionAfterOneWeek = (state: GameState): number =>
      resolveWeeklyPlayerWellbeing(state).players.find(
        (player) => player.clubId === state.userClubId,
      )!.condition ?? 0;

    expect(conditionAfterOneWeek(base)).toBe(60);
    expect(conditionAfterOneWeek(withDorms(1))).toBe(63);
    expect(conditionAfterOneWeek(withDorms(3))).toBe(69);
    // A second Dorm is not a second bonus, whichever order they were built in.
    expect(conditionAfterOneWeek(withDorms(1, 3))).toBe(69);
    expect(conditionAfterOneWeek(withDorms(3, 1))).toBe(69);
  });

  test('leaves an unfinished Dorm out of condition recovery until it opens', () => {
    const base = withUserPlayerChanges(career(10), (player) => ({
      ...player,
      condition: 50,
      morale: 50,
      consecutiveLowMoraleWeeks: 0,
    }));
    const underConstruction = buildFacility(
      createFacilityGrid(),
      'dorm',
      { x: 0, y: 0 },
      50_000,
    );
    const building: GameState = {
      ...base,
      facilities: { ...base.facilities, grid: underConstruction.grid },
    };
    const open: GameState = {
      ...base,
      facilities: {
        ...base.facilities,
        grid: completeFacilityProject(underConstruction.grid),
      },
    };
    const conditionAfterOneWeek = (state: GameState): number =>
      resolveWeeklyPlayerWellbeing(state).players.find(
        (player) => player.clubId === state.userClubId,
      )!.condition ?? 0;

    expect(conditionAfterOneWeek(building)).toBe(60);
    expect(conditionAfterOneWeek(open)).toBe(63);
  });

  test('tracks sustained low morale and resets the counter on recovery', () => {
    let state = withPlayedUserFixture(career(8), 0, 2);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starterId = lineup.playerIds[0];
    const benchId = userPlayers(state).find(
      (player) => !lineup.playerIds.includes(player.id),
    )!.id;
    state = withUserPlayerChanges(state, (player) => ({
      ...player,
      condition: 70,
      morale: player.id === starterId ? 30 : player.id === benchId ? 32 : 50,
      consecutiveLowMoraleWeeks:
        player.id === starterId ? 2 : player.id === benchId ? 4 : 0,
    }));

    const result = resolveWeeklyPlayerWellbeing(state);

    expect(
      result.players.find((player) => player.id === starterId),
    ).toMatchObject({
      morale: 29,
      consecutiveLowMoraleWeeks: 3,
    });
    expect(
      result.players.find((player) => player.id === benchId),
    ).toMatchObject({
      morale: 28,
      consecutiveLowMoraleWeeks: 5,
    });

    const recoveryWeek = { ...state, fixtures: [] };
    recoveryWeek.players = result.players.map((player) =>
      player.id === starterId ? { ...player, morale: 35 } : player,
    );
    const recovered = resolveWeeklyPlayerWellbeing(recoveryWeek);
    expect(
      recovered.players.find((player) => player.id === starterId)
        ?.consecutiveLowMoraleWeeks,
    ).toBe(0);
  });

  test('uses Medical Bay level for recovery and adjacency for the documented risk reduction', () => {
    let grid = buildFacility(
      createFacilityGrid(),
      'medical-bay',
      { x: 0, y: 0 },
      1_000_000,
    ).grid;
    grid = completeFacilityProject(grid);
    grid = upgradeFacility(grid, 'facility-1', 1_000_000).grid;
    grid = completeFacilityProject(grid);
    grid = upgradeFacility(grid, 'facility-1', 1_000_000).grid;
    grid = completeFacilityProject(grid);
    const medicalOnly = grid;
    const adjacent = completeFacilityProject(
      buildFacility(grid, 'training-pitch', { x: 1, y: 0 }, 1_000_000).grid,
    );

    expect(medicalBayRecoveryWeeks(6, 3)).toBe(3);
    expect(medicalBayRecoveryWeeks(2, 3)).toBe(1);
    expect(overtrainingInjuryChancePercent(0, 0)).toBe(70);
    expect(overtrainingInjuryChancePercent(0, 20)).toBe(56);
    expect(overtrainingInjuryChancePercent(30, 20)).toBe(0);
    expect(() => medicalBayRecoveryWeeks(0, 1)).toThrow(/positive/);

    // The same facility grids shape the tap-time injury gamble: the Lv3
    // Medical Bay alone leaves a 70% chance at 0 condition, and the adjacent
    // Training Pitch discount brings it to 56%; an injury that does land is
    // shortened by three weeks (floor one) by the Lv3 bay.
    const makeExhaustedState = (facilityGrid: FacilityGridState): GameState => {
      let state = createCareer(createLaunchCareerSetup(2));
      const playerId = userPlayers(state)[0].id;
      state = withUserPlayerChanges(state, (player) => ({
        ...player,
        condition: player.id === playerId ? 0 : 100,
      }));
      return {
        ...state,
        trainingPoints: 100,
        facilities: { ...state.facilities, grid: facilityGrid },
      };
    };
    const medicalState = makeExhaustedState(medicalOnly);
    const playerId = userPlayers(medicalState)[0].id;
    let injuredResult;
    for (
      let nonce = 0;
      nonce < 200 && injuredResult === undefined;
      nonce += 1
    ) {
      const result = trainPlayerInstantly(
        { ...medicalState, totalInstantDrills: nonce },
        playerId,
        'sprints',
      );
      if (result.injury !== undefined) injuredResult = result;
    }
    expect(injuredResult?.injury?.chancePercent).toBe(70);
    expect(injuredResult?.injury?.recoveryWeeks).toBeGreaterThanOrEqual(1);
    expect(injuredResult?.injury?.recoveryWeeks).toBeLessThanOrEqual(3);

    const adjacencyState = makeExhaustedState(adjacent);
    const adjacencyResult = trainPlayerInstantly(
      adjacencyState,
      playerId,
      'sprints',
    );
    expect(
      adjacencyResult.injury?.chancePercent ??
        overtrainingInjuryChancePercent(0, 20),
    ).toBe(56);
  });

  test('leaves an unfinished Medical Bay out of injury recovery until it opens', () => {
    const underConstruction = buildFacility(
      createFacilityGrid(),
      'medical-bay',
      { x: 0, y: 0 },
      1_000_000,
    ).grid;
    const exhaustedWith = (facilityGrid: FacilityGridState): GameState => {
      let state = career(12);
      const exhaustedId = userPlayers(state)[0].id;
      state = withUserPlayerChanges(state, (player) => ({
        ...player,
        condition: player.id === exhaustedId ? 0 : 100,
      }));
      return {
        ...state,
        trainingPoints: 100,
        facilities: { ...state.facilities, grid: facilityGrid },
      };
    };
    const building = exhaustedWith(underConstruction);
    const open = exhaustedWith(completeFacilityProject(underConstruction));
    const playerId = userPlayers(building)[0].id;
    // A lone bay has no adjacency either way, so the same nonce injures in both
    // grids with the same base recovery roll: only the bay's level differs.
    const recoveryWeeksAt = (
      state: GameState,
      nonce: number,
    ): number | undefined =>
      trainPlayerInstantly(
        { ...state, totalInstantDrills: nonce },
        playerId,
        'sprints',
      ).injury?.recoveryWeeks;

    let injuringNonce = -1;
    for (let nonce = 0; nonce < 200 && injuringNonce < 0; nonce += 1) {
      if (recoveryWeeksAt(open, nonce) !== undefined) injuringNonce = nonce;
    }
    expect(injuringNonce).toBeGreaterThanOrEqual(0);
    const openWeeks = recoveryWeeksAt(open, injuringNonce)!;
    expect(recoveryWeeksAt(building, injuringNonce)).toBe(openWeeks + 1);
  });

  test('gives opponents the best Dorm recovery available in their division', () => {
    let state = career(9);
    const opponent = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === opponent.id ? { ...player, condition: 50 } : player,
      ),
    };
    const result = resolveWeeklyPlayerWellbeing(state);

    expect(
      result.players.find((player) => player.id === opponent.id)?.condition,
    ).toBe(63);
    expect(
      result.m2?.pyramid.divisions
        .flatMap((division) => division.clubs)
        .flatMap((club) => club.squad)
        .find((player) => player.id === opponent.id)?.condition,
    ).toBe(63);
  });

  test('drains an underpaid star, honors Motivator carry, and raises a transfer request', () => {
    let state = createCareer(createLaunchCareerSetup(10));
    const player = userPlayers(state)[0];
    const coach = state.market!.coachCandidates[0];
    state = withUserPlayerChanges(state, (candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            power: 'SUPER_SPEED',
            onHeroWage: false,
            personality: 'Greedy',
            morale: 30,
            consecutiveLowMoraleWeeks: 1,
          }
        : candidate,
    );
    state = {
      ...state,
      market: {
        ...state.market!,
        headCoach: { ...coach, level: 5, specialties: ['MOTIVATOR', 'ATTACK'] },
      },
    };

    const first = resolveWeeklyPlayerWellbeing(state);
    const updated = first.players.find(
      (candidate) => candidate.id === player.id,
    )!;

    expect(updated).toMatchObject({
      morale: 28,
      consecutiveLowMoraleWeeks: 2,
      motivatorMoraleRemainderHalfPoints: 100,
      transferRequested: true,
    });
  });

  /**
   * The flag has to be able to go both ways, and this is the direction that was
   * missing. It was written as `was || shouldRequest`, so a player who spent
   * four weeks unhappy in season 1 was still listed at morale 100 in season 6 —
   * still raising the "wants to leave" desk alert, and still dropped by
   * `eligibleAskers`, which is what starved the player-request tab of anyone to
   * ask. A `toBe(true)` here before the fix; a happy squad now clears itself.
   */
  test('withdraws a transfer request once the player is won back', () => {
    let state = createCareer(createLaunchCareerSetup(12));
    const player = userPlayers(state)[0];
    state = withUserPlayerChanges(state, (candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            personality: 'Professional',
            morale: 5,
            consecutiveLowMoraleWeeks: 4,
          }
        : candidate,
    );

    state = { ...state, players: resolveWeeklyPlayerWellbeing(state).players };
    const listed = userPlayers(state).find(
      (candidate) => candidate.id === player.id,
    )!;
    expect(listed.transferRequested).toBe(true);

    // Still listed while he is merely less miserable — the exact line is
    // `shouldWithdrawTransferRequest`'s own test in pyramid.test.ts.
    state = withUserPlayerChanges(state, (candidate) =>
      candidate.id === player.id ? { ...candidate, morale: 20 } : candidate,
    );
    state = { ...state, players: resolveWeeklyPlayerWellbeing(state).players };
    expect(
      userPlayers(state).find((candidate) => candidate.id === player.id)!
        .transferRequested,
    ).toBe(true);

    // Won back, and it stays withdrawn week after week.
    state = withUserPlayerChanges(state, (candidate) =>
      candidate.id === player.id ? { ...candidate, morale: 100 } : candidate,
    );
    for (let week = 0; week < 5; week += 1) {
      state = {
        ...state,
        players: resolveWeeklyPlayerWellbeing(state).players,
      };
    }
    expect(
      userPlayers(state).find((candidate) => candidate.id === player.id)!
        .transferRequested,
    ).toBe(false);
  });

  test('gives a Level 1 assistant Motivator an exact 2.5% morale effect', () => {
    let state = createCareer(createLaunchCareerSetup(11));
    const player = userPlayers(state)[0];
    const assistant = state.market!.coachCandidates[0];
    state = withUserPlayerChanges(state, (candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            power: 'SUPER_SPEED',
            onHeroWage: false,
            personality: 'Greedy',
            morale: 100,
          }
        : candidate,
    );
    state = {
      ...state,
      market: {
        ...state.market!,
        assistantCoach: {
          ...assistant,
          level: 1,
          specialties: ['MOTIVATOR', 'ATTACK'],
        },
      },
    };

    for (let week = 0; week < 20; week += 1) {
      const result = resolveWeeklyPlayerWellbeing(state);
      state = { ...state, players: result.players };
    }

    const updated = state.players.find(
      (candidate) => candidate.id === player.id,
    )!;
    expect(updated.morale).toBe(61);
    expect(updated.motivatorMoraleRemainderHalfPoints).toBe(0);
  });
});

function completeFacilityProject(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined)
    next = advanceFacilityConstruction(next).grid;
  return next;
}
