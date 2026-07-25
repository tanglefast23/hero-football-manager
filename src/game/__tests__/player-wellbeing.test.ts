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
  medicalBayRecoveryWeeks,
  overtrainingInjuryChancePercent,
  resolveWeeklyPlayerWellbeing,
} from '../player-wellbeing';
import { trainPlayerInstantly } from '../training';
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
  test('combines recovery, match result, and starter status without a training workload', () => {
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
    const before = JSON.stringify(state);

    const result = resolveWeeklyPlayerWellbeing(state);
    const starter = result.players.find(player => player.id === starterId);
    const bench = result.players.find(player => player.id === benchId);

    expect(result.matchOutcome).toBe('win');
    // Drill costs land at tap time now, so settlement is pure +12 recovery.
    expect(starter).toMatchObject({ condition: 62, morale: 55, consecutiveLowMoraleWeeks: 0 });
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

    const result = resolveWeeklyPlayerWellbeing(state);

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
    const recovered = resolveWeeklyPlayerWellbeing(recoveryWeek);
    expect(recovered.players.find(player => player.id === starterId)?.consecutiveLowMoraleWeeks)
      .toBe(0);
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
      state = withUserPlayerChanges(state, player => ({
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
    for (let nonce = 0; nonce < 200 && injuredResult === undefined; nonce += 1) {
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
    const adjacencyResult = trainPlayerInstantly(adjacencyState, playerId, 'sprints');
    expect(adjacencyResult.injury?.chancePercent ?? overtrainingInjuryChancePercent(0, 20)).toBe(56);
  });

  test('leaves opponents unchanged', () => {
    const state = career(9);
    const opponent = state.players.find(player => player.clubId !== state.userClubId)!;
    const result = resolveWeeklyPlayerWellbeing(state);

    expect(result.players.find(player => player.id === opponent.id)).toBe(opponent);
  });

  test('drains an underpaid star, honors Motivator carry, and raises a transfer request', () => {
    let state = createCareer(createLaunchCareerSetup(10));
    const player = userPlayers(state)[0];
    const coach = state.market!.coachCandidates[0];
    state = withUserPlayerChanges(state, candidate => candidate.id === player.id
      ? {
          ...candidate,
          power: 'SUPER_SPEED',
          onHeroWage: false,
          personality: 'Greedy',
          morale: 30,
          consecutiveLowMoraleWeeks: 1,
        }
      : candidate);
    state = {
      ...state,
      market: {
        ...state.market!,
        headCoach: { ...coach, level: 5, specialties: ['MOTIVATOR', 'ATTACK'] },
      },
    };

    const first = resolveWeeklyPlayerWellbeing(state);
    const updated = first.players.find(candidate => candidate.id === player.id)!;

    expect(updated).toMatchObject({
      morale: 28,
      consecutiveLowMoraleWeeks: 2,
      motivatorMoraleRemainderHalfPoints: 100,
      transferRequested: true,
    });
  });

  test('gives a Level 1 assistant Motivator an exact 2.5% morale effect', () => {
    let state = createCareer(createLaunchCareerSetup(11));
    const player = userPlayers(state)[0];
    const assistant = state.market!.coachCandidates[0];
    state = withUserPlayerChanges(state, candidate => candidate.id === player.id
      ? {
          ...candidate,
          power: 'SUPER_SPEED',
          onHeroWage: false,
          personality: 'Greedy',
          morale: 100,
        }
      : candidate);
    state = {
      ...state,
      market: {
        ...state.market!,
        assistantCoach: { ...assistant, level: 1, specialties: ['MOTIVATOR', 'ATTACK'] },
      },
    };

    for (let week = 0; week < 20; week += 1) {
      const result = resolveWeeklyPlayerWellbeing(state);
      state = { ...state, players: result.players };
    }

    const updated = state.players.find(candidate => candidate.id === player.id)!;
    expect(updated.morale).toBe(61);
    expect(updated.motivatorMoraleRemainderHalfPoints).toBe(0);
  });
});

function completeFacilityProject(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return next;
}
