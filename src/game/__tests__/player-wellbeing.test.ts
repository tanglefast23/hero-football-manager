import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  buildFacility,
  createFacilityGrid,
  upgradeFacility,
  type FacilityGridState,
} from '../facilities';
import {
  medicalBayRecoveryWeeks,
  overtrainingInjuryChancePercent,
  resolveWeeklyPlayerWellbeing,
} from '../player-wellbeing';
import type { CareerPlayer, GameState } from '../types';

function career(seed = 1): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

function userPlayers(state: GameState): CareerPlayer[] {
  return state.players.filter(player => player.clubId === state.userClubId);
}

function withPlayedUserFixture(
  state: GameState,
  homeGoals: number,
  awayGoals: number,
): GameState {
  const opponentId = state.clubs.find(club => club.id !== state.userClubId)?.id;
  if (opponentId === undefined) throw new Error('missing opponent');
  return {
    ...state,
    fixtures: [{
      id: 'wellbeing-match',
      season: state.season,
      round: 1,
      week: state.week,
      homeClubId: state.userClubId,
      awayClubId: opponentId,
      matchSeed: 1,
      status: 'played',
      score: { homeGoals, awayGoals },
    }],
  };
}

function withUserPlayerChanges(
  state: GameState,
  changes: (player: CareerPlayer, userIndex: number) => CareerPlayer,
): GameState {
  let userIndex = 0;
  return {
    ...state,
    players: state.players.map(player => {
      if (player.clubId !== state.userClubId) return player;
      const changed = changes(player, userIndex);
      userIndex += 1;
      return changed;
    }),
  };
}

