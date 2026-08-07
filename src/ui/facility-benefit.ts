import { TRAINING_PITCH_TP_PER_LEVEL } from '../game/facilities';
import { copyFor, type CopyFn } from '../i18n';
import type { FacilityTypeViewModel } from './models';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * The same lazy shape `application/view-models.ts` uses, and lazy for the same
 * reason: `copyFor` reaches `loadLaunchContent`, a zod pass that has no business
 * running at the import of anything that touches `src/ui`.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/** The catalog segment for each facility's benefit line. */
const BENEFIT_KEY: Readonly<Record<FacilityTypeViewModel, string>> = {
  'training-pitch': 'trainingPitch',
  gym: 'gym',
  'tech-center': 'techCenter',
  'shooting-range': 'shootingRange',
  'keeper-court': 'keeperCourt',
  'medical-bay': 'medicalBay',
  dorm: 'dorm',
  'scout-office': 'scoutOffice',
  'coaching-office': 'coachingOffice',
  'youth-field': 'youthField',
  'fan-shop': 'fanShop',
  'stadium-stand': 'stadiumStand',
};

/**
 * Short, plain-language weekly benefit for each facility, shown in the
 * placement preview so the player knows what a building actually does before
 * dropping it. Copy is derived from the real effects in src/game (training
 * multipliers, ambient TP, wellbeing, scouting, merch income, adjacencies).
 *
 * One whole sentence per facility rather than a shared frame with the subject
 * slotted in: "Boosts pace and stamina training" and "Boosts goalkeeping
 * training" only look like the same sentence in English.
 */
export function facilityBenefit(
  type: FacilityTypeViewModel,
  t: CopyFn = englishCopy(),
): string {
  return t(`clubFinances.facilityBenefit.${BENEFIT_KEY[type]}`, {
    // Only the training pitch's line has a hole to fill; an unused param costs
    // nothing and keeps the lookup a single call.
    points: TRAINING_PITCH_TP_PER_LEVEL,
  });
}
