import { generateSeasonFixtures } from './schedule';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
  advanceFacilityConstruction,
  createFacilityGrid,
  facilityEffects,
  isFacilityOperational,
  weeklyFacilityUpkeep,
  type FacilityGridState,
} from './facilities';
import { difficultyRules } from './difficulty';
import { recordCareerMilestones } from './career-events';
import { recordSeasonRecap } from './season-recap';
import { enableFullCareer, startNextFullCareerSeason } from './full-career';
import {
  careerCoachWageLedgerAmount,
  careerCoachWeeklyTrainingPoints,
} from './coach-weekly';
import { resolveCareerScoutClock } from './market-career';
import {
  currentUserDivision,
  resolveNextM2NationalCupRound,
  willRetireAtSeasonTransition,
} from './m2-career';
import {
  FIRST_D4_PROMOTION_RECRUITMENT_FUND,
  highestDivisionReached,
  leaguePrizeMoney,
} from './promotion-progression';
import { resolveWeeklyPlayerWellbeing, type WeeklyMatchOutcome } from './player-wellbeing';
import type { NationalCupFixture, NationalCupResult } from './pyramid';
import {
  cupGiantKillingCelebration,
  queueCupGiantKillingCelebration,
} from './cup-giant-killing';
import { repairCareerLineupForInjuries } from './squad';
import { initializeSeasonYouthIntake, reconcileStoryYouthIntake } from './youth-intake';
import {
  applyBoardForcedSaleConsequences,
  boardForcedSaleAtDeadline,
  clearMetBoardUltimatum,
  createBoardUltimatum,
  targetMetResolution,
  type BoardForcedSaleResolution,
} from './board-ultimatum';
import {
  GAME_SCHEMA_VERSION,
  SEASON_WEEKS,
  type CareerSetup,
  type CareerPlayer,
  type ClubState,
  type FixtureResult,
  type GameState,
  type LeagueFixture,
  type LeagueStanding,
  type LedgerLine,
  type FinancialSafetyState,
} from './types';

const CLUB_COUNT = 10;
const UINT32_MAX = 4294967295;
/**
 * The week each National Cup round settles, chosen to land on weeks the league
 * calendar leaves empty so a cup tie is its own event instead of a second match
 * bolted onto a league week. `leagueWeekForRound` fills weeks 3–28 in season 1
 * and 5–28 from season 2 on, which leaves these empty weeks:
 *
 *   season 1:  1 2   6   9   12    15    18    21    24 27 29 30
 *   season 2+: 1 2 3 4 8       12       16       20  24 27 29 30
 *
 * Only 12, 24, 27, 29 and 30 are free in every season, so no six-week set can
 * be empty in all of them. This set is empty for the whole of season 1 and
 * doubles up only twice (weeks 6 and 18) from season 2 on — the fewest possible
 * without opening in weeks 1–2, before the league has even kicked off, or
 * settling the final in week 30 alongside the season-end transition.
 */
export const CUP_SETTLEMENT_WEEKS = [6, 12, 18, 24, 27, 29] as const;

export type NationalCupRoundLabel =
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
    ...(setup.launchRosterVersion === undefined
      ? {}
      : { launchRosterVersion: setup.launchRosterVersion }),
    careerSeed: setup.seed,
    userClubId: setup.userClubId,
    season: 1,
    week: 1,
    phase: 'manage',
    ...(setup.difficulty === undefined ? {} : { difficulty: setup.difficulty }),
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
        focusDrills: setup.trainingRules.focusDrills.map(drill => ({
          ...drill,
          gains: { ...drill.gains },
        })),
      },
    }),
    eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    eventFlags: [],
    resolvedEventIds: [],
    awakening: { matchesSinceLastAwakening: 0, usedTriggerIds: [] },
    trainingPoints: setup.startingTrainingPoints ?? 0,
    ledgers: [],
    seasonOpeningCash: clubs.find(club => club.id === setup.userClubId)!.cash,
    seasonGoalTallies: [],
    careerMode: 'full',
  };
  return enableFullCareer(state);
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

  const seasonGoalTallies = recordSeasonGoals(state, scheduledFixtures, resultByFixtureId);

  const players = resolveCareerMatchFame(state, scheduledFixtures, resultByFixtureId);

  const playedLeagueState: GameState = {
    ...state,
    fixtures,
    players,
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
  const expired = state.players.filter(player => (
    player.clubId === state.userClubId
    && player.contractSeasonsRemaining === 0
    && !willRetireAtSeasonTransition(player, state.season)
  ));
  if (expired.length > 0) {
    throw new Error(`${expired.length} expired contract${expired.length === 1 ? '' : 's'} must be resolved before the next season`);
  }
  return startNextFullCareerSeason(state, leagueStandings(state));
}

