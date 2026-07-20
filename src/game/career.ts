import { generateSeasonFixtures } from './schedule';
import {
  advanceFacilityConstruction,
  createFacilityGrid,
  facilityEffects,
  isFacilityOperational,
  weeklyFacilityUpkeep,
} from './facilities';
import { resolveCareerTrainingWeek } from './training';
import { enableFullCareer, startNextFullCareerSeason } from './full-career';
import { careerCoachWageLedgerAmount } from './coach-weekly';
import { resolveCareerScoutClock } from './market-career';
import { resolveNextM2NationalCupRound } from './m2-career';
import { resolveWeeklyPlayerWellbeing, type WeeklyMatchOutcome } from './player-wellbeing';
import type { NationalCupFixture, NationalCupResult } from './pyramid';
import { repairCareerLineupForInjuries } from './squad';
import { expireYouthIntakeWindow } from './youth-intake';
import {
  GAME_SCHEMA_VERSION,
  M1_SEASONS,
  SEASON_WEEKS,
  type CareerSetup,
  type CareerPlayer,
  type ClubState,
  type FixtureResult,
  type GameState,
  type LeagueFixture,
  type LeagueStanding,
  type LedgerLine,
} from './types';

const CLUB_COUNT = 10;
const UINT32_MAX = 4294967295;
const CUP_SETTLEMENT_WEEKS = [5, 10, 15, 20, 25, 30] as const;

type NationalCupRoundLabel =
  | 'Play-in'
  | 'Round of 32'
  | 'Round of 16'
  | 'Quarter-final'
  | 'Semi-final'
  | 'Final';

export interface ActiveCareerMatchday {
  kind: 'league' | 'national-cup';
  fixture: LeagueFixture;
  fixtures: LeagueFixture[];
  cupRoundLabel?: NationalCupRoundLabel;
}

export function createCareer(setup: CareerSetup): GameState {
  validateSetup(setup);

  const clubs = setup.clubs.map(club => ({ ...club }));

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    careerSeed: setup.seed,
    userClubId: setup.userClubId,
    season: 1,
    week: 1,
    phase: 'manage',
    clubs,
    fixtures: generateSeasonFixtures(clubs.map(club => club.id), 1, setup.seed),
    players: (setup.players ?? []).map(clonePlayer),
    lineups: (setup.lineups ?? []).map(lineup => ({
      clubId: lineup.clubId,
      playerIds: [...lineup.playerIds],
    })),
    facilities: { trainingGroundBuilt: false, grid: createFacilityGrid() },
    ...(setup.trainingRules === undefined ? {} : {
      trainingRules: {
        maxFocusDrillsPerWeek: setup.trainingRules.maxFocusDrillsPerWeek,
        baseConditioning: {
          ...setup.trainingRules.baseConditioning,
          gains: { ...setup.trainingRules.baseConditioning.gains },
        },
      },
    }),
    eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    eventFlags: [],
    resolvedEventIds: [],
    awakening: { matchesSinceLastAwakening: 0, usedTriggerIds: [] },
    trainingPoints: setup.startingTrainingPoints ?? 0,
    heroEssence: 0,
    ledgers: [],
    seasonGoalTallies: [],
    ...(setup.careerMode === undefined ? {} : { careerMode: setup.careerMode }),
  };
  return setup.careerMode === 'full' ? enableFullCareer(state) : state;
}

export function fixturesForCurrentWeek(state: GameState): LeagueFixture[] {
  return state.fixtures
    .filter(
      fixture =>
        fixture.season === state.season &&
        fixture.week === state.week &&
        fixture.status === 'scheduled',
    )
    .map(cloneFixture);
}

/** The one player-controlled match for the current Match Day, league first on double-header weeks. */
export function activeCareerMatchday(state: GameState): ActiveCareerMatchday | undefined {
  const leagueFixtures = fixturesForCurrentWeek(state);
  const leagueFixture = leagueFixtures.find(fixture => (
    fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId
  ));
  if (leagueFixture !== undefined) {
    return { kind: 'league', fixture: leagueFixture, fixtures: leagueFixtures };
  }

  const cup = nationalCupUserFixtureForCurrentWeek(state);
  if (cup === undefined) return undefined;
  const fixture = nationalCupFixtureAsLeagueFixture(cup.fixture, state.week);
  return {
    kind: 'national-cup',
    fixture,
    fixtures: [fixture],
    cupRoundLabel: cup.roundLabel,
  };
}

export function nationalCupFixtureById(
  state: GameState,
  fixtureId: string,
): NationalCupFixture | undefined {
  return state.m2?.nationalCups
    .flatMap(cup => cup.rounds)
    .flatMap(round => round.fixtures)
    .find(fixture => fixture.id === fixtureId);
}

