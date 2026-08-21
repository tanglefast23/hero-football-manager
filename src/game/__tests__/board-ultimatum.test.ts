import { createLaunchCareerSetup } from '../../application/launch';
import {
  applyBoardFacilityConversionConsequences,
  applyBoardForcedSaleConsequences,
  boardFacilityConversionAtDeadline,
  boardForcedSaleAtDeadline,
  clearMetBoardUltimatum,
  createBoardFacilityUltimatum,
  createBoardUltimatum,
  protectBoardUltimatumPlayer,
  reconcileBoardUltimatumCandidates,
} from '../board-ultimatum';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
} from '../career';
import { buildCareerTeamDef } from '../squad';
import type { FacilityGridState, PlacedFacility } from '../facilities';
import type { GameState } from '../types';

function career(seed: number) {
  return createCareer(createLaunchCareerSetup(seed));
}

function withFacilityGrid(
  state: ReturnType<typeof career>,
  buildings: readonly PlacedFacility[],
): ReturnType<typeof career> {
  const largestId = buildings.reduce(
    (largest, building) =>
      Math.max(largest, Number(building.id.replace('facility-', '')) || 0),
    0,
  );
  const grid: FacilityGridState = {
    width: 8,
    height: 6,
    nextBuildingId: largestId + 1,
    buildings,
    discoveredAdjacencies: [],
  };
  return {
    ...state,
    facilities: { ...state.facilities, trainingGroundBuilt: true, grid },
  };
}

const facility = (
  id: number,
  type: PlacedFacility['type'],
  x: number,
  y: number,
  level: PlacedFacility['level'] = 1,
): PlacedFacility => ({
  id: `facility-${id}`,
  type,
  level,
  capitalInvested: 10_000,
  x,
  y,
});