/**
 * Settles the week and banks any milestone that week just earned. The
 * recognition story still waits for the next story beat, but the flag itself is
 * recorded the moment the club earns it instead of sitting unnoticed for weeks.
 * `recordCareerMilestones` derives its flags from persisted results, consumes no
 * random value and skips flags already present, so a settled week records each
 * milestone exactly once.
 */
function settleCurrentWeek(
  state: GameState,
  cupAlreadyResolved = false,
  additionalMatchOutcomes: readonly WeeklyMatchOutcome[] = [],
): GameState {
  return recordCareerMilestones(
    settleWeekResults(state, cupAlreadyResolved, additionalMatchOutcomes),
  );
}

function settleWeekResults(
  state: GameState,
  cupAlreadyResolved: boolean,
  additionalMatchOutcomes: readonly WeeklyMatchOutcome[],
): GameState {
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) {
    throw new Error(`user club ${state.userClubId} does not exist`);
  }

  // Drills resolve instantly at tap time now, so settlement only credits the
  // week's ambient TP income and runs the recovery/morale wellbeing tick.
  const ambientTrainingPoints = weeklyAmbientTrainingPoints(state);
  const trainingPoints = checkedAdd(
    state.trainingPoints,
    ambientTrainingPoints,
    'weekly ambient training point balance',
  );
  const weeklyPlayers = resolveWeeklyPlayerWellbeing(state, { additionalMatchOutcomes }).players;
  const trainedState = {
    ...state,
    players: weeklyPlayers,
    trainingPoints,
  };
  const lines = settlementLines(trainedState, userClub, 0);
  const safety = resolveFinancialSafety(trainedState, userClub.cash, lines);
  const settledLines = safety.lines;
  const balanceAfter = safety.balanceAfter;
  const intervenedState = safety.forcedSale === undefined
    ? trainedState
    : applyBoardForcedSaleConsequences(trainedState, safety.forcedSale);
  const clubs = intervenedState.clubs.map(club =>
    club.id === state.userClubId ? { ...club, cash: balanceAfter } : club,
  );
  const ledgers = [
    ...state.ledgers,
    {
      season: state.season,
      week: state.week,
      lines: settledLines,
      balanceAfter,
    },
  ];

  const injuryWeeksBeforeSettlement = new Map(
    state.players.map(player => [player.id, player.injuryWeeks]),
  );
  const recoveredPlayers = intervenedState.players.map(player => {
    const injuryWeeksBefore = injuryWeeksBeforeSettlement.get(player.id);
    if (injuryWeeksBefore === undefined) {
      if (safety.forcedSale?.replacementPlayerId === player.id) return player;
      throw new Error(`weekly wellbeing returned unknown player ${player.id}`);
    }
    // An existing injury advances by one recovery week. A new overtraining
    // injury begins now and must retain its full deterministic recovery time.
    const shouldRecover = injuryWeeksBefore > 0;
    return {
      ...player,
      injuryWeeks: shouldRecover ? Math.max(0, player.injuryWeeks - 1) : player.injuryWeeks,
    };
  });

  if (state.week === SEASON_WEEKS) {
    const seasonFamePlayers = resolveCareerSeasonFame({ ...state, players: recoveredPlayers });
    const players = seasonFamePlayers.map(player => ({
      ...player,
      contractSeasonsRemaining: player.contractSeasonsRemaining > 0
        ? player.contractSeasonsRemaining - 1
        : 0,
    }));
    const settledState: GameState = {
      ...intervenedState,
      clubs,
      ledgers,
      players,
      trainingPoints,
      financialSafety: safety.financialSafety,
      phase: 'season-end',
    };
    const withRecap = recordSeasonRecap(settledState);
    return advanceM2WeeklySidecars(
      repairCareerLineupForInjuries(withRecap),
      state.week,
      cupAlreadyResolved,
    );
  }

  const settledState: GameState = {
    ...intervenedState,
    clubs,
    ledgers,
    players: recoveredPlayers,
    trainingPoints,
    financialSafety: safety.financialSafety,
    week: checkedAdd(state.week, 1, 'career week'),
    phase: 'manage',
  };
  return advanceM2WeeklySidecars(
    repairCareerLineupForInjuries(settledState),
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
    lines.push({
      kind: 'tickets',
      label: 'League home gate',
      amount: homeGateIncome(state, userClub, 'ticket revenue'),
    });
  }

  const currentCup = state.m2?.nationalCups.find(cup => cup.season === state.season);
  const currentCupRound = currentCup?.rounds.find(round => (
    CUP_SETTLEMENT_WEEKS[round.number - 1] === state.week
  ));
  const homeCupFixture = currentCupRound?.fixtures.find(fixture => (
    fixture.homeClubId === state.userClubId && fixture.status === 'played'
  ));
  if (currentCupRound !== undefined && homeCupFixture !== undefined) {
    lines.push({
      kind: 'tickets',
      label: `Global Cup ${currentCupRound.label} home gate`,
      amount: homeGateIncome(state, userClub, 'Global Cup ticket revenue'),
    });
  }

  if (state.week % 4 === 0) {
    const sponsorIncome = Math.floor(
      requireSafeInteger(userClub.sponsorMonthlyFee, 'monthly sponsor fee')
      * difficultyRules(state).sponsorIncomePercent
      / 100,
    );
    lines.push({
      kind: 'sponsor',
      label: state.difficulty === 'CHAIRMAN' ? 'Chairman sponsor target' : 'Monthly sponsor fee',
      amount: sponsorIncome,
    });
  }

  if (state.week === SEASON_WEEKS) {
    const position = leagueStandings(state).find(row => row.clubId === state.userClubId)?.position;
    const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
    const prize = position === undefined ? 0 : leaguePrizeMoney(division, position);
    if (prize > 0) {
      lines.push({
        kind: 'prize',
        label: position === 1 ? 'League champion prize' : 'League runner-up prize',
        amount: prize,
      });
    }
    const firstD4Promotion = state.m2 !== undefined
      && position !== undefined
      && position <= 2
      && currentUserDivision(state.m2) === 5
      && highestDivisionReached(state) === 5;
    if (firstD4Promotion) {
      lines.push({
        kind: 'subsidy',
        label: 'County League recruitment fund',
        amount: FIRST_D4_PROMOTION_RECRUITMENT_FUND,
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

  const facilityUpkeep = state.facilities.grid === undefined
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
      label: 'Coaching staff wages',
      amount: coachWage,
    });
  }

  const subsidyPercent = difficultyRules(state).seasonOneWageSubsidyPercent;
  if (state.season === 1 && subsidyPercent > 0) {
    const totalWageBill = checkedAdd(
      userClub.weeklyWages,
      Math.abs(coachWage),
      'subsidized wage bill',
    );
    lines.push({
      kind: 'subsidy',
      label: 'Season 1 wage subsidy',
      amount: requireSafeInteger(
        Math.floor(requireSafeInteger(totalWageBill, 'weekly wages') * subsidyPercent / 100),
        'wage subsidy',
      ),
    });
  }

  return lines;
}