export function advanceWeek(state: GameState): GameState {
  if (state.phase !== 'manage') {
    throw new Error('a week can only advance from the manage phase');
  }

  if (activeCareerMatchday(state) !== undefined) {
    return { ...state, phase: 'matchday' };
  }

  return settleCurrentWeek(state);
}

export function completeMatchday(state: GameState, results: FixtureResult[]): GameState {
  if (state.phase !== 'matchday') {
    throw new Error('matchday results can only be completed from the matchday phase');
  }

  const scheduledFixtures = fixturesForCurrentWeek(state);
  if (scheduledFixtures.length === 0) {
    return completeNationalCupMatchday(state, results);
  }
  validateResults(state, scheduledFixtures, results);

  const resultByFixtureId = new Map(results.map(result => [result.fixtureId, result]));
  const fixtures = state.fixtures.map(fixture => {
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) return fixture;

    return {
      ...fixture,
      status: 'played' as const,
      score: {
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      },
    };
  });

  const earnedTrainingPoints = trainingPointsForUser(
    state.userClubId,
    scheduledFixtures,
    resultByFixtureId,
  );
  const trainingPoints = checkedAdd(
    state.trainingPoints,
    earnedTrainingPoints,
    'training point balance',
  );

  const seasonGoalTallies = recordSeasonGoals(state, scheduledFixtures, resultByFixtureId);

  const players = state.careerMode === 'full'
    ? resolveCareerMatchFame(state, scheduledFixtures, resultByFixtureId)
    : state.players;

  const playedLeagueState: GameState = {
    ...state,
    fixtures,
    players,
    trainingPoints,
    seasonGoalTallies,
  };
  if (nationalCupUserFixtureForCurrentWeek(playedLeagueState) !== undefined) {
    return { ...playedLeagueState, phase: 'matchday' };
  }
  return settleCurrentWeek(playedLeagueState);
}

