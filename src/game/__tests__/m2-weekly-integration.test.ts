import { createLaunchCareerSetup } from '../../application/launch';
import {
  CUP_SETTLEMENT_WEEKS,
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
  type PlacedFacility,
} from '../facilities';
import { buildCareerFacility } from '../management';
import { FACILITY_CATALOG } from '../facilities';
import { hireCareerCoach, startCareerScoutMission } from '../market-career';
import type { FixtureResult, GameState } from '../types';
import {
  createBoardUltimatum,
  protectBoardUltimatumPlayer,
} from '../board-ultimatum';

function fullCareer(seed: number) {
  return createCareer(createLaunchCareerSetup(seed));
}

function completeLeagueAndCupWeek(
  state: GameState,
  leagueResults: FixtureResult[],
): GameState {
  const afterLeague = completeMatchday(state, leagueResults);
  const cupMatchday = activeCareerMatchday(afterLeague);
  if (afterLeague.phase !== 'matchday' || cupMatchday?.kind !== 'national-cup')
    return afterLeague;
  const userIsHome = cupMatchday.fixture.homeClubId === afterLeague.userClubId;
  return completeMatchday(afterLeague, [
    {
      fixtureId: cupMatchday.fixture.id,
      homeGoals: userIsHome ? 1 : 0,
      awayGoals: userIsHome ? 0 : 1,
    },
  ]);
}

function settleScheduledWeek(state: GameState): GameState {
  let next = advanceWeek(state);
  while (next.phase === 'matchday') {
    const matchday = activeCareerMatchday(next)!;
    next = completeMatchday(
      next,
      matchday.fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 1,
      })),
    );
  }
  return next;
}

const placedFacility = (
  id: number,
  type: PlacedFacility['type'],
  x: number,
  y: number,
): PlacedFacility => ({
  id: `facility-${id}`,
  type,
  level: 1,
  capitalInvested: 10_000,
  x,
  y,
});