/**
 * Extra seats and matchday spend from each Stadium Stand level. It multiplies
 * the ordinary gate, so it rides the division scaling in `divisionFans` and
 * `divisionTicketPrice` instead of bypassing it: the same stand is worth far
 * more in D1 than in D5, which is what makes it the club's climb investment.
 */
export const STADIUM_STAND_GATE_BONUS_PERCENT_PER_LEVEL = 25;

/** The best operational stand wins; a second stand is not a second bonus. */
export function gridStadiumStandLevel(grid: FacilityGridState | undefined): number {
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'stadium-stand') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

function homeGateIncome(state: GameState, userClub: ClubState, label: string): number {
  const attendance = sixtyPercentOf(userClub.fans);
  const base = checkedMultiply(attendance, userClub.ticketPrice, label);
  const standLevel = gridStadiumStandLevel(state.facilities.grid);
  if (standLevel === 0) return base;
  const bonus = Math.floor(checkedMultiply(
    base,
    standLevel * STADIUM_STAND_GATE_BONUS_PERCENT_PER_LEVEL,
    'Stadium Stand gate bonus',
  ) / 100);
  return checkedAdd(base, bonus, 'home gate income');
}

/** A small recurring return for building a Fan Shop, with the documented adjacency bonus. */
export function weeklyMerchandiseIncome(state: GameState, userClub: ClubState): number {
  const grid = state.facilities.grid;
  if (grid === undefined) return 0;
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
  return reconcileStoryYouthIntake(next);
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
  const progressed: GameState = queueCupGiantKillingCelebration({
    ...state,
    m2: resolveNextM2NationalCupRound(state.m2, cupResult),
    players: resolveCareerMatchFame(state, cupMatchday.fixtures, resultByFixtureId),
    seasonGoalTallies: recordSeasonGoals(state, cupMatchday.fixtures, resultByFixtureId),
  }, cupGiantKillingCelebration(state, cupFixture, winnerClubId));
  const cupOutcome: WeeklyMatchOutcome = winnerClubId === state.userClubId ? 'win' : 'loss';
  const settled = settleCurrentWeek(progressed, true, [cupOutcome]);
  return winnerClubId === state.userClubId
    ? awardNationalCupPrize(settled, cupMatchday.cupRoundLabel)
    : settled;
}