describe('weekly player wellbeing', () => {
  test('combines focus workload, recovery, match result, and starter status', () => {
    let state = career(7);
    const roster = userPlayers(state);
    const userLineup = state.lineups.find(lineup => lineup.clubId === state.userClubId)!;
    const starterId = userLineup.playerIds[0];
    const benchId = roster.find(player => !userLineup.playerIds.includes(player.id))!.id;
    state = withUserPlayerChanges(state, player => ({
      ...player,
      condition: 50,
      morale: 50,
      consecutiveLowMoraleWeeks: 0,
    }));
    state = withPlayedUserFixture(state, 2, 0);
    state = {
      ...state,
      trainingPlan: {
        assignedPlayerIds: [starterId],
        drills: [
          { id: 'one', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
          { id: 'two', moneyCost: 0, tpCost: 0, gains: { sho: 1 } },
          { id: 'three', moneyCost: 0, tpCost: 0, gains: { sta: 1 } },
        ],
      },
    };
    const before = JSON.stringify(state);

    const result = resolveWeeklyPlayerWellbeing(state, {
      trainedPlayers: state.players,
      focusApplied: true,
    });
    const starter = result.players.find(player => player.id === starterId);
    const bench = result.players.find(player => player.id === benchId);

    expect(result.matchOutcome).toBe('win');
    expect(starter).toMatchObject({ condition: 38, morale: 55, consecutiveLowMoraleWeeks: 0 });
    expect(bench).toMatchObject({ condition: 62, morale: 52, consecutiveLowMoraleWeeks: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  test('tracks sustained low morale and resets the counter on recovery', () => {
    let state = withPlayedUserFixture(career(8), 0, 2);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const starterId = lineup.playerIds[0];
    const benchId = userPlayers(state).find(player => !lineup.playerIds.includes(player.id))!.id;
    state = withUserPlayerChanges(state, player => ({
      ...player,
      condition: 70,
      morale: player.id === starterId ? 30 : player.id === benchId ? 32 : 50,
      consecutiveLowMoraleWeeks: player.id === starterId ? 2 : player.id === benchId ? 4 : 0,
    }));

    const result = resolveWeeklyPlayerWellbeing(state, {
      trainedPlayers: state.players,
      focusApplied: false,
    });

    expect(result.players.find(player => player.id === starterId)).toMatchObject({
      morale: 29,
      consecutiveLowMoraleWeeks: 3,
    });
    expect(result.players.find(player => player.id === benchId)).toMatchObject({
      morale: 28,
      consecutiveLowMoraleWeeks: 5,
    });

    const recoveryWeek = { ...state, fixtures: [] };
    recoveryWeek.players = result.players.map(player => player.id === starterId
      ? { ...player, morale: 35 }
      : player);
    const recovered = resolveWeeklyPlayerWellbeing(recoveryWeek, {
      trainedPlayers: recoveryWeek.players,
      focusApplied: false,
    });
    expect(recovered.players.find(player => player.id === starterId)?.consecutiveLowMoraleWeeks)
      .toBe(0);
  });

  test('uses seeded overtraining checks and produces byte-identical output', () => {
    let selected: { state: GameState; result: ReturnType<typeof resolveWeeklyPlayerWellbeing> } | undefined;
    for (let seed = 1; seed <= 100 && selected === undefined; seed += 1) {
      let state = career(seed);
      const playerId = userPlayers(state)[0].id;
      state = withUserPlayerChanges(state, player => ({
        ...player,
        condition: player.id === playerId ? 0 : 100,
        injuryWeeks: 0,
      }));
      state = {
        ...state,
        trainingPlan: {
          assignedPlayerIds: [playerId],
          drills: [
            { id: 'one', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
            { id: 'two', moneyCost: 0, tpCost: 0, gains: { sho: 1 } },
            { id: 'three', moneyCost: 0, tpCost: 0, gains: { sta: 1 } },
          ],
        },
      };
      const result = resolveWeeklyPlayerWellbeing(state, {
        trainedPlayers: state.players,
        focusApplied: true,
      });
      if (result.injuryChecks[0]?.injured) selected = { state, result };
    }
    expect(selected).toBeDefined();
    if (selected === undefined) throw new Error('expected a deterministic injury sample');

    const repeated = resolveWeeklyPlayerWellbeing(selected.state, {
      trainedPlayers: selected.state.players,
      focusApplied: true,
    });
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(selected.result));
    expect(selected.result.injuryChecks[0]).toMatchObject({
      condition: 0,
      chancePercent: 70,
      injured: true,
    });
    expect(selected.result.injuryChecks[0].recoveryWeeks).toBeGreaterThanOrEqual(2);
    expect(selected.result.injuryChecks[0].recoveryWeeks).toBeLessThanOrEqual(6);
  });

  test('uses Medical Bay level for recovery and adjacency for the documented risk reduction', () => {
    let grid = buildFacility(
      createFacilityGrid(),
      'medical-bay',
      { x: 0, y: 0 },
      1_000_000,
    ).grid;
    grid = upgradeFacility(grid, 'facility-1', 1_000_000).grid;
    grid = upgradeFacility(grid, 'facility-1', 1_000_000).grid;
    const medicalOnly = grid;
    const adjacent = buildFacility(grid, 'training-pitch', { x: 1, y: 0 }, 1_000_000).grid;

    expect(medicalBayRecoveryWeeks(6, 3)).toBe(3);
    expect(medicalBayRecoveryWeeks(2, 3)).toBe(1);
    expect(overtrainingInjuryChancePercent(0, 0)).toBe(70);
    expect(overtrainingInjuryChancePercent(0, 20)).toBe(56);
    expect(overtrainingInjuryChancePercent(30, 20)).toBe(0);

    const makeLowConditionState = (facilityGrid: FacilityGridState): GameState => {
      let state = career(2);
      const playerId = userPlayers(state)[0].id;
      state = withUserPlayerChanges(state, player => ({
        ...player,
        condition: player.id === playerId ? 0 : 100,
      }));
      return {
        ...state,
        facilities: { ...state.facilities, grid: facilityGrid },
        trainingPlan: {
          assignedPlayerIds: [playerId],
          drills: [
            { id: 'one', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
            { id: 'two', moneyCost: 0, tpCost: 0, gains: { sho: 1 } },
            { id: 'three', moneyCost: 0, tpCost: 0, gains: { sta: 1 } },
          ],
        },
      };
    };
    const medicalState = makeLowConditionState(medicalOnly);
    const adjacencyState = makeLowConditionState(adjacent);
    const medicalResult = resolveWeeklyPlayerWellbeing(medicalState, {
      trainedPlayers: medicalState.players,
      focusApplied: true,
    });
    const adjacencyResult = resolveWeeklyPlayerWellbeing(adjacencyState, {
      trainedPlayers: adjacencyState.players,
      focusApplied: true,
    });

    expect(medicalResult.injuryChecks[0].chancePercent).toBe(70);
    expect(adjacencyResult.injuryChecks[0].chancePercent).toBe(56);
    expect(medicalResult.injuryChecks[0].injured).toBe(true);
    expect(adjacencyResult.injuryChecks[0].injured).toBe(false);
    expect(medicalResult.injuryChecks[0].recoveryWeeks)
      .toBe(medicalBayRecoveryWeeks(medicalResult.injuryChecks[0].baseRecoveryWeeks!, 3));
  });

  test('leaves opponents unchanged and rejects incomplete training output', () => {
    const state = career(9);
    const opponent = state.players.find(player => player.clubId !== state.userClubId)!;
    const result = resolveWeeklyPlayerWellbeing(state, {
      trainedPlayers: state.players,
      focusApplied: false,
    });

    expect(result.players.find(player => player.id === opponent.id)).toBe(opponent);
    expect(() => resolveWeeklyPlayerWellbeing(state, {
      trainedPlayers: state.players.slice(1),
      focusApplied: false,
    })).toThrow(/every career player/);
    expect(() => medicalBayRecoveryWeeks(0, 1)).toThrow(/positive/);
  });
});
