import { generateSeasonFixtures } from './schedule';
import { resolveCareerTrainingWeek } from './training';
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

export function createCareer(setup: CareerSetup): GameState {
  validateSetup(setup);

  const clubs = setup.clubs.map(club => ({ ...club }));

  return {
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
    facilities: { trainingGroundBuilt: false },
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
  };
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

export function advanceWeek(state: GameState): GameState {
  if (state.phase !== 'manage') {
    throw new Error('a week can only advance from the manage phase');
  }

  if (fixturesForCurrentWeek(state).length > 0) {
    return { ...state, phase: 'matchday' };
  }

  return settleCurrentWeek(state);
}

export function completeMatchday(state: GameState, results: FixtureResult[]): GameState {
  if (state.phase !== 'matchday') {
    throw new Error('matchday results can only be completed from the matchday phase');
  }

  const scheduledFixtures = fixturesForCurrentWeek(state);
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

  return settleCurrentWeek({ ...state, fixtures, trainingPoints, seasonGoalTallies });
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

function settleCurrentWeek(state: GameState): GameState {
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) {
    throw new Error(`user club ${state.userClubId} does not exist`);
  }

  const training = resolveCareerTrainingWeek(state);
  const trainedState = {
    ...state,
    players: training.players,
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
  const ambientTrainingPoints = state.facilities.trainingGroundBuilt ? 5 : 0;
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

  const recoveredPlayers = training.players.map(player => ({
    ...player,
    injuryWeeks: player.injuryWeeks > 0 ? player.injuryWeeks - 1 : 0,
  }));

  if (state.week === SEASON_WEEKS) {
    const players = recoveredPlayers.map(player => ({
      ...player,
      contractSeasonsRemaining: player.contractSeasonsRemaining > 0
        ? player.contractSeasonsRemaining - 1
        : 0,
    }));
    return {
      ...state,
      clubs,
      ledgers,
      players,
      trainingPoints,
      phase: state.season === M1_SEASONS ? 'complete' : 'season-end',
    };
  }

  return {
    ...state,
    clubs,
    ledgers,
    players: recoveredPlayers,
    trainingPoints,
    week: checkedAdd(state.week, 1, 'career week'),
    phase: 'manage',
  };
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

  lines.push({
    kind: 'wages',
    label: 'Weekly wages',
    amount: checkedMultiply(userClub.weeklyWages, -1, 'weekly wage expense'),
  });

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