export function leagueStandings(state: GameState, season = state.season): LeagueStanding[] {
  if (!Number.isInteger(season) || season < 1) {
    throw new Error('season must be a positive integer');
  }

  const rows = new Map<string, Omit<LeagueStanding, 'position'>>(
    state.clubs.map(club => [
      club.id,
      {
        clubId: club.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );

  for (const fixture of state.fixtures) {
    if (fixture.season !== season || fixture.status !== 'played' || fixture.score === undefined) {
      continue;
    }

    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);
    if (home === undefined || away === undefined) {
      throw new Error(`fixture ${fixture.id} references an unknown club`);
    }

    home.played = checkedAdd(home.played, 1, `${home.clubId} matches played`);
    away.played = checkedAdd(away.played, 1, `${away.clubId} matches played`);
    home.goalsFor = checkedAdd(home.goalsFor, fixture.score.homeGoals, `${home.clubId} goals for`);
    home.goalsAgainst = checkedAdd(
      home.goalsAgainst,
      fixture.score.awayGoals,
      `${home.clubId} goals against`,
    );
    away.goalsFor = checkedAdd(away.goalsFor, fixture.score.awayGoals, `${away.clubId} goals for`);
    away.goalsAgainst = checkedAdd(
      away.goalsAgainst,
      fixture.score.homeGoals,
      `${away.clubId} goals against`,
    );

    if (fixture.score.homeGoals > fixture.score.awayGoals) {
      home.won = checkedAdd(home.won, 1, `${home.clubId} wins`);
      home.points = checkedAdd(home.points, 3, `${home.clubId} league points`);
      away.lost = checkedAdd(away.lost, 1, `${away.clubId} losses`);
    } else if (fixture.score.homeGoals < fixture.score.awayGoals) {
      away.won = checkedAdd(away.won, 1, `${away.clubId} wins`);
      away.points = checkedAdd(away.points, 3, `${away.clubId} league points`);
      home.lost = checkedAdd(home.lost, 1, `${home.clubId} losses`);
    } else {
      home.drawn = checkedAdd(home.drawn, 1, `${home.clubId} draws`);
      away.drawn = checkedAdd(away.drawn, 1, `${away.clubId} draws`);
      home.points = checkedAdd(home.points, 1, `${home.clubId} league points`);
      away.points = checkedAdd(away.points, 1, `${away.clubId} league points`);
    }
  }

  const sorted = Array.from(rows.values(), row => ({
    ...row,
    goalDifference: checkedSubtract(
      row.goalsFor,
      row.goalsAgainst,
      `${row.clubId} goal difference`,
    ),
  })).sort(compareStandings);

  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
}

export function startNextSeason(state: GameState): GameState {
  if (state.phase !== 'season-end') {
    throw new Error('the next season can only start from the season-end phase');
  }
  if (state.careerMode === 'full') {
    const expired = state.players.filter(player => (
      player.clubId === state.userClubId && player.contractSeasonsRemaining === 0
    ));
    if (expired.length > 0) {
      throw new Error(`${expired.length} expired contract${expired.length === 1 ? '' : 's'} must be resolved before the next season`);
    }
    return startNextFullCareerSeason(state, leagueStandings(state));
  }
  if (state.season >= M1_SEASONS) {
    throw new Error('the M1 career has no additional season');
  }

  const season = checkedAdd(state.season, 1, 'career season');
  const nextFixtures = generateSeasonFixtures(
    state.clubs.map(club => club.id),
    season,
    state.careerSeed,
  );

  return {
    ...state,
    season,
    week: 1,
    phase: 'manage',
    fixtures: [...state.fixtures, ...nextFixtures],
  };
}

function settleCurrentWeek(
  state: GameState,
  cupAlreadyResolved = false,
  additionalMatchOutcomes: readonly WeeklyMatchOutcome[] = [],
): GameState {
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) {
    throw new Error(`user club ${state.userClubId} does not exist`);
  }

  const training = resolveCareerTrainingWeek(state);
  const weeklyPlayers = state.careerMode === 'full'
      ? resolveWeeklyPlayerWellbeing(state, {
          trainedPlayers: training.players,
          focusApplied: training.focusApplied,
          additionalMatchOutcomes,
        }).players
    : training.players;
  const trainedState = {
    ...state,
    players: weeklyPlayers,
    trainingPoints: training.trainingPoints,
  };
  const lines = settlementLines(trainedState, userClub, training.moneyCost);
  let net = 0;
  for (const line of lines) {
    net = checkedAdd(net, line.amount, 'weekly ledger net');
  }
  const balanceAfter = checkedAdd(userClub.cash, net, 'club cash balance');
  const clubs = state.clubs.map(club =>
    club.id === state.userClubId ? { ...club, cash: balanceAfter } : club,
  );
  const ambientTrainingPoints = hasAmbientTrainingPitch(state) ? 5 : 0;
  const trainingPoints = checkedAdd(
    training.trainingPoints,
    ambientTrainingPoints,
    'facility training point balance',
  );
  const ledgers = [
    ...state.ledgers,
    {
      season: state.season,
      week: state.week,
      lines,
      balanceAfter,
    },
  ];

  const injuryWeeksBeforeSettlement = new Map(
    state.players.map(player => [player.id, player.injuryWeeks]),
  );
  const recoveredPlayers = weeklyPlayers.map(player => {
    const injuryWeeksBefore = injuryWeeksBeforeSettlement.get(player.id);
    if (injuryWeeksBefore === undefined) {
      throw new Error(`weekly wellbeing returned unknown player ${player.id}`);
    }
    // An existing injury advances by one recovery week. A new overtraining
    // injury begins now and must retain its full deterministic recovery time.
    const shouldRecover = state.careerMode === 'full'
      ? injuryWeeksBefore > 0
      : player.injuryWeeks > 0;
    return {
      ...player,
      injuryWeeks: shouldRecover ? Math.max(0, player.injuryWeeks - 1) : player.injuryWeeks,
    };
  });

  if (state.week === SEASON_WEEKS) {
    const seasonFamePlayers = state.careerMode === 'full'
      ? resolveCareerSeasonFame({ ...state, players: recoveredPlayers })
      : recoveredPlayers;
    const players = seasonFamePlayers.map(player => ({
      ...player,
      contractSeasonsRemaining: player.contractSeasonsRemaining > 0
        ? player.contractSeasonsRemaining - 1
        : 0,
    }));
    const settledState: GameState = {
      ...state,
      clubs,
      ledgers,
      players,
      trainingPoints,
      phase: state.careerMode === 'full'
        ? 'season-end'
        : state.season === M1_SEASONS ? 'complete' : 'season-end',
    };
    return advanceM2WeeklySidecars(
      state.careerMode === 'full'
        ? repairCareerLineupForInjuries(settledState)
        : settledState,
      state.week,
      cupAlreadyResolved,
    );
  }

  const settledState: GameState = {
    ...state,
    clubs,
    ledgers,
    players: recoveredPlayers,
    trainingPoints,
    week: checkedAdd(state.week, 1, 'career week'),
    phase: 'manage',
  };
  return advanceM2WeeklySidecars(
    state.careerMode === 'full'
      ? repairCareerLineupForInjuries(settledState)
      : settledState,
    state.week,
    cupAlreadyResolved,
  );
}

/**
 * Awards fame only from a player's real first-team appearance, the club result,
 * and goals recorded by the simulation. No RNG is consumed.
 */
export function resolveCareerMatchFame(
  state: GameState,
  fixtures: readonly LeagueFixture[],
  resultByFixtureId: ReadonlyMap<string, FixtureResult>,
): CareerPlayer[] {
  if (state.careerMode !== 'full') return state.players.map(clonePlayer);
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const gains = new Map<string, number>();

  for (const fixture of fixtures) {
    if (fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId) continue;
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) continue;
    const userIsHome = fixture.homeClubId === state.userClubId;
    const goalsFor = userIsHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = userIsHome ? result.awayGoals : result.homeGoals;
    const resultGain = goalsFor > goalsAgainst ? 2 : goalsFor === goalsAgainst ? 1 : 0;
    for (const playerId of lineup.playerIds) gains.set(playerId, 1 + resultGain);
    for (const scorerId of result.scorerPlayerIds ?? []) {
      const scorer = state.players.find(player => player.id === scorerId);
      if (scorer?.clubId !== state.userClubId) continue;
      gains.set(scorerId, (gains.get(scorerId) ?? 0) + 2);
    }
  }

  return state.players.map(player => {
    const gain = gains.get(player.id);
    if (gain === undefined) return clonePlayer(player);
    return { ...clonePlayer(player), fame: Math.min(99, (player.fame ?? 0) + gain) };
  });
}