describe('board ultimatum domain', () => {
  test('converts the largest eligible building into a Stadium Stand without touching protected facilities', () => {
    const state = withFacilityGrid(career(9491), [
      facility(1, 'training-pitch', 0, 0),
      facility(2, 'coaching-office', 2, 0),
      facility(3, 'gym', 2, 1),
      facility(4, 'youth-field', 3, 0),
    ]);
    const ultimatum = createBoardFacilityUltimatum(state);

    const first = boardFacilityConversionAtDeadline(state, ultimatum);
    const second = boardFacilityConversionAtDeadline(
      JSON.parse(JSON.stringify(state)) as typeof state,
      ultimatum,
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: 'FACILITY_CONVERSION',
      removedFacilityId: 'facility-4',
      removedFacilityType: 'youth-field',
      addedFacilities: [{ type: 'stadium-stand' }],
    });
    const applied = applyBoardFacilityConversionConsequences(state, first);
    const buildings = applied.facilities.grid!.buildings;
    expect(buildings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'facility-1', type: 'training-pitch' }),
        expect.objectContaining({ id: 'facility-2', type: 'coaching-office' }),
        expect.objectContaining({ type: 'stadium-stand', capitalInvested: 0 }),
      ]),
    );
    expect(buildings.map((building) => building.id)).not.toContain(
      'facility-4',
    );
  });

  test('fills the Fan Shop cap after three Stadium Stands already exist', () => {
    const state = withFacilityGrid(career(9492), [
      facility(1, 'training-pitch', 0, 0),
      facility(2, 'coaching-office', 2, 0),
      facility(3, 'youth-field', 3, 0),
      facility(4, 'stadium-stand', 5, 0),
      facility(5, 'stadium-stand', 0, 2),
      facility(6, 'stadium-stand', 2, 2),
    ]);

    const resolution = boardFacilityConversionAtDeadline(
      state,
      createBoardFacilityUltimatum(state),
    );

    expect(resolution.removedFacilityId).toBe('facility-3');
    expect(resolution.addedFacilities).toHaveLength(3);
    expect(
      resolution.addedFacilities.every(
        (building) => building.type === 'fan-shop',
      ),
    ).toBe(true);
  });

  test('records why the facility plan cannot continue at both commercial caps', () => {
    const state = withFacilityGrid(career(9493), [
      facility(1, 'training-pitch', 0, 0),
      facility(2, 'coaching-office', 2, 0),
      facility(3, 'stadium-stand', 3, 0),
      facility(4, 'stadium-stand', 5, 0),
      facility(5, 'stadium-stand', 0, 2),
      facility(6, 'fan-shop', 2, 2),
      facility(7, 'fan-shop', 3, 2),
      facility(8, 'fan-shop', 4, 2),
    ]);

    expect(
      boardFacilityConversionAtDeadline(
        state,
        createBoardFacilityUltimatum(state),
      ),
    ).toMatchObject({
      addedFacilities: [],
      failureReason: 'COMMERCIAL_LIMITS_REACHED',
    });
  });

  test('creates a byte-identical visible list of four discounted safe candidates', () => {
    const state = career(9501);
    const first = createBoardUltimatum(state)!;
    const second = createBoardUltimatum(
      JSON.parse(JSON.stringify(state)) as typeof state,
    )!;

    expect(first).toEqual(second);
    expect(first.weeksRemaining).toBe(4);
    expect(first.targetCash).toBe(0);
    expect(first.candidates).toHaveLength(4);
    expect(
      new Set(first.candidates.map((candidate) => candidate.playerId)).size,
    ).toBe(4);
    expect(
      first.candidates.every(
        (candidate) =>
          candidate.discountPercent === 30 &&
          candidate.forcedSaleFee > 0 &&
          candidate.forcedSaleFee < candidate.marketValue,
      ),
    ).toBe(true);
  });

  test('puts the largest wage relief first', () => {
    const state = career(9501);
    const starterIds = new Set(
      state.lineups.find((lineup) => lineup.clubId === state.userClubId)!
        .playerIds,
    );
    const reserve = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !starterIds.has(player.id) &&
        player.contractSeasonsRemaining > 0,
    )!;
    const inflated = {
      ...state,
      players: state.players.map((player) =>
        player.id === reserve.id ? { ...player, weeklyWage: 99_999 } : player,
      ),
    };

    expect(createBoardUltimatum(inflated)?.candidates[0].playerId).toBe(
      reserve.id,
    );
  });

  test('never puts the created player on the board sale list', () => {
    const state = career(9501);
    const createdPlayerId = createBoardUltimatum(state)!.candidates[0].playerId;
    const inflated = {
      ...state,
      onboarding: { stage: 'complete' as const, createdPlayerId },
      players: state.players.map((player) =>
        player.id === createdPlayerId
          ? { ...player, weeklyWage: 999_999 }
          : player,
      ),
    };

    expect(
      createBoardUltimatum(inflated)?.candidates.map(
        (candidate) => candidate.playerId,
      ),
    ).not.toContain(createdPlayerId);
  });

  test('reorders a saved ultimatum by current wage relief', () => {
    const state = career(9501);
    const ultimatum = createBoardUltimatum(state)!;
    const saved = {
      ...state,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: {
          ...ultimatum,
          candidates: [...ultimatum.candidates].reverse(),
        },
      },
    };

    expect(
      reconcileBoardUltimatumCandidates(saved).financialSafety?.boardUltimatum
        ?.candidates,
    ).toEqual(ultimatum.candidates);
  });

  test('protects exactly one visible candidate and never selects them at the deadline', () => {
    const state = career(9502);
    const ultimatum = createBoardUltimatum(state)!;
    const withUltimatum = {
      ...state,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const protectedId = ultimatum.candidates[0].playerId;
    const protectedState = protectBoardUltimatumPlayer(
      withUltimatum,
      protectedId,
    );
    const resolution = boardForcedSaleAtDeadline(
      protectedState,
      protectedState.financialSafety!.boardUltimatum!,
    )!;

    expect(
      protectedState.financialSafety?.boardUltimatum?.protectedPlayerId,
    ).toBe(protectedId);
    expect(resolution.playerId).not.toBe(protectedId);
    expect(
      ultimatum.candidates.map((candidate) => candidate.playerId),
    ).toContain(resolution.playerId);
    expect(() =>
      protectBoardUltimatumPlayer(withUltimatum, 'not-visible'),
    ).toThrow('visible board candidates');
  });

  test('applies the exact stored sale with payroll, lineup, morale, and fan consequences', () => {
    const state = career(9503);
    const ultimatum = createBoardUltimatum(state)!;
    const resolution = boardForcedSaleAtDeadline(state, ultimatum)!;
    const player = state.players.find(
      (candidate) => candidate.id === resolution.playerId,
    )!;
    const userClub = state.clubs.find((club) => club.id === state.userClubId)!;
    const buyer = state.clubs.find(
      (club) => club.id === resolution.buyerClubId,
    )!;
    const next = applyBoardForcedSaleConsequences(state, resolution);

    expect(
      next.players.find((candidate) => candidate.id === player.id)?.clubId,
    ).toBe(buyer.id);
    expect(
      next.clubs.find((club) => club.id === state.userClubId),
    ).toMatchObject({
      fans: userClub.fans - resolution.fansLost,
      weeklyWages:
        userClub.weeklyWages -
        player.weeklyWage +
        next.players.find(
          (candidate) => candidate.id === resolution.replacementPlayerId,
        )!.weeklyWage,
    });
    expect(next.clubs.find((club) => club.id === buyer.id)).toMatchObject({
      cash: buyer.cash - resolution.fee,
      weeklyWages: buyer.weeklyWages + player.weeklyWage,
    });
    expect(
      next.players
        .filter(
          (candidate) =>
            candidate.clubId === state.userClubId &&
            candidate.id !== resolution.replacementPlayerId,
        )
        .every((candidate) => candidate.morale === 42),
    ).toBe(true);
    expect(
      next.players.find(
        (candidate) => candidate.id === resolution.replacementPlayerId,
      ),
    ).toMatchObject({
      clubId: state.userClubId,
      role: player.role,
      age: 17,
      weeklyWage: expect.any(Number),
    });
    expect(
      next.players.find(
        (candidate) => candidate.id === resolution.replacementPlayerId,
      )?.lookId,
    ).toMatch(new RegExp(`^${player.role === 'GK' ? 'g' : 'f'}\\d+$`));
    expect(
      next.players.filter((candidate) => candidate.clubId === state.userClubId),
    ).toHaveLength(16);
    expect(() => buildCareerTeamDef(next, state.userClubId)).not.toThrow();
  });

  test('a forced sale preserves an unlicensed hero on the bench', () => {
    const state = career(9505);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starterIds = new Set(lineup.playerIds);
    const departing = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        starterIds.has(player.id) &&
        player.role !== 'GK',
    )!;
    const reserves = state.players.filter(
      (player) =>
        player.clubId === state.userClubId &&
        !starterIds.has(player.id) &&
        player.role !== 'GK',
    );
    const unlicensedHero = reserves[0];
    const eligibleReserve = reserves[1];
    if (unlicensedHero === undefined || eligibleReserve === undefined) {
      throw new Error(
        'expected two outfield reserves for the forced-sale regression',
      );
    }
    const withHeroBenched = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === unlicensedHero.id) {
          return {
            ...player,
            role: departing.role,
            power: 'SUPER_SPEED' as const,
            licensed: false,
          };
        }
        return player.id === eligibleReserve.id
          ? { ...player, role: departing.role }
          : player;
      }),
    };
    const resolution = boardForcedSaleAtDeadline(withHeroBenched, {
      id: 'board-ultimatum-unlicensed-hero-regression',
      issuedSeason: withHeroBenched.season,
      issuedWeek: withHeroBenched.week,
      weeksRemaining: 1,
      targetCash: 0,
      candidates: [
        {
          playerId: departing.id,
          marketValue: 2,
          forcedSaleFee: 1,
          discountPercent: 30,
        },
      ],
    });
    if (resolution === undefined)
      throw new Error('expected a forced-sale resolution');

    const next = applyBoardForcedSaleConsequences(withHeroBenched, resolution);
    const nextLineup = next.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;

    expect(nextLineup.playerIds).not.toContain(unlicensedHero.id);
    expect(nextLineup.playerIds).toContain(eligibleReserve.id);
    expect(() => buildCareerTeamDef(next, state.userClubId)).not.toThrow();
  });

  test('clears an active target immediately when current cash reaches it', () => {
    const state = career(9504);
    const ultimatum = { ...createBoardUltimatum(state)!, targetCash: 1_000 };
    const below = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: 999 } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const met = {
      ...below,
      clubs: below.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: 1_000 } : club,
      ),
    };

    expect(clearMetBoardUltimatum(below)).toBe(below);
    const clearedSafety = clearMetBoardUltimatum(met).financialSafety;
    expect(clearedSafety?.boardUltimatum).toBeUndefined();
    expect(clearedSafety).toMatchObject({
      latestBoardResolution: { kind: 'TARGET_MET', targetCash: 1_000 },
    });
  });

  test('caps one forced sale at 150 lost fans', () => {
    const base = career(9504);
    const state = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, fans: 10_000 } : club,
      ),
    };

    expect(
      boardForcedSaleAtDeadline(state, createBoardUltimatum(state)!)?.fansLost,
    ).toBe(150);
  });
});

