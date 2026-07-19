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
  if (coach === undefined) {
    return {
      qualityLevel: 0,
      specialtyBonusPercent: 0,
      specialties: [],
      gainScalePercentByAttribute: scaleRecord(100),
    };
  }

  validateHeadCoach(coach.level, coach.specialties);
  const specialtyBonusPercent = checkedMultiply(
    coach.level,
    10,
    'head coach specialty bonus',
  );
  const specialties = [...coach.specialties];
  const specialtySet = new Set(specialties);

  return {
    coachId: coach.id,
    qualityLevel: coach.level,
    specialtyBonusPercent,
    specialties,
    gainScalePercentByAttribute: {
      pac: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.pac) ? 100 + specialtyBonusPercent : 100,
      sho: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.sho) ? 100 + specialtyBonusPercent : 100,
      pas: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.pas) ? 100 + specialtyBonusPercent : 100,
      def: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.def) ? 100 + specialtyBonusPercent : 100,
      tec: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.tec) ? 100 + specialtyBonusPercent : 100,
      sta: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.sta) ? 100 + specialtyBonusPercent : 100,
      ref: specialtySet.has(SPECIALTY_BY_ATTRIBUTE.ref) ? 100 + specialtyBonusPercent : 100,
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
  if (!Number.isSafeInteger(scalePercent) || scalePercent < 100 || scalePercent > 150) {
    throw new Error('coach training scale must be an integer percent from 100 to 150');
  }
  const scaled = checkedMultiply(gain, scalePercent, 'coach-adjusted training gain');
  return Math.round(scaled / 100);
}

function validateHeadCoach(
  level: number,
  specialties: readonly CoachSpecialty[],
): void {
  if (!Number.isSafeInteger(level) || level < 1 || level > 5) {
    throw new Error('head coach level must be an integer from 1 to 5');
  }
  if (specialties.length !== 2 || new Set(specialties).size !== 2) {
    throw new Error('head coach must have two distinct specialties');
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