/** Small club-wide recognition bonus for a real top-two league finish. */
export function resolveCareerSeasonFame(state: GameState): CareerPlayer[] {
  if (state.careerMode !== 'full') return state.players.map(clonePlayer);
  const finish = leagueStandings(state).find(row => row.clubId === state.userClubId)?.position;
  const leagueBonus = finish === 1 ? 5 : finish === 2 ? 3 : 0;
  const cupWon = state.m2?.nationalCups.some(cup => (
    cup.season === state.season && cup.championClubId === state.userClubId
  )) ?? false;
  const bonus = leagueBonus + (cupWon ? 5 : 0);
  if (bonus === 0) return state.players.map(clonePlayer);
  return state.players.map(player => player.clubId === state.userClubId
    ? { ...clonePlayer(player), fame: Math.min(99, (player.fame ?? 0) + bonus) }
    : clonePlayer(player));
}

function settlementLines(
  state: GameState,
  userClub: ClubState,
  trainingMoneyCost: number,
): LedgerLine[] {
  const lines: LedgerLine[] = [];
  const homeFixture = state.fixtures.find(
    fixture =>
      fixture.season === state.season &&
      fixture.week === state.week &&
      fixture.homeClubId === state.userClubId &&
      fixture.status === 'played',
  );

  if (homeFixture !== undefined) {
    const attendance = sixtyPercentOf(userClub.fans);
    lines.push({
      kind: 'tickets',
      label: 'Home match tickets',
      amount: checkedMultiply(attendance, userClub.ticketPrice, 'ticket revenue'),
    });
  }

  if (state.week % 4 === 0) {
    lines.push({
      kind: 'sponsor',
      label: 'Monthly sponsor fee',
      amount: requireSafeInteger(userClub.sponsorMonthlyFee, 'monthly sponsor fee'),
    });
  }

  if (state.week === SEASON_WEEKS) {
    const position = leagueStandings(state).find(row => row.clubId === state.userClubId)?.position;
    const prize = position === 1 ? 20000 : position === 2 ? 10000 : 0;
    if (prize > 0) {
      lines.push({
        kind: 'prize',
        label: position === 1 ? 'League champion prize' : 'League runner-up prize',
        amount: prize,
      });
    }
  }

  if (trainingMoneyCost > 0) {
    lines.push({
      kind: 'training',
      label: 'Weekly focus training',
      amount: checkedMultiply(trainingMoneyCost, -1, 'weekly training expense'),
    });
  }

  const merchandiseIncome = weeklyMerchandiseIncome(state, userClub);
  if (merchandiseIncome > 0) {
    lines.push({
      kind: 'merch',
      label: 'Fan Shop merchandise',
      amount: merchandiseIncome,
    });
  }

  const facilityUpkeep = state.careerMode !== 'full' || state.facilities.grid === undefined
    ? 0
    : weeklyFacilityUpkeep(state.facilities.grid);
  if (facilityUpkeep > 0) {
    lines.push({
      kind: 'facilities',
      label: 'Facility upkeep',
      amount: checkedMultiply(facilityUpkeep, -1, 'weekly facility expense'),
    });
  }

  lines.push({
    kind: 'wages',
    label: 'Weekly wages',
    amount: checkedMultiply(userClub.weeklyWages, -1, 'weekly wage expense'),
  });

  const coachWage = state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  if (coachWage !== 0) {
    lines.push({
      kind: 'wages',
      label: 'Head coach wage',
      amount: coachWage,
    });
  }

  if (state.season === 1) {
    lines.push({
      kind: 'subsidy',
      label: 'Season 1 wage subsidy',
      amount: requireSafeInteger(
        Math.floor(requireSafeInteger(userClub.weeklyWages, 'weekly wages') / 2),
        'wage subsidy',
      ),
    });
  }

  return lines;
}

