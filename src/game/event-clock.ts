import { mulberry32 } from '../sim/rng';

export interface EventClockState {
  weeksWithoutEvent: number;
  riskyChoices: number;
  /**
   * The week whose story offer has already been settled. The desk is reconciled
   * on every render of a management week, so without a stamp the same week would
   * re-roll — and each re-roll would tick the drought counter again. Absent on
   * saves written before stories moved to the desk.
   */
  storySettledSeason?: number;
  storySettledWeek?: number;
}

/** Story pacing knobs; the launch values live in `content/events.json`. */
interface EventClockTuning {
  weeklyChancePercent: number;
  guaranteeAfterDryWeeks: number;
}

// Mirrors the shipped values in `content/events.json` so a caller that omits
// tuning cannot silently pace stories differently from launch content.
const DEFAULT_EVENT_CLOCK_TUNING: EventClockTuning = {
  weeklyChancePercent: 18,
  guaranteeAfterDryWeeks: 6,
};

interface WeeklyEventRoll {
  offered: boolean;
  state: EventClockState;
}

interface CareerEventRollContext {
  careerSeed: number;
  season: number;
  week: number;
  riskyChoices: number;
}

/**
 * The chance a quiet week produces a story, rising with the drought.
 *
 * A flat weekly chance makes long silences feel like the game forgot about you,
 * and a hard "guaranteed on week N" makes the wait feel scripted. Ramping from
 * the base chance to certainty across the guarantee window keeps the guarantee
 * intact while the weeks before it get steadily more likely, so a drought
 * breaks sooner on average without ever breaking on a fixed schedule.
 */
export function quietWeekEventChancePercent(
  weeksWithoutEvent: number,
  tuning: EventClockTuning = DEFAULT_EVENT_CLOCK_TUNING,
): number {
  validateTuning(tuning);
  if (!Number.isInteger(weeksWithoutEvent) || weeksWithoutEvent < 0) {
    throw new Error('dry-week count must be a non-negative integer');
  }
  const weeksToCertainty = Math.max(1, tuning.guaranteeAfterDryWeeks - 1);
  const progress = Math.min(1, weeksWithoutEvent / weeksToCertainty);
  const base = tuning.weeklyChancePercent;
  // Eased rather than linear: the first dry week barely moves the odds and the
  // last one moves them a lot, so the ramp reads as patience running out rather
  // than a countdown. A linear rise from the same base roughly halves the mean
  // drought, which floods the desk at the tuned base chance.
  return Math.round(base + (100 - base) * progress * progress);
}

export function rollWeeklyEvent(
  state: EventClockState,
  rollPercent: number,
  tuning: EventClockTuning = DEFAULT_EVENT_CLOCK_TUNING,
): WeeklyEventRoll {
  validateState(state);
  validateTuning(tuning);
  if (!Number.isInteger(rollPercent) || rollPercent < 0 || rollPercent > 99) {
    throw new Error('event roll must be an integer from 0 to 99');
  }

  const offered =
    rollPercent < quietWeekEventChancePercent(state.weeksWithoutEvent, tuning);

  return {
    offered,
    state: {
      weeksWithoutEvent: offered ? 0 : state.weeksWithoutEvent + 1,
      riskyChoices: state.riskyChoices,
    },
  };
}

export function recordEventChoice(
  state: EventClockState,
  risky: boolean,
): EventClockState {
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

export function chooseWeightedOutcome(
  weights: readonly number[],
  roll: number,
): number {
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
    throw new Error(
      `weighted outcome roll must be an integer from 0 to ${totalWeight - 1}`,
    );
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
  if (
    !Number.isSafeInteger(stream) ||
    stream < 0 ||
    stream >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error('event roll stream must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new Error('event roll upper bound must be a positive safe integer');
  }

  const seed =
    (context.careerSeed ^
      Math.imul(context.season, 0x9e3779b1) ^
      Math.imul(context.week, 0x85ebca6b) ^
      Math.imul(context.riskyChoices + 1, 0xc2b2ae35) ^
      Math.imul(hashString(choiceId), stream + 1)) >>>
    0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

function validateTuning(tuning: EventClockTuning): void {
  if (
    !Number.isInteger(tuning.weeklyChancePercent) ||
    tuning.weeklyChancePercent < 1 ||
    tuning.weeklyChancePercent > 100
  ) {
    throw new Error('weekly event chance must be an integer from 1 to 100');
  }
  if (
    !Number.isInteger(tuning.guaranteeAfterDryWeeks) ||
    tuning.guaranteeAfterDryWeeks < 1 ||
    tuning.guaranteeAfterDryWeeks > 30
  ) {
    throw new Error('dry-week guarantee must be an integer from 1 to 30');
  }
}

function validateState(state: EventClockState): void {
  if (
    !Number.isSafeInteger(state.weeksWithoutEvent) ||
    state.weeksWithoutEvent < 0
  ) {
    throw new Error(
      'weeks without an event must be a nonnegative safe integer',
    );
  }
  if (!Number.isSafeInteger(state.riskyChoices) || state.riskyChoices < 0) {
    throw new Error('risky choice count must be a nonnegative safe integer');
  }
}

function validateCareerEventRollContext(context: CareerEventRollContext): void {
  if (
    !Number.isInteger(context.careerSeed) ||
    context.careerSeed < 0 ||
    context.careerSeed > 4294967295
  ) {
    throw new Error('event roll career seed must be a uint32');
  }
  validatePositiveInteger(context.season, 'event roll season');
  validatePositiveInteger(context.week, 'event roll week');
  if (!Number.isSafeInteger(context.riskyChoices) || context.riskyChoices < 0) {
    throw new Error(
      'event roll risky choices must be a nonnegative safe integer',
    );
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