function resolveFinancialSafety(
  state: GameState,
  startingCash: number,
  baseLines: readonly LedgerLine[],
): {
  lines: LedgerLine[];
  balanceAfter: number;
  financialSafety?: FinancialSafetyState;
  forcedSale?: BoardForcedSaleResolution;
} {
  const previous = state.financialSafety ?? {
    consecutiveNegativeWeeks: 0,
    emergencyLoanUsed: false,
  };
  const lines = [...baseLines];
  let loan = previous.loan === undefined ? undefined : { ...previous.loan };
  if (loan !== undefined
    && loan.remainingBalance > 0
    && loan.remainingWeeks > 0
    && state.season >= loan.repaymentStartsSeason) {
    const repayment = Math.ceil(loan.remainingBalance / loan.remainingWeeks);
    lines.push({
      kind: 'loan-repayment',
      label: 'Emergency loan repayment',
      amount: -repayment,
    });
    loan = {
      ...loan,
      remainingBalance: loan.remainingBalance - repayment,
      remainingWeeks: loan.remainingWeeks - 1,
    };
  }

  const net = lines.reduce(
    (total, line) => checkedAdd(total, line.amount, 'weekly ledger net'),
    0,
  );
  let balanceAfter = checkedAdd(startingCash, net, 'club cash balance');
  let consecutiveNegativeWeeks = balanceAfter < 0
    ? checkedAdd(previous.consecutiveNegativeWeeks, 1, 'negative cash week count')
    : 0;
  let emergencyLoanUsed = previous.emergencyLoanUsed;
  const rules = difficultyRules(state);
  if (balanceAfter < 0 && consecutiveNegativeWeeks >= rules.negativeWeeksBeforeIntervention && !emergencyLoanUsed) {
    lines.push({
      kind: 'emergency-loan',
      label: 'Board emergency loan',
      amount: rules.emergencyLoanAmount,
    });
    balanceAfter = checkedAdd(balanceAfter, rules.emergencyLoanAmount, 'emergency loan balance');
    emergencyLoanUsed = true;
    consecutiveNegativeWeeks = balanceAfter < 0 ? consecutiveNegativeWeeks : 0;
    loan = {
      originalAmount: rules.emergencyLoanAmount,
      remainingBalance: Math.ceil(rules.emergencyLoanAmount * 1.1),
      repaymentStartsSeason: checkedAdd(state.season, 1, 'loan repayment season'),
      remainingWeeks: 30,
    };
  }

  let boardUltimatum = previous.boardUltimatum === undefined
    ? undefined
    : {
        ...previous.boardUltimatum,
        candidates: previous.boardUltimatum.candidates.map(candidate => ({ ...candidate })),
      };
  let latestBoardResolution = previous.latestBoardResolution === undefined
    ? undefined
    : { ...previous.latestBoardResolution };
  let forcedSale: BoardForcedSaleResolution | undefined;
  if (boardUltimatum !== undefined) {
    if (balanceAfter >= boardUltimatum.targetCash) {
      latestBoardResolution = targetMetResolution(state, boardUltimatum);
      boardUltimatum = undefined;
    } else if (boardUltimatum.weeksRemaining > 1) {
      boardUltimatum = {
        ...boardUltimatum,
        weeksRemaining: boardUltimatum.weeksRemaining - 1,
      };
    } else {
      forcedSale = boardForcedSaleAtDeadline(state, boardUltimatum);
      if (forcedSale === undefined) {
        const refreshed = createBoardUltimatum(state);
        boardUltimatum = refreshed === undefined
          ? { ...boardUltimatum, weeksRemaining: 1 }
          : { ...refreshed, id: `${boardUltimatum.id}-refresh-s${state.season}-w${state.week}` };
      } else {
        lines.push({
          kind: 'board-sale',
          label: `Board-enforced sale · ${forcedSale.playerId}`,
          amount: forcedSale.fee,
        });
        balanceAfter = checkedAdd(balanceAfter, forcedSale.fee, 'board forced-sale balance');
        consecutiveNegativeWeeks = 0;
        latestBoardResolution = forcedSale;
        boardUltimatum = undefined;
      }
    }
  } else if (balanceAfter < 0 && consecutiveNegativeWeeks >= rules.negativeWeeksBeforeIntervention && emergencyLoanUsed) {
    boardUltimatum = createBoardUltimatum(state);
  }

  // The floor is the last line and it never runs out. Everything above it —
  // warnings, the one emergency loan, board-enforced sales — is finite, so a
  // club that stalled used them all up and then fell forever. Topping back up
  // to the floor keeps the debt bounded and keeps a rescue visible in the
  // ledger every week it happens, which is the difference between "fail-soft"
  // and "no consequence and no way back".
  if (balanceAfter < rules.cashFloor) {
    const rescue = checkedAdd(rules.cashFloor, -balanceAfter, 'board rescue amount');
    lines.push({
      kind: 'board-rescue',
      label: 'Board rescue package',
      amount: rescue,
    });
    balanceAfter = rules.cashFloor;
  }

  return {
    lines,
    balanceAfter,
    financialSafety: {
      consecutiveNegativeWeeks,
      emergencyLoanUsed,
      ...(loan === undefined ? {} : { loan }),
      ...(boardUltimatum === undefined ? {} : { boardUltimatum }),
      ...(latestBoardResolution === undefined ? {} : { latestBoardResolution }),
    },
    ...(forcedSale === undefined ? {} : { forcedSale }),
  };
}