/** A small recurring return for building a Fan Shop, with the documented adjacency bonus. */
export function weeklyMerchandiseIncome(state: GameState, userClub: ClubState): number {
  const grid = state.facilities.grid;
  if (state.careerMode !== 'full' || grid === undefined) return 0;
  let combinedFanShopLevel = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'fan-shop') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    combinedFanShopLevel = checkedAdd(
      combinedFanShopLevel,
      building.level,
      'combined Fan Shop level',
    );
  }
  if (combinedFanShopLevel === 0) return 0;

  // One merchandise unit per five fans per shop level keeps this a useful
  // trickle rather than a second gate-breaking sponsor payment.
  const fanLevelProduct = checkedMultiply(
    requireSafeInteger(userClub.fans, 'club fans'),
    combinedFanShopLevel,
    'Fan Shop merchandise base',
  );
  const baseIncome = Math.floor(fanLevelProduct / 5);
  const bonusPercent = facilityEffects(grid).merchIncomeBonusPercent;
  const bonus = Math.floor(checkedMultiply(
    baseIncome,
    bonusPercent,
    'Fan Shop merchandise adjacency bonus',
  ) / 100);
  return checkedAdd(baseIncome, bonus, 'Fan Shop merchandise income');
}

function advanceM2WeeklySidecars(
  state: GameState,
  settledWeek: number,
  cupAlreadyResolved = false,
): GameState {
  let next = state;
  const grid = next.facilities.grid;
  if (grid !== undefined) {
    const advanced = advanceFacilityConstruction(grid);
    if (advanced.grid !== grid) {
      next = {
        ...next,
        facilities: {
          ...next.facilities,
          grid: advanced.grid,
          trainingGroundBuilt: advanced.grid.buildings.some(building => (
            building.type === 'training-pitch'
            && isFacilityOperational(advanced.grid, building.id)
          )),
        },
      };
    }
  }
  if (
    next.m2 !== undefined
    && !cupAlreadyResolved
    && CUP_SETTLEMENT_WEEKS.includes(settledWeek as typeof CUP_SETTLEMENT_WEEKS[number])
  ) {
    const activeCup = next.m2.nationalCups.find(cup => cup.championClubId === undefined);
    if (activeCup !== undefined) {
      const round = activeCup.rounds[activeCup.rounds.length - 1];
      const progressedM2 = resolveNextM2NationalCupRound(next.m2);
      next = { ...next, m2: progressedM2 };
      const resolvedCup = progressedM2.nationalCups.find(cup => cup.season === activeCup.season)!;
      const resolvedRound = resolvedCup.rounds.find(candidate => candidate.number === round.number)!;
      const userWon = resolvedRound.fixtures.some(fixture => (
        (fixture.homeClubId === next.userClubId || fixture.awayClubId === next.userClubId)
        && fixture.winnerClubId === next.userClubId
      ));
      if (userWon) next = awardNationalCupPrize(next, resolvedRound.label);
    }
  }
  if (next.market !== undefined) {
    next = { ...next, market: resolveCareerScoutClock(next, next.market) };
  }
  return expireYouthIntakeWindow(next);
}

