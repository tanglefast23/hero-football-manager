import { mulberry32 } from '../sim/rng';
import {
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
} from './career';
import { deterministicPostMatchAwakeningRoll } from './post-match-awakening';
import { buildTrainingGround } from './squad';
import { setCareerTrainingPlan } from './training';
import type { FocusDrill } from './progression';
import type { CareerSetup, FixtureResult, GameState, LeagueFixture } from './types';

const DEFAULT_CAREER_SEEDS = 200;
const DEFAULT_AWAKENING_SEEDS = 2000;

/**
 * M1 CI rails, taken directly from the design promises:
 * - docs/09: Season-1 Cozy bankruptcy stays below 2%.
 * - docs/05: a typical match-week TP award buys about two of three focus drills.
 * - Post-match awakenings average roughly one per ten eligible matches after
 *   their three-match cooldown, without silently adding a pity guarantee.
 */
export const MINI_BALANCE_RAILS = Object.freeze({
  maximumSeasonOneBankruptcyRate: 0.02,
  minimumAffordableFocusDrillsPerMatchWeek: 1.5,
  maximumAffordableFocusDrillsPerMatchWeek: 2.5,
  minimumMeanAwakeningMatch: 10,
  maximumMeanAwakeningMatch: 14,
  minimumAwakeningBySeasonEndRate: 0.75,
  maximumAwakeningBySeasonEndRate: 0.86,
});

export interface MiniBalanceHarnessOptions {
  readonly careerSeeds?: number;
  readonly awakeningSeeds?: number;
}

export interface MiniBalanceScenario {
  readonly careerSetup: Omit<CareerSetup, 'seed'>;
  readonly representativeDrills: readonly FocusDrill[];
  readonly spendingPolicy: {
    readonly trainingGroundCost: number;
    readonly assignedPlayerIds: readonly string[];
    readonly weeklyFocusDrillIds: readonly string[];
  };
  readonly awakening: {
    readonly chancePercent: number;
    readonly minimumMatchesBetween: number;
    readonly seasonMatches: number;
  };
}

export interface MiniBalanceMetrics {
  readonly careerSeeds: number;
  readonly awakeningSeeds: number;
  readonly seasonOneBankruptcyRate: number;
  readonly meanSeasonOneEndingCash: number;
  readonly meanSeasonOneDiscretionarySpend: number;
  readonly meanTrainingPointsPerSeason: number;
  readonly meanAffordableFocusDrillsPerMatchWeek: number;
  readonly meanAwakeningMatch: number;
  readonly meanAwakeningAttempts: number;
  readonly awakeningByDeadlineRate: number;
  readonly awakeningDeadlineMatch: number;
  readonly representativeDrillIds: readonly string[];
}

export function runMiniBalanceHarness(
  scenario: MiniBalanceScenario,
  options: MiniBalanceHarnessOptions = {},
): MiniBalanceMetrics {
  const careerSeeds = options.careerSeeds ?? DEFAULT_CAREER_SEEDS;
  const awakeningSeeds = options.awakeningSeeds ?? DEFAULT_AWAKENING_SEEDS;
  validateSampleSize(careerSeeds, 'careerSeeds');
  validateSampleSize(awakeningSeeds, 'awakeningSeeds');

  const setupTemplate = scenario.careerSetup;
  const representativeDrills = scenario.representativeDrills.slice(0, 3);
  if (representativeDrills.length !== 3) {
    throw new Error('balance harness requires three representative drills');
  }
  let bankruptCareers = 0;
  let endingCashTotal = 0;
  let trainingPointsTotal = 0;
  let discretionarySpendTotal = 0;
  let affordableDrillTotal = 0;
  let matchWeekTotal = 0;

  for (let seed = 1; seed <= careerSeeds; seed += 1) {
    const result = simulateSeasonOne(
      { ...setupTemplate, seed },
      representativeDrills,
      scenario.spendingPolicy,
    );
    if (result.minimumBalance < 0) bankruptCareers += 1;
    endingCashTotal += result.endingCash;
    trainingPointsTotal += result.trainingPoints;
    discretionarySpendTotal += result.discretionarySpend;
    affordableDrillTotal += result.affordableDrills;
    matchWeekTotal += result.matchWeeks;
  }

  const awakening = scenario.awakening;
  let awakeningMatchTotal = 0;
  let awakeningAttemptTotal = 0;
  let awakeningsByDeadline = 0;
  for (let sample = 1; sample <= awakeningSeeds; sample += 1) {
    const result = simulatePostMatchAwakeningWindow(
      sample,
      awakening.chancePercent,
      awakening.minimumMatchesBetween,
      awakening.seasonMatches,
    );
    awakeningMatchTotal += result.awakeningMatch ?? awakening.seasonMatches + 1;
    awakeningAttemptTotal += result.attempts;
    if (result.awakened) awakeningsByDeadline += 1;
  }

  return {
    careerSeeds,
    awakeningSeeds,
    seasonOneBankruptcyRate: bankruptCareers / careerSeeds,
    meanSeasonOneEndingCash: endingCashTotal / careerSeeds,
    meanSeasonOneDiscretionarySpend: discretionarySpendTotal / careerSeeds,
    meanTrainingPointsPerSeason: trainingPointsTotal / careerSeeds,
    meanAffordableFocusDrillsPerMatchWeek: affordableDrillTotal / matchWeekTotal,
    meanAwakeningMatch: awakeningMatchTotal / awakeningSeeds,
    meanAwakeningAttempts: awakeningAttemptTotal / awakeningSeeds,
    awakeningByDeadlineRate: awakeningsByDeadline / awakeningSeeds,
    awakeningDeadlineMatch: awakening.seasonMatches,
    representativeDrillIds: representativeDrills.map(drill => drill.id),
  };
}

