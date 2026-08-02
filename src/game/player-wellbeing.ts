import { coachMotivatorStrengthHalfLevels } from './coach-weekly';
import { isFacilityOperational, type FacilityGridState } from './facilities';
import { growthSinceSigningPercent } from './market-career';
import { renewalContractAsk, renewalFamePercent } from './market';
import {
  shouldRequestTransfer,
  shouldWithdrawTransferRequest,
  updatePlayerWellbeing,
} from './pyramid';
import type { CareerPlayer, GameState } from './types';

export const WEEKLY_CONDITION_RECOVERY = 12;
export const OVERTRAINING_CONDITION_THRESHOLD = 30;

/**
 * Each Dorm level speeds weekly condition recovery, the way each Medical Bay
 * level shortens an injury. An instant drill costs 8 condition, so bare
 * recovery of 12 sustains 1.5 taps per player per week; a Dorm lifts that to
 * 2.0 / 2.5 / 3.0 taps and keeps players clear of the condition-30 floor where
 * overtraining injury rolls start. Before this the Dorm had no effect site at
 * all beyond the Gym adjacency.
 */
export const DORM_CONDITION_RECOVERY_PER_LEVEL = 4;

export interface WeeklyPlayerWellbeingContext {
  /** Results played outside the league fixture list, such as a Cup tie. */
  readonly additionalMatchOutcomes?: readonly WeeklyMatchOutcome[];
}

export type WeeklyMatchOutcome = 'win' | 'draw' | 'loss';

export interface WeeklyPlayerWellbeingResult {
  readonly players: CareerPlayer[];
  readonly matchOutcome?: WeeklyMatchOutcome;
}

/**
 * Applies one user-club wellbeing tick for the settling week: condition
 * recovery, match/underpaid morale, and transfer-request checks. Training
 * costs and overtraining injuries resolve at drill tap time, not here.
 * Opponent players pass through unchanged.
 */
export function resolveWeeklyPlayerWellbeing(
  state: GameState,
  context: WeeklyPlayerWellbeingContext = {},
): WeeklyPlayerWellbeingResult {
  validateStateClock(state);

  const match = currentUserMatch(state);
  const additionalMatchOutcomes = context.additionalMatchOutcomes ?? [];
  if (additionalMatchOutcomes.some(outcome => !['win', 'draw', 'loss'].includes(outcome))) {
    throw new Error('additional match outcomes must be win, draw, or loss');
  }
  const matchOutcomes = [
    ...(match === undefined ? [] : [match.outcome]),
    ...additionalMatchOutcomes,
  ];
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (matchOutcomes.length > 0 && lineup === undefined) {
    throw new Error('a played user match requires a user lineup');
  }
  const starters = new Set(lineup?.playerIds ?? []);
  const motivatorStrengthHalfLevels = state.market === undefined
    ? 0
    : coachMotivatorStrengthHalfLevels(state.market);
  const conditionDelta = weeklyConditionRecovery(gridDormLevel(state.facilities.grid));

  const players = state.players.map(player => {
    if (player.clubId !== state.userClubId) return player;

    const matchMoraleDelta = matchOutcomes.reduce(
      (total, outcome) => total + moraleDeltaForMatch(outcome, starters.has(player.id)),
      0,
    );
    const underpaidMoraleDelta = isUnderpaidPlayer(player) ? -2 : 0;
    const motivation = applyMotivatorProtection(
      matchMoraleDelta + underpaidMoraleDelta,
      motivatorStrengthHalfLevels,
      player.motivatorMoraleRemainderHalfPoints
        ?? (player.motivatorMoraleRemainder ?? 0) * 2,
    );
    const updated = updatePlayerWellbeing(
      {
        ...player,
        condition: player.condition ?? 100,
        personality: player.personality ?? 'Professional',
        consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks ?? 0,
      },
      { conditionDelta, moraleDelta: motivation.moraleDelta },
    );
    const updatedCondition = updated.condition ?? 100;
    const { motivatorMoraleRemainder: _legacyMotivatorRemainder, ...withoutLegacyRemainder } = updated;
    return {
      ...withoutLegacyRemainder,
      condition: updatedCondition,
      motivatorMoraleRemainderHalfPoints: motivation.remainderHalfPoints,
      // A standing request holds until it is won back, and a contented player
      // does not carry one. Writing this as `was || shouldRequest` made the
      // flag a memory instead of a state: it could only ever be set, so a squad
      // accumulated permanent "wants to leave" alerts, and `eligibleAskers`
      // — which drops listed players — starved until nobody could ask at all.
      transferRequested: player.transferRequested === true
        ? !shouldWithdrawTransferRequest(updated)
        : shouldRequestTransfer(updated),
    };
  });

  return {
    players,
    ...(matchOutcomes.length === 0
      ? {}
      : { matchOutcome: matchOutcomes[matchOutcomes.length - 1] }),
  };
}

function isUnderpaidPlayer(player: CareerPlayer): boolean {
  const fairWage = renewalContractAsk({
    weeklyWage: player.weeklyWage,
    personality: (player.personality ?? 'Professional').toUpperCase().replace('-', '_') as Parameters<typeof renewalContractAsk>[0]['personality'],
    ...(player.power === undefined ? {} : { power: player.power }),
    onHeroWage: player.onHeroWage,
  }, {
    growthSinceSigningPercent: growthSinceSigningPercent(player),
    famePercent: renewalFamePercent(player.fame ?? 0),
    heroMultiplier: 4,
    // Deliberately not the player's real loyalty. Loyalty has exactly one job —
    // the price of the next contract — and the player card says so. Feeding it
    // here would make every refused request ALSO raise the "fair wage" line,
    // adding a silent -2 morale a week and a faster transfer request that no
    // button on the decision card ever mentioned. A third punishment channel
    // the manager was never shown is worse than no punishment at all.
    loyaltyPercent: 0,
  });
  return player.weeklyWage * 100 < fairWage * 70;
}