function completeNationalCupMatchday(state: GameState, results: FixtureResult[]): GameState {
  const cupMatchday = activeCareerMatchday(state);
  if (cupMatchday?.kind !== 'national-cup' || cupMatchday.cupRoundLabel === undefined) {
    throw new Error('the matchday has no scheduled league or National Cup fixture');
  }
  validateResults(state, cupMatchday.fixtures, results);
  const result = results[0];
  const cupFixture = nationalCupFixtureById(state, cupMatchday.fixture.id);
  if (cupFixture === undefined || state.m2 === undefined) {
    throw new Error(`unknown National Cup fixture ${cupMatchday.fixture.id}`);
  }
  const winnerClubId = result.homeGoals > result.awayGoals
    ? cupFixture.homeClubId
    : result.homeGoals < result.awayGoals
      ? cupFixture.awayClubId
      : deterministicPenaltyWinner(state, cupFixture);
  const cupResult: NationalCupResult = {
    fixtureId: result.fixtureId,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    winnerClubId,
  };
  const resultByFixtureId = new Map([[result.fixtureId, result]]);
  const trainingPoints = checkedAdd(
    state.trainingPoints,
    trainingPointsForUser(
      state.userClubId,
      cupMatchday.fixtures,
      resultByFixtureId,
    ),
    'National Cup training point balance',
  );
  const progressed: GameState = {
    ...state,
    m2: resolveNextM2NationalCupRound(state.m2, cupResult),
    players: resolveCareerMatchFame(state, cupMatchday.fixtures, resultByFixtureId),
    trainingPoints,
    seasonGoalTallies: recordSeasonGoals(state, cupMatchday.fixtures, resultByFixtureId),
  };
  const cupOutcome: WeeklyMatchOutcome = winnerClubId === state.userClubId ? 'win' : 'loss';
  const settled = settleCurrentWeek(progressed, true, [cupOutcome]);
  return winnerClubId === state.userClubId
    ? awardNationalCupPrize(settled, cupMatchday.cupRoundLabel)
    : settled;
}

function nationalCupUserFixtureForCurrentWeek(state: GameState): {
  fixture: NationalCupFixture;
  roundLabel: NationalCupRoundLabel;
} | undefined {
  if (state.careerMode !== 'full' || state.m2 === undefined) return undefined;
  const activeCup = state.m2.nationalCups.find(cup => cup.championClubId === undefined);
  if (activeCup === undefined || activeCup.season !== state.season) return undefined;
  const round = activeCup.rounds[activeCup.rounds.length - 1];
  if (round === undefined || CUP_SETTLEMENT_WEEKS[round.number - 1] !== state.week) return undefined;
  const fixture = round.fixtures.find(candidate => (
    candidate.status === 'scheduled'
    && (candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId)
  ));
  return fixture === undefined ? undefined : { fixture, roundLabel: round.label };
}

function nationalCupFixtureAsLeagueFixture(
  fixture: NationalCupFixture,
  week: number,
): LeagueFixture {
  return {
    id: fixture.id,
    season: fixture.season,
    round: fixture.round,
    week,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    matchSeed: fixture.matchSeed,
    status: fixture.status,
    ...(fixture.score === undefined ? {} : { score: { ...fixture.score } }),
  };
}

function deterministicPenaltyWinner(state: GameState, fixture: NationalCupFixture): string {
  const homeWins = (
    (fixture.matchSeed ^ state.careerSeed ^ Math.imul(fixture.round, 0x9e3779b1)) >>> 0
  ) % 2 === 0;
  return homeWins ? fixture.homeClubId : fixture.awayClubId;
}

function awardNationalCupPrize(
  state: GameState,
  roundLabel: 'Play-in' | 'Round of 32' | 'Round of 16' | 'Quarter-final' | 'Semi-final' | 'Final',
): GameState {
  const prizeByRound = {
    'Play-in': 2_000,
    'Round of 32': 3_000,
    'Round of 16': 4_000,
    'Quarter-final': 6_000,
    'Semi-final': 8_000,
    Final: 25_000,
  } as const;
  const prize = prizeByRound[roundLabel];
  const latestLedger = state.ledgers[state.ledgers.length - 1];
  if (latestLedger === undefined) throw new Error('National Cup prize requires a weekly ledger');
  const balanceAfter = checkedAdd(latestLedger.balanceAfter, prize, 'National Cup prize balance');
  return {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, cash: checkedAdd(club.cash, prize, 'National Cup prize cash') }
      : club),
    ledgers: state.ledgers.map((ledger, index) => index === state.ledgers.length - 1
      ? {
          ...ledger,
          lines: [...ledger.lines, {
            kind: 'prize' as const,
            label: roundLabel === 'Final'
              ? 'National Cup champions'
              : `National Cup ${roundLabel} win`,
            amount: prize,
          }],
          balanceAfter,
        }
      : ledger),
  };
}

function hasAmbientTrainingPitch(state: GameState): boolean {
  if (state.facilities.trainingGroundBuilt) return true;
  const grid = state.facilities.grid;
  return grid?.buildings.some(building => (
    building.type === 'training-pitch' && isFacilityOperational(grid, building.id)
  )) === true;
}

function trainingPointsForUser(
  userClubId: string,
  fixtures: LeagueFixture[],
  resultByFixtureId: Map<string, FixtureResult>,
): number {
  const fixture = fixtures.find(
    candidate => candidate.homeClubId === userClubId || candidate.awayClubId === userClubId,
  );
  if (fixture === undefined) return 0;

  const result = resultByFixtureId.get(fixture.id);
  if (result === undefined) {
    throw new Error(`missing result for user fixture ${fixture.id}`);
  }

  const isHome = fixture.homeClubId === userClubId;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  const resultPoints = goalsFor > goalsAgainst ? 30 : goalsFor === goalsAgainst ? 20 : 14;
  const goalBonus = checkedMultiply(goalsFor, 2, 'match training point goal bonus');
  return checkedAdd(resultPoints, goalBonus, 'match training points earned');
}

