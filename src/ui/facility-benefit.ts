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
      return 'Adds +10 Training Points per Level every week. Upgrades also boost defense training.';
    case 'gym':
      return 'Level 1 has no training bonus. Level 2+ boosts pace and stamina training.';
    case 'tech-center':
      return 'Level 1 has no training bonus. Level 2+ boosts passing and technique training.';
    case 'shooting-range':
      return 'Level 1 has no training bonus. Level 2+ boosts shooting training.';
    case 'keeper-court':
      return 'Level 1 has no training bonus. Level 2+ boosts goalkeeping training.';
    case 'medical-bay':
      return 'Shortens injuries by one week. Its placement can also unlock a safety bonus.';
    case 'dorm':
      return 'Player accommodation built for rest and recovery. Its value comes from the right neighbour.';
    case 'scout-office':
      return 'Narrows player rating estimates. Level 3 confirms reported powers.';
    case 'coaching-office':
      return 'Unlocks the assistant coach position.';
    case 'youth-field':
      return 'Improves the starting ratings of future youth intakes. Better prospects cost larger signing bonuses.';
    case 'fan-shop':
      return 'Earns weekly merchandise income — more per Level.';
    case 'stadium-stand':
      return 'Creates a matchday crowd route. Its value comes from the right neighbour.';
  }
}
