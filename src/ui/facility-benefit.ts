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
      return 'Adds +5 Training Points every week and powers your general training.';
    case 'gym':
      return 'Speeds up speed (PAC) & stamina (STA) training — bigger boost at Level 2+.';
    case 'tech-center':
      return 'Speeds up passing (PAS) & technique (TEC) training — bigger boost at Level 2+.';
    case 'shooting-range':
      return 'Speeds up shooting (SHO) training — bigger boost at Level 2+.';
    case 'keeper-court':
      return 'Speeds up goalkeeping (REF) training — bigger boost at Level 2+.';
    case 'medical-bay':
      return 'Heals injuries faster and lowers weekly injury risk.';
    case 'dorm':
      return 'Player accommodation built for rest and recovery. Its value comes from the right neighbour.';
    case 'scout-office':
      return 'Improves transfer scouting — better targets at higher levels.';
    case 'coaching-office':
      return 'Home base for your coaching staff.';
    case 'youth-field':
      return 'Unlocks youth intake and bigger youth signing bonuses.';
    case 'fan-shop':
      return 'Earns weekly merchandise income — more per Level.';
    case 'stadium-stand':
      return 'Creates a matchday crowd route. Its value comes from the right neighbour.';
    case 'hero-lab':
      return 'Advanced hero research facility.';
  }
}