function validateSetup(setup: CareerSetup): void {
  if (!Number.isInteger(setup.seed) || setup.seed < 0 || setup.seed > UINT32_MAX) {
    throw new Error('career seed must be an integer from 0 to 4294967295');
  }
  if (setup.clubs.length !== CLUB_COUNT) {
    throw new Error(`a career requires exactly ${CLUB_COUNT} clubs`);
  }

  const ids = new Set<string>();
  for (const club of setup.clubs) {
    if (typeof club.id !== 'string' || club.id.trim().length === 0) {
      throw new Error('club IDs must be non-empty strings');
    }
    if (ids.has(club.id)) {
      throw new Error('club IDs must be unique');
    }
    ids.add(club.id);

    validateNonnegativeInteger(club.cash, `${club.id} cash`);
    validateNonnegativeInteger(club.fans, `${club.id} fans`);
    validateNonnegativeInteger(club.ticketPrice, `${club.id} ticket price`);
    validateNonnegativeInteger(club.sponsorMonthlyFee, `${club.id} sponsor fee`);
    validateNonnegativeInteger(club.weeklyWages, `${club.id} weekly wages`);
  }

  if (typeof setup.userClubId !== 'string' || !ids.has(setup.userClubId)) {
    throw new Error('userClubId must identify one of the career clubs');
  }

  validateNonnegativeInteger(setup.startingTrainingPoints ?? 0, 'starting training points');
  if (setup.trainingRules !== undefined) {
    validateNonnegativeInteger(
      setup.trainingRules.maxFocusDrillsPerWeek,
      'maximum weekly focus drills',
    );
    if (setup.trainingRules.maxFocusDrillsPerWeek < 1) {
      throw new Error('maximum weekly focus drills must be positive');
    }
  }
  validatePlayerSetup(setup, ids);
}

function validatePlayerSetup(setup: CareerSetup, clubIds: ReadonlySet<string>): void {
  const players = setup.players ?? [];
  const lineups = setup.lineups ?? [];
  if ((players.length === 0) !== (lineups.length === 0)) {
    throw new Error('career players and lineups must be supplied together');
  }
  if (players.length === 0) return;

  const playerIds = new Set<string>();
  const playersByClub = new Map<string, Set<string>>(
    Array.from(clubIds, clubId => [clubId, new Set<string>()]),
  );
  for (const player of players) {
    if (typeof player.id !== 'string' || player.id.trim().length === 0 || playerIds.has(player.id)) {
      throw new Error('player IDs must be non-empty and unique');
    }
    const clubPlayers = playersByClub.get(player.clubId);
    if (clubPlayers === undefined) {
      throw new Error(`player ${player.id} references unknown club ${player.clubId}`);
    }
    playerIds.add(player.id);
    clubPlayers.add(player.id);
    validateNonnegativeInteger(player.weeklyWage, `${player.id} weekly wage`);
    validateNonnegativeInteger(
      player.contractSeasonsRemaining,
      `${player.id} contract seasons remaining`,
    );
    validateNonnegativeInteger(player.injuryWeeks, `${player.id} injury weeks`);
    validateNonnegativeInteger(player.morale, `${player.id} morale`);
    if (player.morale > 100) throw new Error(`${player.id} morale must be at most 100`);
  }

  if (lineups.length !== clubIds.size) {
    throw new Error('a full career setup requires one lineup per club');
  }
  const lineupClubIds = new Set<string>();
  for (const lineup of lineups) {
    if (!clubIds.has(lineup.clubId) || lineupClubIds.has(lineup.clubId)) {
      throw new Error('lineup club IDs must be known and unique');
    }
    lineupClubIds.add(lineup.clubId);
    if (lineup.playerIds.length !== 11 || new Set(lineup.playerIds).size !== 11) {
      throw new Error(`lineup ${lineup.clubId} must contain 11 unique players`);
    }
    const clubPlayers = playersByClub.get(lineup.clubId);
    if (lineup.playerIds.some(playerId => !clubPlayers?.has(playerId))) {
      throw new Error(`lineup ${lineup.clubId} must contain only its own players`);
    }
  }
}

