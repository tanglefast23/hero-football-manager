import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerFacility,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  hireCareerCoach,
  isFacilityOperational,
  isFirstOnboardingFixture,
  resolvePostMatchAwakening,
  type ActiveCareerMatchday,
  type DifficultyMode,
  type FixtureResult,
  type GameState,
  type LeagueFixture,
  type ProductionFixtureResult,
} from '../../game';
import { mulberry32 } from '../../sim/rng';

const content = loadLaunchContent();
const CREATED_PLAYER_RATINGS = {
  pac: 50,
  sho: 65,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
} as const;
const SAFETY_LINE_KINDS = new Set([
  'emergency-loan',
  'board-sale',
  'board-rescue',
]);

export type EconomyOutcomePolicy = 'STRONG' | 'REPRESENTATIVE';

export interface OpeningEconomyRunOptions {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly outcomes: EconomyOutcomePolicy;
  readonly throughSeasonEnd?: boolean;
}

export interface OpeningEconomyRun {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly outcomes: EconomyOutcomePolicy;
  readonly checkpointSeason: number;
  readonly checkpointWeek: number;
  readonly leagueMatches: number;
  readonly cupMatches: number;
  readonly endingCash: number;
  readonly endingCashBeforePrizesAndSafety: number;
  readonly capitalSpend: number;
  readonly prizeIncome: number;
  readonly emergencyLoan: boolean;
  readonly forcedSale: boolean;
  readonly cashFloorTopUp: boolean;
  readonly stadiumOperational: boolean;
}

/**
 * Runs the exact opening build the game teaches through production settlement.
 * Match outcomes are policy inputs, but audience facts are supplied through the
 * same ProductionFixtureResult adapter used by Quick Result and watched games.
 */
export function runOpeningEconomy(
  options: OpeningEconomyRunOptions,
): OpeningEconomyRun {
  let state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(
          options.seed,
          undefined,
          content,
          options.difficulty,
        ),
      ),
    ),
    {
      name: 'Economy Rookie',
      ratings: { ...CREATED_PLAYER_RATINGS },
      difficulty: options.difficulty,
    },
  );
  const openingCash = userClub(state).cash;
  let leagueMatches = 0;
  let cupMatches = 0;
  let guard = 0;

  while (guard < 96) {
    guard += 1;
    if (state.phase === 'season-end') break;
    if (state.phase === 'manage') {
      state = applyGuidedOpeningActions(state);
      state = advanceWeek(state);
      continue;
    }
    if (state.phase !== 'matchday') {
      throw new Error(
        `economy runner entered unsupported phase ${state.phase}`,
      );
    }

    const matchday = activeCareerMatchday(state);
    if (matchday === undefined)
      throw new Error('economy runner lost its active matchday');
    const played = playPolicyMatchday(state, matchday, options.outcomes);
    state = played.state;
    if (matchday.kind === 'league') leagueMatches += 1;
    else cupMatches += 1;

    if (
      options.throughSeasonEnd !== true &&
      leagueMatches >= 7 &&
      cupMatches >= 1 &&
      state.phase === 'manage'
    ) {
      break;
    }
  }

  if (guard >= 96)
    throw new Error('economy runner exceeded its transition guard');
  if (options.throughSeasonEnd === true && state.phase !== 'season-end') {
    throw new Error('economy runner did not reach the Season-1 review');
  }
  if (
    options.throughSeasonEnd !== true &&
    (leagueMatches < 7 || cupMatches < 1)
  ) {
    throw new Error('economy runner did not reach the opening checkpoint');
  }

  const club = userClub(state);
  const ledgerLines = state.ledgers.flatMap((ledger) => ledger.lines);
  const prizeIncome = ledgerLines
    .filter((line) => line.kind === 'prize')
    .reduce((sum, line) => sum + line.amount, 0);
  const capitalSpend = -(state.cashTransactions ?? [])
    .filter((transaction) => transaction.kind === 'facility-build')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const operatingLedgerNet = ledgerLines
    .filter(
      (line) => line.kind !== 'prize' && !SAFETY_LINE_KINDS.has(line.kind),
    )
    .reduce((sum, line) => sum + line.amount, 0);
  const stand = state.facilities.grid?.buildings.find(
    (building) => building.type === 'stadium-stand',
  );

  return {
    seed: options.seed,
    difficulty: options.difficulty,
    outcomes: options.outcomes,
    checkpointSeason: state.season,
    checkpointWeek: state.week,
    leagueMatches,
    cupMatches,
    endingCash: club.cash,
    endingCashBeforePrizesAndSafety:
      openingCash - capitalSpend + operatingLedgerNet,
    capitalSpend,
    prizeIncome,
    emergencyLoan: ledgerLines.some((line) => line.kind === 'emergency-loan'),
    forcedSale: ledgerLines.some((line) => line.kind === 'board-sale'),
    cashFloorTopUp: ledgerLines.some((line) => line.kind === 'board-rescue'),
    stadiumOperational:
      stand !== undefined &&
      isFacilityOperational(state.facilities.grid!, stand.id),
  };
}

