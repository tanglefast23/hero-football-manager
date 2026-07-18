import { mulberry32 } from '../sim/rng';
import { awakeningChancePercent } from './progression';

const WEEKLY_EVENT_PERCENT = 18;
const GUARANTEED_EVENT_WEEK = 8;

export const M1_AWAKENING_RETRY_FIRST_WEEK = 9;
export const M1_AWAKENING_RETRY_LAST_WEEK = 24;

export interface EventClockState {
  weeksWithoutEvent: number;
  riskyChoices: number;
}

export interface WeeklyEventRoll {
  offered: boolean;
  state: EventClockState;
}

export interface CareerEventRollContext {
  careerSeed: number;
  season: number;
  week: number;
  riskyChoices: number;
}

export interface AwakeningRetryWindowOptions {
  careerSeed: number;
  season: number;
  firstWeek: number;
  lastWeek: number;
  initialFailedRiskyChoices: number;
  choiceId: string;
  baseChancePercent: number;
  pityIncrementPercent: number;
}

export interface AwakeningRetryWindowResult {
  awakened: boolean;
  awakeningWeek?: number;
  attempts: number;
  failedRiskyChoices: number;
}

export function rollWeeklyEvent(state: EventClockState, rollPercent: number): WeeklyEventRoll {
  validateState(state);
  if (!Number.isInteger(rollPercent) || rollPercent < 0 || rollPercent > 99) {
    throw new Error('event roll must be an integer from 0 to 99');
  }

  const offered =
    state.weeksWithoutEvent >= GUARANTEED_EVENT_WEEK - 1 ||
    rollPercent < WEEKLY_EVENT_PERCENT;

  return {
    offered,
    state: {
      weeksWithoutEvent: offered ? 0 : state.weeksWithoutEvent + 1,
      riskyChoices: state.riskyChoices,
    },
  };
}

export function recordEventChoice(state: EventClockState, risky: boolean): EventClockState {
  validateState(state);
  if (typeof risky !== 'boolean') {
    throw new Error('event choice risk must be a boolean');
  }
  if (risky && state.riskyChoices === Number.MAX_SAFE_INTEGER) {
    throw new Error('risky choice count exceeds the safe integer range');
  }

  return {
    weeksWithoutEvent: state.weeksWithoutEvent,
    riskyChoices: state.riskyChoices + (risky ? 1 : 0),
  };
}

export function chooseWeightedOutcome(weights: readonly number[], roll: number): number {
  if (weights.length === 0) {
    throw new Error('weighted outcomes require at least one weight');
  }

  let totalWeight = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight <= 0) {
      throw new Error('outcome weights must be positive safe integers');
    }
    totalWeight += weight;
    if (!Number.isSafeInteger(totalWeight)) {
      throw new Error('total outcome weight must be a safe integer');
    }
  }

  if (!Number.isInteger(roll) || roll < 0 || roll >= totalWeight) {
    throw new Error(`weighted outcome roll must be an integer from 0 to ${totalWeight - 1}`);
  }

  let cumulativeWeight = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulativeWeight += weights[index];
    if (roll < cumulativeWeight) return index;
  }

  throw new Error('weighted outcome selection did not resolve');
}

/**
 * Stable event RNG stream shared by the application flow and balance harness.
 * The context is plain persisted career data, so save/reload cannot reroll it.
 */
export function deterministicCareerEventRoll(
  context: CareerEventRollContext,
  choiceId: string,
  stream: number,
  upperExclusive: number,
): number {
  validateCareerEventRollContext(context);
  if (typeof choiceId !== 'string' || choiceId.trim().length === 0) {
    throw new Error('event roll choice ID must be a non-empty string');
  }
  if (!Number.isSafeInteger(stream) || stream < 0 || stream >= Number.MAX_SAFE_INTEGER) {
    throw new Error('event roll stream must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new Error('event roll upper bound must be a positive safe integer');
  }

  const seed = (
    context.careerSeed ^
    Math.imul(context.season, 0x9e3779b1) ^
    Math.imul(context.week, 0x85ebca6b) ^
    Math.imul(context.riskyChoices + 1, 0xc2b2ae35) ^
    Math.imul(hashString(choiceId), stream + 1)
  ) >>> 0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

/** Models the shipped M1 chain: retry the same risky choice once per week. */
export function simulateWeeklyAwakeningRetryWindow(
  options: AwakeningRetryWindowOptions,
): AwakeningRetryWindowResult {
  validatePositiveInteger(options.firstWeek, 'awakening retry first week');
  validatePositiveInteger(options.lastWeek, 'awakening retry last week');
  if (options.lastWeek < options.firstWeek) {
    throw new Error('awakening retry last week must not precede the first week');
  }
  if (!Number.isSafeInteger(options.initialFailedRiskyChoices)
    || options.initialFailedRiskyChoices < 0) {
    throw new Error('initial failed risky choices must be a nonnegative safe integer');
  }

  let failedRiskyChoices = options.initialFailedRiskyChoices;
  let attempts = 0;
  for (let week = options.firstWeek; week <= options.lastWeek; week += 1) {
    attempts += 1;
    const chancePercent = awakeningChancePercent(
      failedRiskyChoices,
      options.baseChancePercent,
      options.pityIncrementPercent,
    );
    const rollPercent = deterministicCareerEventRoll(
      {
        careerSeed: options.careerSeed,
        season: options.season,
        week,
        riskyChoices: failedRiskyChoices,
      },
      options.choiceId,
      0,
      100,
    );
    if (rollPercent < chancePercent) {
      return { awakened: true, awakeningWeek: week, attempts, failedRiskyChoices: 0 };
    }
    failedRiskyChoices += 1;
  }

  return { awakened: false, attempts, failedRiskyChoices };
}

function validateState(state: EventClockState): void {
  if (!Number.isSafeInteger(state.weeksWithoutEvent) || state.weeksWithoutEvent < 0) {
    throw new Error('weeks without an event must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(state.riskyChoices) || state.riskyChoices < 0) {
    throw new Error('risky choice count must be a nonnegative safe integer');
  }
}

function validateCareerEventRollContext(context: CareerEventRollContext): void {
  if (!Number.isInteger(context.careerSeed)
    || context.careerSeed < 0
    || context.careerSeed > 4294967295) {
    throw new Error('event roll career seed must be a uint32');
  }
  validatePositiveInteger(context.season, 'event roll season');
  validatePositiveInteger(context.week, 'event roll week');
  if (!Number.isSafeInteger(context.riskyChoices) || context.riskyChoices < 0) {
    throw new Error('event roll risky choices must be a nonnegative safe integer');
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
