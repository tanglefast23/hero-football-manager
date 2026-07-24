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
import { trainPlayerInstantly } from '../training';
import {
  advanceFacilityConstruction,
  buildFacility,
  createFacilityGrid,
  upgradeFacility,
  type FacilityGridState,
} from '../facilities';
import { buildCareerFacility } from '../management';
import {
  hireCareerCoach,
  startCareerScoutMission,
} from '../market-career';
import type { FixtureResult, GameState } from '../types';
import { protectBoardUltimatumPlayer } from '../board-ultimatum';

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

function settleScheduledWeek(state: GameState): GameState {
  let next = advanceWeek(state);
  while (next.phase === 'matchday') {
    const matchday = activeCareerMatchday(next)!;
    next = completeMatchday(next, matchday.fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    })));
  }
  return next;
}

describe('M2 weekly sidecars', () => {
  test('advances exactly one National Cup round on each cup calendar week', () => {
    const initial = fullCareer(501);
    const weekTen = { ...initial, week: 10, phase: 'matchday' as const };
    const results = fixturesForCurrentWeek(weekTen).map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    }));

    const settled = completeLeagueAndCupWeek(weekTen, results);
    const cup = settled.m2?.nationalCups[0];

    expect(cup?.rounds).toHaveLength(2);
    expect(cup?.rounds[0].fixtures.every(fixture => fixture.status === 'played')).toBe(true);
    expect(cup?.rounds[1].fixtures.every(fixture => fixture.status === 'scheduled')).toBe(true);
    expect(JSON.stringify(settled)).toBe(JSON.stringify(completeLeagueAndCupWeek(weekTen, results)));
  });

  test('resolves the scouting clock through normal week advancement', () => {
    const initial = { ...fullCareer(502), week: 15 };
    const started = startCareerScoutMission(
      initial,
      initial.market!,
      'LOCAL',
      { kind: 'AGE', minimumAge: 16, maximumAge: 29 },
      5,
    );
    let state: GameState = { ...started.state, market: started.market };
    const dueWeek = started.market.activeScoutMission!.dueWeek;

    while (state.week < dueWeek) state = settleScheduledWeek(state);

    expect(state.market?.activeScoutMission).toBeUndefined();
    expect(state.market?.scoutReports).toBeDefined();
  });

  test('itemizes the employed coaching staff wage', () => {
    const initial = fullCareer(503);
    const officeProject = buildCareerFacility(initial, 'coaching-office', { x: 2, y: 0 }).state;
    const withOffice: GameState = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: completeFacilityProject(officeProject.facilities.grid!),
      },
    };
    const head = withOffice.market!.coachCandidates[0];
    const assistant = withOffice.market!.coachCandidates.find(candidate => candidate.id !== head.id)!;
    let market = hireCareerCoach(withOffice, withOffice.market!, head.id);
    market = hireCareerCoach(withOffice, market, assistant.id, 'ASSISTANT');
    const settled = advanceWeek({ ...withOffice, market });

    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'wages',
      label: 'Coaching staff wages',
      amount: -(market.headCoach!.weeklyWage + market.assistantCoach!.weeklyWage),
    });
    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'subsidy',
      label: 'Season 1 wage subsidy',
      amount: Math.floor((withOffice.clubs.find(club => club.id === initial.userClubId)!.weeklyWages
        + market.headCoach!.weeklyWage + market.assistantCoach!.weeklyWage) / 2),
    });
  });

  test('warns on negative cash, issues the one emergency loan, and schedules repayment', () => {
    let state = fullCareer(504);
    state = {
      ...state,
      clubs: state.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: -50_000 }
        : club),
    };
    for (let week = 0; week < 4; week += 1) state = settleScheduledWeek(state);

    expect(state.financialSafety).toMatchObject({
      emergencyLoanUsed: true,
      loan: {
        originalAmount: 20_000,
        remainingBalance: 22_000,
        repaymentStartsSeason: 2,
        remainingWeeks: 30,
      },
    });
    expect(state.ledgers[3].lines).toContainEqual({
      kind: 'emergency-loan',
      label: 'Board emergency loan',
      amount: 20_000,
    });

    const repaymentState: GameState = {
      ...fullCareer(505),
      season: 2,
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: {
          originalAmount: 20_000,
          remainingBalance: 22_000,
          repaymentStartsSeason: 2,
          remainingWeeks: 30,
        },
      },
    };
    const repaid = advanceWeek(repaymentState);
    expect(repaid.ledgers[0].lines).toContainEqual({
      kind: 'loan-repayment',
      label: 'Emergency loan repayment',
      amount: -734,
    });
    expect(repaid.financialSafety?.loan).toMatchObject({
      remainingBalance: 21_266,
      remainingWeeks: 29,
    });
  });

  test('runs a persistent four-week protected-player ultimatum and forced sale', () => {
    let state = fullCareer(5051);
    state = {
      ...state,
      clubs: state.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: -500_000 }
        : club),
    };
    for (let week = 0; week < 4; week += 1) state = settleScheduledWeek(state);
    const ultimatum = state.financialSafety?.boardUltimatum;

    expect(ultimatum).toMatchObject({ weeksRemaining: 4, targetCash: 0 });
    expect(ultimatum?.candidates).toHaveLength(4);
    const protectedId = ultimatum!.candidates[0].playerId;
    state = protectBoardUltimatumPlayer(state, protectedId);
    for (let week = 0; week < 3; week += 1) state = settleScheduledWeek(state);
    expect(state.financialSafety?.boardUltimatum?.weeksRemaining).toBe(1);

    const candidateIds = ultimatum!.candidates.map(candidate => candidate.playerId);
    state = settleScheduledWeek(state);
    const resolution = state.financialSafety?.latestBoardResolution;

    expect(resolution).toMatchObject({
      kind: 'FORCED_SALE',
      discountPercent: 30,
      moraleDelta: -8,
    });
    if (resolution?.kind !== 'FORCED_SALE') throw new Error('expected a board forced sale');
    expect(candidateIds).toContain(resolution.playerId);
    expect(resolution.playerId).not.toBe(protectedId);
    expect(state.players.find(player => player.id === protectedId)?.clubId).toBe(state.userClubId);
    expect(state.players.find(player => player.id === resolution.playerId)?.clubId)
      .toBe(resolution.buyerClubId);
    expect(state.ledgers.at(-1)?.lines).toContainEqual({
      kind: 'board-sale',
      label: `Board-enforced sale · ${resolution.playerId}`,
      amount: resolution.fee,
    });
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
  });

  test('applies full-career condition workload while leaving the M1 slice unchanged', () => {
    const focusPlan = (state: GameState): { state: GameState; playerId: string } => {
      const playerId = state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds[0];
      const prepared = {
        ...state,
        trainingPoints: 100,
        players: state.players.map(player => player.id === playerId
          ? { ...player, condition: 60 }
          : player),
      };
      return { state: trainPlayerInstantly(prepared, playerId, 'sprints').state, playerId };
    };
    const m2 = focusPlan(fullCareer(504));
    const m1 = focusPlan(createCareer(createLaunchCareerSetup(504)));

    // Conditioning is a full-career system: the tap costs 8 there, while the
    // m1 slice (which has no recovery or wellbeing) charges nothing.
    expect(m2.state.players.find(player => player.id === m2.playerId)?.condition).toBe(52);
    expect(m1.state.players.find(player => player.id === m1.playerId)?.condition).toBe(60);

    // The +12 weekly recovery is the full career's wellbeing tick only.
    const m2After = advanceWeek(m2.state);
    const m1After = advanceWeek(m1.state);
    expect(m2After.players.find(player => player.id === m2.playerId)?.condition).toBe(64);
    expect(m1After.players.find(player => player.id === m1.playerId)?.condition).toBe(60);
  });

  test('applies match result and playing-time morale through normal M2 settlement', () => {
    let state = fullCareer(505);
    while (state.week < 5) state = settleScheduledWeek(state);
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

    expect(settled.players.find(player => player.id === starterId)?.morale).toBe(55);
    expect(settled.players.find(player => player.id === benchId)?.morale).toBe(52);
  });

  test('benches a starter the moment an exhausted drill injures them', () => {
    let state = fullCareer(1);
    while (state.week < 4) state = settleScheduledWeek(state);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const targetId = lineup.playerIds[1];
    const prepared: GameState = {
      ...state,
      trainingPoints: 100,
      players: state.players.map(player => player.id === targetId
        ? { ...player, condition: 0 }
        : player),
    };

    // At 0 condition the gamble is 70%; probe nonces to land the injury tap.
    let injured: GameState | undefined;
    for (let nonce = 0; nonce < 200 && injured === undefined; nonce += 1) {
      const result = trainPlayerInstantly(
        { ...prepared, totalInstantDrills: nonce },
        targetId,
        'sprints',
      );
      if (result.injury !== undefined) injured = result.state;
    }
    expect(injured).toBeDefined();
    if (injured === undefined) throw new Error('expected a deterministic injury sample');

    // The tap itself repaired the lineup: the injured starter is out, the
    // replacement is fit, and the eleven still builds a valid match team.
    const repairedLineup = injured.lineups.find(item => item.clubId === injured!.userClubId)!;
    expect(repairedLineup.playerIds).not.toContain(targetId);
    const replacementId = repairedLineup.playerIds[1];
    expect(injured.players.find(player => player.id === replacementId)?.injuryWeeks).toBe(0);
    expect(() => buildCareerTeamDef(injured!, injured!.userClubId)).not.toThrow();

    const matchday = advanceWeek(injured);
    expect(matchday.phase).toBe('matchday');
    expect(() => buildCareerTeamDef(matchday, matchday.userClubId)).not.toThrow();
  });

  test('itemizes Fan Shop income and applies the stadium adjacency bonus only in full mode', () => {
    let grid = buildFacility(
      createFacilityGrid(),
      'fan-shop',
      { x: 0, y: 0 },
      100_000,
    ).grid;
    grid = completeFacilityProject(grid);
    grid = upgradeFacility(grid, 'facility-1', 100_000).grid;
    grid = completeFacilityProject(grid);
    grid = upgradeFacility(grid, 'facility-1', 100_000).grid;
    grid = completeFacilityProject(grid);
    const fanShopOnly = grid;
    grid = buildFacility(grid, 'stadium-stand', { x: 1, y: 0 }, 100_000).grid;
    grid = completeFacilityProject(grid);
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

function completeFacilityProject(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return next;
}