/**
 * The deadline arrives and the board cannot sell anyone.
 *
 * Two ways to get there: nobody is eligible at all (a squad trimmed to the
 * starting eleven, reachable by releasing expired substitutes at season end),
 * or the list is fine but no rival club can afford the quoted fee.
 */
describe('board ultimatum deadline with no completable sale', () => {
  function collapsingCareer(seed: number, cash: number): GameState {
    const state = career(seed);
    const ultimatum = createBoardUltimatum(state)!;
    return {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        facilityConversionUsed: true,
        boardUltimatum: { ...ultimatum, weeksRemaining: 1 },
      },
    };
  }

  /** Only the starting eleven remains, so nobody can leave without breaking it. */
  function trimmedToStartingEleven(state: GameState): GameState {
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const keep = new Set(lineup.playerIds);
    const dropped = state.players.filter(
      (player) => player.clubId === state.userClubId && !keep.has(player.id),
    );
    return {
      ...state,
      players: state.players.filter(
        (player) => player.clubId !== state.userClubId || keep.has(player.id),
      ),
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId
          ? {
              ...club,
              weeklyWages: dropped.reduce(
                (total, player) => total - player.weeklyWage,
                club.weeklyWages,
              ),
            }
          : club,
      ),
    };
  }

  function settle(state: GameState): GameState {
    let next = advanceWeek(state);
    while (next.phase === 'matchday') {
      const matchday = activeCareerMatchday(next)!;
      next = completeMatchday(
        next,
        matchday.fixtures.map((fixture) => ({
          fixtureId: fixture.id,
          homeGoals: 0,
          awayGoals: 2,
        })),
      );
    }
    return next;
  }

  test('drops a threat it can never carry out instead of parking it at one week forever', () => {
    let state = trimmedToStartingEleven(collapsingCareer(31_337, -12_000));
    expect(createBoardUltimatum(state)).toBeUndefined();

    const seen: (string | undefined)[] = [];
    for (let week = 0; week < 12; week += 1) {
      state = settle(state);
      if (state.phase === 'season-end') break;
      seen.push(state.financialSafety?.boardUltimatum?.id);
    }

    // Every settlement, not just the first: the ultimatum must not come back
    // while the squad still cannot supply a list.
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.filter((id) => id !== undefined)).toEqual([]);
    // Fail-soft, not game over — the club keeps playing and the floor carries it.
    expect(
      state.players.filter((player) => player.clubId === state.userClubId),
    ).toHaveLength(11);
  });

  test('mints a fresh id for each refreshed round instead of appending to the old one', () => {
    // No rival can afford anyone, so a sale is quoted and never completes.
    let state = collapsingCareer(31_337, -12_000);
    state = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? club : { ...club, cash: 0 },
      ),
    };

    const ids: string[] = [];
    for (let week = 0; week < 16; week += 1) {
      state = settle(state);
      if (state.phase === 'season-end') break;
      const id = state.financialSafety?.boardUltimatum?.id;
      if (id !== undefined && ids[ids.length - 1] !== id) ids.push(id);
    }

    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) {
      expect(id).toMatch(/^board-ultimatum-s\d+-w\d+$/);
    }
    // The bug: 22 -> 40 -> 58 -> 76 characters in sixteen weeks.
    expect(Math.max(...ids.map((id) => id.length))).toBeLessThan(30);
  });
});
