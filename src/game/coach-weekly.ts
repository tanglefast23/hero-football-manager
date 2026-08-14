import type { Attrs } from '../sim/types';
import {
  careerCoachWeeklyWage,
  type CareerCoachRole,
  type CareerMarketState,
} from './market-career';
import {
  COACH_BOOST_CAPS,
  type CoachBoosts,
  type CoachSpecialty,
} from './market';
import { scaledTrainingPoints } from './training-point-income';

const TRAINING_ATTRIBUTES = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
] as const;

type TrainingAttribute = (typeof TRAINING_ATTRIBUTES)[number];

export function coachTrainingBonusPercent(
  level: number,
  role: CareerCoachRole,
): number {
  validateCoachLevel(level, role === 'HEAD' ? 'head coach' : 'assistant coach');
  return checkedMultiply(
    level,
    role === 'HEAD' ? 10 : 5,
    `${role.toLowerCase()} training bonus`,
  );
}

/** A story's permanent change to one coach, clamped to its lifetime cap. */
export function cappedCoachBoost(
  boosts: CoachBoosts | undefined,
  facet: keyof typeof COACH_BOOST_CAPS,
): number {
  const raw = boosts?.[facet] ?? 0;
  if (!Number.isSafeInteger(raw))
    throw new Error(`coach ${facet} boost must be a safe integer`);
  const cap = COACH_BOOST_CAPS[facet];
  return Math.max(-cap, Math.min(cap, raw));
}

/**
 * Stable weekly TP created by one employed coach.
 *
 * The full rates are 10 + 2×level for a head coach, with one capstone point at
 * level 5, and 5 + level for an assistant. `TRAINING_POINT_SCALE_PERCENT` then
 * keeps 40% of both alongside the baseline and the Training Pitch, so hiring
 * never becomes the cheap way around a weekly income the rest of the game just
 * lowered.
 *
 * A story's boost is added on top of the scaled figure, in
 * `coachWeeklyTrainingPointsWithBoosts` — it is a change to this coach, not
 * another lever on the club's weekly income, so the global cut does not apply
 * to it twice.
 */
export function coachWeeklyTrainingPoints(
  level: number,
  role: CareerCoachRole,
): number {
  validateCoachLevel(level, role === 'HEAD' ? 'head coach' : 'assistant coach');
  return scaledTrainingPoints(
    role === 'HEAD'
      ? 10 + checkedMultiply(level, 2, 'head coach TP') + (level === 5 ? 1 : 0)
      : 5 + level,
  );
}

/** Weekly TP including whatever a story has permanently changed about him. */
export function coachWeeklyTrainingPointsWithBoosts(
  coach: { readonly level: number; readonly boosts?: CoachBoosts },
  role: CareerCoachRole,
): number {
  // Floored at zero: a run of bad calls can cancel a coach's contribution, but
  // it can never make employing him cost the club training points.
  return Math.max(
    0,
    coachWeeklyTrainingPoints(coach.level, role) +
      cappedCoachBoost(coach.boosts, 'weeklyTp'),
  );
}

/** Motivator strength in half-levels: a head level is 5%, an assistant level is 2.5%. */
export function coachMotivatorStrengthHalfLevels(
  market: CareerMarketState,
): number {
  const head =
    market.headCoach?.specialties.includes('MOTIVATOR') === true
      ? checkedMultiply(
          validatedCoachLevel(market.headCoach.level, 'head coach'),
          2,
          'head coach Motivator strength',
        ) + cappedCoachBoost(market.headCoach.boosts, 'motivatorHalfLevels')
      : 0;
  const assistant =
    market.assistantCoach?.specialties.includes('MOTIVATOR') === true
      ? validatedCoachLevel(market.assistantCoach.level, 'assistant coach') +
        cappedCoachBoost(market.assistantCoach.boosts, 'motivatorHalfLevels')
      : 0;
  // A boost only counts on a coach who actually holds MOTIVATOR, and the total
  // cannot go negative — the effect cancels his own strength, not the club's.
  return Math.max(0, head + assistant);
}

export function coachMotivatorBonusPercent(
  level: number,
  role: CareerCoachRole,
): number {
  validateCoachLevel(level, role === 'HEAD' ? 'head coach' : 'assistant coach');
  return level * (role === 'HEAD' ? 5 : 2.5);
}

const SPECIALTY_BY_ATTRIBUTE: Readonly<
  Record<TrainingAttribute, CoachSpecialty>
> = {
  pac: 'FITNESS',
  sho: 'ATTACK',
  pas: 'TECHNIQUE',
  def: 'DEFENSE',
  tec: 'TECHNIQUE',
  sta: 'FITNESS',
  ref: 'GOALKEEPING',
};

interface CareerCoachTrainingModifiers {
  readonly coachId?: string;
  readonly assistantCoachId?: string;
  readonly qualityLevel: number;
  /** Canonical +10% per coach level, applied only to matching specialties. */
  readonly specialtyBonusPercent: number;
  readonly specialties: readonly CoachSpecialty[];
  /** Integer percent scales, where 100 means no coach bonus. */
  readonly gainScalePercentByAttribute: Readonly<
    Record<TrainingAttribute, number>
  >;
}

/** Negative when a coach is employed, ready to append to a weekly ledger. */
export function careerCoachWageLedgerAmount(market: CareerMarketState): number {
  const wage = careerCoachWeeklyWage(market);
  if (!Number.isSafeInteger(wage) || wage < 0) {
    throw new Error(
      'head coach weekly wage must be a non-negative safe integer',
    );
  }
  return wage === 0 ? 0 : -wage;
}