function simulatePostMatchAwakeningWindow(
  careerSeed: number,
  chancePercent: number,
  minimumMatchesBetween: number,
  seasonMatches: number,
): { awakened: boolean; awakeningMatch?: number; attempts: number } {
  let matchesSinceLastAwakening = 0;
  let attempts = 0;
  for (let match = 1; match <= seasonMatches; match += 1) {
    matchesSinceLastAwakening += 1;
    if (matchesSinceLastAwakening < minimumMatchesBetween) continue;
    attempts += 1;
    if (deterministicPostMatchAwakeningRoll(
      careerSeed,
      `balance-match-${match}`,
      0,
      100,
    ) < chancePercent) {
      return { awakened: true, awakeningMatch: match, attempts };
    }
  }
  return { awakened: false, attempts };
}

interface SeasonOneResult {
  endingCash: number;
  minimumBalance: number;
  trainingPoints: number;
  affordableDrills: number;
  matchWeeks: number;
  discretionarySpend: number;
}

function simulateSeasonOne(
  setup: CareerSetup,
  representativeDrills: readonly FocusDrill[],
  spendingPolicy: MiniBalanceScenario['spendingPolicy'],
): SeasonOneResult {
  let state = createCareer(setup);
  state = buildTrainingGround(state, spendingPolicy.trainingGroundCost);
  const focusDrillById = new Map(representativeDrills.map(drill => [drill.id, drill]));
  const weeklyDrills = spendingPolicy.weeklyFocusDrillIds.map(id => {
    const drill = focusDrillById.get(id);
    if (drill === undefined) throw new Error(`balance spending policy uses unknown drill ${id}`);
    return drill;
  });
  state = setCareerTrainingPlan(state, spendingPolicy.assignedPlayerIds, weeklyDrills);

  let affordableDrills = 0;
  let matchWeeks = 0;
  const representativeDrillCosts = representativeDrills.map(drill => drill.tpCost);
  const initialCash = setup.clubs.find(club => club.id === setup.userClubId)?.cash ?? 0;
  let minimumBalance = initialCash - spendingPolicy.trainingGroundCost;

  while (state.phase !== 'season-end') {
    state = advanceWeek(state);
    if (state.phase !== 'matchday') continue;

    const fixtures = fixturesForCurrentWeek(state);
    const results = fixtures.map(scoreFixture);
    const earnedTrainingPoints = trainingPointsForUserResult(
      state.userClubId,
      fixtures,
      results,
    );
    state = completeMatchday(state, results);
    affordableDrills += affordablePrefixCount(earnedTrainingPoints, representativeDrillCosts);
    matchWeeks += 1;
  }

  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) throw new Error(`balance harness lost user club ${state.userClubId}`);

  return {
    endingCash: userClub.cash,
    minimumBalance: state.ledgers.reduce(
      (minimum, ledger) => Math.min(minimum, ledger.balanceAfter),
      minimumBalance,
    ),
    trainingPoints: state.trainingPoints,
    affordableDrills,
    matchWeeks,
    discretionarySpend: spendingPolicy.trainingGroundCost + state.ledgers.reduce(
      (sum, ledger) => sum + ledger.lines
        .filter(line => line.kind === 'training')
        .reduce((weekly, line) => weekly + Math.max(0, -line.amount), 0),
      0,
    ),
  };
}

function trainingPointsForUserResult(
  userClubId: string,
  fixtures: readonly LeagueFixture[],
  results: readonly FixtureResult[],
): number {
  const fixture = fixtures.find(candidate =>
    candidate.homeClubId === userClubId || candidate.awayClubId === userClubId,
  );
  if (fixture === undefined) return 0;
  const result = results.find(candidate => candidate.fixtureId === fixture.id);
  if (result === undefined) throw new Error(`balance harness lost result ${fixture.id}`);
  const isHome = fixture.homeClubId === userClubId;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  return (goalsFor > goalsAgainst ? 30 : goalsFor === goalsAgainst ? 20 : 14)
    + goalsFor * 2;
}

function scoreFixture(fixture: LeagueFixture): FixtureResult {
  const random = mulberry32(fixture.matchSeed);
  const homeGoals = goalRoll(random());
  const awayGoals = goalRoll(random());
  const homeAdvantage = random() < 0.12 ? 1 : 0;

  return {
    fixtureId: fixture.id,
    homeGoals: homeGoals + homeAdvantage,
    awayGoals,
  };
}

function goalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

function affordablePrefixCount(budget: number, drillCosts: readonly number[]): number {
  let remaining = budget;
  let count = 0;
  for (const cost of drillCosts) {
    if (cost > remaining) break;
    remaining -= cost;
    count += 1;
  }
  return count;
}

function validateSampleSize(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000) {
    throw new Error(`${label} must be an integer from 1 to 10000`);
  }
}
