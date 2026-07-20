import {
  coachMotivatorBonusPercent,
  coachTrainingBonusPercent,
} from '../game/coach-weekly';
import type { CoachCandidate, CoachSpecialty } from '../game/market';
import type { CareerCoachRole } from '../game/market-career';

const TRAINING_LABELS: Readonly<Record<Exclude<CoachSpecialty, 'MOTIVATOR'>, string>> = {
  ATTACK: 'SHO',
  DEFENSE: 'DEF',
  FITNESS: 'PAC & STA',
  TECHNIQUE: 'PAS & TEC',
  GOALKEEPING: 'REF',
};

/** Player-facing numbers shared by the coach market and employed-staff cards. */
export function coachRoleEffectLabels(
  coach: Pick<CoachCandidate, 'level' | 'specialties'>,
  role: CareerCoachRole,
): string[] {
  const trainingBonusPercent = coachTrainingBonusPercent(coach.level, role);
  const motivatorBonusPercent = coachMotivatorBonusPercent(coach.level, role);
  return coach.specialties.map(specialty => specialty === 'MOTIVATOR'
    ? `Morale loss −${formatPercent(motivatorBonusPercent)} · Hero Gauge +${formatPercent(motivatorBonusPercent)}`
    : `${TRAINING_LABELS[specialty]} training +${formatPercent(trainingBonusPercent)}`);
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}