/** Stable weekly TP created by employed staff, independent of match results. */
export function careerCoachWeeklyTrainingPoints(
  market: CareerMarketState,
): number {
  const head = market.headCoach;
  const assistant = market.assistantCoach;
  if (head !== undefined)
    validateCoach(head.level, head.specialties, 'head coach');
  if (assistant !== undefined)
    validateCoach(assistant.level, assistant.specialties, 'assistant coach');
  const headPoints =
    head === undefined ? 0 : coachWeeklyTrainingPointsWithBoosts(head, 'HEAD');
  const assistantPoints =
    assistant === undefined
      ? 0
      : coachWeeklyTrainingPointsWithBoosts(assistant, 'ASSISTANT');
  return headPoints + assistantPoints;
}

/**
 * Converts the head coach's level and specialties into plain, serializable
 * training scales. Motivator has no direct stat-drill mapping.
 */
export function careerCoachTrainingModifiers(
  market: CareerMarketState,
): CareerCoachTrainingModifiers {
  const coach = market.headCoach;
  const assistant = market.assistantCoach;
  if (coach === undefined && assistant === undefined) {
    return {
      qualityLevel: 0,
      specialtyBonusPercent: 0,
      specialties: [],
      gainScalePercentByAttribute: scaleRecord(100),
    };
  }

  if (coach !== undefined)
    validateCoach(coach.level, coach.specialties, 'head coach');
  if (assistant !== undefined)
    validateCoach(assistant.level, assistant.specialties, 'assistant coach');
  const specialtyBonusPercent =
    coach === undefined ? 0 : coachTrainingBonusPercent(coach.level, 'HEAD');
  // The assistant contributes half strength so the second slot is meaningful
  // without doubling the established M2 training curve.
  const assistantBonusPercent =
    assistant === undefined
      ? 0
      : coachTrainingBonusPercent(assistant.level, 'ASSISTANT');
  const specialties = Array.from(
    new Set([...(coach?.specialties ?? []), ...(assistant?.specialties ?? [])]),
  );
  /**
   * Clamped into the band the validator will accept, not merely added.
   *
   * `applyCareerCoachTrainingModifier` **throws** outside 100..175, and a level-5
   * head plus a level-5 assistant sharing a specialty already sums to exactly
   * 175. A boost added on top would therefore throw on every training action
   * from then on — permanently, because a boost cannot be removed. Clamping
   * here is also the honest balance answer: a club already running two maxed
   * specialists gains nothing more, and a negative bottoms out at "no coach
   * benefit" rather than making a coached club worse than an uncoached one.
   */
  const gainScale = (attribute: TrainingAttribute): number => {
    const coachMatches =
      coach?.specialties.includes(SPECIALTY_BY_ATTRIBUTE[attribute]) === true;
    const assistantMatches =
      assistant?.specialties.includes(SPECIALTY_BY_ATTRIBUTE[attribute]) ===
      true;
    const raw =
      100 +
      (coachMatches
        ? specialtyBonusPercent +
          cappedCoachBoost(coach?.boosts, 'trainingPercent')
        : 0) +
      (assistantMatches
        ? assistantBonusPercent +
          cappedCoachBoost(assistant?.boosts, 'trainingPercent')
        : 0);
    return Math.max(100, Math.min(175, raw));
  };

  return {
    ...(coach === undefined ? {} : { coachId: coach.id }),
    ...(assistant === undefined ? {} : { assistantCoachId: assistant.id }),
    qualityLevel: coach?.level ?? 0,
    specialtyBonusPercent,
    specialties,
    gainScalePercentByAttribute: {
      pac: gainScale('pac'),
      sho: gainScale('sho'),
      pas: gainScale('pas'),
      def: gainScale('def'),
      tec: gainScale('tec'),
      sta: gainScale('sta'),
      ref: gainScale('ref'),
    },
  };
}

/** Applies one attribute scale with deterministic whole-point rounding. */
export function applyCareerCoachTrainingModifier(
  gain: number,
  attribute: keyof Attrs,
  modifiers: CareerCoachTrainingModifiers,
): number {
  if (!Number.isSafeInteger(gain) || gain < 0) {
    throw new Error('training gain must be a non-negative safe integer');
  }
  if (!TRAINING_ATTRIBUTES.includes(attribute as TrainingAttribute)) {
    throw new Error(`unknown training attribute ${String(attribute)}`);
  }
  const scalePercent =
    modifiers.gainScalePercentByAttribute[attribute as TrainingAttribute];
  if (
    !Number.isSafeInteger(scalePercent) ||
    scalePercent < 100 ||
    scalePercent > 175
  ) {
    throw new Error(
      'coach training scale must be an integer percent from 100 to 175',
    );
  }
  const scaled = checkedMultiply(
    gain,
    scalePercent,
    'coach-adjusted training gain',
  );
  return Math.round(scaled / 100);
}

function validateCoach(
  level: number,
  specialties: readonly CoachSpecialty[],
  label: string,
): void {
  validateCoachLevel(level, label);
  if (specialties.length !== 2 || new Set(specialties).size !== 2) {
    throw new Error(`${label} must have two distinct specialties`);
  }
}

function validateCoachLevel(level: number, label: string): void {
  if (!Number.isSafeInteger(level) || level < 1 || level > 5) {
    throw new Error(`${label} level must be an integer from 1 to 5`);
  }
}

function validatedCoachLevel(level: number, label: string): number {
  validateCoachLevel(level, label);
  return level;
}

function scaleRecord(scalePercent: number): Record<TrainingAttribute, number> {
  return {
    pac: scalePercent,
    sho: scalePercent,
    pas: scalePercent,
    def: scalePercent,
    tec: scalePercent,
    sta: scalePercent,
    ref: scalePercent,
  };
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