function validateResults(
  state: GameState,
  fixtures: LeagueFixture[],
  results: FixtureResult[],
): void {
  if (results.length !== fixtures.length) {
    throw new Error(`matchday requires exactly ${fixtures.length} fixture results`);
  }

  const expectedIds = new Set(fixtures.map(fixture => fixture.id));
  const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  const playerClubById = new Map(state.players.map(player => [player.id, player.clubId]));
  for (const player of state.m2?.pyramid.divisions.flatMap(division => (
    division.clubs.flatMap(club => club.squad)
  )) ?? []) {
    if (!playerClubById.has(player.id)) playerClubById.set(player.id, player.clubId);
  }
  const receivedIds = new Set<string>();

  for (const result of results) {
    if (!expectedIds.has(result.fixtureId)) {
      throw new Error(`result ${result.fixtureId} is not scheduled for the current week`);
    }
    if (receivedIds.has(result.fixtureId)) {
      throw new Error(`fixture ${result.fixtureId} has more than one result`);
    }
    receivedIds.add(result.fixtureId);
    validateNonnegativeInteger(result.homeGoals, `${result.fixtureId} home goals`);
    validateNonnegativeInteger(result.awayGoals, `${result.fixtureId} away goals`);
    if (result.scorerPlayerIds === undefined) continue;

    if (result.scorerPlayerIds.length !== result.homeGoals + result.awayGoals) {
      throw new Error(`result ${result.fixtureId} scorer count must match the score`);
    }
    // The original headless M1 harness supports club-only careers with no
    // persistent player roster. Their sim teams still have player IDs, but
    // there is intentionally no career ledger to attach those scorers to.
    if (playerClubById.size === 0) continue;
    const fixture = fixtureById.get(result.fixtureId)!;
    let homeScorers = 0;
    let awayScorers = 0;
    for (const playerId of result.scorerPlayerIds) {
      const clubId = playerClubById.get(playerId);
      if (clubId === fixture.homeClubId) homeScorers += 1;
      else if (clubId === fixture.awayClubId) awayScorers += 1;
      else throw new Error(`result ${result.fixtureId} has an unknown scorer ${playerId}`);
    }
    if (homeScorers !== result.homeGoals || awayScorers !== result.awayGoals) {
      throw new Error(`result ${result.fixtureId} scorers must match each club's goals`);
    }
  }
}

function recordSeasonGoals(
  state: GameState,
  fixtures: LeagueFixture[],
  resultByFixtureId: ReadonlyMap<string, FixtureResult>,
): GameState['seasonGoalTallies'] {
  const knownPlayerIds = new Set(state.players.map(player => player.id));
  const totals = new Map(
    (state.seasonGoalTallies ?? []).map(tally => [
      `${tally.season}:${tally.playerId}`,
      { ...tally },
    ]),
  );

  for (const fixture of fixtures) {
    const result = resultByFixtureId.get(fixture.id);
    for (const playerId of result?.scorerPlayerIds ?? []) {
      if (!knownPlayerIds.has(playerId)) continue;
      const key = `${state.season}:${playerId}`;
      const previous = totals.get(key);
      totals.set(key, {
        season: state.season,
        playerId,
        goals: checkedAdd(previous?.goals ?? 0, 1, `${playerId} season goals`),
      });
    }
  }

  return [...totals.values()];
}

function validateNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
}

function sixtyPercentOf(value: number): number {
  const fans = requireSafeInteger(value, 'ticket attendance fan count');
  if (fans < 0) {
    throw new Error('ticket attendance fan count must be nonnegative');
  }

  const groupsOfFive = Math.floor(fans / 5);
  const remainder = fans % 5;
  const wholeGroupAttendance = checkedMultiply(groupsOfFive, 3, 'ticket attendance');
  const remainderAttendance = Math.floor((remainder * 3) / 5);
  return checkedAdd(wholeGroupAttendance, remainderAttendance, 'ticket attendance');
}

function compareStandings(
  left: Omit<LeagueStanding, 'position'>,
  right: Omit<LeagueStanding, 'position'>,
): number {
  if (left.points !== right.points) return left.points > right.points ? -1 : 1;
  if (left.goalDifference !== right.goalDifference) {
    return left.goalDifference > right.goalDifference ? -1 : 1;
  }
  if (left.goalsFor !== right.goalsFor) return left.goalsFor > right.goalsFor ? -1 : 1;
  if (left.clubId < right.clubId) return -1;
  if (left.clubId > right.clubId) return 1;
  return 0;
}

function cloneFixture(fixture: LeagueFixture): LeagueFixture {
  return fixture.score === undefined
    ? { ...fixture }
    : { ...fixture, score: { ...fixture.score } };
}

function clonePlayer(player: CareerPlayer): CareerPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function checkedAdd(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left - right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return value;
}