function applyMotivatorProtection(
  moraleDelta: number,
  strengthHalfLevels: number,
  remainderHalfPoints: number,
): { moraleDelta: number; remainderHalfPoints: number } {
  if (!Number.isSafeInteger(strengthHalfLevels) || strengthHalfLevels < 0 || strengthHalfLevels > 15) {
    throw new Error('Motivator strength must be from 0 to 15 half-levels');
  }
  if (!Number.isSafeInteger(remainderHalfPoints)
    || remainderHalfPoints < 0
    || remainderHalfPoints >= 200) {
    throw new Error('Motivator morale remainder must be from 0 to 199 half-points');
  }
  if (moraleDelta >= 0 || strengthHalfLevels === 0) {
    return { moraleDelta, remainderHalfPoints };
  }
  // One half-level is 2.5%. A denominator of 200 keeps assistant effects exact
  // without introducing floating-point morale or fractional player ratings.
  const scaled = Math.abs(moraleDelta) * strengthHalfLevels * 5 + remainderHalfPoints;
  const prevented = Math.floor(scaled / 200);
  return { moraleDelta: moraleDelta + prevented, remainderHalfPoints: scaled % 200 };
}

/** Medical Bay levels remove one recovery week each, with a one-week floor. */
export function medicalBayRecoveryWeeks(baseRecoveryWeeks: number, medicalBayLevel: number): number {
  if (!Number.isSafeInteger(baseRecoveryWeeks) || baseRecoveryWeeks < 1) {
    throw new Error('base recovery weeks must be a positive safe integer');
  }
  if (!Number.isSafeInteger(medicalBayLevel) || medicalBayLevel < 0 || medicalBayLevel > 3) {
    throw new Error('Medical Bay level must be an integer from 0 to 3');
  }
  return Math.max(1, baseRecoveryWeeks - medicalBayLevel);
}

export function overtrainingInjuryChancePercent(
  condition: number,
  riskReductionPercent = 0,
): number {
  if (!Number.isSafeInteger(condition) || condition < 0 || condition > 100) {
    throw new Error('player condition must be an integer from 0 to 100');
  }
  if (!Number.isSafeInteger(riskReductionPercent)
    || riskReductionPercent < 0
    || riskReductionPercent > 100) {
    throw new Error('injury risk reduction must be an integer from 0 to 100');
  }
  if (condition >= OVERTRAINING_CONDITION_THRESHOLD) return 0;

  const missingCondition = OVERTRAINING_CONDITION_THRESHOLD - condition;
  const baseChance = 10 + checkedMultiply(
    missingCondition,
    2,
    'overtraining injury chance',
  );
  return Math.floor((baseChance * (100 - riskReductionPercent)) / 100);
}

function moraleDeltaForMatch(outcome: WeeklyMatchOutcome, started: boolean): number {
  const resultDelta = outcome === 'win' ? 3 : outcome === 'draw' ? 1 : -3;
  return resultDelta + (started ? 2 : -1);
}

function currentUserMatch(
  state: GameState,
): { outcome: WeeklyMatchOutcome } | undefined {
  const fixtures = state.fixtures.filter(fixture =>
    fixture.season === state.season
    && fixture.week === state.week
    && fixture.status === 'played'
    && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
  );
  if (fixtures.length > 1) throw new Error('a club cannot have more than one played match per week');
  const fixture = fixtures[0];
  if (fixture === undefined) return undefined;
  if (fixture.score === undefined) throw new Error('a played wellbeing fixture requires a score');

  const isHome = fixture.homeClubId === state.userClubId;
  const goalsFor = isHome ? fixture.score.homeGoals : fixture.score.awayGoals;
  const goalsAgainst = isHome ? fixture.score.awayGoals : fixture.score.homeGoals;
  return { outcome: goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss' };
}

/** The best operational Medical Bay wins; one still being built treats nobody. */
export function gridMedicalBayLevel(grid: FacilityGridState | undefined): number {
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'medical-bay') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

/** The best operational Dorm wins; a second Dorm is not a second bonus. */
export function gridDormLevel(grid: FacilityGridState | undefined): number {
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'dorm') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

/** Weekly condition recovery for the user club, Dorm levels included. */
export function weeklyConditionRecovery(dormLevel: number): number {
  if (!Number.isSafeInteger(dormLevel) || dormLevel < 0 || dormLevel > 3) {
    throw new Error('Dorm level must be an integer from 0 to 3');
  }
  return WEEKLY_CONDITION_RECOVERY + dormLevel * DORM_CONDITION_RECOVERY_PER_LEVEL;
}

function validateStateClock(state: Pick<GameState, 'careerSeed' | 'season' | 'week'>): void {
  if (!Number.isInteger(state.careerSeed) || state.careerSeed < 0 || state.careerSeed > 4294967295) {
    throw new Error('wellbeing career seed must be a uint32');
  }
  if (!Number.isSafeInteger(state.season) || state.season < 1) {
    throw new Error('wellbeing season must be a positive safe integer');
  }
  if (!Number.isSafeInteger(state.week) || state.week < 1) {
    throw new Error('wellbeing week must be a positive safe integer');
  }
}


function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
