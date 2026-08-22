import {
  cappedCoachBoost,
  coachMotivatorBonusPercent,
  coachTrainingBonusPercent,
  coachWeeklyTrainingPointsWithBoosts,
} from '../game/coach-weekly';
import type { CoachCandidate, CoachSpecialty } from '../game/market';
import type { CareerCoachRole } from '../game/market-career';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

const TRAINING_LABELS: Readonly<
  Record<Exclude<CoachSpecialty, 'MOTIVATOR'>, string>
> = {
  ATTACK: 'SHO',
  DEFENSE: 'DEF',
  FITNESS: 'PAC & STA',
  TECHNIQUE: 'PAS & TEC',
  GOALKEEPING: 'REF',
};

/** Player-facing numbers shared by the coach market and employed-staff cards. */
export function coachRoleEffectLabels(
  coach: Pick<CoachCandidate, 'level' | 'specialties' | 'boosts'>,
  role: CareerCoachRole,
  t: CopyFn = englishCopy(),
): string[] {
  const trainingBonusPercent =
    coachTrainingBonusPercent(coach.level, role) +
    cappedCoachBoost(coach.boosts, 'trainingPercent');
  const motivatorBonusPercent = Math.max(
    0,
    coachMotivatorBonusPercent(coach.level, role) +
      cappedCoachBoost(coach.boosts, 'motivatorHalfLevels') * 2.5,
  );
  return [
    ...coach.specialties.map((specialty) =>
      specialty === 'MOTIVATOR'
        ? t('coachStaff.effectMotivator', {
            percent: formatPercent(motivatorBonusPercent),
          })
        : t('coachStaff.effectTraining', {
            stats: TRAINING_LABELS[specialty],
            percent: formatSignedPercent(trainingBonusPercent),
          }),
    ),
    t('coachStaff.effectTpWeekly', {
      points: coachWeeklyTrainingPointsWithBoosts(coach, role),
    }),
  ];
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${formatPercent(value)}`;
}
