import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  weeklyMerchandiseIncome,
} from '../career';
import { buildCareerTeamDef } from '../squad';
import { buildFacility, createFacilityGrid, upgradeFacility } from '../facilities';
import {
  hireCareerCoach,
  startCareerScoutMission,
} from '../market-career';
import type { FixtureResult, GameState } from '../types';

function fullCareer(seed: number) {
  return createCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'));
}

function completeLeagueAndCupWeek(state: GameState, leagueResults: FixtureResult[]): GameState {
  const afterLeague = completeMatchday(state, leagueResults);
  const cupMatchday = activeCareerMatchday(afterLeague);
  if (afterLeague.phase !== 'matchday' || cupMatchday?.kind !== 'national-cup') return afterLeague;
  const userIsHome = cupMatchday.fixture.homeClubId === afterLeague.userClubId;
  return completeMatchday(afterLeague, [{
    fixtureId: cupMatchday.fixture.id,
    homeGoals: userIsHome ? 1 : 0,
    awayGoals: userIsHome ? 0 : 1,
  }]);
}

describe('M2 weekly sidecars', () => {
  test('advances exactly one National Cup round on each cup calendar week', () => {
    const initial = fullCareer(501);
    const weekFive = { ...initial, week: 5, phase: 'matchday' as const };
    const results = fixturesForCurrentWeek(weekFive).map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    }));

    const settled = completeLeagueAndCupWeek(weekFive, results);
    const cup = settled.m2?.nationalCups[0];

    expect(cup?.rounds).toHaveLength(2);
    expect(cup?.rounds[0].fixtures.every(fixture => fixture.status === 'played')).toBe(true);
    expect(cup?.rounds[1].fixtures.every(fixture => fixture.status === 'scheduled')).toBe(true);
    expect(JSON.stringify(settled)).toBe(JSON.stringify(completeLeagueAndCupWeek(weekFive, results)));
  });

  test('resolves the scouting clock through normal week advancement', () => {
    const initial = fullCareer(502);
    const started = startCareerScoutMission(
      initial,
      initial.market!,
      'LOCAL',
      { kind: 'AGE', minimumAge: 16, maximumAge: 29 },
      5,
    );
    let state: GameState = { ...started.state, market: started.market };
    const dueWeek = started.market.activeScoutMission!.dueWeek;

    while (state.week < dueWeek) state = advanceWeek(state);

    expect(state.market?.activeScoutMission).toBeUndefined();
    expect(state.market?.scoutReports).toBeDefined();
  });

  test('itemizes the employed head coach wage', () => {
    const initial = fullCareer(503);
    const market = hireCareerCoach(initial.market!, initial.market!.coachCandidates[0].id);
    const settled = advanceWeek({ ...initial, market });

    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'wages',
      label: 'Head coach wage',
      amount: -market.headCoach!.weeklyWage,
    });
  });

  test('applies full-career condition workload while leaving the M1 slice unchanged', () => {
    const focusPlan = (state: GameState): GameState => {
      const playerId = state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds[0];
      return {
        ...state,
        players: state.players.map(player => player.id === playerId
          ? { ...player, condition: 20 }
          : player),
        trainingPlan: {
          assignedPlayerIds: [playerId],
          drills: [
            { id: 'condition-one', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
            { id: 'condition-two', moneyCost: 0, tpCost: 0, gains: { sho: 1 } },
            { id: 'condition-three', moneyCost: 0, tpCost: 0, gains: { sta: 1 } },
          ],
        },
      };
    };
    const m2Before = focusPlan(fullCareer(504));
    const m1Before = focusPlan(createCareer(createLaunchCareerSetup(504)));
    const playerId = m2Before.trainingPlan!.assignedPlayerIds[0];

    const m2After = advanceWeek(m2Before);
    const m1After = advanceWeek(m1Before);

    expect(m2After.players.find(player => player.id === playerId)?.condition).toBe(8);
    expect(m1After.players.find(player => player.id === playerId)?.condition).toBe(20);
  });

  test('applies match result and playing-time morale through normal M2 settlement', () => {
    let state = fullCareer(505);
    while (state.week < 5) state = advanceWeek(state);
    state = advanceWeek(state);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const starterId = lineup.playerIds[0];
    const benchId = state.players.find(player => (
      player.clubId === state.userClubId && !lineup.playerIds.includes(player.id)
    ))!.id;
    state = {
      ...state,
      players: state.players.map(player => player.id === starterId || player.id === benchId
        ? { ...player, morale: 50, consecutiveLowMoraleWeeks: 0 }
        : player),
    };
    const userFixture = fixturesForCurrentWeek(state).find(fixture => (
      fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId
    ))!;
    const results = fixturesForCurrentWeek(state).map(fixture => {
      if (fixture.id !== userFixture.id) {
        return { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 };
      }
      return fixture.homeClubId === state.userClubId
        ? { fixtureId: fixture.id, homeGoals: 2, awayGoals: 0 }
        : { fixtureId: fixture.id, homeGoals: 0, awayGoals: 2 };
    });

    const settled = completeLeagueAndCupWeek(state, results);

    expect(settled.players.find(player => player.id === starterId)?.morale).toBe(60);
    expect(settled.players.find(player => player.id === benchId)?.morale).toBe(54);
  });

  test('auto-benches an overtrained starter before a consecutive match week', () => {
    let injuredStarterId: string | undefined;
    let replacementId: string | undefined;
    let settled: GameState | undefined;

    for (let seed = 1; seed <= 100 && settled === undefined; seed += 1) {
      let state = fullCareer(seed);
      while (state.week < 5) state = advanceWeek(state);
      const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
      const targetId = lineup.playerIds[1];
      state = {
        ...state,
        players: state.players.map(player => player.id === targetId
          ? { ...player, condition: 0 }
          : player),
        trainingPlan: {
          assignedPlayerIds: [targetId],
          drills: [
            { id: 'injury-one', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
            { id: 'injury-two', moneyCost: 0, tpCost: 0, gains: { sho: 1 } },
            { id: 'injury-three', moneyCost: 0, tpCost: 0, gains: { sta: 1 } },
          ],
        },
      };
      const matchday = advanceWeek(state);
      const results = fixturesForCurrentWeek(matchday).map(fixture => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 0,
      }));
      const candidate = completeLeagueAndCupWeek(matchday, results);
      const injured = candidate.players.find(player => player.id === targetId);
      if ((injured?.injuryWeeks ?? 0) === 0) continue;

      const repairedLineup = candidate.lineups.find(item => item.clubId === candidate.userClubId)!;
      injuredStarterId = targetId;
      replacementId = repairedLineup.playerIds[1];
      settled = candidate;
    }

    expect(settled).toBeDefined();
    if (settled === undefined || injuredStarterId === undefined || replacementId === undefined) {
      throw new Error('expected a deterministic starter injury sample');
    }
    expect(settled.week).toBe(6);
    expect(replacementId).not.toBe(injuredStarterId);
    expect(settled.players.find(player => player.id === replacementId)?.injuryWeeks).toBe(0);
    expect(() => buildCareerTeamDef(settled!, settled!.userClubId)).not.toThrow();

    const nextMatchday = advanceWeek(settled);
    expect(nextMatchday.phase).toBe('matchday');
    expect(() => buildCareerTeamDef(nextMatchday, nextMatchday.userClubId)).not.toThrow();
  });

  test('itemizes Fan Shop income and applies the stadium adjacency bonus only in full mode', () => {
    let grid = buildFacility(
      createFacilityGrid(),
      'fan-shop',
      { x: 0, y: 0 },
      100_000,
    ).grid;
    grid = upgradeFacility(grid, 'facility-1', 100_000).grid;
    grid = upgradeFacility(grid, 'facility-1', 100_000).grid;
    const fanShopOnly = grid;
    grid = buildFacility(grid, 'stadium-stand', { x: 1, y: 0 }, 100_000).grid;
    const initial = fullCareer(506);
    const club = initial.clubs.find(candidate => candidate.id === initial.userClubId)!;
    const baseState: GameState = {
      ...initial,
      facilities: { ...initial.facilities, grid: fanShopOnly },
    };
    const adjacentState: GameState = {
      ...initial,
      facilities: { ...initial.facilities, grid },
    };
    const baseIncome = weeklyMerchandiseIncome(baseState, club);
    const adjacencyIncome = weeklyMerchandiseIncome(adjacentState, club);

    expect(baseIncome).toBe(Math.floor((club.fans * 3) / 5));
    expect(adjacencyIncome).toBe(baseIncome + Math.floor(baseIncome / 10));
    expect(advanceWeek(adjacentState).ledgers[0].lines).toContainEqual({
      kind: 'merch',
      label: 'Fan Shop merchandise',
      amount: adjacencyIncome,
    });

    const m1 = createCareer(createLaunchCareerSetup(506));
    expect(weeklyMerchandiseIncome({
      ...m1,
      facilities: { ...m1.facilities, grid },
    }, m1.clubs.find(candidate => candidate.id === m1.userClubId)!)).toBe(0);
  });
});
