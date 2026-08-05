import { TRAINING_PITCH_TP_PER_LEVEL } from '../game/facilities';
import type { FacilityTypeViewModel } from './models';

/**
 * Short, plain-language weekly benefit for each facility, shown in the
 * placement preview so the player knows what a building actually does before
 * dropping it. Copy is derived from the real effects in src/game (training
 * multipliers, ambient TP, wellbeing, scouting, merch income, adjacencies).
 */
export function facilityBenefit(type: FacilityTypeViewModel): string {
  switch (type) {
    case 'training-pitch':
      return `Adds +${TRAINING_PITCH_TP_PER_LEVEL} TP per completed level every week. Upgrades also boost defense training.`;
    case 'gym':
      return 'Boosts pace and stamina training. +25% at Level 1, up to +100% at Level 3.';
    case 'tech-center':
      return 'Boosts passing and technique training. +25% at Level 1, up to +100% at Level 3.';
    case 'shooting-range':
      return 'Boosts shooting training. +25% at Level 1, up to +100% at Level 3.';
    case 'keeper-court':
      return 'Boosts goalkeeping training. +25% at Level 1, up to +100% at Level 3.';
    case 'medical-bay':
      return 'Shortens injuries by one week. Its placement can also unlock a safety bonus.';
    case 'dorm':
      return 'Adds +4 weekly condition recovery per Level, so players can train more often.';
    case 'scout-office':
      return 'Adds one more name per scouting mission and narrows rating estimates. Level 3 confirms reported powers.';
    case 'coaching-office':
      return 'Unlocks the assistant coach position.';
    case 'youth-field':
      return 'Improves the starting ratings of future youth intakes. Better prospects cost larger signing bonuses.';
    case 'fan-shop':
      return 'Earns weekly merchandise income, more per Level.';
    case 'stadium-stand':
      return 'Adds +50% home gate income per Level. The bigger the club, the bigger the return.';
  }
}