function applyGuidedOpeningActions(state: GameState): GameState {
  if (state.week === 1) {
    const head = firstLevelOneCoach(state);
    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, head.id, 'HEAD'),
    };
    return buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
  }
  if (state.week === 3) {
    return buildCareerFacility(state, 'coaching-office', { x: 2, y: 0 }).state;
  }
  if (state.week === 4) {
    const assistant = firstLevelOneCoach(state);
    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, assistant.id, 'ASSISTANT'),
    };
    return buildCareerFacility(state, 'fan-shop', { x: 3, y: 0 }).state;
  }
  if (state.week === 5) {
    return buildCareerFacility(state, 'stadium-stand', { x: 4, y: 0 }).state;
  }
  return state;
}

function firstLevelOneCoach(state: GameState) {
  const coach = state.market?.coachCandidates.find(
    (candidate) => candidate.level === 1,
  );
  if (coach === undefined)
    throw new Error('guided opening needs an eligible Level-1 coach');
  return coach;
}

function playPolicyMatchday(
  state: GameState,
  matchday: ActiveCareerMatchday,
  policy: EconomyOutcomePolicy,
): { state: GameState } {
  const userFixture = matchday.fixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId ||
      fixture.awayClubId === state.userClubId,
  );
  if (userFixture === undefined)
    throw new Error('active matchday has no user fixture');
  const outcome =
    policy === 'STRONG'
      ? ('WIN' as const)
      : representativeOutcome(state.careerSeed, userFixture.id);
  const userResult = scoreForOutcome(userFixture, state.userClubId, outcome);
  const results = matchday.fixtures.map((fixture) =>
    fixture.id === userFixture.id ? userResult : backgroundScore(fixture),
  );
  const participants = userLineup(state);
  const production: ProductionFixtureResult = {
    fixtureResult: userResult,
    goals: [],
    participantPlayerIds: participants,
    powerFiredPlayerIds: [],
  };
  const onboardingMatch = isFirstOnboardingFixture(state, userFixture.id);
  let next = completeMatchday(state, results, production);
  if (onboardingMatch)
    next = completeFirstOnboardingMatch(next, userFixture.id);

  if (matchday.kind === 'league') {
    const awakening = resolvePostMatchAwakening(
      next,
      userFixture.id,
      participants,
      content.powers.powers.map((power) => power.id),
      content.onboarding.triggers.map((trigger) => trigger.id),
      {
        chancePercent: content.powers.awakening.postMatchChancePercent,
        secondInSeasonChancePercent:
          content.powers.awakening.secondInSeasonChancePercent,
        maxPerSeason: content.powers.awakening.maxPerSeason,
        minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
      },
    );
    next = awakening.awakened
      ? completePostMatchAwakening(awakening.state)
      : awakening.state;
  }
  return { state: next };
}

function representativeOutcome(
  careerSeed: number,
  fixtureId: string,
): 'WIN' | 'DRAW' | 'LOSS' {
  const roll = mulberry32(
    (careerSeed ^ Math.imul(hashString(fixtureId), 0x9e3779b1)) >>> 0,
  )();
  if (roll < 0.45) return 'WIN';
  if (roll < 0.7) return 'DRAW';
  return 'LOSS';
}

function scoreForOutcome(
  fixture: LeagueFixture,
  userClubId: string,
  outcome: 'WIN' | 'DRAW' | 'LOSS',
): FixtureResult {
  if (outcome === 'DRAW') {
    return { fixtureId: fixture.id, homeGoals: 1, awayGoals: 1 };
  }
  const userIsHome = fixture.homeClubId === userClubId;
  const userWins = outcome === 'WIN';
  const homeWins = userIsHome === userWins;
  return {
    fixtureId: fixture.id,
    homeGoals: homeWins ? 2 : 0,
    awayGoals: homeWins ? 0 : 2,
  };
}

function backgroundScore(fixture: LeagueFixture): FixtureResult {
  const random = mulberry32(fixture.matchSeed);
  return {
    fixtureId: fixture.id,
    homeGoals: goalRoll(random()) + (random() < 0.12 ? 1 : 0),
    awayGoals: goalRoll(random()),
  };
}

function goalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

function userLineup(state: GameState): string[] {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined)
    throw new Error('economy runner lost the user lineup');
  return [...lineup.playerIds];
}

function userClub(state: GameState) {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined) throw new Error('economy runner lost the user club');
  return club;
}