function nationalCupUserFixtureForCurrentWeek(state: GameState): {
  fixture: NationalCupFixture;
  roundLabel: NationalCupRoundLabel;
} | undefined {
  if (state.m2 === undefined) return undefined;
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
  /**
   * A cup run is when a small club picks up neutrals, and it is the only way to
   * grow the gate without going up a division. A full run is ~900 fans, kept
   * deliberately under the 500-per-tier step promotion gives so the league
   * ladder stays the main driver of income.
   */
  const fansByRound = {
    'Play-in': 6,
    'Round of 32': 10,
    'Round of 16': 16,
    'Quarter-final': 24,
    'Semi-final': 36,
    Final: 120,
  } as const;
  const prize = prizeByRound[roundLabel];
  const fansWon = fansByRound[roundLabel];
  const latestLedger = state.ledgers[state.ledgers.length - 1];
  if (latestLedger === undefined) throw new Error('National Cup prize requires a weekly ledger');
  const balanceAfter = checkedAdd(latestLedger.balanceAfter, prize, 'National Cup prize balance');
  return clearMetBoardUltimatum({
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? {
          ...club,
          cash: checkedAdd(club.cash, prize, 'Global Cup prize cash'),
          fans: checkedAdd(club.fans, fansWon, 'Global Cup fans won'),
        }
      : club),
    ledgers: state.ledgers.map((ledger, index) => index === state.ledgers.length - 1
      ? {
          ...ledger,
          lines: [...ledger.lines, {
            kind: 'prize' as const,
            label: roundLabel === 'Final'
              ? 'Global Cup champions'
              : `Global Cup ${roundLabel} win`,
            amount: prize,
          }],
          balanceAfter,
        }
      : ledger),
  });
}

export function weeklyAmbientTrainingPoints(state: GameState): number {
  const grid = state.facilities.grid;
  const trainingPitchLevel = grid === undefined
    ? (state.facilities.trainingGroundBuilt ? 1 : 0)
    : grid.buildings
      .filter(building => (
        building.type === 'training-pitch' && isFacilityOperational(grid, building.id)
      ))
      .reduce((maximum, building) => Math.max(maximum, building.level), 0);
  const facilityPoints = checkedMultiply(
    trainingPitchLevel,
    TRAINING_PITCH_TP_PER_LEVEL,
    'facility training points',
  );
  const coachPoints = state.market === undefined ? 0 : careerCoachWeeklyTrainingPoints(state.market);
  // The baseline is unconditional: a club can run drills on whatever field it
  // has. Without it a career with no Training Pitch earned nothing, forever.
  return checkedAdd(
    checkedAdd(BASE_WEEKLY_TRAINING_POINTS, facilityPoints, 'baseline training points'),
    coachPoints,
    'ambient training points',
  );
}

function validateSetup(setup: CareerSetup): void {
  if (!Number.isInteger(setup.seed) || setup.seed < 0 || setup.seed > UINT32_MAX) {
    throw new Error('career seed must be an integer from 0 to 4294967295');
  }
  if (setup.clubs.length !== CLUB_COUNT) {
    throw new Error(`a career requires exactly ${CLUB_COUNT} clubs`);
  }
  if (setup.difficulty !== undefined && setup.difficulty !== 'COZY' && setup.difficulty !== 'CHAIRMAN') {
    throw new Error(`unknown career difficulty ${String(setup.difficulty)}`);
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