describe('M2 weekly sidecars', () => {
  test('advances exactly one Hero Cup round on each cup calendar week', () => {
    // The cup calendar settles in weeks the league leaves empty, so the play-in
    // week is settled through ordinary week advancement rather than as the
    // second half of a double-header.
    const playInWeek = { ...fullCareer(501), week: CUP_SETTLEMENT_WEEKS[0] };

    const settled = settleScheduledWeek(playInWeek);
    const cup = settled.m2?.nationalCups[0];

    expect(cup?.rounds).toHaveLength(2);
    expect(
      cup?.rounds[0].fixtures.every((fixture) => fixture.status === 'played'),
    ).toBe(true);
    expect(
      cup?.rounds[1].fixtures.every(
        (fixture) => fixture.status === 'scheduled',
      ),
    ).toBe(true);
    expect(JSON.stringify(settled)).toBe(
      JSON.stringify(settleScheduledWeek(playInWeek)),
    );
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
    const officeProject = buildCareerFacility(initial, 'coaching-office', {
      x: 2,
      y: 0,
    }).state;
    const withOffice: GameState = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: completeFacilityProject(officeProject.facilities.grid!),
      },
    };
    const head = withOffice.market!.coachCandidates[0];
    const assistant = withOffice.market!.coachCandidates.find(
      (candidate) => candidate.id !== head.id,
    )!;
    let market = hireCareerCoach(withOffice, withOffice.market!, head.id);
    market = hireCareerCoach(withOffice, market, assistant.id, 'ASSISTANT');
    const settled = advanceWeek({ ...withOffice, market });

    expect(settled.ledgers[0].lines).toContainEqual(
      expect.objectContaining({
        kind: 'wages',
        label: 'Coaching staff wages',
        amount: -(
          market.headCoach!.weeklyWage + market.assistantCoach!.weeklyWage
        ),
      }),
    );
    expect(settled.ledgers[0].lines).toContainEqual(
      expect.objectContaining({
        kind: 'subsidy',
        label: 'Season 1 wage subsidy',
        amount: Math.floor(
          (withOffice.clubs.find((club) => club.id === initial.userClubId)!
            .weeklyWages +
            market.headCoach!.weeklyWage +
            market.assistantCoach!.weeklyWage) /
            2,
        ),
      }),
    );
  });

  test('warns on negative cash, issues the one emergency loan, and schedules repayment', () => {
    let state = fullCareer(504);
    state = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: -50_000 } : club,
      ),
    };
    for (let week = 0; week < 2; week += 1) state = settleScheduledWeek(state);

    // The rescue clears the hole and preserves the old $15,000 operating floor,
    // so the cheaper Stand leaves $5,000 to pay the next bills.
    expect(state.financialSafety).toMatchObject({
      emergencyLoanUsed: true,
      loan: {
        originalAmount: expect.any(Number),
        remainingBalance: expect.any(Number),
        repaymentStartsSeason: 2,
        remainingWeeks: 30,
      },
    });
    expect(state.ledgers.at(-1)?.lines).toContainEqual(
      expect.objectContaining({
        kind: 'emergency-loan',
        label: 'Board emergency loan',
        amount: state.financialSafety!.loan!.originalAmount,
      }),
    );
    // The property, not just the number: the week the loan lands the club can
    // afford the stand Bert points at and still keep an operating buffer.
    const rescuedCash = state.clubs.find(
      (club) => club.id === state.userClubId,
    )!.cash;
    expect(rescuedCash).toBe(15_000);
    expect(rescuedCash - FACILITY_CATALOG['stadium-stand'].buildCost).toBe(
      5_000,
    );

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
    expect(repaid.ledgers[0].lines).toContainEqual(
      expect.objectContaining({
        kind: 'loan-repayment',
        label: 'Emergency loan repayment',
        amount: -734,
      }),
    );
    expect(repaid.financialSafety?.loan).toMatchObject({
      remainingBalance: 21_266,
      remainingWeeks: 29,
    });
  });

  test('issues the promised loan the week after a warning even if cash is green', () => {
    let warned = fullCareer(506);
    warned = {
      ...warned,
      clubs: warned.clubs.map((club) =>
        club.id === warned.userClubId ? { ...club, cash: -50_000 } : club,
      ),
    };
    warned = settleScheduledWeek(warned);
    expect(warned.financialSafety).toMatchObject({
      consecutiveNegativeWeeks: 1,
      emergencyLoanUsed: false,
    });

    const recoveredBeforeNextWeek = {
      ...warned,
      clubs: warned.clubs.map((club) =>
        club.id === warned.userClubId ? { ...club, cash: 100_000 } : club,
      ),
    };
    const rescued = settleScheduledWeek(recoveredBeforeNextWeek);

    expect(rescued.financialSafety).toMatchObject({
      emergencyLoanUsed: true,
      loan: {
        originalAmount: expect.any(Number),
      },
    });
    expect(rescued.ledgers.at(-1)?.lines).toContainEqual(
      expect.objectContaining({ kind: 'emergency-loan' }),
    );
  });

  test('skips an impossible facility offer and starts the player-sale warning after four red weeks', () => {
    const base = fullCareer(5061);
    const buildings: PlacedFacility[] = [
      placedFacility(1, 'training-pitch', 0, 0),
      placedFacility(2, 'coaching-office', 2, 0),
      placedFacility(3, 'stadium-stand', 3, 0),
      placedFacility(4, 'stadium-stand', 5, 0),
      placedFacility(5, 'stadium-stand', 0, 2),
      placedFacility(6, 'fan-shop', 2, 2),
      placedFacility(7, 'fan-shop', 3, 2),
      placedFacility(8, 'fan-shop', 4, 2),
    ];
    let state: GameState = {
      ...base,
      facilities: {
        ...base.facilities,
        trainingGroundBuilt: true,
        grid: {
          width: 8,
          height: 6,
          nextBuildingId: 9,
          buildings,
          discoveredAdjacencies: [],
        },
      },
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, cash: -20_000 } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
      },
    };

    for (let week = 1; week <= 3; week += 1) {
      state = settleScheduledWeek(state);
      expect(state.financialSafety?.boardUltimatum).toBeUndefined();
    }
    state = settleScheduledWeek(state);

    expect(state.financialSafety).toMatchObject({
      emergencyLoanUsed: true,
      facilityConversionUsed: true,
      latestBoardResolution: {
        kind: 'FACILITY_CONVERSION',
        addedFacilities: [],
        failureReason: 'COMMERCIAL_LIMITS_REACHED',
      },
      boardUltimatum: {
        consequence: 'FORCED_SALE',
        weeksRemaining: 4,
      },
    });
    expect(
      state.ledgers.slice(-4).flatMap((ledger) => ledger.lines),
    ).not.toContainEqual(expect.objectContaining({ kind: 'emergency-loan' }));
  });

  test('converts facilities once, then gives home matches four weeks before a forced sale', () => {
    let state = fullCareer(5051);
    // A club that has already spent its one emergency loan and is still under
    // water — which is exactly when the board escalates to an ultimatum, and is
    // reachable in real play by season three. This used to open at -500,000,
    // but DifficultyRules.cashFloor now tops any week back up to -15,000, and
    // from there a 20,000 loan clears the debt outright, so the old setup could
    // never reach an ultimatum at all.
    state = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: -20_000 } : club,
      ),
      financialSafety: { consecutiveNegativeWeeks: 0, emergencyLoanUsed: true },
    };
    for (let week = 0; week < 4; week += 1) {
      state = settleScheduledWeek(state);
      if (week < 3) {
        expect(state.financialSafety?.boardUltimatum).toBeUndefined();
      }
    }
    expect(
      state.ledgers
        .flatMap((ledger) => ledger.lines)
        .filter((line) => line.kind === 'emergency-loan'),
    ).toHaveLength(0);
    const facilityUltimatum = state.financialSafety?.boardUltimatum;

    expect(facilityUltimatum).toMatchObject({
      consequence: 'FACILITY_CONVERSION',
      weeksRemaining: 4,
      targetCash: 0,
      candidates: [],
    });
    for (let week = 0; week < 4; week += 1) state = settleScheduledWeek(state);
    expect(state.financialSafety).toMatchObject({
      facilityConversionUsed: true,
      latestBoardResolution: {
        kind: 'FACILITY_CONVERSION',
        addedFacilities: [{ type: 'stadium-stand' }],
      },
      boardUltimatum: {
        consequence: 'FORCED_SALE',
        weeksRemaining: 4,
        waitingForFacilityHomeGate: true,
        candidates: expect.any(Array),
      },
    });
    const ultimatum = state.financialSafety!.boardUltimatum!;
    expect(ultimatum.candidates).toHaveLength(4);
    const protectedId = ultimatum.candidates[0].playerId;
    state = protectBoardUltimatumPlayer(state, protectedId);
    for (let week = 0; week < 3; week += 1) state = settleScheduledWeek(state);
    expect(state.financialSafety?.boardUltimatum?.weeksRemaining).toBe(1);

    const candidateIds = ultimatum!.candidates.map(
      (candidate) => candidate.playerId,
    );
    state = settleScheduledWeek(state);
    const resolution = state.financialSafety?.latestBoardResolution;

    expect(resolution).toMatchObject({
      kind: 'FORCED_SALE',
      discountPercent: 30,
      moraleDelta: -8,
    });
    if (resolution?.kind !== 'FORCED_SALE')
      throw new Error('expected a board forced sale');
    expect(candidateIds).toContain(resolution.playerId);
    expect(resolution.playerId).not.toBe(protectedId);
    expect(
      state.players.find((player) => player.id === protectedId)?.clubId,
    ).toBe(state.userClubId);
    expect(
      state.players.find((player) => player.id === resolution.playerId)?.clubId,
    ).toBe(resolution.buyerClubId);
    // The player's NAME. This assertion used to pin `resolution.playerId`, which
    // is how "Board-enforced sale · bramble-rovers-p16" reached the finances
    // statement — in English as well as in translation. The test agreed with the
    // bug, so nothing failed.
    const soldName = state.players.find(
      (player) => player.id === resolution.playerId,
    )?.name;
    expect(soldName).toBeDefined();
    expect(state.ledgers.at(-1)?.lines).toContainEqual(
      expect.objectContaining({
        kind: 'board-sale',
        label: `Board-enforced sale · ${soldName}`,
        labelParams: { player: soldName },
        amount: resolution.fee,
      }),
    );
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
  });

  test('charges a drill its condition workload and recovers it on the weekly tick', () => {
    const state = fullCareer(504);
    const playerId = state.lineups.find(
      (lineup) => lineup.clubId === state.userClubId,
    )!.playerIds[0];
    const prepared = {
      ...state,
      trainingPoints: 100,
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, condition: 60 } : player,
      ),
    };
    const trained = trainPlayerInstantly(prepared, playerId, 'sprints').state;

    // The tap costs 8 condition, and the wellbeing tick returns 10 a week.
    expect(
      trained.players.find((player) => player.id === playerId)?.condition,
    ).toBe(52);
    expect(
      advanceWeek(trained).players.find((player) => player.id === playerId)
        ?.condition,
    ).toBe(62);
  });

  test('applies match result and playing-time morale through normal M2 settlement', () => {
    let state = fullCareer(505);
    while (state.week < 5) state = settleScheduledWeek(state);
    state = advanceWeek(state);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starterId = lineup.playerIds[0];
    const benchId = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !lineup.playerIds.includes(player.id),
    )!.id;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === starterId || player.id === benchId
          ? {
              ...player,
              condition: 80,
              morale: 50,
              consecutiveLowMoraleWeeks: 0,
            }
          : player,
      ),
    };
    const userFixture = fixturesForCurrentWeek(state).find(
      (fixture) =>
        fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId,
    )!;
    const results = fixturesForCurrentWeek(state).map((fixture) => {
      if (fixture.id !== userFixture.id) {
        return { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 };
      }
      return fixture.homeClubId === state.userClubId
        ? { fixtureId: fixture.id, homeGoals: 2, awayGoals: 0 }
        : { fixtureId: fixture.id, homeGoals: 0, awayGoals: 2 };
    });

    const settled = completeLeagueAndCupWeek(state, results);

    expect(
      settled.players.find((player) => player.id === starterId)?.morale,
    ).toBe(55);
    expect(
      settled.players.find((player) => player.id === benchId)?.morale,
    ).toBe(52);
    // One D5 start costs 4 before the normal 10-point weekly recovery.
    expect(
      settled.players.find((player) => player.id === starterId)?.condition,
    ).toBe(86);
    expect(
      settled.players.find((player) => player.id === benchId)?.condition,
    ).toBe(90);
  });

  test('benches a starter the moment an exhausted drill injures them', () => {
    let state = fullCareer(1);
    while (state.week < 4) state = settleScheduledWeek(state);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const targetId = lineup.playerIds[1];
    const prepared: GameState = {
      ...state,
      trainingPoints: 100,
      players: state.players.map((player) =>
        player.id === targetId ? { ...player, condition: 0 } : player,
      ),
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
    if (injured === undefined)
      throw new Error('expected a deterministic injury sample');

    // The tap itself repaired the lineup: the injured starter is out, the
    // replacement is fit, and the eleven still builds a valid match team.
    const repairedLineup = injured.lineups.find(
      (item) => item.clubId === injured!.userClubId,
    )!;
    expect(repairedLineup.playerIds).not.toContain(targetId);
    const replacementId = repairedLineup.playerIds[1];
    expect(
      injured.players.find((player) => player.id === replacementId)
        ?.injuryWeeks,
    ).toBe(0);
    expect(() =>
      buildCareerTeamDef(injured!, injured!.userClubId),
    ).not.toThrow();

    const matchday = advanceWeek(injured);
    expect(matchday.phase).toBe('matchday');
    expect(() =>
      buildCareerTeamDef(matchday, matchday.userClubId),
    ).not.toThrow();
  });

  test('itemizes Fan Shop income and applies the stadium adjacency bonus', () => {
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
    const club = initial.clubs.find(
      (candidate) => candidate.id === initial.userClubId,
    )!;
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

    expect(baseIncome).toBe(club.fans);
    expect(adjacencyIncome).toBe(baseIncome + Math.floor(baseIncome / 10));
    expect(advanceWeek(adjacentState).ledgers[0].lines).toContainEqual(
      expect.objectContaining({
        kind: 'merch',
        label: 'Fan Shop merchandise',
        amount: adjacencyIncome,
      }),
    );
  });

  test('holds the final sale week until a post-conversion home gate settles', () => {
    const base = fullCareer(5052);
    const saleUltimatum = createBoardUltimatum(base);
    if (saleUltimatum === undefined) {
      throw new Error('the home-gate test has too few board sale candidates');
    }
    let state: GameState = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, cash: -20_000 } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        facilityConversionUsed: true,
        boardUltimatum: {
          ...saleUltimatum,
          weeksRemaining: 1,
          targetCash: 1_000_000,
          waitingForFacilityHomeGate: true,
        },
      },
    };

    state = settleScheduledWeek(state);
    expect(state.financialSafety?.boardUltimatum).toMatchObject({
      weeksRemaining: 1,
      waitingForFacilityHomeGate: true,
    });

    const firstHomeWeek = state.fixtures
      .filter(
        (fixture) =>
          fixture.season === state.season &&
          fixture.homeClubId === state.userClubId,
      )
      .sort((left, right) => left.week - right.week)[0]?.week;
    if (firstHomeWeek === undefined) {
      throw new Error('the home-gate test career has no home fixture');
    }
    state = { ...state, week: firstHomeWeek, phase: 'manage' };
    state = settleScheduledWeek(state);

    expect(state.ledgers.at(-1)?.lines).toContainEqual(
      expect.objectContaining({
        kind: 'tickets',
        labelKey: 'ledger.leagueHomeGate',
      }),
    );
    expect(state.financialSafety?.latestBoardResolution?.kind).toBe(
      'FORCED_SALE',
    );
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
  });

  test('does not put a legacy sale-stage save back into the facility round', () => {
    const base = fullCareer(5053);
    const currentUltimatum = createBoardUltimatum(base);
    if (currentUltimatum === undefined) {
      throw new Error('the legacy test has too few board sale candidates');
    }
    const { consequence: _consequence, ...legacyUltimatum } = currentUltimatum;
    let state: GameState = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, cash: 1_000_000 } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 1,
        emergencyLoanUsed: true,
        boardUltimatum: legacyUltimatum,
      },
    };

    state = settleScheduledWeek(state);

    expect(state.financialSafety).toMatchObject({
      facilityConversionUsed: true,
      latestBoardResolution: { kind: 'TARGET_MET' },
    });
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
  });

  test('recognizes an already-resolved legacy sale deadline as post-facility', () => {
    const base = fullCareer(5054);
    let state: GameState = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, cash: -20_000 } : club,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 3,
        emergencyLoanUsed: true,
        latestBoardResolution: {
          id: 'board-ultimatum-legacy-target-met',
          kind: 'TARGET_MET',
          resolvedSeason: base.season,
          resolvedWeek: base.week,
          targetCash: 0,
        },
      },
    };

    state = settleScheduledWeek(state);

    expect(state.financialSafety).toMatchObject({
      facilityConversionUsed: true,
      boardUltimatum: { consequence: 'FORCED_SALE' },
    });
  });

  test('adds the full weekly income from three separately built Fan Shops', () => {
    let grid = createFacilityGrid();
    for (let index = 0; index < 3; index += 1) {
      grid = buildFacility(grid, 'fan-shop', { x: index, y: 0 }, 100_000).grid;
      grid = completeFacilityProject(grid);
    }
    const initial = fullCareer(508);
    const club = initial.clubs.find(
      (candidate) => candidate.id === initial.userClubId,
    )!;

    expect(
      weeklyMerchandiseIncome(
        {
          ...initial,
          facilities: { ...initial.facilities, grid },
        },
        club,
      ),
    ).toBe(Math.floor((club.fans * 3) / 2));
  });

  test.each([
    [500, 250, 275],
    [546, 273, 300],
  ])(
    'prices a Level-1 Fan Shop exactly at %i fans',
    (fans, baseExpected, adjacentExpected) => {
      let grid = buildFacility(
        createFacilityGrid(),
        'fan-shop',
        { x: 0, y: 0 },
        100_000,
      ).grid;
      grid = completeFacilityProject(grid);
      const fanShopOnly = grid;
      grid = buildFacility(grid, 'stadium-stand', { x: 1, y: 0 }, 100_000).grid;
      grid = completeFacilityProject(grid);
      const initial = fullCareer(507);
      const club = {
        ...initial.clubs.find(
          (candidate) => candidate.id === initial.userClubId,
        )!,
        fans,
      };

      expect(
        weeklyMerchandiseIncome(
          {
            ...initial,
            facilities: { ...initial.facilities, grid: fanShopOnly },
          },
          club,
        ),
      ).toBe(baseExpected);
      expect(
        weeklyMerchandiseIncome(
          {
            ...initial,
            facilities: { ...initial.facilities, grid },
          },
          club,
        ),
      ).toBe(adjacentExpected);
    },
  );
});

function completeFacilityProject(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined)
    next = advanceFacilityConstruction(next).grid;
  return next;
}
