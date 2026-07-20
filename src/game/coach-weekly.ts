import type { Attrs } from '../sim/types';
import { careerCoachWeeklyWage, type CareerMarketState } from './market-career';
import type { CoachSpecialty } from './market';

const TRAINING_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

export type TrainingAttribute = typeof TRAINING_ATTRIBUTES[number];

const SPECIALTY_BY_ATTRIBUTE: Readonly<Record<TrainingAttribute, CoachSpecialty>> = {
  pac: 'FITNESS',
  sho: 'ATTACK',
  pas: 'TECHNIQUE',
  def: 'DEFENSE',
  tec: 'TECHNIQUE',
  sta: 'FITNESS',
  ref: 'GOALKEEPING',
};

export interface CareerCoachTrainingModifiers {
  readonly coachId?: string;
  readonly assistantCoachId?: string;
  readonly qualityLevel: number;
  /** Canonical +10% per coach level, applied only to matching specialties. */
  readonly specialtyBonusPercent: number;
  readonly specialties: readonly CoachSpecialty[];
  /** Integer percent scales, where 100 means no coach bonus. */
  readonly gainScalePercentByAttribute: Readonly<Record<TrainingAttribute, number>>;
}

/** Negative when a coach is employed, ready to append to a weekly ledger. */
export function careerCoachWageLedgerAmount(market: CareerMarketState): number {
  const wage = careerCoachWeeklyWage(market);
  if (!Number.isSafeInteger(wage) || wage < 0) {
    throw new Error('head coach weekly wage must be a non-negative safe integer');
  }
  return wage === 0 ? 0 : -wage;
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

  if (coach !== undefined) validateCoach(coach.level, coach.specialties, 'head coach');
  if (assistant !== undefined) validateCoach(assistant.level, assistant.specialties, 'assistant coach');
  const specialtyBonusPercent = checkedMultiply(
    coach?.level ?? 0,
    10,
    'head coach specialty bonus',
  );
  // The assistant contributes half strength so the second slot is meaningful
  // without doubling the established M2 training curve.
  const assistantBonusPercent = checkedMultiply(assistant?.level ?? 0, 5, 'assistant coach specialty bonus');
  const specialties = Array.from(new Set([
    ...(coach?.specialties ?? []),
    ...(assistant?.specialties ?? []),
  ]));
  const gainScale = (attribute: TrainingAttribute): number => 100
    + (coach?.specialties.includes(SPECIALTY_BY_ATTRIBUTE[attribute]) === true
      ? specialtyBonusPercent
      : 0)
    + (assistant?.specialties.includes(SPECIALTY_BY_ATTRIBUTE[attribute]) === true
      ? assistantBonusPercent
      : 0);

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
  const scalePercent = modifiers.gainScalePercentByAttribute[attribute as TrainingAttribute];
  if (!Number.isSafeInteger(scalePercent) || scalePercent < 100 || scalePercent > 175) {
    throw new Error('coach training scale must be an integer percent from 100 to 175');
  }
  const scaled = checkedMultiply(gain, scalePercent, 'coach-adjusted training gain');
  return Math.round(scaled / 100);
}

function validateCoach(
  level: number,
  specialties: readonly CoachSpecialty[],
  label: string,
): void {
  if (!Number.isSafeInteger(level) || level < 1 || level > 5) {
    throw new Error(`${label} level must be an integer from 1 to 5`);
  }
  if (specialties.length !== 2 || new Set(specialties).size !== 2) {
    throw new Error(`${label} must have two distinct specialties`);
  }
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
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
