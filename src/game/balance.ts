import { mulberry32 } from '../sim/rng';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  weeklyAmbientTrainingPoints,
} from './career';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
} from './facilities';
import { deterministicPostMatchAwakeningRoll } from './post-match-awakening';
import { buildTrainingGround } from './squad';
import { isAvailableForSelection } from './lineup';
import { trainPlayerInstantly } from './training';
import { trainingDrillPathId } from './training-paths';
import type { FocusDrill } from './progression';
import type {
  CareerSetup,
  FixtureResult,
  GameState,
  LeagueFixture,
} from './types';

const DEFAULT_CAREER_SEEDS = 200;
const DEFAULT_AWAKENING_SEEDS = 2000;

/**
 * M1 CI rails, taken directly from the design promises:
 * - docs/09: Season-1 Cozy bankruptcy stays below 2%.
 * - docs/05: a completed Level-1 Training Pitch supplies almost all of its
 *   nominal TP/week across the season, losing only its construction weeks. The
 *   pitch's share sits on top of BASE_WEEKLY_TRAINING_POINTS, which every club
 *   banks whether or not it has ever built anything, so both ends of the rail
 *   ride the constants rather than restating numbers that drift the moment
 *   either one moves.
 * - Post-match awakenings average roughly one per ten eligible matches after
 *   their three-match cooldown, without silently adding a pity guarantee.
 */
export const MINI_BALANCE_RAILS = Object.freeze({
  maximumSeasonOneBankruptcyRate: 0.02,
  minimumMeanAmbientTrainingPointsPerWeek:
    BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL * 0.9,
  maximumMeanAmbientTrainingPointsPerWeek:
    BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL,
  minimumMeanAwakeningMatch: 10,
  maximumMeanAwakeningMatch: 14,
  minimumAwakeningBySeasonEndRate: 0.75,
  maximumAwakeningBySeasonEndRate: 0.86,
});

interface MiniBalanceHarnessOptions {
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

interface MiniBalanceMetrics {
  readonly careerSeeds: number;
  readonly awakeningSeeds: number;
  readonly seasonOneBankruptcyRate: number;
  readonly meanSeasonOneEndingCash: number;
  readonly meanSeasonOneDiscretionarySpend: number;
  readonly meanTrainingPointsPerSeason: number;
  readonly meanAmbientTrainingPointsPerWeek: number;
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
  let ambientTrainingPointsTotal = 0;
  let discretionarySpendTotal = 0;

  for (let seed = 1; seed <= careerSeeds; seed += 1) {
    const result = simulateSeasonOne(
      { ...setupTemplate, seed },
      scenario.spendingPolicy,
    );
    if (result.minimumBalance < 0) bankruptCareers += 1;
    endingCashTotal += result.endingCash;
    trainingPointsTotal += result.trainingPoints;
    ambientTrainingPointsTotal += result.ambientTrainingPoints;
    discretionarySpendTotal += result.discretionarySpend;
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
    meanAmbientTrainingPointsPerWeek:
      ambientTrainingPointsTotal / careerSeeds / 30,
    meanAwakeningMatch: awakeningMatchTotal / awakeningSeeds,
    meanAwakeningAttempts: awakeningAttemptTotal / awakeningSeeds,
    awakeningByDeadlineRate: awakeningsByDeadline / awakeningSeeds,
    awakeningDeadlineMatch: awakening.seasonMatches,
    representativeDrillIds: representativeDrills.map((drill) => drill.id),
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
    if (
      deterministicPostMatchAwakeningRoll(
        careerSeed,
        `balance-match-${match}`,
        0,
        100,
      ) < chancePercent
    ) {
      return { awakened: true, awakeningMatch: match, attempts };
    }
  }
  return { awakened: false, attempts };
}

interface SeasonOneResult {
  endingCash: number;
  minimumBalance: number;
  trainingPoints: number;
  ambientTrainingPoints: number;
  discretionarySpend: number;
}

function simulateSeasonOne(
  setup: CareerSetup,
  spendingPolicy: MiniBalanceScenario['spendingPolicy'],
): SeasonOneResult {
  let state = createCareer(setup);
  state = buildTrainingGround(state, spendingPolicy.trainingGroundCost);
  if (
    spendingPolicy.assignedPlayerIds.length !==
    spendingPolicy.weeklyFocusDrillIds.length
  ) {
    throw new Error(
      'balance spending policy requires exactly one drill per assigned player',
    );
  }
  const slots = spendingPolicy.assignedPlayerIds.map((playerId, index) => ({
    playerId,
    pathId: trainingDrillPathId(spendingPolicy.weeklyFocusDrillIds[index]),
  }));

  let ambientTrainingPoints = 0;
  const initialCash =
    setup.clubs.find((club) => club.id === setup.userClubId)?.cash ?? 0;
  let minimumBalance = initialCash - spendingPolicy.trainingGroundCost;

  while (state.phase !== 'season-end') {
    // Drills now resolve at tap time; the harness taps each policy drill once
    // per manage week, skipping unaffordable or injured assignments the way an
    // active manager would.
    for (const slot of slots) {
      const player = state.players.find(
        (candidate) => candidate.id === slot.playerId,
      );
      // Skips leave as well as injury. `trainPlayerInstantly` throws on both,
      // and the catch below breaks out of the whole week's training — so an
      // unskipped away player would silently truncate every later drill in the
      // harness and read as a training shortfall that never happened.
      if (player === undefined || !isAvailableForSelection(player)) continue;
      try {
        state = trainPlayerInstantly(state, slot.playerId, slot.pathId).state;
      } catch {
        break; // Out of TP this week.
      }
    }
    const beforeAdvance = state;
    state = advanceWeek(state);
    if (state.phase === 'matchday') {
      ambientTrainingPoints += weeklyAmbientTrainingPoints(state);
      // A double-header week presents the league fixture and then the National
      // Cup tie, so drain every matchday the week holds.
      while (state.phase === 'matchday') {
        const matchday = activeCareerMatchday(state);
        if (matchday === undefined)
          throw new Error('balance harness lost its active matchday');
        state = completeMatchday(state, matchday.fixtures.map(scoreFixture));
      }
    } else {
      ambientTrainingPoints += weeklyAmbientTrainingPoints(beforeAdvance);
    }
  }

  const userClub = state.clubs.find((club) => club.id === state.userClubId);
  if (userClub === undefined)
    throw new Error(`balance harness lost user club ${state.userClubId}`);

  // `state.ledgers` holds the last RETAINED_LEDGER_SEASONS (20) seasons, not the
  // whole career. Every rail here drives fifteen seasons or fewer, so the two
  // career-wide reductions below still see everything they settled. A longer
  // rail would need the trim raised, or these totals banked as they settle.
  return {
    endingCash: userClub.cash,
    minimumBalance: state.ledgers.reduce(
      (minimum, ledger) => Math.min(minimum, ledger.balanceAfter),
      minimumBalance,
    ),
    trainingPoints: state.trainingPoints,
    ambientTrainingPoints,
    discretionarySpend:
      spendingPolicy.trainingGroundCost +
      state.ledgers.reduce(
        (sum, ledger) =>
          sum +
          ledger.lines
            .filter((line) => line.kind === 'training')
            .reduce((weekly, line) => weekly + Math.max(0, -line.amount), 0),
        0,
      ),
  };
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

function validateSampleSize(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000) {
    throw new Error(`${label} must be an integer from 1 to 10000`);
  }
}
